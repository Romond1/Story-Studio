import test from 'node:test';
import assert from 'node:assert/strict';
import { RewardResultCore } from './rewardRuntime';
import { normalizeSparkStudent } from './sparkRewards';
import { normalizeRelicSystem } from './relics';

const students = () => [normalizeSparkStudent({ id: 'a', name: 'Ada' }, () => 'a')!];
const relics = (progress = 9) => ({ ...normalizeRelicSystem(undefined), studentProgress: {
  a: { progress, active: true }, b: { progress: 4, active: false },
} });

test('distinct rapid Spark results accumulate while retries never mutate again', () => {
  const core = new RewardResultCore('lesson');
  const first = core.applySpark('lesson', 'one', students(), 'a', 'gold');
  assert.equal(first.accepted, true); assert.equal(first.student?.yellowSparks, 1);
  const second = core.applySpark('lesson', 'two', first.students, 'a', 'gold');
  assert.equal(second.student?.yellowSparks, 2);
  const retry = core.applySpark('lesson', 'one', second.students, 'a', 'gold');
  assert.equal(retry.accepted, false); assert.equal(retry.students, second.students);
  // Visual expiry/undo do not retire result IDs. A retry cannot award again.
  assert.equal(core.applySpark('lesson', 'one', students(), 'a', 'crown').accepted, false);
});

test('invalid or stale Spark commands do not consume the result ID', () => {
  const core = new RewardResultCore('new'); const original = students();
  assert.equal(core.applySpark('old', 'id', original, 'a', 'gold').accepted, false);
  assert.equal(core.applySpark('new', 'id', original, 'missing', 'gold').accepted, false);
  assert.equal(core.applySpark('new', 'id', original, 'a', 'bad' as any).accepted, false);
  const accepted = core.applySpark('new', 'id', original, 'a', 'crown');
  assert.equal(accepted.accepted, true); assert.equal(accepted.student?.crowns, 1);
  assert.equal(accepted.student?.stars, 1); assert.equal(original[0].stars, 0);
  assert.equal(new RewardResultCore('next').applySpark('next', 'id', original, 'a', 'gold').accepted, true);
});

test('Relic mutation and stage classification use the latest accepted progress', () => {
  const core = new RewardResultCore('s');
  const first = core.applyRelic('s', 'one', relics(), ['a'], 'increase');
  assert.equal(first.kind, 'progress'); assert.equal(first.system.studentProgress.a.progress, 10);
  const second = core.applyRelic('s', 'two', first.system, ['a'], 'increase');
  assert.equal(second.kind, 'stage'); assert.equal(second.system.studentProgress.a.progress, 11);
  const retry = core.applyRelic('s', 'two', second.system, ['a'], 'increase');
  assert.equal(retry.accepted, false); assert.equal(retry.kind, null); assert.equal(retry.system, second.system);
  assert.equal(second.system.showOnStage, true);
});

test('Relic stage and completion boundaries preserve distinct clamped commands', () => {
  for (const [progress, expected] of [[0, 'stage'], [10, 'stage'], [20, 'stage'], [29, 'complete'], [30, 'progress']] as const) {
    const core = new RewardResultCore('s');
    const next = core.applyRelic('s', 'one', relics(progress), ['a', 'a'], 'increase');
    assert.equal(next.accepted, true); assert.equal(next.kind, expected);
    assert.equal(next.system.studentProgress.a.progress, Math.min(30, progress + 1));
    assert.equal(core.applyRelic('s', 'two', next.system, ['a'], 'complete').accepted, true);
  }
});

test('Relic targets and scope are checked before consuming IDs; inactive pupils stay unchanged', () => {
  const core = new RewardResultCore('s'); const original = relics();
  for (const ids of [[], ['missing'], ['b']]) assert.equal(core.applyRelic('s', 'id', original, ids, 'increase').accepted, false);
  assert.equal(core.applyRelic('old', 'id', original, ['a'], 'increase').accepted, false);
  assert.equal(core.applyRelic('s', 'id', original, ['a'], 'bad' as any).accepted, false);
  const next = core.applyRelic('s', 'id', original, ['a', 'b', 'missing'], 'reset');
  assert.equal(next.accepted, true); assert.equal(next.system.studentProgress.a.progress, 0);
  assert.equal(next.system.studentProgress.b, original.studentProgress.b);
  assert.equal(original.studentProgress.a.progress, 9);
});
