import type { Rect } from './model';
import type { MarkerStroke } from '../types';
export interface DrawingPreview { stroke?: MarkerStroke; erasedIds?: string[] }
export function previewDrawings(drawings: MarkerStroke[], preview: DrawingPreview | null): MarkerStroke[] {
  return preview ? [...drawings.filter(s => !preview.erasedIds?.includes(s.id)), ...(preview.stroke ? [preview.stroke] : [])] : drawings;
}
export function marqueeIds(objects: { id: string; visible?: boolean; box: Rect }[], start: { x: number; y: number }, end: { x: number; y: number }): string[] {
  const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y), right = Math.max(start.x, end.x), bottom = Math.max(start.y, end.y);
  return objects.filter(o => o.visible !== false && o.box.x < right && o.box.x + o.box.width > left && o.box.y < bottom && o.box.y + o.box.height > top).map(o => o.id);
}
export function translateBoxes(objects: { id: string; box: Rect }[], dx: number, dy: number, frame: { width: number; height: number }): { id: string; box: Rect }[] {
  if (!objects.length) return [];
  dx = Math.max(-Math.min(...objects.map(o => o.box.x)), Math.min(dx, frame.width - Math.max(...objects.map(o => o.box.x + o.box.width))));
  dy = Math.max(-Math.min(...objects.map(o => o.box.y)), Math.min(dy, frame.height - Math.max(...objects.map(o => o.box.y + o.box.height))));
  return objects.map(o => ({ id: o.id, box: { ...o.box, x: o.box.x + dx, y: o.box.y + dy } }));
}
