import test from 'node:test';
import assert from 'node:assert/strict';
import { marqueeIds, translateBoxes, previewDrawings } from './lesson/objectSelection';
import { copyObjects, pasteObjects } from './lesson/objectClipboard';
import { createLesson, createScene, insertScene, addCard, addText } from './lesson/commands';
import { ProjectHistory } from './projectHistory';
import { LESSON_LIMITS } from './lesson/limits';
test('clipboard capacity failure leaves the source and destination unchanged', () => {
  const scene = createScene(); let project = insertScene(createLesson(), 'story', scene).project;
  project = addCard(project, scene.id).project;
  const copied = copyObjects(project, scene.id, project.scenes[scene.id].objects.map(o => o.id));
  const full = { ...project, scenes: { ...project.scenes, [scene.id]: { ...scene, objects: Array.from({ length: LESSON_LIMITS.objectsPerScene }, (_, i) => ({ ...project.scenes[scene.id].objects[0], id: `full-${i}` })) } } };
  const before = JSON.stringify(full);
  assert.throws(() => pasteObjects(full, scene.id, copied), /object limit/);
  assert.equal(JSON.stringify(full), before);
});
test('mixed object clipboard pastes independent Cards atomically and undo removes the whole group', () => {
  const scene = createScene(); let project = insertScene(createLesson(), 'story', scene).project;
  project = addCard(project, scene.id).project; project = addText(project, scene.id, 'text').project;
  const originals = project.scenes[scene.id].objects;
  const history = new ProjectHistory<typeof project>(); history.reset(project);
  const clipboard = copyObjects(project, scene.id, originals.map(o => o.id));
  const result = pasteObjects(project, scene.id, clipboard);
  history.record(result.project);
  assert.equal(result.objectIds.length, 2);
  assert.equal(result.project.scenes[scene.id].objects.length, 4);
  const original = originals[0], pasted = result.project.scenes[scene.id].objects[2];
  assert.equal(original.kind, 'card'); assert.equal(pasted.kind, 'card');
  if (original.kind === 'card' && pasted.kind === 'card') {
    assert.notEqual(original.cardId, pasted.cardId);
    assert.notEqual(project.cards[original.cardId].faces[0].id, result.project.cards[pasted.cardId].faces[0].id);
  }
  assert.equal(history.undo()?.scenes[scene.id].objects.length, 2);
});
test('marquee selects intersecting visible objects in scene coordinates', () => {
  assert.deepEqual(marqueeIds([{ id: 'a', visible: true, box: { x: 30, y: 40, width: 50, height: 40 } }, { id: 'b', visible: false, box: { x: 35, y: 40, width: 10, height: 10 } }], { x: 100, y: 100 }, { x: 50, y: 50 }), ['a']);
});
test('group translation clamps the group as a whole preserving relative offsets', () => {
  assert.deepEqual(translateBoxes([{ id: 'a', box: { x: 10, y: 10, width: 30, height: 20 } }, { id: 'b', box: { x: 60, y: 10, width: 30, height: 20 } }], 50, -50, { width: 100, height: 100 }).map(o => o.box.x), [20, 70]);
});
test('transient ink and erasing project before commit without mutating saved ink', () => {
  const ink = { id: 'ink', points: [{ x: 1, y: 1, t: 1 }], size: 4, color: 'red', opacity: 1, rainbow: false };
  assert.deepEqual(previewDrawings([ink], { erasedIds: ['ink'], stroke: { ...ink, id: 'draft' } }).map(s => s.id), ['draft']);
  assert.equal(ink.id, 'ink'); assert.deepEqual(previewDrawings([ink], null), [ink]);
});
