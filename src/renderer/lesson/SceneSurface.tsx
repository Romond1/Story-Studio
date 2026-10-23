import { useBubbleTiming } from './useBubbleTiming';
import { SceneImageVisual } from './SceneImageVisual';
import { marqueeIds, translateBoxes, type DrawingPreview } from '../../shared/lesson/objectSelection';
import { fitBox } from '../../shared/lesson/commands';
import type { SceneViewport } from '../../shared/teachingScene';
import { zoomAtPoint, strokeTouches } from '../../shared/lessonPointer';
import React, { useContext, useEffect, useRef, useState } from 'react';
import type { ScenePlan, SceneObjectPlan } from '../../shared/lesson/projection';
import type { Rect } from '../../shared/lesson/model';
import type { MarkerStroke } from '../../shared/types';
import type { VideoTrimSettings } from '../../shared/types';
import { bindEditVideoTrim } from './editVideoPlayback';
import { CardV2Scene } from '../cardsV2/CardV2Scene';
import { LogicalFrameScaleContext, LogicalSceneFrame, PassiveDrawings } from '../StaticScene';
import { RewardScene } from '../RewardScene';
import { SceneBubble } from './SceneBubble';
export { SceneBubble } from './SceneBubble';
import './SceneSurface.css';

export interface SceneSurfaceProps {
  plan: ScenePlan; surface: 'edit' | 'teach' | 'present'; selectedObjectId?: string | null;
  selectedObjectIds?: string[]; onSelectMany?: (ids: string[]) => void; onGeometryChanges?: (changes: { id: string; box: Rect }[]) => void;
  onDrawingPreview?: (preview: DrawingPreview | null) => void;
  onSelect?: (id: string | null) => void; onGeometryChange?: (id: string, box: Rect) => void;
  onInteract?: (id: string) => void; video?: React.ReactNode;
  occurrenceKey?: string; interactiveMedia?: boolean;
  playback?: {positionSec:number;playing:boolean};
  onViewportChange?: (viewport: SceneViewport) => void;
  onContextMenu?: (point: { x: number; y: number; objectId: string | null }) => void;
  onCardDrop?: (objectId: string, entryId: string) => void;
  erasableStrokeIds?: string[]; drawingTool?: 'pen' | 'highlighter' | 'eraser'; onErase?: (ids: string[]) => void;
  drawing?: boolean; onDraw?: (stroke: MarkerStroke) => void; drawColor?: string; drawSize?: number; drawRainbow?: boolean; drawFadeMs?: number;
}

/** The new document stores scene units; the retained drawing leaf expects unit fractions. */
export function normalizedSceneDrawings(strokes: MarkerStroke[], frame: ScenePlan['frame']): MarkerStroke[] {
  return strokes.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ ...point, x: point.x / frame.width, y: point.y / frame.height })) }));
}

export function EditSceneVideo({ src, interactive = true, trim, onElement }: { src: string; interactive?: boolean; trim?: VideoTrimSettings; onElement?: (video: HTMLVideoElement | null) => void }) {
  const element = useRef<HTMLVideoElement>(null);
  // Edit owns local playback; native sound controls must remain under the user's control.
  useEffect(() => { const video = element.current; if (!video) return; return () => { video.pause(); }; }, [src]);
  useEffect(() => { onElement?.(element.current); return () => onElement?.(null); }, [src, onElement]);
  useEffect(() => { if (trim && element.current) return bindEditVideoTrim(element.current, trim); }, [src, trim]);
  return <video ref={element} src={src} controls={interactive} playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noremoteplayback"
    aria-label="Edit video preview" data-edit-video-preview="true" style={{ pointerEvents: interactive ? 'auto' : 'none' }}
    onPointerDown={event => { if (interactive) event.stopPropagation(); }} onPointerUp={event => { if (interactive) event.stopPropagation(); }} />;
}

function ReviewVideo({ src, interactive }: { src: string; interactive: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const node = ref.current; if (node && node.getAttribute('src') !== src) node.setAttribute('src', src); return () => { if (node) { node.pause(); node.removeAttribute('src'); node.load(); } }; }, [src]);
  return <video ref={ref} src={src} controls={interactive} muted={!interactive} playsInline preload="metadata" aria-label="Review video"
    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: interactive ? 'auto' : 'none' }}
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} />;
}

