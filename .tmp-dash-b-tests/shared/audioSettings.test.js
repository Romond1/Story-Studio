"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioSettings_1 = require("./audioSettings");
(0, node_test_1.default)("missing audio settings use safe defaults without project migration", () => {
    strict_1.default.deepEqual((0, audioSettings_1.normalizeAudioSettings)(undefined), audioSettings_1.DEFAULT_AUDIO_SETTINGS);
    strict_1.default.equal((0, audioSettings_1.normalizeAudioSettings)(undefined).microphoneMonitorEnabled, false);
});
(0, node_test_1.default)("saved stable device ids and stage controls survive normalization", () => {
    const settings = (0, audioSettings_1.normalizeAudioSettings)({
        version: 1,
        devices: {
            microphone: { deviceId: "mic-1", label: "Teacher Mic" },
            monitor: { deviceId: "headphones-1", label: "Headphones" },
            mix: { deviceId: "cable-1", label: "CABLE Input" },
        },
        volumes: { microphone: 0.8, media: 0.7, master: 0.9, monitor: 0.6, mix: 1 },
        muted: { microphone: false, media: false, master: false, monitor: false, mix: false },
        monitoringEnabled: true,
        microphoneMonitorEnabled: false,
        stageControls: ["microphone-volume", "microphone-mute", "master-meter"],
    });
    strict_1.default.equal(settings.devices.mix.deviceId, "cable-1");
    strict_1.default.deepEqual(settings.stageControls, ["microphone-volume", "microphone-mute", "master-meter"]);
});
(0, node_test_1.default)("malformed values clamp and unknown controls are removed", () => {
    const settings = (0, audioSettings_1.normalizeAudioSettings)({
        version: 99,
        volumes: { microphone: 8, media: -2, master: Number.NaN },
        stageControls: ["microphone-mute", "not-a-control", "microphone-mute"],
    });
    strict_1.default.equal(settings.volumes.microphone, 1);
    strict_1.default.equal(settings.volumes.media, 0);
    strict_1.default.equal(settings.volumes.master, 1);
    strict_1.default.deepEqual(settings.stageControls, ["microphone-mute"]);
});
(0, node_test_1.default)("stop all mutes every bus without discarding devices or configured controls", () => {
    const settings = (0, audioSettings_1.normalizeAudioSettings)({
        ...audioSettings_1.DEFAULT_AUDIO_SETTINGS,
        devices: {
            microphone: { deviceId: "mic-1", label: "Teacher Mic" },
            monitor: { deviceId: "headphones-1", label: "Headphones" },
            mix: { deviceId: "cable-1", label: "CABLE Input" },
        },
        stageControls: ["microphone-mute", "stop-all"],
    });
    const stopped = (0, audioSettings_1.muteAllAudioSettings)(settings);
    strict_1.default.deepEqual(stopped.devices, settings.devices);
    strict_1.default.deepEqual(stopped.stageControls, settings.stageControls);
    strict_1.default.deepEqual(stopped.muted, {
        microphone: true,
        media: true,
        master: true,
        monitor: true,
        mix: true,
    });
});
