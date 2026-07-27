"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const movement_1 = require("./movement");
(0, node_test_1.default)("normalizeMovementConfig initializes defaults for old projects", () => {
    const config = (0, movement_1.normalizeMovementConfig)(undefined);
    strict_1.default.equal(config.randomEnabled, true);
    strict_1.default.equal(config.randomShortcut, "Numpad0");
    strict_1.default.equal(config.jingleRelativePath, null);
    strict_1.default.equal(config.events.length, 5);
    strict_1.default.deepEqual(config.events.map((event) => [event.id, event.shortcut, event.enabled, event.gifRelativePath]), movement_1.DEFAULT_MOVEMENT_EVENTS.map((event) => [event.id, event.shortcut, true, event.gifRelativePath]));
});
(0, node_test_1.default)("normalizeMovementConfig preserves existing edits while adding missing defaults", () => {
    const config = (0, movement_1.normalizeMovementConfig)({
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
    strict_1.default.equal(config.randomEnabled, false);
    strict_1.default.equal(config.jingleRelativePath, "assets/jingle.mp3");
    strict_1.default.equal(config.events.length, 5);
    strict_1.default.equal(config.events[0].instruction, "Touch blue!");
    strict_1.default.equal(config.events[0].enabled, false);
    strict_1.default.equal(config.events[0].shortcut, "KeyC");
    strict_1.default.equal(config.events[0].durationSeconds, 8);
    strict_1.default.equal(config.events[0].gifRelativePath, "assets/custom-touch.gif");
    strict_1.default.equal(config.events[1].id, "run-in-place");
});
(0, node_test_1.default)("normalizeMovementConfig preserves custom movement events", () => {
    const custom = (0, movement_1.createMovementEvent)(6);
    const config = (0, movement_1.normalizeMovementConfig)({
        randomEnabled: true,
        events: [
            ...movement_1.DEFAULT_MOVEMENT_EVENTS,
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
    strict_1.default.equal(found?.name, "Jump");
    strict_1.default.equal(found?.shortcut, "Numpad6");
    strict_1.default.equal(found?.overlayOpacity, 0.72);
    strict_1.default.equal(found?.ringSpeedSeconds, 0.8);
    strict_1.default.equal(found?.intensity, 1.4);
    strict_1.default.equal(found?.primaryColor, "#ff0000");
});
(0, node_test_1.default)("normalizeMovementConfig supports more than five movement events", () => {
    const sixth = {
        ...(0, movement_1.createMovementEvent)(6, "custom-jump"),
        name: "Jump",
        animation: "runner",
        shortcut: "Numpad6",
    };
    const seventh = {
        ...(0, movement_1.createMovementEvent)(7, "custom-spin"),
        name: "Spin",
        animation: "hero-flash",
        shortcut: "Numpad7",
    };
    const config = (0, movement_1.normalizeMovementConfig)({
        randomEnabled: true,
        events: [...movement_1.DEFAULT_MOVEMENT_EVENTS, sixth, seventh],
    });
    strict_1.default.equal(config.events.length, 7);
    strict_1.default.equal(config.events.find((event) => event.id === "custom-jump")?.animation, "runner");
    strict_1.default.equal(config.events.find((event) => event.id === "custom-spin")?.shortcut, "Numpad7");
});
(0, node_test_1.default)("normalizeMovementConfig repairs duplicate custom movement ids", () => {
    const first = (0, movement_1.createMovementEvent)(6, "custom-copy");
    const second = {
        ...(0, movement_1.createMovementEvent)(7, "custom-copy"),
        name: "Copy Two",
    };
    const config = (0, movement_1.normalizeMovementConfig)({
        events: [...movement_1.DEFAULT_MOVEMENT_EVENTS, first, second],
    });
    const customIds = config.events
        .filter((event) => event.id.startsWith("custom-copy"))
        .map((event) => event.id);
    strict_1.default.equal(customIds.length, 2);
    strict_1.default.equal(new Set(customIds).size, 2);
});
(0, node_test_1.default)("normalizeMovementConfig can hide removed default events", () => {
    const config = (0, movement_1.normalizeMovementConfig)({
        deletedEventIds: ["touch-nose"],
        events: movement_1.DEFAULT_MOVEMENT_EVENTS,
    });
    strict_1.default.equal(config.events.some((event) => event.id === "touch-nose"), false);
    strict_1.default.equal(config.deletedEventIds?.includes("touch-nose"), true);
});
(0, node_test_1.default)("default Movement GIFs point to the built-in assets folder", () => {
    const config = (0, movement_1.normalizeMovementConfig)(undefined);
    strict_1.default.equal(config.events.find((event) => event.id === "touch-color")?.gifRelativePath, "assets/touch_color.gif");
    strict_1.default.equal(config.events.find((event) => event.id === "run-in-place")?.gifRelativePath, "assets/run.gif");
    strict_1.default.equal(config.events.find((event) => event.id === "hero-pose")?.gifRelativePath, "assets/hero_pose_mia.gif");
    strict_1.default.equal(config.events.find((event) => event.id === "touch-head")?.gifRelativePath, "assets/touch_head.gif");
    strict_1.default.equal(config.events.find((event) => event.id === "touch-nose")?.gifRelativePath, "assets/touch_nose.gif");
});
(0, node_test_1.default)("getMovementEventByShortcut ignores disabled events and respects random setting", () => {
    const config = (0, movement_1.normalizeMovementConfig)({
        randomEnabled: false,
        randomShortcut: "Numpad9",
        events: [
            { ...movement_1.DEFAULT_MOVEMENT_EVENTS[0], enabled: false },
            { ...movement_1.DEFAULT_MOVEMENT_EVENTS[1], enabled: true },
        ],
    });
    strict_1.default.equal((0, movement_1.getMovementEventByShortcut)(config, "Numpad1")?.id, undefined);
    strict_1.default.equal((0, movement_1.getMovementEventByShortcut)(config, "Numpad2")?.id, "run-in-place");
    strict_1.default.equal((0, movement_1.getMovementEventByShortcut)(config, "Numpad0")?.id, undefined);
    strict_1.default.equal((0, movement_1.getMovementEventByShortcut)(config, "Numpad9")?.id, undefined);
});
(0, node_test_1.default)("getMovementEventByShortcut uses configurable random shortcut", () => {
    const config = (0, movement_1.normalizeMovementConfig)({
        randomEnabled: true,
        randomShortcut: "KeyR",
        events: movement_1.DEFAULT_MOVEMENT_EVENTS.map((event) => ({
            ...event,
            enabled: event.id === "touch-head",
        })),
    });
    strict_1.default.equal((0, movement_1.getMovementEventByShortcut)(config, "Numpad0")?.id, undefined);
    strict_1.default.equal((0, movement_1.getMovementEventByShortcut)(config, "KeyR", () => 0)?.id, "touch-head");
});
(0, node_test_1.default)("duplicateMovementEvent creates a new enabled movement with copied visuals", () => {
    const source = {
        ...movement_1.DEFAULT_MOVEMENT_EVENTS[0],
        id: "touch-color",
        name: "Touch Color",
        shortcut: "Numpad1",
        overlayOpacity: 0.5,
        ringSpeedSeconds: 0.9,
    };
    const duplicate = (0, movement_1.duplicateMovementEvent)(source, 7, () => "copy-id");
    strict_1.default.equal(duplicate.id, "copy-id");
    strict_1.default.equal(duplicate.name, "Touch Color Copy");
    strict_1.default.equal(duplicate.shortcut, "");
    strict_1.default.equal(duplicate.enabled, true);
    strict_1.default.equal(duplicate.overlayOpacity, 0.5);
    strict_1.default.equal(duplicate.ringSpeedSeconds, 0.9);
});
(0, node_test_1.default)("pickRandomMovementEvent chooses only enabled events", () => {
    const config = (0, movement_1.normalizeMovementConfig)({
        randomEnabled: true,
        events: movement_1.DEFAULT_MOVEMENT_EVENTS.map((event) => ({
            ...event,
            enabled: event.id === "hero-pose",
        })),
    });
    strict_1.default.equal((0, movement_1.pickRandomMovementEvent)(config, () => 0.99)?.id, "hero-pose");
});
(0, node_test_1.default)("isEditableKeyTarget detects inputs, textareas, selects, and contenteditable elements", () => {
    strict_1.default.equal((0, movement_1.isEditableKeyTarget)({ tagName: "INPUT" }), true);
    strict_1.default.equal((0, movement_1.isEditableKeyTarget)({ tagName: "TEXTAREA" }), true);
    strict_1.default.equal((0, movement_1.isEditableKeyTarget)({ tagName: "SELECT" }), true);
    strict_1.default.equal((0, movement_1.isEditableKeyTarget)({ tagName: "DIV", isContentEditable: true }), true);
    strict_1.default.equal((0, movement_1.isEditableKeyTarget)({ tagName: "DIV" }), false);
    strict_1.default.equal((0, movement_1.isEditableKeyTarget)(null), false);
});
