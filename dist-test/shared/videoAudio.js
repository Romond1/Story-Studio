"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VIDEO_AUDIO_SETTINGS = void 0;
exports.resolveVideoAudioSettings = resolveVideoAudioSettings;
exports.normalizeSlideVideoAudio = normalizeSlideVideoAudio;
exports.DEFAULT_VIDEO_AUDIO_SETTINGS = {
    enabled: true,
    volume: 1,
};
function clampVolume(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return exports.DEFAULT_VIDEO_AUDIO_SETTINGS.volume;
    return Math.max(0, Math.min(1, value));
}
function resolveVideoAudioSettings(settings) {
    return {
        enabled: typeof settings?.enabled === "boolean" ? settings.enabled : exports.DEFAULT_VIDEO_AUDIO_SETTINGS.enabled,
        volume: clampVolume(settings?.volume),
    };
}
function normalizeSlideVideoAudio(slide, mediaType) {
    if (mediaType !== "video") {
        return slide.videoAudio ? { ...slide, videoAudio: resolveVideoAudioSettings(slide.videoAudio) } : slide;
    }
    return {
        ...slide,
        videoAudio: resolveVideoAudioSettings(slide.videoAudio),
    };
}
