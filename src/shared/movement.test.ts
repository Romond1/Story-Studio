import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MOVEMENT_EVENTS,
  createMovementEvent,
  duplicateMovementEvent,
  getMovementEventByShortcut,
  isEditableKeyTarget,
  normalizeMovementConfig,
  pickRandomMovementEvent,
} from "./movement";
import type { MovementConfig } from "./types";

test("normalizeMovementConfig initializes defaults for old projects", () => {
  const config = normalizeMovementConfig(undefined);

  assert.equal(config.randomEnabled, true);
  assert.equal(config.randomShortcut, "Numpad0");
  assert.equal(config.jingleRelativePath, null);
  assert.equal(config.events.length, 5);
  assert.deepEqual(
    config.events.map((event) => [event.id, event.shortcut, event.enabled, event.gifRelativePath]),
    DEFAULT_MOVEMENT_EVENTS.map((event) => [event.id, event.shortcut, true, event.gifRelativePath]),
  );
});

test("normalizeMovementConfig preserves existing edits while adding missing defaults", () => {
  const config = normalizeMovementConfig({
    randomEnabled: false,
    jingleRelativePath: "assets/jingle.mp3",
    events: [
      {
        id: "touch-color",
        name: "Touch Color",
        instruction: "Touch blue!",
        enabled: false,
        shortcut: "KeyC",
        durationSeconds: 8,
        animation: "color-burst",
        gifRelativePath: "assets/custom-touch.gif",
      },
    ],
  });

  assert.equal(config.randomEnabled, false);
  assert.equal(config.jingleRelativePath, "assets/jingle.mp3");
  assert.equal(config.events.length, 5);
  assert.equal(config.events[0].instruction, "Touch blue!");
  assert.equal(config.events[0].enabled, false);
  assert.equal(config.events[0].shortcut, "KeyC");
  assert.equal(config.events[0].durationSeconds, 8);
  assert.equal(config.events[0].gifRelativePath, "assets/custom-touch.gif");
  assert.equal(config.events[1].id, "run-in-place");
});

test("normalizeMovementConfig preserves custom movement events", () => {
  const custom = createMovementEvent(6);
  const config = normalizeMovementConfig({
    randomEnabled: true,
    events: [
      ...DEFAULT_MOVEMENT_EVENTS,
      {
        ...custom,
        id: "custom-jump",
        name: "Jump",
        instruction: "Jump!",
        shortcut: "Numpad6",
        gifRelativePath: "assets/jump.gif",
        overlayOpacity: 0.72,
        ringSpeedSeconds: 0.8,
        intensity: 1.4,
        primaryColor: "#ff0000",
      },
    ],
  });

  const found = config.events.find((event) => event.id === "custom-jump");
  assert.equal(found?.name, "Jump");
  assert.equal(found?.shortcut, "Numpad6");
  assert.equal(found?.overlayOpacity, 0.72);
  assert.equal(found?.ringSpeedSeconds, 0.8);
  assert.equal(found?.intensity, 1.4);
  assert.equal(found?.primaryColor, "#ff0000");
});

test("normalizeMovementConfig supports more than five movement events", () => {
  const sixth = {
    ...createMovementEvent(6, "custom-jump"),
    name: "Jump",
    animation: "runner" as const,
    shortcut: "Numpad6",
  };
  const seventh = {
    ...createMovementEvent(7, "custom-spin"),
    name: "Spin",
    animation: "hero-flash" as const,
    shortcut: "Numpad7",
  };
  const config = normalizeMovementConfig({
    randomEnabled: true,
    events: [...DEFAULT_MOVEMENT_EVENTS, sixth, seventh],
  });

  assert.equal(config.events.length, 7);
  assert.equal(config.events.find((event) => event.id === "custom-jump")?.animation, "runner");
  assert.equal(config.events.find((event) => event.id === "custom-spin")?.shortcut, "Numpad7");
});

test("normalizeMovementConfig repairs duplicate custom movement ids", () => {
  const first = createMovementEvent(6, "custom-copy");
  const second = {
    ...createMovementEvent(7, "custom-copy"),
    name: "Copy Two",
  };
  const config = normalizeMovementConfig({
    events: [...DEFAULT_MOVEMENT_EVENTS, first, second],
  });
  const customIds = config.events
    .filter((event) => event.id.startsWith("custom-copy"))
    .map((event) => event.id);

  assert.equal(customIds.length, 2);
  assert.equal(new Set(customIds).size, 2);
});

