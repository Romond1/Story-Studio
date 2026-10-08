import type { SceneViewport } from './teachingScene';
import type { MarkerStroke } from './types';
export function zoomAtPoint(view: SceneViewport, point: { x: number; y: number }, requested: number): SceneViewport {
  const zoom = Math.max(1, Math.min(4, requested));
  const bound = (value: number) => Math.max(-40000, Math.min(40000, value));
  return { zoom, pan: { x: bound(view.pan.x + point.x * (view.zoom - zoom)), y: bound(view.pan.y + point.y * (view.zoom - zoom)) } };
}
export function strokeTouches(stroke: MarkerStroke, point: { x: number; y: number }, radius: number): boolean {
  const distance = radius + stroke.size / 2;
  return stroke.points.some((b, index) => {
    const a = stroke.points[Math.max(0, index - 1)], dx = b.x - a.x, dy = b.y - a.y;
    const t = dx || dy ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= distance;
  });
}
