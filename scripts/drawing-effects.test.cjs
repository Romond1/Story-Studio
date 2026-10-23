const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const vm = require('node:vm');
function rendererModule(relative, reactOverrides = {}) {
  const cache = new Map(), React = require('react');
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const dependency = name => {
      if (name.endsWith('.css')) return {};
      if (/\.(gif|png|svg|jpe?g|webp)$/.test(name)) return name;
      if (name === 'react') return { ...React, useLayoutEffect: () => {}, ...reactOverrides };
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const target = ['', '.ts', '.tsx', '.js'].map(extension => base + extension).find(fs.existsSync);
      if (!target) throw new Error(`Missing dependency: ${name}`);
      return load(target);
    };
    vm.runInNewContext(js, { module, exports: module.exports, require: dependency, console, crypto: require('node:crypto').webcrypto, window: {}, setTimeout, clearTimeout });
    return module.exports;
  };
  return load(path.resolve(relative));
}
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, filename);
const { createLesson, createScene, insertScene, addCard } = require('../src/shared/lesson/commands.ts');
const { projectScene, parseScenePlan } = require('../src/shared/lesson/projection.ts');
const { parseSceneDocument } = require('../src/shared/lesson/validation.ts');
const { createEpisodeFromScene } = require('../src/shared/episode/commands.ts');
const { parseEpisodeProject } = require('../src/shared/episode/validation.ts');
const { renderStroke } = require('../src/renderer/drawing/renderDrawing.ts');
const { parsePresentSnapshot } = require('../src/shared/presentationSnapshot.ts');
test('drawing mode leaves card click targets and native video controls available', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
  const scene = createScene('Clickable');
  const { project } = insertScene(createLesson('Clickable'), 'story', scene);
  const plan = projectScene(addCard(project, scene.id).project, scene.id);
  plan.background = { color: '#000000', mediaType: 'video', src: 'media://video.mp4' };
  plan.objects.push(...['text', 'image', 'bubble'].map(kind => ({ id: kind, kind, box: { x: 10, y: 10, width: 100, height: 100 }, text: 'Draw over me', fontSize: 20, color: '#ffffff', align: 'left' })));
  for (const surface of ['edit', 'teach']) {
    const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface, drawing: true, onDraw() {} }));
    assert.ok(html.includes(`aria-label="${surface === 'edit' ? 'Select' : 'Interact with'} card"`));
    for (const kind of ['text', 'image', 'bubble']) assert.equal(html.includes(`aria-label="${surface === 'edit' ? 'Select' : 'Interact with'} ${kind}"`), false);
    if (surface === 'edit') assert.ok(html.includes('controls=""'));
  }
});
test('drawing pointer arbitration allows object clicks and draws only on empty canvas', () => {
  let refs = 0, interactions = 0; const previews = [];
  const node = { focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx', {
    useRef: value => ({ current: refs++ < 2 ? node : value }), useState: value => [value, () => {}], useEffect() {},
  });
  const scene = createScene('Clickable'), { project } = insertScene(createLesson('Clickable'), 'story', scene), plan = projectScene(project, scene.id);
  plan.objects = [{ id: 'object', kind: 'card', box: { x: 10, y: 10, width: 100, height: 100 } }];
  const tree = SceneSurface({ plan, surface: 'teach', drawing: true, drawRainbow: true, drawFadeMs: 1000, onDraw() {}, onDrawingPreview: value => previews.push(value), onInteract: () => interactions++ });
  const elements = []; const visit = value => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) { value.forEach(visit); return; } elements.push(value); visit(value.props?.children); }; visit(tree);
  const hit = elements.find(value => value.props?.role === 'button'); let stopped = false;
  hit.props.onPointerDown({ stopPropagation() { stopped = true; } }); hit.props.onClick();
  assert.equal(stopped, true); assert.equal(interactions, 1); assert.equal(previews.length, 0);
  const content = elements.find(value => value.props?.className === 'lesson-scene-content');
  content.props.onPointerDown({ button: 0, target: { closest: () => ({}) } });
  assert.equal(previews.length, 0);
  content.props.onPointerDown({ button: 0, target: { closest: () => null }, clientX: 50, clientY: 50, pointerId: 1, preventDefault() {} });
  assert.equal(previews.length, 1); assert.equal(previews[0].stroke.fadeMs, 1000); assert.equal(previews[0].stroke.rainbow, true);
  const video = { controls: false, getBoundingClientRect: () => ({ bottom: 100 }) };
  const videoPointer = clientY => ({ button: 0, target: { closest: selector => selector.includes('video') ? video : null }, clientX: 50, clientY, pointerId: 1, preventDefault() {} });
  content.props.onPointerDown(videoPointer(50));
  assert.equal(previews.length, 2, 'video without native controls must allow ink');
  video.controls = true;
  content.props.onPointerDown(videoPointer(30));
  assert.equal(previews.length, 3, 'video body must allow ink');
  content.props.onPointerDown(videoPointer(90));
  assert.equal(previews.length, 3, 'native controls strip must remain clickable');
});
test('Present keeps fading marker lifetimes and captured hues across both scene transports', () => {
  const ink = { id: 'ink', color: '#ffffff', size: 10, opacity: 1, rainbow: true, fadeMs: 1000, points: [{ x: 0, y: 0, t: 1000, h: 10 }, { x: 1, y: 1, t: 1100, h: 70 }] };
  const snapshot = parsePresentSnapshot({ sessionId: 'ink', revision: 1, target: { kind: 'image', occurrenceId: 'ink', src: 'media://ink.png', scene: { frame: { width: 100, height: 100 }, overlays: [], markerStrokes: [ink] } } });
  assert.deepEqual(snapshot.target.scene.markerStrokes[0], ink);
  const scene = createScene('Ink'); scene.drawings = [ink];
  const { project } = insertScene(createLesson('Ink'), 'story', scene);
  const lesson = parsePresentSnapshot({ sessionId: 'ink', revision: 1, target: { kind: 'scene', occurrenceId: 'ink', plan: projectScene(project, scene.id) } });
  for (const received of [snapshot.target.scene.markerStrokes[0], lesson.target.plan.drawings[0]]) {
    const colors = [], ctx = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() { colors.push(this.strokeStyle); } };
    renderStroke(ctx, received, 100, 100, 1600);
    assert.deepEqual(colors, ['hsla(70, 95%, 62%, 0.5)']);
    renderStroke(ctx, received, 100, 100, 2100);
    assert.equal(colors.length, 1);
  }
});
test('fading rainbow ink survives document and presentation round trips', () => {
  const scene = createScene('Ink');
  scene.drawings = [{ id: 'ink', color: '#ffffff', size: 80, opacity: 1, rainbow: true, fadeMs: 2000, points: [{ x: 0, y: 0, t: 100, h: 10 }, { x: 10, y: 10, t: 200, h: 40 }] }];
  const { project } = insertScene(createLesson('Ink'), 'story', scene);
  assert.equal(parseSceneDocument(project).scenes[scene.id].drawings[0].fadeMs, 2000);
  const episode = createEpisodeFromScene(project, { id: 'ink-adventure', version: '1' });
  assert.equal(parseEpisodeProject(episode).scenes[scene.id].drawings[0].fadeMs, 2000);
  const plan = projectScene(project, scene.id);
  assert.deepEqual(parseScenePlan(plan).drawings, plan.drawings);
  for (const fadeMs of [-1, Infinity, 60001]) {
    assert.throws(() => parseSceneDocument({ ...project, scenes: { [scene.id]: { ...scene, drawings: [{ ...scene.drawings[0], fadeMs }] } } }));
    assert.equal(parseScenePlan({ ...plan, drawings: [{ ...scene.drawings[0], fadeMs }] }), null);
  }
});
test('rainbow segments retain their captured hue and vanish after their lifetime', () => {
  const colors = []; const ctx = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() { colors.push(this.strokeStyle); } };
  const stroke = { color: '#ffffff', size: 8, opacity: 1, rainbow: true, fadeMs: 1000, points: [{ x: 0, y: 0, t: 0, h: 5 }, { x: 1, y: 1, t: 100, h: 70 }] };
  renderStroke(ctx, stroke, 100, 100, 600);
  assert.deepEqual(colors, ['hsla(70, 95%, 62%, 0.5)']);
  renderStroke(ctx, stroke, 100, 100, 1100);
  assert.equal(colors.length, 1);
  assert.equal(stroke.points.length, 2);
  renderStroke(ctx, { ...stroke, fadeMs: undefined }, 100, 100, 100000);
  assert.equal(colors[1], 'hsla(70, 95%, 62%, 1)');
});
