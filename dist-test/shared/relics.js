"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RELIC_SYSTEM = void 0;
exports.clampRelicProgress = clampRelicProgress;
exports.normalizeRelicSystem = normalizeRelicSystem;
exports.normalizeStudentRosterSettings = normalizeStudentRosterSettings;
exports.ensureRelicProgressForRoster = ensureRelicProgressForRoster;
exports.getRelicStage = getRelicStage;
exports.getRelicStageLabel = getRelicStageLabel;
exports.getRelicStageTitle = getRelicStageTitle;
exports.getNextRelicStageDistance = getNextRelicStageDistance;
exports.getRelicTeacherProgressSummary = getRelicTeacherProgressSummary;
exports.getActiveRelicStudentIds = getActiveRelicStudentIds;
exports.setRelicProgressForStudents = setRelicProgressForStudents;
exports.applyRelicProgressDelta = applyRelicProgressDelta;
exports.getRelicImageAssetIdForProgress = getRelicImageAssetIdForProgress;
exports.DEFAULT_RELIC_SYSTEM = {
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
const WIDGET_POSITIONS = new Set([
    "topLeft",
    "topRight",
    "bottomLeft",
    "bottomRight",
    "centerBottom",
]);
const ANIMATION_STYLES = new Set([
    "none",
    "glowPulse",
    "sparkle",
    "stageUnlockBurst",
    "completeCeremony",
]);
const WIDGET_ENTRANCE_ANIMATIONS = new Set([
    "none",
    "fade",
    "pop",
    "slideUp",
    "zoom",
]);
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function stringOr(value, fallback) {
    return typeof value === "string" ? value : fallback;
}
function nullableString(value) {
    return typeof value === "string" && value ? value : null;
}
function boolOr(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
function finiteNumberOr(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function clampRelicProgress(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return 0;
    return Math.round(clampNumber(value, 0, 30));
}
function normalizeOffset(value) {
    if (!isRecord(value))
        return { ...exports.DEFAULT_RELIC_SYSTEM.widgetOffset };
    return {
        x: Math.round(clampNumber(finiteNumberOr(value.x, 0), -500, 500)),
        y: Math.round(clampNumber(finiteNumberOr(value.y, 0), -500, 500)),
    };
}
function normalizeWidgetPosition(value) {
    return typeof value === "string" && WIDGET_POSITIONS.has(value)
        ? value
        : exports.DEFAULT_RELIC_SYSTEM.widgetPosition;
}
function normalizeAnimationStyle(value) {
    return typeof value === "string" && ANIMATION_STYLES.has(value)
        ? value
        : exports.DEFAULT_RELIC_SYSTEM.animationStyle;
}
function normalizeWidgetEntranceAnimation(value) {
    return typeof value === "string" && WIDGET_ENTRANCE_ANIMATIONS.has(value)
        ? value
        : exports.DEFAULT_RELIC_SYSTEM.widgetEntranceAnimation;
}
function normalizeStudentProgress(value) {
    if (!isRecord(value))
        return {};
    const progress = {};
    for (const [studentId, rawEntry] of Object.entries(value)) {
        if (!studentId || !isRecord(rawEntry))
            continue;
        const entry = {
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
function normalizeRelicSystem(value) {
    if (!isRecord(value)) {
        return {
            ...exports.DEFAULT_RELIC_SYSTEM,
            stageImageAssetIds: { ...exports.DEFAULT_RELIC_SYSTEM.stageImageAssetIds },
            stageTitles: { ...exports.DEFAULT_RELIC_SYSTEM.stageTitles },
            widgetOffset: { ...exports.DEFAULT_RELIC_SYSTEM.widgetOffset },
            studentProgress: {},
        };
    }
    const stageTitles = isRecord(value.stageTitles) ? value.stageTitles : {};
    const stageImageAssetIds = isRecord(value.stageImageAssetIds) ? value.stageImageAssetIds : {};
    return {
        enabled: boolOr(value.enabled, exports.DEFAULT_RELIC_SYSTEM.enabled),
        relicTitle: stringOr(value.relicTitle, exports.DEFAULT_RELIC_SYSTEM.relicTitle),
        relicDescription: stringOr(value.relicDescription, exports.DEFAULT_RELIC_SYSTEM.relicDescription),
        mainImageAssetId: nullableString(value.mainImageAssetId ?? value.mainImage),
        stageImageAssetIds: {
            stage1: nullableString(stageImageAssetIds.stage1),
            stage2: nullableString(stageImageAssetIds.stage2),
            stage3: nullableString(stageImageAssetIds.stage3),
        },
        stageTitles: {
            stage1: stringOr(stageTitles.stage1, exports.DEFAULT_RELIC_SYSTEM.stageTitles.stage1),
            stage2: stringOr(stageTitles.stage2, exports.DEFAULT_RELIC_SYSTEM.stageTitles.stage2),
            stage3: stringOr(stageTitles.stage3, exports.DEFAULT_RELIC_SYSTEM.stageTitles.stage3),
        },
        studentProgress: normalizeStudentProgress(value.studentProgress),
        showOnStage: boolOr(value.showOnStage, exports.DEFAULT_RELIC_SYSTEM.showOnStage),
        widgetPosition: normalizeWidgetPosition(value.widgetPosition),
        widgetOffset: normalizeOffset(value.widgetOffset),
        widgetScale: clampNumber(finiteNumberOr(value.widgetScale, exports.DEFAULT_RELIC_SYSTEM.widgetScale), 0.5, 3),
        widgetOpacity: clampNumber(finiteNumberOr(value.widgetOpacity, exports.DEFAULT_RELIC_SYSTEM.widgetOpacity), 0.25, 1),
        animationStyle: normalizeAnimationStyle(value.animationStyle),
        animationDurationMs: Math.round(clampNumber(finiteNumberOr(value.animationDurationMs, exports.DEFAULT_RELIC_SYSTEM.animationDurationMs), 500, 5000)),
        animationIntensity: clampNumber(finiteNumberOr(value.animationIntensity, exports.DEFAULT_RELIC_SYSTEM.animationIntensity), 0.5, 3),
        rgbFlowEnabled: boolOr(value.rgbFlowEnabled, exports.DEFAULT_RELIC_SYSTEM.rgbFlowEnabled),
        widgetEntranceAnimation: normalizeWidgetEntranceAnimation(value.widgetEntranceAnimation),
        hotkeys: {
            toggleWidget: stringOr(isRecord(value.hotkeys) ? value.hotkeys.toggleWidget : undefined, exports.DEFAULT_RELIC_SYSTEM.hotkeys.toggleWidget),
            increaseProgress: stringOr(isRecord(value.hotkeys) ? value.hotkeys.increaseProgress : undefined, exports.DEFAULT_RELIC_SYSTEM.hotkeys.increaseProgress),
            decreaseProgress: stringOr(isRecord(value.hotkeys) ? value.hotkeys.decreaseProgress : undefined, exports.DEFAULT_RELIC_SYSTEM.hotkeys.decreaseProgress),
        },
        animateOnProgress: boolOr(value.animateOnProgress, exports.DEFAULT_RELIC_SYSTEM.animateOnProgress),
        animateOnStageChange: boolOr(value.animateOnStageChange, exports.DEFAULT_RELIC_SYSTEM.animateOnStageChange),
        animateOnComplete: boolOr(value.animateOnComplete, exports.DEFAULT_RELIC_SYSTEM.animateOnComplete),
    };
}
function normalizeStudentRosterSettings(value, now = new Date().toISOString()) {
    const rawList = isRecord(value) && Array.isArray(value.studentRoster) ? value.studentRoster : [];
    const seen = new Set();
    const studentRoster = rawList
        .map((item) => {
        if (!isRecord(item) || typeof item.id !== "string" || !item.id || seen.has(item.id))
            return null;
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
        .filter((item) => item !== null);
    return { version: 1, studentRoster };
}
function ensureRelicProgressForRoster(relicSystem, roster) {
    const nextProgress = { ...relicSystem.studentProgress };
    for (const student of roster) {
        if (student.archived)
            continue;
        if (!nextProgress[student.id]) {
            nextProgress[student.id] = { progress: 0, active: false };
        }
        else {
            nextProgress[student.id] = {
                ...nextProgress[student.id],
                progress: clampRelicProgress(nextProgress[student.id].progress),
                active: nextProgress[student.id].active === true,
            };
        }
    }
    return { ...relicSystem, studentProgress: nextProgress };
}
function getRelicStage(progressValue) {
    const progress = clampRelicProgress(progressValue);
    if (progress === 0)
        return "notStarted";
    if (progress <= 10)
        return "stage1";
    if (progress <= 20)
        return "stage2";
    if (progress < 30)
        return "stage3";
    return "complete";
}
function getRelicStageLabel(progress) {
    const stage = getRelicStage(progress);
    if (stage === "notStarted")
        return "Not Started";
    if (stage === "stage1")
        return "Stage 1";
    if (stage === "stage2")
        return "Stage 2";
    if (stage === "stage3")
        return "Stage 3";
    return "Complete";
}
function getRelicStageTitle(relicSystem, progress) {
    const stage = getRelicStage(progress);
    if (stage === "notStarted")
        return "Not Started";
    if (stage === "stage1")
        return relicSystem.stageTitles.stage1;
    if (stage === "stage2")
        return relicSystem.stageTitles.stage2;
    return relicSystem.stageTitles.stage3;
}
function getNextRelicStageDistance(progressValue) {
    const progress = clampRelicProgress(progressValue);
    if (progress >= 30)
        return null;
    if (progress < 10)
        return 10 - progress;
    if (progress < 20)
        return 20 - progress;
    if (progress < 30)
        return 30 - progress;
    return null;
}
function getRelicTeacherProgressSummary(relicSystem, progress) {
    const clamped = clampRelicProgress(progress);
    return {
        progressLabel: `${clamped} / 30`,
        stageLabel: getRelicStageLabel(clamped),
        nextStageIn: getNextRelicStageDistance(clamped),
    };
}
function getActiveRelicStudentIds(relicSystem, roster) {
    const visibleStudentIds = new Set(roster.filter((student) => !student.archived).map((student) => student.id));
    return Object.entries(relicSystem.studentProgress)
        .filter(([studentId, entry]) => visibleStudentIds.has(studentId) && entry.active)
        .map(([studentId]) => studentId);
}
function setRelicProgressForStudents(relicSystem, studentIds, progress) {
    if (studentIds.length === 0)
        return relicSystem;
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
function applyRelicProgressDelta(relicSystem, studentIds, delta) {
    if (studentIds.length === 0)
        return relicSystem;
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
function getRelicImageAssetIdForProgress(relicSystem, progress) {
    const stage = getRelicStage(progress);
    if (stage === "stage1")
        return relicSystem.stageImageAssetIds.stage1 || relicSystem.mainImageAssetId;
    if (stage === "stage2")
        return relicSystem.stageImageAssetIds.stage2 || relicSystem.mainImageAssetId;
    if (stage === "stage3" || stage === "complete") {
        return relicSystem.stageImageAssetIds.stage3 || relicSystem.mainImageAssetId;
    }
    return relicSystem.mainImageAssetId;
}
