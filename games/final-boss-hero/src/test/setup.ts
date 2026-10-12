import "@testing-library/jest-dom/vitest";

if (!Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    return {
      cancel() {},
      finished: Promise.resolve(),
      play() {},
    } as unknown as Animation;
  };
}
