import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardRuntime, timerSeconds } from './cardRuntime';
import type { BCardInstance } from './types';
const instances: BCardInstance[] = [{ id: 'one', bCardId: 'card', position: { x: 50, y: 50 }, size: { width: 100, height: 100 }, zIndex: 1 }];
test('occurrence layouts initialize once and never mutate authored instances', () => {
  const core = new CardRuntime(); core.activate('slide-a');
  const first = core.ensure('ref-a', instances, 1000);
  core.move('slide-a', 'ref-a', 'one', { position: { x: 20, y: 30 } });
  assert.equal(instances[0].position.x, 50);
  assert.equal(core.ensure('ref-a', instances, 9000).instances[0].position.x, 20);
  assert.equal(core.ensure('ref-a', instances, 9000).startedAt, first.startedAt);
  assert.equal(core.ensure('ref-b', instances, 9000).instances[0].position.x, 50);
  core.activate('slide-b'); core.ensure('ref-a', instances, 9000);
  assert.equal(core.move('slide-a', 'ref-a', 'one', { position: { x: 90, y: 90 } }), false);
  core.activate('slide-a'); assert.equal(core.ensure('ref-a', instances, 9000).instances[0].position.x, 20);
});
test('shuffle consumes randomness only on authoritative command, snapshots and mounts are stable', () => {
  let draws = 0; const core = new CardRuntime(); core.activate('a'); core.ensure('ref', instances, 1000);
  core.shuffle('a', 'ref', { width: 1280, height: 720 }, () => { draws++; return .2; });
  const saved = JSON.stringify(core.ensure('ref', instances, 2000));
  assert.equal(draws, 2);
  assert.equal(JSON.stringify(core.ensure('ref', instances, 3000)), saved);
  assert.equal(instances[0].position.x, 50);
});
test('authoritative timer anchor survives serialization and expires without restart', () => {
  const anchor = JSON.parse(JSON.stringify({ isRunning: true, startTime: 1000, accumulated: 0 }));
  assert.equal(timerSeconds(anchor, 5000, 'countdown', 5), 1);
  assert.equal(timerSeconds(anchor, 9000, 'countdown', 5), 0);
  assert.equal(timerSeconds({ ...anchor, isRunning: false, accumulated: 2500 }, 9000, 'countup', 5), 2);
});

import { parseActivityScene } from './activityScene';
test('projection strips private metadata and unused card and image libraries', () => {
  const scene = parseActivityScene({ boards: [{ key: 'ref', startedAt: 1000, states: {}, card: { id: 'board', name: 'teacher name', notes: 'private', stageMode: 'full', background: {}, bCardInstances: instances } }], cards: { card: { id: 'card', name: 'private', audioRefId: 'private', front: { text: 'front', imageId: 'used', notes: 'private' }, back: {} }, unused: { front: {}, back: {} } }, images: { used: 'media://used.png', unused: 'media://unused.png' } });
  assert.ok(scene); assert.deepEqual(Object.keys(scene.cards), ['card']); assert.deepEqual(Object.keys(scene.images), ['used']);
  assert.equal(JSON.stringify(scene).includes('private'), false);
  assert.equal(JSON.stringify(scene).includes('teacher name'), false);
});

test('leave and return rejects delayed commands from previous activation while retaining occurrence state', () => {
  const core = new CardRuntime(); core.activate('a', 'epoch-1'); core.ensure('ref', instances, 1000);
  core.move('epoch-1', 'ref', 'one', { position: { x: 20, y: 30 } });
  core.activate('b', 'epoch-2'); core.activate('a', 'epoch-3');
  assert.equal(core.move('epoch-1', 'ref', 'one', { position: { x: 90, y: 90 } }), false);
  assert.equal(core.get('ref')!.instances[0].position.x, 20);
});
test('authored changes reconcile changed instances and prune removed reveal state', () => {
  const core = new CardRuntime(); core.activate('a'); core.ensure('ref', instances, 1000);
  core.setState('a', 'ref', 'one', { isFlipped: true, isCovered: false, isBlurred: false, isZoomed: false });
  const edited = [{ ...instances[0], size: { width: 300, height: 300 } }];
  assert.equal(core.ensure('ref', edited, 2000).instances[0].size.width, 300);
  assert.deepEqual(core.ensure('ref', [], 3000).states, {});
});

test('invalid shuffle frame and missing card commands reject without mutating runtime', () => {
 const core = new CardRuntime(); core.activate('a'); core.ensure('ref', instances, 1000);
 const before = JSON.stringify(core.get('ref'));
 assert.equal(core.shuffle('a','ref',{width:0,height:720}),false);
 assert.equal(core.shuffle('a','ref',{width:1280,height:NaN}),false);
 assert.equal(core.move('a','ref','missing',{position:{x:20,y:30}}),false);
 assert.equal(JSON.stringify(core.get('ref')),before);
});
