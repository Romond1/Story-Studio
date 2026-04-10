import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_ROUTE_CATEGORIES,
  getAudioRouteTargets,
  isKnownAudioRouteCategory,
} from "./audioRoutingPlan";

test("known categories stay explicit and stable", () => {
  assert.deepEqual(AUDIO_ROUTE_CATEGORIES, [
    "dialogue",
    "sfx",
    "slide-bgm",
    "section-bgm",
    "mic",
    "unclassified",
  ]);
  assert.equal(isKnownAudioRouteCategory("dialogue"), true);
  assert.equal(isKnownAudioRouteCategory("section-bgm"), true);
  assert.equal(isKnownAudioRouteCategory("unknown"), false);
});

test("music and effects routes reach both cable and monitor while mic stays cable-only", () => {
  assert.deepEqual(getAudioRouteTargets("dialogue"), ["cable", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("sfx"), ["cable", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("slide-bgm"), ["cable", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("section-bgm"), ["cable", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("unclassified"), ["cable", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("mic"), ["cable"]);
});
