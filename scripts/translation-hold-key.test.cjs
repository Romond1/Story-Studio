const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function setup() {
  const file = 'src/renderer/translation/holdToTalk.ts';
  const exports = {};
  if (fs.existsSync(file)) vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const win = new EventTarget(), doc = new EventTarget(); doc.hidden = false; doc.querySelector = () => null;
  const calls = []; let ready = true;
  assert.equal(typeof exports.bindTranslationHoldKey, 'function', 'hold key binding is available');
  const dispose = exports.bindTranslationHoldKey(win, doc, { start: () => { calls.push('start'); return ready; }, stop: () => calls.push('stop'), cancel: () => calls.push('cancel') });
  const key = (type, props = {}) => { const e = new Event(type, { cancelable: true }); Object.assign(e, { key: 'w', repeat: false, ...props }); win.dispatchEvent(e); return e; };
  return { win, doc, calls, key, dispose, unavailable: () => { ready = false; } };
}
test('holding W starts once and release submits even with changed focus or modifiers', () => {
  const s = setup(); assert.equal(s.key('keydown').defaultPrevented, true); s.key('keydown', { repeat: true }); s.key('keyup', { ctrlKey: true }); assert.deepEqual(s.calls, ['start', 'stop']);
});
test('typing, modifiers, repeat, and open dialogs do not capture W', () => {
  const s = setup(); for (const props of [{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{repeat:true},{isComposing:true}]) s.key('keydown', props);
  // EventTarget substitutes the target element, retaining the real closest guard.
  s.win.closest = selector => { assert.match(selector, /input/); assert.match(selector, /contenteditable/); return {}; };
  s.key('keydown'); delete s.win.closest;
  s.doc.querySelector = () => ({}); s.key('keydown'); assert.deepEqual(s.calls, []);
});
test('blur, hidden document, and unmount cancel owned capture without submission', () => {
  const s = setup(); s.key('keydown'); s.win.dispatchEvent(new Event('blur')); s.key('keyup');
  s.key('keydown'); s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange')); s.key('keyup');
  s.doc.hidden = false; s.key('keydown'); s.dispose(); s.key('keyup'); s.key('keydown'); assert.deepEqual(s.calls, ['start','cancel','start','cancel','start','cancel']);
});
test('unavailable start never schedules capture after release or cancels another capture', () => {
  const s = setup(); s.unavailable(); s.key('keydown'); s.key('keyup'); s.win.dispatchEvent(new Event('blur')); s.dispose(); assert.deepEqual(s.calls, ['start']);
});

