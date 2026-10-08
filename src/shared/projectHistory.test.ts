import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectHistory, getHistoryShortcut } from './projectHistory';

test('undo/redo track the saved revision without writing or changing identity', () => {
  const h = new ProjectHistory<object>(); const a = {}; const b = {}; const c = {};
  h.reset(a); h.record(b); h.markSaved(b); h.record(c);
  assert.equal(h.isDirty, true);
  assert.equal(h.undo(), b); assert.equal(h.isDirty, false);
  assert.equal(h.undo(), a); assert.equal(h.isDirty, true);
  assert.equal(h.redo(), b); assert.equal(h.isDirty, false);
  assert.equal(h.redo(), c); assert.equal(h.isDirty, true);
});

test('a new edit after undo discards redo, while no-op updates keep it', () => {
  const h = new ProjectHistory<object>(); const a = {}; const b = {}; const c = {};
  h.reset(a); h.record(b); h.undo(); h.record(a);
  assert.equal(h.canRedo, true);
  h.record(c); assert.equal(h.canRedo, false);
  assert.equal(h.undo(), a);
});

test('one gesture is one undo step; separate gestures remain separate', () => {
  const h = new ProjectHistory<object>(); const a = {}; const b = {}; const c = {}; const d = {};
  h.reset(a); const gesture = {}; h.record(b, gesture); h.record(c, gesture);
  h.record(d, {});
  assert.equal(h.undo(), c); assert.equal(h.undo(), a); assert.equal(h.canUndo, false);
  assert.equal(h.redo(), c);
});

test('saving ends grouping so later edits cannot swallow the saved revision', () => {
  const h = new ProjectHistory<object>(); const a = {}; const b = {}; const c = {}; const group = {};
  h.reset(a); h.record(b, group); h.breakGroup(); // Save starts for B.
  h.record(c, group); h.markSaved(b); // B completes while C remains current.
  assert.equal(h.isDirty, true); assert.equal(h.undo(), b); assert.equal(h.isDirty, false);
});

test('undo during a pending save cannot acknowledge the wrong current state', () => {
  const h = new ProjectHistory<object>(); const a = {}; const b = {};
  h.reset(a); h.record(b); h.undo(); h.markSaved(b);
  assert.equal(h.isDirty, true); assert.equal(h.redo(), b); assert.equal(h.isDirty, false);
});

test('history is bounded and opening another project clears old revisions', () => {
  const h = new ProjectHistory<object>(2); const a = {}; const b = {}; const c = {}; const d = {};
  h.reset(a); h.record(b); h.record(c); h.record(d);
  assert.equal(h.undo(), c); assert.equal(h.undo(), b); assert.equal(h.undo(), null);
  h.reset(a); assert.equal(h.canUndo, false); assert.equal(h.canRedo, false); assert.equal(h.isDirty, false);
  h.reset(b, false); assert.equal(h.isDirty, true);
});

test('automatic normalization does not add undo steps or dirty a clean load', () => {
  const h = new ProjectHistory<object>(); const a = {}; const normalized = {}; const edited = {};
  h.reset(a); h.rebase(normalized);
  assert.equal(h.isDirty, false); assert.equal(h.canUndo, false);
  h.record(edited); assert.equal(h.undo(), normalized); assert.equal(h.isDirty, false);
});

test('history shortcuts leave native text undo and Ctrl+X alone', () => {
  const event = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, repeat: false, key: 'z', target: null };
  assert.equal(getHistoryShortcut(event), 'undo');
  assert.equal(getHistoryShortcut({ ...event, shiftKey: true, key: 'Z' }), 'redo');
  assert.equal(getHistoryShortcut({ ...event, key: 'x' }), null);
  assert.equal(getHistoryShortcut({ ...event, altKey: true }), null);
  assert.equal(getHistoryShortcut({ ...event, repeat: true }), null);
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { isContentEditable: true }]) {
    assert.equal(getHistoryShortcut({ ...event, target }), null);
  }
});
