import type {
  RelicAnimationStyle,
  RelicStage,
  RelicStudentProgress,
  RelicSystem,
  RelicWidgetEntranceAnimation,
  RelicWidgetPosition,
  StudentRosterEntry,
  StudentRosterSettings,
} from "./types";

export const DEFAULT_RELIC_SYSTEM: RelicSystem = {
  enabled: true,
  relicTitle: "",
  relicDescription: "",
  mainImageAssetId: null,
  stageImageAssetIds: {
    stage1: null,
    stage2: null,
    stage3: null,
  },
  stageTitles: {
    stage1: "Echo Fragment Found",
    stage2: "Echo Core Restored",
    stage3: "Echo Stone Awakened",
  },
  studentProgress: {},
  showOnStage: true,
  widgetPosition: "topRight",
  widgetOffset: { x: 0, y: 0 },
  widgetScale: 1,
  widgetOpacity: 0.88,
  animationStyle: "glowPulse",
  animationDurationMs: 1800,
  animationIntensity: 1.6,
  rgbFlowEnabled: true,
  widgetEntranceAnimation: "fade",
  hotkeys: {
    toggleWidget: "Ctrl+Alt+W",
    increaseProgress: "Ctrl+Alt+ArrowUp",
    decreaseProgress: "Ctrl+Alt+ArrowDown",
  },
  animateOnProgress: true,
  animateOnStageChange: true,
  animateOnComplete: true,
};

const WIDGET_POSITIONS: ReadonlySet<RelicWidgetPosition> = new Set([
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
  "centerBottom",
]);

const ANIMATION_STYLES: ReadonlySet<RelicAnimationStyle> = new Set([
  "none",
  "glowPulse",
  "sparkle",
  "stageUnlockBurst",
  "completeCeremony",
]);

