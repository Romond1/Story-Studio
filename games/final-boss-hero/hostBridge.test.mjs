import assert from 'node:assert/strict';
import test from 'node:test';

const bridge = await import('./hostBridge.mjs').catch(() => ({}));

function fixture(origin = 'http://localhost:5173') {
  const sent = [];
  const events = [];
  const listeners = new Map();
  const media = {
    paused: 0, loaded: 0, sourceRemoved: 0, srcObject: {},
    pause() { this.paused++; },
    removeAttribute(name) { if (name === 'src') this.sourceRemoved++; },
    load() { this.loaded++; },
    querySelectorAll() { return []; },
  };
  let unmounts = 0;
  let animationStops = 0;
  const parent = { postMessage(value, destination) { sent.push({ value, destination }); } };
  const targetWindow = {
    parent, location: { origin },
    document: { querySelectorAll() { return [media]; }, getAnimations() { return []; } },
    KeyboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    dispatchEvent(event) { events.push(event); },
  };
  const instanceId = 'boss-session-1';
  const options = { targetWindow, instanceId, unmount() { unmounts++; }, stopAnimations() { animationStops++; } };
  const packet = { channel: 'story-studio-game', type: 'input', instanceId, key: 'Enter', code: 'Enter', phase: 'keydown', repeat: false };
  return { sent, events, listeners, media, options, packet, parent, targetWindow,
    counts: () => ({ unmounts, animationStops }) };
}

test('reports readiness to the owning host with this instance', () => {
  assert.equal(typeof bridge.installHostBridge, 'function', 'Final Boss must install the shared host protocol');
  const f = fixture();
  const host = bridge.installHostBridge(f.options);
  host.ready();
  assert.deepEqual(f.sent, [{ value: { channel: 'story-studio-game', type: 'ready', instanceId: 'boss-session-1' }, destination: 'http://localhost:5173' }]);
});

test('uses the opaque packaged origin and preserves parent identity', () => {
  assert.equal(typeof bridge.installHostBridge, 'function');
  const f = fixture('null');
  const host = bridge.installHostBridge(f.options);
  host.ready();
  assert.equal(f.sent[0].destination, '*');
  f.listeners.get('message')({ source: f.parent, origin: 'null', data: f.packet });
  assert.equal(f.events[0].key, 'Enter');
  f.listeners.get('message')({ source: {}, origin: 'null', data: f.packet });
  assert.equal(f.events.length, 1);
});

test('forwards only current parent input and retains original Shift shortcuts', () => {
  assert.equal(typeof bridge.installHostBridge, 'function');
  const f = fixture();
  bridge.installHostBridge(f.options);
  const receive = f.listeners.get('message');
  receive({ source: f.parent, origin: 'http://localhost:5173', data: { ...f.packet, key: 'M', code: 'KeyM', shiftKey: true } });
  assert.equal(f.events[0].key, 'M');
  assert.equal(f.events[0].shiftKey, true);
  for (const event of [
    { source: {}, origin: 'http://localhost:5173', data: f.packet },
    { source: f.parent, origin: 'https://other.example', data: f.packet },
    { source: f.parent, origin: 'http://localhost:5173', data: { ...f.packet, instanceId: 'expired' } },
    { source: f.parent, origin: 'http://localhost:5173', data: { ...f.packet, ctrlKey: true } },
  ]) receive(event);
  assert.equal(f.events.length, 1);
});

test('reports a startup failure and stops media and animations', () => {
  assert.equal(typeof bridge.installHostBridge, 'function');
  const f = fixture();
  const host = bridge.installHostBridge(f.options);
  host.error(new Error('The battle failed'));
  assert.equal(f.sent[0].value.type, 'error');
  assert.equal(f.sent[0].value.detail, 'The battle failed');
  assert.equal(f.media.paused, 1);
  assert.equal(f.counts().animationStops, 1);
});

test('pagehide disposes the runtime, media sources and listeners exactly once', () => {
  assert.equal(typeof bridge.installHostBridge, 'function');
  const f = fixture();
  const host = bridge.installHostBridge(f.options);
  f.listeners.get('pagehide')();
  host.dispose();
  assert.deepEqual(f.counts(), { unmounts: 1, animationStops: 1 });
  assert.equal(f.listeners.size, 0);
  assert.equal(f.media.paused, 1);
  assert.equal(f.media.sourceRemoved, 1);
  assert.equal(f.media.srcObject, null);
  assert.equal(f.media.loaded, 1);
  host.ready();
  assert.equal(f.sent.length, 0);
});

test('blocks host-free startup reports without blocking native configured modifiers', () => {
  assert.equal(typeof bridge.installHostBridge, 'function');
  const f = fixture();
  f.targetWindow.parent = f.targetWindow;
  const host = bridge.installHostBridge(f.options);
  host.ready();
  assert.equal(f.sent.length, 0);
  let stopped = 0;
  let prevented = 0;
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    f.listeners.get('keydown')({ key: 'm', [modifier]: true,
      stopImmediatePropagation() { stopped++; }, preventDefault() { prevented++; } });
  }
  assert.equal(stopped, 0, 'Native modifier shortcuts must reach original game handlers');
  assert.equal(prevented, 0, 'Browser modifier defaults remain available');
});

test('suppresses native arrow scrolling while preserving typing field defaults', () => {
  const f = fixture();
  bridge.installHostBridge(f.options);
  let prevented = 0;
  f.listeners.get('keydown')({ key: 'ArrowDown', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  f.listeners.get('keydown')({ key: 'ArrowDown', target: { closest() { return {}; } }, preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
});
