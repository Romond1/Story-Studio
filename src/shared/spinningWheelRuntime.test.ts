import test from 'node:test';
import assert from 'node:assert/strict';
import { createWheelConfig, addWheelActivity, readWheelSettings } from './lesson/spinningWheel';
import { initializeMiniGame, transitionMiniGame, restoreMiniGame } from './lesson/miniGameRuntime';
import { eligibleWheelSegments, type WheelRuntimeState, type WheelAction } from './lesson/wheelRuntime';
import { createLesson, createScene, insertScene, addCard, duplicateEntry } from './lesson/commands';
import { createSession, navigate, actOnMiniGame } from './lesson/session';
import { projectScene, parseScenePlan, sceneImageSources } from './lesson/projection';
import { parsePresentSnapshot, PresentSnapshotRelay, assessPresentEnvelope } from './presentationSnapshot';

function fixture(mode: 'alternating' | 'randomized' | 'teacher-selected' = 'alternating') {
  const added = insertScene(createLesson(), 'story', createScene('Wheel'));
  const sceneId = added.project.sequences.story[0].sceneId;
  const withCard = addCard(added.project, sceneId), project = withCard.project;
  const object = project.scenes[sceneId].objects[0]; if (object.kind !== 'card') throw Error('Card');
  project.cards[object.cardId].faces[0].text = 'PUBLIC QUESTION';
  project.cards[object.cardId].faces[1].text = 'SECRET ANSWER';
  let config = createWheelConfig();
  for (let i = 0; i < 8; i++) config = addWheelActivity(config, i < 4 ? 'question' : 'event', i < 4 ? object.cardId : undefined);
  config.activities.filter(a => a.kind === 'event').forEach(a => { a.config = { label: 'Movement break', instructions: 'TEACHER PRIVATE', studentText: 'Stand up!' }; });
  config.settings = { ...config.settings, playCount: 6, questionCount: 3, sequenceMode: mode };
  project.scenes[sceneId].breakExperience = config; project.sequences.story[0].kind = 'break';
  return { ...added, project, config, sceneId };
}
function act(config: ReturnType<typeof fixture>['config'], state: WheelRuntimeState, type: WheelAction['type'], extra: Partial<WheelAction> = {}) {
  const action = { type, expectedRevision: state.revision, configKey: state.configKey, sessionId: 'session', occurrenceId: 'entry', visit: 1, entropy: .2, ...extra } as WheelAction;
  return transitionMiniGame(config, state, action).state as WheelRuntimeState;
}
test('v2 explicit phases, six slots, alternating quotas and no repetitions', () => {
  const { config } = fixture(); let state = initializeMiniGame(config) as WheelRuntimeState;
  assert.equal(state.phase, 'ready'); state = act(config, state, 'start');
  assert.equal(state.phase, 'selecting');
  for (let i = 0; i < 6; i++) {
    state = act(config, state, 'select'); assert.equal(state.phase, 'revealed');
    assert.equal(config.activities.find(a => a.id === state.currentActivityId)!.kind, i % 2 ? 'event' : 'question');
    assert.equal(readWheelSettings(config)!.segments.find(s => s.id === state.selectedSegmentId)!.activityId, state.currentActivityId);
    state = act(config, state, 'show'); assert.equal(state.phase, 'active');
    state = act(config, state, 'complete');
    if (i < 5) { assert.equal(state.phase, 'activity-complete'); state = act(config, state, 'next'); }
  }
  assert.equal(state.phase, 'session-complete'); assert.equal(new Set(state.usedActivityIds).size, 6);
});
test('random and teacher selection respect quotas and configured segments', () => {
  for (const mode of ['randomized', 'teacher-selected'] as const) {
    const { config } = fixture(mode); let state = act(config, initializeMiniGame(config) as WheelRuntimeState, 'start');
    for (let i = 0; i < 6; i++) {
      const candidates = eligibleWheelSegments(config, state);
      const extra = mode === 'teacher-selected' ? { segmentId: candidates[0].id } : { entropy: .99 };
      state = act(config, state, 'select', extra); state = act(config, state, 'show'); state = act(config, state, 'complete');
      if (i < 5) state = act(config, state, 'next');
    }
    assert.equal(state.usedActivityIds.filter(id => config.activities.find(a => a.id === id)?.kind === 'question').length, 3);
    assert.equal(state.phase, 'session-complete');
  }
});
test('skip consumes a slot, reset invalidates old commands, invalid transitions do nothing', () => {
  const { config } = fixture(); let state = initializeMiniGame(config) as WheelRuntimeState;
  assert.deepEqual(act(config, state, 'complete'), state);
  state = act(config, act(config, state, 'start'), 'select'); state = act(config, state, 'skip');
  assert.equal(state.usedActivityIds.length, 1); assert.equal(state.skippedActivityIds.length, 1);
  const before = state; state = act(config, state, 'reset');
  assert.equal(state.phase, 'ready'); assert.ok(state.revision > before.revision);
  assert.deepEqual(act(config, state, 'start', { expectedRevision: before.revision }), state);
  assert.deepEqual(restoreMiniGame(config, JSON.parse(JSON.stringify(state))), state);
});
test('session actions reject duplicates, delayed commands and wrong occurrences; caches restore', () => {
  const f = fixture(), copy = duplicateEntry(f.project, 'story', f.entryId, 'story', true);
  let session = navigate(copy.project, createSession(), { sequence: 'story', entryId: f.entryId });
  const wheel = session.miniGame as WheelRuntimeState;
  const action: WheelAction = { type: 'start', expectedRevision: wheel.revision, configKey: wheel.configKey, sessionId: session.id, occurrenceId: f.entryId, visit: session.visit };
  session = actOnMiniGame(copy.project, session, action);
  assert.equal(actOnMiniGame(copy.project, session, action), session);
  session = navigate(copy.project, session, { sequence: 'story', entryId: copy.entryId });
  assert.equal((session.miniGame as WheelRuntimeState).phase, 'ready');
  assert.equal(actOnMiniGame(copy.project, session, action), session);
  session = navigate(copy.project, JSON.parse(JSON.stringify(session)), { sequence: 'story', entryId: f.entryId });
  assert.equal((session.miniGame as WheelRuntimeState).phase, 'selecting');
  assert.equal(actOnMiniGame(copy.project, session, { ...action, expectedRevision: 1 }), session);
});
test('public projection and snapshot restore contain current question only, never answers or teacher text', () => {
  const f = fixture(); let session = navigate(f.project, createSession(), { sequence: 'story', entryId: f.entryId });
  const send = (type: WheelAction['type']) => {
    const state = session.miniGame as WheelRuntimeState;
    session = actOnMiniGame(f.project, session, { type, configKey: state.configKey, expectedRevision: state.revision, sessionId: session.id, occurrenceId: f.entryId, visit: session.visit, entropy: 0 });
  };
  send('start'); send('select');
  let plan = projectScene(f.project, f.sceneId, session);
  assert.equal(JSON.stringify(plan).includes('PUBLIC QUESTION'), false);
  send('show'); plan = projectScene(f.project, f.sceneId, session);
  const wire = JSON.stringify(plan);
  assert.ok(wire.includes('PUBLIC QUESTION')); assert.equal(wire.includes('SECRET ANSWER'), false); assert.equal(wire.includes('TEACHER PRIVATE'), false);
  assert.equal(plan.objects.length, 0); assert.deepEqual(parseScenePlan(JSON.parse(wire)), plan);
  const editPlan = projectScene(f.project, f.sceneId, session, undefined, 'break', true);
  assert.ok(editPlan.objects.some(object => object.kind === 'card')); assert.equal(editPlan.wheel, undefined);
  const snapshot = { sessionId: session.id, revision: session.revision, target: { kind: 'scene', occurrenceId: f.entryId, plan } };
  assert.deepEqual(parsePresentSnapshot(JSON.parse(JSON.stringify(snapshot))), snapshot);
  const cardId = f.config.activities[0].contentRef!;
  f.project.cards[cardId].faces[0] = { ...f.project.cards[cardId].faces[0], layout: 'image-only', imageAssetId: 'question-image' };
  const imagePlan = projectScene(f.project, f.sceneId, session, id => id === 'question-image' ? 'media://assets/question.png' : undefined);
  assert.deepEqual(sceneImageSources(imagePlan), ['media://assets/question.png']);
  assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(imagePlan))), imagePlan);
});
test('deterministic selection rejects bad entropy, invalid picks and repeated activity segments', () => {
  const { config } = fixture('teacher-selected');
  const s = readWheelSettings(config)!;
  config.settings.segments = [...s.segments, { ...s.segments[0], id: 'same-activity' }];
  let state = act(config, initializeMiniGame(config) as WheelRuntimeState, 'start');
  assert.deepEqual(act(config, state, 'select', { segmentId: 'missing' }), state);
  state = act(config, state, 'select', { segmentId: 'same-activity' });
  state = act(config, act(config, state, 'show'), 'complete'); state = act(config, state, 'next');
  assert.equal(eligibleWheelSegments(config, state).some(segment => segment.activityId === config.activities[0].id), false);
  const random = fixture('randomized').config, running = act(random, initializeMiniGame(random) as WheelRuntimeState, 'start');
  assert.deepEqual(act(random, running, 'select', { entropy: NaN }), running);
  assert.deepEqual(act(random, running, 'select', { entropy: 1 }), running);
  assert.deepEqual(act(random, running, 'select'), act(random, JSON.parse(JSON.stringify(running)), 'select'));
});
test('raw drafts are guarded; prepared rounds exclude missing content and retain private fallback', () => {
  const f = fixture();
  const first = f.config.activities[0]; delete first.contentRef;
  const initial = initializeMiniGame(f.config) as WheelRuntimeState;
  assert.deepEqual(act(f.config, initial, 'start'), initial);
  first.contentRef = 'missing';
  let session = navigate(f.project, createSession(), { sequence: 'story', entryId: f.entryId });
  const plan = projectScene(f.project, f.sceneId, session);
  assert.equal(plan.wheel?.blocked, false); assert.equal(plan.objects.length, 0);
  assert.equal(JSON.stringify(plan).includes('SECRET ANSWER'), false);
  assert.equal(actOnMiniGame(f.project, session, { type: 'begin' }), session);
  const object = f.project.scenes[f.sceneId].objects[0];
  if (object.kind === 'card') object.initialFaceId = f.project.cards[object.cardId].faces[1].id;
  for (const unsupported of [{ ...f.config, gameType: 'future-game' }, { ...f.config, activities: null }]) {
    (f.project.scenes[f.sceneId] as any).breakExperience = unsupported;
    const fallback = projectScene(f.project, f.sceneId, session);
    assert.equal(fallback.objects.length, 0); assert.equal(JSON.stringify(fallback).includes('SECRET ANSWER'), false);
  }
});
test('events project only public message; the teacher instructions never enter snapshots', () => {
  const f = fixture(); let state = initializeMiniGame(f.config) as WheelRuntimeState;
  for (const type of ['start', 'select', 'show', 'complete', 'next', 'select', 'show'] as const) state = act(f.config, state, type);
  const session = { ...navigate(f.project, createSession(), { sequence: 'story', entryId: f.entryId }), miniGame: state };
  const plan = projectScene(f.project, f.sceneId, session), wire = JSON.stringify(plan);
  assert.equal(plan.wheel?.activity?.kind, 'event'); assert.ok(wire.includes('Stand up!'));
  assert.equal(wire.includes('TEACHER PRIVATE'), false); assert.equal(wire.includes('SECRET ANSWER'), false);
  assert.deepEqual(parseScenePlan(JSON.parse(wire)), plan);
  const unsafe = JSON.parse(wire); unsafe.wheel.activity.teacherInstructions = 'PRIVATE';
  assert.equal(JSON.stringify(parseScenePlan(unsafe)).includes('PRIVATE'), false);
  unsafe.wheel.activity.studentText = 'x'.repeat(2001); assert.equal(parseScenePlan(unsafe), null);
});
test('existing relay restores current state for late/reloaded Present and rejects old snapshots', () => {
  const f = fixture(), relay = new PresentSnapshotRelay();
  let state = initializeMiniGame(f.config) as WheelRuntimeState;
  const session = navigate(f.project, createSession(), { sequence: 'story', entryId: f.entryId });
  const snapshot = (revision: number) => ({ sessionId: session.id, revision, target: { kind: 'scene', occurrenceId: f.entryId, plan: projectScene(f.project, f.sceneId, { ...session, miniGame: state }) } });
  relay.publish(snapshot(0)); const first = JSON.parse(JSON.stringify(relay.envelope));
  for (const [i, type] of (['start', 'select', 'show'] as const).entries()) { state = act(f.config, state, type); assert.ok(relay.publish(snapshot(i + 1))); }
  assert.equal(relay.publish(snapshot(1)), null);
  const late = JSON.parse(JSON.stringify(relay.envelope));
  assert.equal(assessPresentEnvelope(null, late), 'apply'); assert.equal(assessPresentEnvelope(first, late), 'recover');
  const restored = parsePresentSnapshot(late.snapshot); assert.ok(restored?.target.kind === 'scene');
  if (restored.target.kind === 'scene') assert.equal(restored.target.plan.wheel?.phase, 'active');
});
test('finish/reset and restoration validate phases, counts and selected segment association', () => {
  const { config } = fixture(); const initial = initializeMiniGame(config) as WheelRuntimeState;
  for (const bad of [{ ...initial, revision: -1 }, { ...initial, usedActivityIds: ['missing'] }, { ...initial, phase: 'active', currentActivityId: config.activities[0].id, selectedSegmentId: 'missing' }]) assert.deepEqual(restoreMiniGame(config, bad), initial);
  let state = act(config, act(config, initial, 'start'), 'finish');
  assert.equal(state.phase, 'session-complete'); assert.equal(state.usedActivityIds.length, 0);
  assert.deepEqual(act(config, state, 'select'), state);
  state = act(config, state, 'reset'); state = act(config, state, 'start');
  for (let i = 0; i < 6; i++) { state = act(config, state, 'select'); state = act(config, state, 'skip'); if (i < 5) state = act(config, state, 'next'); }
  assert.equal(state.phase, 'session-complete'); assert.equal(state.skippedActivityIds.length, 6);
  assert.equal(state.usedActivityIds.length, 6); assert.deepEqual(restoreMiniGame(config, JSON.parse(JSON.stringify(state))), state);
});


