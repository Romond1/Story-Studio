"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const lessonPointer_1 = require("./lessonPointer");
(0, node_test_1.test)('zoom keeps the scene point under the pointer fixed and clamps limits', () => {
    const view = { zoom: 1.5, pan: { x: 80, y: -30 } }, point = { x: 430, y: 250 };
    const next = (0, lessonPointer_1.zoomAtPoint)(view, point, 2.3);
    strict_1.default.ok(Math.abs(point.x * view.zoom + view.pan.x - point.x * next.zoom - next.pan.x) < 1e-8);
    strict_1.default.ok(Math.abs(point.y * view.zoom + view.pan.y - point.y * next.zoom - next.pan.y) < 1e-8);
    strict_1.default.equal((0, lessonPointer_1.zoomAtPoint)(view, point, 20).zoom, 4);
    strict_1.default.equal((0, lessonPointer_1.zoomAtPoint)(view, point, .2).zoom, 1);
});
(0, node_test_1.test)('eraser intersects entire line segments, not just sampled vertices', () => {
    const stroke = { id: 'a', color: '#000000', opacity: 1, rainbow: false, size: 6, points: [{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 1 }] };
    strict_1.default.equal((0, lessonPointer_1.strokeTouches)(stroke, { x: 50, y: 2 }, 5), true);
    strict_1.default.equal((0, lessonPointer_1.strokeTouches)(stroke, { x: 50, y: 20 }, 5), false);
});
