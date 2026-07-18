import test from "node:test";
import assert from "node:assert/strict";
import { deriveAudioWarnings, type AudioHealthState } from "./audioDiagnostics";

function healthy(overrides: Partial<AudioHealthState> = {}): AudioHealthState {
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

test("warns when master has audio but the mix output is silent", () => {
  const warnings = deriveAudioWarnings(healthy({ mixFlowing: false }));
  assert.ok(warnings.some((warning) => warning.id === "mix-output-silent"));
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
