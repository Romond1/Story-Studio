import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCard, addText, copyScene, createLesson, createScene, duplicateObject, insertScene, putObject, removeObject, reorderEntry } from './commands';
import { cardAction, createSession, exitActivation, navigate, reconcileSession, startActivation } from './session';
import { parseLessonProject } from './validation';
import { ProjectHistory } from '../projectHistory';
import { sceneAt } from './model';

test('Story and Activation share direct authoring, ownership, duplicate and geometry commands', () => {
  for (const sequence of ['story','activation'] as const) {
    const inserted = insertScene(createLesson(), sequence), sceneId = inserted.project.sequences[sequence][0].sceneId;
    const added = addCard(inserted.project, sceneId), object = added.project.scenes[sceneId].objects[0];
    assert.equal(object.kind, 'card'); assert.equal(added.project.cardSets.length, 0);
    const moved = putObject(added.project, sceneId, { ...object, box: { x: 500, y: 250, width: 420, height: 300 } });
    assert.deepEqual(moved.scenes[sceneId].objects[0].box, { x: 500, y: 250, width: 420, height: 300 });
    const duplicated = duplicateObject(moved, sceneId, object.id), cards = duplicated.project.scenes[sceneId].objects;
    assert.equal(cards.length, 2); assert.notEqual(cards[0].id, cards[1].id);
    assert.ok(cards[0].kind === 'card' && cards[1].kind === 'card' && cards[0].cardId !== cards[1].cardId);
    const deleted = removeObject(duplicated.project, sceneId, object.id);
    assert.equal(deleted.scenes[sceneId].objects.length, 1); assert.equal(Object.keys(deleted.cards).length, 2);
    const bubbled = addText(deleted, sceneId, 'bubble').project;
    assert.equal(parseLessonProject(JSON.parse(JSON.stringify(bubbled))).scenes[sceneId].objects[1].kind, 'bubble');
  }
});
test('linked scene reuse and independent copies are explicit; deleting copy never changes original', () => {
  const first = insertScene(createLesson(), 'story'), sceneId = first.project.sequences.story[0].sceneId;
  const card = addCard(first.project, sceneId);
  const linked = copyScene(card.project, sceneId, 'activation', true);
  const copied = copyScene(linked.project, sceneId, 'activation', false);
  const independent = sceneAt(copied.project, { sequence: 'activation', entryId: copied.entryId })!;
  assert.notEqual(independent.id, sceneId);
  const removed = removeObject(copied.project, independent.id, independent.objects[0].id);
  assert.equal(removed.scenes[sceneId].objects.length, 1);
  assert.equal(sceneAt(removed, { sequence: 'activation', entryId: linked.entryId })!.id, sceneId);
});
test('runtime faces are stable IDs, reset per visit, reconcile deletion; return survives reorder', () => {
  const first = insertScene(createLesson(), 'story'), second = insertScene(first.project, 'story');
  const activity = insertScene(second.project, 'activation'), sceneId = activity.project.sequences.activation[0].sceneId;
  const added = addCard(activity.project, sceneId);
  let live = navigate(added.project, createSession(), { sequence: 'story', entryId: second.entryId });
  live = startActivation(added.project, live);
  live = cardAction(added.project, live, added.objectId, 'next');
  const card = added.project.scenes[sceneId].objects[0]; assert.ok(card.kind === 'card');
  assert.equal(live.cards[added.objectId].faceId, added.project.cards[card.cardId].faces[1].id);
  const reordered = reorderEntry(added.project, 'story', second.entryId, first.entryId);
  const returned = exitActivation(reordered, live); assert.equal(returned.cursor!.entryId, second.entryId);
  assert.deepEqual(startActivation(reordered, returned).cards, {});
  const deleted = removeObject(added.project, sceneId, added.objectId);
  assert.deepEqual(reconcileSession(deleted, live).cards, {});
});
test('history tracks deletion and saved revision without affecting independent live navigation', () => {
  const first = insertScene(createLesson(), 'story'); const sceneId = first.project.sequences.story[0].sceneId;
  const added = addCard(first.project, sceneId); const history = new ProjectHistory<typeof added.project>();
  history.reset(added.project); const live = navigate(added.project, createSession(), { sequence: 'story', entryId: first.entryId });
  history.record(removeObject(added.project, sceneId, added.objectId)); assert.equal(history.isDirty, true);
  assert.equal(history.undo(), added.project); assert.equal(history.isDirty, false);
  assert.equal(history.redo()!.scenes[sceneId].objects.length, 0); assert.equal(live.cursor!.entryId, first.entryId);
});
test('format validation rejects legacy, broken references and invalid geometry', () => {
  assert.throws(() => parseLessonProject({ version: 4, slides: [], assets: [] }));
  const project = insertScene(createLesson(), 'story', createScene()).project;
  const sceneId = project.sequences.story[0].sceneId; const added = addCard(project, sceneId).project;
  const invalid = JSON.parse(JSON.stringify(added)); invalid.scenes[sceneId].objects[0].box.width = Infinity;
  assert.throws(() => parseLessonProject(invalid));
  delete invalid.cards[Object.keys(invalid.cards)[0]]; assert.throws(() => parseLessonProject(invalid));
  assert.deepEqual(parseLessonProject(added), added);
});
