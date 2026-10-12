const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
  }).outputText, filename);
};
let observe;
try { observe = require('./src/components/observePlayArea.ts').observePlayArea; } catch {}

function fixture() {
  const frames = new Map();
  let resize, nextId = 0, notifications, disconnected = false, updates = 0;
  const observed = [];
  const platform = {
    ResizeObserver: class {
      constructor(callback) { notifications = callback; }
      observe(node) { observed.push(node); }
      disconnect() { disconnected = true; }
    },
    requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(type, listener) { if (type === 'resize') resize = listener; },
    removeEventListener(type, listener) { if (type === 'resize' && resize === listener) resize = null; },
  };
  return { platform, observed, frames, notify: () => notifications(), resize: () => resize?.(),
    update: () => updates++, updates: () => updates, disconnected: () => disconnected,
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); } };
}

test('defers geometry updates outside ResizeObserver delivery to avoid same-cycle feedback', () => {
  assert.equal(typeof observe, 'function', 'Play area updates need a frame-safe observer');
  const f = fixture();
  const viewport = {}, content = {};
  observe([viewport, content], f.update, f.platform);
  assert.deepEqual(f.observed, [viewport, content]);
  f.notify();
  assert.equal(f.updates(), 0, 'No layout writes during observer delivery');
  f.flush();
  assert.equal(f.updates(), 1);
});

test('coalesces simultaneous viewport/content notifications and native window resize', () => {
  assert.equal(typeof observe, 'function');
  const f = fixture();
  observe([{}, {}], f.update, f.platform);
  f.notify(); f.notify(); f.resize();
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.equal(f.updates(), 1);
  f.resize(); f.flush();
  assert.equal(f.updates(), 2);
});

test('closing the game disconnects resize observation and cancels queued geometry updates', () => {
  assert.equal(typeof observe, 'function');
  const f = fixture();
  const dispose = observe([{}, {}], f.update, f.platform);
  f.notify(); dispose();
  assert.equal(f.disconnected(), true);
  assert.equal(f.frames.size, 0);
  f.resize(); f.flush();
  assert.equal(f.updates(), 0);
});
