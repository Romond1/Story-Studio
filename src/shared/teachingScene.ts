import type { MarkerStroke } from './types';
import type { LogicalFrame } from './staticScene';
export interface SceneViewport { zoom: number; pan: { x: number; y: number } }
export interface TransientStroke extends MarkerStroke { fadeMs?: number; sparkle?: boolean }
export interface TeachingSceneState { targetKey: string; sequence: number; viewport: SceneViewport; transient: TransientStroke[] }
export interface TeachingSceneCommand { targetKey: string; sequence: number; viewport?: SceneViewport; transient?: TransientStroke[] }
export const defaultViewport = (): SceneViewport => ({ zoom: 1, pan: { x: 0, y: 0 } });
export function createTeachingScene(targetKey: string): TeachingSceneState {
  return { targetKey, sequence: 0, viewport: defaultViewport(), transient: [] };
}
/** Control Core's runtime state. Authored markers remain in their existing content owner. */
export function reduceTeachingScene(state: TeachingSceneState, command: TeachingSceneCommand): TeachingSceneState {
  if (command.targetKey !== state.targetKey || command.sequence <= state.sequence) return state;
  const viewport = command.viewport ?? state.viewport;
  if (![viewport.zoom, viewport.pan.x, viewport.pan.y].every(Number.isFinite) || viewport.zoom < 1 || viewport.zoom > 4) return state;
  return { ...state, sequence: command.sequence, viewport, transient: command.transient === undefined ? state.transient : normalizeTransientStrokes(command.transient) };
}
export function clientToLogical(point: { x: number; y: number }, rect: { left: number; top: number; width: number; height: number }, frame: LogicalFrame) {
  return { x: (point.x - rect.left) * frame.width / Math.max(1, rect.width), y: (point.y - rect.top) * frame.height / Math.max(1, rect.height) };
}

/** Same bounded visual stream in Control and Present; authored commits stay complete. */
export function normalizeTransientStrokes(strokes: TransientStroke[]): TransientStroke[] {
  return strokes.slice(-32).map(stroke => {
    if (stroke.points.length <= 4000) return stroke;
    return { ...stroke, points: Array.from({ length: 4000 }, (_, index) => stroke.points[Math.round(index * (stroke.points.length - 1) / 3999)]) };
  });
}
