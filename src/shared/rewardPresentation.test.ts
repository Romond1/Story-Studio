import test from "node:test";
import { setFinalBadgeScroll } from './rewardPresentation';
import assert from "node:assert/strict";

test('badge scroll belongs to the current celebration and survives student-safe snapshots', () => {
  const initial = { id: 'badge', startedAt: 1000, config: {}, students: [] };
  const scrolled = setFinalBadgeScroll(initial, 'badge', 340);
  assert.equal(scrolled?.scrollTop, 340);
  assert.equal(setFinalBadgeScroll(scrolled, 'retired-badge', 0), scrolled);
  assert.equal(setFinalBadgeScroll(scrolled, 'badge', NaN), scrolled);
  assert.equal(setFinalBadgeScroll(scrolled, 'badge', -1)?.scrollTop, 0);
  const snapshot = parseRewardPresentation({ frame: { width: 1280, height: 720 }, sparks: [], final: scrolled });
  assert.equal(snapshot?.final?.scrollTop, 340);
  assert.equal(snapshot?.final?.startedAt, 1000);
});
import { parsePresentSnapshot } from "./presentationSnapshot";
import {
  rewardAge,
  rewardRemaining,
  rewardRandom,
  sparkLifetime,
  parseRewardPresentation,
  RewardAnimationClock,
} from "./rewardPresentation";

test("animation age freezes between snapshots and catches up when returning to visibility animation", () => {
  const clock = new RewardAnimationClock();
  assert.equal(clock.age("visible", 1000, 1010), 10);
  assert.equal(clock.age("visible", 1000, 1400), 10);
  assert.equal(clock.age("progress", 1400, 1415), 15);
  assert.equal(clock.age("progress", 1400, 3000), 15);
  assert.equal(clock.age("visible", 1000, 3300), 2300);
  assert.equal(clock.age("visible", 1000, 4000), 2300);
});

test("reward timing catches up after reload and retains crown and counter independently", () => {
  assert.equal(sparkLifetime(1000, 800, 2000, "crown"), 3000);
  assert.equal(sparkLifetime(1000, 2000, 500, "crown"), 3700);
  assert.equal(rewardAge({ startedAt: 1000 }, 900), 0);
  assert.equal(rewardAge({ startedAt: 1000 }, 2300), 1300);
  assert.equal(rewardRemaining({ expiresAt: 3000 }, 3000), 0);
});

test("badge and relic snapshot retains visible geometry and strips private definitions", () => {
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
    const parsed = parsePresentSnapshot({
      sessionId: "session",
      revision: 1,
      target: { kind: "badge", occurrenceId: "badge" },
      rewards,
    });
    assert.equal(parsed?.rewards?.relic?.entrance, entrance);
    assert.equal(parsed?.rewards?.relic?.x, 25);
    assert.deepEqual(parsed?.rewards?.relic?.reward, {
      id: "reveal",
      startedAt: 1200,
    });
    assert.ok(!JSON.stringify(parsed).includes("private"));
  }
});
test("event particle layout is stable across renderer mounts and independent for new events", () => {
  const a = rewardRandom("a"),
    b = rewardRandom("a"),
    c = rewardRandom("b");
  const samples = Array.from({ length: 20 }, () => a());
  assert.deepEqual(
    samples,
    Array.from({ length: 20 }, () => b()),
  );
  assert.notDeepEqual(
    samples,
    Array.from({ length: 20 }, () => c()),
  );
});
test("reward whitelist strips teacher metadata and rejects invalid anchors and remote assets", () => {
  const scene = {
    frame: { width: 1280, height: 720 },
    sparks: [],
    teacher: "secret",
  };
  assert.deepEqual(parseRewardPresentation(scene), {
    frame: scene.frame,
    sparks: [],
  });
  assert.equal(
    parseRewardPresentation({ ...scene, frame: { width: NaN, height: 1 } }),
    null,
  );
  assert.equal(
    parseRewardPresentation({
      ...scene,
      sparks: [{ id: "a", startedAt: NaN }],
    }),
    null,
  );
  assert.equal(
    parseRewardPresentation({
      ...scene,
      base: { image: "https://tracker.test/image" },
    }),
    null,
  );
});
