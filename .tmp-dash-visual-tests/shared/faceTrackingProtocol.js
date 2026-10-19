"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKING_DEFAULTS = void 0;
exports.parseTrackingSettings = parseTrackingSettings;
exports.parseTrackingStatus = parseTrackingStatus;
exports.TRACKING_DEFAULTS = { enabled: false, markers: true, hat: true };
function parseTrackingSettings(value) {
    if (!value || typeof value !== 'object')
        return null;
    const v = value;
    if (typeof v.enabled !== 'boolean' || typeof v.markers !== 'boolean' || typeof v.hat !== 'boolean')
        return null;
    return { enabled: v.enabled, markers: v.markers, hat: v.hat };
}
function parseTrackingStatus(value) {
    if (!value || typeof value !== 'object')
        return null;
    const v = value;
    if (!['off', 'initializing', 'tracking', 'face-lost', 'error'].includes(v.state)
        || (v.message !== undefined && typeof v.message !== 'string'))
        return null;
    return { state: v.state, message: v.message?.slice(0, 512) };
}
