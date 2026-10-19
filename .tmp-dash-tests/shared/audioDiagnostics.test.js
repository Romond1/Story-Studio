"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioDiagnostics_1 = require("./audioDiagnostics");
const audioSettings_1 = require("./audioSettings");
function healthy(overrides = {}) {
    return {
        selectedDevicesMissing: [],
        masterFlowing: true,
        mixFlowing: true,
        monitorFlowing: true,
        monitorExpected: true,
        mixExpected: true,
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
(0, node_test_1.default)("silent mix meter alone is not an output failure", () => {
    const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ mixFlowing: false }));
    strict_1.default.deepEqual(warnings, []);
});
(0, node_test_1.default)('microphone-only broadcast does not require headphone monitoring', () => {
    const expected = (0, audioDiagnostics_1.expectedAudioOutputFlow)(audioSettings_1.DEFAULT_AUDIO_SETTINGS, { microphoneFlowing: true, mediaFlowing: false, masterFlowing: true });
    strict_1.default.equal(expected.monitorExpected, false);
    strict_1.default.equal(expected.mixExpected, true);
    strict_1.default.equal((0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ ...expected, monitorFlowing: false })).length, 0);
});
(0, node_test_1.default)('intentional mute, zero volume and disabled monitoring are not route failures', () => {
    for (const settings of [
        { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS, monitoringEnabled: false },
        { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS, muted: { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS.muted, monitor: true } },
        { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS, volumes: { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS.volumes, monitor: 0 } },
    ]) {
        strict_1.default.equal((0, audioDiagnostics_1.expectedAudioOutputFlow)(settings, { microphoneFlowing: true, mediaFlowing: true, masterFlowing: true }).monitorExpected, false);
    }
    for (const settings of [
        { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS, muted: { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS.muted, mix: true } },
        { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS, volumes: { ...audioSettings_1.DEFAULT_AUDIO_SETTINGS.volumes, mix: 0 } },
    ]) {
        const expected = (0, audioDiagnostics_1.expectedAudioOutputFlow)(settings, { microphoneFlowing: false, mediaFlowing: true, masterFlowing: true });
        strict_1.default.equal((0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ ...expected, mixFlowing: false })).length, 0);
    }
});
(0, node_test_1.default)('silent monitor meter alone is not a route warning', () => {
    for (const [settings, mediaFlowing] of [[audioSettings_1.DEFAULT_AUDIO_SETTINGS, true], [{ ...audioSettings_1.DEFAULT_AUDIO_SETTINGS, microphoneMonitorEnabled: true }, false]]) {
        const expected = (0, audioDiagnostics_1.expectedAudioOutputFlow)(settings, { microphoneFlowing: true, mediaFlowing, masterFlowing: true });
        strict_1.default.deepEqual((0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ ...expected, monitorFlowing: false })), []);
    }
});
(0, node_test_1.default)('pauses and independently fluctuating meters keep a connected engine active', () => {
    for (const masterFlowing of [true, false, true, false]) {
        for (const mixFlowing of [false, true]) {
            for (const monitorFlowing of [false, true]) {
                const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ masterFlowing, mixFlowing, monitorFlowing, masterPeak: masterFlowing ? 0.4 : 0 }));
                strict_1.default.deepEqual(warnings, []);
                strict_1.default.equal((0, audioDiagnostics_1.deriveAudioEngineState)({ reconnecting: false, hasGraph: true, masterMuted: false, warnings }), 'active');
            }
        }
    }
});
(0, node_test_1.default)('actual stream failures remain errors even with silent meters', () => {
    const warnings = (0, audioDiagnostics_1.deriveAudioWarnings)(healthy({ masterFlowing: false, mixFlowing: false, monitorFlowing: false, lastStreamError: 'Output device disconnected' }));
    strict_1.default.deepEqual(warnings, [{ id: 'stream-error', severity: 'error', label: 'Audio stream failed', detail: 'Output device disconnected' }]);
    strict_1.default.equal((0, audioDiagnostics_1.deriveAudioEngineState)({ reconnecting: false, hasGraph: true, masterMuted: false, warnings }), 'error');
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
