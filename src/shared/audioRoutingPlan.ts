export const AUDIO_ROUTE_CATEGORIES = [
  "dialogue",
  "sfx",
  "slide-bgm",
  "section-bgm",
  "mic",
  "unclassified",
] as const;

export type AudioRouteCategory = (typeof AUDIO_ROUTE_CATEGORIES)[number];
export type AudioRouteTarget = "cable" | "monitor";

const audioRouteTargets: Record<AudioRouteCategory, AudioRouteTarget[]> = {
  dialogue: ["cable", "monitor"],
  sfx: ["cable", "monitor"],
  "slide-bgm": ["cable", "monitor"],
  "section-bgm": ["cable", "monitor"],
  mic: ["cable"],
  unclassified: ["cable", "monitor"],
};

export function isKnownAudioRouteCategory(value: string): value is AudioRouteCategory {
  return (AUDIO_ROUTE_CATEGORIES as readonly string[]).includes(value);
}

export function getAudioRouteTargets(category: AudioRouteCategory): AudioRouteTarget[] {
  return [...audioRouteTargets[category]];
}