const WIDGET_ENTRANCE_ANIMATIONS: ReadonlySet<RelicWidgetEntranceAnimation> = new Set([
  "none",
  "fade",
  "pop",
  "slideUp",
  "zoom",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampRelicProgress(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(clampNumber(value, 0, 30));
}

function normalizeOffset(value: unknown): { x: number; y: number } {
  if (!isRecord(value)) return { ...DEFAULT_RELIC_SYSTEM.widgetOffset };
  return {
    x: Math.round(clampNumber(finiteNumberOr(value.x, 0), -500, 500)),
    y: Math.round(clampNumber(finiteNumberOr(value.y, 0), -500, 500)),
  };
}

function normalizeWidgetPosition(value: unknown): RelicWidgetPosition {
  return typeof value === "string" && WIDGET_POSITIONS.has(value as RelicWidgetPosition)
    ? value as RelicWidgetPosition
    : DEFAULT_RELIC_SYSTEM.widgetPosition;
}

function normalizeAnimationStyle(value: unknown): RelicAnimationStyle {
  return typeof value === "string" && ANIMATION_STYLES.has(value as RelicAnimationStyle)
    ? value as RelicAnimationStyle
    : DEFAULT_RELIC_SYSTEM.animationStyle;
}

function normalizeWidgetEntranceAnimation(value: unknown): RelicWidgetEntranceAnimation {
  return typeof value === "string" && WIDGET_ENTRANCE_ANIMATIONS.has(value as RelicWidgetEntranceAnimation)
    ? value as RelicWidgetEntranceAnimation
    : DEFAULT_RELIC_SYSTEM.widgetEntranceAnimation;
}

function normalizeStudentProgress(value: unknown): Record<string, RelicStudentProgress> {
  if (!isRecord(value)) return {};
  const progress: Record<string, RelicStudentProgress> = {};
  for (const [studentId, rawEntry] of Object.entries(value)) {
    if (!studentId || !isRecord(rawEntry)) continue;
    const entry: RelicStudentProgress = {
      progress: clampRelicProgress(rawEntry.progress),
      active: rawEntry.active === true,
    };
    if (typeof rawEntry.notes === "string") {
      entry.notes = rawEntry.notes;
    }
    progress[studentId] = entry;
  }
  return progress;
}

export function normalizeRelicSystem(value: unknown): RelicSystem {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_RELIC_SYSTEM,
      stageImageAssetIds: { ...DEFAULT_RELIC_SYSTEM.stageImageAssetIds },
      stageTitles: { ...DEFAULT_RELIC_SYSTEM.stageTitles },
      widgetOffset: { ...DEFAULT_RELIC_SYSTEM.widgetOffset },
      studentProgress: {},
    };
  }

  const stageTitles = isRecord(value.stageTitles) ? value.stageTitles : {};
  const stageImageAssetIds = isRecord(value.stageImageAssetIds) ? value.stageImageAssetIds : {};

  return {
    enabled: boolOr(value.enabled, DEFAULT_RELIC_SYSTEM.enabled),
    relicTitle: stringOr(value.relicTitle, DEFAULT_RELIC_SYSTEM.relicTitle),
    relicDescription: stringOr(value.relicDescription, DEFAULT_RELIC_SYSTEM.relicDescription),
    mainImageAssetId: nullableString(value.mainImageAssetId ?? value.mainImage),
    stageImageAssetIds: {
      stage1: nullableString(stageImageAssetIds.stage1),
      stage2: nullableString(stageImageAssetIds.stage2),
      stage3: nullableString(stageImageAssetIds.stage3),
    },
    stageTitles: {
      stage1: stringOr(stageTitles.stage1, DEFAULT_RELIC_SYSTEM.stageTitles.stage1),
      stage2: stringOr(stageTitles.stage2, DEFAULT_RELIC_SYSTEM.stageTitles.stage2),
      stage3: stringOr(stageTitles.stage3, DEFAULT_RELIC_SYSTEM.stageTitles.stage3),
    },
    studentProgress: normalizeStudentProgress(value.studentProgress),
    showOnStage: boolOr(value.showOnStage, DEFAULT_RELIC_SYSTEM.showOnStage),
    widgetPosition: normalizeWidgetPosition(value.widgetPosition),
    widgetOffset: normalizeOffset(value.widgetOffset),
    widgetScale: clampNumber(finiteNumberOr(value.widgetScale, DEFAULT_RELIC_SYSTEM.widgetScale), 0.5, 3),
    widgetOpacity: clampNumber(finiteNumberOr(value.widgetOpacity, DEFAULT_RELIC_SYSTEM.widgetOpacity), 0.25, 1),
    animationStyle: normalizeAnimationStyle(value.animationStyle),
    animationDurationMs: Math.round(clampNumber(finiteNumberOr(value.animationDurationMs, DEFAULT_RELIC_SYSTEM.animationDurationMs), 500, 5000)),
    animationIntensity: clampNumber(finiteNumberOr(value.animationIntensity, DEFAULT_RELIC_SYSTEM.animationIntensity), 0.5, 3),
    rgbFlowEnabled: boolOr(value.rgbFlowEnabled, DEFAULT_RELIC_SYSTEM.rgbFlowEnabled),
    widgetEntranceAnimation: normalizeWidgetEntranceAnimation(value.widgetEntranceAnimation),
    hotkeys: {
      toggleWidget: stringOr(isRecord(value.hotkeys) ? value.hotkeys.toggleWidget : undefined, DEFAULT_RELIC_SYSTEM.hotkeys.toggleWidget),
      increaseProgress: stringOr(isRecord(value.hotkeys) ? value.hotkeys.increaseProgress : undefined, DEFAULT_RELIC_SYSTEM.hotkeys.increaseProgress),
      decreaseProgress: stringOr(isRecord(value.hotkeys) ? value.hotkeys.decreaseProgress : undefined, DEFAULT_RELIC_SYSTEM.hotkeys.decreaseProgress),
    },
    animateOnProgress: boolOr(value.animateOnProgress, DEFAULT_RELIC_SYSTEM.animateOnProgress),
    animateOnStageChange: boolOr(value.animateOnStageChange, DEFAULT_RELIC_SYSTEM.animateOnStageChange),
    animateOnComplete: boolOr(value.animateOnComplete, DEFAULT_RELIC_SYSTEM.animateOnComplete),
  };
}

export function normalizeStudentRosterSettings(value: unknown, now = new Date().toISOString()): StudentRosterSettings {
  const rawList = isRecord(value) && Array.isArray(value.studentRoster) ? value.studentRoster : [];
  const seen = new Set<string>();
  const studentRoster = rawList
    .map((item): StudentRosterEntry | null => {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id || seen.has(item.id)) return null;
      seen.add(item.id);
      const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Student";
      return {
        id: item.id,
        name,
        archived: item.archived === true,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
      };
    })
    .filter((item): item is StudentRosterEntry => item !== null);

  return { version: 1, studentRoster };
}

