import {LEGACY_BE_A_HERO_V1} from "./adventures/legacy-be-a-hero-v1";
import type { MovementConfig, MovementEventConfig } from "./types";

// Movement events are saved as project config, but play as temporary stage overlays.
export const BUILT_IN_MOVEMENT_GIFS: Array<{label:string;relativePath:string}> = LEGACY_BE_A_HERO_V1.movementGifs.map(value=>({...value}));
export const DEFAULT_MOVEMENT_EVENTS: MovementEventConfig[] = LEGACY_BE_A_HERO_V1.movementEvents.map(value=>({...value}));

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  randomEnabled: true,
  randomShortcut: "Numpad0",
  jingleEnabled: true,
  jingleVolume: 0.35,
  jingleRelativePath: null,
  events: DEFAULT_MOVEMENT_EVENTS,
};

export function normalizeMovementConfig(config?: Partial<MovementConfig> | null): MovementConfig {
  const incomingEvents = Array.isArray(config?.events) ? config.events : [];
  const incomingById = new Map<string, Partial<MovementEventConfig>>(
    incomingEvents.map((event) => [event.id || "", event]),
  );
  const deletedEventIds = Array.isArray(config?.deletedEventIds) ? config.deletedEventIds.filter(Boolean) : [];
  const defaultIds = new Set(DEFAULT_MOVEMENT_EVENTS.map((event) => event.id));
  const defaultEvents = DEFAULT_MOVEMENT_EVENTS
    .filter((defaultEvent) => !deletedEventIds.includes(defaultEvent.id))
    .map((defaultEvent) => normalizeMovementEvent(defaultEvent, incomingById.get(defaultEvent.id)));
  const customEvents = incomingEvents
    .filter((event) => event.id && !defaultIds.has(event.id) && !deletedEventIds.includes(event.id))
    .map((event, index) => normalizeMovementEvent(
      createMovementEvent(DEFAULT_MOVEMENT_EVENTS.length + index + 1, `custom-movement-${DEFAULT_MOVEMENT_EVENTS.length + index + 1}`),
      event,
    ));

  return {
    randomEnabled: config?.randomEnabled ?? true,
    randomShortcut: config?.randomShortcut || "Numpad0",
    jingleEnabled: config?.jingleEnabled ?? true,
    jingleVolume: clampNumber(config?.jingleVolume ?? 0.35, 0, 1),
    jingleRelativePath: config?.jingleRelativePath ?? null,
    deletedEventIds,
    events: ensureUniqueMovementEventIds([...defaultEvents, ...customEvents]),
  };
}

export function duplicateMovementEvent(
  source: MovementEventConfig,
  index: number,
  generateId: () => string = () => `custom-movement-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
): MovementEventConfig {
  const nextId = generateId();
  return normalizeMovementEvent(createMovementEvent(index, nextId), {
    ...source,
    id: nextId,
    name: `${source.name || `Movement ${index}`} Copy`,
    shortcut: "",
    enabled: true,
  });
}

export function createMovementEvent(
  index: number,
  id: string = `custom-movement-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
): MovementEventConfig {
  return {
    id,
    name: `Movement ${index}`,
    instruction: "Move!",
    enabled: true,
    shortcut: "",
    durationSeconds: 3,
    animation: "color-burst",
    gifRelativePath: null,
    overlayOpacity: 0.72,
    ringSpeedSeconds: 1.5,
    intensity: 1,
    primaryColor: "#ff4094",
    secondaryColor: "#44dcff",
    accentColor: "#ffea5c",
    gifScale: 1,
  };
}

function ensureUniqueMovementEventIds(events: MovementEventConfig[]): MovementEventConfig[] {
  const seen = new Set<string>();
  return events.map((event, index) => {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      return event;
    }
    let nextId = `${event.id}-copy-${index + 1}`;
    let suffix = 2;
    while (seen.has(nextId)) {
      nextId = `${event.id}-copy-${index + 1}-${suffix}`;
      suffix += 1;
    }
    seen.add(nextId);
    return { ...event, id: nextId };
  });
}

function normalizeMovementEvent(
  fallback: MovementEventConfig,
  incoming?: Partial<MovementEventConfig>,
): MovementEventConfig {
  return {
    ...fallback,
    ...incoming,
    id: incoming?.id || fallback.id,
    name: incoming?.name || fallback.name,
    instruction: incoming?.instruction || fallback.instruction,
    shortcut: incoming?.shortcut ?? fallback.shortcut,
    durationSeconds: Math.max(1, Number(incoming?.durationSeconds ?? fallback.durationSeconds) || fallback.durationSeconds),
    animation: incoming?.animation || fallback.animation,
    gifRelativePath: incoming?.gifRelativePath ?? fallback.gifRelativePath,
    enabled: incoming?.enabled ?? fallback.enabled,
    overlayOpacity: clampNumber(incoming?.overlayOpacity ?? fallback.overlayOpacity ?? 0.72, 0, 1),
    ringSpeedSeconds: clampNumber(incoming?.ringSpeedSeconds ?? fallback.ringSpeedSeconds ?? 1.5, 0.25, 8),
    intensity: clampNumber(incoming?.intensity ?? fallback.intensity ?? 1, 0.2, 3),
    primaryColor: incoming?.primaryColor || fallback.primaryColor || "#ff4094",
    secondaryColor: incoming?.secondaryColor || fallback.secondaryColor || "#44dcff",
    accentColor: incoming?.accentColor || fallback.accentColor || "#ffea5c",
    gifScale: clampNumber(incoming?.gifScale ?? fallback.gifScale ?? 1, 0.4, 2),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  const finite = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, finite));
}

export function pickRandomMovementEvent(
  config: MovementConfig,
  random: () => number = Math.random,
): MovementEventConfig | null {
  const enabledEvents = normalizeMovementConfig(config).events.filter((event) => event.enabled);
  if (enabledEvents.length === 0) return null;
  const index = Math.min(enabledEvents.length - 1, Math.floor(random() * enabledEvents.length));
  return enabledEvents[index] || null;
}

export function getMovementEventByShortcut(
  config: MovementConfig,
  code: string,
  random: () => number = Math.random,
): MovementEventConfig | null {
  const normalized = normalizeMovementConfig(config);
  if (code === normalized.randomShortcut) {
    return normalized.randomEnabled ? pickRandomMovementEvent(normalized, random) : null;
  }
  return normalized.events.find((event) => event.enabled && event.shortcut === code) || null;
}

export function isEditableKeyTarget(target: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!target) return false;
  const tagName = target.tagName?.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || !!target.isContentEditable;
}
