const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => {
  const source = fs.readFileSync(file, 'utf8').replace(/if \(import\.meta\.hot\) \{[\s\S]*?\n\}/g, '');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, file);
};
const { AudioController } = require('../src/renderer/audio/AudioController.ts');
function fixture() {
  const controller = new AudioController();
  const calls = [];
  const voices = [];
  const gains = [];
  const makeParam = () => ({ values: [], setValueAtTime(value, time) { this.values.push({ value, time }); }, exponentialRampToValueAtTime(value, time) { this.values.push({ value, time }); } });
  const target = {};
  const context = { state: 'suspended', currentTime: 0, resume() { calls.push('resume'); this.state = 'running'; return Promise.resolve(); },
    createOscillator() { const voice = { frequency: makeParam(), connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.startTime = time; calls.push('start'); }, stop(time) { this.stopTime = time; } }; voices.push(voice); return voice; },
    createGain() { const gain = makeParam(); gains.push(gain); return { gain, connect(node) { assert.equal(node, target); }, disconnect() {} }; } };
  controller.ensureGraph = () => ({ mediaBus: target });
  controller.getContext = () => context;
  return { controller, context, calls, voices, gains };
}
test('game cues resume a suspended context before scheduling through the media bus', () => {
  for (const play of [c => c.playWheelCue('landing'), c => c.playGameEffectCue('stars')]) {
    const { controller, calls } = fixture();
    play(controller);
    assert.equal(calls[0], 'resume');
    assert.ok(calls.includes('start'));
  }
});
test('explicit game sound activation resumes inside the gesture without changing mixer settings', async () => {
  const { controller, calls } = fixture();
  const settings = controller.getSnapshot().settings;
  const pending = controller.activateGameSounds();
  assert.deepEqual(calls, ['resume']);
  await pending;
  assert.equal(controller.getSnapshot().settings, settings);
});
test('running game audio does not resume again for each oscillator', () => {
  const { controller, context, calls } = fixture();
  context.state = 'running';
  controller.playGameEffectCue('stars');
  assert.equal(calls.filter(call => call === 'resume').length, 0);
  assert.ok(calls.filter(call => call === 'start').length > 4);
});
test('activation exposes a blocked context so controls can show a retry message', async () => {
  const { controller, context } = fixture();
  context.resume = () => Promise.reject(new Error('blocked'));
  await assert.rejects(controller.activateGameSounds(), /blocked/);
});


test('rewards have layered melodic tails between 1.5 and 3 seconds', () => {
  for (const kind of ['coins', 'stars', 'portal', 'chest', 'sprite', 'crown']) {
    const { controller, voices } = fixture();
    controller.playGameEffectCue(kind);
    const end = Math.max(...voices.map(voice => voice.stopTime));
    assert.ok(end >= 1.5 && end <= 3, `${kind}: ${end}s`);
    assert.ok(voices.length >= 8 && voices.length <= 32);
    assert.ok(new Set(voices.map(voice => voice.type)).size >= 2);
  }
});

test('rapid repeated cues replace their own voices and cancellation releases all reward nodes', () => {
  const { controller, voices } = fixture();
  for (let i = 0; i < 100; i++) controller.playWheelCue('tick');
  assert.ok(controller.testNodes.size <= 3);
  for (let i = 0; i < 20; i++) controller.playGameEffectCue('crown');
  assert.ok(controller.testNodes.size <= 35);
  const stop = controller.playGameEffectCue('stars');
  stop();
  assert.ok(controller.testNodes.size <= 3);
  assert.ok(voices.some(voice => voice.disconnected));
});

test('wheel flourish and landing have deliberate duration', () => {
  for (const cue of ['start', 'landing', 'reveal']) {
    const { controller, voices } = fixture();
    controller.playWheelCue(cue);
    assert.ok(Math.max(...voices.map(voice => voice.stopTime)) >= .65);
  }
});


test('wheel ticks have an audible transient and a short swept body', () => {
  const { controller, voices, gains } = fixture();
  controller.playWheelCue('tick', 1);
  assert.ok(Math.max(...gains.flatMap(gain => gain.values.map(event => event.value))) >= .25);
  assert.ok(Math.max(...voices.map(voice => voice.stopTime)) < .1);
  assert.ok(voices.some(voice => voice.frequency.values.length > 1));
});