function ObjectVisual({ object, interactiveMedia }: { object: SceneObjectPlan; interactiveMedia: boolean }) {
  if (object.kind === 'card') return <CardV2Scene plan={{ engine: 'card-v2', version: 1,
    frame: { width: object.box.width, height: object.box.height }, cards: [{ ...object.card, box: { ...object.box, x: 0, y: 0 } }] }} />;
  if (object.kind === 'image') return <SceneImageVisual src={object.src} appearance={object.appearance} />;
  if (object.kind === 'video') return <ReviewVideo key={object.src} src={object.src} interactive={interactiveMedia} />;
  if (object.kind === 'bubble') return <SceneBubble object={object} />;
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: object.align === 'left' ? 'flex-start' : object.align === 'right' ? 'flex-end' : 'center',
    fontSize: object.fontSize, color: object.color, textAlign: object.align, whiteSpace: 'pre-wrap', overflow: 'hidden', overflowWrap: 'anywhere' }}>{object.text}</div>;
}

function ResizeHandle({ zoom, offsetY = 0, onPointerDown }: { zoom: number; offsetY?: number; onPointerDown: (event: React.PointerEvent) => void }) {
  const scale = Math.max(.01, useContext(LogicalFrameScaleContext) * zoom), size = 16 / scale;
  return <button className="lesson-object-resize" aria-label="Resize object" onPointerDown={onPointerDown} style={{ width: size, height: size, minWidth: size, minHeight: size, right: -size / 2, bottom: -size / 2 - offsetY, borderWidth: 2 / scale }} />;
}

