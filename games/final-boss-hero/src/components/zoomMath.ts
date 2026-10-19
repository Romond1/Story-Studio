export interface PlayAreaMetrics {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  fitZoom: number;
}

export interface PlayAreaView {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface ZoomPointer {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Trackpads emit many small pixel deltas; wheel mice may use line units. */
export function wheelZoom(current:number,deltaY:number,deltaMode:number,min:number,max:number):number {
  const pixels=deltaY*(deltaMode===1?16:deltaMode===2?800:1);
  return clamp(current*Math.exp(-clamp(pixels,-160,160)*0.0015),min,max);
}

export function computeFitZoom(metrics: PlayAreaMetrics, minZoom = 0.4): number {
  const widthFit = metrics.viewportWidth / metrics.contentWidth;
  const heightFit = metrics.viewportHeight / metrics.contentHeight;
  return clamp(Math.min(1, widthFit, heightFit), minZoom, 1);
}

/** Dense imported boards can need a smaller fit; other native games keep .28. */
export function computePlayAreaFitZoom(metrics: Omit<PlayAreaMetrics, 'fitZoom'>, boardDash: boolean): number {
  return computeFitZoom({ ...metrics, fitZoom: 1 }, boardDash ? 0.05 : 0.28);
}

export function clampOffsets(
  metrics: PlayAreaMetrics,
  zoom: number,
  offsetX: number,
  offsetY: number,
): { offsetX: number; offsetY: number } {
  const scaledWidth = metrics.contentWidth * zoom;
  const scaledHeight = metrics.contentHeight * zoom;
  const horizontalCenter = (metrics.viewportWidth - scaledWidth) / 2;
  const verticalCenter = (metrics.viewportHeight - scaledHeight) / 2;

  return {
    offsetX:
      scaledWidth <= metrics.viewportWidth
        ? horizontalCenter
        : clamp(offsetX, metrics.viewportWidth - scaledWidth, 0),
    offsetY:
      scaledHeight <= metrics.viewportHeight
        ? verticalCenter
        : clamp(offsetY, metrics.viewportHeight - scaledHeight, 0),
  };
}

export function computeNextZoomView(
  metrics: PlayAreaMetrics,
  current: PlayAreaView,
  pointer: ZoomPointer,
  nextZoom: number,
): PlayAreaView {
  const scaleRatio = nextZoom / current.zoom;
  const clamped = clampOffsets(
    metrics,
    nextZoom,
    pointer.x - (pointer.x - current.offsetX) * scaleRatio,
    pointer.y - (pointer.y - current.offsetY) * scaleRatio,
  );
  return { zoom: nextZoom, offsetX: clamped.offsetX, offsetY: clamped.offsetY };
}

/** Fit initial/resized content; preserve a teacher's explicit wheel zoom between resizes. */
export function reclampPlayAreaView(metrics: PlayAreaMetrics, current: PlayAreaView, autoFit: boolean, maxZoom = 3.5): PlayAreaView {
  const zoom = autoFit ? metrics.fitZoom : clamp(current.zoom, metrics.fitZoom, maxZoom);
  return { zoom, ...clampOffsets(metrics, zoom, current.offsetX, current.offsetY) };
}
