import assert from 'node:assert/strict';
import test from 'node:test';

const bridge = await import('./inputBridge.mjs').catch(() => ({}));
const parentWindow = {};
const otherWindow = {};
const instanceId = 'snake-session-123';
const origin = 'http://localhost:5173';
const input = { channel: 'story-studio-game', type: 'input', instanceId, key: 'd', code: 'KeyD', phase: 'keydown', repeat: false };
const context = { parentWindow, instanceId, origin };
const eventFor = (data = input, overrides = {}) => ({ source: parentWindow, origin, data, ...overrides });

test('accepts input from the owning parent for the current game session', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function', 'The game input validator must exist');
  assert.deepEqual(bridge.readGameInputMessage(eventFor(), context), { key: 'd', code: 'KeyD', phase: 'keydown', repeat: false });
});

test('rejects input from a different window or origin', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function');
  assert.equal(bridge.readGameInputMessage(eventFor(input, { source: otherWindow }), context), null);
  assert.equal(bridge.readGameInputMessage(eventFor(input, { origin: 'https://example.com' }), context), null);
});

test('rejects stale or absent game session identifiers', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function');
  assert.equal(bridge.readGameInputMessage(eventFor({ ...input, instanceId: 'old-session' }), context), null);
  assert.equal(bridge.readGameInputMessage(eventFor(), { ...context, instanceId: '' }), null);
});

test('rejects modifier shortcuts while retaining ordinary game shortcuts', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function');
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    assert.equal(bridge.readGameInputMessage(eventFor({ ...input, [modifier]: true }), context), null);
  }
  for (const key of ['Control', 'Alt', 'Meta', 'Shift']) {
    assert.equal(bridge.readGameInputMessage(eventFor({ ...input, key }), context), null);
  }
  assert.equal(bridge.readGameInputMessage(eventFor({ ...input, key: 'Escape', code: 'Escape' }), context)?.key, 'Escape');
});

test('rejects malformed messages and unsupported keyboard event phases', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function');
  for (const data of [null, [], {}, { ...input, channel: 'other' }, { ...input, type: 'ready' }, { ...input, phase: 'click' }, { ...input, key: 1 }, { ...input, key: '' }, { ...input, code: null }, { ...input, repeat: 'true' }]) {
    assert.equal(bridge.readGameInputMessage(eventFor(data), context), null);
  }
});

test('accepts key release and repeat input for the owning session', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function');
  assert.deepEqual(bridge.readGameInputMessage(eventFor({ ...input, phase: 'keyup', repeat: true }), context), { key: 'd', code: 'KeyD', phase: 'keyup', repeat: true });
});

test('accepts the local file origin used by the packaged application', () => {
  assert.equal(typeof bridge.readGameInputMessage, 'function');
  assert.equal(bridge.readGameInputMessage(eventFor(input, { origin: 'null' }), { ...context, origin: 'null' })?.key, 'd');
});

test('preserves Shift for native game shortcuts and rejects malformed modifiers', () => {
  assert.deepEqual(bridge.readGameInputMessage(eventFor({ ...input, key: 'M', code: 'KeyM', shiftKey: true }), context), { key: 'M', code: 'KeyM', phase: 'keydown', repeat: false, shiftKey: true });
  assert.equal(bridge.readGameInputMessage(eventFor({ ...input, shiftKey: 'true' }), context), null);
});
