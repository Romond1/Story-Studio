import test from 'node:test';
import assert from 'node:assert/strict';
import { addText, createLesson, insertScene } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import { parseScenePlan, projectScene } from './lesson/projection';

test('lesson references must name authored records rather than inherited object properties', () => {
  assert.throws(() => parseLessonProject({ ...createLesson(), library: ['toString'] }), /reference|identity/i);
  assert.throws(() => parseLessonProject({ ...createLesson(), sequences: { story: [{ id: 'entry', sceneId: 'valueOf', section: '' }], activation: [] } }), /reference|identity/i);
});

test('card set IDs remain unique before their record projection is validated', () => {
  const set = { id: 'set-one', label: 'Set', tags: [], entries: [] };
  assert.throws(() => parseLessonProject({ ...createLesson(), cardSets: [set, set] }), /collection|unique|set/i);
});

test('asset bin references must point to a real bin and malformed optional references are rejected', () => {
  const asset = { id: 'asset', filename: 'asset.png', relativePath: 'assets/asset.png', originalName: 'asset.png', mediaType: 'image', sizeBytes: 1, importedAt: '2026-10-08', binId: 'missing' };
  assert.throws(() => parseLessonProject({ ...createLesson(), assets: [asset] }), /bin|asset/i);
});

test('valid extension metadata remains intact through the format boundary', () => {
  const project = { ...createLesson(), authorMetadata: { note: 'preserved' } };
  assert.deepEqual(parseLessonProject(project), project);
});

test('persisted scene appearance follows the same color and text-size contract as Present', () => {
  const inserted = insertScene(createLesson(), 'story'), sceneId = inserted.project.sequences.story[0].sceneId;
  const lesson = addText(inserted.project, sceneId, 'bubble').project;
  const scene = lesson.scenes[sceneId];
  assert.ok(parseScenePlan(projectScene(parseLessonProject(lesson), sceneId)));
  assert.throws(() => parseLessonProject({ ...lesson, scenes: { [sceneId]: { ...scene, background: { color: 'invalid-color' } } } }), /color|background/i);
  assert.throws(() => parseLessonProject({ ...lesson, scenes: { [sceneId]: { ...scene, objects: [{ ...scene.objects[0], fontSize: 6 }] } } }), /text/i);
  assert.throws(() => parseLessonProject({ ...lesson, scenes: { [sceneId]: { ...scene, objects: [{ ...scene.objects[0], color: 'currentColor' }] } } }), /text/i);
  assert.throws(() => parseLessonProject({ ...lesson, scenes: { [sceneId]: { ...scene, drawings: [{ id: 'stroke', color: 'invalid-color', size: 2, opacity: 1, rainbow: false, points: [] }] } } }), /drawing/i);
});
