import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedAdventure, awardSharedPoints, undoSharedPoints, resetSharedAdventure, validateSharedAdventure, projectSharedAdventure } from './sharedAdventure';
import { createLesson } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import { parsePresentSnapshot } from './presentationSnapshot';

test('three students keep individual identities across two devices', () => {
  const group = createSharedAdventure();
  group.preparation.devices = [{id:'italy',name:'Italy'},{id:'japan',name:'Japan'}];
  group.preparation.students.forEach((student, index) => student.deviceId = index < 2 ? 'italy' : 'japan');
  validateSharedAdventure(group);
  const ids = group.preparation.students.map(student => student.id);
  const awarded = awardSharedPoints(group, [ids[0],ids[0],ids[1]], 5);
  assert.deepEqual(ids.map(id => awarded.live.scores[id] ?? 0), [5,5,0]);
  assert.deepEqual(undoSharedPoints(awarded).live.scores, {});
  assert.deepEqual(group.live.scores, {});
});
test('team awards exclude absent members, validate amounts and undo only the latest action', () => {
  const group = createSharedAdventure();
  group.preparation.students[2].participating = false;
  const ids = group.preparation.students.map(student => student.id);
  const one = awardSharedPoints(group, ids, 3);
  const two = awardSharedPoints(one, [ids[0]], 2);
  assert.deepEqual(undoSharedPoints(two), one);
  assert.equal(two.live.scores[ids[2]], undefined);
  for (const points of [0,NaN,Infinity,1.5,1001]) assert.throws(() => awardSharedPoints(group, ids, points));
  assert.throws(() => awardSharedPoints(group, ['unknown'], 2));
});
test('reset keeps preparation and clears all live progress', () => {
  const group = awardSharedPoints(createSharedAdventure(), ['student-1'], 5);
  group.live.completedObjectiveIds = [group.preparation.objectives[0].id];
  const reset = resetSharedAdventure(group);
  assert.deepEqual(reset.preparation, group.preparation);
  assert.deepEqual(reset.live.scores, {});
  assert.deepEqual(reset.live.completedObjectiveIds, []);
  assert.equal(reset.live.scoreboard, false);
});
test('group scene lessons round trip and reject invalid preparation/live state', () => {
  const project = {...createLesson(), sharedAdventure:createSharedAdventure()};
  assert.deepEqual(parseLessonProject(JSON.parse(JSON.stringify(project))).sharedAdventure, project.sharedAdventure);
  const bad = structuredClone(project);
  bad.sharedAdventure.preparation.students[0].deviceId = 'missing';
  assert.throws(() => parseLessonProject(bad));
  const badScore = structuredClone(project);
  badScore.sharedAdventure.live.scores['unknown'] = 4;
  assert.throws(() => parseLessonProject(badScore));
  const badHistory = structuredClone(project);
  badHistory.sharedAdventure.live.awards = [{studentIds:['student-1'],points:NaN}];
  assert.throws(() => parseLessonProject(badHistory));
});
test('public projection preserves hidden clue isolation and uses existing Presenter contract', () => {
  const group = createSharedAdventure();
  group.preparation.prompt = 'Secret teacher-selected prompt';
  group.preparation.students[0].deviceId = 'private-device';
  group.preparation.devices = [{id:'private-device',name:'Private location'}];
  group.live.scoreboard = true;
  group.live.revealed = false;
  let plan = projectSharedAdventure(group, () => 'media://scoped/test/image');
  assert.equal(JSON.stringify(plan).includes('Secret teacher-selected prompt'), false);
  assert.equal(JSON.stringify(plan).includes('private-device'), false);
  assert.equal(JSON.stringify(plan).includes('Private location'), false);
  assert.ok(parsePresentSnapshot({sessionId:'group',revision:1,target:{kind:'scene',occurrenceId:'group',plan}}));
  group.live.revealed = true;
  plan = projectSharedAdventure(group, () => undefined);
  assert.equal(JSON.stringify(plan).includes(group.preparation.prompt), true);
});
