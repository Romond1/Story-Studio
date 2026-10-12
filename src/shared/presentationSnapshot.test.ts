import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPresentEnvelope, parsePresentSnapshot, PresentSnapshotRelay } from './presentationSnapshot';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { buildCardV2FacePlan, parseCardV2RenderPlan } from './cardV2Render';
const snapshot = (revision: number, sessionId = 'lesson') => ({ sessionId, revision, target: { kind: 'image', occurrenceId: 'story:slide1', src: 'media://asset/image.png' } });
test('game presentation accepts only a registered game identity without source or runtime state', () => {
  const target = { kind: 'game', occurrenceId: 'game:run-1', gameId: 'language-snake', instanceId: 'run-1' };
  assert.deepEqual(parsePresentSnapshot({ ...snapshot(1), target: { ...target, src: 'https://tracker.test', runtime: { score: 9 }, teacherNotes: 'private' } }), { sessionId: 'lesson', revision: 1, target });
  for (const changes of [{ gameId: 'chess' }, { instanceId: '' }, { instanceId: 4 }, { instanceId: 'x'.repeat(1025) }]) {
    assert.equal(parsePresentSnapshot({ ...snapshot(1), target: { ...target, ...changes } }), null);
  }
});
test('card overlays whitelist active student faces on ordinary presentation targets', () => {
  const card = buildCardV2FacePlan({ id: 'card', style: { preset: 'classroom' }, faces: [{ id: 'front', layout: 'text', text: 'Visible answer' }] } as any, 'front', { x: 20, y: 30, width: 300, height: 200 });
  const raw = { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [{ ...card, teacherNotes: 'private', inactiveFaces: ['private'] }, { ...card, instanceId: 'hidden', concealed: true, image: { src: 'media://hidden.png', box: card.box }, texts: card.texts }], definitions: ['private'] };
  const scene = { frame: { width: 1280, height: 720 }, overlays: [] };
  const activity = { boards: [], cards: {}, images: {}, overlays: { instances: [], states: {} } };
  const media = { identity: 'a', epoch: 3, bridgeEpoch: 2, rendererGeneration: 1, playing: false, positionSec: 2, volume: 0.5, enabled: true };
  const targets = [snapshot(1).target, { ...snapshot(1).target, kind: 'video', media }, { kind: 'break', occurrenceId: 'break', scene, activity }, { kind: 'board', occurrenceId: 'board', scene, activity }, { kind: 'prompt', occurrenceId: 'prompt', scene, activity, title: 'Talk', body: 'Explain' }];
  for (const target of targets) {
    const parsed = parsePresentSnapshot({ ...snapshot(1), target, cardsV2: raw });
    assert.ok(parsed);
    assert.deepEqual((parsed as any).cardsV2, parseCardV2RenderPlan(raw));
    assert.equal((parsed as any).cardsV2.definitions, undefined);
    assert.equal((parsed as any).cardsV2.cards[0].teacherNotes, undefined);
    assert.deepEqual((parsed as any).cardsV2.cards[1].texts, []);
    assert.equal((parsed as any).cardsV2.cards[1].image, undefined);
  }
  const standalone = parsePresentSnapshot({ ...snapshot(1), target: { kind: 'cards-v2', occurrenceId: 'cards', plan: raw } });
  assert.equal(standalone?.target.kind, 'cards-v2');
  assert.deepEqual((standalone!.target as any).plan, parseCardV2RenderPlan(raw));
  assert.equal((standalone as any).cardsV2, undefined);
});
test('invalid card overlays are rejected without replacing the relay safe snapshot', () => {
  const relay = new PresentSnapshotRelay();
  const safe = relay.publish(snapshot(1));
  for (const cardsV2 of [null, {}, { engine: 'card-v2', version: 1, frame: { width: -1, height: 720 }, cards: [] }]) {
    assert.equal(parsePresentSnapshot({ ...snapshot(2), cardsV2 }), null);
    assert.equal(relay.publish({ ...snapshot(2), cardsV2 }), null);
    assert.equal(relay.envelope, safe);
  }
});
test('Control namespaces card image URLs in standalone and overlay snapshots without mutating the plan', () => {
  const published: any[] = [];
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(path.join(process.cwd(), 'src/renderer/usePresentProjection.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, console, window: { appApi: { publishPresentSnapshot: async (value: unknown) => { published.push(value); } } }, require: (name: string) => {
    if (name === 'react') return { useRef: (current: unknown) => ({ current }), useState: () => [0, () => {}], useEffect: (effect: () => void) => effect() };
    if (name === '../shared/visualMedia') return require('./visualMedia');
    if (name === '../shared/sceneTransition') return require('./sceneTransition');
    if (name === '../shared/activityScene') return require('./activityScene');
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const card = buildCardV2FacePlan({ id: 'card', style: { preset: 'classroom' }, faces: [{ id: 'front', layout: 'image-only', imageAssetId: 'picture' }] } as any, 'front', { x: 20, y: 30, width: 300, height: 200 }, () => 'media://picture.png');
  const plan = { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [card] };
  const session = { sessionId: 'lesson', projectId: 'project', revision: 1, targetRevision: 1, overlays: { movement: null } };
  for (const kind of ['cards-v2', 'slide']) {
    exports.usePresentProjection(session, { kind, occurrenceId: 'target', contentId: 'card' }, { mediaType: 'image' }, 'media://base.png', undefined, undefined, 5, undefined, undefined, plan);
    const projected = published.at(-1);
    const projectedPlan = kind === 'cards-v2' ? projected.target.plan : projected.cardsV2;
    assert.ok(projectedPlan);
    assert.equal(new URL(projectedPlan.cards[0].image.src).searchParams.get('sceneScope'), JSON.stringify(['lesson', 'project', 5]));
    assert.equal(card.image!.src, 'media://picture.png');
    if (kind === 'cards-v2') assert.equal(projected.cardsV2, undefined);
  }
});
test('Present waits for both the base scene and card overlay images before reporting readiness', () => {
  const card = buildCardV2FacePlan({ id: 'card', style: { preset: 'classroom' }, faces: [{ id: 'front', layout: 'image-only', imageAssetId: 'picture' }] } as any, 'front', { x: 20, y: 30, width: 300, height: 200 }, () => 'media://picture.png');
  const envelope = { generation: 1, sequence: 2, snapshot: { ...snapshot(1), cardsV2: { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [card] } } };
  for (const order of ['cards-first', 'base-first', 'card-error']) {
    const applied: unknown[][] = [], images: any[] = [], hooks: any[] = [];
    let index = 0;
    const effects: (() => void)[] = [];
    const React = require('react');
    const fakeReact = { ...React,
      useRef: (initial: unknown) => { const slot = index++; return hooks[slot] ??= { current: initial }; },
      useState: (initial: unknown) => { const slot = index++; if (!(slot in hooks)) hooks[slot] = slot === 2 ? envelope : initial; return [hooks[slot], (next: any) => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next; }]; },
      useEffect: (effect: () => void, deps: unknown[]) => { const slot = index++; if (!hooks[slot] || deps.some((dep, i) => dep !== hooks[slot][i])) { hooks[slot] = deps; effects.push(effect); } },
    };
    const exports: any = {};
    const source = ts.transpileModule(readFileSync(path.join(process.cwd(), 'src/renderer/present.tsx'), 'utf8') + '\nexport { Present };', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const Stub = () => null;
    vm.runInNewContext(source, { exports, console, document: { getElementById: () => ({}) }, window: { presentApi: { reportApplied: (...args: unknown[]) => applied.push(args), subscribeSnapshot: () => () => {}, requestSnapshot: () => new Promise(() => {}) } }, Image: class { constructor() { images.push(this); } }, require: (name: string) => {
      if (name === 'react') return fakeReact;
      if (name === 'react-dom/client') return { createRoot: () => ({ render: () => {} }) };
      if (name === '../shared/presentationSnapshot') return { assessPresentEnvelope };
      if (name === '../shared/cardV2Render') return require('./cardV2Render');
      if (name === '../shared/staticScene') return require('./staticScene');
      if (name.endsWith('.css')) return {};
      return { PromptCardScene: Stub, RewardSurface: Stub, MovementSurface: Stub, TransitionLayers: Stub, PresentVideoScene: Stub, StudentSceneBoundary: Stub, PassiveActivities: Stub, LogicalSceneFrame: Stub, PassiveImage: Stub, PassiveOverlays: Stub, PassiveDrawings: Stub, CardV2Scene: Stub, overlayGraphic: () => null };
    } });
    const render = () => { index = 0; const tree = exports.Present(); while (effects.length) effects.shift()!(); return tree; };
    const tree = render();
    const report = tree.props.children[0].props.children[0].props.children[0].props.report;
    assert.equal(images.length, 1);
    assert.equal(applied.length, 0);
    if (order === 'cards-first') {
      images[0].onload(); render(); assert.equal(applied.length, 0);
      report(1, 2); render(); assert.deepEqual(applied, [[1, 2]]);
    } else {
      report(1, 2); render(); assert.equal(applied.length, 0);
      if (order === 'card-error') images[0].onerror(); else images[0].onload();
      render();
      assert.deepEqual(applied, order === 'card-error' ? [[1, 2, true, 'Card image could not be displayed']] : [[1, 2]]);
    }
  }
});
test('snapshot projection strips teacher data and rejects invalid revisions or media', () => {
  assert.deepEqual(parsePresentSnapshot({ ...snapshot(1), students: ['private'], target: { ...snapshot(1).target, notes: 'private' } }), snapshot(1));
  for (const bad of [NaN, -1, 1.2, Infinity]) assert.equal(parsePresentSnapshot(snapshot(bad)), null);
  for (const src of ['https://example.com/a.png', 'javascript:alert(1)', 'file:///private']) assert.equal(parsePresentSnapshot({ ...snapshot(1), target: { ...snapshot(1).target, src } }), null);
});
test('relay rejects duplicate/stale revisions and retired sessions while preserving full latest state', () => {
  const relay = new PresentSnapshotRelay();
  assert.equal(relay.publish(snapshot(5))?.sequence, 1);
  assert.equal(relay.publish(snapshot(4)), null);
  assert.equal(relay.publish(snapshot(5)), null);
  assert.equal(relay.publish(snapshot(9))?.sequence, 2);
  assert.equal(relay.publish(snapshot(0, 'new'))?.sequence, 3);
  assert.equal(relay.publish(snapshot(10)), null);
  assert.deepEqual(relay.envelope.snapshot, snapshot(0, 'new'));
});
test('Control reset clears stale image and permits fresh renderer state; Present recovery uses latest full snapshot', () => {
  const relay = new PresentSnapshotRelay(); const old = relay.publish(snapshot(8))!;
  const reset = relay.reset();
  assert.equal(reset.snapshot, null); assert.equal(reset.generation, 1);
  assert.equal(assessPresentEnvelope(old, reset), 'apply');
  assert.equal(assessPresentEnvelope(reset, old), 'ignore');
  assert.equal(relay.publish(snapshot(0))?.sequence, 1);
  const first = relay.envelope;
  relay.publish(snapshot(1)); relay.publish(snapshot(2));
  assert.equal(assessPresentEnvelope(first, relay.envelope), 'recover');
  assert.equal(assessPresentEnvelope(null, relay.envelope), 'apply');
  assert.equal(assessPresentEnvelope(relay.envelope, relay.envelope), 'ignore');
});

test('Present lifecycle stays passive, recovers latest snapshot and rejects foreign IPC senders', async () => {
  const handles = new Map<string, (...args: any[]) => any>();
  const events = new Map<string, (...args: any[]) => any>();
  const windows: FakeWindow[] = [];
  const displayEvents = new EventEmitter();
  class FakeContents extends EventEmitter {
    mainFrame = {}; messages: any[] = [];
    isDestroyed() { return false; }
    send(channel: string, data: unknown) { this.messages.push({ channel, data }); }
    setWindowOpenHandler(_callback: unknown) {}
  }
  class FakeWindow extends EventEmitter {
    webContents = new FakeContents(); destroyed = false; shown = 0;
    constructor(public options: any = {}) { super(); windows.push(this); }
    isDestroyed() { return this.destroyed; }
    bounds = { x: 50, y: 50, width: 800, height: 600 };
    getBounds() { return this.bounds; }
    setBounds(bounds: typeof this.bounds) { this.bounds = bounds; }
    setMenu(_menu: unknown) {}
    show() { this.shown++; } focus() {}
    async loadFile(_file: string) { this.webContents.emit('did-finish-load'); }
    async loadURL(_url: string) { this.webContents.emit('did-finish-load'); }
    close() { this.emit('close'); this.destroy(); }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(path.join(process.cwd(), 'src/main/presentWindow.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, __dirname: process.cwd(), process: { env: {} }, console, require: (name: string) => {
    if (name === 'electron') return { BrowserWindow: FakeWindow, ipcMain: { handle: (key: string, fn: any) => handles.set(key, fn), on: (key: string, fn: any) => events.set(key, fn) }, screen: { on: (name: string, listener: (...args: any[]) => void) => displayEvents.on(name, listener), getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1200, height: 800 } }), getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1200, height: 800 } }] } };
    if (name === 'node:path') return path;
    if (name === '../shared/presentationSnapshot') return { PresentSnapshotRelay, parsePresentSnapshot };
    if (name === '../shared/gameHost') return require('./gameHost');
    if (name === '../shared/presentationMedia') return require('./presentationMedia');
    if (name === '../shared/teachWorkspace') return require('./teachWorkspace');
    if (name === './cameraBroadcast') return { installCameraBroadcast: () => ({ reset() {} }) };
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const control = new FakeWindow(); exports.installPresentWindow(() => control);
  const event = (window: FakeWindow) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  const controlEvent = event(control);
  assert.equal(handles.get('present:publish')!(controlEvent, snapshot(1)), true);
  await handles.get('present:open')!(controlEvent);
  const first = windows[1];
  events.get('present:viewport')!(controlEvent, {width:10,height:10});
  assert.equal(handles.get('present:get-status')!(controlEvent).viewport, undefined);
  events.get('present:viewport')!(event(first), {width:1280,height:720});
  assert.deepEqual(handles.get('present:get-status')!(controlEvent).viewport, {width:1280,height:720});
  const beforeResize = handles.get('present:snapshot')!(event(first));
  events.get('present:viewport')!({sender:first.webContents,senderFrame:{}}, {width:1,height:1});
  events.get('present:viewport')!(event(first), {width:-1,height:NaN});
  assert.deepEqual(handles.get('present:get-status')!(controlEvent).viewport, {width:1280,height:720});
  events.get('present:viewport')!(event(first), {width:480,height:900});
  assert.deepEqual(handles.get('present:get-status')!(controlEvent).viewport, {width:480,height:900});
  assert.deepEqual(handles.get('present:snapshot')!(event(first)), beforeResize);

  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'connecting');
  assert.equal(handles.get('present:get-status')!(controlEvent).needsReshare, false);
  events.get('present:status')!(event(first), 0, 1, false);
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'ready');
  events.get('present:status')!(event(first), 0, 0, true);
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'ready');
  assert.throws(() => handles.get('present:get-status')!(event(first)), /Control/);
  handles.get('present:publish')!(controlEvent, snapshot(2));
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'connecting');
  assert.equal(handles.get('present:get-status')!(controlEvent).sequence, 2);
  events.get('present:status')!(event(first), 0, 1, false);
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'connecting');
  events.get('present:status')!(event(first), 0, 2, false);
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'ready');
  events.get('present:status')!(event(first), 0, 2, true, 'Card content failed');
  assert.equal(handles.get('present:get-status')!(controlEvent).detail, 'Card content failed');
  events.get('present:status')!(controlEvent, 0, 2, true, 'Untrusted sender');
  assert.equal(handles.get('present:get-status')!(controlEvent).detail, 'Card content failed');
  events.get('present:status')!(event(first), 0, 2, false);
  assert.equal(handles.get('present:get-status')!(controlEvent).detail, undefined);
  assert.equal(first.options.webPreferences.contextIsolation, true);
  assert.equal(first.options.webPreferences.nodeIntegration, false);
  assert.equal(first.options.webPreferences.sandbox, true);
  assert.equal(first.options.webPreferences.backgroundThrottling, false);
  assert.deepEqual(first.webContents.messages.slice(-1)[0].data.snapshot, snapshot(2));
  assert.throws(() => handles.get('present:publish')!(event(first), snapshot(2)), /Only Control/);
  assert.throws(() => handles.get('present:publish')!({ sender: control.webContents, senderFrame: {} }, snapshot(2)), /Only Control/);
  await assert.rejects(handles.get('present:open')!(event(first)), /Control/);
  assert.throws(() => handles.get('present:snapshot')!(controlEvent), /Only Present/);
  const runtime = handles.get('present:media-runtime')!(controlEvent);
  const media = { identity: 'video-activation', epoch: 3, bridgeEpoch: 3, rendererGeneration: runtime.generation, playing: false, positionSec: 0, volume: 1, enabled: true };
  handles.get('present:publish')!(controlEvent, { ...snapshot(3), target: { kind: 'video', occurrenceId: 'video', src: 'media://asset/tone.webm', media } });
  const signal = { generation: runtime.generation, identity: media.identity, bridgeEpoch: media.bridgeEpoch, type: 'offer', description: { type: 'offer', sdp: 'test' } };
  const delivered = () => control.webContents.messages.filter(m => m.channel === 'present:media-signal').length;
  const before = delivered();
  events.get('present:media-signal')!(controlEvent, signal); // Direction is authenticated, not trusted from payload.
  events.get('present:media-signal')!({ sender: first.webContents, senderFrame: {} }, signal);
  events.get('present:media-signal')!(event(first), { ...signal, bridgeEpoch: 2 });
  assert.equal(delivered(), before);
  events.get('present:media-signal')!(event(first), signal); assert.equal(delivered(), before + 1);
  assert.throws(() => handles.get('present:media-revoke')!(event(first)), /Only Control/);
  handles.get('present:media-revoke')!(controlEvent);
  events.get('present:media-signal')!(event(first), signal); assert.equal(delivered(), before + 1);
  assert.ok(handles.get('present:snapshot')!(event(first)).rendererGeneration > runtime.generation);
  handles.get('present:publish')!(controlEvent, { ...snapshot(4), target: { kind: 'game', occurrenceId: 'game:run-1', gameId: 'language-snake', instanceId: 'run-1' } });
  const input = { instanceId: 'run-1', key: 'w', code: 'KeyW', phase: 'keydown', repeat: false };
  const gameInputs = () => first.webContents.messages.filter(m => m.channel === 'present:game-input');
  const sendInput = events.get('present:game-input');
  assert.ok(sendInput, 'game input relay is installed');
  sendInput(controlEvent, input);
  assert.deepEqual(gameInputs().at(-1)?.data, input);
  const inputCount = gameInputs().length;
  for (const sender of [event(first), { sender: control.webContents, senderFrame: {} }]) sendInput(sender, input);
  sendInput(controlEvent, { ...input, instanceId: 'retired-run' });
  sendInput(controlEvent, { ...input, key: '<script>' });
  assert.equal(gameInputs().length, inputCount);
  first.webContents.emit('did-start-navigation', {}, 'present', false, true);
  assert.deepEqual(JSON.parse(JSON.stringify(control.webContents.messages.filter(m => m.channel === 'present:game-ended').at(-1)?.data)), { instanceId: 'run-1', reason: 'reload' });
  first.webContents.emit('did-finish-load');
  assert.equal(handles.get('present:snapshot')!(event(first)).snapshot.target.kind, 'empty', 'reload must not recreate a retired runtime');
  sendInput(controlEvent, input);
  assert.equal(gameInputs().length, inputCount);
  for (let revision = 2; revision <= 25; revision++) handles.get('present:publish')!(controlEvent, snapshot(revision));
  assert.equal(handles.get('present:snapshot')!(event(first)).snapshot.revision, 25);
  first.webContents.emit('did-finish-load'); // Reload receives latest, not initial state.
  assert.equal(first.webContents.messages.slice(-1)[0].data.snapshot.revision, 25);
  first.close(); assert.equal(control.destroyed, false);
  assert.deepEqual(handles.get('present:get-status')!(controlEvent).viewport, {width:480,height:900});
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'closed');
  await handles.get('present:open')!(controlEvent);
  const second = windows[2]; assert.equal(second.webContents.messages.slice(-1)[0].data.snapshot.revision, 25);
  assert.equal(handles.get('present:get-status')!(controlEvent).needsReshare, true);
  second.bounds = { x: 2200, y: 100, width: 800, height: 600 };
  displayEvents.emit('display-removed');
  assert.ok(second.bounds.x + second.bounds.width <= 1200);
  second.webContents.emit('render-process-gone'); assert.equal(second.destroyed, true);
  assert.equal(handles.get('present:get-status')!(controlEvent).state, 'error');
  await handles.get('present:open')!(controlEvent);
  const third = windows[3]; assert.equal(third.webContents.messages.slice(-1)[0].data.snapshot.revision, 25);
  control.webContents.emit('did-start-navigation', {}, 'app', false, true);
  assert.equal(third.webContents.messages.slice(-1)[0].data.snapshot, null);
  handles.get('present:publish')!(controlEvent, snapshot(0, 'fresh'));
  control.webContents.emit('render-process-gone');
  assert.equal(third.webContents.messages.slice(-1)[0].data.snapshot, null);
  assert.equal(control.destroyed, false);
  const game = (instanceId: string, revision: number) => ({ ...snapshot(revision, 'fresh'), target: { kind: 'game', occurrenceId: `game:${instanceId}`, gameId: 'language-snake', instanceId } });
  handles.get('present:publish')!(controlEvent, game('run-closed', 1));
  third.close();
  assert.deepEqual(JSON.parse(JSON.stringify(control.webContents.messages.filter(m => m.channel === 'present:game-ended').at(-1)?.data)), { instanceId: 'run-closed', reason: 'closed' });
  await handles.get('present:open')!(controlEvent);
  const fourth = windows[4];
  assert.equal(handles.get('present:snapshot')!(event(fourth)).snapshot.target.kind, 'empty');
  handles.get('present:publish')!(controlEvent, game('run-crashed', 2));
  fourth.webContents.emit('render-process-gone');
  assert.deepEqual(JSON.parse(JSON.stringify(control.webContents.messages.filter(m => m.channel === 'present:game-ended').at(-1)?.data)), { instanceId: 'run-crashed', reason: 'crashed' });
  assert.equal(control.destroyed, false);
  const launchGame = handles.get('present:launch-game');
  assert.ok(launchGame, 'game launch registers ownership atomically before opening Present');
  await assert.rejects(launchGame(event(fourth), game('untrusted', 3)), /Control/);
  await launchGame(controlEvent, game('run-atomic', 3));
  const fifth = windows[5];
  assert.equal(handles.get('present:snapshot')!(event(fifth)).snapshot.target.instanceId, 'run-atomic');
  fifth.close();
  assert.deepEqual(JSON.parse(JSON.stringify(control.webContents.messages.filter(m => m.channel === 'present:game-ended').at(-1)?.data)), { instanceId: 'run-atomic', reason: 'closed' });
  await handles.get('present:open')!(controlEvent);
  assert.equal(handles.get('present:snapshot')!(event(windows[6])).snapshot.target.kind, 'empty', 'a closed launched owner cannot be resurrected');
});