test("normalizeMovementConfig can hide removed default events", () => {
  const config = normalizeMovementConfig({
    deletedEventIds: ["touch-nose"],
    events: DEFAULT_MOVEMENT_EVENTS,
  });

  assert.equal(config.events.some((event) => event.id === "touch-nose"), false);
  assert.equal(config.deletedEventIds?.includes("touch-nose"), true);
});

test("default Movement GIFs point to the built-in assets folder", () => {
  const config = normalizeMovementConfig(undefined);

  assert.equal(config.events.find((event) => event.id === "touch-color")?.gifRelativePath, "assets/touch_color.gif");
  assert.equal(config.events.find((event) => event.id === "run-in-place")?.gifRelativePath, "assets/run.gif");
  assert.equal(config.events.find((event) => event.id === "hero-pose")?.gifRelativePath, "assets/hero_pose_mia.gif");
  assert.equal(config.events.find((event) => event.id === "touch-head")?.gifRelativePath, "assets/touch_head.gif");
  assert.equal(config.events.find((event) => event.id === "touch-nose")?.gifRelativePath, "assets/touch_nose.gif");
});

test("getMovementEventByShortcut ignores disabled events and respects random setting", () => {
  const config: MovementConfig = normalizeMovementConfig({
    randomEnabled: false,
    randomShortcut: "Numpad9",
    events: [
      { ...DEFAULT_MOVEMENT_EVENTS[0], enabled: false },
      { ...DEFAULT_MOVEMENT_EVENTS[1], enabled: true },
    ],
  });

  assert.equal(getMovementEventByShortcut(config, "Numpad1")?.id, undefined);
  assert.equal(getMovementEventByShortcut(config, "Numpad2")?.id, "run-in-place");
  assert.equal(getMovementEventByShortcut(config, "Numpad0")?.id, undefined);
  assert.equal(getMovementEventByShortcut(config, "Numpad9")?.id, undefined);
});

test("getMovementEventByShortcut uses configurable random shortcut", () => {
  const config = normalizeMovementConfig({
    randomEnabled: true,
    randomShortcut: "KeyR",
    events: DEFAULT_MOVEMENT_EVENTS.map((event) => ({
      ...event,
      enabled: event.id === "touch-head",
    })),
  });

  assert.equal(getMovementEventByShortcut(config, "Numpad0")?.id, undefined);
  assert.equal(getMovementEventByShortcut(config, "KeyR", () => 0)?.id, "touch-head");
});

test("duplicateMovementEvent creates a new enabled movement with copied visuals", () => {
  const source = {
    ...DEFAULT_MOVEMENT_EVENTS[0],
    id: "touch-color",
    name: "Touch Color",
    shortcut: "Numpad1",
    overlayOpacity: 0.5,
    ringSpeedSeconds: 0.9,
  };
  const duplicate = duplicateMovementEvent(source, 7, () => "copy-id");

  assert.equal(duplicate.id, "copy-id");
  assert.equal(duplicate.name, "Touch Color Copy");
  assert.equal(duplicate.shortcut, "");
  assert.equal(duplicate.enabled, true);
  assert.equal(duplicate.overlayOpacity, 0.5);
  assert.equal(duplicate.ringSpeedSeconds, 0.9);
});

test("pickRandomMovementEvent chooses only enabled events", () => {
  const config = normalizeMovementConfig({
    randomEnabled: true,
    events: DEFAULT_MOVEMENT_EVENTS.map((event) => ({
      ...event,
      enabled: event.id === "hero-pose",
    })),
  });

  assert.equal(pickRandomMovementEvent(config, () => 0.99)?.id, "hero-pose");
});

test("isEditableKeyTarget detects inputs, textareas, selects, and contenteditable elements", () => {
  assert.equal(isEditableKeyTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableKeyTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isEditableKeyTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableKeyTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isEditableKeyTarget({ tagName: "DIV" }), false);
  assert.equal(isEditableKeyTarget(null), false);
});
