import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeachingScene, reduceTeachingScene, clientToLogical } from './teachingScene';

test('viewport commands reject previous occurrences and out-of-order updates', () => {
  const state = createTeachingScene('occurrence B');
  assert.equal(reduceTeachingScene(state, { targetKey: 'occurrence A', sequence: 1, viewport: { zoom: 2, pan: { x: 100, y: 50 } } }), state);
  const moved = reduceTeachingScene(state, { targetKey: 'occurrence B', sequence: 2, viewport: { zoom: 2, pan: { x: -100, y: -50 } } });
  assert.equal(moved.viewport.zoom, 2);
  assert.equal(reduceTeachingScene(moved, { targetKey: 'occurrence B', sequence: 1, viewport: state.viewport }), moved);
  assert.equal(createTeachingScene('new').transient.length, 0);
});
test('client coordinates map through uniformly contained logical frame at different DPI and sizes', () => {
  assert.deepEqual(clientToLogical({ x: 300, y: 250 }, { left: 50, top: 100, width: 500, height: 300 }, { width: 1000, height: 600 }), { x: 500, y: 300 });
  assert.deepEqual(clientToLogical({ x: 600, y: 500 }, { left: 100, top: 200, width: 1000, height: 600 }, { width: 1000, height: 600 }), { x: 500, y: 300 });
});
test('reliable finish clears active stroke, delayed transient cannot resurrect it', () => {
  const first = createTeachingScene('a');
  const active = { id: 'stroke', size: 5, opacity: 1, color: '#ffffff', rainbow: false, points: [{ x: 0.2, y: 0.3, t: 100 }] };
  const drawing = reduceTeachingScene(first, { targetKey: 'a', sequence: 1, transient: [active] });
  const completed = reduceTeachingScene(drawing, { targetKey: 'a', sequence: 3, transient: [] });
  assert.equal(reduceTeachingScene(completed, { targetKey: 'a', sequence: 2, transient: [active] }), completed);
  assert.deepEqual(completed.transient, []);
});

import { normalizeTransientStrokes } from './teachingScene';
test('Control and Core share bounded transients preserving first and last points', () => {
  const points = Array.from({ length: 4001 }, (_, i) => ({ x: i / 4000, y: 0.4, t: i }));
  const input = Array.from({ length: 33 }, (_, i) => ({ id: String(i), size: 5, opacity: 1, color: '#fff', rainbow: false, points }));
  const bounded = normalizeTransientStrokes(input);
  assert.equal(bounded.length, 32); assert.equal(bounded[0].id, '1');
  assert.equal(bounded[0].points.length, 4000);
  assert.deepEqual(bounded[0].points[0], points[0]);
  assert.deepEqual(bounded[0].points[3999], points[4000]);
  assert.deepEqual(reduceTeachingScene(createTeachingScene('a'), { targetKey: 'a', sequence: 1, transient: input }).transient, bounded);
});
