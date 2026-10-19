"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_IMAGE_ADJUSTMENTS = void 0;
exports.resolveImageAdjustments = resolveImageAdjustments;
exports.normalizeImageAdjustments = normalizeImageAdjustments;
exports.normalizeSlideImageAdjustments = normalizeSlideImageAdjustments;
exports.DEFAULT_IMAGE_ADJUSTMENTS = {
    flipX: false,
    brightness: 1,
    contrast: 1,
    saturate: 1,
};
function clampUnitRange(value, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.max(0, Math.min(2, value));
}
function isDefault(settings) {
    return (settings.flipX === exports.DEFAULT_IMAGE_ADJUSTMENTS.flipX &&
        settings.brightness === exports.DEFAULT_IMAGE_ADJUSTMENTS.brightness &&
        settings.contrast === exports.DEFAULT_IMAGE_ADJUSTMENTS.contrast &&
        settings.saturate === exports.DEFAULT_IMAGE_ADJUSTMENTS.saturate);
}
function resolveImageAdjustments(settings) {
    return {
        flipX: typeof settings?.flipX === "boolean" ? settings.flipX : exports.DEFAULT_IMAGE_ADJUSTMENTS.flipX,
        brightness: clampUnitRange(settings?.brightness, exports.DEFAULT_IMAGE_ADJUSTMENTS.brightness),
        contrast: clampUnitRange(settings?.contrast, exports.DEFAULT_IMAGE_ADJUSTMENTS.contrast),
        saturate: clampUnitRange(settings?.saturate, exports.DEFAULT_IMAGE_ADJUSTMENTS.saturate),
    };
}
function normalizeImageAdjustments(settings) {
    if (!settings || typeof settings !== "object")
        return undefined;
    const resolved = resolveImageAdjustments(settings);
    if (isDefault(resolved))
        return undefined;
    return {
        ...(resolved.flipX ? { flipX: true } : {}),
        ...(resolved.brightness !== exports.DEFAULT_IMAGE_ADJUSTMENTS.brightness ? { brightness: resolved.brightness } : {}),
        ...(resolved.contrast !== exports.DEFAULT_IMAGE_ADJUSTMENTS.contrast ? { contrast: resolved.contrast } : {}),
        ...(resolved.saturate !== exports.DEFAULT_IMAGE_ADJUSTMENTS.saturate ? { saturate: resolved.saturate } : {}),
    };
}
function normalizeSlideImageAdjustments(slide, mediaType) {
    const imageAdjustments = mediaType === "image"
        ? normalizeImageAdjustments(slide.imageAdjustments)
        : undefined;
    if (!imageAdjustments) {
        const { imageAdjustments: _removed, ...rest } = slide;
        return rest;
    }
    return { ...slide, imageAdjustments };
}
