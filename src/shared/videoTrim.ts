import type { MediaType, Slide, VideoTrimSettings } from "./types";

export interface EffectiveVideoTrim {
  inSec: number;
  outSec: number;
  isTrimmed: boolean;
}

function isFiniteTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampTime(value: number, durationSec: number): number {
  return Math.max(0, Math.min(durationSec, value));
}

export function normalizeVideoTrimSettings(
  settings: VideoTrimSettings | null | undefined,
): VideoTrimSettings | undefined {
  if (!settings || !isFiniteTime(settings.inSec)) return undefined;

  const inSec = Math.max(0, settings.inSec);
  const outSec = isFiniteTime(settings.outSec) ? settings.outSec : undefined;
  if (outSec !== undefined && outSec <= inSec) return undefined;

  return {
    inSec,
    ...(outSec !== undefined ? { outSec: Math.max(0, outSec) } : {}),
  };
}

export function normalizeSlideVideoTrim(
  slide: Slide,
  mediaType: MediaType | null | undefined,
): Slide {
  const videoTrim = mediaType === "video" ? normalizeVideoTrimSettings(slide.videoTrim) : undefined;
  if (!videoTrim) {
    const { videoTrim: _removed, ...rest } = slide;
    return rest;
  }
  return { ...slide, videoTrim };
}

export function getEffectiveVideoTrim(
  settings: VideoTrimSettings | null | undefined,
  durationSec: number,
): EffectiveVideoTrim {
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

export function clampVideoTimeToTrim(
  currentTimeSec: number,
  settings: VideoTrimSettings | null | undefined,
  durationSec: number,
): number {
  const time = isFiniteTime(currentTimeSec) ? currentTimeSec : 0;
  const normalized = normalizeVideoTrimSettings(settings);
  if (!isFiniteTime(durationSec) || durationSec <= 0) {
    if (!normalized) return time;
    return Math.max(normalized.inSec, time);
  }
  const trim = getEffectiveVideoTrim(settings, durationSec);
  return Math.max(trim.inSec, Math.min(trim.outSec, time));
}

export function shouldStopAtTrimOut(
  currentTimeSec: number,
  settings: VideoTrimSettings | null | undefined,
  durationSec: number,
): boolean {
  const trim = getEffectiveVideoTrim(settings, durationSec);
  return trim.isTrimmed && currentTimeSec >= trim.outSec;
}
