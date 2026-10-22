import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createLesson, createScene, insertScene, addCard, addText, removeObject, putObject, duplicateObject } from './lesson/commands';
import { createSession, navigate, cardAction, resetScene } from './lesson/session';
import { projectScene, parseScenePlan, type ScenePlan } from './lesson/projection';
import { parsePresentSnapshot } from './presentationSnapshot';
import { fitLogicalFrame } from './staticScene';
import { awardLessonReward, initializeLessonRewards, showLessonCelebration } from './lesson/rewards';
import { sceneImageSources } from './lesson/projection';

function fixture(mediaType: 'image' | 'video' = 'image') {
  const scene = createScene('Proof scene', 'asset'); scene.frame = { width: 960, height: 720 }; scene.notes = 'Teacher-only notes';
  const added = insertScene(createLesson('Proof'), 'story', scene);
  const card = addCard({ ...added.project, assets: [{ id: 'asset', relativePath: `assets/proof.${mediaType === 'image' ? 'png' : 'mp4'}`, filename: 'proof', originalName: 'proof', mediaType, sizeBytes: 10, importedAt: '2026-10-08' }] }, scene.id);
  const placed = card.project.scenes[scene.id].objects.find(object => object.id === card.objectId)!;
  if (placed.kind === 'card') { const faces = card.project.cards[placed.cardId].faces; faces[0].text = 'Question'; faces[1].text = 'Answer'; }
  const bubble = addText(card.project, scene.id, 'bubble');
  return { project: bubble.project, sceneId: scene.id, entryId: added.entryId, cardId: card.objectId, bubbleId: bubble.objectId };
}

test('new scene image/video, cards and bubbles project as one ordered frame without teacher content', () => {
  for (const mediaType of ['image', 'video'] as const) {
    const f = fixture(mediaType), plan = projectScene(f.project, f.sceneId);
    assert.equal(plan.background.mediaType, mediaType); assert.deepEqual(plan.frame, { width: 960, height: 720 });
    assert.deepEqual(plan.objects.map(object => [object.id, object.kind]), [[f.cardId, 'card'], [f.bubbleId, 'bubble']]);
    assert.ok(JSON.stringify(plan).includes('Question')); assert.equal(JSON.stringify(plan).includes('Answer'), false);
    assert.equal(JSON.stringify(plan).includes('Teacher-only notes'), false);
    assert.deepEqual(parseScenePlan(plan), plan);
  }
});

test('current authored changes, duplication and deletion immediately feed the student projection', () => {
  const f = fixture();
  const initial = navigate(f.project, createSession(), { sequence: 'story', entryId: f.entryId });
  const shown = cardAction(f.project, initial, f.cardId, 'next');
  const live = projectScene(f.project, f.sceneId, shown); assert.ok(JSON.stringify(live).includes('Answer'));
  const object = f.project.scenes[f.sceneId].objects.find(item => item.id === f.cardId)!;
  const moved = putObject(f.project, f.sceneId, { ...object, box: { x: 180, y: 90, width: 420, height: 200 } });
  assert.deepEqual(projectScene(moved, f.sceneId, shown).objects[0].box, { x: 180, y: 90, width: 420, height: 200 });
  const duplicate = duplicateObject(moved, f.sceneId, f.cardId);
  assert.equal(projectScene(duplicate.project, f.sceneId, shown).objects.filter(item => item.kind === 'card').length, 2);
  const removed = removeObject(duplicate.project, f.sceneId, f.cardId);
  assert.deepEqual(projectScene(removed, f.sceneId, shown).objects.map(item => item.id), [f.bubbleId, duplicate.objectId]);
  assert.equal(Object.keys(removed.cards).length, 2);
  const concealed = projectScene(f.project, f.sceneId, cardAction(f.project, shown, f.cardId, 'conceal'));
  assert.equal(JSON.stringify(concealed).includes('Answer'), false);
  const reset = projectScene(f.project, f.sceneId, resetScene(f.project, shown));
  assert.ok(JSON.stringify(reset).includes('Question'));
});

