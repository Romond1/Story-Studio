import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAudioDeviceMenuOptions,
  getAudioDeviceSelectionLabel,
  selectAudioDeviceMenuOption,
} from "./audioDeviceMenu";

test("device menu exposes every detected device and the system default", () => {
  const options = buildAudioDeviceMenuOptions([
    { deviceId: "headphones", label: "Teacher Headphones" },
    { deviceId: "cable", label: "CABLE Input" },
  ], { deviceId: "default", label: "System Default Output" });

  assert.deepEqual(options.map((option) => option.deviceId), ["default", "headphones", "cable"]);
  assert.deepEqual(selectAudioDeviceMenuOption(options, "cable"), {
    deviceId: "cable",
    label: "CABLE Input",
  });
});

test("a missing saved device remains selectable for clear recovery status", () => {
  const options = buildAudioDeviceMenuOptions([], {
    deviceId: "old-device",
    label: "Old Headphones",
  });

  assert.deepEqual(options, [
    { deviceId: "default", label: "System Default" },
    { deviceId: "old-device", label: "Old Headphones — Missing", missing: true },
  ]);
});

test("a requested device is shown while its route is connecting", () => {
  assert.equal(
    getAudioDeviceSelectionLabel(
      { deviceId: "default", label: "System Default" },
      { deviceId: "cable", label: "CABLE Input" },
    ),
    "Connecting: CABLE Input",
  );
  assert.equal(
    getAudioDeviceSelectionLabel({ deviceId: "default", label: "System Default" }, null),
    "System Default",
  );
});
