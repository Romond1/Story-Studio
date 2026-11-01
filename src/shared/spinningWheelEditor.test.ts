import test from 'node:test';
import assert from 'node:assert/strict';
import { createWheelConfig, readWheelSettings, addWheelActivity, removeWheelActivity, wheelIssues } from './lesson/spinningWheel';
import { setBreakMode, selectBreakGame, resolveBreakExperience, defaultExperience, type BreakExperience } from './lesson/miniGameBreak';
import { createLesson, createScene, insertScene, duplicateEntry, addCard } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import { parseSceneDocument } from './lesson/validation';
import { createEpisodeFromScene } from './episode/commands';
import { exportEpisodePackage, importEpisodePackage } from '../main/episodePackageService';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createSession, navigate, actOnMiniGame } from './lesson/session';

function pool() {
  let config = createWheelConfig();
  for (let i = 0; i < 15; i++) config = addWheelActivity(config, i < 8 ? 'question' : 'event');
  return config;
}
test('15 outcomes and segments remain independent of six plays and 3/3 quota', () => {
  const config = pool(), settings = readWheelSettings(config)!;
  assert.equal(config.activities.length, 15); assert.equal(settings.segments.length, 15);
  assert.equal(settings.playCount, 6); assert.equal(settings.questionCount, 3);
  assert.equal(resolveBreakExperience(config).status, 'planned');
  const loaded = JSON.parse(JSON.stringify(config)); assert.deepEqual(loaded, config);
});
test('removing an outcome removes its segments without reducing session length', () => {
  const config = pool(), id = config.activities[0].id;
  const removed = removeWheelActivity(config, id);
  assert.equal(removed.activities.length, 14);
  assert.equal(readWheelSettings(removed)!.segments.some(s => s.activityId === id), false);
  assert.equal(readWheelSettings(removed)!.playCount, 6);
});
test('draft diagnostics explain shortages without discarding configuration', () => {
  const config = createWheelConfig();
  assert.ok(wheelIssues(config, () => true).some(s => s.includes('question')));
  assert.equal(resolveBreakExperience(config).status, 'planned');
  assert.equal(readWheelSettings({ ...config, settings: { ...config.settings, playCount: -1 } }), undefined);
});
test('Classic and other game choices preserve and restore wheel authoring across save/load', () => {
  const config = pool(); config.settings.title = 'Our review';
  let experience: BreakExperience = setBreakMode(config, 'classic');
  const scene = { ...createScene(), breakExperience: experience };
  const added = insertScene(createLesson(), 'story', scene);
  experience = parseLessonProject(JSON.parse(JSON.stringify(added.project))).scenes[scene.id].breakExperience!;
  experience = setBreakMode(experience, 'minigame');
  assert.equal(experience.mode, 'minigame');
  experience = selectBreakGame(experience, 'magic-hat');
  experience = selectBreakGame(JSON.parse(JSON.stringify(experience)), 'spinning-wheel');
  if (experience.mode === 'minigame') { assert.equal(experience.settings.title, 'Our review'); assert.deepEqual(experience.activities, config.activities); }
});
test('old wheel configs still resolve and can be upgraded without losing sequence or labels', () => {
  const old = defaultExperience('spinning-wheel');
  old.configVersion = 1; old.settings = { sequence: ['old'] };
  old.activities = [{ id: 'old', kind: 'event', config: { label: 'Remember' } }];
  assert.equal(resolveBreakExperience(old).status, 'planned');
  const upgraded = createWheelConfig(old);
  assert.equal(upgraded.activities[0].config?.label, 'Remember');
  assert.deepEqual(upgraded.settings.sequence, ['old']);
});
test('independent copies remap active and Classic-retained segments and Card references', () => {
  for (const mode of ['active', 'classic', 'magic-hat']) {
    let project = createLesson(); const added = insertScene(project, 'story'); project = added.project;
    const sceneId = project.sequences.story[0].sceneId;
    const card = addCard(project, sceneId); project = card.project;
    const object = project.scenes[sceneId].objects[0]; if (object.kind !== 'card') throw Error('Card expected');
    let config = addWheelActivity(createWheelConfig(), 'question', object.cardId);
    project.scenes[sceneId].breakExperience = mode === 'classic' ? setBreakMode(config, 'classic') : mode === 'magic-hat' ? selectBreakGame(config, 'magic-hat') : config;
    const copy = duplicateEntry(project, 'story', added.entryId, 'story');
    const scene = copy.project.scenes[copy.project.sequences.story.find(e => e.id === copy.entryId)!.sceneId];
    const restored = selectBreakGame(setBreakMode(scene.breakExperience, 'minigame'), 'spinning-wheel');
    assert.equal(restored.mode, 'minigame'); if (restored.mode !== 'minigame') return;
    const activity = restored.activities[0], segment = readWheelSettings(restored)!.segments[0];
    assert.notEqual(activity.id, config.activities[0].id); assert.equal(segment.activityId, activity.id);
    assert.notEqual(segment.id, readWheelSettings(config)!.segments[0].id);
    assert.notEqual(activity.contentRef, object.cardId);
    const copiedCard = scene.objects[0]; if (copiedCard.kind === 'card') assert.equal(activity.contentRef, copiedCard.cardId);
  }
});
test('unknown, future and malformed configurations survive switching without being overwritten', () => {
  for (const config of [{ ...pool(), gameType: 'future-game' }, { ...pool(), configVersion: 99 }, { mode: 'minigame', gameType: 'broken', settings: { title: 'Keep me' } }]) {
    const original = JSON.parse(JSON.stringify(config)) as BreakExperience;
    assert.equal(resolveBreakExperience(original).status, 'unavailable');
    assert.deepEqual(setBreakMode(setBreakMode(original, 'classic'), 'minigame'), original);
    assert.deepEqual(selectBreakGame(selectBreakGame(original, 'magic-hat'), (original as any).gameType), { ...original, savedMiniGames: [defaultExperience('magic-hat')] });
  }
});
test('segment validation, session quotas and rejection of legacy commands are explicit', () => {
  const config = pool(), s = readWheelSettings(config)!;
  assert.equal(readWheelSettings({ ...config, settings: { ...s, segments: [{ ...s.segments[0], activityId: 'missing' }] } }), undefined);
  assert.equal(readWheelSettings({ ...config, settings: { ...s, questionCount: 7 } }), undefined);
  const repeated = { ...config, settings: { ...s, segments: [...s.segments, { ...s.segments[0], id: 'extra' }] } };
  assert.equal(readWheelSettings(repeated)!.playCount, 6); assert.equal(readWheelSettings(repeated)!.segments.length, 16);
  const added = insertScene(createLesson(), 'story', { ...createScene(), breakExperience: config });
  added.project.sequences.story[0].kind = 'break';
  const session = navigate(added.project, createSession(), { sequence: 'story', entryId: added.entryId });
  assert.equal(actOnMiniGame(added.project, session, { type: 'begin' }), session);
});
test('malformed editor input is safe and copying opaque future settings preserves their syntax', () => {
  assert.equal(readWheelSettings({ ...createWheelConfig(), activities: null } as any), undefined);
  const config = { ...pool(), configVersion: 99, settings: { segments: [{ custom: 'future segment' }], sequence: ['opaque'] } };
  const added = insertScene(createLesson(), 'story', { ...createScene(), breakExperience: config });
  const copy = duplicateEntry(added.project, 'story', added.entryId, 'story');
  const scene = copy.project.scenes[copy.project.sequences.story.find(e => e.id === copy.entryId)!.sceneId];
  assert.deepEqual(scene.breakExperience, config);
});
test('portable packages preserve active and inactive wheel settings, labels, events and Card links', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wheel-editor-package-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let config = pool(); config.settings.title = 'Fifteen outcomes';
  config.activities[8].config = { label: 'Quick stretch', instructions: 'Stand and stretch.' };
  const added = insertScene(createLesson(), 'story', { ...createScene(), breakExperience: setBreakMode(config, 'classic') });
  const sceneId = added.project.sequences.story[0].sceneId;
  const withCard = addCard(added.project, sceneId), cardObject = withCard.project.scenes[sceneId].objects[0];
  if (cardObject.kind !== 'card') throw Error('Card expected');
  config.activities[0].contentRef = cardObject.cardId;
  withCard.project.scenes[sceneId].breakExperience = setBreakMode(config, 'classic');
  const activeScene = { ...createScene(), breakExperience: config };
  const both = insertScene(withCard.project, 'story', activeScene).project;
  const data = { ...createEpisodeFromScene(both, { id: 'adventure', version: '1' }), adventureDefinition: { id: 'adventure', version: '1', name: 'Adventure', description: '', rewards: [], relics: [] } };
  data.requiredCapabilities.push('adventure-definitions-v1');
  const source = path.join(root, 'source'), target = path.join(root, 'package'), editable = path.join(root, 'editable');
  for (const folder of [source, target, editable]) await fs.mkdir(folder);
  await fs.writeFile(path.join(source, 'project.json'), JSON.stringify(data));
  await exportEpisodePackage({ source, target, data, builtinRoot: root, assertCurrent: () => {} });
  await importEpisodePackage({ source: target, target: editable, assertCurrent: () => {} });
  const loaded = parseSceneDocument(JSON.parse(await fs.readFile(path.join(editable, 'project.json'), 'utf8')));
  assert.deepEqual(loaded.scenes[sceneId].breakExperience, data.scenes[sceneId].breakExperience);
  assert.deepEqual(loaded.scenes[activeScene.id].breakExperience, config);
  assert.deepEqual(loaded.cards[cardObject.cardId], both.cards[cardObject.cardId]);
  const restored = setBreakMode(loaded.scenes[sceneId].breakExperience, 'minigame');
  assert.deepEqual(restored, config);
});
