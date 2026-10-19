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
const SceneAudioOwner_1 = require("../renderer/lesson/SceneAudioOwner");
const track = (id, assetId = id) => ({ id, assetId, volume: .65, loop: true, autoplay: true });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function engine() {
    const loads = [];
    const plays = [], stops = [], pauses = [];
    const value = {
        preload: (url) => { const done = deferred(); loads.push({ url, done }); return done.promise; },
        getDuration: () => 2,
        playClip: (url, volume, loop) => { plays.push({ url, volume, loop }); },
        pauseClip: (url) => { pauses.push(url); },
        stopClip: (url) => { stops.push(url); },
    };
    return { value, loads, plays, stops, pauses };
}
(0, node_test_1.default)('scene audio stop fences late preload completion without starting a playback', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner(e.value);
    const pending = owner.play([track('voice')], id => `media://${id}`);
    owner.stop();
    e.loads[0].done.resolve();
    await pending;
    strict_1.default.equal(e.plays.length, 0);
    strict_1.default.deepEqual(e.stops, ['media://voice']);
    owner.stop();
    strict_1.default.equal(e.stops.length, 1);
});
(0, node_test_1.default)('duplicate scene references register exactly one preload and playback for each media URL', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner(e.value);
    const pending = owner.play([track('one', 'shared'), track('two', 'shared')], id => `media://${id}`);
    strict_1.default.equal(e.loads.length, 1);
    e.loads[0].done.resolve();
    await pending;
    strict_1.default.deepEqual(e.plays, [{ url: 'media://shared', volume: .65, loop: true }]);
    owner.stop();
    strict_1.default.deepEqual(e.stops, ['media://shared']);
});
(0, node_test_1.default)('navigation to the same source retires old load and plays only the new request', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner(e.value);
    const before = owner.play([track('old', 'shared')], id => id);
    const after = owner.play([{ ...track('new', 'shared'), volume: .2, loop: false }], id => id);
    e.loads[0].done.resolve();
    await before;
    strict_1.default.equal(e.plays.length, 0);
    e.loads[1].done.resolve();
    await after;
    strict_1.default.deepEqual(e.plays, [{ url: 'shared', volume: .2, loop: false }]);
});
/** Use the real mixer, replacing only browser I/O and Web Audio primitives. */
function mixerWithFailedInitialLoad(failInitial = true) {
    const exports = {}, retry = deferred();
    let fetches = 0, starts = 0;
    const offsets = [];
    const source = (0, node_fs_1.readFileSync)('src/renderer/audio/AudioController.ts', 'utf8').replaceAll('import.meta', '__hotMeta');
    const js = typescript_1.default.transpileModule(source, { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInNewContext(js, {
        exports, console, setTimeout, clearTimeout, performance, __hotMeta: {},
        fetch: async () => { fetches++; if (failInitial && fetches === 1)
            throw Error('Synthetic missing audio'); await retry.promise; return { arrayBuffer: async () => new ArrayBuffer(1) }; },
        navigator: { mediaDevices: {} },
        require: (name) => require(node_path_1.default.join(process.cwd(), 'dist-test/shared', node_path_1.default.basename(name))),
    });
    const controller = exports.audioController;
    controller.recordError = () => { };
    const node = () => ({ connect() { }, disconnect() { } });
    controller.context = {
        state: 'running', currentTime: 1, decodeAudioData: async () => ({ duration: 2 }),
        createBufferSource: () => ({ ...node(), start(_when, offset) { starts++; offsets.push(offset); }, stop() { }, onended: null }),
        createGain: () => ({ ...node(), gain: { value: 1, setValueAtTime() { } } }),
    };
    controller.ensureGraph = () => ({ mediaBus: node() });
    return { controller, retry, offsets, counts: () => ({ fetches, starts }) };
}
(0, node_test_1.default)('failed mixer preload never escapes scene ownership through an internal playClip retry', async () => {
    const mixer = mixerWithFailedInitialLoad(), owner = new SceneAudioOwner_1.SceneAudioOwner(mixer.controller);
    await strict_1.default.rejects(owner.play([track('broken')], id => `media://${id}`), /load|audio/i);
    owner.stop();
    mixer.retry.resolve();
    await flush();
    strict_1.default.deepEqual(mixer.counts(), { fetches: 1, starts: 0 });
});
(0, node_test_1.default)('scene audio pause preserves loaded tracks and resumes without preload or stop', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner(e.value);
    const pending = owner.play([track('voice')], id => id);
    e.loads[0].done.resolve();
    await pending;
    owner.pause();
    owner.pause();
    strict_1.default.deepEqual(e.pauses, ['voice']);
    strict_1.default.equal(e.stops.length, 0);
    owner.resume();
    owner.resume();
    strict_1.default.equal(e.plays.length, 2);
    strict_1.default.equal(e.loads.length, 1);
    strict_1.default.deepEqual(e.plays[1], e.plays[0]);
});
(0, node_test_1.default)('pause before preload completion defers playback until resume', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner(e.value);
    const pending = owner.play([track('voice')], id => id);
    owner.pause();
    e.loads[0].done.resolve();
    await pending;
    strict_1.default.equal(e.plays.length, 0);
    owner.resume();
    strict_1.default.equal(e.plays.length, 1);
    strict_1.default.equal(e.loads.length, 1);
});
(0, node_test_1.default)('stop while paused fences late loads and resume cannot resurrect them', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner(e.value);
    const pending = owner.play([track('voice')], id => id);
    owner.pause();
    owner.stop();
    owner.resume();
    e.loads[0].done.resolve();
    await pending;
    owner.resume();
    strict_1.default.equal(e.plays.length, 0);
});
(0, node_test_1.default)('pause does not restart tracks that naturally finished', async () => {
    const e = engine(), owner = new SceneAudioOwner_1.SceneAudioOwner({ ...e.value, isPlaying: () => false });
    const pending = owner.play([track('voice')], id => id);
    e.loads[0].done.resolve();
    await pending;
    owner.pause();
    owner.resume();
    strict_1.default.equal(e.plays.length, 1);
    strict_1.default.equal(e.pauses.length, 0);
});
(0, node_test_1.default)('scene audio resumes the real mixer at its paused offset', async () => {
    const mixer = mixerWithFailedInitialLoad(false), owner = new SceneAudioOwner_1.SceneAudioOwner(mixer.controller);
    mixer.retry.resolve();
    await owner.play([track('voice')], id => id);
    mixer.controller.context.currentTime = 1.75;
    owner.pause();
    mixer.controller.context.currentTime = 5;
    owner.resume();
    strict_1.default.deepEqual(mixer.offsets, [0, .75]);
    strict_1.default.deepEqual(mixer.counts(), { fetches: 1, starts: 2 });
    owner.stop();
});
