import { isEditableKeyTarget } from "./movement";
import type { MarkerStroke } from "./types";

export interface AnimationScheduler {
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}

export function startManagedAnimationLoop(
  scheduler: AnimationScheduler,
  onFrame: (time: number) => void,
): () => void {
  let active = true;
  let frameId = 0;

  const frame = (time: number) => {
    if (!active) return;
    onFrame(time);
    if (active) frameId = scheduler.request(frame);
  };

  frameId = scheduler.request(frame);
  return () => {
    if (!active) return;
    active = false;
    scheduler.cancel(frameId);
  };
}

export function appendCompletedMarkerStroke(
  persisted: MarkerStroke[],
  active: MarkerStroke,
): MarkerStroke[] {
  return active.points.length > 1 ? [...persisted, active] : persisted;
}

export function isDrawModeShortcut(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  key: string;
  target: { tagName?: string; isContentEditable?: boolean } | null;
}): boolean {
  return event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && !event.shiftKey
    && !event.repeat
    && event.key.toLowerCase() === "d"
    && !isEditableKeyTarget(event.target);
}
