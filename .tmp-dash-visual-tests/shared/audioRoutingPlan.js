"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIO_ROUTE_CATEGORIES = void 0;
exports.isKnownAudioRouteCategory = isKnownAudioRouteCategory;
exports.getAudioRouteTargets = getAudioRouteTargets;
exports.AUDIO_ROUTE_CATEGORIES = [
    "dialogue",
    "sfx",
    "slide-bgm",
    "section-bgm",
    "mic",
    "unclassified",
];
function isKnownAudioRouteCategory(value) {
    return exports.AUDIO_ROUTE_CATEGORIES.includes(value);
}
function getAudioRouteTargets(category, microphoneMonitorEnabled = false) {
    if (category === "mic") {
        return microphoneMonitorEnabled ? ["broadcast", "monitor"] : ["broadcast"];
    }
    return ["broadcast", "monitor"];
}