test('scene IPC rejects remote media and malformed geometry and strips private fields and concealed faces', () => {
  const f = fixture(), plan = projectScene(f.project, f.sceneId);
  assert.equal(parseScenePlan({ ...plan, background: { color: '#000000', src: 'https://tracker.invalid/image.png', mediaType: 'image' } }), null);
  assert.equal(parseScenePlan({ ...plan, objects: [{ ...plan.objects[0], box: { x: NaN, y: 0, width: 10, height: 10 } }] }), null);
  const card = plan.objects[0]; assert.equal(card.kind, 'card'); if (card.kind !== 'card') return;
  const raw = { ...plan, notes: 'private', objects: [{ ...card, card: { ...card.card, concealed: true, privateFaces: ['secret'], image: { src: 'media://secret.png' } } }] };
  const clean = parseScenePlan(raw)!;
  assert.ok(clean); assert.equal(JSON.stringify(clean).includes('private'), false); assert.equal(JSON.stringify(clean).includes('secret'), false);
  const snapshot = parsePresentSnapshot({ sessionId: 's', revision: 1, target: { kind: 'scene', occurrenceId: 'entry', plan, teacherNotes: 'secret' } });
  assert.equal(snapshot?.target.kind, 'scene'); assert.equal(JSON.stringify(snapshot).includes('secret'), false);
});

/** Load real TSX components for server rendering; only DOM mounting and CSS imports are omitted. */
function rendererModule(relative: string) {
  const cache = new Map<string, any>();
  const React = require('react');
  const load = (filename: string): any => {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const js = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const dependency = (name: string) => {
      if (name.endsWith('.css')) return {};
      if (/\.(gif|png|svg|jpe?g|webp)$/.test(name)) return name;
      if (name === 'react') return { ...React, useLayoutEffect: () => {} };
      if (name === 'react-dom/client') return { createRoot: () => ({ render: () => {} }) };
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const target = ['', '.ts', '.tsx', '.js'].map(extension => base + extension).find(existsSync);
      if (!target) throw new Error(`Missing renderer dependency: ${name}`);
      return load(target);
    };
    vm.runInNewContext(js, { module, exports: module.exports, require: dependency, console, window: { presentApi: {} }, document: { getElementById: () => ({}) }, setTimeout, clearTimeout, setInterval, clearInterval });
    return module.exports;
  };
  return load(path.resolve(process.cwd(), relative));
}

test('actual Edit, Teach and Present renderer boundaries produce the exact same authored composition', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
  const { PresentLessonScene } = rendererModule('src/renderer/present.tsx');
  const f = fixture(), plan = projectScene(f.project, f.sceneId);
  const views = ['edit', 'teach'].map(surface => renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface, selectedObjectId: f.cardId, onGeometryChange: () => {} })));
  const target = { kind: 'scene', occurrenceId: 'entry', plan };
  views.push(renderToStaticMarkup(React.createElement(PresentLessonScene, { target, envelope: { generation: 1, sequence: 1, snapshot: { sessionId: 's', revision: 1, target } }, report: () => {} })));
  for (const html of views) {
    assert.equal((html.match(/data-logical-scene=/g) ?? []).length, 1);
    assert.deepEqual([...html.matchAll(/data-scene-object="([^"]+)"/g)].map(match => match[1]), [f.cardId, f.bubbleId]);
    assert.ok(html.includes('media://assets/proof.png')); assert.ok(html.includes('Question')); assert.ok(html.includes('What happens next?'));
    assert.ok(html.includes('width:960px;height:720px')); assert.equal(html.includes('Answer'), false);
  }
  assert.ok(views[0].includes('Resize object')); assert.equal(views[1].includes('Resize object'), false);
  assert.equal(views[2].includes('role="button"'), false); assert.equal(views[2].includes('Resize object'), false);
  const removed = removeObject(f.project, f.sceneId, f.cardId);
  const next = { ...target, plan: projectScene(removed, f.sceneId) };
  const html = renderToStaticMarkup(React.createElement(PresentLessonScene, { target: next, envelope: { generation: 1, sequence: 2, snapshot: { sessionId: 's', revision: 2, target: next } }, report: () => {} }));
  assert.equal(html.includes(`data-scene-object="${f.cardId}"`), false); assert.ok(html.includes('What happens next?'));
});

