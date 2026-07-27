"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioDiagnostics_1 = require("./audioDiagnostics");
function healthy(overrides = {}) {
    return {
        selectedDevicesMissing: [],
        masterFlowing: true,
        mixFlowing: true,
        monitorFlowing: true,
        masterPeak: 0.4,
        activeMicrophoneStreams: 1,
        activeMixStreams: 1,
        activeMonitorStreams: 1,
        activeCallbackCount: 1,
        activeListenerCount: 1,
        mixPhysicalKey: "cable",
        monitorPhysicalKey: "headphones",
        lastStreamError: null,
        underruns: 0,
        sampleRateMismatch: false,
        channelMismatch: false,
        restartRequired: false,
        ...overrides,
    };
}
(0, node_test_1.default)("warns when master has audio but the mix output is silent", () => {
    const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ mixFlowing: false }));
    strict_1.default.ok(warnings.some((warning) => warning.id === "mix-output-silent"));
});
(0, node_test_1.default)("warns about duplicate streams and callbacks", () => {
    const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({
        activeMicrophoneStreams: 2,
        activeMixStreams: 2,
        activeCallbackCount: 2,
    }));
    strict_1.default.ok(warnings.some((warning) => warning.id === "duplicate-microphone-stream"));
    strict_1.default.ok(warnings.some((warning) => warning.id === "duplicate-mix-stream"));
    strict_1.default.ok(warnings.some((warning) => warning.id === "duplicate-callback"));
});
(0, node_test_1.default)("warns when monitor and mix resolve to one physical output", () => {
    const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({
        mixPhysicalKey: "headphones",
        monitorPhysicalKey: "headphones",
    }));
    strict_1.default.ok(warnings.some((warning) => warning.id === "same-physical-output"));
});
(0, node_test_1.default)("warns about clipping, mismatches, missing devices, and restart state", () => {
    const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({
        selectedDevicesMissing: ["Saved Teacher Mic"],
        masterPeak: 0.99,
        sampleRateMismatch: true,
        channelMismatch: true,
        restartRequired: true,
    }));
    strict_1.default.deepEqual(new Set(warnings.map((warning) => warning.id)), new Set(["missing-device", "clipping", "sample-rate-mismatch", "channel-mismatch", "restart-required"]));
});
(0, node_test_1.default)("reconnecting state ends when the final output replacement settles", () => {
    strict_1.default.equal((0, audioDiagnostics_1.deriveAudioEngineState)({ reconnecting: true, hasGraph: true, masterMuted: false, warnings: [] }), "reconnecting");
    strict_1.default.equal((0, audioDiagnostics_1.deriveAudioEngineState)({ reconnecting: false, hasGraph: true, masterMuted: false, warnings: [] }), "active");
});
