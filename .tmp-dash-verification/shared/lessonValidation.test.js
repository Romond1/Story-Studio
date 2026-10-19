"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const commands_1 = require("./lesson/commands");
const validation_1 = require("./lesson/validation");
const projection_1 = require("./lesson/projection");
(0, node_test_1.default)('lesson references must name authored records rather than inherited object properties', () => {
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...(0, commands_1.createLesson)(), library: ['toString'] }), /reference|identity/i);
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...(0, commands_1.createLesson)(), sequences: { story: [{ id: 'entry', sceneId: 'valueOf', section: '' }], activation: [] } }), /reference|identity/i);
});
(0, node_test_1.default)('card set IDs remain unique before their record projection is validated', () => {
    const set = { id: 'set-one', label: 'Set', tags: [], entries: [] };
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...(0, commands_1.createLesson)(), cardSets: [set, set] }), /collection|unique|set/i);
});
(0, node_test_1.default)('asset bin references must point to a real bin and malformed optional references are rejected', () => {
    const asset = { id: 'asset', filename: 'asset.png', relativePath: 'assets/asset.png', originalName: 'asset.png', mediaType: 'image', sizeBytes: 1, importedAt: '2026-10-08', binId: 'missing' };
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...(0, commands_1.createLesson)(), assets: [asset] }), /bin|asset/i);
});
(0, node_test_1.default)('valid extension metadata remains intact through the format boundary', () => {
    const project = { ...(0, commands_1.createLesson)(), authorMetadata: { note: 'preserved' } };
    strict_1.default.deepEqual((0, validation_1.parseLessonProject)(project), project);
});
(0, node_test_1.default)('persisted scene appearance follows the same color and text-size contract as Present', () => {
    const inserted = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), sceneId = inserted.project.sequences.story[0].sceneId;
    const lesson = (0, commands_1.addText)(inserted.project, sceneId, 'bubble').project;
    const scene = lesson.scenes[sceneId];
    strict_1.default.ok((0, projection_1.parseScenePlan)((0, projection_1.projectScene)((0, validation_1.parseLessonProject)(lesson), sceneId)));
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...lesson, scenes: { [sceneId]: { ...scene, background: { color: 'invalid-color' } } } }), /color|background/i);
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...lesson, scenes: { [sceneId]: { ...scene, objects: [{ ...scene.objects[0], fontSize: 6 }] } } }), /text/i);
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...lesson, scenes: { [sceneId]: { ...scene, objects: [{ ...scene.objects[0], color: 'currentColor' }] } } }), /text/i);
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)({ ...lesson, scenes: { [sceneId]: { ...scene, drawings: [{ id: 'stroke', color: 'invalid-color', size: 2, opacity: 1, rainbow: false, points: [] }] } } }), /drawing/i);
});
