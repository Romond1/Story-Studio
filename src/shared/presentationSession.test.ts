import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectData, MarkerStroke } from './types';
import { createPresentationSession, reducePresentationSession, resolvePresentationTarget, navigatePresentation, presentationToken, targetMatches, applyPresentationDrawing, applyPresentationViewport, type PresentationSession } from './presentationSession';

function fixture(): ProjectData {
  return { version: 4, createdAt: '', updatedAt: '', assets: [],
    sections: [{ id: 'one', name: 'One' }, { id: 'pause', name: 'Pause', type: 'break' }, { id: 'two', name: 'Two' }],
    slides: [{ id: 's1', assetId: 'a', sectionId: 'one', transition: 'fade' }, { id: 's2', assetId: 'b', sectionId: 'two', transition: 'fade' }],
    aCardLibrary: { board: { id: 'board', name: 'Board', stageMode: 'half', background: { offsetX: 0, offsetY: 0, scale: 1, blur: 0 }, bCardInstances: [] } },
    boostPack: { activationSequence: [ { id: 'first', type: 'slideRef', slideId: 's2' }, { id: 'repeat', type: 'slideRef', slideId: 's2' }, { id: 'missing', type: 'slideRef', slideId: 'gone' } ],
      languageSequence: [{ id: 'slide', type: 'slideRef', slideId: 's1' }, { id: 'board1', type: 'aCardRef', aCardId: 'board' }, { id: 'break', type: 'breakRef', breakId: 'pause' }, { id: 'board2', type: 'aCardRef', aCardId: 'board' }],
      gamesSequence: [{ id: 'prompt', type: 'promptCard', body: 'Hello' }, { id: 'game', type: 'miniGame', gameType: 'placeholder' }] } };
}
function session(): PresentationSession {
  return reducePresentationSession(createPresentationSession('session'), { type: 'project', projectId: 'project', slideId: 's1', sectionId: 'one' });
}
const stroke: MarkerStroke = { id: 'ink', color: '#000', size: 3, opacity: 1, rainbow: false, points: [{ x: 1, y: 2, t: 3 }] };