test('actual Present video scene contains one decoder with the same card and bubble composition', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { PresentLessonScene } = rendererModule('src/renderer/present.tsx');
  const f = fixture('video'), plan = projectScene(f.project, f.sceneId);
  const media = { identity: 'movie', epoch: 1, bridgeEpoch: 1, rendererGeneration: 1, playing: false, positionSec: 0, volume: 1, enabled: true };
  const target = { kind: 'scene', occurrenceId: 'entry', plan, media };
  assert.ok(parsePresentSnapshot({ sessionId: 's', revision: 1, target }));
  assert.equal(parsePresentSnapshot({ sessionId: 's', revision: 1, target: { ...target, media: undefined } }), null);
  const html = renderToStaticMarkup(React.createElement(PresentLessonScene, { target, envelope: { generation: 1, sequence: 1, rendererGeneration: 1, snapshot: { sessionId: 's', revision: 1, target } }, report: () => {} }));
  assert.equal((html.match(/<video/g) ?? []).length, 1); assert.equal((html.match(/data-logical-scene=/g) ?? []).length, 1);
  assert.ok(html.includes('Question')); assert.ok(html.includes('What happens next?')); assert.equal(html.includes('controls='), false);
});

test('authored frame and object geometry remain invariant across host aspect ratios', () => {
  const f = fixture(), plan = projectScene(f.project, f.sceneId);
  for (const host of [{ width: 1920, height: 1080 }, { width: 480, height: 900 }, { width: 320, height: 240 }]) {
    const fit = fitLogicalFrame(plan.frame, host), box = plan.objects[0].box;
    assert.equal((fit.x + box.x * fit.scale - fit.x) / fit.scale, box.x);
    assert.equal((fit.y + box.y * fit.scale - fit.y) / fit.scale, box.y);
    assert.ok(Math.abs((box.width * fit.scale) / (box.height * fit.scale) - box.width / box.height) < 1e-12);
  }
  assert.deepEqual(plan.frame, { width: 960, height: 720 });
});

test('logical drawings reach the retained painter at authored coordinates without mutating the saved stroke', () => {
  const { normalizedSceneDrawings } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
  const { renderStroke } = rendererModule('src/renderer/drawing/renderDrawing.ts');
  const stroke = { id: 'stroke', color: '#ffaa00', size: 6, opacity: 1, rainbow: false, points: [{ x: 120, y: 90, t: 1 }, { x: 720, y: 540, t: 2 }] };
  const before = JSON.stringify(stroke);
  for (const frame of [{ width: 960, height: 720 }, { width: 1920, height: 1080 }]) {
    const points: number[][] = [];
    const context = { beginPath() {}, stroke() {}, moveTo(x: number, y: number) { points.push([x, y]); }, lineTo(x: number, y: number) { points.push([x, y]); } };
    renderStroke(context, normalizedSceneDrawings([stroke], frame)[0], frame.width, frame.height, 3);
    assert.deepEqual(points, [[120, 90], [720, 540]]);
  }
  assert.equal(JSON.stringify(stroke), before);
});

test('all built-in bubble styles render complete vectors on every surface without missing image dependencies', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
  const f = fixture();
  for (const [bubbleDefId, shape] of [['BD_CLASSIC', 'speech'], ['BD_THOUGHT', 'thought'], ['BD_SHOUT', 'shout']]) {
    const bubble = f.project.scenes[f.sceneId].objects.find(object => object.id === f.bubbleId)!;
    assert.ok(bubble.kind === 'bubble'); if (bubble.kind !== 'bubble') continue;
    const project = putObject(f.project, f.sceneId, { ...bubble, bubbleDefId });
    const plan = projectScene(project, f.sceneId);
    assert.deepEqual(sceneImageSources(plan), ['media://assets/proof.png']);
    for (const surface of ['edit', 'teach', 'present']) {
      const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface }));
      assert.ok(html.includes(`data-bubble-shape="${shape}"`)); assert.ok(html.includes('What happens next?'));
      assert.ok(html.includes('<path')); assert.equal(html.includes('assets/bubbles/'), false);
    }
  }
});

