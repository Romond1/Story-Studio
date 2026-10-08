import test from 'node:test';
import assert from 'node:assert/strict';
import * as commands from './lesson/commands';
import type { LessonProject, Rect } from './lesson/model';
import { parseLessonProject } from './lesson/validation';

function insert(project: LessonProject, sceneId: string, setId: string) {
  return commands.insertCardSet(project, sceneId, setId);
}
function fixture(count: number, width = 1280, height = 720, sequence: 'story' | 'activation' = 'story') {
  const scene = { ...commands.createScene(), frame: { width, height } };
  const inserted = commands.insertScene(commands.createLesson(), sequence, scene);
  const card = commands.createCard();
  const project: LessonProject = { ...inserted.project, cards: { [card.id]: card }, library: [card.id], cardSets: [{ id: 'set', label: 'Practice', tags: [], entries: Array.from({ length: count }, (_, index) => ({ id: `entry-${index}`, cardId: card.id })) }] };
  return { project, scene, card };
}
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width - .001 && b.x < a.x + a.width - .001 && a.y < b.y + b.height - .001 && b.y < a.y + a.height - .001;

test('Story and Activation insert Card Sets as independent visible placements with stable face IDs', () => {
  for (const sequence of ['story', 'activation'] as const) {
    const f = fixture(3, 1280, 720, sequence), result = insert(f.project, f.scene.id, 'set');
    assert.equal(result.objectIds.length, 3);
    assert.equal(new Set(result.objectIds).size, 3);
    const objects = result.project.scenes[f.scene.id].objects;
    const cardIds: string[] = [];
    for (const object of objects) {
      assert.equal(object.kind, 'card'); if (object.kind !== 'card') continue;
      cardIds.push(object.cardId); assert.notEqual(object.cardId, f.card.id);
      assert.equal(object.initiallyConcealed, false); assert.equal(object.interaction, 'cycle');
      const card = result.project.cards[object.cardId];
      assert.equal(object.initialFaceId, card.faces[0].id); assert.notEqual(card.faces[0].id, f.card.faces[0].id);
      assert.deepEqual(card.faces.map(face => face.text), f.card.faces.map(face => face.text));
    }
    assert.equal(new Set(cardIds).size, 3);
    assert.equal(f.project.scenes[f.scene.id].objects.length, 0);
    assert.equal(result.project.cards[f.card.id], f.card);
    assert.equal(result.project.cardSets, f.project.cardSets);
    assert.equal(parseLessonProject(result.project).sequences[sequence].length, 1);
  }
});

test('Card Set grids fit landscape, portrait and dense minimum-size scenes without overlapping each other', () => {
  for (const [count, width, height] of [[7,1280,720], [7,720,1280], [100,240,240]]) {
    const f = fixture(count, width, height), result = insert(f.project, f.scene.id, 'set');
    const boxes = result.project.scenes[f.scene.id].objects.map(object => object.box);
    assert.equal(boxes.length, count);
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]; assert.ok(box.x >= 0 && box.y >= 0 && box.width >= 24 && box.height >= 24);
      assert.ok(box.x + box.width <= width + .001 && box.y + box.height <= height + .001);
      for (let j = i + 1; j < boxes.length; j++) assert.equal(overlaps(box, boxes[j]), false, `Cards ${i} and ${j} must not overlap`);
    }
    assert.ok(parseLessonProject(result.project));
  }
});

test('Card Set insertion preserves existing objects and rejects invalid references before creating content', () => {
  const f = fixture(2), existing = commands.addText(f.project, f.scene.id, 'bubble').project;
  const previous = existing.scenes[f.scene.id].objects[0];
  const result = insert(existing, f.scene.id, 'set');
  assert.equal(result.project.scenes[f.scene.id].objects[0], previous);
  assert.throws(() => insert(f.project, 'missing-scene', 'set'), /scene/i);
  assert.throws(() => insert(f.project, f.scene.id, 'missing-set'), /set/i);
  assert.throws(() => insert({ ...f.project, cards: {} }, f.scene.id, 'set'), /card/i);
  assert.equal(Object.keys(f.project.cards).length, 1);
});

test('empty Sets are a no-op and scene capacity is checked before inserting any Cards', () => {
  const empty = fixture(0); assert.equal(insert(empty.project, empty.scene.id, 'set').project, empty.project);
  const full = fixture(100); let project = full.project;
  for (let i = 0; i < 101; i++) project = commands.addText(project, full.scene.id, 'text').project;
  assert.throws(() => insert(project, full.scene.id, 'set'), /200 objects/i);
  assert.equal(project.scenes[full.scene.id].objects.length, 101);
  assert.equal(Object.keys(project.cards).length, 1);
});