test('story resolves stable slide IDs after reorder and navigates linearly', () => {
  const data = fixture(); const current = session();
  assert.equal(resolvePresentationTarget(data, current).slide?.id, 's1');
  assert.equal(navigatePresentation(data, current, 1).storySlideId, 's2');
  assert.equal(navigatePresentation(data, current, -1), current);
  data.slides.reverse();
  assert.equal(resolvePresentationTarget(data, current).slide?.id, 's1');
});
test('selected break overrides retained story slide and navigates adjacent sections', () => {
  const current = reducePresentationSession(session(), { type: 'select', changes: { sectionId: 'pause' } });
  const target = resolvePresentationTarget(fixture(), current);
  assert.equal(target.kind, 'break'); assert.equal(target.slide, null);
  assert.equal(navigatePresentation(fixture(), current, 1).storySlideId, 's2');
  assert.equal(navigatePresentation(fixture(), current, -1).storySlideId, 's1');
});
test('boost navigation uses occurrences, including repeated content', () => {
  const data = fixture();
  const first = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
  const second = navigatePresentation(data, first, 1);
  assert.equal(second.boostItemId, 'repeat');
  const a = resolvePresentationTarget(data, first); const b = resolvePresentationTarget(data, second);
  assert.equal(a.contentId, b.contentId); assert.notEqual(a.occurrenceId, b.occurrenceId);
  assert.equal(targetMatches(second, b, presentationToken(first, a)), false);
});
test('missing boost references never fall back to the retained story slide', () => {
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'missing' } });
  const target = resolvePresentationTarget(fixture(), current);
  assert.equal(target.kind, 'invalid'); assert.equal(target.slide, null); assert.equal(target.capabilities.canDraw, false);
  const absent = reducePresentationSession(current, { type: 'select', changes: { boostItemId: 'removed' } });
  assert.equal(resolvePresentationTarget(fixture(), absent).kind, 'invalid');
});
test('language boards resolve slide and break backdrops with content scoped drawing', () => {
  const data = fixture();
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'language', boostItemId: 'board1' } });
  const target = resolvePresentationTarget(data, current);
  assert.equal(target.kind, 'board'); assert.equal(target.slide?.id, 's1');
  const changed = applyPresentationDrawing(data, current, presentationToken(current, target), [stroke]);
  assert.deepEqual(changed.slides[0].markerStrokes, [stroke]); assert.equal(changed.slides[1], data.slides[1]);
  const next = reducePresentationSession(current, { type: 'select', changes: { boostItemId: 'board2' } });
  const nextTarget = resolvePresentationTarget(data, next);
  assert.equal(nextTarget.section?.id, 'pause'); assert.equal(nextTarget.slide, null);
  const breakDrawing = applyPresentationDrawing(data, next, presentationToken(next, nextTarget), [stroke]);
  assert.deepEqual(breakDrawing.sections[1].markerStrokes, [stroke]);
  assert.equal(data.sections[1].markerStrokes, undefined);
});
test('language backdrop skips deleted references and missing boards cannot draw', () => {
  const data = fixture(); data.boostPack!.languageSequence.splice(1, 0, { id: 'dead', type: 'slideRef', slideId: 'deleted' });
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'language', boostItemId: 'board1' } });
  assert.equal(resolvePresentationTarget(data, current).slide?.id, 's1');
  data.aCardLibrary = {};
  const target = resolvePresentationTarget(data, current);
  assert.equal(target.kind, 'invalid'); assert.equal(target.capabilities.canDraw, false);
});
test('standalone boards do not inherit story drawing; side panels retain story and badge owns stage', () => {
  const data = fixture();
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boards', boardId: 'board' } });
  const target = resolvePresentationTarget(data, current);
  assert.equal(target.kind, 'board'); assert.equal(target.capabilities.canDraw, false);
  for (const mode of ['relics', 'movement'] as const) {
    const panel = reducePresentationSession(current, { type: 'select', changes: { mode } });
    assert.equal(resolvePresentationTarget(data, panel).slide?.id, 's1');
    assert.equal(navigatePresentation(data, panel, 1).storySlideId, 's2');
  }
  const badge = resolvePresentationTarget(data, reducePresentationSession(current, { type: 'select', changes: { mode: 'badge' } }));
  assert.equal(badge.kind, 'activity'); assert.equal(badge.contentId, 'badge'); assert.equal(badge.slide, null);
});
test('prompts and activities are explicit nondrawable targets', () => {
  const data = fixture();
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'games', boostItemId: 'prompt' } });
  assert.equal(resolvePresentationTarget(data, current).kind, 'prompt');
  assert.equal(resolvePresentationTarget(data, navigatePresentation(data, current, 1)).kind, 'activity');
  assert.equal(resolvePresentationTarget(data, current).capabilities.canDraw, false);
});
test('stale drawing is rejected after leaving and reentering the same target', () => {
  const data = fixture(); const initial = session(); const token = presentationToken(initial, resolvePresentationTarget(data, initial));
  const reentered = navigatePresentation(data, navigatePresentation(data, initial, 1), -1);
  assert.equal(reentered.storySlideId, initial.storySlideId);
  assert.equal(applyPresentationDrawing(data, reentered, token, [stroke]), data);
  const valid = applyPresentationDrawing(data, initial, token, [stroke]);
  assert.deepEqual(valid.slides[0].markerStrokes, [stroke]);
});
test('reopening same project and separate sessions invalidate tokens', () => {
  const data = fixture(); const initial = session(); const token = presentationToken(initial, resolvePresentationTarget(data, initial));
  const reopened = reducePresentationSession(initial, { type: 'project', projectId: 'project', slideId: 's1', sectionId: 'one' });
  assert.equal(applyPresentationDrawing(data, reopened, token, [stroke]), data);
  assert.equal(applyPresentationDrawing(data, { ...initial, sessionId: 'other' }, token, [stroke]), data);
  assert.equal(applyPresentationDrawing(data, { ...initial, projectId: 'other' }, token, [stroke]), data);
});
test('no-op selections preserve identity; deleted targets reject pending drawing', () => {
  const data = fixture(); const current = session(); const token = presentationToken(current, resolvePresentationTarget(data, current));
  assert.equal(reducePresentationSession(current, { type: 'select', changes: { storySlideId: 's1' } }), current);
  const deleted = { ...data, slides: [] };
  assert.equal(applyPresentationDrawing(deleted, current, token, [stroke]), deleted);
  assert.equal(resolvePresentationTarget(null, current).kind, 'empty');
});
test('retargeted references and changed language backdrops reject pending drawing', () => {
  const data = fixture();
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
  const token = presentationToken(current, resolvePresentationTarget(data, current));
  data.boostPack!.activationSequence[0] = { id: 'first', type: 'slideRef', slideId: 's1' };
  assert.equal(applyPresentationDrawing(data, current, token, [stroke]), data);
  const boardSession = reducePresentationSession(current, { type: 'select', changes: { boostTab: 'language', boostItemId: 'board2' } });
  const boardToken = presentationToken(boardSession, resolvePresentationTarget(data, boardSession));
  data.sections = data.sections.filter(section => section.id !== 'pause');
  assert.equal(resolvePresentationTarget(data, boardSession).slide?.id, 's1');
  assert.equal(applyPresentationDrawing(data, boardSession, boardToken, [stroke]), data);
});
test('viewport handoff rejects stale callbacks without modifying persistent data', () => {
  const data = fixture(); const current = session(); const target = resolvePresentationTarget(data, current);
  const token = presentationToken(current, target); const before = JSON.stringify(data);
  const viewport = { zoom: 1, pan: { x: 0, y: 0 } }; const next = { zoom: 2, pan: { x: 3, y: 4 } };
  assert.equal(applyPresentationViewport(viewport, current, target, token, next), next);
  const moved = navigatePresentation(data, current, 1);
  assert.equal(applyPresentationViewport(viewport, moved, resolvePresentationTarget(data, moved), token, next), viewport);
  assert.equal(JSON.stringify(data), before);
});
test('clearing only transient strokes is a no-op for slides and breaks', () => {
  const data = fixture();
  for (const current of [session(), reducePresentationSession(session(), { type: 'select', changes: { sectionId: 'pause' } })]) {
    const target = resolvePresentationTarget(data, current);
    assert.equal(applyPresentationDrawing(data, current, presentationToken(current, target), []), data);
  }
  data.slides[0].markerStrokes = [];
  const current = session(); const token = presentationToken(current, resolvePresentationTarget(data, current));
  assert.equal(applyPresentationDrawing(data, current, token, []), data);
});
test('booster references to break media remain slide targets without selecting the owning break', () => {
  const data = fixture(); data.slides[1].sectionId = 'pause';
  const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
  const target = resolvePresentationTarget(data, current);
  assert.equal(target.kind, 'slide'); assert.equal(target.slide?.id, 's2'); assert.equal(target.section, null);
  const changed = applyPresentationDrawing(data, current, presentationToken(current, target), [stroke]);
  assert.deepEqual(changed.slides[1].markerStrokes, [stroke]); assert.equal(changed.sections, data.sections);
  data.boostPack!.languageSequence[0] = { id: 'slide', type: 'slideRef', slideId: 's2' };
  const boardSession = reducePresentationSession(current, { type: 'select', changes: { boostTab: 'language', boostItemId: 'board1' } });
  const board = resolvePresentationTarget(data, boardSession);
  assert.equal(board.kind, 'board'); assert.equal(board.slide?.id, 's2'); assert.equal(board.section, null);
});
test('browsing an empty story section preserves its controls alongside the retained slide', () => {
  const data = fixture(); data.sections.push({ id: 'empty', name: 'Empty' });
  const current = reducePresentationSession(session(), { type: 'select', changes: { sectionId: 'empty' } });
  const target = resolvePresentationTarget(data, current);
  assert.equal(target.kind, 'slide'); assert.equal(target.slide?.id, 's1'); assert.equal(target.section?.id, 'empty');
  assert.deepEqual(target.drawingTarget, { kind: 'slide', id: 's1' });
});
test('movement overlays preserve the base target and navigation, then clear on project reset', () => {
  const data = fixture(); const before = JSON.stringify(data); const initial = session();
  const movement = { event: { id: 'jump', name: 'Jump', instruction: 'Jump', enabled: true, shortcut: 'j', durationSeconds: 5, animation: 'runner' as const }, id: "movement-123", startedAt: 123, expiresAt: 5123, frame: { width: 1280, height: 720 } };
  const active = reducePresentationSession(initial, { type: 'movement', value: movement });
  assert.equal(active.revision, initial.revision + 1);
  assert.equal(active.overlays.movement, movement);
  assert.deepEqual(resolvePresentationTarget(data, active), resolvePresentationTarget(data, initial));
  assert.equal(reducePresentationSession(active, { type: 'movement', value: movement }), active);
  const next = navigatePresentation(data, active, 1);
  assert.equal(next.storySlideId, 's2'); assert.equal(next.overlays.movement, movement);
  const cleared = reducePresentationSession(next, { type: 'movement', value: null });
  assert.equal(cleared.overlays.movement, null); assert.equal(cleared.storySlideId, 's2');
  const reset = reducePresentationSession(active, { type: 'project', projectId: 'another', slideId: null, sectionId: null });
  assert.equal(reset.overlays.movement, null);
  assert.equal(JSON.stringify(data), before);
});

