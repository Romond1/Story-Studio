"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const keyboardShortcuts_1 = require("./keyboardShortcuts");
(0, node_test_1.default)('teacher shortcuts ignore consumed, composing, repeated and editable input', () => {
    for (const event of [{ defaultPrevented: true }, { isComposing: true }, { repeat: true },
        ...['INPUT', 'TEXTAREA', 'SELECT'].map(tagName => ({ target: { tagName } })),
        { target: { isContentEditable: true } }])
        strict_1.default.equal((0, keyboardShortcuts_1.shouldIgnoreTeacherKey)(event), true);
    strict_1.default.equal((0, keyboardShortcuts_1.shouldIgnoreTeacherKey)({ target: { tagName: 'BUTTON' } }), false);
    strict_1.default.equal((0, keyboardShortcuts_1.shouldIgnoreTeacherKey)({ target: null }), false);
});
(0, node_test_1.default)('plain teaching keys cannot also execute modified drawing or relic commands', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
        strict_1.default.equal((0, keyboardShortcuts_1.isPlainTeacherKey)({ [modifier]: true }), false);
    }
    strict_1.default.equal((0, keyboardShortcuts_1.isPlainTeacherKey)({ ctrlKey: true, altKey: true }), false);
    strict_1.default.equal((0, keyboardShortcuts_1.isPlainTeacherKey)({}), true);
    strict_1.default.equal((0, keyboardShortcuts_1.isPlainTeacherKey)({ repeat: true }), false);
});
(0, node_test_1.default)('a claimed shortcut prevents another listener from executing the same command', () => {
    const calls = [];
    (0, keyboardShortcuts_1.claimTeacherKey)({ preventDefault: () => calls.push('prevent'), stopImmediatePropagation: () => calls.push('stop') });
    strict_1.default.deepEqual(calls, ['prevent', 'stop']);
});
