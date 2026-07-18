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

test("broadcast contains mic and media while monitor mic is opt-in", () => {
  assert.deepEqual(getAudioRouteTargets("dialogue", false), ["broadcast", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("sfx", false), ["broadcast", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("slide-bgm", false), ["broadcast", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("section-bgm", false), ["broadcast", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("unclassified", false), ["broadcast", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("mic", false), ["broadcast"]);
  assert.deepEqual(getAudioRouteTargets("mic", true), ["broadcast", "monitor"]);
});
