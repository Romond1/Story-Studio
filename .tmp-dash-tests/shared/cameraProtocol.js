"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMERA_DEFAULTS = void 0;
exports.parseCameraSettings = parseCameraSettings;
exports.parseCameraStatus = parseCameraStatus;
const faceTrackingProtocol_1 = require("./faceTrackingProtocol");
exports.CAMERA_DEFAULTS = {
    enabled: false, deviceId: '', preset: 'lower-right', chromaKey: false,
    tolerance: 0.28, softness: 0.12, brightness: 0, contrast: 1, mirror: true,
    tracking: faceTrackingProtocol_1.TRACKING_DEFAULTS,
};
function parseCameraSettings(value) {
    if (!value || typeof value !== 'object')
        return null;
    const v = value;
    const tracking = (0, faceTrackingProtocol_1.parseTrackingSettings)(v.tracking ?? faceTrackingProtocol_1.TRACKING_DEFAULTS);
    if (!tracking)
        return null;
    if (typeof v.enabled !== 'boolean' || typeof v.chromaKey !== 'boolean' || typeof v.mirror !== 'boolean'
        || typeof v.deviceId !== 'string' || v.deviceId.length > 1024
        || !['full', 'lower-left', 'lower-right', 'hidden'].includes(v.preset))
        return null;
    for (const [key, min, max] of [['tolerance', 0, 1], ['softness', 0.001, 0.5], ['brightness', -1, 1], ['contrast', 0, 2]]) {
        if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < min || v[key] > max)
            return null;
    }
    return { enabled: v.enabled, deviceId: v.deviceId, preset: v.preset, chromaKey: v.chromaKey,
        tolerance: v.tolerance, softness: v.softness, brightness: v.brightness, contrast: v.contrast, mirror: v.mirror, tracking };
}
function parseCameraStatus(value) {
    if (!value || typeof value !== 'object')
        return null;
    const v = value;
    if (!['off', 'starting', 'live', 'error'].includes(v.state) || !Array.isArray(v.devices) || v.devices.length > 64
        || (v.message !== undefined && typeof v.message !== 'string'))
        return null;
    if (!v.devices.every(d => d && typeof d.deviceId === 'string' && d.deviceId.length <= 1024 && typeof d.label === 'string'))
        return null;
    return { state: v.state, message: v.message?.slice(0, 512), devices: v.devices.map(d => ({ deviceId: d.deviceId, label: d.label.slice(0, 256) })) };
}
