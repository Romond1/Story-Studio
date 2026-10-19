"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeVideoTrimSettings = normalizeVideoTrimSettings;
exports.normalizeSlideVideoTrim = normalizeSlideVideoTrim;
exports.getEffectiveVideoTrim = getEffectiveVideoTrim;
exports.clampVideoTimeToTrim = clampVideoTimeToTrim;
exports.shouldStopAtTrimOut = shouldStopAtTrimOut;
function isFiniteTime(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function clampTime(value, durationSec) {
    return Math.max(0, Math.min(durationSec, value));
}
function normalizeVideoTrimSettings(settings) {
    if (!settings || !isFiniteTime(settings.inSec))
        return undefined;
    const inSec = Math.max(0, settings.inSec);
    const outSec = isFiniteTime(settings.outSec) ? settings.outSec : undefined;
    if (outSec !== undefined && outSec <= inSec)
        return undefined;
    return {
        inSec,
        ...(outSec !== undefined ? { outSec: Math.max(0, outSec) } : {}),
    };
}
function normalizeSlideVideoTrim(slide, mediaType) {
    const videoTrim = mediaType === "video" ? normalizeVideoTrimSettings(slide.videoTrim) : undefined;
    if (!videoTrim) {
        const { videoTrim: _removed, ...rest } = slide;
        return rest;
    }
    return { ...slide, videoTrim };
}
function getEffectiveVideoTrim(settings, durationSec) {
    const safeDuration = isFiniteTime(durationSec) && durationSec > 0 ? durationSec : 0;
    const normalized = normalizeVideoTrimSettings(settings);
    if (!normalized || safeDuration <= 0) {
        return { inSec: 0, outSec: safeDuration, isTrimmed: false };
    }
    const inSec = clampTime(normalized.inSec, safeDuration);
    const rawOut = isFiniteTime(normalized.outSec) ? normalized.outSec : safeDuration;
    const outSec = Math.max(inSec, clampTime(rawOut, safeDuration));
    return {
        inSec,
        outSec,
        isTrimmed: inSec > 0 || outSec < safeDuration,
    };
}
function clampVideoTimeToTrim(currentTimeSec, settings, durationSec) {
    const time = isFiniteTime(currentTimeSec) ? currentTimeSec : 0;
    const normalized = normalizeVideoTrimSettings(settings);
    if (!isFiniteTime(durationSec) || durationSec <= 0) {
        if (!normalized)
            return time;
        return Math.max(normalized.inSec, time);
    }
    const trim = getEffectiveVideoTrim(settings, durationSec);
    return Math.max(trim.inSec, Math.min(trim.outSec, time));
}
function shouldStopAtTrimOut(currentTimeSec, settings, durationSec) {
    const trim = getEffectiveVideoTrim(settings, durationSec);
    return trim.isTrimmed && currentTimeSec >= trim.outSec;
}