test('renderer revocation is applied even when snapshot sequence is unchanged', () => {
  const previous = { generation: 0, sequence: 2, snapshot: null, rendererGeneration: 1 };
  assert.equal(assessPresentEnvelope(previous, { ...previous, rendererGeneration: 2 }), 'apply');
  assert.equal(assessPresentEnvelope({ ...previous, rendererGeneration: 2 }, previous), 'ignore');
});
test('video projection accepts only whitelisted executable intent with local media', () => {
  const media = { identity: 'a', epoch: 3, bridgeEpoch: 2, rendererGeneration: 1, playing: false, positionSec: 2, volume: 0.5, enabled: true, teacherNotes: 'private' };
  const parsed = parsePresentSnapshot({ ...snapshot(1), target: { ...snapshot(1).target, kind: 'video', media, teacherNotes: 'private' } });
  assert.equal(parsed?.target.kind, 'video');
  assert.equal('teacherNotes' in parsed!.target, false);
  if (parsed?.target.kind === 'video') assert.equal('teacherNotes' in parsed.target.media, false);
  assert.equal(parsePresentSnapshot({ ...snapshot(1), target: { ...snapshot(1).target, kind: 'video', media: { ...media, bridgeEpoch: -1 } } }), null);
});

test('static scene whitelist preserves logical geometry, adjustments and visible student text only', () => {
  const scene = { frame: { width: 1200, height: 700 }, adjustments: { flipX: true, brightness: 0.8 }, overlays: [{ id: 'a', type: 'textBox', text: 'Hello', x: 30, y: 40, width: 200, height: 100, notes: 'private', tags: ['private'] }], teacherNotes: 'secret' };
  const parsed = parsePresentSnapshot({ ...snapshot(1), target: { ...snapshot(1).target, scene } }) as any;
  assert.equal(parsed.target.scene.frame.width, 1200);
  assert.equal(parsed.target.scene.overlays[0].text, 'Hello');
  assert.equal(parsed.target.scene.overlays[0].notes, undefined);
  assert.equal(parsed.target.scene.overlays[0].tags, undefined);
  assert.equal(parsed.target.scene.teacherNotes, undefined);
  assert.equal(parsePresentSnapshot({ ...snapshot(1), target: { ...snapshot(1).target, scene: { ...scene, frame: { width: 0, height: 10 } } } }), null);
});
import { fitLogicalFrame } from './staticScene';
test('logical frame preserves coordinates under resize and aspect changes', () => {
  assert.deepEqual(fitLogicalFrame({ width: 1000, height: 600 }, { width: 500, height: 500 }), { scale: 0.5, x: 0, y: 100 });
});

