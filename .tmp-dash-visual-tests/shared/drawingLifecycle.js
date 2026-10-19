"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startManagedAnimationLoop = startManagedAnimationLoop;
exports.appendCompletedMarkerStroke = appendCompletedMarkerStroke;
exports.isDrawModeShortcut = isDrawModeShortcut;
const movement_1 = require("./movement");
function startManagedAnimationLoop(scheduler, onFrame) {
    let active = true;
    let frameId = 0;
    const frame = (time) => {
        if (!active)
            return;
        onFrame(time);
        if (active)
            frameId = scheduler.request(frame);
    };
    frameId = scheduler.request(frame);
    return () => {
        if (!active)
            return;
        active = false;
        scheduler.cancel(frameId);
    };
}
function appendCompletedMarkerStroke(persisted, active) {
    return active.points.length > 1 ? [...persisted, active] : persisted;
}
function isDrawModeShortcut(event) {
    return event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && !event.shiftKey
        && !event.repeat
        && event.key.toLowerCase() === "d"
        && !(0, movement_1.isEditableKeyTarget)(event.target);
}
