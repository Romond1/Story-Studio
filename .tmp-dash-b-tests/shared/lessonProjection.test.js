"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const commands_1 = require("./lesson/commands");
const session_1 = require("./lesson/session");
const projection_1 = require("./lesson/projection");
const presentationSnapshot_1 = require("./presentationSnapshot");
const staticScene_1 = require("./staticScene");
const rewards_1 = require("./lesson/rewards");
const projection_2 = require("./lesson/projection");
function fixture(mediaType = 'image') {
    const scene = (0, commands_1.createScene)('Proof scene', 'asset');
    scene.frame = { width: 960, height: 720 };
    scene.notes = 'Teacher-only notes';
    const added = (0, commands_1.insertScene)((0, commands_1.createLesson)('Proof'), 'story', scene);
    const card = (0, commands_1.addCard)({ ...added.project, assets: [{ id: 'asset', relativePath: `assets/proof.${mediaType === 'image' ? 'png' : 'mp4'}`, filename: 'proof', originalName: 'proof', mediaType, sizeBytes: 10, importedAt: '2026-10-08' }] }, scene.id);
    const placed = card.project.scenes[scene.id].objects.find(object => object.id === card.objectId);
    if (placed.kind === 'card') {
        const faces = card.project.cards[placed.cardId].faces;
        faces[0].text = 'Question';
        faces[1].text = 'Answer';
    }
    const bubble = (0, commands_1.addText)(card.project, scene.id, 'bubble');
    return { project: bubble.project, sceneId: scene.id, entryId: added.entryId, cardId: card.objectId, bubbleId: bubble.objectId };
}
(0, node_test_1.default)('new scene image/video, cards and bubbles project as one ordered frame without teacher content', () => {
    for (const mediaType of ['image', 'video']) {
        const f = fixture(mediaType), plan = (0, projection_1.projectScene)(f.project, f.sceneId);
        strict_1.default.equal(plan.background.mediaType, mediaType);
        strict_1.default.deepEqual(plan.frame, { width: 960, height: 720 });
        strict_1.default.deepEqual(plan.objects.map(object => [object.id, object.kind]), [[f.cardId, 'card'], [f.bubbleId, 'bubble']]);
        strict_1.default.ok(JSON.stringify(plan).includes('Question'));
        strict_1.default.equal(JSON.stringify(plan).includes('Answer'), false);
        strict_1.default.equal(JSON.stringify(plan).includes('Teacher-only notes'), false);
        strict_1.default.deepEqual((0, projection_1.parseScenePlan)(plan), plan);
    }
});
(0, node_test_1.default)('current authored changes, duplication and deletion immediately feed the student projection', () => {
    const f = fixture();
    const initial = (0, session_1.navigate)(f.project, (0, session_1.createSession)(), { sequence: 'story', entryId: f.entryId });
    const shown = (0, session_1.cardAction)(f.project, initial, f.cardId, 'next');
    const live = (0, projection_1.projectScene)(f.project, f.sceneId, shown);
    strict_1.default.ok(JSON.stringify(live).includes('Answer'));
    const object = f.project.scenes[f.sceneId].objects.find(item => item.id === f.cardId);
    const moved = (0, commands_1.putObject)(f.project, f.sceneId, { ...object, box: { x: 180, y: 90, width: 420, height: 200 } });
    strict_1.default.deepEqual((0, projection_1.projectScene)(moved, f.sceneId, shown).objects[0].box, { x: 180, y: 90, width: 420, height: 200 });
    const duplicate = (0, commands_1.duplicateObject)(moved, f.sceneId, f.cardId);
    strict_1.default.equal((0, projection_1.projectScene)(duplicate.project, f.sceneId, shown).objects.filter(item => item.kind === 'card').length, 2);
    const removed = (0, commands_1.removeObject)(duplicate.project, f.sceneId, f.cardId);
    strict_1.default.deepEqual((0, projection_1.projectScene)(removed, f.sceneId, shown).objects.map(item => item.id), [f.bubbleId, duplicate.objectId]);
    strict_1.default.equal(Object.keys(removed.cards).length, 2);
    const concealed = (0, projection_1.projectScene)(f.project, f.sceneId, (0, session_1.cardAction)(f.project, shown, f.cardId, 'conceal'));
    strict_1.default.equal(JSON.stringify(concealed).includes('Answer'), false);
    const reset = (0, projection_1.projectScene)(f.project, f.sceneId, (0, session_1.resetScene)(f.project, shown));
    strict_1.default.ok(JSON.stringify(reset).includes('Question'));
});
(0, node_test_1.default)('scene IPC rejects remote media and malformed geometry and strips private fields and concealed faces', () => {
    const f = fixture(), plan = (0, projection_1.projectScene)(f.project, f.sceneId);
    strict_1.default.equal((0, projection_1.parseScenePlan)({ ...plan, background: { color: '#000000', src: 'https://tracker.invalid/image.png', mediaType: 'image' } }), null);
    strict_1.default.equal((0, projection_1.parseScenePlan)({ ...plan, objects: [{ ...plan.objects[0], box: { x: NaN, y: 0, width: 10, height: 10 } }] }), null);
    const card = plan.objects[0];
    strict_1.default.equal(card.kind, 'card');
    if (card.kind !== 'card')
        return;
    const raw = { ...plan, notes: 'private', objects: [{ ...card, card: { ...card.card, concealed: true, privateFaces: ['secret'], image: { src: 'media://secret.png' } } }] };
    const clean = (0, projection_1.parseScenePlan)(raw);
    strict_1.default.ok(clean);
    strict_1.default.equal(JSON.stringify(clean).includes('private'), false);
    strict_1.default.equal(JSON.stringify(clean).includes('secret'), false);
    const snapshot = (0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 's', revision: 1, target: { kind: 'scene', occurrenceId: 'entry', plan, teacherNotes: 'secret' } });
    strict_1.default.equal(snapshot?.target.kind, 'scene');
    strict_1.default.equal(JSON.stringify(snapshot).includes('secret'), false);
});
/** Load real TSX components for server rendering; only DOM mounting and CSS imports are omitted. */
function rendererModule(relative) {
    const cache = new Map();
    const React = require('react');
    const load = (filename) => {
        if (cache.has(filename))
            return cache.get(filename).exports;
        const module = { exports: {} };
        cache.set(filename, module);
        const js = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)(filename, 'utf8'), { fileName: filename, compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021, jsx: typescript_1.default.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
        const dependency = (name) => {
            if (name.endsWith('.css'))
                return {};
            if (/\.(gif|png|svg|jpe?g|webp)$/.test(name))
                return name;
            if (name === 'react')
                return { ...React, useLayoutEffect: () => { } };
            if (name === 'react-dom/client')
                return { createRoot: () => ({ render: () => { } }) };
            if (!name.startsWith('.'))
                return require(name);
            const base = node_path_1.default.resolve(node_path_1.default.dirname(filename), name);
            const target = ['', '.ts', '.tsx', '.js'].map(extension => base + extension).find(node_fs_1.existsSync);
            if (!target)
                throw new Error(`Missing renderer dependency: ${name}`);
            return load(target);
        };
        node_vm_1.default.runInNewContext(js, { module, exports: module.exports, require: dependency, console, window: { presentApi: {} }, document: { getElementById: () => ({}) }, setTimeout, clearTimeout, setInterval, clearInterval });
        return module.exports;
    };
    return load(node_path_1.default.resolve(process.cwd(), relative));
}
(0, node_test_1.default)('actual Edit, Teach and Present renderer boundaries produce the exact same authored composition', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
    const { PresentLessonScene } = rendererModule('src/renderer/present.tsx');
    const f = fixture(), plan = (0, projection_1.projectScene)(f.project, f.sceneId);
    const views = ['edit', 'teach'].map(surface => renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface, selectedObjectId: f.cardId, onGeometryChange: () => { } })));
    const target = { kind: 'scene', occurrenceId: 'entry', plan };
    views.push(renderToStaticMarkup(React.createElement(PresentLessonScene, { target, envelope: { generation: 1, sequence: 1, snapshot: { sessionId: 's', revision: 1, target } }, report: () => { } })));
    for (const html of views) {
        strict_1.default.equal((html.match(/data-logical-scene=/g) ?? []).length, 1);
        strict_1.default.deepEqual([...html.matchAll(/data-scene-object="([^"]+)"/g)].map(match => match[1]), [f.cardId, f.bubbleId]);
        strict_1.default.ok(html.includes('media://assets/proof.png'));
        strict_1.default.ok(html.includes('Question'));
        strict_1.default.ok(html.includes('What happens next?'));
        strict_1.default.ok(html.includes('width:960px;height:720px'));
        strict_1.default.equal(html.includes('Answer'), false);
    }
    strict_1.default.ok(views[0].includes('Resize object'));
    strict_1.default.equal(views[1].includes('Resize object'), false);
    strict_1.default.equal(views[2].includes('role="button"'), false);
    strict_1.default.equal(views[2].includes('Resize object'), false);
    const removed = (0, commands_1.removeObject)(f.project, f.sceneId, f.cardId);
    const next = { ...target, plan: (0, projection_1.projectScene)(removed, f.sceneId) };
    const html = renderToStaticMarkup(React.createElement(PresentLessonScene, { target: next, envelope: { generation: 1, sequence: 2, snapshot: { sessionId: 's', revision: 2, target: next } }, report: () => { } }));
    strict_1.default.equal(html.includes(`data-scene-object="${f.cardId}"`), false);
    strict_1.default.ok(html.includes('What happens next?'));
});
(0, node_test_1.default)('actual Present video scene contains one decoder with the same card and bubble composition', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { PresentLessonScene } = rendererModule('src/renderer/present.tsx');
    const f = fixture('video'), plan = (0, projection_1.projectScene)(f.project, f.sceneId);
    const media = { identity: 'movie', epoch: 1, bridgeEpoch: 1, rendererGeneration: 1, playing: false, positionSec: 0, volume: 1, enabled: true };
    const target = { kind: 'scene', occurrenceId: 'entry', plan, media };
    strict_1.default.ok((0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 's', revision: 1, target }));
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 's', revision: 1, target: { ...target, media: undefined } }), null);
    const html = renderToStaticMarkup(React.createElement(PresentLessonScene, { target, envelope: { generation: 1, sequence: 1, rendererGeneration: 1, snapshot: { sessionId: 's', revision: 1, target } }, report: () => { } }));
    strict_1.default.equal((html.match(/<video/g) ?? []).length, 1);
    strict_1.default.equal((html.match(/data-logical-scene=/g) ?? []).length, 1);
    strict_1.default.ok(html.includes('Question'));
    strict_1.default.ok(html.includes('What happens next?'));
    strict_1.default.equal(html.includes('controls='), false);
});
(0, node_test_1.default)('authored frame and object geometry remain invariant across host aspect ratios', () => {
    const f = fixture(), plan = (0, projection_1.projectScene)(f.project, f.sceneId);
    for (const host of [{ width: 1920, height: 1080 }, { width: 480, height: 900 }, { width: 320, height: 240 }]) {
        const fit = (0, staticScene_1.fitLogicalFrame)(plan.frame, host), box = plan.objects[0].box;
        strict_1.default.equal((fit.x + box.x * fit.scale - fit.x) / fit.scale, box.x);
        strict_1.default.equal((fit.y + box.y * fit.scale - fit.y) / fit.scale, box.y);
        strict_1.default.ok(Math.abs((box.width * fit.scale) / (box.height * fit.scale) - box.width / box.height) < 1e-12);
    }
    strict_1.default.deepEqual(plan.frame, { width: 960, height: 720 });
});
(0, node_test_1.default)('logical drawings reach the retained painter at authored coordinates without mutating the saved stroke', () => {
    const { normalizedSceneDrawings } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
    const { renderStroke } = rendererModule('src/renderer/drawing/renderDrawing.ts');
    const stroke = { id: 'stroke', color: '#ffaa00', size: 6, opacity: 1, rainbow: false, points: [{ x: 120, y: 90, t: 1 }, { x: 720, y: 540, t: 2 }] };
    const before = JSON.stringify(stroke);
    for (const frame of [{ width: 960, height: 720 }, { width: 1920, height: 1080 }]) {
        const points = [];
        const context = { beginPath() { }, stroke() { }, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); } };
        renderStroke(context, normalizedSceneDrawings([stroke], frame)[0], frame.width, frame.height, 3);
        strict_1.default.deepEqual(points, [[120, 90], [720, 540]]);
    }
    strict_1.default.equal(JSON.stringify(stroke), before);
});
(0, node_test_1.default)('all built-in bubble styles render complete vectors on every surface without missing image dependencies', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
    const f = fixture();
    for (const [bubbleDefId, shape] of [['BD_CLASSIC', 'speech'], ['BD_THOUGHT', 'thought'], ['BD_SHOUT', 'shout']]) {
        const bubble = f.project.scenes[f.sceneId].objects.find(object => object.id === f.bubbleId);
        strict_1.default.ok(bubble.kind === 'bubble');
        if (bubble.kind !== 'bubble')
            continue;
        const project = (0, commands_1.putObject)(f.project, f.sceneId, { ...bubble, bubbleDefId });
        const plan = (0, projection_1.projectScene)(project, f.sceneId);
        strict_1.default.deepEqual((0, projection_2.sceneImageSources)(plan), ['media://assets/proof.png']);
        for (const surface of ['edit', 'teach', 'present']) {
            const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface }));
            strict_1.default.ok(html.includes(`data-bubble-shape="${shape}"`));
            strict_1.default.ok(html.includes('What happens next?'));
            strict_1.default.ok(html.includes('<path'));
            strict_1.default.equal(html.includes('assets/bubbles/'), false);
        }
    }
});
(0, node_test_1.default)('Edit video preview has muted native controls while student and teacher video slots contain no authoring controls', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
    const f = fixture('video'), plan = (0, projection_1.projectScene)(f.project, f.sceneId);
    const edit = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface: 'edit' }));
    strict_1.default.ok(edit.includes('aria-label="Edit video preview"'));
    strict_1.default.ok(edit.includes('controls=""'));
    strict_1.default.ok(edit.includes('muted=""'));
    strict_1.default.equal((edit.match(/<video/g) ?? []).length, 1);
    const drawing = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface: 'edit', drawing: true }));
    strict_1.default.equal(drawing.includes('controls=""'), false);
    for (const surface of ['teach', 'present']) {
        const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface, video: React.createElement('video', { 'data-live-slot': true }) }));
        strict_1.default.equal(html.includes('Edit video preview'), false);
        strict_1.default.equal(html.includes('controls=""'), false);
        strict_1.default.equal((html.match(/<video/g) ?? []).length, 1);
    }
});
(0, node_test_1.default)('retained spark and celebration visuals project safely and render in the same scene frame', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const { SceneSurface } = rendererModule('src/renderer/lesson/SceneSurface.tsx');
    const f = fixture(), now = Date.now();
    let session = (0, rewards_1.initializeLessonRewards)((0, session_1.navigate)(f.project, (0, session_1.createSession)(), { sequence: 'story', entryId: f.entryId }), []);
    session = (0, rewards_1.awardLessonReward)(session, 'gold', 'award-event', now);
    session = (0, rewards_1.showLessonCelebration)(session, 'celebrate-event', now);
    const plan = (0, projection_1.projectScene)(f.project, f.sceneId, session);
    strict_1.default.ok(plan.rewards?.sparks.length);
    strict_1.default.ok(plan.rewards?.final);
    strict_1.default.deepEqual(plan.rewards?.frame, plan.frame);
    strict_1.default.equal(JSON.stringify(plan).includes('appliedEventIds'), false);
    strict_1.default.equal(JSON.stringify(plan).includes('activeStudentId'), false);
    strict_1.default.deepEqual((0, projection_1.parseScenePlan)(plan), plan);
    strict_1.default.equal((0, projection_1.parseScenePlan)({ ...plan, rewards: { ...plan.rewards, frame: { width: 1, height: 1 } } }), null);
    const html = renderToStaticMarkup(React.createElement(SceneSurface, { plan, surface: 'present' }));
    strict_1.default.equal((html.match(/data-logical-scene=/g) ?? []).length, 1);
    strict_1.default.ok(html.includes('data-lesson-rewards="true"'));
    strict_1.default.ok(html.includes('spark-overlay'));
    strict_1.default.equal(html.includes('lesson-scene-reward'), false);
    strict_1.default.equal(html.includes('role="button"'), false);
});