/** All surfaces use this composition. Interactions never choose a different renderer or coordinate frame. */
export function SceneSurface({ plan, surface, selectedObjectId, selectedObjectIds, onSelectMany, onGeometryChanges, onDrawingPreview, onSelect, onGeometryChange, onInteract, video,
  drawing = false, onDraw, drawColor = '#ffcc33', drawSize = 6, drawRainbow = false, drawFadeMs = 0, drawingTool = 'pen', onErase,
  onViewportChange, onContextMenu, onCardDrop, occurrenceKey, interactiveMedia = true, erasableStrokeIds, playback }: SceneSurfaceProps) {
  const host = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const bubbleHidden=useBubbleTiming(host,plan.objects,JSON.stringify([plan.sceneId,surface,occurrenceKey]),surface!=='edit'&&interactiveMedia,plan.background.mediaType==='video',playback);
  const gesture = useRef<{ id: string; point: { x: number; y: number }; screen: { x: number; y: number }; original: Rect; box: Rect; resize: boolean; moved: boolean }>();
  const selected = selectedObjectIds ?? (selectedObjectId ? [selectedObjectId] : []);
  const group = useRef<{ id: string; box: Rect }[]>([]);
  const groupDraftRef = useRef<{ id: string; box: Rect }[]>([]);
  const [groupDraft, setGroupDraft] = useState<{ id: string; box: Rect }[]>([]);
  const marquee = useRef<{ start: { x: number; y: number }; base: string[]; original: string[] }>();
  const [marqueeBox, setMarqueeBox] = useState<Rect | null>(null);
  const pan = useRef<{ x: number; y: number; scale: number; viewport: SceneViewport }>();
  const [draft, setDraft] = useState<{ id: string; box: Rect } | null>(null);
  const stroke = useRef<MarkerStroke>();
  const erased = useRef<Set<string> | null>(null);
  const [erasedIds, setErasedIds] = useState<string[]>([]);
  const [drawDraft, setDrawDraft] = useState<MarkerStroke | null>(null);
  const suppressClick = useRef(false);
  const clear = () => { marquee.current = undefined; setMarqueeBox(null); group.current = []; groupDraftRef.current = []; setGroupDraft([]); onDrawingPreview?.(null); gesture.current = undefined; pan.current = undefined; stroke.current = undefined; erased.current = null; setDraft(null); setDrawDraft(null); setErasedIds([]); };
  const cancelGesture = () => {
    const active = gesture.current;
    if (marquee.current) onSelectMany?.(marquee.current.original);
    if (active?.moved && surface === 'teach') onGeometryChange?.(active.id, active.original);
    if (pan.current) onViewportChange?.(pan.current.viewport);
    if (active || pan.current || stroke.current || erased.current || marquee.current) suppressClick.current = true;
    clear();
  };
  const cancelRef = useRef(cancelGesture); cancelRef.current = cancelGesture;
  useEffect(() => {
    clear(); suppressClick.current = false;
    if (surface !== 'edit' && plan.transition.kind === 'fade') content.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: plan.transition.durationMs });
  }, [plan.sceneId, surface, occurrenceKey]);
  useEffect(() => { cancelRef.current(); }, [drawing, drawingTool]);
  useEffect(() => { const cancel = () => cancelRef.current(); window.addEventListener('blur', cancel); return () => window.removeEventListener('blur', cancel); }, []);
  const point = (event: { clientX: number; clientY: number }) => {
    const bounds = content.current?.getBoundingClientRect();
    return bounds && bounds.width > 0 && bounds.height > 0 ? { x: (event.clientX - bounds.left) * plan.frame.width / bounds.width, y: (event.clientY - bounds.top) * plan.frame.height / bounds.height } : null;
  };
  useEffect(() => {
    const node = host.current; if (!node || surface === 'present') return;
    const wheel = (event: WheelEvent) => {
      if (!onViewportChange) return;
      event.preventDefault(); event.stopPropagation();
      const position = point(event); if (position) onViewportChange(zoomAtPoint(plan.viewport, position, plan.viewport.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    };
    node.addEventListener('wheel', wheel, { passive: false }); return () => node.removeEventListener('wheel', wheel);
  }, [plan.viewport, plan.frame, surface, onViewportChange]);
  const begin = (event: React.PointerEvent, object: SceneObjectPlan, resize = false) => {
    if (drawing || !onGeometryChange || event.button !== 0 || surface === 'present' || (surface === 'teach' && (object.kind !== 'card' || resize))) return;
    const position = point(event); if (!position) return;
    event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).focus(); if (surface === 'edit' && (event.ctrlKey || event.metaKey || event.shiftKey)) { onSelectMany?.(selected.includes(object.id) ? selected.filter(id => id !== object.id) : [...selected, object.id]); suppressClick.current = true; return; }
    const ids = !resize && selected.includes(object.id) ? selected : [object.id];
    if (!selected.includes(object.id)) onSelect?.(object.id);
    group.current = plan.objects.filter(o => ids.includes(o.id)).map(o => ({ id: o.id, box: o.box })); suppressClick.current = true;
    host.current?.setPointerCapture(event.pointerId);
    gesture.current = { id: object.id, point: position, screen: { x: event.clientX, y: event.clientY }, original: object.box, box: object.box, resize, moved: false };
  };
  const eraseAt = (position: { x: number; y: number }) => {
    if (!erased.current) return;
    for (const item of plan.drawings) if ((!erasableStrokeIds || erasableStrokeIds.includes(item.id)) && strokeTouches(item, position, drawSize)) erased.current.add(item.id);
    setErasedIds([...erased.current]); onDrawingPreview?.({ erasedIds: [...erased.current] });
  };
  const move = (event: React.PointerEvent) => {
    if (pan.current) {
      const start = pan.current;
      onViewportChange?.({ zoom: start.viewport.zoom, pan: { x: Math.max(-40000, Math.min(40000, start.viewport.pan.x + (event.clientX - start.x) / start.scale)), y: Math.max(-40000, Math.min(40000, start.viewport.pan.y + (event.clientY - start.y) / start.scale)) } }); return;
    }
    const position = point(event); if (!position) return;
    if (marquee.current) { const { start, base } = marquee.current; setMarqueeBox({ x: Math.min(start.x, position.x), y: Math.min(start.y, position.y), width: Math.abs(start.x - position.x), height: Math.abs(start.y - position.y) }); onSelectMany?.([...new Set([...base, ...marqueeIds(plan.objects, start, position)])]); suppressClick.current = true; return; }
    if (erased.current) { eraseAt(position); return; }
    if (stroke.current) {
      const now = Date.now();
      stroke.current = { ...stroke.current, points: [...stroke.current.points, { ...position, t: now, ...(stroke.current.rainbow ? { h: (now / 8) % 360 } : {}) }] };
      setDrawDraft(stroke.current); onDrawingPreview?.({ stroke: stroke.current }); return;
    }
    const active = gesture.current; if (!active) return;
    if (!active.moved && Math.hypot(event.clientX - active.screen.x, event.clientY - active.screen.y) < 5) return;
    active.moved = true; suppressClick.current = true;
    const dx = position.x - active.point.x, dy = position.y - active.point.y;
    active.box = active.resize ? { ...active.original, width: Math.max(24, active.original.width + dx), height: Math.max(24, active.original.height + dy) }
      : { ...active.original, x: active.original.x + dx, y: active.original.y + dy };
    active.box = fitBox(active.box, plan.frame);
    setDraft({ id: active.id, box: active.box });
    if (!active.resize && surface === 'edit') { groupDraftRef.current = translateBoxes(group.current, dx, dy, plan.frame); setGroupDraft(groupDraftRef.current); }
    if (surface === 'teach') onGeometryChange?.(active.id, active.box);
  };
  const finish = (event: React.PointerEvent, commit: boolean) => {
    if (!commit) { cancelGesture(); if (host.current?.hasPointerCapture(event.pointerId)) host.current.releasePointerCapture(event.pointerId); return; }
    const active = gesture.current, drawn = stroke.current, removed = erased.current;
    const destination = active?.moved && !active.resize && surface === 'edit' ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-entry-id]')?.dataset.entryId : undefined;
    if (commit && drawn?.points.length) onDraw?.(drawn);
    if (commit && removed?.size) onErase?.([...removed]);
    if (active) {
      if (commit && active.moved) { if (destination && group.current.length === 1 && onCardDrop && plan.objects.find(item => item.id === active.id)?.kind === 'card') onCardDrop(active.id, destination); else if (!active.resize && surface === 'edit' && onGeometryChanges) onGeometryChanges(groupDraftRef.current); else onGeometryChange?.(active.id, active.box); }
      else if (commit && !active.moved && surface === 'teach') { onInteract?.(active.id); suppressClick.current = true; }
    }
    clear();
    if (host.current?.hasPointerCapture(event.pointerId)) host.current.releasePointerCapture(event.pointerId);
  };
  return <div ref={host} tabIndex={0} onKeyDown={event => { if (event.key === 'Escape' && (gesture.current || pan.current || stroke.current || erased.current || marquee.current)) { event.preventDefault(); event.stopPropagation(); cancelGesture(); } }} className="lesson-scene-surface" data-scene-surface={surface} data-scene-id={plan.sceneId}
    onPointerDownCapture={event => {
      if (surface === 'present') return;
      suppressClick.current = false;
      if (event.button === 1 && onViewportChange) {
        event.preventDefault(); event.stopPropagation();
        const bounds = content.current?.getBoundingClientRect(); if (!bounds?.width) return;
        clear(); host.current?.focus({ preventScroll: true }); pan.current = { x: event.clientX, y: event.clientY, scale: bounds.width / plan.frame.width / plan.viewport.zoom, viewport: plan.viewport };
        host.current?.setPointerCapture(event.pointerId);
      }
    }}
    onPointerMove={move} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)} onLostPointerCapture={cancelGesture}
    onAuxClick={event => { if (surface !== 'present' && event.button === 1) event.preventDefault(); }}
    onClickCapture={event => { if (suppressClick.current) { event.stopPropagation(); suppressClick.current = false; } }}
    onContextMenu={event => { if (surface === 'present' || !onContextMenu) return; event.preventDefault(); cancelGesture(); const id = (event.target as HTMLElement).closest<HTMLElement>('[data-scene-object]')?.dataset.sceneObject ?? null; if (!id || !selected.includes(id)) onSelect?.(id); onContextMenu({ x: event.clientX, y: event.clientY, objectId: id }); }}>
    <LogicalSceneFrame frame={plan.frame} transparent>
      <div ref={content} className="lesson-scene-content" style={{ background: plan.background.color,
        transform: `translate(${plan.viewport.pan.x}px, ${plan.viewport.pan.y}px) scale(${plan.viewport.zoom})`, transformOrigin: '0 0' }}
        onPointerDown={event => {
          if (surface === 'present' || event.button !== 0) return;
          if (drawing && onDraw) {
            const target = event.target as HTMLElement;
            if (target.closest('button, input, select, textarea, a, [role="button"], [contenteditable="true"]')) return;
            const video = target.closest<HTMLVideoElement>('video');
            if (video?.controls && event.clientY >= video.getBoundingClientRect().bottom - 42) return;
            const position = point(event); if (!position) return;
            event.preventDefault(); host.current?.focus({ preventScroll: true }); host.current?.setPointerCapture(event.pointerId);
            if (drawingTool === 'eraser') { erased.current = new Set(); eraseAt(position); }
            else { const now = Date.now(); stroke.current = { id: crypto.randomUUID(), size: drawSize, color: drawColor, opacity: drawingTool === 'highlighter' ? .3 : 1, rainbow: drawRainbow, ...(drawFadeMs > 0 ? { fadeMs: drawFadeMs } : {}), points: [{ ...position, t: now, ...(drawRainbow ? { h: (now / 8) % 360 } : {}) }] }; setDrawDraft(stroke.current); onDrawingPreview?.({ stroke: stroke.current }); }
          } else if (surface === 'edit' && !(event.target as HTMLElement).closest('[data-scene-object], video, button')) { const start = point(event); if (!start) return; event.preventDefault(); host.current?.focus(); host.current?.setPointerCapture(event.pointerId); const base = event.ctrlKey || event.metaKey || event.shiftKey ? selected : []; marquee.current = { start, base, original: selected }; onSelectMany?.(base); if (!onSelectMany) onSelect?.(null); }
        }}>
        <div className="lesson-scene-background" data-scene-background={plan.background.mediaType ?? 'color'}>
          {plan.background.mediaType === 'image' && plan.background.src && <SceneImageVisual src={plan.background.src} appearance={plan.background.imageAppearance} />}
          {plan.background.mediaType === 'video' && (video ?? (surface === 'edit' && plan.background.src ? <EditSceneVideo key={plan.background.src} src={plan.background.src} interactive trim={plan.background.videoTrim} /> : null))}
        </div>
        {plan.objects.map((object, index) => {
          const box = groupDraft.find(o => o.id === object.id)?.box ?? (draft?.id === object.id ? draft.box : object.box);
          const active = surface === 'edit' && selected.includes(object.id);
          const delayed=bubbleHidden(object);
          return <div key={object.id} data-scene-object={object.id} data-scene-kind={object.kind} data-selected={active} className="lesson-scene-object"
            aria-hidden={delayed||undefined} data-delayed={delayed} style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: index + 1, visibility:delayed?'hidden':undefined }}>
            <ObjectVisual key={object.kind === 'video' ? `${plan.sceneId}:${occurrenceKey ?? ''}:${surface}` : object.id} object={{ ...object, box }} interactiveMedia={interactiveMedia} />
            {surface !== 'present' && (!drawing || object.kind === 'card') && (object.kind !== 'video' || surface === 'edit') && <div className={`lesson-object-hit${active ? ' is-selected' : ''}`} role="button" tabIndex={0}
              style={object.kind === 'video' ? { bottom: 42 } : undefined} aria-label={`${surface === 'edit' ? 'Select' : 'Interact with'} ${object.kind}`} onPointerDown={event => { if (drawing) { event.stopPropagation(); return; } begin(event, object); }}
              onClick={() => { onSelect?.(object.id); if (surface === 'teach') onInteract?.(object.id); }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(object.id); if (surface === 'teach') onInteract?.(object.id); } }}>
              {!drawing && active && selected.length === 1 && onGeometryChange && <ResizeHandle zoom={plan.viewport.zoom} offsetY={object.kind === 'video' ? 42 : 0} onPointerDown={event => begin(event, object, true)} />}
            </div>}
          </div>;
        })}
        {marqueeBox && <div data-scene-marquee="true" style={{ position: 'absolute', ...{ left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.width, height: marqueeBox.height }, border: '2px solid #52a8ff', background: '#52a8ff22', zIndex: 25000, pointerEvents: 'none' }} />}
        <PassiveDrawings frame={plan.frame} markers={normalizedSceneDrawings([...plan.drawings.filter(item => !erasedIds.includes(item.id)), ...(drawDraft ? [drawDraft] : [])], plan.frame)} />
      </div>
      {plan.rewards && <div data-lesson-rewards="true" style={{ position: 'absolute', inset: 0, zIndex: 30000, pointerEvents: 'none' }}><RewardScene presentation={plan.rewards} /></div>}
    </LogicalSceneFrame>
  </div>;
}
