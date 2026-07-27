"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioDeviceMenu_1 = require("./audioDeviceMenu");
(0, node_test_1.default)("device menu exposes every detected device and the system default", () => {
    const options = (0, audioDeviceMenu_1.buildAudioDeviceMenuOptions)([
        { deviceId: "headphones", label: "Teacher Headphones" },
        { deviceId: "cable", label: "CABLE Input" },
    ], { deviceId: "default", label: "System Default Output" });
    strict_1.default.deepEqual(options.map((option) => option.deviceId), ["default", "headphones", "cable"]);
    strict_1.default.deepEqual((0, audioDeviceMenu_1.selectAudioDeviceMenuOption)(options, "cable"), {
        deviceId: "cable",
        label: "CABLE Input",
    });
});
(0, node_test_1.default)("a missing saved device remains selectable for clear recovery status", () => {
    const options = (0, audioDeviceMenu_1.buildAudioDeviceMenuOptions)([], {
        deviceId: "old-device",
        label: "Old Headphones",
    });
    strict_1.default.deepEqual(options, [
        { deviceId: "default", label: "System Default" },
        { deviceId: "old-device", label: "Old Headphones — Missing", missing: true },
    ]);
});
(0, node_test_1.default)("a requested device is shown while its route is connecting", () => {
    strict_1.default.equal((0, audioDeviceMenu_1.getAudioDeviceSelectionLabel)({ deviceId: "default", label: "System Default" }, { deviceId: "cable", label: "CABLE Input" }), "Connecting: CABLE Input");
    strict_1.default.equal((0, audioDeviceMenu_1.getAudioDeviceSelectionLabel)({ deviceId: "default", label: "System Default" }, null), "System Default");
});
