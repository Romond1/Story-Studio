"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const presentationSession_1 = require("./presentationSession");
function fixture() {
    return { version: 4, createdAt: '', updatedAt: '', assets: [],
        sections: [{ id: 'one', name: 'One' }, { id: 'pause', name: 'Pause', type: 'break' }, { id: 'two', name: 'Two' }],
        slides: [{ id: 's1', assetId: 'a', sectionId: 'one', transition: 'fade' }, { id: 's2', assetId: 'b', sectionId: 'two', transition: 'fade' }],
        aCardLibrary: { board: { id: 'board', name: 'Board', stageMode: 'half', background: { offsetX: 0, offsetY: 0, scale: 1, blur: 0 }, bCardInstances: [] } },
        boostPack: { activationSequence: [{ id: 'first', type: 'slideRef', slideId: 's2' }, { id: 'repeat', type: 'slideRef', slideId: 's2' }, { id: 'missing', type: 'slideRef', slideId: 'gone' }],
            languageSequence: [{ id: 'slide', type: 'slideRef', slideId: 's1' }, { id: 'board1', type: 'aCardRef', aCardId: 'board' }, { id: 'break', type: 'breakRef', breakId: 'pause' }, { id: 'board2', type: 'aCardRef', aCardId: 'board' }],
            gamesSequence: [{ id: 'prompt', type: 'promptCard', body: 'Hello' }, { id: 'game', type: 'miniGame', gameType: 'placeholder' }] } };
}
function session() {
    return (0, presentationSession_1.reducePresentationSession)((0, presentationSession_1.createPresentationSession)('session'), { type: 'project', projectId: 'project', slideId: 's1', sectionId: 'one' });
}
const stroke = { id: 'ink', color: '#000', size: 3, opacity: 1, rainbow: false, points: [{ x: 1, y: 2, t: 3 }] };
(0, node_test_1.default)('story resolves stable slide IDs after reorder and navigates linearly', () => {
    const data = fixture();
    const current = session();
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, current).slide?.id, 's1');
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(data, current, 1).storySlideId, 's2');
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(data, current, -1), current);
    data.slides.reverse();
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, current).slide?.id, 's1');
});
(0, node_test_1.default)('selected break overrides retained story slide and navigates adjacent sections', () => {
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { sectionId: 'pause' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(fixture(), current);
    strict_1.default.equal(target.kind, 'break');
    strict_1.default.equal(target.slide, null);
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(fixture(), current, 1).storySlideId, 's2');
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(fixture(), current, -1).storySlideId, 's1');
});
(0, node_test_1.default)('boost navigation uses occurrences, including repeated content', () => {
    const data = fixture();
    const first = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
    const second = (0, presentationSession_1.navigatePresentation)(data, first, 1);
    strict_1.default.equal(second.boostItemId, 'repeat');
    const a = (0, presentationSession_1.resolvePresentationTarget)(data, first);
    const b = (0, presentationSession_1.resolvePresentationTarget)(data, second);
    strict_1.default.equal(a.contentId, b.contentId);
    strict_1.default.notEqual(a.occurrenceId, b.occurrenceId);
    strict_1.default.equal((0, presentationSession_1.targetMatches)(second, b, (0, presentationSession_1.presentationToken)(first, a)), false);
});
(0, node_test_1.default)('missing boost references never fall back to the retained story slide', () => {
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'missing' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(fixture(), current);
    strict_1.default.equal(target.kind, 'invalid');
    strict_1.default.equal(target.slide, null);
    strict_1.default.equal(target.capabilities.canDraw, false);
    const absent = (0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { boostItemId: 'removed' } });
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(fixture(), absent).kind, 'invalid');
});
(0, node_test_1.default)('language boards resolve slide and break backdrops with content scoped drawing', () => {
    const data = fixture();
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'language', boostItemId: 'board1' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
    strict_1.default.equal(target.kind, 'board');
    strict_1.default.equal(target.slide?.id, 's1');
    const changed = (0, presentationSession_1.applyPresentationDrawing)(data, current, (0, presentationSession_1.presentationToken)(current, target), [stroke]);
    strict_1.default.deepEqual(changed.slides[0].markerStrokes, [stroke]);
    strict_1.default.equal(changed.slides[1], data.slides[1]);
    const next = (0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { boostItemId: 'board2' } });
    const nextTarget = (0, presentationSession_1.resolvePresentationTarget)(data, next);
    strict_1.default.equal(nextTarget.section?.id, 'pause');
    strict_1.default.equal(nextTarget.slide, null);
    const breakDrawing = (0, presentationSession_1.applyPresentationDrawing)(data, next, (0, presentationSession_1.presentationToken)(next, nextTarget), [stroke]);
    strict_1.default.deepEqual(breakDrawing.sections[1].markerStrokes, [stroke]);
    strict_1.default.equal(data.sections[1].markerStrokes, undefined);
});
(0, node_test_1.default)('language backdrop skips deleted references and missing boards cannot draw', () => {
    const data = fixture();
    data.boostPack.languageSequence.splice(1, 0, { id: 'dead', type: 'slideRef', slideId: 'deleted' });
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'language', boostItemId: 'board1' } });
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, current).slide?.id, 's1');
    data.aCardLibrary = {};
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
    strict_1.default.equal(target.kind, 'invalid');
    strict_1.default.equal(target.capabilities.canDraw, false);
});
(0, node_test_1.default)('standalone boards do not inherit story drawing; side panels retain story and badge owns stage', () => {
    const data = fixture();
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boards', boardId: 'board' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
    strict_1.default.equal(target.kind, 'board');
    strict_1.default.equal(target.capabilities.canDraw, false);
    for (const mode of ['relics', 'movement']) {
        const panel = (0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { mode } });
        strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, panel).slide?.id, 's1');
        strict_1.default.equal((0, presentationSession_1.navigatePresentation)(data, panel, 1).storySlideId, 's2');
    }
    const badge = (0, presentationSession_1.resolvePresentationTarget)(data, (0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { mode: 'badge' } }));
    strict_1.default.equal(badge.kind, 'activity');
    strict_1.default.equal(badge.contentId, 'badge');
    strict_1.default.equal(badge.slide, null);
});
(0, node_test_1.default)('prompts and activities are explicit nondrawable targets', () => {
    const data = fixture();
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'games', boostItemId: 'prompt' } });
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, current).kind, 'prompt');
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, (0, presentationSession_1.navigatePresentation)(data, current, 1)).kind, 'activity');
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, current).capabilities.canDraw, false);
});
(0, node_test_1.default)('stale drawing is rejected after leaving and reentering the same target', () => {
    const data = fixture();
    const initial = session();
    const token = (0, presentationSession_1.presentationToken)(initial, (0, presentationSession_1.resolvePresentationTarget)(data, initial));
    const reentered = (0, presentationSession_1.navigatePresentation)(data, (0, presentationSession_1.navigatePresentation)(data, initial, 1), -1);
    strict_1.default.equal(reentered.storySlideId, initial.storySlideId);
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, reentered, token, [stroke]), data);
    const valid = (0, presentationSession_1.applyPresentationDrawing)(data, initial, token, [stroke]);
    strict_1.default.deepEqual(valid.slides[0].markerStrokes, [stroke]);
});
(0, node_test_1.default)('reopening same project and separate sessions invalidate tokens', () => {
    const data = fixture();
    const initial = session();
    const token = (0, presentationSession_1.presentationToken)(initial, (0, presentationSession_1.resolvePresentationTarget)(data, initial));
    const reopened = (0, presentationSession_1.reducePresentationSession)(initial, { type: 'project', projectId: 'project', slideId: 's1', sectionId: 'one' });
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, reopened, token, [stroke]), data);
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, { ...initial, sessionId: 'other' }, token, [stroke]), data);
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, { ...initial, projectId: 'other' }, token, [stroke]), data);
});
(0, node_test_1.default)('no-op selections preserve identity; deleted targets reject pending drawing', () => {
    const data = fixture();
    const current = session();
    const token = (0, presentationSession_1.presentationToken)(current, (0, presentationSession_1.resolvePresentationTarget)(data, current));
    strict_1.default.equal((0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { storySlideId: 's1' } }), current);
    const deleted = { ...data, slides: [] };
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(deleted, current, token, [stroke]), deleted);
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(null, current).kind, 'empty');
});
(0, node_test_1.default)('retargeted references and changed language backdrops reject pending drawing', () => {
    const data = fixture();
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
    const token = (0, presentationSession_1.presentationToken)(current, (0, presentationSession_1.resolvePresentationTarget)(data, current));
    data.boostPack.activationSequence[0] = { id: 'first', type: 'slideRef', slideId: 's1' };
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, current, token, [stroke]), data);
    const boardSession = (0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { boostTab: 'language', boostItemId: 'board2' } });
    const boardToken = (0, presentationSession_1.presentationToken)(boardSession, (0, presentationSession_1.resolvePresentationTarget)(data, boardSession));
    data.sections = data.sections.filter(section => section.id !== 'pause');
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, boardSession).slide?.id, 's1');
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, boardSession, boardToken, [stroke]), data);
});
(0, node_test_1.default)('viewport handoff rejects stale callbacks without modifying persistent data', () => {
    const data = fixture();
    const current = session();
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
    const token = (0, presentationSession_1.presentationToken)(current, target);
    const before = JSON.stringify(data);
    const viewport = { zoom: 1, pan: { x: 0, y: 0 } };
    const next = { zoom: 2, pan: { x: 3, y: 4 } };
    strict_1.default.equal((0, presentationSession_1.applyPresentationViewport)(viewport, current, target, token, next), next);
    const moved = (0, presentationSession_1.navigatePresentation)(data, current, 1);
    strict_1.default.equal((0, presentationSession_1.applyPresentationViewport)(viewport, moved, (0, presentationSession_1.resolvePresentationTarget)(data, moved), token, next), viewport);
    strict_1.default.equal(JSON.stringify(data), before);
});
(0, node_test_1.default)('clearing only transient strokes is a no-op for slides and breaks', () => {
    const data = fixture();
    for (const current of [session(), (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { sectionId: 'pause' } })]) {
        const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
        strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, current, (0, presentationSession_1.presentationToken)(current, target), []), data);
    }
    data.slides[0].markerStrokes = [];
    const current = session();
    const token = (0, presentationSession_1.presentationToken)(current, (0, presentationSession_1.resolvePresentationTarget)(data, current));
    strict_1.default.equal((0, presentationSession_1.applyPresentationDrawing)(data, current, token, []), data);
});
(0, node_test_1.default)('booster references to break media remain slide targets without selecting the owning break', () => {
    const data = fixture();
    data.slides[1].sectionId = 'pause';
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
    strict_1.default.equal(target.kind, 'slide');
    strict_1.default.equal(target.slide?.id, 's2');
    strict_1.default.equal(target.section, null);
    const changed = (0, presentationSession_1.applyPresentationDrawing)(data, current, (0, presentationSession_1.presentationToken)(current, target), [stroke]);
    strict_1.default.deepEqual(changed.slides[1].markerStrokes, [stroke]);
    strict_1.default.equal(changed.sections, data.sections);
    data.boostPack.languageSequence[0] = { id: 'slide', type: 'slideRef', slideId: 's2' };
    const boardSession = (0, presentationSession_1.reducePresentationSession)(current, { type: 'select', changes: { boostTab: 'language', boostItemId: 'board1' } });
    const board = (0, presentationSession_1.resolvePresentationTarget)(data, boardSession);
    strict_1.default.equal(board.kind, 'board');
    strict_1.default.equal(board.slide?.id, 's2');
    strict_1.default.equal(board.section, null);
});
(0, node_test_1.default)('browsing an empty story section preserves its controls alongside the retained slide', () => {
    const data = fixture();
    data.sections.push({ id: 'empty', name: 'Empty' });
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { sectionId: 'empty' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, current);
    strict_1.default.equal(target.kind, 'slide');
    strict_1.default.equal(target.slide?.id, 's1');
    strict_1.default.equal(target.section?.id, 'empty');
    strict_1.default.deepEqual(target.drawingTarget, { kind: 'slide', id: 's1' });
});
(0, node_test_1.default)('movement overlays preserve the base target and navigation, then clear on project reset', () => {
    const data = fixture();
    const before = JSON.stringify(data);
    const initial = session();
    const movement = { event: { id: 'jump', name: 'Jump', instruction: 'Jump', enabled: true, shortcut: 'j', durationSeconds: 5, animation: 'runner' }, id: "movement-123", startedAt: 123, expiresAt: 5123, frame: { width: 1280, height: 720 } };
    const active = (0, presentationSession_1.reducePresentationSession)(initial, { type: 'movement', value: movement });
    strict_1.default.equal(active.revision, initial.revision + 1);
    strict_1.default.equal(active.overlays.movement, movement);
    strict_1.default.deepEqual((0, presentationSession_1.resolvePresentationTarget)(data, active), (0, presentationSession_1.resolvePresentationTarget)(data, initial));
    strict_1.default.equal((0, presentationSession_1.reducePresentationSession)(active, { type: 'movement', value: movement }), active);
    const next = (0, presentationSession_1.navigatePresentation)(data, active, 1);
    strict_1.default.equal(next.storySlideId, 's2');
    strict_1.default.equal(next.overlays.movement, movement);
    const cleared = (0, presentationSession_1.reducePresentationSession)(next, { type: 'movement', value: null });
    strict_1.default.equal(cleared.overlays.movement, null);
    strict_1.default.equal(cleared.storySlideId, 's2');
    const reset = (0, presentationSession_1.reducePresentationSession)(active, { type: 'project', projectId: 'another', slideId: null, sectionId: null });
    strict_1.default.equal(reset.overlays.movement, null);
    strict_1.default.equal(JSON.stringify(data), before);
});
(0, node_test_1.default)('booster return restores its entry checkpoint despite hidden story selection changes', () => {
    const initial = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { sectionId: 'pause' } });
    const entered = (0, presentationSession_1.reducePresentationSession)(initial, { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
    const hiddenChanged = (0, presentationSession_1.reducePresentationSession)(entered, { type: 'select', changes: { storySlideId: 's2', sectionId: 'two' } });
    const nextItem = (0, presentationSession_1.navigatePresentation)(fixture(), hiddenChanged, 1);
    const returned = (0, presentationSession_1.reducePresentationSession)(nextItem, { type: 'select', changes: { mode: 'story' } });
    strict_1.default.equal(returned.storySlideId, 's1');
    strict_1.default.equal(returned.sectionId, 'pause');
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(fixture(), returned).kind, 'break');
});
(0, node_test_1.default)('project reset discards booster checkpoint and a subsequent entry captures a new location', () => {
    const entered = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost' } });
    const reset = (0, presentationSession_1.reducePresentationSession)(entered, { type: 'project', projectId: 'new', slideId: 's2', sectionId: 'two' });
    const reentered = (0, presentationSession_1.reducePresentationSession)(reset, { type: 'select', changes: { mode: 'boost' } });
    const returned = (0, presentationSession_1.reducePresentationSession)(reentered, { type: 'select', changes: { mode: 'story' } });
    strict_1.default.equal(returned.storySlideId, 's2');
    strict_1.default.equal(returned.sectionId, 'two');
});
(0, node_test_1.default)('return through a story-backed side panel consumes the booster checkpoint once', () => {
    for (const mode of ['movement', 'relics']) {
        const entered = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost' } });
        const changed = (0, presentationSession_1.reducePresentationSession)(entered, { type: 'select', changes: { storySlideId: 's2', sectionId: 'two' } });
        const returned = (0, presentationSession_1.reducePresentationSession)(changed, { type: 'select', changes: { mode } });
        strict_1.default.equal(returned.storySlideId, 's1');
        const advanced = (0, presentationSession_1.navigatePresentation)(fixture(), returned, 1);
        const story = (0, presentationSession_1.reducePresentationSession)(advanced, { type: 'select', changes: { mode: 'story' } });
        strict_1.default.equal(story.storySlideId, 's2');
    }
});
(0, node_test_1.default)('movement does not invalidate scene commands, leaving and reentering does', () => {
    const data = fixture();
    const initial = session();
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, initial);
    const token = (0, presentationSession_1.presentationToken)(initial, target);
    const active = (0, presentationSession_1.reducePresentationSession)(initial, { type: 'movement', value: { event: { id: 'jump', name: 'Jump', instruction: 'Jump', enabled: true, shortcut: 'j', durationSeconds: 5, animation: 'runner' }, id: "movement-1", startedAt: 1, expiresAt: 5001, frame: { width: 1280, height: 720 } } });
    strict_1.default.deepEqual((0, presentationSession_1.presentationToken)(active, (0, presentationSession_1.resolvePresentationTarget)(data, active)), token);
    const away = (0, presentationSession_1.navigatePresentation)(data, active, 1);
    const back = (0, presentationSession_1.navigatePresentation)(data, away, -1);
    strict_1.default.equal((0, presentationSession_1.targetMatches)(back, (0, presentationSession_1.resolvePresentationTarget)(data, back), token), false);
});
(0, node_test_1.default)('deleted story checkpoint returns unavailable instead of displaying booster content', () => {
    const data = fixture();
    const entered = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
    data.slides = data.slides.filter(s => s.id !== 's1');
    data.sections = data.sections.filter(s => s.id !== 'one');
    const returned = (0, presentationSession_1.reducePresentationSession)(entered, { type: 'select', changes: { mode: 'story' } });
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, returned);
    strict_1.default.equal(returned.storySlideId, 's1');
    strict_1.default.equal(target.kind, 'invalid');
    strict_1.default.equal(target.slide, null);
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(data, returned, 1), returned);
});
(0, node_test_1.default)('prompt and placeholder sequence entries navigate by occurrence, deleted selection stays unavailable', () => {
    const data = fixture();
    const current = (0, presentationSession_1.reducePresentationSession)(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'games', boostItemId: 'prompt' } });
    const next = (0, presentationSession_1.navigatePresentation)(data, current, 1);
    strict_1.default.equal(next.boostItemId, 'game');
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(data, next, -1).boostItemId, 'prompt');
    data.boostPack.gamesSequence = data.boostPack.gamesSequence.filter(i => i.id !== 'game');
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, next).kind, 'invalid');
    strict_1.default.equal((0, presentationSession_1.navigatePresentation)(data, next, -1), next);
});
