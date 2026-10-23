import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, navigate } from './lesson/session';
import { createLesson, insertScene } from './lesson/commands';
import { parseRewardPresentation } from './rewardPresentation';
import * as rewardCommands from './lesson/rewards';
import { DEFAULT_REWARD_APPEARANCE, parseRewardAppearance, rewardAnchorStyle, REWARD_POSITIONS } from './rewardAppearance';
import { DEFAULT_SPARK_CONFIG } from './rewardDefaults';

function api(): any {
  return rewardCommands;
}
const roster = [
  { id: 'ada', name: 'Ada', archived: false, createdAt: '2026-10-08', updatedAt: '2026-10-08' },
  { id: 'grace', name: 'Grace', archived: false, createdAt: '2026-10-08', updatedAt: '2026-10-08' },
  { id: 'archived', name: 'Earlier student', archived: true, createdAt: '2026-10-08', updatedAt: '2026-10-08' },
];

test('lesson reward appearance survives navigation and projects identical configurable visuals to Present', () => {
  const r = api();
  let session = r.initializeLessonRewards(createSession(), []);
  const appearance = { position: 'bottomLeft', size: 1.5, intensity: .5 };
  session = r.setLessonRewardAppearance(session, appearance);
  session = r.awardLessonReward(session, 'gold', 'styled', 1000);
  const visual = r.projectLessonRewards(session.rewards, { width: 1280, height: 720 });
  assert.deepEqual(visual.sparks[0].appearance, appearance);
  assert.equal(visual.sparks[0].config.particleCount, 5);
  assert.equal(visual.sparks[0].config.glowIntensity, 30);
  assert.deepEqual(parseRewardPresentation(JSON.parse(JSON.stringify(visual))), visual);
  assert.equal(r.setLessonRewardAppearance(session, { ...appearance, size: 100 }), session);
  assert.equal(parseRewardPresentation({ ...visual, sparks: [{ ...visual.sparks[0], appearance: { ...appearance, intensity: -1 } }] }), null);
  const moved = navigate(createLesson('Appearance'), session, null);
  assert.deepEqual(moved.rewards!.appearance, appearance);
});

test('reward defaults retain legacy placement, and each position shares bounded logical-scene geometry', () => {
  assert.deepEqual(rewardAnchorStyle(undefined, DEFAULT_SPARK_CONFIG), { top: 120, right: 40 });
  for (const position of REWARD_POSITIONS) {
    const appearance = { ...DEFAULT_REWARD_APPEARANCE, position, size: 1.5 };
    assert.deepEqual(parseRewardAppearance(JSON.parse(JSON.stringify(appearance))), appearance);
    const style = rewardAnchorStyle(appearance, DEFAULT_SPARK_CONFIG);
    assert.ok(style.transform?.includes('scale(1.5)'));
    if (position === 'center') assert.equal(style.left, '50%');
    else if (position.endsWith('Left')) assert.equal(style.left, 40);
    else assert.equal(style.right, 40);
  }
  for (const value of [null, {}, { ...DEFAULT_REWARD_APPEARANCE, position: 'elsewhere' }, { ...DEFAULT_REWARD_APPEARANCE, size: NaN }, { ...DEFAULT_REWARD_APPEARANCE, intensity: 3 }]) assert.equal(parseRewardAppearance(value), null);
});

test('reward appearance changes do not rescore events and intensity adjusts celebration effects', () => {
  const r = api();
  let session = r.initializeLessonRewards(createSession(), []);
  session = r.awardLessonReward(session, 'gold', 'original', 1000);
  const original = session.rewards.sparks[0];
  session = r.setLessonRewardAppearance(session, { ...DEFAULT_REWARD_APPEARANCE, intensity: 0 });
  assert.equal(session.rewards.sparks[0], original);
  assert.equal(session.rewards.students[0].stars, 1);
  session = r.showLessonCelebration(session, 'celebration', 1001);
  assert.equal(session.rewards.final.config.confettiCount, 0);
  assert.equal(session.rewards.final.config.animation.motionIntensity, 0);
  assert.ok(r.projectLessonRewards(session.rewards, { width: 1280, height: 720 }));
});

