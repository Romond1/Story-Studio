import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCard, addText, copyScene, createLesson, createScene, duplicateObject, insertScene, putObject, removeObject, reorderEntry } from './commands';
import { cardAction, createSession, exitActivation, navigate, reconcileSession, startActivation } from './session';
import { parseLessonProject } from './validation';
import { ProjectHistory } from '../projectHistory';
import { sceneAt } from './model';
import { moveLiveCard, resetScene, setLiveDrawings, undoLiveDrawing, redoLiveDrawing } from './session';

test('live card movement validates geometry and resets to authored defaults', () => {
  const first = insertScene(createLesson(), 'story'), sceneId = first.project.sequences.story[0].sceneId;
  const added = addCard(first.project, sceneId), withText = addText(added.project, sceneId, 'text');
  const project = withText.project, authored = JSON.stringify(project);
  let live = navigate(project, createSession(), { sequence: 'story', entryId: first.entryId });
  assert.equal(moveLiveCard(project, live, withText.objectId, { x: 2, y: 2, width: 40, height: 40 }), live);
  assert.equal(moveLiveCard(project, live, added.objectId, { x: NaN, y: 2, width: 40, height: 40 }), live);
  live = moveLiveCard(project, live, added.objectId, { x: -100, y: 9999, width: 9999, height: 100 });
  assert.deepEqual(live.cards[added.objectId].box, { x: 0, y: 620, width: 1280, height: 100 });
  live = navigate(project, navigate(project, live, null), { sequence: 'story', entryId: first.entryId });
  assert.equal(live.cards[added.objectId].box!.y, 620);
  live = resetScene(project, live);
  assert.deepEqual(live.cards, {});
  assert.deepEqual(live.drawings, []);
  assert.deepEqual(navigate(project, live, live.cursor).cards, {});
  assert.equal(JSON.stringify(project), authored);
});

test('drawing undo and redo remain independent across scene occurrences', () => {
  const first = insertScene(createLesson(), 'story'), second = insertScene(first.project, 'story');
  const a = { sequence: 'story' as const, entryId: first.entryId }, b = { sequence: 'story' as const, entryId: second.entryId };
  const ink = [{ id: 'ink', color: '#fff', size: 3, opacity: 1, rainbow: false, points: [] }];
  let live = setLiveDrawings(navigate(second.project, createSession(), a), ink);
  live = undoLiveDrawing(live); assert.deepEqual(live.drawings, []);
  live = navigate(second.project, live, b); assert.equal(redoLiveDrawing(live), live);
  live = redoLiveDrawing(navigate(second.project, live, a)); assert.deepEqual(live.drawings, ink);
  live = setLiveDrawings(undoLiveDrawing(live), []); assert.equal(redoLiveDrawing(live).drawings.length, 1);
  live = setLiveDrawings(live, [{ ...ink[0], id: 'replacement' }]); assert.equal(redoLiveDrawing(live), live);
});

test('reconciliation removes stale cached entries and repairs cached cards after deletion', () => {
  const first = insertScene(createLesson(), 'story'), sceneId = first.project.sequences.story[0].sceneId;
  const added = addCard(first.project, sceneId), second = insertScene(added.project, 'story');
  const a = { sequence: 'story' as const, entryId: first.entryId }, b = { sequence: 'story' as const, entryId: second.entryId };
  let live = cardAction(second.project, navigate(second.project, createSession(), a), added.objectId, 'next');
  live = navigate(second.project, live, b);
  const deleted = removeObject(second.project, sceneId, added.objectId);
  live = reconcileSession(deleted, live);
  assert.deepEqual(navigate(deleted, live, a).cards, {});
  const removed = { ...deleted, sequences: { ...deleted.sequences, story: deleted.sequences.story.slice(1) } };
  live = reconcileSession(removed, live);
  assert.equal(Object.keys(live.scenes ?? {}).length, 0);
});

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
test('runtime faces are stable IDs, preserved per visit, reconcile deletion; return survives reorder', () => {
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
  assert.deepEqual(startActivation(reordered, returned).cards, live.cards);
  const deleted = removeObject(added.project, sceneId, added.objectId);
  assert.deepEqual(reconcileSession(deleted, live).cards, {});
});

test('linked occurrences keep independent live drawings and viewport without sharing authored references', () => {
  const first = insertScene(createLesson(), 'story');
  const linked = copyScene(first.project, first.project.sequences.story[0].sceneId, 'activation', true);
  const a = { sequence: 'story' as const, entryId: first.entryId }, b = { sequence: 'activation' as const, entryId: linked.entryId };
  let live = navigate(linked.project, createSession(), a);
  live.viewport.pan.x = 77;
  live.drawings.push({ id: 'ink', color: '#fff', size: 3, opacity: 1, rainbow: false, points: [] });
  assert.equal(sceneAt(linked.project, a)!.viewport.pan.x, 0);
  live = navigate(linked.project, live, b);
  assert.equal(live.drawings.length, 0);
  assert.equal(live.viewport.pan.x, 0);
  live = navigate(linked.project, live, a);
  assert.equal(live.drawings[0].id, 'ink');
  assert.equal(live.viewport.pan.x, 77);
  assert.deepEqual(navigate(linked.project, createSession(), a).drawings, []);
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
