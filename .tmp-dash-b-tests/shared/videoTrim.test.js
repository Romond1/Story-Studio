"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const videoTrim_1 = require("./videoTrim");
function createSlide() {
    return {
        id: "slide-1",
        assetId: "asset-1",
        sectionId: "section-1",
        transition: "fade",
    };
}
(0, node_test_1.default)("legacy video slides without trim data keep full-video playback", () => {
    const normalized = (0, videoTrim_1.normalizeSlideVideoTrim)(createSlide(), "video");
    strict_1.default.equal(normalized.videoTrim, undefined);
    strict_1.default.deepEqual((0, videoTrim_1.getEffectiveVideoTrim)(normalized.videoTrim, 8), {
        inSec: 0,
        outSec: 8,
        isTrimmed: false,
    });
});
(0, node_test_1.default)("saved video trim values are preserved and clamped to duration", () => {
    const normalized = (0, videoTrim_1.normalizeSlideVideoTrim)({
        ...createSlide(),
        videoTrim: {
            inSec: 1.25,
            outSec: 4.75,
        },
    }, "video");
    strict_1.default.deepEqual(normalized.videoTrim, {
        inSec: 1.25,
        outSec: 4.75,
    });
    strict_1.default.deepEqual((0, videoTrim_1.getEffectiveVideoTrim)(normalized.videoTrim, 4), {
        inSec: 1.25,
        outSec: 4,
        isTrimmed: true,
    });
});
(0, node_test_1.default)("invalid saved trim values are removed instead of breaking legacy project load", () => {
    const normalized = (0, videoTrim_1.normalizeSlideVideoTrim)({
        ...createSlide(),
        videoTrim: {
            inSec: Number.NaN,
            outSec: -3,
        },
    }, "video");
    strict_1.default.equal(normalized.videoTrim, undefined);
});
(0, node_test_1.default)("non-video slides do not gain trim metadata during normalization", () => {
    const normalized = (0, videoTrim_1.normalizeSlideVideoTrim)({
        ...createSlide(),
        videoTrim: {
            inSec: 1,
            outSec: 2,
        },
    }, "image");
    strict_1.default.equal(normalized.videoTrim, undefined);
});
(0, node_test_1.default)("playback helpers clamp to in point and stop at out point", () => {
    const trim = { inSec: 2, outSec: 6 };
    strict_1.default.equal((0, videoTrim_1.clampVideoTimeToTrim)(1, trim, 10), 2);
    strict_1.default.equal((0, videoTrim_1.clampVideoTimeToTrim)(4, trim, 10), 4);
    strict_1.default.equal((0, videoTrim_1.clampVideoTimeToTrim)(7, trim, 10), 6);
    strict_1.default.equal((0, videoTrim_1.shouldStopAtTrimOut)(5.95, trim, 10), false);
    strict_1.default.equal((0, videoTrim_1.shouldStopAtTrimOut)(6, trim, 10), true);
});
(0, node_test_1.default)("playback clamps to in point even before video duration metadata is available", () => {
    const trim = { inSec: 2, outSec: 6 };
    strict_1.default.equal((0, videoTrim_1.clampVideoTimeToTrim)(0, trim, Number.NaN), 2);
});
