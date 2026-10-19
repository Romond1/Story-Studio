"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultViewport = void 0;
exports.createTeachingScene = createTeachingScene;
exports.reduceTeachingScene = reduceTeachingScene;
exports.clientToLogical = clientToLogical;
exports.normalizeTransientStrokes = normalizeTransientStrokes;
const defaultViewport = () => ({ zoom: 1, pan: { x: 0, y: 0 } });
exports.defaultViewport = defaultViewport;
function createTeachingScene(targetKey) {
    return { targetKey, sequence: 0, viewport: (0, exports.defaultViewport)(), transient: [] };
}
/** Control Core's runtime state. Authored markers remain in their existing content owner. */
function reduceTeachingScene(state, command) {
    if (command.targetKey !== state.targetKey || command.sequence <= state.sequence)
        return state;
    const viewport = command.viewport ?? state.viewport;
    if (![viewport.zoom, viewport.pan.x, viewport.pan.y].every(Number.isFinite) || viewport.zoom < 1 || viewport.zoom > 4)
        return state;
    return { ...state, sequence: command.sequence, viewport, transient: command.transient === undefined ? state.transient : normalizeTransientStrokes(command.transient) };
}
function clientToLogical(point, rect, frame) {
    return { x: (point.x - rect.left) * frame.width / Math.max(1, rect.width), y: (point.y - rect.top) * frame.height / Math.max(1, rect.height) };
}
/** Same bounded visual stream in Control and Present; authored commits stay complete. */
function normalizeTransientStrokes(strokes) {
    return strokes.slice(-32).map(stroke => {
        if (stroke.points.length <= 4000)
            return stroke;
        return { ...stroke, points: Array.from({ length: 4000 }, (_, index) => stroke.points[Math.round(index * (stroke.points.length - 1) / 3999)]) };
    });
}
