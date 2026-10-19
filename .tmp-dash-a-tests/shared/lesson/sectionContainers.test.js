"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const commands_1 = require("./commands");
const sections_1 = require("./sections");
(0, node_test_1.test)('media enters explicit empty Section 2 and the whole section moves before Section 1', () => {
    const one = (0, sections_1.addSection)((0, commands_1.createLesson)(), 'story', 'Section 1');
    const two = (0, sections_1.addSection)(one.project, 'story', 'Section 2');
    const scene = (0, commands_1.insertScene)(two.project, 'story');
    let p = (0, sections_1.moveEntryToSection)(scene.project, 'story', scene.entryId, one.sectionId);
    p.assets = [{ id: 'image', filename: 'image.png', originalName: 'Image', relativePath: 'media/image.png', mediaType: 'image', mimeType: 'image/png', sizeBytes: 1, importedAt: new Date().toISOString() }];
    const result = (0, sections_1.insertSectionMedia)(p, 'story', ['image', 'image'], two.sectionId);
    strict_1.default.equal(result.entryIds.length, 2);
    strict_1.default.ok(result.entryIds.every(id => result.project.sequences.story.find(e => e.id === id)?.sectionId === two.sectionId));
    const moved = (0, sections_1.moveSection)(result.project, 'story', two.sectionId, one.sectionId);
    strict_1.default.deepEqual(moved.sequences.story.map(e => e.id), [...result.entryIds, scene.entryId]);
    strict_1.default.equal(moved.scenes, result.project.scenes);
    strict_1.default.deepEqual((0, sections_1.timelineGroups)(moved, 'story').map(g => g.sectionId), [two.sectionId, one.sectionId, undefined]);
});
(0, node_test_1.test)('moving a section preserves ungrouped order and rejects cross-sequence target', () => {
    const a = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), b = (0, commands_1.insertScene)(a.project, 'story');
    const section = (0, sections_1.addSection)(b.project, 'story', 'Empty');
    const other = (0, sections_1.addSection)(section.project, 'activation', 'Other');
    strict_1.default.throws(() => (0, sections_1.moveSection)(other.project, 'story', section.sectionId, other.sectionId));
    const moved = (0, sections_1.moveSection)(other.project, 'story', section.sectionId);
    strict_1.default.deepEqual(moved.sequences.story.map(e => e.id), [a.entryId, b.entryId]);
});
(0, node_test_1.test)('inserting into an empty section before a populated one respects container order', () => {
    const a = (0, sections_1.addSection)((0, commands_1.createLesson)(), 'story', 'First'), b = (0, sections_1.addSection)(a.project, 'story', 'Second');
    const s = (0, commands_1.insertScene)(b.project, 'story');
    let p = (0, sections_1.moveEntryToSection)(s.project, 'story', s.entryId, b.sectionId);
    const blank = (0, sections_1.insertSectionMedia)(p, 'story', [], a.sectionId);
    strict_1.default.equal(blank.project.sequences.story[0].id, blank.entryIds[0]);
});
(0, node_test_1.test)('moving a scene into an empty section uses the same order as direct media insertion', () => {
    const first = (0, sections_1.addSection)((0, commands_1.createLesson)(), 'story', 'First'), second = (0, sections_1.addSection)(first.project, 'story', 'Second');
    const a = (0, sections_1.insertSectionMedia)(second.project, 'story', [], second.sectionId);
    const b = (0, sections_1.insertSectionMedia)(a.project, 'story', [], second.sectionId);
    const moved = (0, sections_1.moveEntryToSection)(b.project, 'story', b.entryIds[0], first.sectionId);
    strict_1.default.deepEqual(moved.sequences.story.map(e => e.id), [b.entryIds[0], a.entryIds[0]]);
    strict_1.default.equal(moved.sequences.story[0].sectionId, first.sectionId);
    strict_1.default.equal((0, sections_1.timelineGroups)(moved, 'story').slice(-1)[0]?.sectionId, undefined);
});
(0, node_test_1.test)('invalid audio or stale target rejects the whole media drop without partial mutation', () => {
    const section = (0, sections_1.addSection)((0, commands_1.createLesson)(), 'story', 'Section');
    const original = structuredClone(section.project);
    strict_1.default.throws(() => (0, sections_1.insertSectionMedia)(section.project, 'story', ['missing'], section.sectionId));
    strict_1.default.throws(() => (0, sections_1.insertSectionMedia)(section.project, 'story', [], 'missing-section'));
    strict_1.default.deepEqual(section.project, original);
});
(0, node_test_1.test)('drop/add and scene movement append to the targeted ungrouped run, not the final run', () => {
    const section = (0, sections_1.addSection)((0, commands_1.createLesson)(), 'story', 'Middle');
    const a = (0, sections_1.insertSectionMedia)(section.project, 'story', []), b = (0, sections_1.insertSectionMedia)(a.project, 'story', [], section.sectionId);
    const c = (0, commands_1.insertScene)(b.project, 'story');
    const groups = (0, sections_1.timelineGroups)(c.project, 'story');
    const boundary = (0, sections_1.timelineGroupBoundary)(c.project, 'story', groups[0]);
    const added = (0, sections_1.insertSectionMedia)(c.project, 'story', [], undefined, boundary);
    strict_1.default.deepEqual(added.project.sequences.story.map(e => e.id), [a.entryIds[0], added.entryIds[0], b.entryIds[0], c.entryId]);
    const moved = (0, sections_1.moveEntryToSection)(c.project, 'story', c.entryId, undefined, boundary);
    strict_1.default.deepEqual(moved.sequences.story.map(e => e.id), [a.entryIds[0], c.entryId, b.entryIds[0]]);
    const sectionMoved = (0, sections_1.moveSection)(c.project, 'story', section.sectionId, undefined, a.entryIds[0]);
    strict_1.default.deepEqual(sectionMoved.sequences.story.map(e => e.id), [b.entryIds[0], a.entryIds[0], c.entryId]);
});
(0, node_test_1.test)('cut across sequences retains occurrence, Break metadata, scene links and card definitions', () => {
    const source = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story');
    source.project.sequences.story[0].kind = 'break';
    const linked = (0, commands_1.insertScene)(source.project, 'story', source.project.scenes[source.project.sequences.story[0].sceneId]);
    const section = (0, sections_1.addSection)(linked.project, 'activation', 'Practice');
    const moved = (0, sections_1.moveTimelineEntries)(section.project, 'story', 'activation', [source.entryId], section.sectionId);
    strict_1.default.equal(moved.sequences.activation[0].id, source.entryId);
    strict_1.default.equal(moved.sequences.activation[0].sceneId, moved.sequences.story[0].sceneId);
    strict_1.default.equal(moved.sequences.activation[0].kind, 'break');
    strict_1.default.equal(moved.sequences.activation[0].sectionId, section.sectionId);
    strict_1.default.equal(moved.scenes, section.project.scenes);
    strict_1.default.equal(moved.cards, section.project.cards);
    strict_1.default.equal((0, sections_1.moveTimelineEntries)(moved, 'story', 'activation', [source.entryId]), moved);
});
