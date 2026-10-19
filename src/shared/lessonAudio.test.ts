import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { SceneAudioOwner } from '../renderer/lesson/SceneAudioOwner';
import type { SceneAudio } from './lesson/model';

const track = (id: string, assetId = id): SceneAudio => ({ id, assetId, volume: .65, loop: true, autoplay: true });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function engine() {
  const loads: { url: string; done: ReturnType<typeof deferred> }[] = [];
  const plays: { url: string; volume: number; loop: boolean }[] = [], stops: string[] = [], pauses: string[] = [];
  const value = {
    preload: (url: string) => { const done = deferred(); loads.push({ url, done }); return done.promise; },
    getDuration: () => 2,
    playClip: (url: string, volume: number, loop: boolean) => { plays.push({ url, volume, loop }); },
    pauseClip: (url: string) => { pauses.push(url); },
    stopClip: (url: string) => { stops.push(url); },
  };
  return { value, loads, plays, stops, pauses };
}

test('scene audio stop fences late preload completion without starting a playback', async () => {
  const e = engine(), owner = new SceneAudioOwner(e.value);
  const pending = owner.play([track('voice')], id => `media://${id}`);
  owner.stop(); e.loads[0].done.resolve(); await pending;
  assert.equal(e.plays.length, 0); assert.deepEqual(e.stops, ['media://voice']);
  owner.stop(); assert.equal(e.stops.length, 1);
});

test('duplicate scene references register exactly one preload and playback for each media URL', async () => {
  const e = engine(), owner = new SceneAudioOwner(e.value);
  const pending = owner.play([track('one', 'shared'), track('two', 'shared')], id => `media://${id}`);
  assert.equal(e.loads.length, 1); e.loads[0].done.resolve(); await pending;
  assert.deepEqual(e.plays, [{ url: 'media://shared', volume: .65, loop: true }]);
  owner.stop(); assert.deepEqual(e.stops, ['media://shared']);
});

test('navigation to the same source retires old load and plays only the new request', async () => {
  const e = engine(), owner = new SceneAudioOwner(e.value);
  const before = owner.play([track('old', 'shared')], id => id);
  const after = owner.play([{ ...track('new', 'shared'), volume: .2, loop: false }], id => id);
  e.loads[0].done.resolve(); await before; assert.equal(e.plays.length, 0);
  e.loads[1].done.resolve(); await after;
  assert.deepEqual(e.plays, [{ url: 'shared', volume: .2, loop: false }]);
});

/** Use the real mixer, replacing only browser I/O and Web Audio primitives. */
function mixerWithFailedInitialLoad(failInitial = true) {
  const exports: any = {}, retry = deferred(); let fetches = 0, starts = 0; const offsets: number[] = [];
  const source = readFileSync('src/renderer/audio/AudioController.ts', 'utf8').replaceAll('import.meta', '__hotMeta');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(js, {
    exports, console, setTimeout, clearTimeout, performance, __hotMeta: {},
    fetch: async () => { fetches++; if (failInitial && fetches === 1) throw Error('Synthetic missing audio'); await retry.promise; return { arrayBuffer: async () => new ArrayBuffer(1) }; },
    navigator: { mediaDevices: {} },
    require: (name: string) => require(path.join(process.cwd(), 'dist-test/shared', path.basename(name))),
  });
  const controller = exports.audioController as any;
  controller.recordError = () => {};
  const node = () => ({ connect() {}, disconnect() {} });
  controller.context = {
    state: 'running', currentTime: 1, decodeAudioData: async () => ({ duration: 2 }),
    createBufferSource: () => ({ ...node(), start(_when: number, offset: number) { starts++; offsets.push(offset); }, stop() {}, onended: null }),
    createGain: () => ({ ...node(), gain: { value: 1, setValueAtTime() {} } }),
  };
  controller.ensureGraph = () => ({ mediaBus: node() });
  return { controller, retry, offsets, counts: () => ({ fetches, starts }) };
}

test('failed mixer preload never escapes scene ownership through an internal playClip retry', async () => {
  const mixer = mixerWithFailedInitialLoad(), owner = new SceneAudioOwner(mixer.controller);
  await assert.rejects(owner.play([track('broken')], id => `media://${id}`), /load|audio/i);
  owner.stop(); mixer.retry.resolve(); await flush();
  assert.deepEqual(mixer.counts(), { fetches: 1, starts: 0 });
});

test('scene audio pause preserves loaded tracks and resumes without preload or stop', async () => {
 const e=engine(),owner=new SceneAudioOwner(e.value);const pending=owner.play([track('voice')],id=>id);e.loads[0].done.resolve();await pending;
 owner.pause();owner.pause();assert.deepEqual(e.pauses,['voice']);assert.equal(e.stops.length,0);
 owner.resume();owner.resume();assert.equal(e.plays.length,2);assert.equal(e.loads.length,1);assert.deepEqual(e.plays[1],e.plays[0]);
});
test('pause before preload completion defers playback until resume', async () => {
 const e=engine(),owner=new SceneAudioOwner(e.value);const pending=owner.play([track('voice')],id=>id);owner.pause();e.loads[0].done.resolve();await pending;
 assert.equal(e.plays.length,0);owner.resume();assert.equal(e.plays.length,1);assert.equal(e.loads.length,1);
});
test('stop while paused fences late loads and resume cannot resurrect them', async () => {
 const e=engine(),owner=new SceneAudioOwner(e.value);const pending=owner.play([track('voice')],id=>id);owner.pause();owner.stop();owner.resume();e.loads[0].done.resolve();await pending;owner.resume();assert.equal(e.plays.length,0);
});
test('pause does not restart tracks that naturally finished', async () => {
 const e=engine(),owner=new SceneAudioOwner({...e.value,isPlaying:()=>false});const pending=owner.play([track('voice')],id=>id);e.loads[0].done.resolve();await pending;owner.pause();owner.resume();assert.equal(e.plays.length,1);assert.equal(e.pauses.length,0);
});

test('scene audio resumes the real mixer at its paused offset', async () => {
 const mixer=mixerWithFailedInitialLoad(false),owner=new SceneAudioOwner(mixer.controller);mixer.retry.resolve();await owner.play([track('voice')],id=>id);
 mixer.controller.context.currentTime=1.75;owner.pause();mixer.controller.context.currentTime=5;owner.resume();
 assert.deepEqual(mixer.offsets,[0,.75]);assert.deepEqual(mixer.counts(),{fetches:1,starts:2});owner.stop();
});
