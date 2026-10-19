"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blocksMouseNavigation = blocksMouseNavigation;
/** Browser-specific mouse/tilt commands only: ordinary keyboard editing stays native. */
function blocksMouseNavigation(activeLesson, input) {
    return activeLesson && [3, 4, 'BrowserBack', 'BrowserForward', 'browser-backward', 'browser-forward'].includes(input);
}
