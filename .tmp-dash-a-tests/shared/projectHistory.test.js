"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const projectHistory_1 = require("./projectHistory");
(0, node_test_1.default)('undo/redo track the saved revision without writing or changing identity', () => {
    const h = new projectHistory_1.ProjectHistory();
    const a = {};
    const b = {};
    const c = {};
    h.reset(a);
    h.record(b);
    h.markSaved(b);
    h.record(c);
    strict_1.default.equal(h.isDirty, true);
    strict_1.default.equal(h.undo(), b);
    strict_1.default.equal(h.isDirty, false);
    strict_1.default.equal(h.undo(), a);
    strict_1.default.equal(h.isDirty, true);
    strict_1.default.equal(h.redo(), b);
    strict_1.default.equal(h.isDirty, false);
    strict_1.default.equal(h.redo(), c);
    strict_1.default.equal(h.isDirty, true);
});
(0, node_test_1.default)('a new edit after undo discards redo, while no-op updates keep it', () => {
    const h = new projectHistory_1.ProjectHistory();
    const a = {};
    const b = {};
    const c = {};
    h.reset(a);
    h.record(b);
    h.undo();
    h.record(a);
    strict_1.default.equal(h.canRedo, true);
    h.record(c);
    strict_1.default.equal(h.canRedo, false);
    strict_1.default.equal(h.undo(), a);
});
(0, node_test_1.default)('one gesture is one undo step; separate gestures remain separate', () => {
    const h = new projectHistory_1.ProjectHistory();
    const a = {};
    const b = {};
    const c = {};
    const d = {};
    h.reset(a);
    const gesture = {};
    h.record(b, gesture);
    h.record(c, gesture);
    h.record(d, {});
    strict_1.default.equal(h.undo(), c);
    strict_1.default.equal(h.undo(), a);
    strict_1.default.equal(h.canUndo, false);
    strict_1.default.equal(h.redo(), c);
});
(0, node_test_1.default)('saving ends grouping so later edits cannot swallow the saved revision', () => {
    const h = new projectHistory_1.ProjectHistory();
    const a = {};
    const b = {};
    const c = {};
    const group = {};
    h.reset(a);
    h.record(b, group);
    h.breakGroup(); // Save starts for B.
    h.record(c, group);
    h.markSaved(b); // B completes while C remains current.
    strict_1.default.equal(h.isDirty, true);
    strict_1.default.equal(h.undo(), b);
    strict_1.default.equal(h.isDirty, false);
});
(0, node_test_1.default)('undo during a pending save cannot acknowledge the wrong current state', () => {
    const h = new projectHistory_1.ProjectHistory();
    const a = {};
    const b = {};
    h.reset(a);
    h.record(b);
    h.undo();
    h.markSaved(b);
    strict_1.default.equal(h.isDirty, true);
    strict_1.default.equal(h.redo(), b);
    strict_1.default.equal(h.isDirty, false);
});
(0, node_test_1.default)('history is bounded and opening another project clears old revisions', () => {
    const h = new projectHistory_1.ProjectHistory(2);
    const a = {};
    const b = {};
    const c = {};
    const d = {};
    h.reset(a);
    h.record(b);
    h.record(c);
    h.record(d);
    strict_1.default.equal(h.undo(), c);
    strict_1.default.equal(h.undo(), b);
    strict_1.default.equal(h.undo(), null);
    h.reset(a);
    strict_1.default.equal(h.canUndo, false);
    strict_1.default.equal(h.canRedo, false);
    strict_1.default.equal(h.isDirty, false);
    h.reset(b, false);
    strict_1.default.equal(h.isDirty, true);
});
(0, node_test_1.default)('automatic normalization does not add undo steps or dirty a clean load', () => {
    const h = new projectHistory_1.ProjectHistory();
    const a = {};
    const normalized = {};
    const edited = {};
    h.reset(a);
    h.rebase(normalized);
    strict_1.default.equal(h.isDirty, false);
    strict_1.default.equal(h.canUndo, false);
    h.record(edited);
    strict_1.default.equal(h.undo(), normalized);
    strict_1.default.equal(h.isDirty, false);
});
(0, node_test_1.default)('history shortcuts leave native text undo and Ctrl+X alone', () => {
    const event = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, repeat: false, key: 'z', target: null };
    strict_1.default.equal((0, projectHistory_1.getHistoryShortcut)(event), 'undo');
    strict_1.default.equal((0, projectHistory_1.getHistoryShortcut)({ ...event, shiftKey: true, key: 'Z' }), 'redo');
    strict_1.default.equal((0, projectHistory_1.getHistoryShortcut)({ ...event, key: 'x' }), null);
    strict_1.default.equal((0, projectHistory_1.getHistoryShortcut)({ ...event, altKey: true }), null);
    strict_1.default.equal((0, projectHistory_1.getHistoryShortcut)({ ...event, repeat: true }), null);
    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { isContentEditable: true }]) {
        strict_1.default.equal((0, projectHistory_1.getHistoryShortcut)({ ...event, target }), null);
    }
});
