import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoomAtPoint, strokeTouches } from './lessonPointer';

test('zoom keeps the scene point under the pointer fixed and clamps limits', () => {
  const view = { zoom: 1.5, pan: { x: 80, y: -30 } }, point = { x: 430, y: 250 };
  const next = zoomAtPoint(view, point, 2.3);
  assert.ok(Math.abs(point.x * view.zoom + view.pan.x - point.x * next.zoom - next.pan.x) < 1e-8);
  assert.ok(Math.abs(point.y * view.zoom + view.pan.y - point.y * next.zoom - next.pan.y) < 1e-8);
  assert.equal(zoomAtPoint(view, point, 20).zoom, 4);
  assert.equal(zoomAtPoint(view, point, .2).zoom, 1);
});
test('eraser intersects entire line segments, not just sampled vertices', () => {
  const stroke = { id: 'a', color: '#000000', opacity: 1, rainbow: false, size: 6, points: [{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 1 }] };
  assert.equal(strokeTouches(stroke, { x: 50, y: 2 }, 5), true);
  assert.equal(strokeTouches(stroke, { x: 50, y: 20 }, 5), false);
});
