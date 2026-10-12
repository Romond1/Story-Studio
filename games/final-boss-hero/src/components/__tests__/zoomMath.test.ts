import { describe, expect, it } from "vitest";
import { clampOffsets, computeFitZoom, computeNextZoomView } from "../zoomMath";

const metrics = {
  viewportWidth: 500,
  viewportHeight: 300,
  contentWidth: 1000,
  contentHeight: 600,
  fitZoom: 0.5,
};

describe("zoom math", () => {
  it("computes a fit zoom that never scales above 100%", () => {
    expect(computeFitZoom(metrics)).toBe(0.5);
    expect(
      computeFitZoom({
        viewportWidth: 1200,
        viewportHeight: 900,
        contentWidth: 1000,
        contentHeight: 600,
        fitZoom: 1,
      }),
    ).toBe(1);
  });

  it("keeps the world point under the pointer stable while zooming", () => {
    const current = { zoom: 1, offsetX: -100, offsetY: -50 };
    const pointer = { x: 250, y: 150 };
    const beforeWorldX = (pointer.x - current.offsetX) / current.zoom;
    const beforeWorldY = (pointer.y - current.offsetY) / current.zoom;

    const next = computeNextZoomView(metrics, current, pointer, 1.25);

    expect((pointer.x - next.offsetX) / next.zoom).toBeCloseTo(beforeWorldX);
    expect((pointer.y - next.offsetY) / next.zoom).toBeCloseTo(beforeWorldY);
  });

  it("centers content that is smaller than the viewport", () => {
    expect(
      clampOffsets(
        {
          viewportWidth: 500,
          viewportHeight: 300,
          contentWidth: 200,
          contentHeight: 100,
          fitZoom: 1,
        },
        1,
        -999,
        999,
      ),
    ).toEqual({ offsetX: 150, offsetY: 100 });
  });
});
