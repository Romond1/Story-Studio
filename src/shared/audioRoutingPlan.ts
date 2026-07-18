export const AUDIO_ROUTE_CATEGORIES = [
  "dialogue",
  "sfx",
  "slide-bgm",
  "section-bgm",
  "mic",
  "unclassified",
] as const;

export type AudioRouteCategory = (typeof AUDIO_ROUTE_CATEGORIES)[number];
export type AudioRouteTarget = "broadcast" | "monitor";

export function isKnownAudioRouteCategory(value: string): value is AudioRouteCategory {
  return (AUDIO_ROUTE_CATEGORIES as readonly string[]).includes(value);
}

export function getAudioRouteTargets(
  category: AudioRouteCategory,
  microphoneMonitorEnabled = false,
): AudioRouteTarget[] {
  if (category === "mic") {
    return microphoneMonitorEnabled ? ["broadcast", "monitor"] : ["broadcast"];
  }
  return ["broadcast", "monitor"];
}
