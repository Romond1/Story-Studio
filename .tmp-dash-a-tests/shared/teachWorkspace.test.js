"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const teachingScene_1 = require("./teachingScene");
const staticScene_1 = require("./staticScene");
const teachWorkspace_1 = require("./teachWorkspace");
(0, node_test_1.default)('viewport accepts inner dimensions and rejects malformed reports', () => {
    strict_1.default.deepEqual((0, teachWorkspace_1.parsePresentViewport)({ width: 1280, height: 720 }), { width: 1280, height: 720 });
    for (const value of [null, {}, { width: 0, height: 2 }, { width: Infinity, height: 2 }, { width: 100, height: -1 }])
        strict_1.default.equal((0, teachWorkspace_1.parsePresentViewport)(value), null);
});
(0, node_test_1.default)('Present controls shape, Control and divider only scale', () => {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 500, height: 1000 }, { width: 2100, height: 600 }]) {
        for (const available of [{ width: 640, height: 500 }, { width: 400, height: 650 }, { width: 900, height: 400 }]) {
            const fit = (0, teachWorkspace_1.fitPreviewViewport)(viewport, available);
            strict_1.default.ok(Math.abs(fit.width / fit.height - viewport.width / viewport.height) < 1e-10);
            strict_1.default.ok(fit.width <= available.width + 1e-9 && fit.height <= available.height + 1e-9);
            for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
                const point = (0, teachWorkspace_1.previewPoint)({ x: fit.x + x * fit.width, y: fit.y + y * fit.height }, fit);
                strict_1.default.ok(point && Math.abs(point.x - x) < 1e-10 && Math.abs(point.y - y) < 1e-10);
            }
            strict_1.default.equal((0, teachWorkspace_1.previewPoint)({ x: fit.x - 1, y: fit.y }, fit), null);
            strict_1.default.equal((0, teachWorkspace_1.previewPoint)({ x: fit.x, y: fit.y + fit.height + 1 }, fit), null);
        }
    }
});
(0, node_test_1.default)('split preferences stay finite and within operational limits', () => {
    strict_1.default.equal((0, teachWorkspace_1.clampTeachSplit)(NaN), 42);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachSplit)(0), 30);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachSplit)(100), 65);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachSplit)(45), 45);
});
(0, node_test_1.default)('existing drawing and board coordinates survive Present resize, zoom and pan', () => {
    const frame = { width: 1280, height: 720 };
    const stroke = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: .5, y: .5 }];
    const before = JSON.stringify(stroke);
    for (const viewport of [{ width: 1280, height: 720 }, { width: 480, height: 900 }, { width: 1900, height: 500 }]) {
        const preview = (0, teachWorkspace_1.fitPreviewViewport)(viewport, { width: 600, height: 500 });
        const scene = (0, staticScene_1.fitLogicalFrame)(frame, { width: preview.width, height: preview.height });
        const rect = { left: preview.x + scene.x, top: preview.y + scene.y, width: frame.width * scene.scale, height: frame.height * scene.scale };
        for (const zoom of [1, 2, 4])
            for (const pan of [{ x: 0, y: 0 }, { x: -120, y: 35 }])
                for (const point of stroke) {
                    const screen = { x: rect.left + (point.x * frame.width * zoom + pan.x) * scene.scale, y: rect.top + (point.y * frame.height * zoom + pan.y) * scene.scale };
                    const logical = (0, teachingScene_1.clientToLogical)(screen, rect, frame);
                    strict_1.default.ok(Math.abs((logical.x - pan.x) / zoom / frame.width - point.x) < 1e-10);
                    strict_1.default.ok(Math.abs((logical.y - pan.y) / zoom / frame.height - point.y) < 1e-10);
                }
    }
    strict_1.default.equal(JSON.stringify(stroke), before);
});
(0, node_test_1.default)('navigator height preference preserves usable upper workspace and adds readable rows as space grows', () => {
    strict_1.default.equal((0, teachWorkspace_1.clampTeachNavigatorHeight)(NaN, 768), 176);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachNavigatorHeight)(80, 768), 176);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachNavigatorHeight)(400, 768), 400);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachNavigatorHeight)(900, 768), 400);
    strict_1.default.equal((0, teachWorkspace_1.clampTeachNavigatorHeight)(400, 500), 270);
    strict_1.default.equal((0, teachWorkspace_1.teachNavigatorRows)(110), 1);
    strict_1.default.equal((0, teachWorkspace_1.teachNavigatorRows)(220), 2);
    strict_1.default.equal((0, teachWorkspace_1.teachNavigatorRows)(330), 3);
    strict_1.default.equal((0, teachWorkspace_1.teachNavigatorRows)(1000), 3);
});
(0, node_test_1.default)('navigator wheel supports vertical mouse, horizontal trackpad and line/page deltas', () => {
    strict_1.default.equal((0, teachWorkspace_1.navigatorWheelDelta)(0, 120, 0, 600), 120);
    strict_1.default.equal((0, teachWorkspace_1.navigatorWheelDelta)(-80, 10, 0, 600), -80);
    strict_1.default.equal((0, teachWorkspace_1.navigatorWheelDelta)(0, -3, 1, 600), -48);
    strict_1.default.equal((0, teachWorkspace_1.navigatorWheelDelta)(0, 1, 2, 600), 600);
    strict_1.default.equal((0, teachWorkspace_1.navigatorWheelDelta)(0, 0, 0, 600), 0);
});
