import test from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, createScene, insertScene, duplicateEntry, addCard } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import { defaultExperience, resolveBreakExperience } from './lesson/miniGameBreak';
import { initializeMiniGame, transitionMiniGame, restoreMiniGame } from './lesson/miniGameRuntime';
import { projectScene, parseScenePlan } from './lesson/projection';
import { createSession, navigate, actOnMiniGame, resetScene } from './lesson/session';
import { createEpisodeFromScene } from './episode/commands';
import { parseSceneDocument } from './lesson/validation';
import { exportEpisodePackage, importEpisodePackage } from '../main/episodePackageService';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parsePresentSnapshot } from './presentationSnapshot';

const experience = () => ({ ...defaultExperience('spinning-wheel'), configVersion: 1, settings: {}, activities: [
  { id: 'event1', kind: 'event' as const }, { id: 'question1', kind: 'question' as const },
] });
function fixture() {
  const scene = { ...createScene('Break'), breakExperience: experience() };
  const added = insertScene(createLesson(), 'story', scene);
  added.project.sequences.story[0].kind = 'break';
  return { ...added, scene };
}
test('old scenes load as Classic and retain identical projection', () => {
  const added = insertScene(createLesson(), 'story', createScene());
  const loaded = parseLessonProject(JSON.parse(JSON.stringify(added.project)));
  assert.equal(resolveBreakExperience(undefined).status, 'classic');
  assert.equal(projectScene(loaded, loaded.sequences.story[0].sceneId).miniGame, undefined);
});
test('configuration round trips; independent copies regenerate activity IDs, linked copies share', () => {
  const { project, entryId, scene } = fixture();
  const loaded = parseLessonProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(loaded.scenes[scene.id].breakExperience, scene.breakExperience);
  const copy = duplicateEntry(loaded, 'story', entryId, 'story');
  const copiedScene = copy.project.scenes[copy.project.sequences.story.find(e => e.id === copy.entryId)!.sceneId];
  assert.notEqual(copiedScene.breakExperience, scene.breakExperience);
  assert.notEqual((copiedScene.breakExperience as typeof scene.breakExperience).activities[0].id, 'event1');
  const linked = duplicateEntry(loaded, 'story', entryId, 'story', true);
  assert.equal(linked.project.sequences.story.find(e => e.id === linked.entryId)!.sceneId, scene.id);
});
test('unknown, invalid and future configurations are preserved but unavailable', () => {
  for (const config of [{ ...experience(), gameType: 'future-game' }, { ...experience(), configVersion: 99 }, { ...experience(), activities: [{ id: 'same', kind: 'oops' }] }]) {
    assert.equal(resolveBreakExperience(config).status, 'unavailable');
    const { project, scene } = fixture();
    (project.scenes[scene.id] as any).breakExperience = config;
    const loaded = parseLessonProject(JSON.parse(JSON.stringify(project)));
    const plan = projectScene(loaded, scene.id);
    assert.equal(plan.miniGame?.status, 'unavailable');
    assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))), plan);
  }
});
test('runtime is deterministic, serializable and supports teacher-defined event/question order', () => {
  const config = experience();
  let state = initializeMiniGame(config)!;
  state = transitionMiniGame(config, state, { type: 'begin' }).state;
  for (const id of ['event1', 'question1']) {
    const restored = JSON.parse(JSON.stringify(state));
    const action = { type: 'reveal' as const, activityId: id };
    assert.deepEqual(transitionMiniGame(config, state, action), transitionMiniGame(config, restored, action));
    state = transitionMiniGame(config, state, action).state;
    state = transitionMiniGame(config, state, { type: 'complete' }).state;
  }
  assert.deepEqual(state.usedActivityIds, ['event1', 'question1']);
  assert.deepEqual(transitionMiniGame(config, state, { type: 'reveal', activityId: 'event1' }).state, state);
  assert.equal(transitionMiniGame(config, state, { type: 'end' }).state.phase, 'ended');
  assert.deepEqual(transitionMiniGame(config, state, { type: 'reset' }).state, initializeMiniGame(config));
});
test('Break activation initializes runtime, occurrences isolate it, reset clears only current visit', () => {
  const { project, entryId, scene } = fixture();
  const linked = duplicateEntry(project, 'story', entryId, 'story', true);
  let session = navigate(linked.project, createSession(), { sequence: 'story', entryId });
  assert.equal(session.miniGame?.phase, 'ready');
  session = actOnMiniGame(linked.project, session, { type: 'begin' });
  session = actOnMiniGame(linked.project, session, { type: 'reveal', activityId: 'event1' });
  const livePlan = projectScene(linked.project, scene.id, session);
  assert.equal(livePlan.miniGame?.phase, 'running');
  assert.equal(livePlan.miniGame?.currentActivityId, 'event1');
  assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(livePlan))), livePlan);
  const snapshot = parsePresentSnapshot({ sessionId: session.id, revision: session.revision, target: { kind: 'scene', occurrenceId: entryId, plan: livePlan } });
  assert.ok(snapshot?.target.kind === 'scene');
  if (snapshot.target.kind === 'scene') assert.equal(snapshot.target.plan.miniGame?.currentActivityId, 'event1');
  session = navigate(linked.project, session, { sequence: 'story', entryId: linked.entryId });
  assert.equal(session.miniGame?.phase, 'ready');
  session = navigate(linked.project, JSON.parse(JSON.stringify(session)), { sequence: 'story', entryId });
  assert.equal(session.miniGame?.currentActivityId, 'event1');
  assert.equal(resetScene(linked.project, session).miniGame?.phase, 'ready');
});
test('a normal occurrence sharing Break authoring does not project or run a mini-game', () => {
  const { project, scene, entryId } = fixture();
  const shared = duplicateEntry(project, 'story', entryId, 'story', true);
  shared.project.sequences.story.find(e => e.id === shared.entryId)!.kind = 'scene';
  const session = navigate(shared.project, createSession(), { sequence: 'story', entryId: shared.entryId });
  assert.equal(session.miniGame, undefined);
  assert.equal(resetScene(shared.project, session).miniGame, undefined);
  assert.equal(projectScene(shared.project, scene.id, session).miniGame, undefined);
});
test('sequence policy is configurable and rejects out-of-order reveals', () => {
  const config = { ...experience(), settings: { sequence: ['event1', 'question1'] } };
  const initial = initializeMiniGame(config);
  assert.ok(initial);
  const running = transitionMiniGame(config, initial, { type: 'begin' }).state;
  assert.equal(transitionMiniGame(config, running, { type: 'reveal', activityId: 'question1' }).state.currentActivityId, null);
  assert.equal(transitionMiniGame(config, running, { type: 'reveal', activityId: 'event1' }).state.currentActivityId, 'event1');
  const { project, scene, entryId } = fixture();
  project.scenes[scene.id].breakExperience = config;
  const copy = duplicateEntry(project, 'story', entryId, 'story');
  const target = copy.project.scenes[copy.project.sequences.story.find(e => e.id === copy.entryId)!.sceneId];
  assert.equal(resolveBreakExperience(target.breakExperience).status, 'planned');
  if (target.breakExperience?.mode === 'minigame') assert.deepEqual(target.breakExperience.settings.sequence, target.breakExperience.activities.map(a => a.id));
});
test('invalid runtime restores to authored defaults; invalid projected runtime is rejected', () => {
  const config = experience(), initial = initializeMiniGame(config)!;
  for (const invalid of [null, {}, { ...initial, usedActivityIds: ['missing'] }, { ...initial, version: 99 }, { ...initial, configKey: 'stale' }]) assert.deepEqual(restoreMiniGame(config, invalid), initial);
  const { project, scene } = fixture(), plan = projectScene(project, scene.id);
  assert.equal(parseScenePlan({ ...plan, miniGame: { status: 'planned', usedActivityIds: ['a', 'a'] } }), null);
});
test('independent copies remap local Card references and preserve library references', () => {
  const { project, scene, entryId } = fixture();
  const added = addCard(project, scene.id);
  const object = added.project.scenes[scene.id].objects.find(o => o.id === added.objectId)!;
  assert.equal(object.kind, 'card');
  if (object.kind !== 'card') return;
  const config = experience(); config.activities[1] = { ...config.activities[1], contentRef: object.cardId } as any;
  added.project.scenes[scene.id].breakExperience = config;
  const copy = duplicateEntry(added.project, 'story', entryId, 'story');
  const target = copy.project.scenes[copy.project.sequences.story.find(e => e.id === copy.entryId)!.sceneId];
  const copiedCard = target.objects.find(o => o.kind === 'card')!;
  assert.equal(copiedCard.kind, 'card');
  if (target.breakExperience?.mode === 'minigame' && copiedCard.kind === 'card') assert.equal(target.breakExperience.activities[1].contentRef, copiedCard.cardId);
  assert.equal(resolveBreakExperience({ ...experience(), activities: [{ id: 'missing', kind: 'question', contentRef: 'missing' }] }, id => !!project.cards[id]).status, 'unavailable');
});
test('episode portable export/import retains configuration and excludes runtime', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-game-package-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { project, scene } = fixture();
  const episode = { ...createEpisodeFromScene(project, { id: 'adventure', version: '1' }),
    adventureDefinition: { id: 'adventure', version: '1', name: 'Adventure', description: '', rewards: [], relics: [] } };
  episode.requiredCapabilities.push('adventure-definitions-v1');
  const source = path.join(root, 'source'), target = path.join(root, 'package'), editable = path.join(root, 'editable');
  for (const folder of [source, target, editable]) await fs.mkdir(folder);
  await fs.writeFile(path.join(source, 'project.json'), JSON.stringify(episode));
  await exportEpisodePackage({ source, target, data: episode, builtinRoot: root, assertCurrent: () => {} });
  await importEpisodePackage({ source: target, target: editable, assertCurrent: () => {} });
  const loaded = parseSceneDocument(JSON.parse(await fs.readFile(path.join(editable, 'project.json'), 'utf8')));
  assert.deepEqual(loaded.scenes[scene.id].breakExperience, scene.breakExperience);
  assert.equal(JSON.stringify(loaded).includes('usedActivityIds'), false);
});