test('asset readiness cannot survive scene unmount or accept removed graphics', () => {
  const source = readFileSync(path.join(process.cwd(), 'src/renderer/present.tsx'), 'utf8');
  assert.match(source, /function PresentImageScene/);
  assert.doesNotMatch(source, /loadedSrc/);
  const visual = readFileSync(path.join(process.cwd(), 'src/renderer/StaticScene.tsx'), 'utf8');
  assert.match(visual, /onGraphicLoad/);
  assert.match(visual, /onGraphicError/);
});
import { SceneReadiness } from './staticScene';
test('remounted scene requires fresh image and graphic events; removed assets cannot make it ready', () => {
  const first = new SceneReadiness(['image', 'bubble']);
  first.settle('image'); assert.equal(first.state, 'loading');
  first.settle('bubble'); assert.equal(first.state, 'ready');
  const remounted = new SceneReadiness(['image', 'new bubble']);
  assert.equal(remounted.state, 'loading');
  remounted.settle('image'); remounted.settle('bubble'); assert.equal(remounted.state, 'loading');
  remounted.settle('new bubble', true); assert.equal(remounted.state, 'error');
});

test('drawing snapshots recover committed and transient strokes with logical viewport and no private fields', () => {
  const stroke = { id: 'm1', size: 5, opacity: 0.7, color: '#ffaa00', rainbow: false, points: [{ x: 0.25, y: 0.5, t: 123, secret: 'no' }], private: 'no' };
  const value = { ...snapshot(33), target: { ...snapshot(33).target, scene: { frame: { width: 1000, height: 600 }, overlays: [], viewport: { zoom: 2, pan: { x: -200, y: -100 } }, markerStrokes: [stroke], transient: [{ ...stroke, id: 'h1', fadeMs: 700, sparkle: true }] } } };
  const relay = new PresentSnapshotRelay();
  const parsed = relay.publish(value)!.snapshot!.target as any;
  assert.deepEqual(parsed.scene.viewport, value.target.scene.viewport);
  assert.equal(parsed.scene.markerStrokes[0].private, undefined);
  assert.equal(parsed.scene.markerStrokes[0].points[0].secret, undefined);
  assert.equal(parsed.scene.transient[0].fadeMs, 700);
  assert.equal((relay.envelope.snapshot!.target as any).scene.markerStrokes[0].points[0].x, 0.25);
  assert.equal(parsePresentSnapshot({ ...value, target: { ...value.target, scene: { ...value.target.scene, viewport: { zoom: Infinity, pan: { x: 0, y: 0 } } } } }), null);
});
test('prompt projects only student text with canonical frame and passive activity', () => {
 const parsed = parsePresentSnapshot({ sessionId: 'p', revision: 1, target: { kind: 'prompt', occurrenceId: 'prompt1', title: 'Discuss', body: 'What happens next?', teacherNotes: 'secret', scene: { frame: { width: 800, height: 600 }, overlays: [] }, activity: { boards: [], cards: {}, images: {}, overlays: { instances: [], states: {} } } } });
 assert.ok(parsed); assert.equal(parsed.target.kind, 'prompt');
 assert.equal((parsed.target as any).body, 'What happens next?');
 assert.equal((parsed.target as any).teacherNotes, undefined);
 assert.equal(parsePresentSnapshot({ sessionId: 'p', revision: 1, target: { kind: 'prompt', occurrenceId: 'prompt1', title: {}, body: 'x' } }), null);
});
