"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const audioRoutingPlan_1 = require("./audioRoutingPlan");
(0, node_test_1.default)("known categories stay explicit and stable", () => {
    strict_1.default.deepEqual(audioRoutingPlan_1.AUDIO_ROUTE_CATEGORIES, [
        "dialogue",
        "sfx",
        "slide-bgm",
        "section-bgm",
        "mic",
        "unclassified",
    ]);
    strict_1.default.equal((0, audioRoutingPlan_1.isKnownAudioRouteCategory)("dialogue"), true);
    strict_1.default.equal((0, audioRoutingPlan_1.isKnownAudioRouteCategory)("section-bgm"), true);
    strict_1.default.equal((0, audioRoutingPlan_1.isKnownAudioRouteCategory)("unknown"), false);
});
(0, node_test_1.default)("music and effects routes reach both cable and monitor while mic stays cable-only", () => {
    strict_1.default.deepEqual((0, audioRoutingPlan_1.getAudioRouteTargets)("dialogue"), ["cable", "monitor"]);
    strict_1.default.deepEqual((0, audioRoutingPlan_1.getAudioRouteTargets)("sfx"), ["cable", "monitor"]);
    strict_1.default.deepEqual((0, audioRoutingPlan_1.getAudioRouteTargets)("slide-bgm"), ["cable", "monitor"]);
    strict_1.default.deepEqual((0, audioRoutingPlan_1.getAudioRouteTargets)("section-bgm"), ["cable", "monitor"]);
    strict_1.default.deepEqual((0, audioRoutingPlan_1.getAudioRouteTargets)("unclassified"), ["cable", "monitor"]);
    strict_1.default.deepEqual((0, audioRoutingPlan_1.getAudioRouteTargets)("mic"), ["cable"]);
});
