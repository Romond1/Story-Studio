import {
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";
import {
  appendCompletedMarkerStroke,
  startManagedAnimationLoop,
} from "../../shared/drawingLifecycle";
import type { DrawPoint, MarkerStroke } from "../../shared/types";

export type DrawTool = "highlighter" | "marker";

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface DrawSettings {
  tool: DrawTool;
  drawMode: boolean;
  size: number;
  opacity: number;
  fadeMs: number;
  color: string;
  rainbow: boolean;
  sparkle: boolean;
}

export interface HighlighterStroke {
  id: string;
  points: DrawPoint[];
  size: number;
  opacity: number;
  color: string;
  fadeMs: number;
  rainbow: boolean;
  sparkle: boolean;
}

export interface StageDrawingOverlayProps {
  targetId: string;
  settings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange(strokes: MarkerStroke[]): void;
  clearSignal: number;
  viewportRef: MutableRefObject<ViewportState>;
  contentWidth?: number;
  contentHeight?: number;
}

type RenderableStroke = MarkerStroke | HighlighterStroke;

function getOpaqueStrokeColor(color: string, alpha: number): string {
  const clean = color.startsWith("#") ? color.slice(1) : color;
  if (clean.length !== 6) return color;
  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function StageDrawingOverlay({
  targetId,
  settings,
  markerStrokes,
  onMarkerStrokesChange,
  clearSignal,
  viewportRef,
  contentWidth,
  contentHeight,
}: StageDrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef(settings);
  const markersRef = useRef(markerStrokes);
  const onMarkersChangeRef = useRef(onMarkerStrokesChange);
  const sizeRef = useRef({ contentWidth, contentHeight });
  const activeMarkerRef = useRef<MarkerStroke | null>(null);
  const activeHighlighterRef = useRef<HighlighterStroke | null>(null);
  const highlightersRef = useRef<HighlighterStroke[]>([]);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
    if (!settings.drawMode) {
      isDrawingRef.current = false;
      activeMarkerRef.current = null;
      activeHighlighterRef.current = null;
    }
  }, [settings]);

  useEffect(() => {
    markersRef.current = markerStrokes;
  }, [markerStrokes]);

  useEffect(() => {
    onMarkersChangeRef.current = onMarkerStrokesChange;
  }, [onMarkerStrokesChange]);

  useEffect(() => {
    sizeRef.current = { contentWidth, contentHeight };
  }, [contentWidth, contentHeight]);

  useEffect(() => {
    isDrawingRef.current = false;
    activeMarkerRef.current = null;
    activeHighlighterRef.current = null;
    highlightersRef.current = [];
  }, [targetId, clearSignal]);

  const getContentPoint = (clientX: number, clientY: number): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const viewport = viewportRef.current;
    const width = sizeRef.current.contentWidth ?? rect.width;
    const height = sizeRef.current.contentHeight ?? rect.height;
    const x = (clientX - rect.left - viewport.pan.x) / viewport.zoom / width;
    const y = (clientY - rect.top - viewport.pan.y) / viewport.zoom / height;
    const now = performance.now();
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      t: now,
      h: settingsRef.current.rainbow ? (now / 18) % 360 : undefined,
    };
  };

  const renderStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: RenderableStroke,
    width: number,
    height: number,
    now: number,
  ) => {
    if (stroke.points.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;

    for (let index = 1; index < stroke.points.length; index += 1) {
      const start = stroke.points[index - 1];
      const end = stroke.points[index];
      const fadeMs = "fadeMs" in stroke ? stroke.fadeMs : 0;
      const fadeAlpha = fadeMs > 0 ? Math.max(0, 1 - (now - end.t) / fadeMs) : 1;
      const alpha = Math.max(0, Math.min(1, fadeAlpha * stroke.opacity));
      if (alpha <= 0) continue;
      const hue = stroke.rainbow ? (end.h ?? now / 18 + index * 8) : undefined;
      ctx.strokeStyle = stroke.rainbow
        ? `hsla(${hue}, 95%, 62%, ${alpha})`
        : getOpaqueStrokeColor(stroke.color, alpha);
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }
  };

  const drawFrame = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = Math.max(1, Math.floor(rect.width));
    const canvasHeight = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = sizeRef.current.contentWidth ?? canvasWidth;
    const height = sizeRef.current.contentHeight ?? canvasHeight;
    const viewport = viewportRef.current;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.translate(viewport.pan.x, viewport.pan.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    markersRef.current.forEach((stroke) => renderStroke(ctx, stroke, width, height, now));
    if (activeMarkerRef.current) {
      renderStroke(ctx, activeMarkerRef.current, width, height, now);
    }

    const activeHighlighter = activeHighlighterRef.current;
    const highlighters = activeHighlighter
      ? [...highlightersRef.current, activeHighlighter]
      : highlightersRef.current;
    highlighters.forEach((stroke) => renderStroke(ctx, stroke, width, height, now));

    const sparkleStroke = highlighters[highlighters.length - 1];
    if (sparkleStroke?.sparkle && sparkleStroke.points.length > 0) {
      const lastPoint = sparkleStroke.points[sparkleStroke.points.length - 1];
      for (let index = 0; index < 6; index += 1) {
        const angle = (now / 120 + index) * 1.7;
        const distance = 2 + (index % 3) * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 - index * 0.04})`;
        ctx.beginPath();
        ctx.arc(
          lastPoint.x * width + Math.cos(angle) * distance,
          lastPoint.y * height + Math.sin(angle) * distance,
          Math.max(0.6, 2.2 - index * 0.25),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();

    highlightersRef.current = highlightersRef.current.filter((stroke) => {
      const lastPoint = stroke.points[stroke.points.length - 1];
      return !lastPoint || now - lastPoint.t < stroke.fadeMs;
    });
  };

  useEffect(() => startManagedAnimationLoop(
    {
      request: (callback) => window.requestAnimationFrame(callback),
      cancel: (id) => window.cancelAnimationFrame(id),
    },
    drawFrame,
  ), []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.drawMode || event.button !== 0) return;
    const point = getContentPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;

    if (currentSettings.tool === "highlighter") {
      activeHighlighterRef.current = {
        id: crypto.randomUUID(),
        points: [point],
        size: currentSettings.size,
        opacity: currentSettings.opacity,
        color: currentSettings.color,
        fadeMs: currentSettings.fadeMs,
        rainbow: currentSettings.rainbow,
        sparkle: currentSettings.sparkle,
      };
      return;
    }

    activeMarkerRef.current = {
      id: crypto.randomUUID(),
      points: [point],
      size: currentSettings.size,
      opacity: currentSettings.opacity,
      color: currentSettings.color,
      rainbow: currentSettings.rainbow,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!settingsRef.current.drawMode || !isDrawingRef.current) return;
    const point = getContentPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();

    if (activeHighlighterRef.current) {
      activeHighlighterRef.current = {
        ...activeHighlighterRef.current,
        points: [...activeHighlighterRef.current.points, point],
      };
    } else if (activeMarkerRef.current) {
      activeMarkerRef.current = {
        ...activeMarkerRef.current,
        points: [...activeMarkerRef.current.points, point],
      };
    }
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (activeHighlighterRef.current) {
      if (activeHighlighterRef.current.points.length > 1) {
        highlightersRef.current = [...highlightersRef.current, activeHighlighterRef.current];
      }
      activeHighlighterRef.current = null;
    }

    if (activeMarkerRef.current) {
      const next = appendCompletedMarkerStroke(markersRef.current, activeMarkerRef.current);
      activeMarkerRef.current = null;
      if (next !== markersRef.current) {
        markersRef.current = next;
        onMarkersChangeRef.current(next);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={settings.drawMode ? "stage-drawing-overlay active" : "stage-drawing-overlay"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onPointerLeave={finishStroke}
    />
  );
}
