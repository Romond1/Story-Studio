import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineZoom,zoomScroll,timelineDensity } from './lessonTimeline';
test('global zoom clamps and pointer position remains at the same content fraction',()=>{
  assert.equal(timelineZoom(8),2.6);assert.equal(timelineZoom(0),.45);
  const next=zoomScroll(500,120,1000,1500);assert.equal((next+120)/1500,(500+120)/1000);
  assert.deepEqual([.5,1,1.5,2.5].map(timelineDensity),['overview','normal','detail','frame']);
});
