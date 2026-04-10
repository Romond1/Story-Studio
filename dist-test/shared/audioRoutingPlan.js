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
const audioRouteTargets = {
    dialogue: ["cable", "monitor"],
    sfx: ["cable", "monitor"],
    "slide-bgm": ["cable", "monitor"],
    "section-bgm": ["cable", "monitor"],
    mic: ["cable"],
    unclassified: ["cable", "monitor"],
};
function isKnownAudioRouteCategory(value) {
    return exports.AUDIO_ROUTE_CATEGORIES.includes(value);
}
function getAudioRouteTargets(category) {
    return [...audioRouteTargets[category]];
}