test('lesson rewards use active global roster students and default to Class without replacing existing runtime', () => {
  const r = api(), start = createSession();
  const session = r.initializeLessonRewards(start, roster);
  assert.deepEqual(session.rewards.students.map((student: any) => student.id), ['ada', 'grace']);
  assert.equal(session.rewards.activeStudentId, 'ada');
  assert.equal(r.initializeLessonRewards(session, []), session);
  const fallback = r.initializeLessonRewards(start, []);
  assert.equal(fallback.rewards.students[0].name, 'Class');
  assert.equal((start as any).rewards, undefined);
});

test('all four rewards score once per event, and scene changes retain rewards without touching authored content', () => {
  const r = api(); let session = r.initializeLessonRewards(createSession(), roster);
  session = r.selectLessonRewardStudent(session, 'grace');
  for (const [index, variant] of ['gold', 'blue', 'pink', 'crown'].entries()) {
    session = r.awardLessonReward(session, variant, `award-${index}`, 1000 + index);
    assert.equal(r.awardLessonReward(session, variant, `award-${index}`, 2000), session);
  }
  assert.deepEqual(session.rewards.students.map((s: any) => s.stars), [0, 4]);
  assert.deepEqual(['yellowSparks','blueSparks','pinkSparks','crowns'].map(k => session.rewards.students[1][k]), [1,1,1,1]);
  assert.equal(session.rewards.sparks.length, 4);
  const lesson = insertScene(createLesson(), 'activation');
  const moved = navigate(lesson.project, session, { sequence: 'activation', entryId: lesson.entryId });
  assert.equal((moved as any).rewards, session.rewards);
  assert.equal('rewards' in lesson.project, false);
});

test('reset clears only the selected student, retains acceptance ledger, and keeps celebration totals current', () => {
  const r = api(); let session = r.initializeLessonRewards(createSession(), roster);
  session = r.awardLessonReward(session, 'gold', 'one', 1000);
  session = r.selectLessonRewardStudent(session, 'grace'); session = r.awardLessonReward(session, 'blue', 'two', 1001);
  session = r.showLessonCelebration(session, 'show', 2000);
  const finalId = session.rewards.final.id;
  session = r.resetLessonStudentRewards(session, 'reset');
  assert.deepEqual(session.rewards.students.map((s: any) => s.stars), [1,0]);
  assert.deepEqual(session.rewards.final.students.map((s: any) => s.stars), [1,0]);
  assert.equal(session.rewards.final.id, finalId);
  assert.equal(r.resetLessonStudentRewards(session, 'reset'), session);
  assert.equal(r.awardLessonReward(session, 'blue', 'two', 3000), session);
});

test('published reward visuals have stable event IDs and exclude runtime roster/acceptance data', () => {
  const r = api(); let session = r.initializeLessonRewards(createSession(), roster);
  session = r.awardLessonReward(session, 'pink', 'pink-event', 1000);
  session = r.showLessonCelebration(session, 'final-event', 1100);
  const presentation = r.projectLessonRewards(session.rewards, { width: 960, height: 720 });
  assert.ok(parseRewardPresentation(presentation));
  assert.deepEqual(presentation.frame, { width: 960, height: 720 });
  assert.equal(presentation.sparks[0].id, 'pink-event'); assert.equal(presentation.final.id, 'final-event');
  assert.equal('appliedEventIds' in presentation, false); assert.equal('activeStudentId' in presentation, false);
  assert.equal('archived' in presentation.final.students[0], false);
  assert.equal(r.showLessonCelebration(session, 'final-event', 2000), session);
  const hidden = r.hideLessonCelebration(session, 'hide'); assert.equal(hidden.rewards.final, undefined);
  assert.equal(r.hideLessonCelebration(hidden, 'hide'), hidden);
});

test('adding students and expiring visuals preserve scores and deduplication across runtime-only updates', () => {
  const r = api(); let session = r.initializeLessonRewards(createSession(), []);
  session = r.addLessonRewardStudent(session, 'Lin', 'lin');
  assert.equal(session.rewards.activeStudentId, 'lin');
  session = r.awardLessonReward(session, 'crown', 'crown', 1000);
  const pruned = r.pruneLessonRewards(session, 100000);
  assert.equal(pruned.rewards.sparks.length, 0);
  assert.equal(pruned.rewards.students.find((s: any) => s.id === 'lin').stars, 1);
  assert.equal(r.awardLessonReward(pruned, 'crown', 'crown', 100001), pruned);
  assert.equal(r.addLessonRewardStudent(pruned, 'Duplicate', 'lin'), pruned);
});
