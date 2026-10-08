import { paintDrawing } from './renderDrawing';
import { clientToLogical, normalizeTransientStrokes, type TransientStroke } from '../../shared/teachingScene';
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
  onTransientChange?: (strokes: TransientStroke[]) => void;
}

type RenderableStroke = MarkerStroke | HighlighterStroke;

export function StageDrawingOverlay({
  targetId,
  settings,
  markerStrokes,
  onMarkerStrokesChange,
  clearSignal,
  viewportRef,
  contentWidth,
  contentHeight,
  onTransientChange,
}: StageDrawingOverlayProps) {
  const transientCallback = useRef(onTransientChange);
  transientCallback.current = onTransientChange;
  const transientDirty = useRef(false);
  const lastTransientPublish = useRef(0);
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
      transientDirty.current = true;
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
    transientDirty.current = true;
  }, [targetId, clearSignal]);

  const getContentPoint = (clientX: number, clientY: number): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const viewport = viewportRef.current;
    const width = sizeRef.current.contentWidth ?? canvas.clientWidth;
    const height = sizeRef.current.contentHeight ?? canvas.clientHeight;
    const logical = clientToLogical({ x: clientX, y: clientY }, rect, { width: canvas.clientWidth, height: canvas.clientHeight });
    const x = (logical.x - viewport.pan.x) / viewport.zoom / width;
    const y = (logical.y - viewport.pan.y) / viewport.zoom / height;
    const now = Date.now();
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      t: now,
      h: settingsRef.current.rainbow ? (now / 18) % 360 : undefined,
    };
  };

  const publishTransient = () => {
    transientDirty.current = false;
    lastTransientPublish.current = Date.now();
    transientCallback.current?.(normalizeTransientStrokes([
      ...highlightersRef.current,
      ...(activeHighlighterRef.current ? [activeHighlighterRef.current] : []),
      ...(activeMarkerRef.current ? [activeMarkerRef.current] : []),
    ]));
  };
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const now = Date.now();
    const highlighters = highlightersRef.current.filter(stroke => {
      const last = stroke.points[stroke.points.length - 1];
      return !last || now - last.t < stroke.fadeMs;
    });
    if (highlighters.length !== highlightersRef.current.length) transientDirty.current = true;
    highlightersRef.current = highlighters;
    const transient = normalizeTransientStrokes([...highlighters, ...(activeHighlighterRef.current ? [activeHighlighterRef.current] : []), ...(activeMarkerRef.current ? [activeMarkerRef.current] : [])]);
    paintDrawing(canvas, { width: canvas.clientWidth, height: canvas.clientHeight }, viewportRef.current, markersRef.current, transient, now, { width: sizeRef.current.contentWidth ?? canvas.clientWidth, height: sizeRef.current.contentHeight ?? canvas.clientHeight });
    if (transientDirty.current && now - lastTransientPublish.current >= 33) publishTransient();
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
    transientDirty.current = true;

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

    transientDirty.current = true;
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
    publishTransient();
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
