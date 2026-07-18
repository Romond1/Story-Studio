import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AUDIO_SETTINGS,
  normalizeAudioSettings,
} from "./audioSettings";

test("missing audio settings use safe defaults without project migration", () => {
  assert.deepEqual(normalizeAudioSettings(undefined), DEFAULT_AUDIO_SETTINGS);
  assert.equal(normalizeAudioSettings(undefined).microphoneMonitorEnabled, false);
});

test("saved stable device ids and stage controls survive normalization", () => {
  const settings = normalizeAudioSettings({
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

  assert.equal(settings.devices.mix.deviceId, "cable-1");
  assert.deepEqual(settings.stageControls, ["microphone-volume", "microphone-mute", "master-meter"]);
});

test("malformed values clamp and unknown controls are removed", () => {
  const settings = normalizeAudioSettings({
    version: 99,
    volumes: { microphone: 8, media: -2, master: Number.NaN },
    stageControls: ["microphone-mute", "not-a-control", "microphone-mute"],
  });

  assert.equal(settings.volumes.microphone, 1);
  assert.equal(settings.volumes.media, 0);
  assert.equal(settings.volumes.master, 1);
  assert.deepEqual(settings.stageControls, ["microphone-mute"]);
});