test('Edit video preview has audible native controls while student and teacher video slots contain no authoring controls', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
  const f = fixture('video'), plan = projectScene(f.project, f.sceneId);
  const edit = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface: 'edit' }));
  assert.ok(edit.includes('aria-label="Edit video preview"')); assert.ok(edit.includes('controls=""')); assert.equal(edit.includes('muted=""'), false);
  assert.equal((edit.match(/<video/g) ?? []).length, 1);
  const drawing = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface: 'edit', drawing: true }));
  assert.equal(drawing.includes('controls=""'), false);
  for (const surface of ['teach', 'present']) {
    const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface, video: React.createElement('video', { 'data-live-slot': true }) }));
    assert.equal(html.includes('Edit video preview'), false); assert.equal(html.includes('controls=""'), false);
    assert.equal((html.match(/<video/g) ?? []).length, 1);
  }
});

test('Edit video allows local volume changes and pauses on cleanup', () => {
  const source = ts.createSourceFile('SceneSurface.tsx', readFileSync('src/renderer/lesson/SceneSurface.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'EditSceneVideo')!;
  const effects: (() => void | (() => void))[] = [];
  const video = { muted: false, volume: 1, pauses: 0, pause() { this.pauses++; } };
  const context: any = { exports: {}, useRef: () => ({ current: video }), useEffect: (effect: () => void) => effects.push(effect),
    React: { createElement: (_tag: string, props: any) => props } };
  const js = ts.transpileModule(declaration.getText(source), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, context);
  const props = context.exports.EditSceneVideo({ src: 'media://assets/proof.mp4' });
  const cleanup = effects.map(effect => effect());
  assert.equal(video.muted, false, 'mount must allow audible playback');
  video.volume = .4;
  props.onVolumeChange?.({ currentTarget: video });
  assert.equal(video.muted, false, 'changing volume must not force mute');
  video.muted = true;
  props.onVolumeChange?.({ currentTarget: video });
  video.muted = false;
  props.onVolumeChange?.({ currentTarget: video });
  assert.equal(video.muted, false, 'native unmute must remain effective');
  assert.equal(video.volume, .4);
  cleanup.forEach(dispose => dispose?.());
  assert.equal(video.pauses, 1, 'leaving the preview must stop its playback');
});

test('retained spark and celebration visuals project safely and render in the same scene frame', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
  const f = fixture(), now = Date.now();
  let session = initializeLessonRewards(navigate(f.project, createSession(), { sequence: 'story', entryId: f.entryId }), []);
  session = awardLessonReward(session, 'gold', 'award-event', now);
  session = showLessonCelebration(session, 'celebrate-event', now);
  const plan = projectScene(f.project, f.sceneId, session);
  assert.ok(plan.rewards?.sparks.length); assert.ok(plan.rewards?.final); assert.deepEqual(plan.rewards?.frame, plan.frame);
  assert.equal(JSON.stringify(plan).includes('appliedEventIds'), false); assert.equal(JSON.stringify(plan).includes('activeStudentId'), false);
  assert.deepEqual(parseScenePlan(plan), plan);
  assert.equal(parseScenePlan({ ...plan, rewards: { ...plan.rewards, frame: { width: 1, height: 1 } } }), null);
  const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface: 'present' }));
  assert.equal((html.match(/data-logical-scene=/g) ?? []).length, 1); assert.ok(html.includes('data-lesson-rewards="true"'));
  assert.ok(html.includes('spark-overlay')); assert.equal(html.includes('lesson-scene-reward'), false); assert.equal(html.includes('role="button"'), false);
});
