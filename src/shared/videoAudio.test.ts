import test from "node:test";
import assert from "node:assert/strict";
import type { Slide } from "./types";
import { normalizeSlideVideoAudio, resolveVideoAudioSettings } from "./videoAudio";

function createSlide(): Slide {
  return {
    id: "slide-1",
    assetId: "asset-1",
    sectionId: "section-1",
    transition: "fade",
  };
}

test("legacy video slides default to enabled video audio at full volume", () => {
  const normalized = normalizeSlideVideoAudio(createSlide(), "video");

  assert.deepEqual(normalized.videoAudio, {
    enabled: true,
    volume: 1,
  });
});

test("saved muted video-audio settings are preserved", () => {
  const normalized = normalizeSlideVideoAudio(
    {
      ...createSlide(),
      videoAudio: {
        enabled: false,
        volume: 0.35,
      },
    },
    "video",
  );

  assert.deepEqual(normalized.videoAudio, {
    enabled: false,
    volume: 0.35,
  });
});

test("video-audio settings clamp invalid saved volume values", () => {
  assert.deepEqual(resolveVideoAudioSettings({ enabled: true, volume: 4 }), {
    enabled: true,
    volume: 1,
  });
  assert.deepEqual(resolveVideoAudioSettings({ enabled: true, volume: -2 }), {
    enabled: true,
    volume: 0,
  });
});
