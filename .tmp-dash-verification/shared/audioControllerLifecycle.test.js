"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
function harness() {
    let hotDispose = () => { };
    let resolveMicrophone;
    const exports = {};
    const source = (0, node_fs_1.readFileSync)('src/renderer/audio/AudioController.ts', 'utf8').replaceAll('import.meta', '__hotMeta');
    const js = typescript_1.default.transpileModule(source, { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInNewContext(js, { exports, console, setTimeout, clearTimeout, performance,
        __hotMeta: { hot: { dispose: (callback) => { hotDispose = callback; } } },
        navigator: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveMicrophone = resolve; }), removeEventListener() { } } },
        cancelAnimationFrame() { },
        require: (name) => require(node_path_1.default.join(process.cwd(), 'dist-test/shared', node_path_1.default.basename(name))),
    });
    return { controller: exports.audioController, hotDispose: () => hotDispose(), resolveMicrophone: (stream) => resolveMicrophone(stream) };
}
(0, node_test_1.default)('hot replacement releases old microphone, sinks, destination tracks and context exactly once', () => {
    const h = harness();
    const a = h.controller;
    let micStops = 0, sinkStops = 0, destinationStops = 0, closes = 0;
    a.microphoneStream = { getTracks: () => [{ stop: () => micStops++ }] };
    a.microphoneSource = { disconnect() { } };
    const destination = () => ({ disconnect() { }, stream: { getTracks: () => [{ stop: () => destinationStops++ }] } });
    a.graph = { monitorDestination: destination(), mixDestination: destination(), analysers: { master: { fftSize: 2048, disconnect() { } } } };
    a.context = { state: 'running', close: () => { closes++; return Promise.resolve(); } };
    a.coordinator.seed('mix', { active: true, dispose: () => sinkStops++ });
    a.coordinator.seed('monitor', { active: true, dispose: () => sinkStops++ });
    h.hotDispose();
    h.hotDispose();
    strict_1.default.equal(micStops, 1);
    strict_1.default.equal(sinkStops, 2);
    strict_1.default.equal(destinationStops, 2);
    strict_1.default.equal(closes, 1);
    strict_1.default.equal(a.coordinator.getActiveRouteCount(), 0);
    strict_1.default.throws(() => a.getContext(), /disposed/);
});
(0, node_test_1.default)('microphone permission completing after disposal cannot start another graph', async () => {
    const h = harness();
    let stops = 0;
    const pending = h.controller.enableMic('test-microphone');
    h.hotDispose();
    h.resolveMicrophone({ getTracks: () => [{ stop: () => stops++ }] });
    await pending;
    strict_1.default.equal(stops, 1);
    strict_1.default.equal(h.controller.microphoneStream, null);
    strict_1.default.equal(h.controller.graph, null);
});
function externalHarness() {
    const h = harness();
    const a = h.controller;
    const sources = [], gains = [];
    const node = () => ({ outputs: new Set(), connections: 0, connect(next) { this.outputs.add(next); this.connections++; }, disconnect() { this.outputs.clear(); } });
    const context = { state: 'running', currentTime: 1, close: async () => { },
        createMediaStreamSource(stream) { const source = { ...node(), stream }; sources.push(source); return source; },
        createMediaElementSource(element) { const source = { ...node(), element }; sources.push(source); return source; },
        createGain() { const gain = { ...node(), gain: { value: 1, setValueAtTime(value) { this.value = value; } } }; gains.push(gain); return gain; },
    };
    a.context = context;
    a.ensureGraph = () => {
        if (a.disposed)
            throw Error('disposed');
        if (!a.graph)
            a.graph = { mediaBus: node(), analysers: { master: { ...node(), fftSize: 2048 } },
                monitorDestination: { ...node(), stream: { getTracks: () => [] } }, mixDestination: { ...node(), stream: { getTracks: () => [] } } };
        return a.graph;
    };
    a.attachDeviceListener = () => { };
    a.refreshDevices = async () => { };
    a.restoreRoutes = async () => { };
    return { ...h, a, sources, gains, context };
}
(0, node_test_1.default)('external media attaches silent and idempotently opens one existing mixer input', () => {
    const { a, sources, gains } = externalHarness();
    const stream = {};
    a.attachExternalMediaStream('bridge', stream, .6);
    strict_1.default.equal(sources.length, 1);
    strict_1.default.equal(gains[0].gain.value, 0);
    strict_1.default.equal(gains[0].outputs.size, 1);
    strict_1.default.ok(gains[0].outputs.has(a.graph.mediaBus));
    a.setExternalMediaEnabled('bridge', true);
    strict_1.default.equal(gains[0].gain.value, .6);
    a.attachExternalMediaStream('bridge', stream, .4);
    strict_1.default.equal(sources.length, 1);
    strict_1.default.equal(sources[0].connections, 1);
    strict_1.default.equal(gains[0].connections, 1);
    strict_1.default.equal(gains[0].gain.value, .4);
    a.setExternalMediaEnabled('bridge', false);
    a.setExternalMediaVolume('bridge', .8);
    strict_1.default.equal(gains[0].gain.value, 0);
    a.setExternalMediaEnabled('bridge', true);
    strict_1.default.equal(gains[0].gain.value, .8);
    a.setExternalMediaVolume('bridge', NaN);
    strict_1.default.equal(gains[0].gain.value, 0);
});
(0, node_test_1.default)('external media restart reconnects active inputs once and never revives detached sources', async () => {
    const { a, sources, gains } = externalHarness();
    const settings = JSON.stringify(a.snapshot.settings);
    a.attachExternalMediaStream('live', {}, .5);
    a.setExternalMediaEnabled('live', true);
    a.attachExternalMediaStream('retired', {}, 1);
    a.setExternalMediaEnabled('retired', true);
    a.detachExternalMediaStream('retired');
    const oldBus = a.graph.mediaBus;
    await a.restart();
    strict_1.default.notEqual(a.graph.mediaBus, oldBus);
    strict_1.default.equal(sources.length, 2);
    strict_1.default.equal(sources[0].connections, 1);
    strict_1.default.equal(gains[0].connections, 2);
    strict_1.default.equal(gains[0].outputs.size, 1);
    strict_1.default.ok(gains[0].outputs.has(a.graph.mediaBus));
    strict_1.default.equal(gains[0].gain.value, .5);
    strict_1.default.equal(sources[1].outputs.size, 0);
    strict_1.default.equal(gains[1].outputs.size, 0);
    strict_1.default.equal(gains[1].gain.value, 0);
    strict_1.default.equal(JSON.stringify(a.snapshot.settings), settings);
});
(0, node_test_1.default)('external stream replacement and disposal silence nodes without stopping bridge-owned tracks', () => {
    const { a, sources, gains, hotDispose } = externalHarness();
    let stops = 0;
    const stream = () => ({ getTracks: () => [{ stop: () => stops++ }] });
    a.attachExternalMediaStream('bridge', stream(), 1);
    a.setExternalMediaEnabled('bridge', true);
    a.attachExternalMediaStream('bridge', stream(), .7);
    strict_1.default.equal(sources.length, 2);
    strict_1.default.equal(sources[0].outputs.size, 0);
    strict_1.default.equal(gains[0].outputs.size, 0);
    strict_1.default.equal(gains[0].gain.value, 0);
    strict_1.default.equal(gains[1].gain.value, 0);
    a.setExternalMediaEnabled('bridge', true);
    hotDispose();
    hotDispose();
    strict_1.default.equal(sources[1].outputs.size, 0);
    strict_1.default.equal(gains[1].outputs.size, 0);
    strict_1.default.equal(gains[1].gain.value, 0);
    strict_1.default.equal(stops, 0);
    a.detachExternalMediaStream('bridge');
    strict_1.default.throws(() => a.attachExternalMediaStream('later', stream(), 1), /disposed/);
});
(0, node_test_1.default)('external registration never resumes a suspended context and a closed gate survives restart', async () => {
    const { a, context, gains } = externalHarness();
    let resumes = 0;
    Object.assign(context, { state: 'suspended', resume: async () => { resumes++; } });
    a.attachExternalMediaStream('bridge', {}, .9);
    a.setExternalMediaVolume('bridge', .4);
    await a.restart();
    strict_1.default.equal(resumes, 0);
    strict_1.default.equal(gains[0].gain.value, 0);
    strict_1.default.equal(gains[0].outputs.size, 1);
});
(0, node_test_1.default)('detached legacy video cannot regain an audio route through volume edits or mixer restart', async () => {
    const { a, gains, sources } = externalHarness();
    const element = {};
    a.attachMediaElement(element, .6);
    a.detachMediaElement(element);
    a.setMediaElementVolume(element, .9);
    strict_1.default.equal(gains[0].gain.value, 0);
    await a.restart();
    strict_1.default.equal(gains[0].outputs.size, 0);
    a.attachMediaElement(element, .4);
    strict_1.default.equal(sources.length, 1);
    strict_1.default.equal(gains[0].outputs.size, 1);
    strict_1.default.equal(gains[0].gain.value, .4);
});
