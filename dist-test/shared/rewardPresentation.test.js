"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const rewardPresentation_1 = require("./rewardPresentation");
const strict_1 = __importDefault(require("node:assert/strict"));
(0, node_test_1.default)('badge scroll belongs to the current celebration and survives student-safe snapshots', () => {
    const initial = { id: 'badge', startedAt: 1000, config: {}, students: [] };
    const scrolled = (0, rewardPresentation_1.setFinalBadgeScroll)(initial, 'badge', 340);
    strict_1.default.equal(scrolled?.scrollTop, 340);
    strict_1.default.equal((0, rewardPresentation_1.setFinalBadgeScroll)(scrolled, 'retired-badge', 0), scrolled);
    strict_1.default.equal((0, rewardPresentation_1.setFinalBadgeScroll)(scrolled, 'badge', NaN), scrolled);
    strict_1.default.equal((0, rewardPresentation_1.setFinalBadgeScroll)(scrolled, 'badge', -1)?.scrollTop, 0);
    const snapshot = (0, rewardPresentation_2.parseRewardPresentation)({ frame: { width: 1280, height: 720 }, sparks: [], final: scrolled });
    strict_1.default.equal(snapshot?.final?.scrollTop, 340);
    strict_1.default.equal(snapshot?.final?.startedAt, 1000);
});
const presentationSnapshot_1 = require("./presentationSnapshot");
const rewardPresentation_2 = require("./rewardPresentation");
(0, node_test_1.default)("animation age freezes between snapshots and catches up when returning to visibility animation", () => {
    const clock = new rewardPresentation_2.RewardAnimationClock();
    strict_1.default.equal(clock.age("visible", 1000, 1010), 10);
    strict_1.default.equal(clock.age("visible", 1000, 1400), 10);
    strict_1.default.equal(clock.age("progress", 1400, 1415), 15);
    strict_1.default.equal(clock.age("progress", 1400, 3000), 15);
    strict_1.default.equal(clock.age("visible", 1000, 3300), 2300);
    strict_1.default.equal(clock.age("visible", 1000, 4000), 2300);
});
(0, node_test_1.default)("reward timing catches up after reload and retains crown and counter independently", () => {
    strict_1.default.equal((0, rewardPresentation_2.sparkLifetime)(1000, 800, 2000, "crown"), 3000);
    strict_1.default.equal((0, rewardPresentation_2.sparkLifetime)(1000, 2000, 500, "crown"), 3700);
    strict_1.default.equal((0, rewardPresentation_2.rewardAge)({ startedAt: 1000 }, 900), 0);
    strict_1.default.equal((0, rewardPresentation_2.rewardAge)({ startedAt: 1000 }, 2300), 1300);
    strict_1.default.equal((0, rewardPresentation_2.rewardRemaining)({ expiresAt: 3000 }, 3000), 0);
});
(0, node_test_1.default)("badge and relic snapshot retains visible geometry and strips private definitions", () => {
    const relic = {
        title: "Relic",
        names: ["Ada"],
        rows: [{ name: "Ada", progress: 11, notes: "private" }],
        progress: 11,
        stageTitle: "Stage 2",
        progressLabel: "11 / 30",
        position: "topRight",
        x: 25,
        y: 30,
        scale: 1.2,
        opacity: 0.8,
        entrance: "slideUp",
        style: "glowPulse",
        durationMs: 1800,
        intensity: 1.6,
        visible: true,
        visibility: { id: "visible", startedAt: 1000, expiresAt: 1520 },
        event: { id: "result", startedAt: 1000, expiresAt: 2920, kind: "stage" },
        reward: { id: "reveal", startedAt: 1200 },
        hotkeys: { increase: "private" },
        roster: [{ notes: "private" }],
    };
    for (const entrance of ["slideUp", "zoom"]) {
        const rewards = {
            frame: { width: 1280, height: 720 },
            sparks: [],
            relic: { ...relic, entrance },
            project: { teacherNotes: "private" },
        };
        const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)({
            sessionId: "session",
            revision: 1,
            target: { kind: "badge", occurrenceId: "badge" },
            rewards,
        });
        strict_1.default.equal(parsed?.rewards?.relic?.entrance, entrance);
        strict_1.default.equal(parsed?.rewards?.relic?.x, 25);
        strict_1.default.deepEqual(parsed?.rewards?.relic?.reward, {
            id: "reveal",
            startedAt: 1200,
        });
        strict_1.default.ok(!JSON.stringify(parsed).includes("private"));
    }
});
(0, node_test_1.default)("event particle layout is stable across renderer mounts and independent for new events", () => {
    const a = (0, rewardPresentation_2.rewardRandom)("a"), b = (0, rewardPresentation_2.rewardRandom)("a"), c = (0, rewardPresentation_2.rewardRandom)("b");
    const samples = Array.from({ length: 20 }, () => a());
    strict_1.default.deepEqual(samples, Array.from({ length: 20 }, () => b()));
    strict_1.default.notDeepEqual(samples, Array.from({ length: 20 }, () => c()));
});
(0, node_test_1.default)("reward whitelist strips teacher metadata and rejects invalid anchors and remote assets", () => {
    const scene = {
        frame: { width: 1280, height: 720 },
        sparks: [],
        teacher: "secret",
    };
    strict_1.default.deepEqual((0, rewardPresentation_2.parseRewardPresentation)(scene), {
        frame: scene.frame,
        sparks: [],
    });
    strict_1.default.equal((0, rewardPresentation_2.parseRewardPresentation)({ ...scene, frame: { width: NaN, height: 1 } }), null);
    strict_1.default.equal((0, rewardPresentation_2.parseRewardPresentation)({
        ...scene,
        sparks: [{ id: "a", startedAt: NaN }],
    }), null);
    strict_1.default.equal((0, rewardPresentation_2.parseRewardPresentation)({
        ...scene,
        base: { image: "https://tracker.test/image" },
    }), null);
});
