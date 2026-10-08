import type { PresentTarget } from './presentationSnapshot';
import type { StaticScene } from './staticScene';
import type { TransitionType } from './types';
export interface TransitionSettings { kind: TransitionType; durationMs: number; direction: 'left' | 'right' | 'up' | 'down' }
export interface TransitionMedia { occurrenceId: string; src: string; scene?: StaticScene }
export interface SceneTransitionEvent extends TransitionSettings {
  id: string; startedAt: number; fromOccurrenceId: string; toOccurrenceId: string; from: TransitionMedia;
}
export function transitionTiming(event: SceneTransitionEvent, now: number) {
  const elapsedMs = Math.max(0, now - event.startedAt);
  const duration = event.durationMs * (event.kind === 'fade-black' ? 1.2 : 1);
  return { elapsedMs, remainingMs: Math.max(0, duration - elapsedMs), settled: elapsedMs >= duration };
}
/** One Control-Core observer owns timing. Renderers consume immutable visual facts only. */
export class SceneTransitionCore {
  private targetKey: string | null = null;
  private previous: PresentTarget | null = null;
  event: SceneTransitionEvent | null = null;
  observe(targetKey: string, target: PresentTarget, settings: TransitionSettings, now: number, id: string): SceneTransitionEvent | null {
    if (targetKey !== this.targetKey) {
      const previous = this.previous;
      const changed = !previous || previous.kind !== target.kind || previous.occurrenceId !== target.occurrenceId;
      if (changed) this.event = null;
      if (changed && previous?.kind === 'image' && (target.kind === 'image' || target.kind === 'video') && settings.kind !== 'none' && settings.durationMs > 0) {
        const scene = previous.scene ? { ...previous.scene, markerStrokes: undefined, transient: undefined } : undefined;
        const from: TransitionMedia = JSON.parse(JSON.stringify({ occurrenceId: previous.occurrenceId, src: previous.src, ...(scene ? { scene } : {}) }));
        this.event = { ...settings, id, startedAt: now, fromOccurrenceId: from.occurrenceId, toOccurrenceId: target.occurrenceId, from };
      }
      this.targetKey = targetKey;
    }
    this.previous = target;
    return this.event;
  }
  complete(id: string): boolean {
    if (this.event?.id !== id) return false;
    this.event = null; return true;
  }
}
