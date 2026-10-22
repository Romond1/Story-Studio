import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaDisplayName, mediaDisplayTitle, renameMediaAsset } from './mediaDisplayName';
import type { AssetItem } from './types';
import { createLesson, createScene, insertScene } from './lesson/commands';
import { parseSceneDocument } from './lesson/validation';
import { ProjectHistory } from './projectHistory';

const asset = (originalName: string, mediaType: AssetItem['mediaType'] = 'video'): AssetItem => ({ id: 'asset', relativePath: 'assets/uuid.mp4', filename: 'uuid.mp4', originalName, mediaType, sizeBytes: 1, importedAt: '' });

test('media titles remove recognizable export suffixes without losing descriptive words or meaningful numbers', () => {
  for (const [filename, title] of [
    ['forest_walk_20261022_142305_1920x1080_h264_export.mp4', 'Forest Walk'],
    ['THE-RED-FOX_1080p_30fps.mp4', 'The Red Fox'],
    ['1080p_forest_walk_1920x1080.png', 'Forest Walk'],
    ['Forest_Walk_[H.264]_60fps_FINAL.mp4', 'Forest Walk'],
    ['Chapter_2-The_Year_2024.mp4', 'Chapter 2 The Year 2024'],
    ['lesson-12-v2.mp4', 'Lesson 12 V2'],
    ['sunset_2026-10-22T14-23-05.123Z_final.mov', 'Sunset'],
    ['teacher_export_examples.mp4', 'Teacher Export Examples'],
    ['village.photo.PNG', 'Village Photo'],
    ['森の散歩_1080p.mp4', '森の散歩'],
    ['1080p.mp4', '1080p'],
  ]) assert.equal(mediaDisplayTitle(asset(filename)), title, filename);
});

test('old and duplicate imports get deterministic type prefixes with no numbering or mutations', () => {
  const first = asset('blue_sky.png', 'image');
  const second = { ...first, id: 'other', filename: 'other.png', relativePath: 'assets/other.png' };
  const before = JSON.stringify([first, second]);
  assert.equal(mediaDisplayName(first), 'PIC - Blue Sky');
  assert.equal(mediaDisplayName(second), mediaDisplayName(first));
  assert.equal(mediaDisplayName(asset('blue_sky.mp4')), 'VID - Blue Sky');
  assert.equal(mediaDisplayName(asset('bird_song.mp3', 'audio')), 'Bird Song');
  assert.equal(JSON.stringify([first, second]), before);
});

test('rename only updates the display title and preserves exact user capitalization', () => {
  const original = asset('forest_walk_export.mp4');
  const project = { assets: [original, { ...original, id: 'other' }], unrelated: 'keep' };
  const renamed = renameMediaAsset(project, 'asset', '  VID - My NASA   Clip  ');
  assert.equal(mediaDisplayName(renamed.assets[0]), 'VID - My NASA Clip');
  assert.equal(renamed.assets[0].displayTitle, 'My NASA Clip');
  assert.deepEqual({ ...renamed.assets[0], displayTitle: undefined }, { ...original, displayTitle: undefined });
  assert.equal(renamed.assets[1], project.assets[1]);
  assert.equal(original.displayTitle, undefined);
  assert.equal(renameMediaAsset(renamed, 'asset', 'My NASA Clip'), renamed);
  assert.throws(() => renameMediaAsset(project, 'asset', '   '), /title/i);
  assert.throws(() => renameMediaAsset(project, 'asset', 'x'.repeat(201)), /title/i);
  assert.throws(() => renameMediaAsset(project, 'missing', 'Name'), /media/i);
});

test('renames round trip through scene validation and undo/redo without changing references', () => {
  const a = asset('forest_walk.mp4');
  let project = createLesson('Names'); project.assets = [a];
  project = insertScene(project, 'story', createScene('Scene', a.id)).project;
  const history = new ProjectHistory<typeof project>(); history.reset(project);
  const renamed = renameMediaAsset(project, a.id, 'Forest at Dawn');
  history.record(renamed);
  const loaded = parseSceneDocument(JSON.parse(JSON.stringify(renamed)));
  assert.equal(loaded.assets[0].displayTitle, 'Forest at Dawn');
  assert.deepEqual(loaded.sequences, project.sequences);
  assert.deepEqual(loaded.scenes, project.scenes);
  assert.equal(history.undo()?.assets[0].displayTitle, undefined);
  assert.equal(history.redo()?.assets[0].displayTitle, 'Forest at Dawn');
  for (const displayTitle of [123, 'x'.repeat(201), '']) {
    assert.throws(() => parseSceneDocument({ ...project, assets: [{ ...a, displayTitle }] }), /asset/i);
  }
});
