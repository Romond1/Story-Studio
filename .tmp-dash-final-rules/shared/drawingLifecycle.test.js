"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const drawingLifecycle_1 = require("./drawingLifecycle");
(0, node_test_1.default)("managed animation cleanup cancels the latest scheduled frame", () => {
    let nextId = 0;
    const callbacks = new Map();
    const cancelled = [];
    const scheduler = {
        request(callback) {
            const id = ++nextId;
            callbacks.set(id, callback);
            return id;
        },
        cancel(id) {
            cancelled.push(id);
            callbacks.delete(id);
        },
    };
    const stop = (0, drawingLifecycle_1.startManagedAnimationLoop)(scheduler, () => undefined);
    const firstFrame = callbacks.get(1);
    callbacks.delete(1);
    firstFrame?.(16);
    strict_1.default.equal(callbacks.has(2), true);
    stop();
    strict_1.default.deepEqual(cancelled, [2]);
    strict_1.default.equal(callbacks.size, 0);
});
(0, node_test_1.default)("managed animation callback cannot reschedule after cleanup", () => {
    let scheduled = null;
    let requests = 0;
    const scheduler = {
        request(callback) {
            requests += 1;
            scheduled = callback;
            return requests;
        },
        cancel() { },
    };
    let stop = () => { };
    stop = (0, drawingLifecycle_1.startManagedAnimationLoop)(scheduler, () => stop());
    const scheduledFrame = scheduled;
    scheduledFrame?.(16);
    strict_1.default.equal(requests, 1);
});
(0, node_test_1.default)("completed marker is committed once and click-only marker is ignored", () => {
    const base = [];
    const click = {
        id: "click",
        color: "#fff",
        size: 12,
        opacity: 1,
        rainbow: false,
        points: [{ x: 0.1, y: 0.1, t: 1 }],
    };
    const line = {
        ...click,
        id: "line",
        points: [...click.points, { x: 0.2, y: 0.2, t: 2 }],
    };
    strict_1.default.strictEqual((0, drawingLifecycle_1.appendCompletedMarkerStroke)(base, click), base);
    strict_1.default.deepEqual((0, drawingLifecycle_1.appendCompletedMarkerStroke)(base, line), [line]);
});
(0, node_test_1.default)("Ctrl+D toggles drawing only outside editable controls", () => {
    const base = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, key: "d" };
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, target: { tagName: "DIV" } }), true);
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, target: { tagName: "INPUT" } }), false);
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, target: { tagName: "TEXTAREA" } }), false);
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, target: { tagName: "SELECT" } }), false);
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, target: { tagName: "DIV", isContentEditable: true } }), false);
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, repeat: true, target: null }), false);
    strict_1.default.equal((0, drawingLifecycle_1.isDrawModeShortcut)({ ...base, ctrlKey: false, target: null }), false);
});
