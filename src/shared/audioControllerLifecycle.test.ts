import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let hotDispose: () => void = () => {};
  let resolveMicrophone!: (stream: unknown) => void;
  const exports: any = {};
  const source = readFileSync('src/renderer/audio/AudioController.ts', 'utf8').replaceAll('import.meta', '__hotMeta');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(js, { exports, console, setTimeout, clearTimeout, performance,
    __hotMeta: { hot: { dispose: (callback: () => void) => { hotDispose = callback; } } },
    navigator: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveMicrophone = resolve; }), removeEventListener() {} } },
    cancelAnimationFrame() {},
    require: (name: string) => require(path.join(process.cwd(), 'dist-test/shared', path.basename(name))),
  });
  return { controller: exports.audioController as any, hotDispose: () => hotDispose(), resolveMicrophone: (stream: unknown) => resolveMicrophone(stream) };
}

test('hot replacement releases old microphone, sinks, destination tracks and context exactly once', () => {
  const h = harness(); const a = h.controller;
  let micStops = 0, sinkStops = 0, destinationStops = 0, closes = 0;
  a.microphoneStream = { getTracks: () => [{ stop: () => micStops++ }] };
  a.microphoneSource = { disconnect() {} };
  const destination = () => ({ disconnect() {}, stream: { getTracks: () => [{ stop: () => destinationStops++ }] } });
  a.graph = { monitorDestination: destination(), mixDestination: destination(), analysers: { master: { fftSize: 2048, disconnect() {} } } };
  a.context = { state: 'running', close: () => { closes++; return Promise.resolve(); } };
  a.coordinator.seed('mix', { active: true, dispose: () => sinkStops++ });
  a.coordinator.seed('monitor', { active: true, dispose: () => sinkStops++ });
  h.hotDispose(); h.hotDispose();
  assert.equal(micStops, 1); assert.equal(sinkStops, 2); assert.equal(destinationStops, 2); assert.equal(closes, 1);
  assert.equal(a.coordinator.getActiveRouteCount(), 0);
  assert.throws(() => a.getContext(), /disposed/);
});

test('microphone permission completing after disposal cannot start another graph', async () => {
  const h = harness(); let stops = 0;
  const pending = h.controller.enableMic('test-microphone');
  h.hotDispose();
  h.resolveMicrophone({ getTracks: () => [{ stop: () => stops++ }] });
  await pending;
  assert.equal(stops, 1);
  assert.equal(h.controller.microphoneStream, null);
  assert.equal(h.controller.graph, null);
});

function externalHarness() {
  const h = harness(); const a = h.controller;
  const sources: any[] = [], gains: any[] = [];
  const node = () => ({ outputs: new Set<any>(), connections: 0, connect(next: any) { this.outputs.add(next); this.connections++; }, disconnect() { this.outputs.clear(); } });
  const context = { state: 'running', currentTime: 1, close: async () => {},
    createMediaStreamSource(stream: unknown) { const source = { ...node(), stream }; sources.push(source); return source; },
    createMediaElementSource(element: unknown) { const source = { ...node(), element }; sources.push(source); return source; },
    createGain() { const gain = { ...node(), gain: { value: 1, setValueAtTime(value: number) { this.value = value; } } }; gains.push(gain); return gain; },
  };
  a.context = context;
  a.ensureGraph = () => {
    if (a.disposed) throw Error('disposed');
    if (!a.graph) a.graph = { mediaBus: node(), analysers: { master: { ...node(), fftSize: 2048 } },
      monitorDestination: { ...node(), stream: { getTracks: () => [] } }, mixDestination: { ...node(), stream: { getTracks: () => [] } } };
    return a.graph;
  };
  a.attachDeviceListener = () => {};
  a.refreshDevices = async () => {};
  a.restoreRoutes = async () => {};
  return { ...h, a, sources, gains, context };
}

