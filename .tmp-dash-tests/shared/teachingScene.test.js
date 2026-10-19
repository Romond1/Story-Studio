"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const teachingScene_1 = require("./teachingScene");
(0, node_test_1.default)('viewport commands reject previous occurrences and out-of-order updates', () => {
    const state = (0, teachingScene_1.createTeachingScene)('occurrence B');
    strict_1.default.equal((0, teachingScene_1.reduceTeachingScene)(state, { targetKey: 'occurrence A', sequence: 1, viewport: { zoom: 2, pan: { x: 100, y: 50 } } }), state);
    const moved = (0, teachingScene_1.reduceTeachingScene)(state, { targetKey: 'occurrence B', sequence: 2, viewport: { zoom: 2, pan: { x: -100, y: -50 } } });
    strict_1.default.equal(moved.viewport.zoom, 2);
    strict_1.default.equal((0, teachingScene_1.reduceTeachingScene)(moved, { targetKey: 'occurrence B', sequence: 1, viewport: state.viewport }), moved);
    strict_1.default.equal((0, teachingScene_1.createTeachingScene)('new').transient.length, 0);
});
(0, node_test_1.default)('client coordinates map through uniformly contained logical frame at different DPI and sizes', () => {
    strict_1.default.deepEqual((0, teachingScene_1.clientToLogical)({ x: 300, y: 250 }, { left: 50, top: 100, width: 500, height: 300 }, { width: 1000, height: 600 }), { x: 500, y: 300 });
    strict_1.default.deepEqual((0, teachingScene_1.clientToLogical)({ x: 600, y: 500 }, { left: 100, top: 200, width: 1000, height: 600 }, { width: 1000, height: 600 }), { x: 500, y: 300 });
});
(0, node_test_1.default)('reliable finish clears active stroke, delayed transient cannot resurrect it', () => {
    const first = (0, teachingScene_1.createTeachingScene)('a');
    const active = { id: 'stroke', size: 5, opacity: 1, color: '#ffffff', rainbow: false, points: [{ x: 0.2, y: 0.3, t: 100 }] };
    const drawing = (0, teachingScene_1.reduceTeachingScene)(first, { targetKey: 'a', sequence: 1, transient: [active] });
    const completed = (0, teachingScene_1.reduceTeachingScene)(drawing, { targetKey: 'a', sequence: 3, transient: [] });
    strict_1.default.equal((0, teachingScene_1.reduceTeachingScene)(completed, { targetKey: 'a', sequence: 2, transient: [active] }), completed);
    strict_1.default.deepEqual(completed.transient, []);
});
const teachingScene_2 = require("./teachingScene");
(0, node_test_1.default)('Control and Core share bounded transients preserving first and last points', () => {
    const points = Array.from({ length: 4001 }, (_, i) => ({ x: i / 4000, y: 0.4, t: i }));
    const input = Array.from({ length: 33 }, (_, i) => ({ id: String(i), size: 5, opacity: 1, color: '#fff', rainbow: false, points }));
    const bounded = (0, teachingScene_2.normalizeTransientStrokes)(input);
    strict_1.default.equal(bounded.length, 32);
    strict_1.default.equal(bounded[0].id, '1');
    strict_1.default.equal(bounded[0].points.length, 4000);
    strict_1.default.deepEqual(bounded[0].points[0], points[0]);
    strict_1.default.deepEqual(bounded[0].points[3999], points[4000]);
    strict_1.default.deepEqual((0, teachingScene_1.reduceTeachingScene)((0, teachingScene_1.createTeachingScene)('a'), { targetKey: 'a', sequence: 1, transient: input }).transient, bounded);
});
