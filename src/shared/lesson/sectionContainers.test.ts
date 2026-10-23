import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, insertScene } from './commands';
import { addSection, moveEntryToSection, moveSection, insertSectionMedia, timelineGroups, timelineGroupBoundary, moveTimelineEntries } from './sections';

test('media enters explicit empty Section 2 and the whole section moves before Section 1', () => {
  const one = addSection(createLesson(), 'story', 'Section 1');
  const two = addSection(one.project, 'story', 'Section 2');
  const scene = insertScene(two.project, 'story');
  let p = moveEntryToSection(scene.project, 'story', scene.entryId, one.sectionId);
  p.assets = [{ id: 'image', filename: 'image.png', originalName: 'Image', relativePath: 'media/image.png', mediaType: 'image', mimeType: 'image/png', sizeBytes: 1, importedAt: new Date().toISOString() } as typeof p.assets[number]];
  const result = insertSectionMedia(p, 'story', ['image', 'image'], two.sectionId);
  assert.equal(result.entryIds.length, 2);
  assert.ok(result.entryIds.every(id => result.project.sequences.story.find(e => e.id === id)?.sectionId === two.sectionId));
  const moved = moveSection(result.project, 'story', two.sectionId, one.sectionId);
  assert.deepEqual(moved.sequences.story.map(e => e.id), [...result.entryIds, scene.entryId]);
  assert.equal(moved.scenes, result.project.scenes);
  assert.deepEqual(timelineGroups(moved, 'story').map(g => g.sectionId), [two.sectionId, one.sectionId, undefined]);
});

test('moving a section preserves ungrouped order and rejects cross-sequence target', () => {
  const a = insertScene(createLesson(), 'story'), b = insertScene(a.project, 'story');
  const section = addSection(b.project, 'story', 'Empty');
  const other = addSection(section.project, 'activation', 'Other');
  assert.throws(() => moveSection(other.project, 'story', section.sectionId, other.sectionId));
  const moved = moveSection(other.project, 'story', section.sectionId);
  assert.deepEqual(moved.sequences.story.map(e => e.id), [a.entryId, b.entryId]);
});

test('inserting into an empty section before a populated one respects container order', () => {
  const a = addSection(createLesson(), 'story', 'First'), b = addSection(a.project, 'story', 'Second');
  const s = insertScene(b.project, 'story');
  let p = moveEntryToSection(s.project, 'story', s.entryId, b.sectionId);
  const blank = insertSectionMedia(p, 'story', [], a.sectionId);
  assert.equal(blank.project.sequences.story[0].id, blank.entryIds[0]);
});

test('moving a scene into an empty section uses the same order as direct media insertion', () => {
  const first = addSection(createLesson(), 'story', 'First'), second = addSection(first.project, 'story', 'Second');
  const a = insertSectionMedia(second.project, 'story', [], second.sectionId);
  const b = insertSectionMedia(a.project, 'story', [], second.sectionId);
  const moved = moveEntryToSection(b.project, 'story', b.entryIds[0], first.sectionId);
  assert.deepEqual(moved.sequences.story.map(e => e.id), [b.entryIds[0], a.entryIds[0]]);
  assert.equal(moved.sequences.story[0].sectionId, first.sectionId);
  assert.equal(timelineGroups(moved, 'story').slice(-1)[0]?.sectionId, undefined);
});

test('invalid audio or stale target rejects the whole media drop without partial mutation', () => {
  const section = addSection(createLesson(), 'story', 'Section');
  const original = structuredClone(section.project);
  assert.throws(() => insertSectionMedia(section.project, 'story', ['missing'], section.sectionId));
  assert.throws(() => insertSectionMedia(section.project, 'story', [], 'missing-section'));
  assert.deepEqual(section.project, original);
});

test('drop/add and scene movement append to the targeted ungrouped run, not the final run', () => {
  const section = addSection(createLesson(), 'story', 'Middle');
  const a = insertSectionMedia(section.project, 'story', []), b = insertSectionMedia(a.project, 'story', [], section.sectionId);
  const c = insertScene(b.project, 'story');
  const groups = timelineGroups(c.project, 'story');
  const boundary = timelineGroupBoundary(c.project, 'story', groups[0]);
  const added = insertSectionMedia(c.project, 'story', [], undefined, boundary);
  assert.deepEqual(added.project.sequences.story.map(e => e.id), [a.entryIds[0], added.entryIds[0], b.entryIds[0], c.entryId]);
  const moved = moveEntryToSection(c.project, 'story', c.entryId, undefined, boundary);
  assert.deepEqual(moved.sequences.story.map(e => e.id), [a.entryIds[0], c.entryId, b.entryIds[0]]);
  const sectionMoved = moveSection(c.project, 'story', section.sectionId, undefined, a.entryIds[0]);
  assert.deepEqual(sectionMoved.sequences.story.map(e => e.id), [b.entryIds[0], a.entryIds[0], c.entryId]);
});

test('cut across sequences retains occurrence, Break metadata, scene links and card definitions', () => {
  const source = insertScene(createLesson(), 'story');
  source.project.sequences.story[0].kind = 'break';
  const linked = insertScene(source.project, 'story', source.project.scenes[source.project.sequences.story[0].sceneId]);
  const section = addSection(linked.project, 'activation', 'Practice');
  const moved = moveTimelineEntries(section.project, 'story', 'activation', [source.entryId], section.sectionId);
  assert.equal(moved.sequences.activation[0].id, source.entryId);
  assert.equal(moved.sequences.activation[0].sceneId, moved.sequences.story[0].sceneId);
  assert.equal(moved.sequences.activation[0].kind, 'break');
  assert.equal(moved.sequences.activation[0].sectionId, undefined);
  assert.equal(moved.scenes, section.project.scenes);
  assert.equal(moved.cards, section.project.cards);
  assert.equal(moveTimelineEntries(moved, 'story', 'activation', [source.entryId]), moved);
});
