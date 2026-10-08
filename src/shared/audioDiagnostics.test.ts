import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAudioEngineState,
  deriveAudioWarnings,
  expectedAudioOutputFlow,
  type AudioHealthState,
} from "./audioDiagnostics";
import { DEFAULT_AUDIO_SETTINGS } from './audioSettings';

function healthy(overrides: Partial<AudioHealthState> = {}): AudioHealthState {
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

test("silent mix meter alone is not an output failure", () => {
  const warnings = deriveAudioWarnings(healthy({ mixFlowing: false }));
  assert.deepEqual(warnings, []);
});

test('microphone-only broadcast does not require headphone monitoring', () => {
  const expected = expectedAudioOutputFlow(DEFAULT_AUDIO_SETTINGS, { microphoneFlowing: true, mediaFlowing: false, masterFlowing: true });
  assert.equal(expected.monitorExpected, false);
  assert.equal(expected.mixExpected, true);
  assert.equal(deriveAudioWarnings(healthy({ ...expected, monitorFlowing: false })).length, 0);
});

test('intentional mute, zero volume and disabled monitoring are not route failures', () => {
  for (const settings of [
    { ...DEFAULT_AUDIO_SETTINGS, monitoringEnabled: false },
    { ...DEFAULT_AUDIO_SETTINGS, muted: { ...DEFAULT_AUDIO_SETTINGS.muted, monitor: true } },
    { ...DEFAULT_AUDIO_SETTINGS, volumes: { ...DEFAULT_AUDIO_SETTINGS.volumes, monitor: 0 } },
  ]) {
    assert.equal(expectedAudioOutputFlow(settings, { microphoneFlowing: true, mediaFlowing: true, masterFlowing: true }).monitorExpected, false);
  }
  for (const settings of [
    { ...DEFAULT_AUDIO_SETTINGS, muted: { ...DEFAULT_AUDIO_SETTINGS.muted, mix: true } },
    { ...DEFAULT_AUDIO_SETTINGS, volumes: { ...DEFAULT_AUDIO_SETTINGS.volumes, mix: 0 } },
  ]) {
    const expected = expectedAudioOutputFlow(settings, { microphoneFlowing: false, mediaFlowing: true, masterFlowing: true });
    assert.equal(deriveAudioWarnings(healthy({ ...expected, mixFlowing: false })).length, 0);
  }
});

test('silent monitor meter alone is not a route warning', () => {
  for (const [settings, mediaFlowing] of [[DEFAULT_AUDIO_SETTINGS, true], [{ ...DEFAULT_AUDIO_SETTINGS, microphoneMonitorEnabled: true }, false]] as const) {
    const expected = expectedAudioOutputFlow(settings, { microphoneFlowing: true, mediaFlowing, masterFlowing: true });
    assert.deepEqual(deriveAudioWarnings(healthy({ ...expected, monitorFlowing: false })), []);
  }
});

test('pauses and independently fluctuating meters keep a connected engine active', () => {
  for (const masterFlowing of [true, false, true, false]) {
    for (const mixFlowing of [false, true]) {
      for (const monitorFlowing of [false, true]) {
        const warnings = deriveAudioWarnings(healthy({ masterFlowing, mixFlowing, monitorFlowing, masterPeak: masterFlowing ? 0.4 : 0 }));
        assert.deepEqual(warnings, []);
        assert.equal(deriveAudioEngineState({ reconnecting: false, hasGraph: true, masterMuted: false, warnings }), 'active');
      }
    }
  }
});

test('actual stream failures remain errors even with silent meters', () => {
  const warnings = deriveAudioWarnings(healthy({ masterFlowing: false, mixFlowing: false, monitorFlowing: false, lastStreamError: 'Output device disconnected' }));
  assert.deepEqual(warnings, [{ id: 'stream-error', severity: 'error', label: 'Audio stream failed', detail: 'Output device disconnected' }]);
  assert.equal(deriveAudioEngineState({ reconnecting: false, hasGraph: true, masterMuted: false, warnings }), 'error');
});

test("warns about duplicate streams and callbacks", () => {
  const warnings = deriveAudioWarnings(healthy({
    activeMicrophoneStreams: 2,
    activeMixStreams: 2,
    activeCallbackCount: 2,
  }));
  assert.ok(warnings.some((warning) => warning.id === "duplicate-microphone-stream"));
  assert.ok(warnings.some((warning) => warning.id === "duplicate-mix-stream"));
  assert.ok(warnings.some((warning) => warning.id === "duplicate-callback"));
});

test("warns when monitor and mix resolve to one physical output", () => {
  const warnings = deriveAudioWarnings(healthy({
    mixPhysicalKey: "headphones",
    monitorPhysicalKey: "headphones",
  }));
  assert.ok(warnings.some((warning) => warning.id === "same-physical-output"));
});

test("warns about clipping, mismatches, missing devices, and restart state", () => {
  const warnings = deriveAudioWarnings(healthy({
    selectedDevicesMissing: ["Saved Teacher Mic"],
    masterPeak: 0.99,
    sampleRateMismatch: true,
    channelMismatch: true,
    restartRequired: true,
  }));
  assert.deepEqual(
    new Set(warnings.map((warning) => warning.id)),
    new Set(["missing-device", "clipping", "sample-rate-mismatch", "channel-mismatch", "restart-required"]),
  );
});

test("reconnecting state ends when the final output replacement settles", () => {
  assert.equal(deriveAudioEngineState({ reconnecting: true, hasGraph: true, masterMuted: false, warnings: [] }), "reconnecting");
  assert.equal(deriveAudioEngineState({ reconnecting: false, hasGraph: true, masterMuted: false, warnings: [] }), "active");
});
