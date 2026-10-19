"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldIgnoreTeacherKey = shouldIgnoreTeacherKey;
exports.isPlainTeacherKey = isPlainTeacherKey;
exports.claimTeacherKey = claimTeacherKey;
const movement_1 = require("./movement");
/** Teacher command handlers share one ownership guard; Present installs none. */
function shouldIgnoreTeacherKey(event) {
    const target = event.target && typeof event.target === 'object'
        ? event.target : null;
    return !!(event.defaultPrevented || event.isComposing || event.repeat || (0, movement_1.isEditableKeyTarget)(target));
}
function isPlainTeacherKey(event) {
    return !shouldIgnoreTeacherKey(event) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
}
function claimTeacherKey(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
}
