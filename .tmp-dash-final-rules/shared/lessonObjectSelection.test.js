"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const objectSelection_1 = require("./lesson/objectSelection");
const objectClipboard_1 = require("./lesson/objectClipboard");
const commands_1 = require("./lesson/commands");
const projectHistory_1 = require("./projectHistory");
const limits_1 = require("./lesson/limits");
(0, node_test_1.default)('clipboard capacity failure leaves the source and destination unchanged', () => {
    const scene = (0, commands_1.createScene)();
    let project = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story', scene).project;
    project = (0, commands_1.addCard)(project, scene.id).project;
    const copied = (0, objectClipboard_1.copyObjects)(project, scene.id, project.scenes[scene.id].objects.map(o => o.id));
    const full = { ...project, scenes: { ...project.scenes, [scene.id]: { ...scene, objects: Array.from({ length: limits_1.LESSON_LIMITS.objectsPerScene }, (_, i) => ({ ...project.scenes[scene.id].objects[0], id: `full-${i}` })) } } };
    const before = JSON.stringify(full);
    strict_1.default.throws(() => (0, objectClipboard_1.pasteObjects)(full, scene.id, copied), /object limit/);
    strict_1.default.equal(JSON.stringify(full), before);
});
(0, node_test_1.default)('mixed object clipboard pastes independent Cards atomically and undo removes the whole group', () => {
    const scene = (0, commands_1.createScene)();
    let project = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story', scene).project;
    project = (0, commands_1.addCard)(project, scene.id).project;
    project = (0, commands_1.addText)(project, scene.id, 'text').project;
    const originals = project.scenes[scene.id].objects;
    const history = new projectHistory_1.ProjectHistory();
    history.reset(project);
    const clipboard = (0, objectClipboard_1.copyObjects)(project, scene.id, originals.map(o => o.id));
    const result = (0, objectClipboard_1.pasteObjects)(project, scene.id, clipboard);
    history.record(result.project);
    strict_1.default.equal(result.objectIds.length, 2);
    strict_1.default.equal(result.project.scenes[scene.id].objects.length, 4);
    const original = originals[0], pasted = result.project.scenes[scene.id].objects[2];
    strict_1.default.equal(original.kind, 'card');
    strict_1.default.equal(pasted.kind, 'card');
    if (original.kind === 'card' && pasted.kind === 'card') {
        strict_1.default.notEqual(original.cardId, pasted.cardId);
        strict_1.default.notEqual(project.cards[original.cardId].faces[0].id, result.project.cards[pasted.cardId].faces[0].id);
    }
    strict_1.default.equal(history.undo()?.scenes[scene.id].objects.length, 2);
});
(0, node_test_1.default)('marquee selects intersecting visible objects in scene coordinates', () => {
    strict_1.default.deepEqual((0, objectSelection_1.marqueeIds)([{ id: 'a', visible: true, box: { x: 30, y: 40, width: 50, height: 40 } }, { id: 'b', visible: false, box: { x: 35, y: 40, width: 10, height: 10 } }], { x: 100, y: 100 }, { x: 50, y: 50 }), ['a']);
});
(0, node_test_1.default)('group translation clamps the group as a whole preserving relative offsets', () => {
    strict_1.default.deepEqual((0, objectSelection_1.translateBoxes)([{ id: 'a', box: { x: 10, y: 10, width: 30, height: 20 } }, { id: 'b', box: { x: 60, y: 10, width: 30, height: 20 } }], 50, -50, { width: 100, height: 100 }).map(o => o.box.x), [20, 70]);
});
(0, node_test_1.default)('transient ink and erasing project before commit without mutating saved ink', () => {
    const ink = { id: 'ink', points: [{ x: 1, y: 1, t: 1 }], size: 4, color: 'red', opacity: 1, rainbow: false };
    strict_1.default.deepEqual((0, objectSelection_1.previewDrawings)([ink], { erasedIds: ['ink'], stroke: { ...ink, id: 'draft' } }).map(s => s.id), ['draft']);
    strict_1.default.equal(ink.id, 'ink');
    strict_1.default.deepEqual((0, objectSelection_1.previewDrawings)([ink], null), [ink]);
});