test('booster return restores its entry checkpoint despite hidden story selection changes', () => {
  const initial = reducePresentationSession(session(), { type: 'select', changes: { sectionId: 'pause' } });
  const entered = reducePresentationSession(initial, { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
  const hiddenChanged = reducePresentationSession(entered, { type: 'select', changes: { storySlideId: 's2', sectionId: 'two' } });
  const nextItem = navigatePresentation(fixture(), hiddenChanged, 1);
  const returned = reducePresentationSession(nextItem, { type: 'select', changes: { mode: 'story' } });
  assert.equal(returned.storySlideId, 's1');
  assert.equal(returned.sectionId, 'pause');
  assert.equal(resolvePresentationTarget(fixture(), returned).kind, 'break');
});

test('project reset discards booster checkpoint and a subsequent entry captures a new location', () => {
  const entered = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost' } });
  const reset = reducePresentationSession(entered, { type: 'project', projectId: 'new', slideId: 's2', sectionId: 'two' });
  const reentered = reducePresentationSession(reset, { type: 'select', changes: { mode: 'boost' } });
  const returned = reducePresentationSession(reentered, { type: 'select', changes: { mode: 'story' } });
  assert.equal(returned.storySlideId, 's2');
  assert.equal(returned.sectionId, 'two');
});

test('return through a story-backed side panel consumes the booster checkpoint once', () => {
  for (const mode of ['movement', 'relics'] as const) {
    const entered = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost' } });
    const changed = reducePresentationSession(entered, { type: 'select', changes: { storySlideId: 's2', sectionId: 'two' } });
    const returned = reducePresentationSession(changed, { type: 'select', changes: { mode } });
    assert.equal(returned.storySlideId, 's1');
    const advanced = navigatePresentation(fixture(), returned, 1);
    const story = reducePresentationSession(advanced, { type: 'select', changes: { mode: 'story' } });
    assert.equal(story.storySlideId, 's2');
  }
});

test('movement does not invalidate scene commands, leaving and reentering does', () => {
  const data = fixture(); const initial = session(); const target = resolvePresentationTarget(data, initial);
  const token = presentationToken(initial, target);
  const active = reducePresentationSession(initial, { type: 'movement', value: { event: { id: 'jump', name: 'Jump', instruction: 'Jump', enabled: true, shortcut: 'j', durationSeconds: 5, animation: 'runner' }, id: "movement-1", startedAt: 1, expiresAt: 5001, frame: { width: 1280, height: 720 } } });
  assert.deepEqual(presentationToken(active, resolvePresentationTarget(data, active)), token);
  const away = navigatePresentation(data, active, 1);
  const back = navigatePresentation(data, away, -1);
  assert.equal(targetMatches(back, resolvePresentationTarget(data, back), token), false);
});
test('deleted story checkpoint returns unavailable instead of displaying booster content', () => {
 const data = fixture();
 const entered = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostItemId: 'first' } });
 data.slides = data.slides.filter(s => s.id !== 's1'); data.sections = data.sections.filter(s => s.id !== 'one');
 const returned = reducePresentationSession(entered, { type: 'select', changes: { mode: 'story' } });
 const target = resolvePresentationTarget(data, returned);
 assert.equal(returned.storySlideId, 's1'); assert.equal(target.kind, 'invalid'); assert.equal(target.slide, null);
 assert.equal(navigatePresentation(data, returned, 1), returned);
});
test('prompt and placeholder sequence entries navigate by occurrence, deleted selection stays unavailable', () => {
 const data = fixture(); const current = reducePresentationSession(session(), { type: 'select', changes: { mode: 'boost', boostTab: 'games', boostItemId: 'prompt' } });
 const next = navigatePresentation(data, current, 1); assert.equal(next.boostItemId, 'game');
 assert.equal(navigatePresentation(data, next, -1).boostItemId, 'prompt');
 data.boostPack!.gamesSequence = data.boostPack!.gamesSequence.filter(i => i.id !== 'game');
 assert.equal(resolvePresentationTarget(data, next).kind, 'invalid'); assert.equal(navigatePresentation(data, next, -1), next);
});
