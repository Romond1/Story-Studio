import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineZoom,zoomScroll,timelineDensity,timelineSceneTitle } from './lessonTimeline';
import type { AssetItem } from './types';

test('timeline labels derive readable imported names but preserve authored scene titles', () => {
  const asset: AssetItem = { id: 'image', filename: 'uuid.jpg', originalName: 'Four_characters_exploring_volcano_2K_20261008160704.jpg', relativePath: 'assets/uuid.jpg', mediaType: 'image', sizeBytes: 1, importedAt: '' };
  assert.equal(timelineSceneTitle({ title: asset.originalName }, asset), 'Four Characters Exploring Volcano');
  assert.equal(timelineSceneTitle({ title: asset.originalName }, { ...asset, displayTitle: 'The Hidden Door' }), 'The Hidden Door');
  assert.equal(timelineSceneTitle({ title: 'Question 4: Look closely' }, asset), 'Question 4: Look closely');
  assert.equal(timelineSceneTitle({ title: 'A blank scene' }), 'A blank scene');
  assert.equal(timelineSceneTitle(undefined), 'Missing scene');
});
test('global zoom clamps and pointer position remains at the same content fraction',()=>{
  assert.equal(timelineZoom(8),2.6);assert.equal(timelineZoom(0),.45);
  const next=zoomScroll(500,120,1000,1500);assert.equal((next+120)/1500,(500+120)/1000);
  assert.deepEqual([.5,1,1.5,2.5].map(timelineDensity),['overview','normal','detail','frame']);
});