test('external media attaches silent and idempotently opens one existing mixer input', () => {
  const { a, sources, gains } = externalHarness(); const stream = {};
  a.attachExternalMediaStream('bridge', stream, .6);
  assert.equal(sources.length, 1); assert.equal(gains[0].gain.value, 0);
  assert.equal(gains[0].outputs.size, 1); assert.ok(gains[0].outputs.has(a.graph.mediaBus));
  a.setExternalMediaEnabled('bridge', true);
  assert.equal(gains[0].gain.value, .6);
  a.attachExternalMediaStream('bridge', stream, .4);
  assert.equal(sources.length, 1); assert.equal(sources[0].connections, 1); assert.equal(gains[0].connections, 1);
  assert.equal(gains[0].gain.value, .4);
  a.setExternalMediaEnabled('bridge', false); a.setExternalMediaVolume('bridge', .8);
  assert.equal(gains[0].gain.value, 0);
  a.setExternalMediaEnabled('bridge', true); assert.equal(gains[0].gain.value, .8);
  a.setExternalMediaVolume('bridge', NaN); assert.equal(gains[0].gain.value, 0);
});

test('external media restart reconnects active inputs once and never revives detached sources', async () => {
  const { a, sources, gains } = externalHarness();
  const settings = JSON.stringify(a.snapshot.settings);
  a.attachExternalMediaStream('live', {}, .5); a.setExternalMediaEnabled('live', true);
  a.attachExternalMediaStream('retired', {}, 1); a.setExternalMediaEnabled('retired', true);
  a.detachExternalMediaStream('retired');
  const oldBus = a.graph.mediaBus;
  await a.restart();
  assert.notEqual(a.graph.mediaBus, oldBus);
  assert.equal(sources.length, 2); assert.equal(sources[0].connections, 1);
  assert.equal(gains[0].connections, 2); assert.equal(gains[0].outputs.size, 1); assert.ok(gains[0].outputs.has(a.graph.mediaBus));
  assert.equal(gains[0].gain.value, .5);
  assert.equal(sources[1].outputs.size, 0); assert.equal(gains[1].outputs.size, 0); assert.equal(gains[1].gain.value, 0);
  assert.equal(JSON.stringify(a.snapshot.settings), settings);
});

test('external stream replacement and disposal silence nodes without stopping bridge-owned tracks', () => {
  const { a, sources, gains, hotDispose } = externalHarness(); let stops = 0;
  const stream = () => ({ getTracks: () => [{ stop: () => stops++ }] });
  a.attachExternalMediaStream('bridge', stream(), 1); a.setExternalMediaEnabled('bridge', true);
  a.attachExternalMediaStream('bridge', stream(), .7);
  assert.equal(sources.length, 2); assert.equal(sources[0].outputs.size, 0); assert.equal(gains[0].outputs.size, 0); assert.equal(gains[0].gain.value, 0);
  assert.equal(gains[1].gain.value, 0);
  a.setExternalMediaEnabled('bridge', true); hotDispose(); hotDispose();
  assert.equal(sources[1].outputs.size, 0); assert.equal(gains[1].outputs.size, 0); assert.equal(gains[1].gain.value, 0);
  assert.equal(stops, 0);
  a.detachExternalMediaStream('bridge');
  assert.throws(() => a.attachExternalMediaStream('later', stream(), 1), /disposed/);
});

test('external registration never resumes a suspended context and a closed gate survives restart', async () => {
  const { a, context, gains } = externalHarness(); let resumes = 0;
  Object.assign(context, { state: 'suspended', resume: async () => { resumes++; } });
  a.attachExternalMediaStream('bridge', {}, .9);
  a.setExternalMediaVolume('bridge', .4);
  await a.restart();
  assert.equal(resumes, 0);
  assert.equal(gains[0].gain.value, 0);
  assert.equal(gains[0].outputs.size, 1);
});

test('detached legacy video cannot regain an audio route through volume edits or mixer restart', async () => {
  const { a, gains, sources } = externalHarness(); const element = {};
  a.attachMediaElement(element, .6);
  a.detachMediaElement(element);
  a.setMediaElementVolume(element, .9);
  assert.equal(gains[0].gain.value, 0);
  await a.restart();
  assert.equal(gains[0].outputs.size, 0);
  a.attachMediaElement(element, .4);
  assert.equal(sources.length, 1);
  assert.equal(gains[0].outputs.size, 1);
  assert.equal(gains[0].gain.value, .4);
});
