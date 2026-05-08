import test from "node:test";
import assert from "node:assert/strict";
import type { Slide } from "./types";
import {
  DEFAULT_IMAGE_ADJUSTMENTS,
  normalizeImageAdjustments,
  normalizeSlideImageAdjustments,
  resolveImageAdjustments,
} from "./imageAdjustments";

function createSlide(): Slide {
  return {
    id: "slide-1",
    assetId: "asset-1",
    sectionId: "section-1",
    transition: "fade",
  };
}

test("legacy image slides without adjustments keep default display", () => {
  const normalized = normalizeSlideImageAdjustments(createSlide(), "image");

  assert.equal(normalized.imageAdjustments, undefined);
  assert.deepEqual(resolveImageAdjustments(normalized.imageAdjustments), DEFAULT_IMAGE_ADJUSTMENTS);
});

test("saved image adjustments are preserved and clamped", () => {
  const normalized = normalizeSlideImageAdjustments(
    {
      ...createSlide(),
      imageAdjustments: {
        flipX: true,
        brightness: 1.35,
        contrast: 0.65,
        saturate: 1.8,
      },
    },
    "image",
  );

  assert.deepEqual(normalized.imageAdjustments, {
    flipX: true,
    brightness: 1.35,
    contrast: 0.65,
    saturate: 1.8,
  });
});

test("invalid saved image adjustment values fall back safely", () => {
  const normalized = normalizeImageAdjustments({
    flipX: "yes" as unknown as boolean,
    brightness: 99,
    contrast: Number.NaN,
    saturate: -4,
  });

  assert.deepEqual(normalized, {
    brightness: 2,
    saturate: 0,
  });
  assert.deepEqual(resolveImageAdjustments(normalized), {
    flipX: false,
    brightness: 2,
    contrast: 1,
    saturate: 0,
  });
});

test("non-image slides do not retain image adjustment metadata", () => {
  const normalized = normalizeSlideImageAdjustments(
    {
      ...createSlide(),
      imageAdjustments: {
        flipX: true,
        brightness: 1.2,
      },
    },
    "video",
  );

  assert.equal(normalized.imageAdjustments, undefined);
});
