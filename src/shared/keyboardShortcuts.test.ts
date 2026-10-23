import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIgnoreTeacherKey, isPlainTeacherKey, claimTeacherKey, lessonShortcut } from './keyboardShortcuts';

test('lesson shortcuts use the number row, guard typing/modifiers and separate Teach navigation',()=>{
  for(const [code,expected] of [['Space','playback'],['KeyA','previous'],['KeyD','next'],['KeyQ','music'],['KeyE','draw'],['KeyR','clear-drawings'],['F1','student'],['Digit1','reward-1'],['Digit2','reward-2'],['Digit3','reward-3'],['Digit4','reward-4']])assert.equal(lessonShortcut({code},'teach'),expected);
  assert.equal(lessonShortcut({code:'Numpad1',key:'1'},'teach'),null);assert.equal(lessonShortcut({code:'KeyD'},'edit'),null);
  for(const event of [{repeat:true},{isComposing:true},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{target:{tagName:'INPUT'}}])assert.equal(lessonShortcut({code:'Space',...event},'teach'),null);
});

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
