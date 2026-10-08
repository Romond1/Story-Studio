import { paintDrawing } from './drawing/renderDrawing';
import type { MarkerStroke } from '../shared/types';
import { defaultViewport, type SceneViewport, type TransientStroke } from '../shared/teachingScene';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { OverlayItem, ImageAdjustmentSettings } from '../shared/types';
import { BUBBLE_LIBRARY } from '../shared/bubbleDefs';
import { resolveImageAdjustments } from '../shared/imageAdjustments';
import { fitLogicalFrame, type LogicalFrame } from '../shared/staticScene';

export const LogicalFrameScaleContext = React.createContext(1);
export function LogicalSceneFrame({ frame, children, transparent = false }: { frame?: LogicalFrame | null; children: ReactNode; transparent?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(frame ?? { width: 1, height: 1 });
  useLayoutEffect(() => {
    const el = host.current!;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update(); const observer = new ResizeObserver(entries => { const { width, height } = entries[0].contentRect; setSize({ width, height }); }); observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const logical = frame ?? size;
  const fit = fitLogicalFrame(logical, size);
  return <div ref={host} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}><div data-logical-scene="true" style={{ position: 'absolute', width: logical.width, height: logical.height, left: fit.x, top: fit.y, transform: `scale(${fit.scale})`, transformOrigin: '0 0', background: transparent ? 'transparent' : '#0a0a0a' }}><LogicalFrameScaleContext.Provider value={fit.scale}>{children}</LogicalFrameScaleContext.Provider></div></div>;
}
export function PassiveImage({ src, adjustments, style, onLoad, onError }: { src: string; adjustments?: ImageAdjustmentSettings; style?: CSSProperties; onLoad?: () => void; onError?: () => void }) {
  const a = resolveImageAdjustments(adjustments);
  return <img src={src} alt="" draggable={false} onLoad={onLoad} onError={onError} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transformOrigin: '0 0', transform: a.flipX ? 'translateX(100%) scaleX(-1)' : undefined, filter: `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturate})`, ...style }} />;
}
/** Student-visible content only; no editors, providers, timers or media effects. */
export function overlayGraphic(o: OverlayItem): string | null {
  const def = BUBBLE_LIBRARY.find(d => d.bubbleDefId === o.bubbleDefId) || BUBBLE_LIBRARY[0];
  return o.visible === false || def.type === 'text' ? null : o.customImageSrc || def.src || null;
}
function BubbleGraphic({ overlay, onLoad, onError }: { overlay: OverlayItem; onLoad?: (src: string) => void; onError?: (src: string) => void }) {
  const src = overlayGraphic(overlay)!;
  const [failed, setFailed] = useState(false);
  const definition = BUBBLE_LIBRARY.find(d => d.bubbleDefId === overlay.bubbleDefId) || BUBBLE_LIBRARY[0];
  const color = overlay.textColor || String(definition.defaultStyle?.color || '#000');
  const fallbackBackground = String(definition.defaultStyle?.backgroundColor || (/^(#fff(?:fff)?|white)$/i.test(color) ? '#333' : '#fff'));
  if (failed) return <div data-bubble-fallback="true" style={{ position: 'absolute', inset: 0, background: fallbackBackground, border: '2px solid #555', borderRadius: 18, zIndex: 1 }} />;
  return <img alt="" draggable={false} src={src} onLoad={() => onLoad?.(src)} onError={() => { setFailed(true); onError?.(src); }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', transform: `scale(${overlay.flipX ? -1 : 1}, ${overlay.flipY ? -1 : 1})`, zIndex: 1 }} />;
}
export function PassiveOverlays({ overlays, onGraphicLoad, onGraphicError }: { overlays: OverlayItem[]; onGraphicLoad?: (src: string) => void; onGraphicError?: (src: string) => void }) {
  return <>{overlays.filter(o => o.visible !== false).map(o => {
    const def = BUBBLE_LIBRARY.find(d => d.bubbleDefId === o.bubbleDefId) || BUBBLE_LIBRARY[0];
    const text = def.type === 'text'; const defaults = def.defaultStyle || {};
    const rect = o.textRect ?? def.textRect ?? { x: 0, y: 0, width: 1, height: 1 };
    return <div key={o.id} style={{ position: 'absolute', left: o.x, top: o.y, width: o.width, height: o.height, zIndex: Math.min(o.zIndex ?? 1, 9), boxSizing: 'border-box', pointerEvents: 'none', backgroundColor: text ? 'rgba(0,0,0,0.7)' : 'transparent', borderRadius: text ? 8 : 0 }}>
      {!text && overlayGraphic(o) && <BubbleGraphic key={overlayGraphic(o)} overlay={o} onLoad={onGraphicLoad} onError={onGraphicError} />}
      <div style={{ position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, padding: 4, color: text ? '#fff' : o.textColor || String(defaults.color || '#000000'), display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: o.align || 'center', fontFamily: o.fontFamily || String(defaults.fontFamily || 'inherit'), fontSize: o.fontSize || defaults.fontSize || 24, fontWeight: o.fontWeight || defaults.fontWeight || 'normal', fontStyle: o.fontStyle || 'normal', lineHeight: o.lineHeight || defaults.lineHeight || 1.2, textShadow: o.textShadow && text ? '0 2px 4px rgba(0,0,0,0.8)' : 'none', overflow: 'hidden', boxSizing: 'border-box', zIndex: 2 } as CSSProperties}><div style={{ width: '100%', whiteSpace: 'pre-wrap' }}>{o.text}</div></div>
    </div>;
  })}</>;
}

export function PassiveDrawings({ frame, viewport, markers = [], transient = [] }: { frame: LogicalFrame; viewport?: SceneViewport; markers?: MarkerStroke[]; transient?: TransientStroke[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ frame, viewport, markers, transient }); latest.current = { frame, viewport, markers, transient };
  useEffect(() => {
    let animation = 0;
    const draw = () => {
      const state = latest.current;
      if (canvas.current) paintDrawing(canvas.current, state.frame, state.viewport ?? defaultViewport(), state.markers, state.transient, Date.now());
      animation = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(animation);
  }, []);
  return <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20000 }} />;
}

