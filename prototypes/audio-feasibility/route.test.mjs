import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioRoute } from './route.mjs';

function fixture() {
  const nodes = [];
  const node = () => {
    const n = { connections: [], connect(to) { this.connections.push(to); }, disconnect() { this.connections = []; },
      gain: { value: 1 }, frequency: { value: 440 }, start() {}, stop() { this.stopped = true; },
      fftSize: 32, getFloatTimeDomainData(values) { values.fill(0); } };
    nodes.push(n); return n;
  };
  const track = { stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track] };
  const ctx = { state: 'suspended', sampleRate: 48000, currentTime: 0,
    createGain: node, createAnalyser: node, createOscillator: node, createBufferSource: node,
    createMediaStreamSource: node, createMediaStreamDestination: () => Object.assign(node(), { stream }),
    async resume() { this.state = 'running'; }, async close() { this.state = 'closed'; },
    async decodeAudioData() { return {}; } };
  const audio = { srcObject: null, async setSinkId(id) { this.sinkId = id; }, async play() { this.playing = true; }, pause() { this.playing = false; } };
  const platform = { context: () => ctx, audio: () => audio, microphone: async () => stream };
  return { route: new AudioRoute(platform), platform, ctx, audio, track, nodes, stream };
}

test('mix routes exclusively through stream destination and selected audio element', async () => {
  const f = fixture(); await f.route.start('virtual-render');
  assert.equal(f.audio.sinkId, 'virtual-render'); assert.equal(f.audio.srcObject, f.stream);
  assert.equal(f.audio.playing, true); assert.equal(f.ctx.state, 'running');
  f.route.tone(); await f.route.microphone('physical-mic');
  await f.route.clip('dialogue', new ArrayBuffer(0));
  await f.route.clip('music', new ArrayBuffer(0), true);
  await f.route.clip('sfx', new ArrayBuffer(0));
  assert.deepEqual(f.route.diagnostics().sources.sort(), ['dialogue', 'mic', 'music', 'sfx', 'tone']);
  await f.route.stop();
  assert.equal(f.track.stopped, true); assert.equal(f.audio.srcObject, null);
  assert.equal(f.audio.playing, false); assert.equal(f.ctx.state, 'closed');
  assert.deepEqual(f.route.diagnostics().sources, []);
});

test('sink failure closes route without falling back to default speakers', async () => {
  const f = fixture(); f.audio.setSinkId = async () => { throw Error('unavailable'); };
  await assert.rejects(f.route.start('missing'), /unavailable/);
  assert.equal(f.ctx.state, 'closed'); assert.equal(f.audio.playing, false);
  assert.equal(f.audio.srcObject, null);
});

test('late microphone permission after Stop cannot reconnect audio', async () => {
  const f = fixture(); let finish;
  f.platform.microphone = () => new Promise(resolve => { finish = resolve; });
  await f.route.start('virtual'); const pending = f.route.microphone('mic');
  await f.route.stop(); finish(f.stream); await pending;
  assert.equal(f.track.stopped, true); assert.deepEqual(f.route.diagnostics().sources, []);
});

test('late decode after Stop cannot start a media source', async () => {
  const f = fixture(); let finish;
  f.ctx.decodeAudioData = () => new Promise(resolve => { finish = resolve; });
  await f.route.start('virtual'); const pending = f.route.clip('music', new ArrayBuffer(0));
  await f.route.stop(); finish({}); await pending;
  assert.deepEqual(f.route.diagnostics().sources, []);
});

test('late sink selection after Stop cannot restart output', async () => {
  const f = fixture(); let finish;
  f.audio.setSinkId = () => new Promise(resolve => { finish = resolve; });
  const pending = f.route.start('virtual'); await f.route.stop(); finish(); await pending;
  assert.equal(f.audio.playing, false); assert.equal(f.audio.srcObject, null);
});

test('stopping an individual clip cancels its pending decode', async () => {
  const f = fixture(); let finish;
  f.ctx.decodeAudioData = () => new Promise(resolve => { finish = resolve; });
  await f.route.start('virtual'); const pending = f.route.clip('music', new ArrayBuffer(0));
  f.route.stopSource('music'); finish({}); await pending;
  assert.deepEqual(f.route.diagnostics().sources, []);
});
