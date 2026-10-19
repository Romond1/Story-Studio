"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const commands_1 = require("./commands");
const limits_1 = require("./limits");
const sections_1 = require("./sections");
const cardClipboard_1 = require("./cardClipboard");
const validation_1 = require("./validation");
(0, node_test_1.test)('legacy labels migrate to stable sequence sections and roundtrip', () => {
    const a = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story');
    a.project.sequences.story[0].section = 'Warmup';
    const p = (0, validation_1.parseLessonProject)(a.project);
    strict_1.default.equal(p.sections?.[0].name, 'Warmup');
    strict_1.default.equal(p.sequences.story[0].sectionId, p.sections?.[0].id);
    strict_1.default.deepEqual((0, validation_1.parseLessonProject)(p), p);
});
(0, node_test_1.test)('migration preserves disjoint group order and scene audio without adding section audio', () => {
    let p = (0, commands_1.createLesson)();
    for (const label of ['A', '', 'A']) {
        const added = (0, commands_1.insertScene)(p, 'story');
        p = added.project;
        p.sequences.story[p.sequences.story.length - 1].section = label;
    }
    const order = p.sequences.story.map(e => e.id), scenes = JSON.stringify(p.scenes);
    const migrated = (0, validation_1.parseLessonProject)(p);
    strict_1.default.deepEqual(migrated.sequences.story.map(e => e.id), order);
    strict_1.default.equal(JSON.stringify(migrated.scenes), scenes);
    strict_1.default.equal(migrated.sections.length, 2);
    strict_1.default.notEqual(migrated.sequences.story[0].sectionId, migrated.sequences.story[2].sectionId);
});
(0, node_test_1.test)('empty sections, membership ordering, rename and editable Breaks', () => {
    const a = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), b = (0, commands_1.insertScene)(a.project, 'story');
    const section = (0, sections_1.addSection)(b.project, 'story', 'Practice');
    let p = (0, sections_1.moveEntryToSection)(section.project, 'story', b.entryId, section.sectionId);
    p = (0, sections_1.moveEntryToSection)(p, 'story', a.entryId, section.sectionId, b.entryId);
    strict_1.default.deepEqual(p.sequences.story.map(e => e.id), [a.entryId, b.entryId]);
    p = (0, sections_1.renameSection)(p, section.sectionId, 'Together');
    const pause = (0, sections_1.insertBreak)(p, 'story', undefined, section.sectionId);
    p = (0, commands_1.addText)(pause.project, pause.project.sequences.story.find(e => e.id === pause.entryId).sceneId, 'bubble').project;
    strict_1.default.equal(p.sequences.story.find(e => e.id === pause.entryId).kind, 'break');
    p = (0, sections_1.moveEntryToSection)(p, 'story', a.entryId, undefined);
    strict_1.default.equal(p.sequences.story.find(e => e.id === a.entryId).sectionId, undefined);
    strict_1.default.equal((0, validation_1.parseLessonProject)(p).sections?.[0].name, 'Together');
});
(0, node_test_1.test)('cross phase paste snapshots content and placement independently; move only deletes after success', () => {
    const a = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), b = (0, commands_1.insertScene)(a.project, 'activation');
    const source = a.project.sequences.story[0].sceneId, destination = b.project.sequences.activation[0].sceneId;
    const added = (0, commands_1.addCard)(b.project, source), snapshot = (0, cardClipboard_1.copyCardSnapshot)(added.project, source, added.objectId);
    const result = (0, cardClipboard_1.pasteCard)(added.project, { sequence: 'activation', entryId: b.entryId }, snapshot);
    const placed = result.project.scenes[destination].objects[0];
    strict_1.default.equal(result.project.scenes[source].objects.length, 1);
    strict_1.default.ok(placed.kind === 'card' && placed.cardId !== snapshot.card.id);
    if (placed.kind === 'card') {
        result.project.cards[placed.cardId].faces[0].text = 'Edited destination';
        strict_1.default.notEqual(result.project.cards[snapshot.card.id].faces[0].text, 'Edited destination');
    }
    strict_1.default.equal(result.selection.entryId, b.entryId);
    strict_1.default.deepEqual(placed.box, snapshot.object.box);
    strict_1.default.throws(() => (0, cardClipboard_1.moveCardToScene)(added.project, source, added.objectId, { sequence: 'activation', entryId: 'missing' }));
    strict_1.default.equal(added.project.scenes[source].objects.length, 1);
    const moved = (0, cardClipboard_1.moveCardToScene)(added.project, source, added.objectId, { sequence: 'activation', entryId: b.entryId });
    strict_1.default.equal(moved.project.scenes[source].objects.length, 0);
    strict_1.default.equal(moved.project.scenes[destination].objects.length, 1);
});
(0, node_test_1.test)('moving later at a section boundary preserves section membership', () => {
    const a = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), b = (0, commands_1.insertScene)(a.project, 'story'), c = (0, commands_1.insertScene)(b.project, 'story');
    const group = (0, sections_1.addSection)(c.project, 'story', 'A'), other = (0, sections_1.addSection)(group.project, 'story', 'B');
    let p = (0, sections_1.moveEntryToSection)(other.project, 'story', a.entryId, group.sectionId);
    p = (0, sections_1.moveEntryToSection)(p, 'story', b.entryId, group.sectionId);
    p = (0, sections_1.moveEntryToSection)(p, 'story', c.entryId, other.sectionId);
    p = (0, commands_1.reorderEntry)(p, 'story', a.entryId, c.entryId);
    strict_1.default.deepEqual(p.sequences.story.map(e => e.id), [b.entryId, a.entryId, c.entryId]);
    strict_1.default.equal(p.sequences.story[1].sectionId, group.sectionId);
});
(0, node_test_1.test)('Break template has editable content and duplication preserves entry metadata', () => {
    const group = (0, sections_1.addSection)((0, commands_1.createLesson)(), 'story', 'Practice');
    const pause = (0, sections_1.insertBreak)(group.project, 'story', undefined, group.sectionId);
    const original = pause.project.sequences.story[0];
    strict_1.default.ok(pause.project.scenes[original.sceneId].objects.some(o => o.kind === 'text' && o.text.includes('Review')));
    const copied = (0, commands_1.duplicateEntry)(pause.project, 'story', pause.entryId, 'story', false);
    const copy = copied.project.sequences.story.find(e => e.id === copied.entryId);
    strict_1.default.equal(copy.kind, 'break');
    strict_1.default.equal(copy.sectionId, group.sectionId);
    strict_1.default.notEqual(copy.sceneId, original.sceneId);
    const linked = (0, commands_1.duplicateEntry)(copied.project, 'story', pause.entryId, 'activation', true);
    strict_1.default.equal(linked.project.sequences.activation[0].kind, 'break');
    strict_1.default.equal(linked.project.sequences.activation[0].sectionId, undefined);
    strict_1.default.equal(linked.project.sequences.activation[0].sceneId, original.sceneId);
});
(0, node_test_1.test)('maximum legacy labels roundtrip, section creation and validation share the same ceiling', () => {
    const base = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), sceneId = base.project.sequences.story[0].sceneId;
    const p = { ...base.project, sequences: {
            story: Array.from({ length: limits_1.LESSON_LIMITS.entriesPerSequence }, (_, i) => ({ id: `story-${i}`, sceneId, section: `Section ${i}` })),
            activation: Array.from({ length: limits_1.LESSON_LIMITS.entriesPerSequence }, (_, i) => ({ id: `activation-${i}`, sceneId, section: `Section ${i}` })),
        } };
    const migrated = (0, validation_1.parseLessonProject)(p);
    strict_1.default.equal(migrated.sections.length, 2 * limits_1.LESSON_LIMITS.entriesPerSequence);
    strict_1.default.deepEqual((0, validation_1.parseLessonProject)(migrated), migrated);
    strict_1.default.throws(() => (0, sections_1.addSection)(migrated, 'story'), /section/i);
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...migrated, sections: [...migrated.sections, { id: 'extra', name: 'Extra', sequence: 'story' }] }), /sections/i);
});
