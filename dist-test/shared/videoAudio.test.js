"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const videoAudio_1 = require("./videoAudio");
function createSlide() {
    return {
        id: "slide-1",
        assetId: "asset-1",
        sectionId: "section-1",
        transition: "fade",
    };
}
(0, node_test_1.default)("legacy video slides default to enabled video audio at full volume", () => {
    const normalized = (0, videoAudio_1.normalizeSlideVideoAudio)(createSlide(), "video");
    strict_1.default.deepEqual(normalized.videoAudio, {
        enabled: true,
        volume: 1,
    });
});
(0, node_test_1.default)("saved muted video-audio settings are preserved", () => {
    const normalized = (0, videoAudio_1.normalizeSlideVideoAudio)({
        ...createSlide(),
        videoAudio: {
            enabled: false,
            volume: 0.35,
        },
    }, "video");
    strict_1.default.deepEqual(normalized.videoAudio, {
        enabled: false,
        volume: 0.35,
    });
});
(0, node_test_1.default)("video-audio settings clamp invalid saved volume values", () => {
    strict_1.default.deepEqual((0, videoAudio_1.resolveVideoAudioSettings)({ enabled: true, volume: 4 }), {
        enabled: true,
        volume: 1,
    });
    strict_1.default.deepEqual((0, videoAudio_1.resolveVideoAudioSettings)({ enabled: true, volume: -2 }), {
        enabled: true,
        volume: 0,
    });
});
