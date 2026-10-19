"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const movementPresentation_1 = require("./movementPresentation");
const movement_1 = require("./movement");
const presentationSnapshot_1 = require("./presentationSnapshot");
(0, node_test_1.default)('movement freezes config and absolute lifetime; reload catches up and expires', () => {
    const config = { ...movement_1.DEFAULT_MOVEMENT_EVENTS[0] };
    const event = (0, movementPresentation_1.createMovementPresentation)('one', config, 1000, { width: 1000, height: 700 });
    config.name = 'changed';
    strict_1.default.equal(event.event.name, 'Touch Color');
    strict_1.default.equal(event.expiresAt, 4000);
    strict_1.default.equal((0, movementPresentation_1.movementRemaining)(event, 2500), 1500);
    strict_1.default.equal((0, movementPresentation_1.movementRemaining)(event, 5000), 0);
});
(0, node_test_1.default)('execution claim is recorded before side effects and resets only for a new session', () => {
    const guard = new movementPresentation_1.MovementExecutionGuard();
    let calls = 0;
    const run = (id) => { if (guard.claim('session', id)) {
        calls++;
        run(id);
    } };
    run('one');
    run('one');
    run('two');
    strict_1.default.equal(calls, 2);
    strict_1.default.equal(guard.claim('next-session', 'one'), true);
});
(0, node_test_1.default)('movement parser whitelists visuals and bundled keys; rejects unsafe values', () => {
    const event = (0, movementPresentation_1.createMovementPresentation)('one', movement_1.DEFAULT_MOVEMENT_EVENTS[0], 1000, { width: 1000, height: 700 });
    strict_1.default.deepEqual((0, movementPresentation_1.parseMovementPresentation)({ ...event, teacher: 'secret' }), event);
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)({ ...event, expiresAt: Infinity }), null);
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)({ ...event, event: { ...event.event, gifRelativePath: 'https://tracker.test/a.gif' } }), null);
    const snapshot = (0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 's', revision: 1, target: { kind: 'empty', occurrenceId: 'e' }, movement: event });
    strict_1.default.deepEqual(snapshot?.movement, event);
});
(0, node_test_1.default)('old expiry cannot clear retrigger; early timers cannot clear the current event', () => {
    const a = (0, movementPresentation_1.createMovementPresentation)('a', movement_1.DEFAULT_MOVEMENT_EVENTS[0], 1000, { width: 1000, height: 700 });
    const b = (0, movementPresentation_1.createMovementPresentation)('b', movement_1.DEFAULT_MOVEMENT_EVENTS[0], 1500, a.frame);
    strict_1.default.equal((0, movementPresentation_1.expireMovementPresentation)(b, a.id, 4500), b);
    strict_1.default.equal((0, movementPresentation_1.expireMovementPresentation)(b, b.id, 4499), b);
    strict_1.default.equal((0, movementPresentation_1.expireMovementPresentation)(b, b.id, 4500), null);
});
(0, node_test_1.default)('safe legacy Windows paths and filename punctuation remain valid movement media', () => {
    const event = (0, movementPresentation_1.createMovementPresentation)('legacy', { ...movement_1.DEFAULT_MOVEMENT_EVENTS[0], gifRelativePath: 'assets\\my #1?.gif' }, 1, { width: 800, height: 600 });
    strict_1.default.equal(event.event.gifRelativePath, 'assets/my #1?.gif');
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)({ ...event, event: { ...event.event, gifRelativePath: '../private.gif' } }), null);
});
(0, node_test_1.default)('movement render URLs are scoped runtime fields, never authored paths', () => {
    const event = (0, movementPresentation_1.createMovementPresentation)('render', movement_1.DEFAULT_MOVEMENT_EVENTS[0], 1, { width: 800, height: 600 });
    const rendered = { ...event, gifSrc: 'media://scoped/lease/grant' };
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)(rendered)?.gifSrc, rendered.gifSrc);
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)({ ...event, gifSrc: 'https://tracker.test/a.gif' }), null);
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)({ ...event, gifSrc: 'media://assets/raw.gif' }), null);
    strict_1.default.equal((0, movementPresentation_1.parseMovementPresentation)({ ...event, gifSrc: '' })?.gifSrc, '');
    strict_1.default.equal(event.event.gifRelativePath, movement_1.DEFAULT_MOVEMENT_EVENTS[0].gifRelativePath);
});
