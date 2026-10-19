"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const commands = __importStar(require("./lesson/commands"));
const validation_1 = require("./lesson/validation");
function insert(project, sceneId, setId) {
    return commands.insertCardSet(project, sceneId, setId);
}
function fixture(count, width = 1280, height = 720, sequence = 'story') {
    const scene = { ...commands.createScene(), frame: { width, height } };
    const inserted = commands.insertScene(commands.createLesson(), sequence, scene);
    const card = commands.createCard();
    const project = { ...inserted.project, cards: { [card.id]: card }, library: [card.id], cardSets: [{ id: 'set', label: 'Practice', tags: [], entries: Array.from({ length: count }, (_, index) => ({ id: `entry-${index}`, cardId: card.id })) }] };
    return { project, scene, card };
}
const overlaps = (a, b) => a.x < b.x + b.width - .001 && b.x < a.x + a.width - .001 && a.y < b.y + b.height - .001 && b.y < a.y + a.height - .001;
(0, node_test_1.default)('Story and Activation insert Card Sets as independent visible placements with stable face IDs', () => {
    for (const sequence of ['story', 'activation']) {
        const f = fixture(3, 1280, 720, sequence), result = insert(f.project, f.scene.id, 'set');
        strict_1.default.equal(result.objectIds.length, 3);
        strict_1.default.equal(new Set(result.objectIds).size, 3);
        const objects = result.project.scenes[f.scene.id].objects;
        const cardIds = [];
        for (const object of objects) {
            strict_1.default.equal(object.kind, 'card');
            if (object.kind !== 'card')
                continue;
            cardIds.push(object.cardId);
            strict_1.default.notEqual(object.cardId, f.card.id);
            strict_1.default.equal(object.initiallyConcealed, false);
            strict_1.default.equal(object.interaction, 'cycle');
            const card = result.project.cards[object.cardId];
            strict_1.default.equal(object.initialFaceId, card.faces[0].id);
            strict_1.default.notEqual(card.faces[0].id, f.card.faces[0].id);
            strict_1.default.deepEqual(card.faces.map(face => face.text), f.card.faces.map(face => face.text));
        }
        strict_1.default.equal(new Set(cardIds).size, 3);
        strict_1.default.equal(f.project.scenes[f.scene.id].objects.length, 0);
        strict_1.default.equal(result.project.cards[f.card.id], f.card);
        strict_1.default.equal(result.project.cardSets, f.project.cardSets);
        strict_1.default.equal((0, validation_1.parseLessonProject)(result.project).sequences[sequence].length, 1);
    }
});
(0, node_test_1.default)('Card Set grids fit landscape, portrait and dense minimum-size scenes without overlapping each other', () => {
    for (const [count, width, height] of [[7, 1280, 720], [7, 720, 1280], [100, 240, 240]]) {
        const f = fixture(count, width, height), result = insert(f.project, f.scene.id, 'set');
        const boxes = result.project.scenes[f.scene.id].objects.map(object => object.box);
        strict_1.default.equal(boxes.length, count);
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            strict_1.default.ok(box.x >= 0 && box.y >= 0 && box.width >= 24 && box.height >= 24);
            strict_1.default.ok(box.x + box.width <= width + .001 && box.y + box.height <= height + .001);
            for (let j = i + 1; j < boxes.length; j++)
                strict_1.default.equal(overlaps(box, boxes[j]), false, `Cards ${i} and ${j} must not overlap`);
        }
        strict_1.default.ok((0, validation_1.parseLessonProject)(result.project));
    }
});
(0, node_test_1.default)('Card Set insertion preserves existing objects and rejects invalid references before creating content', () => {
    const f = fixture(2), existing = commands.addText(f.project, f.scene.id, 'bubble').project;
    const previous = existing.scenes[f.scene.id].objects[0];
    const result = insert(existing, f.scene.id, 'set');
    strict_1.default.equal(result.project.scenes[f.scene.id].objects[0], previous);
    strict_1.default.throws(() => insert(f.project, 'missing-scene', 'set'), /scene/i);
    strict_1.default.throws(() => insert(f.project, f.scene.id, 'missing-set'), /set/i);
    strict_1.default.throws(() => insert({ ...f.project, cards: {} }, f.scene.id, 'set'), /card/i);
    strict_1.default.equal(Object.keys(f.project.cards).length, 1);
});
(0, node_test_1.default)('empty Sets are a no-op and scene capacity is checked before inserting any Cards', () => {
    const empty = fixture(0);
    strict_1.default.equal(insert(empty.project, empty.scene.id, 'set').project, empty.project);
    const full = fixture(100);
    let project = full.project;
    for (let i = 0; i < 101; i++)
        project = commands.addText(project, full.scene.id, 'text').project;
    strict_1.default.throws(() => insert(project, full.scene.id, 'set'), /200 objects/i);
    strict_1.default.equal(project.scenes[full.scene.id].objects.length, 101);
    strict_1.default.equal(Object.keys(project.cards).length, 1);
});
