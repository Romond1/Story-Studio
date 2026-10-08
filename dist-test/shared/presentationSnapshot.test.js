"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const presentationSnapshot_1 = require("./presentationSnapshot");
const node_events_1 = require("node:events");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const cardV2Render_1 = require("./cardV2Render");
const snapshot = (revision, sessionId = 'lesson') => ({ sessionId, revision, target: { kind: 'image', occurrenceId: 'story:slide1', src: 'media://asset/image.png' } });
(0, node_test_1.default)('card overlays whitelist active student faces on ordinary presentation targets', () => {
    const card = (0, cardV2Render_1.buildCardV2FacePlan)({ id: 'card', style: { preset: 'classroom' }, faces: [{ id: 'front', layout: 'text', text: 'Visible answer' }] }, 'front', { x: 20, y: 30, width: 300, height: 200 });
    const raw = { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [{ ...card, teacherNotes: 'private', inactiveFaces: ['private'] }, { ...card, instanceId: 'hidden', concealed: true, image: { src: 'media://hidden.png', box: card.box }, texts: card.texts }], definitions: ['private'] };
    const scene = { frame: { width: 1280, height: 720 }, overlays: [] };
    const activity = { boards: [], cards: {}, images: {}, overlays: { instances: [], states: {} } };
    const media = { identity: 'a', epoch: 3, bridgeEpoch: 2, rendererGeneration: 1, playing: false, positionSec: 2, volume: 0.5, enabled: true };
    const targets = [snapshot(1).target, { ...snapshot(1).target, kind: 'video', media }, { kind: 'break', occurrenceId: 'break', scene, activity }, { kind: 'board', occurrenceId: 'board', scene, activity }, { kind: 'prompt', occurrenceId: 'prompt', scene, activity, title: 'Talk', body: 'Explain' }];
    for (const target of targets) {
        const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target, cardsV2: raw });
        strict_1.default.ok(parsed);
        strict_1.default.deepEqual(parsed.cardsV2, (0, cardV2Render_1.parseCardV2RenderPlan)(raw));
        strict_1.default.equal(parsed.cardsV2.definitions, undefined);
        strict_1.default.equal(parsed.cardsV2.cards[0].teacherNotes, undefined);
        strict_1.default.deepEqual(parsed.cardsV2.cards[1].texts, []);
        strict_1.default.equal(parsed.cardsV2.cards[1].image, undefined);
    }
    const standalone = (0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target: { kind: 'cards-v2', occurrenceId: 'cards', plan: raw } });
    strict_1.default.equal(standalone?.target.kind, 'cards-v2');
    strict_1.default.deepEqual(standalone.target.plan, (0, cardV2Render_1.parseCardV2RenderPlan)(raw));
    strict_1.default.equal(standalone.cardsV2, undefined);
});
(0, node_test_1.default)('invalid card overlays are rejected without replacing the relay safe snapshot', () => {
    const relay = new presentationSnapshot_1.PresentSnapshotRelay();
    const safe = relay.publish(snapshot(1));
    for (const cardsV2 of [null, {}, { engine: 'card-v2', version: 1, frame: { width: -1, height: 720 }, cards: [] }]) {
        strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(2), cardsV2 }), null);
        strict_1.default.equal(relay.publish({ ...snapshot(2), cardsV2 }), null);
        strict_1.default.equal(relay.envelope, safe);
    }
});
(0, node_test_1.default)('Control namespaces card image URLs in standalone and overlay snapshots without mutating the plan', () => {
    const published = [];
    const exports = {};
    const source = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), 'src/renderer/usePresentProjection.ts'), 'utf8'), { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
    node_vm_1.default.runInNewContext(source, { exports, console, window: { appApi: { publishPresentSnapshot: async (value) => { published.push(value); } } }, require: (name) => {
            if (name === 'react')
                return { useRef: (current) => ({ current }), useState: () => [0, () => { }], useEffect: (effect) => effect() };
            if (name === '../shared/visualMedia')
                return require('./visualMedia');
            if (name === '../shared/sceneTransition')
                return require('./sceneTransition');
            if (name === '../shared/activityScene')
                return require('./activityScene');
            throw new Error(`Unexpected dependency ${name}`);
        } });
    const card = (0, cardV2Render_1.buildCardV2FacePlan)({ id: 'card', style: { preset: 'classroom' }, faces: [{ id: 'front', layout: 'image-only', imageAssetId: 'picture' }] }, 'front', { x: 20, y: 30, width: 300, height: 200 }, () => 'media://picture.png');
    const plan = { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [card] };
    const session = { sessionId: 'lesson', projectId: 'project', revision: 1, targetRevision: 1, overlays: { movement: null } };
    for (const kind of ['cards-v2', 'slide']) {
        exports.usePresentProjection(session, { kind, occurrenceId: 'target', contentId: 'card' }, { mediaType: 'image' }, 'media://base.png', undefined, undefined, 5, undefined, undefined, plan);
        const projected = published.at(-1);
        const projectedPlan = kind === 'cards-v2' ? projected.target.plan : projected.cardsV2;
        strict_1.default.ok(projectedPlan);
        strict_1.default.equal(new URL(projectedPlan.cards[0].image.src).searchParams.get('sceneScope'), JSON.stringify(['lesson', 'project', 5]));
        strict_1.default.equal(card.image.src, 'media://picture.png');
        if (kind === 'cards-v2')
            strict_1.default.equal(projected.cardsV2, undefined);
    }
});
(0, node_test_1.default)('Present waits for both the base scene and card overlay images before reporting readiness', () => {
    const card = (0, cardV2Render_1.buildCardV2FacePlan)({ id: 'card', style: { preset: 'classroom' }, faces: [{ id: 'front', layout: 'image-only', imageAssetId: 'picture' }] }, 'front', { x: 20, y: 30, width: 300, height: 200 }, () => 'media://picture.png');
    const envelope = { generation: 1, sequence: 2, snapshot: { ...snapshot(1), cardsV2: { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [card] } } };
    for (const order of ['cards-first', 'base-first', 'card-error']) {
        const applied = [], images = [], hooks = [];
        let index = 0;
        const effects = [];
        const React = require('react');
        const fakeReact = { ...React,
            useRef: (initial) => { const slot = index++; return hooks[slot] ??= { current: initial }; },
            useState: (initial) => { const slot = index++; if (!(slot in hooks))
                hooks[slot] = slot === 2 ? envelope : initial; return [hooks[slot], (next) => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next; }]; },
            useEffect: (effect, deps) => { const slot = index++; if (!hooks[slot] || deps.some((dep, i) => dep !== hooks[slot][i])) {
                hooks[slot] = deps;
                effects.push(effect);
            } },
        };
        const exports = {};
        const source = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), 'src/renderer/present.tsx'), 'utf8') + '\nexport { Present };', { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021, jsx: typescript_1.default.JsxEmit.React, esModuleInterop: true } }).outputText;
        const Stub = () => null;
        node_vm_1.default.runInNewContext(source, { exports, console, document: { getElementById: () => ({}) }, window: { presentApi: { reportApplied: (...args) => applied.push(args), subscribeSnapshot: () => () => { }, requestSnapshot: () => new Promise(() => { }) } }, Image: class {
                constructor() { images.push(this); }
            }, require: (name) => {
                if (name === 'react')
                    return fakeReact;
                if (name === 'react-dom/client')
                    return { createRoot: () => ({ render: () => { } }) };
                if (name === '../shared/presentationSnapshot')
                    return { assessPresentEnvelope: presentationSnapshot_1.assessPresentEnvelope };
                if (name === '../shared/cardV2Render')
                    return require('./cardV2Render');
                if (name === '../shared/staticScene')
                    return require('./staticScene');
                if (name.endsWith('.css'))
                    return {};
                return { PromptCardScene: Stub, RewardSurface: Stub, MovementSurface: Stub, TransitionLayers: Stub, PresentVideoScene: Stub, StudentSceneBoundary: Stub, PassiveActivities: Stub, LogicalSceneFrame: Stub, PassiveImage: Stub, PassiveOverlays: Stub, PassiveDrawings: Stub, CardV2Scene: Stub, overlayGraphic: () => null };
            } });
        const render = () => { index = 0; const tree = exports.Present(); while (effects.length)
            effects.shift()(); return tree; };
        const tree = render();
        const report = tree.props.children[0].props.children[0].props.report;
        strict_1.default.equal(images.length, 1);
        strict_1.default.equal(applied.length, 0);
        if (order === 'cards-first') {
            images[0].onload();
            render();
            strict_1.default.equal(applied.length, 0);
            report(1, 2);
            render();
            strict_1.default.deepEqual(applied, [[1, 2]]);
        }
        else {
            report(1, 2);
            render();
            strict_1.default.equal(applied.length, 0);
            if (order === 'card-error')
                images[0].onerror();
            else
                images[0].onload();
            render();
            strict_1.default.deepEqual(applied, order === 'card-error' ? [[1, 2, true, 'Card image could not be displayed']] : [[1, 2]]);
        }
    }
});
(0, node_test_1.default)('snapshot projection strips teacher data and rejects invalid revisions or media', () => {
    strict_1.default.deepEqual((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), students: ['private'], target: { ...snapshot(1).target, notes: 'private' } }), snapshot(1));
    for (const bad of [NaN, -1, 1.2, Infinity])
        strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)(snapshot(bad)), null);
    for (const src of ['https://example.com/a.png', 'javascript:alert(1)', 'file:///private'])
        strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target: { ...snapshot(1).target, src } }), null);
});
(0, node_test_1.default)('relay rejects duplicate/stale revisions and retired sessions while preserving full latest state', () => {
    const relay = new presentationSnapshot_1.PresentSnapshotRelay();
    strict_1.default.equal(relay.publish(snapshot(5))?.sequence, 1);
    strict_1.default.equal(relay.publish(snapshot(4)), null);
    strict_1.default.equal(relay.publish(snapshot(5)), null);
    strict_1.default.equal(relay.publish(snapshot(9))?.sequence, 2);
    strict_1.default.equal(relay.publish(snapshot(0, 'new'))?.sequence, 3);
    strict_1.default.equal(relay.publish(snapshot(10)), null);
    strict_1.default.deepEqual(relay.envelope.snapshot, snapshot(0, 'new'));
});
(0, node_test_1.default)('Control reset clears stale image and permits fresh renderer state; Present recovery uses latest full snapshot', () => {
    const relay = new presentationSnapshot_1.PresentSnapshotRelay();
    const old = relay.publish(snapshot(8));
    const reset = relay.reset();
    strict_1.default.equal(reset.snapshot, null);
    strict_1.default.equal(reset.generation, 1);
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)(old, reset), 'apply');
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)(reset, old), 'ignore');
    strict_1.default.equal(relay.publish(snapshot(0))?.sequence, 1);
    const first = relay.envelope;
    relay.publish(snapshot(1));
    relay.publish(snapshot(2));
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)(first, relay.envelope), 'recover');
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)(null, relay.envelope), 'apply');
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)(relay.envelope, relay.envelope), 'ignore');
});
(0, node_test_1.default)('Present lifecycle stays passive, recovers latest snapshot and rejects foreign IPC senders', async () => {
    const handles = new Map();
    const events = new Map();
    const windows = [];
    const displayEvents = new node_events_1.EventEmitter();
    class FakeContents extends node_events_1.EventEmitter {
        constructor() {
            super(...arguments);
            this.mainFrame = {};
            this.messages = [];
        }
        isDestroyed() { return false; }
        send(channel, data) { this.messages.push({ channel, data }); }
        setWindowOpenHandler(_callback) { }
    }
    class FakeWindow extends node_events_1.EventEmitter {
        constructor(options = {}) {
            super();
            this.options = options;
            this.webContents = new FakeContents();
            this.destroyed = false;
            this.shown = 0;
            this.bounds = { x: 50, y: 50, width: 800, height: 600 };
            windows.push(this);
        }
        isDestroyed() { return this.destroyed; }
        getBounds() { return this.bounds; }
        setBounds(bounds) { this.bounds = bounds; }
        setMenu(_menu) { }
        show() { this.shown++; }
        focus() { }
        async loadFile(_file) { this.webContents.emit('did-finish-load'); }
        async loadURL(_url) { this.webContents.emit('did-finish-load'); }
        close() { this.emit('close'); this.destroy(); }
        destroy() { this.destroyed = true; this.emit('closed'); }
    }
    const exports = {};
    const source = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), 'src/main/presentWindow.ts'), 'utf8'), { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
    node_vm_1.default.runInNewContext(source, { exports, __dirname: process.cwd(), process: { env: {} }, console, require: (name) => {
            if (name === 'electron')
                return { BrowserWindow: FakeWindow, ipcMain: { handle: (key, fn) => handles.set(key, fn), on: (key, fn) => events.set(key, fn) }, screen: { on: (name, listener) => displayEvents.on(name, listener), getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1200, height: 800 } }), getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1200, height: 800 } }] } };
            if (name === 'node:path')
                return node_path_1.default;
            if (name === '../shared/presentationSnapshot')
                return { PresentSnapshotRelay: presentationSnapshot_1.PresentSnapshotRelay };
            if (name === '../shared/presentationMedia')
                return require('./presentationMedia');
            if (name === '../shared/teachWorkspace')
                return require('./teachWorkspace');
            throw new Error(`Unexpected dependency ${name}`);
        } });
    const control = new FakeWindow();
    exports.installPresentWindow(() => control);
    const event = (window) => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
    const controlEvent = event(control);
    strict_1.default.equal(handles.get('present:publish')(controlEvent, snapshot(1)), true);
    await handles.get('present:open')(controlEvent);
    const first = windows[1];
    events.get('present:viewport')(controlEvent, { width: 10, height: 10 });
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).viewport, undefined);
    events.get('present:viewport')(event(first), { width: 1280, height: 720 });
    strict_1.default.deepEqual(handles.get('present:get-status')(controlEvent).viewport, { width: 1280, height: 720 });
    const beforeResize = handles.get('present:snapshot')(event(first));
    events.get('present:viewport')({ sender: first.webContents, senderFrame: {} }, { width: 1, height: 1 });
    events.get('present:viewport')(event(first), { width: -1, height: NaN });
    strict_1.default.deepEqual(handles.get('present:get-status')(controlEvent).viewport, { width: 1280, height: 720 });
    events.get('present:viewport')(event(first), { width: 480, height: 900 });
    strict_1.default.deepEqual(handles.get('present:get-status')(controlEvent).viewport, { width: 480, height: 900 });
    strict_1.default.deepEqual(handles.get('present:snapshot')(event(first)), beforeResize);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'connecting');
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).needsReshare, false);
    events.get('present:status')(event(first), 0, 1, false);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'ready');
    events.get('present:status')(event(first), 0, 0, true);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'ready');
    strict_1.default.throws(() => handles.get('present:get-status')(event(first)), /Control/);
    handles.get('present:publish')(controlEvent, snapshot(2));
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'connecting');
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).sequence, 2);
    events.get('present:status')(event(first), 0, 1, false);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'connecting');
    events.get('present:status')(event(first), 0, 2, false);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'ready');
    events.get('present:status')(event(first), 0, 2, true, 'Card content failed');
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).detail, 'Card content failed');
    events.get('present:status')(controlEvent, 0, 2, true, 'Untrusted sender');
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).detail, 'Card content failed');
    events.get('present:status')(event(first), 0, 2, false);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).detail, undefined);
    strict_1.default.equal(first.options.webPreferences.contextIsolation, true);
    strict_1.default.equal(first.options.webPreferences.nodeIntegration, false);
    strict_1.default.equal(first.options.webPreferences.sandbox, true);
    strict_1.default.equal(first.options.webPreferences.backgroundThrottling, false);
    strict_1.default.deepEqual(first.webContents.messages.slice(-1)[0].data.snapshot, snapshot(2));
    strict_1.default.throws(() => handles.get('present:publish')(event(first), snapshot(2)), /Only Control/);
    strict_1.default.throws(() => handles.get('present:publish')({ sender: control.webContents, senderFrame: {} }, snapshot(2)), /Only Control/);
    await strict_1.default.rejects(handles.get('present:open')(event(first)), /Control/);
    strict_1.default.throws(() => handles.get('present:snapshot')(controlEvent), /Only Present/);
    const runtime = handles.get('present:media-runtime')(controlEvent);
    const media = { identity: 'video-activation', epoch: 3, bridgeEpoch: 3, rendererGeneration: runtime.generation, playing: false, positionSec: 0, volume: 1, enabled: true };
    handles.get('present:publish')(controlEvent, { ...snapshot(3), target: { kind: 'video', occurrenceId: 'video', src: 'media://asset/tone.webm', media } });
    const signal = { generation: runtime.generation, identity: media.identity, bridgeEpoch: media.bridgeEpoch, type: 'offer', description: { type: 'offer', sdp: 'test' } };
    const delivered = () => control.webContents.messages.filter(m => m.channel === 'present:media-signal').length;
    const before = delivered();
    events.get('present:media-signal')(controlEvent, signal); // Direction is authenticated, not trusted from payload.
    events.get('present:media-signal')({ sender: first.webContents, senderFrame: {} }, signal);
    events.get('present:media-signal')(event(first), { ...signal, bridgeEpoch: 2 });
    strict_1.default.equal(delivered(), before);
    events.get('present:media-signal')(event(first), signal);
    strict_1.default.equal(delivered(), before + 1);
    strict_1.default.throws(() => handles.get('present:media-revoke')(event(first)), /Only Control/);
    handles.get('present:media-revoke')(controlEvent);
    events.get('present:media-signal')(event(first), signal);
    strict_1.default.equal(delivered(), before + 1);
    strict_1.default.ok(handles.get('present:snapshot')(event(first)).rendererGeneration > runtime.generation);
    for (let revision = 2; revision <= 25; revision++)
        handles.get('present:publish')(controlEvent, snapshot(revision));
    strict_1.default.equal(handles.get('present:snapshot')(event(first)).snapshot.revision, 25);
    first.webContents.emit('did-finish-load'); // Reload receives latest, not initial state.
    strict_1.default.equal(first.webContents.messages.slice(-1)[0].data.snapshot.revision, 25);
    first.close();
    strict_1.default.equal(control.destroyed, false);
    strict_1.default.deepEqual(handles.get('present:get-status')(controlEvent).viewport, { width: 480, height: 900 });
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'closed');
    await handles.get('present:open')(controlEvent);
    const second = windows[2];
    strict_1.default.equal(second.webContents.messages.slice(-1)[0].data.snapshot.revision, 25);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).needsReshare, true);
    second.bounds = { x: 2200, y: 100, width: 800, height: 600 };
    displayEvents.emit('display-removed');
    strict_1.default.ok(second.bounds.x + second.bounds.width <= 1200);
    second.webContents.emit('render-process-gone');
    strict_1.default.equal(second.destroyed, true);
    strict_1.default.equal(handles.get('present:get-status')(controlEvent).state, 'error');
    await handles.get('present:open')(controlEvent);
    const third = windows[3];
    strict_1.default.equal(third.webContents.messages.slice(-1)[0].data.snapshot.revision, 25);
    control.webContents.emit('did-start-navigation', {}, 'app', false, true);
    strict_1.default.equal(third.webContents.messages.slice(-1)[0].data.snapshot, null);
    handles.get('present:publish')(controlEvent, snapshot(0, 'fresh'));
    control.webContents.emit('render-process-gone');
    strict_1.default.equal(third.webContents.messages.slice(-1)[0].data.snapshot, null);
    strict_1.default.equal(control.destroyed, false);
});
(0, node_test_1.default)('renderer revocation is applied even when snapshot sequence is unchanged', () => {
    const previous = { generation: 0, sequence: 2, snapshot: null, rendererGeneration: 1 };
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)(previous, { ...previous, rendererGeneration: 2 }), 'apply');
    strict_1.default.equal((0, presentationSnapshot_1.assessPresentEnvelope)({ ...previous, rendererGeneration: 2 }, previous), 'ignore');
});
(0, node_test_1.default)('video projection accepts only whitelisted executable intent with local media', () => {
    const media = { identity: 'a', epoch: 3, bridgeEpoch: 2, rendererGeneration: 1, playing: false, positionSec: 2, volume: 0.5, enabled: true, teacherNotes: 'private' };
    const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target: { ...snapshot(1).target, kind: 'video', media, teacherNotes: 'private' } });
    strict_1.default.equal(parsed?.target.kind, 'video');
    strict_1.default.equal('teacherNotes' in parsed.target, false);
    if (parsed?.target.kind === 'video')
        strict_1.default.equal('teacherNotes' in parsed.target.media, false);
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target: { ...snapshot(1).target, kind: 'video', media: { ...media, bridgeEpoch: -1 } } }), null);
});
(0, node_test_1.default)('static scene whitelist preserves logical geometry, adjustments and visible student text only', () => {
    const scene = { frame: { width: 1200, height: 700 }, adjustments: { flipX: true, brightness: 0.8 }, overlays: [{ id: 'a', type: 'textBox', text: 'Hello', x: 30, y: 40, width: 200, height: 100, notes: 'private', tags: ['private'] }], teacherNotes: 'secret' };
    const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target: { ...snapshot(1).target, scene } });
    strict_1.default.equal(parsed.target.scene.frame.width, 1200);
    strict_1.default.equal(parsed.target.scene.overlays[0].text, 'Hello');
    strict_1.default.equal(parsed.target.scene.overlays[0].notes, undefined);
    strict_1.default.equal(parsed.target.scene.overlays[0].tags, undefined);
    strict_1.default.equal(parsed.target.scene.teacherNotes, undefined);
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot(1), target: { ...snapshot(1).target, scene: { ...scene, frame: { width: 0, height: 10 } } } }), null);
});
const staticScene_1 = require("./staticScene");
(0, node_test_1.default)('logical frame preserves coordinates under resize and aspect changes', () => {
    strict_1.default.deepEqual((0, staticScene_1.fitLogicalFrame)({ width: 1000, height: 600 }, { width: 500, height: 500 }), { scale: 0.5, x: 0, y: 100 });
});
(0, node_test_1.default)('asset readiness cannot survive scene unmount or accept removed graphics', () => {
    const source = (0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), 'src/renderer/present.tsx'), 'utf8');
    strict_1.default.match(source, /function PresentImageScene/);
    strict_1.default.doesNotMatch(source, /loadedSrc/);
    const visual = (0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), 'src/renderer/StaticScene.tsx'), 'utf8');
    strict_1.default.match(visual, /onGraphicLoad/);
    strict_1.default.match(visual, /onGraphicError/);
});
const staticScene_2 = require("./staticScene");
(0, node_test_1.default)('remounted scene requires fresh image and graphic events; removed assets cannot make it ready', () => {
    const first = new staticScene_2.SceneReadiness(['image', 'bubble']);
    first.settle('image');
    strict_1.default.equal(first.state, 'loading');
    first.settle('bubble');
    strict_1.default.equal(first.state, 'ready');
    const remounted = new staticScene_2.SceneReadiness(['image', 'new bubble']);
    strict_1.default.equal(remounted.state, 'loading');
    remounted.settle('image');
    remounted.settle('bubble');
    strict_1.default.equal(remounted.state, 'loading');
    remounted.settle('new bubble', true);
    strict_1.default.equal(remounted.state, 'error');
});
(0, node_test_1.default)('drawing snapshots recover committed and transient strokes with logical viewport and no private fields', () => {
    const stroke = { id: 'm1', size: 5, opacity: 0.7, color: '#ffaa00', rainbow: false, points: [{ x: 0.25, y: 0.5, t: 123, secret: 'no' }], private: 'no' };
    const value = { ...snapshot(33), target: { ...snapshot(33).target, scene: { frame: { width: 1000, height: 600 }, overlays: [], viewport: { zoom: 2, pan: { x: -200, y: -100 } }, markerStrokes: [stroke], transient: [{ ...stroke, id: 'h1', fadeMs: 700, sparkle: true }] } } };
    const relay = new presentationSnapshot_1.PresentSnapshotRelay();
    const parsed = relay.publish(value).snapshot.target;
    strict_1.default.deepEqual(parsed.scene.viewport, value.target.scene.viewport);
    strict_1.default.equal(parsed.scene.markerStrokes[0].private, undefined);
    strict_1.default.equal(parsed.scene.markerStrokes[0].points[0].secret, undefined);
    strict_1.default.equal(parsed.scene.transient[0].fadeMs, 700);
    strict_1.default.equal(relay.envelope.snapshot.target.scene.markerStrokes[0].points[0].x, 0.25);
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...value, target: { ...value.target, scene: { ...value.target.scene, viewport: { zoom: Infinity, pan: { x: 0, y: 0 } } } } }), null);
});
(0, node_test_1.default)('prompt projects only student text with canonical frame and passive activity', () => {
    const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 'p', revision: 1, target: { kind: 'prompt', occurrenceId: 'prompt1', title: 'Discuss', body: 'What happens next?', teacherNotes: 'secret', scene: { frame: { width: 800, height: 600 }, overlays: [] }, activity: { boards: [], cards: {}, images: {}, overlays: { instances: [], states: {} } } } });
    strict_1.default.ok(parsed);
    strict_1.default.equal(parsed.target.kind, 'prompt');
    strict_1.default.equal(parsed.target.body, 'What happens next?');
    strict_1.default.equal(parsed.target.teacherNotes, undefined);
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 'p', revision: 1, target: { kind: 'prompt', occurrenceId: 'prompt1', title: {}, body: 'x' } }), null);
});
