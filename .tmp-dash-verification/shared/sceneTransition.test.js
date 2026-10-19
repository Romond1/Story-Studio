"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const sceneTransition_1 = require("./sceneTransition");
const target = (id) => ({ kind: 'image', occurrenceId: id, src: `media://${id}.png`, scene: { frame: { width: 800, height: 600 }, overlays: [], viewport: { zoom: 2, pan: { x: -100, y: -50 } }, markerStrokes: [] } });
const settings = { kind: 'crossfade', durationMs: 1000, direction: 'left' };
(0, node_test_1.default)('one Core event per occurrence change; frozen outgoing media excludes annotations', () => {
    const core = new sceneTransition_1.SceneTransitionCore();
    strict_1.default.equal(core.observe('a', target('a'), settings, 100, 'first'), null);
    const event = core.observe('b', target('b'), settings, 200, 'ab');
    strict_1.default.equal(event.id, 'ab');
    strict_1.default.equal(event.startedAt, 200);
    strict_1.default.equal(event.from.scene?.markerStrokes, undefined);
    strict_1.default.equal(core.observe('b', target('b'), settings, 500, 'ignored'), event);
    strict_1.default.equal(event.from.scene?.viewport?.pan.x, -100);
});
(0, node_test_1.default)('rapid navigation rejects earlier completion and late rendering settles', () => {
    const core = new sceneTransition_1.SceneTransitionCore();
    core.observe('a', target('a'), settings, 0, 'a');
    core.observe('b', target('b'), settings, 100, 'ab');
    const latest = core.observe('c', target('c'), settings, 200, 'bc');
    strict_1.default.equal(core.complete('ab'), false);
    strict_1.default.equal(core.event, latest);
    strict_1.default.deepEqual((0, sceneTransition_1.transitionTiming)(latest, 700), { elapsedMs: 500, remainingMs: 500, settled: false });
    strict_1.default.equal((0, sceneTransition_1.transitionTiming)(latest, 1201).settled, true);
    strict_1.default.equal(core.complete('bc'), true);
});
(0, node_test_1.default)('none and unsupported media cut; fade-black includes incoming delay', () => {
    const core = new sceneTransition_1.SceneTransitionCore();
    core.observe('a', target('a'), settings, 0, 'a');
    strict_1.default.equal(core.observe('b', target('b'), { ...settings, kind: 'none' }, 100, 'ab'), null);
    const event = core.observe('c', target('c'), { ...settings, kind: 'fade-black' }, 200, 'bc');
    strict_1.default.equal((0, sceneTransition_1.transitionTiming)(event, 1300).remainingMs, 100);
    strict_1.default.equal(core.observe('video', { kind: 'unsupported', occurrenceId: 'video' }, settings, 400, 'video'), null);
    strict_1.default.equal(core.observe('a2', target('a'), settings, 500, 'va'), null);
});
(0, node_test_1.default)('new command epoch for same projected occurrence does not replay or restart timing', () => {
    const core = new sceneTransition_1.SceneTransitionCore();
    core.observe('a:1', target('a'), settings, 0, 'first');
    strict_1.default.equal(core.observe('a:2', target('a'), settings, 100, 'unrelated'), null);
    const event = core.observe('b:3', target('b'), settings, 200, 'ab');
    strict_1.default.equal(core.observe('b:4', target('b'), settings, 800, 'overlay'), event);
    strict_1.default.equal(core.event?.startedAt, 200);
});
const presentationSnapshot_1 = require("./presentationSnapshot");
(0, node_test_1.default)('transition wire projection strips private data and rejects wrong destinations or executable media', () => {
    const core = new sceneTransition_1.SceneTransitionCore();
    core.observe('a', target('a'), settings, 0, 'a');
    const event = core.observe('b', target('b'), settings, 100, 'ab');
    const snapshot = { sessionId: 'lesson', revision: 1, target: target('b'), transition: { ...event, teacherNotes: 'private', from: { ...event.from, activity: { teacher: 'private' } } } };
    const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)(snapshot);
    strict_1.default.equal(parsed.transition.teacherNotes, undefined);
    strict_1.default.equal(parsed.transition.from.activity, undefined);
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot, transition: { ...event, toOccurrenceId: 'old' } }), null);
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot, transition: { ...event, from: { ...event.from, src: 'https://external.invalid/video.mp4' } } }), null);
});
