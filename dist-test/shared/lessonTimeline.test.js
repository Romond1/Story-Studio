"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const lessonTimeline_1 = require("./lessonTimeline");
(0, node_test_1.default)('global zoom clamps and pointer position remains at the same content fraction', () => {
    strict_1.default.equal((0, lessonTimeline_1.timelineZoom)(8), 2.6);
    strict_1.default.equal((0, lessonTimeline_1.timelineZoom)(0), .45);
    const next = (0, lessonTimeline_1.zoomScroll)(500, 120, 1000, 1500);
    strict_1.default.equal((next + 120) / 1500, (500 + 120) / 1000);
    strict_1.default.deepEqual([.5, 1, 1.5, 2.5].map(lessonTimeline_1.timelineDensity), ['overview', 'normal', 'detail', 'frame']);
});
