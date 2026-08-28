import test from "node:test";
import assert from "node:assert/strict";
import type { MarkerStroke } from "./types";
import {
  appendCompletedMarkerStroke,
  isDrawModeShortcut,
  startManagedAnimationLoop,
} from "./drawingLifecycle";

test("managed animation cleanup cancels the latest scheduled frame", () => {
  let nextId = 0;
  const callbacks = new Map<number, (time: number) => void>();
  const cancelled: number[] = [];
  const scheduler = {
    request(callback: (time: number) => void) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id: number) {
      cancelled.push(id);
      callbacks.delete(id);
    },
  };

  const stop = startManagedAnimationLoop(scheduler, () => undefined);
  const firstFrame = callbacks.get(1);
  callbacks.delete(1);
  firstFrame?.(16);
  assert.equal(callbacks.has(2), true);

  stop();
  assert.deepEqual(cancelled, [2]);
  assert.equal(callbacks.size, 0);
});

test("managed animation callback cannot reschedule after cleanup", () => {
  let scheduled: ((time: number) => void) | null = null;
  let requests = 0;
  const scheduler = {
    request(callback: (time: number) => void) {
      requests += 1;
      scheduled = callback;
      return requests;
    },
    cancel() {},
  };
  let stop: () => void = () => {};
  stop = startManagedAnimationLoop(scheduler, () => stop());
  const scheduledFrame = scheduled as ((time: number) => void) | null;
  scheduledFrame?.(16);
  assert.equal(requests, 1);
});

test("completed marker is committed once and click-only marker is ignored", () => {
  const base: MarkerStroke[] = [];
  const click: MarkerStroke = {
    id: "click",
    color: "#fff",
    size: 12,
    opacity: 1,
    rainbow: false,
    points: [{ x: 0.1, y: 0.1, t: 1 }],
  };
  const line: MarkerStroke = {
    ...click,
    id: "line",
    points: [...click.points, { x: 0.2, y: 0.2, t: 2 }],
  };
  assert.strictEqual(appendCompletedMarkerStroke(base, click), base);
  assert.deepEqual(appendCompletedMarkerStroke(base, line), [line]);
});

test("Ctrl+D toggles drawing only outside editable controls", () => {
  const base = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, key: "d" };
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "DIV" } }), true);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "INPUT" } }), false);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "TEXTAREA" } }), false);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "SELECT" } }), false);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "DIV", isContentEditable: true } }), false);
  assert.equal(isDrawModeShortcut({ ...base, repeat: true, target: null }), false);
  assert.equal(isDrawModeShortcut({ ...base, ctrlKey: false, target: null }), false);
});
