import test from "node:test";
import assert from "node:assert/strict";
import type { RelicSystem, StudentRosterEntry } from "./types";
import {
  DEFAULT_RELIC_SYSTEM,
  applyRelicProgressDelta,
  clampRelicProgress,
  ensureRelicProgressForRoster,
  getActiveRelicStudentIds,
  getRelicImageAssetIdForProgress,
  getRelicStage,
  getRelicStageTitle,
  getRelicTeacherProgressSummary,
  normalizeRelicSystem,
  setRelicProgressForStudents,
} from "./relics";

function roster(): StudentRosterEntry[] {
  return [
    { id: "student-luca", name: "Luca", archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    { id: "student-sofia", name: "Sofia", archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    { id: "student-old", name: "Old", archived: true, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  ];
}

test("missing relic system normalizes to safe defaults", () => {
  const normalized = normalizeRelicSystem(undefined);

  assert.deepEqual(normalized, DEFAULT_RELIC_SYSTEM);
  assert.equal(normalized.stageTitles.stage1, "Echo Fragment Found");
  assert.equal(normalized.widgetPosition, "topRight");
});

test("partial relic system preserves known values and fills missing fields", () => {
  const normalized = normalizeRelicSystem({
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

  assert.equal(normalized.relicTitle, "Echo Stone");
  assert.equal(normalized.stageTitles.stage1, "Echo Fragment Found");
  assert.equal(normalized.stageTitles.stage2, "Core Restored");
  assert.deepEqual(normalized.studentProgress["student-luca"], { progress: 30, active: true, notes: "fast" });
  assert.deepEqual(normalized.studentProgress["student-bad"], { progress: 0, active: false });
  assert.equal(normalized.widgetPosition, "bottomLeft");
  assert.equal(normalized.widgetScale, 3);
  assert.equal(normalized.widgetOpacity, 0.35);
  assert.equal(normalized.animationStyle, "sparkle");
  assert.equal(normalized.animationDurationMs, 5000);
  assert.equal(normalized.animationIntensity, 3);
  assert.equal(normalized.rgbFlowEnabled, false);
  assert.equal(normalized.widgetEntranceAnimation, "zoom");
  assert.deepEqual(normalized.hotkeys, {
    toggleWidget: "Ctrl+Alt+H",
    increaseProgress: "Ctrl+Alt+=",
    decreaseProgress: "Ctrl+Alt+-",
  });
});

test("progress clamps to integer range zero through thirty", () => {
  assert.equal(clampRelicProgress(-1), 0);
  assert.equal(clampRelicProgress(7.8), 8);
  assert.equal(clampRelicProgress(31), 30);
  assert.equal(clampRelicProgress(Number.NaN), 0);
});

test("stage calculation matches relic boundaries", () => {
  assert.equal(getRelicStage(0), "notStarted");
  assert.equal(getRelicStage(1), "stage1");
  assert.equal(getRelicStage(10), "stage1");
  assert.equal(getRelicStage(11), "stage2");
  assert.equal(getRelicStage(20), "stage2");
  assert.equal(getRelicStage(21), "stage3");
  assert.equal(getRelicStage(29), "stage3");
  assert.equal(getRelicStage(30), "complete");
});

test("roster reconciliation adds non-archived students and preserves old progress", () => {
  const relic = normalizeRelicSystem({
    studentProgress: {
      "student-luca": { progress: 12, active: true },
      "student-former": { progress: 22, active: true },
    },
  });

  const reconciled = ensureRelicProgressForRoster(relic, roster());

  assert.deepEqual(reconciled.studentProgress["student-luca"], { progress: 12, active: true });
  assert.deepEqual(reconciled.studentProgress["student-sofia"], { progress: 0, active: false });
  assert.equal(reconciled.studentProgress["student-old"], undefined);
  assert.deepEqual(reconciled.studentProgress["student-former"], { progress: 22, active: true });
});

test("progress updates affect all and only active students", () => {
  const relic = ensureRelicProgressForRoster(normalizeRelicSystem({
    studentProgress: {
      "student-luca": { progress: 12, active: true },
      "student-sofia": { progress: 8, active: false },
    },
  }), roster());

  const updated = applyRelicProgressDelta(relic, getActiveRelicStudentIds(relic, roster()), 1);

  assert.equal(updated.studentProgress["student-luca"]?.progress, 13);
  assert.equal(updated.studentProgress["student-sofia"]?.progress, 8);
});

test("no active student update is safe and unchanged", () => {
  const relic = ensureRelicProgressForRoster(normalizeRelicSystem({}), roster());
  const updated = setRelicProgressForStudents(relic, [], 30);

  assert.deepEqual(updated, relic);
});

test("teacher summary shows precise progress and next stage distance", () => {
  const relic = normalizeRelicSystem({});
  assert.deepEqual(getRelicTeacherProgressSummary(relic, 7), {
    progressLabel: "7 / 30",
    stageLabel: "Stage 1",
    nextStageIn: 3,
  });
  assert.deepEqual(getRelicTeacherProgressSummary(relic, 30), {
    progressLabel: "30 / 30",
    stageLabel: "Complete",
    nextStageIn: null,
  });
});

test("stage title and image selection use stage fallbacks", () => {
  const relic: RelicSystem = normalizeRelicSystem({
    relicTitle: "Echo Stone",
    mainImageAssetId: "main",
    stageImageAssetIds: { stage1: "one", stage2: "two", stage3: null },
    stageTitles: { stage1: "Fragment", stage2: "Core", stage3: "Awakened" },
  });

  assert.equal(getRelicStageTitle(relic, 0), "Not Started");
  assert.equal(getRelicStageTitle(relic, 11), "Core");
  assert.equal(getRelicStageTitle(relic, 30), "Awakened");
  assert.equal(getRelicImageAssetIdForProgress(relic, 0), "main");
  assert.equal(getRelicImageAssetIdForProgress(relic, 5), "one");
  assert.equal(getRelicImageAssetIdForProgress(relic, 12), "two");
  assert.equal(getRelicImageAssetIdForProgress(relic, 26), "main");
});
