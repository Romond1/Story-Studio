import type { ImageAdjustmentSettings, MediaType, Slide } from "./types";

export const DEFAULT_IMAGE_ADJUSTMENTS: Required<ImageAdjustmentSettings> = {
  flipX: false,
  brightness: 1,
  contrast: 1,
  saturate: 1,
};

function clampUnitRange(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(2, value));
}

function isDefault(settings: Required<ImageAdjustmentSettings>): boolean {
  return (
    settings.flipX === DEFAULT_IMAGE_ADJUSTMENTS.flipX &&
    settings.brightness === DEFAULT_IMAGE_ADJUSTMENTS.brightness &&
    settings.contrast === DEFAULT_IMAGE_ADJUSTMENTS.contrast &&
    settings.saturate === DEFAULT_IMAGE_ADJUSTMENTS.saturate
  );
}

export function resolveImageAdjustments(
  settings: ImageAdjustmentSettings | null | undefined,
): Required<ImageAdjustmentSettings> {
  return {
    flipX: typeof settings?.flipX === "boolean" ? settings.flipX : DEFAULT_IMAGE_ADJUSTMENTS.flipX,
    brightness: clampUnitRange(settings?.brightness, DEFAULT_IMAGE_ADJUSTMENTS.brightness),
    contrast: clampUnitRange(settings?.contrast, DEFAULT_IMAGE_ADJUSTMENTS.contrast),
    saturate: clampUnitRange(settings?.saturate, DEFAULT_IMAGE_ADJUSTMENTS.saturate),
  };
}

export function normalizeImageAdjustments(
  settings: ImageAdjustmentSettings | null | undefined,
): ImageAdjustmentSettings | undefined {
  if (!settings || typeof settings !== "object") return undefined;
  const resolved = resolveImageAdjustments(settings);
  if (isDefault(resolved)) return undefined;

  return {
    ...(resolved.flipX ? { flipX: true } : {}),
    ...(resolved.brightness !== DEFAULT_IMAGE_ADJUSTMENTS.brightness ? { brightness: resolved.brightness } : {}),
    ...(resolved.contrast !== DEFAULT_IMAGE_ADJUSTMENTS.contrast ? { contrast: resolved.contrast } : {}),
    ...(resolved.saturate !== DEFAULT_IMAGE_ADJUSTMENTS.saturate ? { saturate: resolved.saturate } : {}),
  };
}

export function normalizeSlideImageAdjustments(
  slide: Slide,
  mediaType: MediaType | null | undefined,
): Slide {
  const imageAdjustments = mediaType === "image"
    ? normalizeImageAdjustments(slide.imageAdjustments)
    : undefined;
  if (!imageAdjustments) {
    const { imageAdjustments: _removed, ...rest } = slide;
    return rest;
  }
  return { ...slide, imageAdjustments };
}
