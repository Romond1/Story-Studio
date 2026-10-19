"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timelineZoom = timelineZoom;
exports.zoomScroll = zoomScroll;
exports.timelineDensity = timelineDensity;
function timelineZoom(value) { return Math.max(.45, Math.min(2.6, value)); }
function zoomScroll(scroll, pointer, oldWidth, newWidth) { return Math.max(0, (scroll + pointer) * newWidth / oldWidth - pointer); }
function timelineDensity(zoom) { return zoom < .75 ? 'overview' : zoom < 1.25 ? 'normal' : zoom < 1.9 ? 'detail' : 'frame'; }
