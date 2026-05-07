import test from "node:test";
import assert from "node:assert/strict";
import type { Slide } from "./types";
import {
  clampVideoTimeToTrim,
  getEffectiveVideoTrim,
  normalizeSlideVideoTrim,
  shouldStopAtTrimOut,
} from "./videoTrim";

function createSlide(): Slide {
  return {
    id: "slide-1",
    assetId: "asset-1",
    sectionId: "section-1",
    transition: "fade",
  };
}

test("legacy video slides without trim data keep full-video playback", () => {
  const normalized = normalizeSlideVideoTrim(createSlide(), "video");

  assert.equal(normalized.videoTrim, undefined);
  assert.deepEqual(getEffectiveVideoTrim(normalized.videoTrim, 8), {
    inSec: 0,
    outSec: 8,
    isTrimmed: false,
  });
});

test("saved video trim values are preserved and clamped to duration", () => {
  const normalized = normalizeSlideVideoTrim(
    {
      ...createSlide(),
      videoTrim: {
        inSec: 1.25,
        outSec: 4.75,
      },
    },
    "video",
  );

  assert.deepEqual(normalized.videoTrim, {
    inSec: 1.25,
    outSec: 4.75,
  });
  assert.deepEqual(getEffectiveVideoTrim(normalized.videoTrim, 4), {
    inSec: 1.25,
    outSec: 4,
    isTrimmed: true,
  });
});

test("invalid saved trim values are removed instead of breaking legacy project load", () => {
  const normalized = normalizeSlideVideoTrim(
    {
      ...createSlide(),
      videoTrim: {
        inSec: Number.NaN,
        outSec: -3,
      },
    },
    "video",
  );

  assert.equal(normalized.videoTrim, undefined);
});

test("non-video slides do not gain trim metadata during normalization", () => {
  const normalized = normalizeSlideVideoTrim(
    {
      ...createSlide(),
      videoTrim: {
        inSec: 1,
        outSec: 2,
      },
    },
    "image",
  );

  assert.equal(normalized.videoTrim, undefined);
});

test("playback helpers clamp to in point and stop at out point", () => {
  const trim = { inSec: 2, outSec: 6 };

  assert.equal(clampVideoTimeToTrim(1, trim, 10), 2);
  assert.equal(clampVideoTimeToTrim(4, trim, 10), 4);
  assert.equal(clampVideoTimeToTrim(7, trim, 10), 6);
  assert.equal(shouldStopAtTrimOut(5.95, trim, 10), false);
  assert.equal(shouldStopAtTrimOut(6, trim, 10), true);
});

test("playback clamps to in point even before video duration metadata is available", () => {
  const trim = { inSec: 2, outSec: 6 };

  assert.equal(clampVideoTimeToTrim(0, trim, Number.NaN), 2);
});
