"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioSettings_1 = require("./audioSettings");
const videoAudio_1 = require("./videoAudio");
(0, node_test_1.default)("app audio settings do not mutate a legacy episode project", () => {
    const legacyEpisode = {
        version: 1,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        slides: [{
                id: "slide-1",
                assetId: "video-1",
                sectionId: "section-1",
                transition: "fade",
                dialogue: [{ url: "media://dialogue.mp3", volume: 0.8 }],
                sfx: [{ url: "media://effect.wav", volume: 1 }],
                bgm: [{ url: "media://slide-music.mp3", volume: 0.5 }],
            }],
        assets: [],
        sections: [{
                id: "section-1",
                name: "Legacy Episode",
                type: "story",
                bgm: [{ url: "media://section-music.mp3", volume: 0.4 }],
            }],
    };
    const before = JSON.stringify(legacyEpisode);
    const appSettings = (0, audioSettings_1.normalizeAudioSettings)(undefined);
    strict_1.default.equal(JSON.stringify(legacyEpisode), before);
    strict_1.default.equal("audio" in legacyEpisode, false);
    strict_1.default.equal(appSettings.microphoneMonitorEnabled, false);
});
(0, node_test_1.default)("legacy video slides retain enabled full-volume audio defaults", () => {
    strict_1.default.deepEqual((0, videoAudio_1.resolveVideoAudioSettings)(undefined), { enabled: true, volume: 1 });
});
