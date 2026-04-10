import type { MediaType, Slide, VideoAudioSettings } from "./types";

export const DEFAULT_VIDEO_AUDIO_SETTINGS: VideoAudioSettings = {
  enabled: true,
  volume: 1,
};

function clampVolume(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_VIDEO_AUDIO_SETTINGS.volume;
  return Math.max(0, Math.min(1, value));
}

export function resolveVideoAudioSettings(
  settings: VideoAudioSettings | null | undefined,
): VideoAudioSettings {
  return {
    enabled: typeof settings?.enabled === "boolean" ? settings.enabled : DEFAULT_VIDEO_AUDIO_SETTINGS.enabled,
    volume: clampVolume(settings?.volume),
  };
}

export function normalizeSlideVideoAudio(
  slide: Slide,
  mediaType: MediaType | null | undefined,
): Slide {
  if (mediaType !== "video") {
    return slide.videoAudio ? { ...slide, videoAudio: resolveVideoAudioSettings(slide.videoAudio) } : slide;
  }

  return {
    ...slide,
    videoAudio: resolveVideoAudioSettings(slide.videoAudio),
  };
}
