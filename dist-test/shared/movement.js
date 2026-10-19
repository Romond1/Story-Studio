"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MOVEMENT_CONFIG = exports.DEFAULT_MOVEMENT_EVENTS = exports.BUILT_IN_MOVEMENT_GIFS = void 0;
exports.normalizeMovementConfig = normalizeMovementConfig;
exports.duplicateMovementEvent = duplicateMovementEvent;
exports.createMovementEvent = createMovementEvent;
exports.pickRandomMovementEvent = pickRandomMovementEvent;
exports.getMovementEventByShortcut = getMovementEventByShortcut;
exports.isEditableKeyTarget = isEditableKeyTarget;
const legacy_be_a_hero_v1_1 = require("./adventures/legacy-be-a-hero-v1");
// Movement events are saved as project config, but play as temporary stage overlays.
exports.BUILT_IN_MOVEMENT_GIFS = legacy_be_a_hero_v1_1.LEGACY_BE_A_HERO_V1.movementGifs.map(value => ({ ...value }));
exports.DEFAULT_MOVEMENT_EVENTS = legacy_be_a_hero_v1_1.LEGACY_BE_A_HERO_V1.movementEvents.map(value => ({ ...value }));
exports.DEFAULT_MOVEMENT_CONFIG = {
    randomEnabled: true,
    randomShortcut: "Numpad0",
    jingleEnabled: true,
    jingleVolume: 0.35,
    jingleRelativePath: null,
    events: exports.DEFAULT_MOVEMENT_EVENTS,
};
function normalizeMovementConfig(config) {
    const incomingEvents = Array.isArray(config?.events) ? config.events : [];
    const incomingById = new Map(incomingEvents.map((event) => [event.id || "", event]));
    const deletedEventIds = Array.isArray(config?.deletedEventIds) ? config.deletedEventIds.filter(Boolean) : [];
    const defaultIds = new Set(exports.DEFAULT_MOVEMENT_EVENTS.map((event) => event.id));
    const defaultEvents = exports.DEFAULT_MOVEMENT_EVENTS
        .filter((defaultEvent) => !deletedEventIds.includes(defaultEvent.id))
        .map((defaultEvent) => normalizeMovementEvent(defaultEvent, incomingById.get(defaultEvent.id)));
    const customEvents = incomingEvents
        .filter((event) => event.id && !defaultIds.has(event.id) && !deletedEventIds.includes(event.id))
        .map((event, index) => normalizeMovementEvent(createMovementEvent(exports.DEFAULT_MOVEMENT_EVENTS.length + index + 1, `custom-movement-${exports.DEFAULT_MOVEMENT_EVENTS.length + index + 1}`), event));
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
function duplicateMovementEvent(source, index, generateId = () => `custom-movement-${Date.now()}-${Math.floor(Math.random() * 10000)}`) {
    const nextId = generateId();
    return normalizeMovementEvent(createMovementEvent(index, nextId), {
        ...source,
        id: nextId,
        name: `${source.name || `Movement ${index}`} Copy`,
        shortcut: "",
        enabled: true,
    });
}
function createMovementEvent(index, id = `custom-movement-${Date.now()}-${Math.floor(Math.random() * 10000)}`) {
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
function ensureUniqueMovementEventIds(events) {
    const seen = new Set();
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
function normalizeMovementEvent(fallback, incoming) {
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
function clampNumber(value, min, max) {
    const finite = Number.isFinite(value) ? value : min;
    return Math.max(min, Math.min(max, finite));
}
function pickRandomMovementEvent(config, random = Math.random) {
    const enabledEvents = normalizeMovementConfig(config).events.filter((event) => event.enabled);
    if (enabledEvents.length === 0)
        return null;
    const index = Math.min(enabledEvents.length - 1, Math.floor(random() * enabledEvents.length));
    return enabledEvents[index] || null;
}
function getMovementEventByShortcut(config, code, random = Math.random) {
    const normalized = normalizeMovementConfig(config);
    if (code === normalized.randomShortcut) {
        return normalized.randomEnabled ? pickRandomMovementEvent(normalized, random) : null;
    }
    return normalized.events.find((event) => event.enabled && event.shortcut === code) || null;
}
function isEditableKeyTarget(target) {
    if (!target)
        return false;
    const tagName = target.tagName?.toUpperCase();
    return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || !!target.isContentEditable;
}
