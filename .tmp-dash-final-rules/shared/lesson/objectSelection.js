"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewDrawings = previewDrawings;
exports.marqueeIds = marqueeIds;
exports.translateBoxes = translateBoxes;
function previewDrawings(drawings, preview) {
    return preview ? [...drawings.filter(s => !preview.erasedIds?.includes(s.id)), ...(preview.stroke ? [preview.stroke] : [])] : drawings;
}
function marqueeIds(objects, start, end) {
    const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y), right = Math.max(start.x, end.x), bottom = Math.max(start.y, end.y);
    return objects.filter(o => o.visible !== false && o.box.x < right && o.box.x + o.box.width > left && o.box.y < bottom && o.box.y + o.box.height > top).map(o => o.id);
}
function translateBoxes(objects, dx, dy, frame) {
    if (!objects.length)
        return [];
    dx = Math.max(-Math.min(...objects.map(o => o.box.x)), Math.min(dx, frame.width - Math.max(...objects.map(o => o.box.x + o.box.width))));
    dy = Math.max(-Math.min(...objects.map(o => o.box.y)), Math.min(dy, frame.height - Math.max(...objects.map(o => o.box.y + o.box.height))));
    return objects.map(o => ({ id: o.id, box: { ...o.box, x: o.box.x + dx, y: o.box.y + dy } }));
}