test('timed snapshots survive relay serialization and only deliberate valid Card faces become public', () => {
 const f=fixture(); let session=navigate(f.project,createSession(),{sequence:'story',entryId:f.entryId});
 const send=(type:WheelAction['type'],extra:Partial<WheelAction>={})=>{
  const state=session.miniGame as WheelRuntimeState;
  session=actOnMiniGame(f.project,session,{type,configKey:state.configKey,expectedRevision:state.revision,sessionId:session.id,occurrenceId:f.entryId,visit:session.visit,entropy:0,atMs:6000,...extra});
 };
 send('start'); send('select',{spin:{startedAt:1000,durationMs:4800}});
 const project=()=>projectScene(f.project,f.sceneId,session);
 const plan=project(); assert.ok(plan.wheel?.spin); assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.equal(JSON.stringify(plan).includes('SECRET ANSWER'),false); assert.equal(JSON.stringify(plan).includes('PUBLIC QUESTION'),false);
 send('show'); const before=session; send('face',{faceId:'missing-face'}); assert.equal(session,before);
 const card=f.project.cards[f.config.activities[0].contentRef!]; send('face',{faceId:card.faces[1].id});
 assert.ok(JSON.stringify(project()).includes('SECRET ANSWER')); assert.equal(JSON.stringify(project()).includes('PUBLIC QUESTION'),false);
 assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(project()))),project());
 send('reset'); assert.equal(project().wheel?.spin,undefined); assert.equal(JSON.stringify(project()).includes('SECRET ANSWER'),false);
});
