import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIgnoreTeacherKey, isPlainTeacherKey, claimTeacherKey } from './keyboardShortcuts';

test('teacher shortcuts ignore consumed, composing, repeated and editable input', () => {
  for (const event of [{ defaultPrevented: true }, { isComposing: true }, { repeat: true },
    ...['INPUT', 'TEXTAREA', 'SELECT'].map(tagName => ({ target: { tagName } })),
    { target: { isContentEditable: true } }]) assert.equal(shouldIgnoreTeacherKey(event), true);
  assert.equal(shouldIgnoreTeacherKey({ target: { tagName: 'BUTTON' } }), false);
  assert.equal(shouldIgnoreTeacherKey({ target: null }), false);
});

test('capture-phase shortcuts leave native preview dialog keys to the dialog', () => {
  for (const tagName of ['BUTTON', 'VIDEO', 'DIALOG']) {
    const target = { tagName, closest: (selector: string) => selector === 'dialog[open]' ? {} : null };
    assert.equal(shouldIgnoreTeacherKey({ target }), true);
    assert.equal(isPlainTeacherKey({ target }), false);
  }
  assert.equal(shouldIgnoreTeacherKey({ target: { tagName: 'BUTTON', closest: () => null } }), false);
});

test('plain teaching keys cannot also execute modified drawing or relic commands', () => {
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    assert.equal(isPlainTeacherKey({ [modifier]: true }), false);
  }
  assert.equal(isPlainTeacherKey({ ctrlKey: true, altKey: true }), false);
  assert.equal(isPlainTeacherKey({}), true);
  assert.equal(isPlainTeacherKey({ repeat: true }), false);
});

test('a claimed shortcut prevents another listener from executing the same command', () => {
  const calls: string[] = [];
  claimTeacherKey({ preventDefault: () => calls.push('prevent'), stopImmediatePropagation: () => calls.push('stop') });
  assert.deepEqual(calls, ['prevent', 'stop']);
});
