"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAudioDeviceMenuOptions = buildAudioDeviceMenuOptions;
exports.selectAudioDeviceMenuOption = selectAudioDeviceMenuOption;
exports.getAudioDeviceSelectionLabel = getAudioDeviceSelectionLabel;
function buildAudioDeviceMenuOptions(devices, selected) {
    const options = [
        { deviceId: "default", label: "System Default" },
        ...devices.filter((device) => device.deviceId !== "default"),
    ];
    if (selected.deviceId !== "default" && !options.some((option) => option.deviceId === selected.deviceId)) {
        options.splice(1, 0, {
            deviceId: selected.deviceId,
            label: `${selected.label} — Missing`,
            missing: true,
        });
    }
    return options;
}
function selectAudioDeviceMenuOption(options, deviceId) {
    const selected = options.find((option) => option.deviceId === deviceId);
    return selected ? { deviceId: selected.deviceId, label: selected.label.replace(/ — Missing$/, "") } : null;
}
function getAudioDeviceSelectionLabel(selected, pending) {
    return pending ? `Connecting: ${pending.label}` : selected.label;
}
