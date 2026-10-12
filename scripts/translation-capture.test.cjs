const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/renderer/translation/capture.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;

function setup({ deferred = false, startThrows = false } = {}) {
  const timers = new Map(), intervals = new Map(), recorders = [], output = [], errors = [];
  let nextId = 0, closed = 0, sharedStops = 0, resolveDecode;
  const track = new EventTarget(); track.readyState = 'live'; track.stop = () => sharedStops++;
  class MediaStream { constructor(tracks) { this.tracks = tracks; } getAudioTracks() { return this.tracks; } }
  let current = new MediaStream([track]);
  class MediaRecorder {
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm'; recorders.push(this); }
    start() { if (startThrows) throw new Error('start failed'); this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['audio']) }); this.onstop(); }
  }
  class AudioContext {
    async decodeAudioData() { return deferred ? new Promise(resolve => { resolveDecode = resolve; }) : { duration: 25 }; }
    async close() { closed++; }
  }
  class OfflineAudioContext {
    constructor(channels, length, rate) { assert.equal(channels, 1); assert.equal(rate, 16000); this.length = length; }
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() { return { getChannelData: () => new Float32Array(this.length).fill(.2) }; }
  }
  const context = { exports: {}, MediaStream, MediaRecorder, AudioContext, OfflineAudioContext, Blob,
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => { const id = ++nextId; intervals.set(id, { fn, ms }); return id; }, clearInterval: id => intervals.delete(id) };
  vm.runInNewContext(source, context);
  return { track, timers, intervals, recorders, output, errors, start: () => context.exports.captureUtterance(current, () => current, data => output.push(data), error => errors.push(error)), replace: () => { current = null; }, resolve: () => resolveDecode({ duration: 1 }), closed: () => closed, sharedStops: () => sharedStops };
}
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

test('20 second limit stops and resamples to bounded mono 16 kHz without stopping shared microphone', async () => {
  const s = setup(); s.start();
  const timeout = [...s.timers.values()][0]; assert.equal(timeout.ms, 20000); timeout.fn();
  await settle();
  assert.equal(s.output.length, 1); assert.equal(s.output[0].length, 320000);
  assert.equal(s.sharedStops(), 0); assert.equal(s.closed(), 1); assert.equal(s.timers.size + s.intervals.size, 0);
});
test('cancel discards recording and removes timers without decoding or stopping shared tracks', async () => {
  const s = setup(); s.start().cancel(); s.track.dispatchEvent(new Event('ended')); await settle();
  assert.equal(s.output.length, 0); assert.equal(s.errors.length, 0); assert.equal(s.closed(), 0); assert.equal(s.sharedStops(), 0); assert.equal(s.timers.size + s.intervals.size, 0);
});
test('microphone replacement cancels capture and reports a recoverable error', async () => {
  const s = setup(); s.start(); s.replace(); [...s.intervals.values()][0].fn(); await settle();
  assert.equal(s.errors.length, 1); assert.match(s.errors[0], /changed or disconnected/); assert.equal(s.output.length, 0); assert.equal(s.sharedStops(), 0); assert.equal(s.timers.size + s.intervals.size, 0);
});
test('ended track cancels capture', async () => {
  const s = setup(); s.start(); s.track.dispatchEvent(new Event('ended')); await settle();
  assert.equal(s.errors.length, 1); assert.equal(s.output.length, 0); assert.equal(s.timers.size + s.intervals.size, 0);
});
test('cancel during decoding suppresses result and closes decoding context', async () => {
  const s = setup({ deferred: true }); const capture = s.start(); capture.stop(); await settle(); capture.cancel(); s.resolve(); await settle();
  assert.equal(s.output.length, 0); assert.equal(s.errors.length, 0); assert.equal(s.closed(), 1); assert.equal(s.sharedStops(), 0);
});
test('recorder start failure removes listeners and does not retain timers', () => {
  const s = setup({ startThrows: true }); assert.throws(s.start, /start failed/); s.track.dispatchEvent(new Event('ended'));
  assert.equal(s.errors.length, 0); assert.equal(s.timers.size + s.intervals.size, 0); assert.equal(s.sharedStops(), 0);
});
