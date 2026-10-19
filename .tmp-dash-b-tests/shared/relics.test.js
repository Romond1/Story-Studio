"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const relics_1 = require("./relics");
function roster() {
    return [
        { id: "student-luca", name: "Luca", archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        { id: "student-sofia", name: "Sofia", archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        { id: "student-old", name: "Old", archived: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    ];
}
(0, node_test_1.default)("missing relic system normalizes to safe defaults", () => {
    const normalized = (0, relics_1.normalizeRelicSystem)(undefined);
    strict_1.default.deepEqual(normalized, relics_1.DEFAULT_RELIC_SYSTEM);
    strict_1.default.equal(normalized.stageTitles.stage1, "Echo Fragment Found");
    strict_1.default.equal(normalized.widgetPosition, "topRight");
});
(0, node_test_1.default)("partial relic system preserves known values and fills missing fields", () => {
    const normalized = (0, relics_1.normalizeRelicSystem)({
        relicTitle: "Echo Stone",
        stageTitles: { stage2: "Core Restored" },
        studentProgress: {
            "student-luca": { progress: 99, active: true, notes: "fast" },
            "student-bad": { progress: -4, active: "yes" },
        },
        widgetPosition: "bottomLeft",
        widgetScale: 10,
        widgetOpacity: 0.35,
        animationStyle: "sparkle",
        animationDurationMs: 9000,
        animationIntensity: 5,
        rgbFlowEnabled: false,
        widgetEntranceAnimation: "zoom",
        hotkeys: {
            toggleWidget: "Ctrl+Alt+H",
            increaseProgress: "Ctrl+Alt+=",
            decreaseProgress: "Ctrl+Alt+-",
        },
    });
    strict_1.default.equal(normalized.relicTitle, "Echo Stone");
    strict_1.default.equal(normalized.stageTitles.stage1, "Echo Fragment Found");
    strict_1.default.equal(normalized.stageTitles.stage2, "Core Restored");
    strict_1.default.deepEqual(normalized.studentProgress["student-luca"], { progress: 30, active: true, notes: "fast" });
    strict_1.default.deepEqual(normalized.studentProgress["student-bad"], { progress: 0, active: false });
    strict_1.default.equal(normalized.widgetPosition, "bottomLeft");
    strict_1.default.equal(normalized.widgetScale, 3);
    strict_1.default.equal(normalized.widgetOpacity, 0.35);
    strict_1.default.equal(normalized.animationStyle, "sparkle");
    strict_1.default.equal(normalized.animationDurationMs, 5000);
    strict_1.default.equal(normalized.animationIntensity, 3);
    strict_1.default.equal(normalized.rgbFlowEnabled, false);
    strict_1.default.equal(normalized.widgetEntranceAnimation, "zoom");
    strict_1.default.deepEqual(normalized.hotkeys, {
        toggleWidget: "Ctrl+Alt+H",
        increaseProgress: "Ctrl+Alt+=",
        decreaseProgress: "Ctrl+Alt+-",
    });
});
(0, node_test_1.default)("progress clamps to integer range zero through thirty", () => {
    strict_1.default.equal((0, relics_1.clampRelicProgress)(-1), 0);
    strict_1.default.equal((0, relics_1.clampRelicProgress)(7.8), 8);
    strict_1.default.equal((0, relics_1.clampRelicProgress)(31), 30);
    strict_1.default.equal((0, relics_1.clampRelicProgress)(Number.NaN), 0);
});
(0, node_test_1.default)("stage calculation matches relic boundaries", () => {
    strict_1.default.equal((0, relics_1.getRelicStage)(0), "notStarted");
    strict_1.default.equal((0, relics_1.getRelicStage)(1), "stage1");
    strict_1.default.equal((0, relics_1.getRelicStage)(10), "stage1");
    strict_1.default.equal((0, relics_1.getRelicStage)(11), "stage2");
    strict_1.default.equal((0, relics_1.getRelicStage)(20), "stage2");
    strict_1.default.equal((0, relics_1.getRelicStage)(21), "stage3");
    strict_1.default.equal((0, relics_1.getRelicStage)(29), "stage3");
    strict_1.default.equal((0, relics_1.getRelicStage)(30), "complete");
});
(0, node_test_1.default)("roster reconciliation adds non-archived students and preserves old progress", () => {
    const relic = (0, relics_1.normalizeRelicSystem)({
        studentProgress: {
            "student-luca": { progress: 12, active: true },
            "student-former": { progress: 22, active: true },
        },
    });
    const reconciled = (0, relics_1.ensureRelicProgressForRoster)(relic, roster());
    strict_1.default.deepEqual(reconciled.studentProgress["student-luca"], { progress: 12, active: true });
    strict_1.default.deepEqual(reconciled.studentProgress["student-sofia"], { progress: 0, active: false });
    strict_1.default.equal(reconciled.studentProgress["student-old"], undefined);
    strict_1.default.deepEqual(reconciled.studentProgress["student-former"], { progress: 22, active: true });
});
(0, node_test_1.default)("progress updates affect all and only active students", () => {
    const relic = (0, relics_1.ensureRelicProgressForRoster)((0, relics_1.normalizeRelicSystem)({
        studentProgress: {
            "student-luca": { progress: 12, active: true },
            "student-sofia": { progress: 8, active: false },
        },
    }), roster());
    const updated = (0, relics_1.applyRelicProgressDelta)(relic, (0, relics_1.getActiveRelicStudentIds)(relic, roster()), 1);
    strict_1.default.equal(updated.studentProgress["student-luca"]?.progress, 13);
    strict_1.default.equal(updated.studentProgress["student-sofia"]?.progress, 8);
});
(0, node_test_1.default)("no active student update is safe and unchanged", () => {
    const relic = (0, relics_1.ensureRelicProgressForRoster)((0, relics_1.normalizeRelicSystem)({}), roster());
    const updated = (0, relics_1.setRelicProgressForStudents)(relic, [], 30);
    strict_1.default.deepEqual(updated, relic);
});
(0, node_test_1.default)("teacher summary shows precise progress and next stage distance", () => {
    const relic = (0, relics_1.normalizeRelicSystem)({});
    strict_1.default.deepEqual((0, relics_1.getRelicTeacherProgressSummary)(relic, 7), {
        progressLabel: "7 / 30",
        stageLabel: "Stage 1",
        nextStageIn: 3,
    });
    strict_1.default.deepEqual((0, relics_1.getRelicTeacherProgressSummary)(relic, 30), {
        progressLabel: "30 / 30",
        stageLabel: "Complete",
        nextStageIn: null,
    });
});
(0, node_test_1.default)("stage title and image selection use stage fallbacks", () => {
    const relic = (0, relics_1.normalizeRelicSystem)({
        relicTitle: "Echo Stone",
        mainImageAssetId: "main",
        stageImageAssetIds: { stage1: "one", stage2: "two", stage3: null },
        stageTitles: { stage1: "Fragment", stage2: "Core", stage3: "Awakened" },
    });
    strict_1.default.equal((0, relics_1.getRelicStageTitle)(relic, 0), "Not Started");
    strict_1.default.equal((0, relics_1.getRelicStageTitle)(relic, 11), "Core");
    strict_1.default.equal((0, relics_1.getRelicStageTitle)(relic, 30), "Awakened");
    strict_1.default.equal((0, relics_1.getRelicImageAssetIdForProgress)(relic, 0), "main");
    strict_1.default.equal((0, relics_1.getRelicImageAssetIdForProgress)(relic, 5), "one");
    strict_1.default.equal((0, relics_1.getRelicImageAssetIdForProgress)(relic, 12), "two");
    strict_1.default.equal((0, relics_1.getRelicImageAssetIdForProgress)(relic, 26), "main");
});