export function ensureRelicProgressForRoster(relicSystem: RelicSystem, roster: StudentRosterEntry[]): RelicSystem {
  const nextProgress: Record<string, RelicStudentProgress> = { ...relicSystem.studentProgress };
  for (const student of roster) {
    if (student.archived) continue;
    if (!nextProgress[student.id]) {
      nextProgress[student.id] = { progress: 0, active: false };
    } else {
      nextProgress[student.id] = {
        ...nextProgress[student.id],
        progress: clampRelicProgress(nextProgress[student.id].progress),
        active: nextProgress[student.id].active === true,
      };
    }
  }
  return { ...relicSystem, studentProgress: nextProgress };
}

export function getRelicStage(progressValue: unknown): RelicStage {
  const progress = clampRelicProgress(progressValue);
  if (progress === 0) return "notStarted";
  if (progress <= 10) return "stage1";
  if (progress <= 20) return "stage2";
  if (progress < 30) return "stage3";
  return "complete";
}

export function getRelicStageLabel(progress: unknown): string {
  const stage = getRelicStage(progress);
  if (stage === "notStarted") return "Not Started";
  if (stage === "stage1") return "Stage 1";
  if (stage === "stage2") return "Stage 2";
  if (stage === "stage3") return "Stage 3";
  return "Complete";
}

export function getRelicStageTitle(relicSystem: RelicSystem, progress: unknown): string {
  const stage = getRelicStage(progress);
  if (stage === "notStarted") return "Not Started";
  if (stage === "stage1") return relicSystem.stageTitles.stage1;
  if (stage === "stage2") return relicSystem.stageTitles.stage2;
  return relicSystem.stageTitles.stage3;
}

export function getNextRelicStageDistance(progressValue: unknown): number | null {
  const progress = clampRelicProgress(progressValue);
  if (progress >= 30) return null;
  if (progress < 10) return 10 - progress;
  if (progress < 20) return 20 - progress;
  if (progress < 30) return 30 - progress;
  return null;
}

export function getRelicTeacherProgressSummary(relicSystem: RelicSystem, progress: unknown): {
  progressLabel: string;
  stageLabel: string;
  nextStageIn: number | null;
} {
  const clamped = clampRelicProgress(progress);
  return {
    progressLabel: `${clamped} / 30`,
    stageLabel: getRelicStageLabel(clamped),
    nextStageIn: getNextRelicStageDistance(clamped),
  };
}

export function getActiveRelicStudentIds(relicSystem: RelicSystem, roster: StudentRosterEntry[]): string[] {
  const visibleStudentIds = new Set(roster.filter((student) => !student.archived).map((student) => student.id));
  return Object.entries(relicSystem.studentProgress)
    .filter(([studentId, entry]) => visibleStudentIds.has(studentId) && entry.active)
    .map(([studentId]) => studentId);
}

export function setRelicProgressForStudents(
  relicSystem: RelicSystem,
  studentIds: string[],
  progress: number,
): RelicSystem {
  if (studentIds.length === 0) return relicSystem;
  const nextProgress = { ...relicSystem.studentProgress };
  for (const studentId of studentIds) {
    const existing = nextProgress[studentId] ?? { progress: 0, active: false };
    nextProgress[studentId] = {
      ...existing,
      progress: clampRelicProgress(progress),
    };
  }
  return { ...relicSystem, studentProgress: nextProgress };
}

export function applyRelicProgressDelta(
  relicSystem: RelicSystem,
  studentIds: string[],
  delta: number,
): RelicSystem {
  if (studentIds.length === 0) return relicSystem;
  const nextProgress = { ...relicSystem.studentProgress };
  for (const studentId of studentIds) {
    const existing = nextProgress[studentId] ?? { progress: 0, active: false };
    nextProgress[studentId] = {
      ...existing,
      progress: clampRelicProgress(existing.progress + delta),
    };
  }
  return { ...relicSystem, studentProgress: nextProgress };
}

export function getRelicImageAssetIdForProgress(relicSystem: RelicSystem, progress: unknown): string | null {
  const stage = getRelicStage(progress);
  if (stage === "stage1") return relicSystem.stageImageAssetIds.stage1 || relicSystem.mainImageAssetId;
  if (stage === "stage2") return relicSystem.stageImageAssetIds.stage2 || relicSystem.mainImageAssetId;
  if (stage === "stage3" || stage === "complete") {
    return relicSystem.stageImageAssetIds.stage3 || relicSystem.mainImageAssetId;
  }
  return relicSystem.mainImageAssetId;
}
