"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const commands_1 = require("./lesson/commands");
const validation_1 = require("./lesson/validation");
function fixture() {
    const scene = (0, commands_1.createScene)(), project = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story', scene).project;
    return { scene, project };
}
function withCards(project, count) {
    const source = (0, commands_1.createCard)();
    return { ...project, cards: Object.fromEntries(Array.from({ length: count }, (_, index) => {
            const card = { ...source, id: `card-${index}` };
            return [card.id, card];
        })) };
}
(0, node_test_1.default)('ordinary text, card, object and duplicate actions reject the 201st object without changing the lesson', () => {
    const f = fixture();
    let project = f.project;
    for (let index = 0; index < 200; index++)
        project = (0, commands_1.addText)(project, f.scene.id, 'text').project;
    const before = JSON.stringify(project), original = project.scenes[f.scene.id].objects[0];
    strict_1.default.ok((0, validation_1.parseLessonProject)(project));
    strict_1.default.throws(() => (0, commands_1.addText)(project, f.scene.id, 'text'), /200 objects/i);
    strict_1.default.throws(() => (0, commands_1.addText)(project, f.scene.id, 'bubble'), /200 objects/i);
    strict_1.default.throws(() => (0, commands_1.addCard)(project, f.scene.id), /200 objects/i);
    strict_1.default.throws(() => (0, commands_1.addObject)(project, f.scene.id, { ...original, id: 'extra' }), /200 objects/i);
    strict_1.default.throws(() => (0, commands_1.duplicateObject)(project, f.scene.id, original.id), /200 objects/i);
    strict_1.default.equal((0, commands_1.addObject)(project, f.scene.id, original), project, 'duplicate delivery of an existing object stays a no-op');
    strict_1.default.equal(JSON.stringify(project), before);
});
(0, node_test_1.default)('independent card additions and duplications stop at 2000 while linked placements and text still work', () => {
    const f = fixture();
    const near = withCards(f.project, 1999), full = (0, commands_1.addCard)(near, f.scene.id).project;
    strict_1.default.equal(Object.keys(full.cards).length, 2000);
    strict_1.default.ok((0, validation_1.parseLessonProject)(full));
    const linked = (0, commands_1.addCard)(full, f.scene.id, 'card-0', true);
    strict_1.default.equal(Object.keys(linked.project.cards).length, 2000);
    const before = JSON.stringify(linked.project);
    strict_1.default.throws(() => (0, commands_1.addCard)(full, f.scene.id), /2000 Cards/i);
    strict_1.default.throws(() => (0, commands_1.addCard)(full, f.scene.id, 'card-0', false), /2000 Cards/i);
    strict_1.default.throws(() => (0, commands_1.duplicateObject)(linked.project, f.scene.id, linked.objectId), /2000 Cards/i);
    const text = (0, commands_1.addText)(full, f.scene.id, 'text');
    strict_1.default.ok((0, validation_1.parseLessonProject)((0, commands_1.duplicateObject)(text.project, f.scene.id, text.objectId).project));
    strict_1.default.equal(JSON.stringify(linked.project), before);
});
(0, node_test_1.default)('scene copies preflight every independent card, preserve originals on failure and allow linked reuse', () => {
    const f = fixture();
    let project = withCards(f.project, 1999);
    project = (0, commands_1.addCard)(project, f.scene.id, 'card-0', true).project;
    project = (0, commands_1.addCard)(project, f.scene.id, 'card-0', true).project;
    const before = JSON.stringify(project);
    strict_1.default.throws(() => (0, commands_1.copyScene)(project, f.scene.id, 'activation', false), /2000 Cards/i);
    strict_1.default.equal(JSON.stringify(project), before);
    strict_1.default.ok((0, validation_1.parseLessonProject)((0, commands_1.copyScene)(project, f.scene.id, 'activation', true).project));
    const single = { ...project, scenes: { ...project.scenes, [f.scene.id]: { ...project.scenes[f.scene.id], title: 'x'.repeat(500), objects: project.scenes[f.scene.id].objects.slice(0, 1) } } };
    const copied = (0, commands_1.copyScene)(single, f.scene.id, 'activation', false).project;
    strict_1.default.equal(Object.keys(copied.cards).length, 2000);
    strict_1.default.ok((0, validation_1.parseLessonProject)(copied), 'copy suffix must also fit the saved title limit');
});
(0, node_test_1.default)('scene and sequence limits allow existing-scene reuse but reject growth past each independent boundary', () => {
    const f = fixture();
    const scenes = { ...f.project.scenes };
    for (let index = 1; index < 2000; index++)
        scenes[`scene-${index}`] = { ...(0, commands_1.createScene)(), id: `scene-${index}` };
    const full = { ...f.project, scenes };
    strict_1.default.throws(() => (0, commands_1.insertScene)(full, 'story'), /2000 scenes/i);
    strict_1.default.throws(() => (0, commands_1.copyScene)(full, f.scene.id, 'activation', false), /2000 scenes/i);
    strict_1.default.ok((0, validation_1.parseLessonProject)((0, commands_1.copyScene)(full, f.scene.id, 'activation', true).project));
    for (const sequence of ['story', 'activation']) {
        const near = { ...f.project, sequences: { ...f.project.sequences, [sequence]: Array.from({ length: 1999 }, (_, index) => ({ id: `${sequence}-${index}`, sceneId: f.scene.id, section: '' })) } };
        const filled = (0, commands_1.insertScene)(near, sequence, f.scene).project;
        strict_1.default.equal(filled.sequences[sequence].length, 2000);
        strict_1.default.ok((0, validation_1.parseLessonProject)(filled));
        strict_1.default.throws(() => (0, commands_1.insertScene)(filled, sequence, f.scene), /2000 scene entries/i);
        strict_1.default.throws(() => (0, commands_1.copyScene)(filled, f.scene.id, sequence, true), /2000 scene entries/i);
    }
});
(0, node_test_1.default)('adding a Card to a missing scene cannot leak an unreachable definition', () => {
    const project = (0, commands_1.createLesson)();
    strict_1.default.throws(() => (0, commands_1.addCard)(project, 'missing'), /scene no longer exists/i);
    strict_1.default.equal(Object.keys(project.cards).length, 0);
});
(0, node_test_1.default)('the actual add toolbar reports the capacity error without applying an unsavable revision', () => {
    const f = fixture();
    let project = f.project;
    for (let index = 0; index < 200; index++)
        project = (0, commands_1.addText)(project, f.scene.id, 'text').project;
    const source = typescript_1.default.createSourceFile('LessonApp.tsx', (0, node_fs_1.readFileSync)('src/renderer/lesson/LessonApp.tsx', 'utf8'), typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    const declarations = [];
    const visit = (node) => {
        if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isIdentifier(node.name) && ['editCommand', 'add'].includes(node.name.text))
            declarations.push(`const ${node.getText(source)};`);
        typescript_1.default.forEachChild(node, visit);
    };
    visit(source);
    let error = '', applied = 0, selectionChanges = 0;
    const context = { project, editScene: project.scenes[f.scene.id], addCard: commands_1.addCard, addText: commands_1.addText,
        setError: (message) => { error = message; }, apply: () => { applied++; }, setSelection: () => { selectionChanges++; } };
    node_vm_1.default.createContext(context);
    node_vm_1.default.runInContext(typescript_1.default.transpileModule(`${declarations.join('\n')}\nglobalThis.add=add;`, { compilerOptions: { target: typescript_1.default.ScriptTarget.ES2021 } }).outputText, context);
    strict_1.default.doesNotThrow(() => context.add('bubble'));
    strict_1.default.match(error, /200 objects/i);
    strict_1.default.equal(applied, 0);
    strict_1.default.equal(selectionChanges, 0);
    strict_1.default.ok((0, validation_1.parseLessonProject)(project));
});
