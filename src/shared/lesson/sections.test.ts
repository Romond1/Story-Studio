import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, insertScene, addText, addCard } from './commands';
import { addSection, moveEntryToSection, insertBreak, renameSection } from './sections';
import { copyCardSnapshot, pasteCard, moveCardToScene } from './cardClipboard';
import { parseLessonProject } from './validation';

test('legacy labels migrate to stable sequence sections and roundtrip', () => {
  const a = insertScene(createLesson(), 'story'); a.project.sequences.story[0].section = 'Warmup';
  const p = parseLessonProject(a.project);
  assert.equal(p.sections?.[0].name, 'Warmup');
  assert.equal(p.sequences.story[0].sectionId, p.sections?.[0].id);
  assert.deepEqual(parseLessonProject(p), p);
});
test('migration preserves disjoint group order and scene audio without adding section audio', () => {
  let p = createLesson();
  for (const label of ['A', '', 'A']) { const added = insertScene(p, 'story'); p = added.project; p.sequences.story[p.sequences.story.length - 1].section = label; }
  const order = p.sequences.story.map(e => e.id), scenes = JSON.stringify(p.scenes);
  const migrated = parseLessonProject(p);
  assert.deepEqual(migrated.sequences.story.map(e => e.id), order);
  assert.equal(JSON.stringify(migrated.scenes), scenes);
  assert.equal(migrated.sections!.length, 2);
  assert.notEqual(migrated.sequences.story[0].sectionId, migrated.sequences.story[2].sectionId);
});
test('empty sections, membership ordering, rename and editable Breaks', () => {
  const a = insertScene(createLesson(), 'story'), b = insertScene(a.project, 'story');
  const section = addSection(b.project, 'story', 'Practice');
  let p = moveEntryToSection(section.project, 'story', b.entryId, section.sectionId);
  p = moveEntryToSection(p, 'story', a.entryId, section.sectionId, b.entryId);
  assert.deepEqual(p.sequences.story.map(e => e.id), [a.entryId, b.entryId]);
  p = renameSection(p, section.sectionId, 'Together');
  const pause = insertBreak(p, 'story', undefined, section.sectionId);
  p = addText(pause.project, pause.project.sequences.story.find(e => e.id === pause.entryId)!.sceneId, 'bubble').project;
  assert.equal(p.sequences.story.find(e => e.id === pause.entryId)!.kind, 'break');
  p = moveEntryToSection(p, 'story', a.entryId, undefined);
  assert.equal(p.sequences.story.find(e => e.id === a.entryId)!.sectionId, undefined);
  assert.equal(parseLessonProject(p).sections?.[0].name, 'Together');
});
test('cross phase paste snapshots content and placement independently; move only deletes after success', () => {
  const a = insertScene(createLesson(), 'story'), b = insertScene(a.project, 'activation');
  const source = a.project.sequences.story[0].sceneId, destination = b.project.sequences.activation[0].sceneId;
  const added = addCard(b.project, source), snapshot = copyCardSnapshot(added.project, source, added.objectId)!;
  const result = pasteCard(added.project, { sequence: 'activation', entryId: b.entryId }, snapshot);
  const placed = result.project.scenes[destination].objects[0];
  assert.equal(result.project.scenes[source].objects.length, 1);
  assert.ok(placed.kind === 'card' && placed.cardId !== snapshot.card.id);
  if (placed.kind === 'card') {
    result.project.cards[placed.cardId].faces[0].text = 'Edited destination';
    assert.notEqual(result.project.cards[snapshot.card.id].faces[0].text, 'Edited destination');
  }
  assert.equal(result.selection.entryId, b.entryId);
  assert.deepEqual(placed.box, snapshot.object.box);
  assert.throws(() => moveCardToScene(added.project, source, added.objectId, { sequence: 'activation', entryId: 'missing' }));
  assert.equal(added.project.scenes[source].objects.length, 1);
  const moved = moveCardToScene(added.project, source, added.objectId, { sequence: 'activation', entryId: b.entryId });
  assert.equal(moved.project.scenes[source].objects.length, 0);
  assert.equal(moved.project.scenes[destination].objects.length, 1);
});

