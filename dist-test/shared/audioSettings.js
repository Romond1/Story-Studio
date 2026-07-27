"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUDIO_SETTINGS = exports.AUDIO_STAGE_CONTROLS = void 0;
exports.normalizeAudioSettings = normalizeAudioSettings;
exports.muteAllAudioSettings = muteAllAudioSettings;
exports.AUDIO_STAGE_CONTROLS = [
    "microphone-volume",
    "microphone-mute",
    "media-volume",
    "media-mute",
    "master-volume",
    "master-mute",
    "monitor-volume",
    "monitor-mute",
    "mix-volume",
    "mix-mute",
    "microphone-meter",
    "media-meter",
    "master-meter",
    "monitor-meter",
    "mix-meter",
    "stop-all",
    "test-microphone",
    "reconnect-devices",
];
exports.DEFAULT_AUDIO_SETTINGS = {
    version: 1,
    devices: {
        microphone: { deviceId: "default", label: "System Default Microphone" },
        monitor: { deviceId: "default", label: "System Default Output" },
        mix: { deviceId: "default", label: "System Default Output" },
    },
    volumes: { microphone: 1, media: 1, master: 1, monitor: 1, mix: 1 },
    muted: { microphone: false, media: false, master: false, monitor: false, mix: false },
    monitoringEnabled: true,
    microphoneMonitorEnabled: false,
    stageControls: [
        "microphone-volume",
        "microphone-mute",
        "monitor-volume",
        "monitor-mute",
        "microphone-meter",
        "master-meter",
        "stop-all",
    ],
};
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function clampVolume(value, fallback) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : fallback;
}
function normalizeDevice(value, fallback) {
    const device = asRecord(value);
    return {
        deviceId: typeof device.deviceId === "string" && device.deviceId.trim()
            ? device.deviceId
            : fallback.deviceId,
        label: typeof device.label === "string" && device.label.trim()
            ? device.label
            : fallback.label,
    };
}
function normalizeAudioSettings(value) {
    const raw = asRecord(value);
    const devices = asRecord(raw.devices);
    const volumes = asRecord(raw.volumes);
    const muted = asRecord(raw.muted);
    const requestedControls = Array.isArray(raw.stageControls)
        ? raw.stageControls
        : exports.DEFAULT_AUDIO_SETTINGS.stageControls;
    const stageControls = Array.from(new Set(requestedControls))
        .filter((item) => typeof item === "string" && exports.AUDIO_STAGE_CONTROLS.includes(item));
    return {
        version: 1,
        devices: {
            microphone: normalizeDevice(devices.microphone, exports.DEFAULT_AUDIO_SETTINGS.devices.microphone),
            monitor: normalizeDevice(devices.monitor, exports.DEFAULT_AUDIO_SETTINGS.devices.monitor),
            mix: normalizeDevice(devices.mix, exports.DEFAULT_AUDIO_SETTINGS.devices.mix),
        },
        volumes: {
            microphone: clampVolume(volumes.microphone, exports.DEFAULT_AUDIO_SETTINGS.volumes.microphone),
            media: clampVolume(volumes.media, exports.DEFAULT_AUDIO_SETTINGS.volumes.media),
            master: clampVolume(volumes.master, exports.DEFAULT_AUDIO_SETTINGS.volumes.master),
            monitor: clampVolume(volumes.monitor, exports.DEFAULT_AUDIO_SETTINGS.volumes.monitor),
            mix: clampVolume(volumes.mix, exports.DEFAULT_AUDIO_SETTINGS.volumes.mix),
        },
        muted: {
            microphone: Boolean(muted.microphone),
            media: Boolean(muted.media),
            master: Boolean(muted.master),
            monitor: Boolean(muted.monitor),
            mix: Boolean(muted.mix),
        },
        monitoringEnabled: raw.monitoringEnabled !== false,
        microphoneMonitorEnabled: raw.microphoneMonitorEnabled === true,
        stageControls,
    };
}
function muteAllAudioSettings(settings) {
    return normalizeAudioSettings({
        ...settings,
        muted: {
            microphone: true,
            media: true,
            master: true,
            monitor: true,
            mix: true,
        },
    });
}
