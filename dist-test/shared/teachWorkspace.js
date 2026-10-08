"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePresentViewport = parsePresentViewport;
exports.fitPreviewViewport = fitPreviewViewport;
exports.previewPoint = previewPoint;
exports.clampTeachSplit = clampTeachSplit;
exports.clampTeachNavigatorHeight = clampTeachNavigatorHeight;
exports.teachNavigatorRows = teachNavigatorRows;
exports.navigatorWheelDelta = navigatorWheelDelta;
const staticScene_1 = require("./staticScene");
/** Runtime device geometry, never part of a lesson file. */
function parsePresentViewport(value) {
    if (!value || typeof value !== 'object')
        return null;
    const { width, height } = value;
    return typeof width === 'number' && typeof height === 'number' && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width <= 32768 && height <= 32768 ? { width, height } : null;
}
function fitPreviewViewport(viewport, available) {
    const fit = (0, staticScene_1.fitLogicalFrame)(viewport, available);
    return { ...fit, width: viewport.width * fit.scale, height: viewport.height * fit.scale };
}
function previewPoint(point, rect) {
    if (rect.width <= 0 || rect.height <= 0 || point.x < rect.x || point.y < rect.y || point.x > rect.x + rect.width || point.y > rect.y + rect.height)
        return null;
    return { x: (point.x - rect.x) / rect.width, y: (point.y - rect.y) / rect.height };
}
function clampTeachSplit(value) { return Number.isFinite(value) ? Math.max(30, Math.min(65, value)) : 42; }
/** Keep at least 220px above the 10px bottom divider on laptop displays. */
function clampTeachNavigatorHeight(value, workspaceHeight, minimum = 176) {
    const maximum = Math.max(minimum, Math.min(400, workspaceHeight - 230));
    return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}
/** Fit readable 100px tiles with 7px gaps into the expanded navigator. */
function teachNavigatorRows(availableHeight) {
    return Number.isFinite(availableHeight) ? Math.max(1, Math.min(3, Math.floor((availableHeight + 7) / 107))) : 1;
}
function navigatorWheelDelta(deltaX, deltaY, deltaMode, pageWidth) {
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    return delta * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageWidth : 1);
}
