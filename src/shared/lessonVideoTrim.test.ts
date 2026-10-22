import test from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, createScene, insertScene } from './lesson/commands';
import { parseSceneDocument } from './lesson/validation';
import { projectScene, parseScenePlan } from './lesson/projection';
import { ProjectHistory } from './projectHistory';
import { updateSceneVideoTrim } from './lessonVideoTrim';
import { createMediaRegistry } from './content/mediaRegistry';

function fixture() {
  let project = createLesson('Video range');
  project.assets = [{ id: 'video', filename: 'uuid.webm', originalName: 'Forest.webm', relativePath: 'assets/uuid.webm', mediaType: 'video', sizeBytes: 1, importedAt: '' }];
  const scene = createScene('Selected video', 'video'); project = insertScene(project, 'story', scene).project;
  return { project, scene };
}

test('scene trim updates only the selected scene, projects and round trips without modifying source metadata', () => {
  const { project, scene } = fixture(), before = JSON.stringify(project);
  const next = updateSceneVideoTrim(project, scene.id, { inSec: 2, outSec: 8 }, 10);
  assert.deepEqual(next.scenes[scene.id].background.videoTrim, { inSec: 2, outSec: 8 });
  assert.equal(next.assets, project.assets); assert.equal(next.sequences, project.sequences);
  assert.equal(JSON.stringify(project), before);
  assert.equal(createMediaRegistry({ format: 'scene', data: next }).dependencies().complete, true);
  const saved = parseSceneDocument(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(saved.scenes[scene.id].background.videoTrim, { inSec: 2, outSec: 8 });
  const plan = projectScene(saved, scene.id);
  assert.deepEqual(plan.background.videoTrim, { inSec: 2, outSec: 8 });
  assert.deepEqual(parseScenePlan(plan), plan);
  assert.equal((parseScenePlan({ ...plan, background: { ...plan.background, videoTrim: { inSec: 8, outSec: 2 } } })), null);
});

test('scene trim clamps to source duration and returns to legacy full-video defaults', () => {
  const { project, scene } = fixture();
  const next = updateSceneVideoTrim(project, scene.id, { inSec: 1, outSec: 50 }, 10);
  assert.deepEqual(next.scenes[scene.id].background.videoTrim, { inSec: 1, outSec: 10 });
  const reset = updateSceneVideoTrim(next, scene.id, { inSec: 0, outSec: 10 }, 10);
  assert.equal(reset.scenes[scene.id].background.videoTrim, undefined);
  assert.throws(() => updateSceneVideoTrim(project, scene.id, { inSec: 5, outSec: 4 }, 10), /range/i);
  assert.throws(() => updateSceneVideoTrim(project, scene.id, { inSec: 10, outSec: 11 }, 10), /range/i);
  assert.throws(() => updateSceneVideoTrim(project, 'missing', { inSec: 1, outSec: 2 }, 10), /video/i);
});

test('invalid authored scene trim is rejected and one handle gesture is one undo step', () => {
  const { project, scene } = fixture();
  for (const videoTrim of [{ inSec: -1 }, { inSec: 0, outSec: 0 }, { inSec: 2, outSec: 1 }, { inSec: '1' }, { inSec: 1, extra: true }]) {
    assert.throws(() => parseSceneDocument({ ...project, scenes: { [scene.id]: { ...scene, background: { ...scene.background, videoTrim } } } }), /trim/i);
  }
  const history = new ProjectHistory<typeof project>(); history.reset(project); const gesture = {};
  let next = project;
  for (const inSec of [1, 2, 3]) { next = updateSceneVideoTrim(next, scene.id, { inSec, outSec: 8 }, 10); history.record(next, gesture); }
  assert.equal(history.undo()?.scenes[scene.id].background.videoTrim, undefined);
  assert.equal(history.canUndo, false);
  assert.deepEqual(history.redo()?.scenes[scene.id].background.videoTrim, { inSec: 3, outSec: 8 });
});
