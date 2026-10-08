import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { addCard, addObject, addText, copyScene, createCard, createLesson, createScene, duplicateObject, insertScene } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import type { LessonProject } from './lesson/model';

function fixture() {
  const scene = createScene(), project = insertScene(createLesson(), 'story', scene).project;
  return { scene, project };
}
function withCards(project: LessonProject, count: number) {
  const source = createCard();
  return { ...project, cards: Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const card = { ...source, id: `card-${index}` }; return [card.id, card];
  })) };
}

test('ordinary text, card, object and duplicate actions reject the 201st object without changing the lesson', () => {
  const f = fixture(); let project = f.project;
  for (let index = 0; index < 200; index++) project = addText(project, f.scene.id, 'text').project;
  const before = JSON.stringify(project), original = project.scenes[f.scene.id].objects[0];
  assert.ok(parseLessonProject(project));
  assert.throws(() => addText(project, f.scene.id, 'text'), /200 objects/i);
  assert.throws(() => addText(project, f.scene.id, 'bubble'), /200 objects/i);
  assert.throws(() => addCard(project, f.scene.id), /200 objects/i);
  assert.throws(() => addObject(project, f.scene.id, { ...original, id: 'extra' }), /200 objects/i);
  assert.throws(() => duplicateObject(project, f.scene.id, original.id), /200 objects/i);
  assert.equal(addObject(project, f.scene.id, original), project, 'duplicate delivery of an existing object stays a no-op');
  assert.equal(JSON.stringify(project), before);
});

test('independent card additions and duplications stop at 2000 while linked placements and text still work', () => {
  const f = fixture();
  const near = withCards(f.project, 1999), full = addCard(near, f.scene.id).project;
  assert.equal(Object.keys(full.cards).length, 2000); assert.ok(parseLessonProject(full));
  const linked = addCard(full, f.scene.id, 'card-0', true);
  assert.equal(Object.keys(linked.project.cards).length, 2000);
  const before = JSON.stringify(linked.project);
  assert.throws(() => addCard(full, f.scene.id), /2000 Cards/i);
  assert.throws(() => addCard(full, f.scene.id, 'card-0', false), /2000 Cards/i);
  assert.throws(() => duplicateObject(linked.project, f.scene.id, linked.objectId), /2000 Cards/i);
  const text = addText(full, f.scene.id, 'text');
  assert.ok(parseLessonProject(duplicateObject(text.project, f.scene.id, text.objectId).project));
  assert.equal(JSON.stringify(linked.project), before);
});

test('scene copies preflight every independent card, preserve originals on failure and allow linked reuse', () => {
  const f = fixture(); let project = withCards(f.project, 1999);
  project = addCard(project, f.scene.id, 'card-0', true).project;
  project = addCard(project, f.scene.id, 'card-0', true).project;
  const before = JSON.stringify(project);
  assert.throws(() => copyScene(project, f.scene.id, 'activation', false), /2000 Cards/i);
  assert.equal(JSON.stringify(project), before);
  assert.ok(parseLessonProject(copyScene(project, f.scene.id, 'activation', true).project));
  const single = { ...project, scenes: { ...project.scenes, [f.scene.id]: { ...project.scenes[f.scene.id], title: 'x'.repeat(500), objects: project.scenes[f.scene.id].objects.slice(0, 1) } } };
  const copied = copyScene(single, f.scene.id, 'activation', false).project;
  assert.equal(Object.keys(copied.cards).length, 2000);
  assert.ok(parseLessonProject(copied), 'copy suffix must also fit the saved title limit');
});

test('scene and sequence limits allow existing-scene reuse but reject growth past each independent boundary', () => {
  const f = fixture();
  const scenes = { ...f.project.scenes };
  for (let index = 1; index < 2000; index++) scenes[`scene-${index}`] = { ...createScene(), id: `scene-${index}` };
  const full = { ...f.project, scenes };
  assert.throws(() => insertScene(full, 'story'), /2000 scenes/i);
  assert.throws(() => copyScene(full, f.scene.id, 'activation', false), /2000 scenes/i);
  assert.ok(parseLessonProject(copyScene(full, f.scene.id, 'activation', true).project));
  for (const sequence of ['story', 'activation'] as const) {
    const near = { ...f.project, sequences: { ...f.project.sequences, [sequence]: Array.from({ length: 1999 }, (_, index) => ({ id: `${sequence}-${index}`, sceneId: f.scene.id, section: '' })) } };
    const filled = insertScene(near, sequence, f.scene).project;
    assert.equal(filled.sequences[sequence].length, 2000); assert.ok(parseLessonProject(filled));
    assert.throws(() => insertScene(filled, sequence, f.scene), /2000 scene entries/i);
    assert.throws(() => copyScene(filled, f.scene.id, sequence, true), /2000 scene entries/i);
  }
});

test('adding a Card to a missing scene cannot leak an unreachable definition', () => {
  const project = createLesson();
  assert.throws(() => addCard(project, 'missing'), /scene no longer exists/i);
  assert.equal(Object.keys(project.cards).length, 0);
});

test('the actual add toolbar reports the capacity error without applying an unsavable revision', () => {
  const f = fixture(); let project = f.project;
  for (let index = 0; index < 200; index++) project = addText(project, f.scene.id, 'text').project;
  const source = ts.createSourceFile('LessonApp.tsx', readFileSync('src/renderer/lesson/LessonApp.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['editCommand', 'add'].includes(node.name.text)) declarations.push(`const ${node.getText(source)};`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  let error = '', applied = 0, selectionChanges = 0;
  const context: any = { project, editScene: project.scenes[f.scene.id], addCard, addText,
    setError: (message: string) => { error = message; }, apply: () => { applied++; }, setSelection: () => { selectionChanges++; } };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`${declarations.join('\n')}\nglobalThis.add=add;`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText, context);
  assert.doesNotThrow(() => context.add('bubble'));
  assert.match(error, /200 objects/i);
  assert.equal(applied, 0); assert.equal(selectionChanges, 0);
  assert.ok(parseLessonProject(project));
});
