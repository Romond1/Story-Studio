import React, { useEffect, useRef, useState } from 'react';
import type { ScenePlan, SceneObjectPlan } from '../../shared/lesson/projection';
import type { Rect } from '../../shared/lesson/model';
import type { MarkerStroke } from '../../shared/types';
import { CardV2Scene } from '../cardsV2/CardV2Scene';
import { LogicalSceneFrame, PassiveDrawings } from '../StaticScene';
import { RewardScene } from '../RewardScene';
import { BUBBLE_LIBRARY } from '../../shared/bubbleDefs';
import './SceneSurface.css';

export interface SceneSurfaceProps {
  plan: ScenePlan; surface: 'edit' | 'teach' | 'present'; selectedObjectId?: string | null;
  onSelect?: (id: string | null) => void; onGeometryChange?: (id: string, box: Rect) => void;
  onInteract?: (id: string) => void; video?: React.ReactNode;
  drawing?: boolean; onDraw?: (stroke: MarkerStroke) => void; drawColor?: string; drawSize?: number;
}

/** The new document stores scene units; the retained drawing leaf expects unit fractions. */
export function normalizedSceneDrawings(strokes: MarkerStroke[], frame: ScenePlan['frame']): MarkerStroke[] {
  return strokes.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ ...point, x: point.x / frame.width, y: point.y / frame.height })) }));
}

export function EditSceneVideo({ src, interactive = true }: { src: string; interactive?: boolean }) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => { const video = element.current; if (!video) return; video.muted = true; return () => { video.pause(); }; }, [src]);
  return <video ref={element} src={src} controls={interactive} muted playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noremoteplayback"
    aria-label="Edit video preview" data-edit-video-preview="true" style={{ pointerEvents: interactive ? 'auto' : 'none' }}
    onPointerDown={event => { if (interactive) event.stopPropagation(); }} onPointerUp={event => { if (interactive) event.stopPropagation(); }}
    onVolumeChange={event => { if (!event.currentTarget.muted) event.currentTarget.muted = true; }} />;
}

/** Built-in bubbles are vectors, so the same complete shape renders without placeholder image files. */
export function SceneBubble({ object }: { object: Extract<SceneObjectPlan, { kind: 'text' | 'bubble' }> }) {
  const definition = BUBBLE_LIBRARY.find(item => item.bubbleDefId === object.bubbleDefId) ?? BUBBLE_LIBRARY[0];
  const variant = definition.bubbleDefId === 'BD_THOUGHT' ? 'thought' : definition.bubbleDefId === 'BD_SHOUT' ? 'shout' : 'speech';
  const rect = definition.textRect ?? { x: .1, y: .1, width: .8, height: .6 };
  return <div className="lesson-vector-bubble" data-bubble-shape={variant}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
      <g fill="#ffffff" stroke="#263448" strokeWidth="1.2" strokeLinejoin="round">
        {variant === 'speech' ? <path d="M 13 4 H 87 Q 98 4 98 16 V 64 Q 98 77 85 77 H 42 L 22 96 L 26 77 H 13 Q 2 77 2 64 V 17 Q 2 4 13 4 Z" />
          : variant === 'thought' ? <><path d="M 16 16 C 12 2 34 0 39 9 C 48 -1 65 1 69 10 C 83 0 96 12 91 24 C 104 31 99 49 91 51 C 103 65 90 79 77 74 C 65 88 53 81 48 76 C 34 87 20 78 20 71 C 3 76 -2 55 7 48 C -4 36 2 19 16 16 Z" /><ellipse cx="23" cy="87" rx="6" ry="5" /><ellipse cx="14" cy="96" rx="3" ry="2.5" /></>
            : <path d="M 50 2 L 58 15 L 76 5 L 75 22 L 94 16 L 86 34 L 99 42 L 88 53 L 97 68 L 79 69 L 82 89 L 63 80 L 53 98 L 44 82 L 25 94 L 25 75 L 5 80 L 14 61 L 1 51 L 14 39 L 4 22 L 23 25 L 24 7 L 41 17 Z" />}
      </g>
    </svg>
    <div style={{ position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`,
      display: 'flex', alignItems: 'center', justifyContent: object.align === 'left' ? 'flex-start' : object.align === 'right' ? 'flex-end' : 'center',
      fontSize: object.fontSize, lineHeight: 1.2, color: object.color, textAlign: object.align, whiteSpace: 'pre-wrap', overflow: 'hidden', overflowWrap: 'anywhere' }}>{object.text}</div>
  </div>;
}

function ObjectVisual({ object }: { object: SceneObjectPlan }) {
  if (object.kind === 'card') return <CardV2Scene plan={{ engine: 'card-v2', version: 1,
    frame: { width: object.box.width, height: object.box.height }, cards: [{ ...object.card, box: { ...object.box, x: 0, y: 0 } }] }} />;
  if (object.kind === 'image') return <img src={object.src} draggable={false} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
  if (object.kind === 'bubble') return <SceneBubble object={object} />;
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: object.align === 'left' ? 'flex-start' : object.align === 'right' ? 'flex-end' : 'center',
    fontSize: object.fontSize, color: object.color, textAlign: object.align, whiteSpace: 'pre-wrap', overflow: 'hidden', overflowWrap: 'anywhere' }}>{object.text}</div>;
}

/** All surfaces use this composition. Interactions never choose a different renderer or coordinate frame. */
export function SceneSurface({ plan, surface, selectedObjectId, onSelect, onGeometryChange, onInteract, video,
  drawing = false, onDraw, drawColor = '#ffcc33', drawSize = 6 }: SceneSurfaceProps) {
  const content = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: string; point: { x: number; y: number }; original: Rect; box: Rect; resize: boolean }>();
  const [draft, setDraft] = useState<{ id: string; box: Rect } | null>(null);
  const stroke = useRef<MarkerStroke>();
  const [drawDraft, setDrawDraft] = useState<MarkerStroke | null>(null);
  useEffect(() => {
    gesture.current = undefined; stroke.current = undefined; setDraft(null); setDrawDraft(null);
    if (surface !== 'edit' && plan.transition.kind === 'fade') content.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: plan.transition.durationMs });
  }, [plan.sceneId, surface]);
  const point = (event: React.PointerEvent) => {
    const bounds = content.current?.getBoundingClientRect();
    return bounds && bounds.width > 0 && bounds.height > 0 ? { x: (event.clientX - bounds.left) * plan.frame.width / bounds.width, y: (event.clientY - bounds.top) * plan.frame.height / bounds.height } : null;
  };
  const begin = (event: React.PointerEvent, object: SceneObjectPlan, resize = false) => {
    if (surface !== 'edit' || !onGeometryChange || event.button !== 0) return;
    const position = point(event); if (!position) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(object.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: object.id, point: position, original: object.box, box: object.box, resize };
  };
  const move = (event: React.PointerEvent) => {
    const position = point(event); if (!position) return;
    if (stroke.current) {
      stroke.current = { ...stroke.current, points: [...stroke.current.points, { ...position, t: Date.now() }] };
      setDrawDraft(stroke.current); return;
    }
    const active = gesture.current; if (!active) return;
    const dx = position.x - active.point.x, dy = position.y - active.point.y;
    active.box = active.resize ? { ...active.original, width: Math.max(24, active.original.width + dx), height: Math.max(24, active.original.height + dy) }
      : { ...active.original, x: active.original.x + dx, y: active.original.y + dy };
    setDraft({ id: active.id, box: active.box });
  };
  const finish = (event: React.PointerEvent, commit: boolean) => {
    const active = gesture.current, drawn = stroke.current;
    gesture.current = undefined; stroke.current = undefined; setDraft(null); setDrawDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (commit && drawn?.points.length) onDraw?.(drawn);
    if (commit && active && JSON.stringify(active.box) !== JSON.stringify(active.original)) onGeometryChange?.(active.id, active.box);
  };
  return <div className="lesson-scene-surface" data-scene-surface={surface} data-scene-id={plan.sceneId}>
    <LogicalSceneFrame frame={plan.frame} transparent>
      <div ref={content} className="lesson-scene-content" style={{ background: plan.background.color,
        transform: `translate(${plan.viewport.pan.x}px, ${plan.viewport.pan.y}px) scale(${plan.viewport.zoom})`, transformOrigin: '0 0' }}
        onPointerMove={move} onPointerUp={event => finish(event, true)} onPointerCancel={event => finish(event, false)}
        onLostPointerCapture={() => { gesture.current = undefined; stroke.current = undefined; setDraft(null); setDrawDraft(null); }}
        onPointerDown={event => {
          if (surface === 'present') return;
          if (drawing && onDraw && event.button === 0) {
            const position = point(event); if (!position) return;
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            stroke.current = { id: crypto.randomUUID(), size: drawSize, color: drawColor, opacity: 1, rainbow: false, points: [{ ...position, t: Date.now() }] };
            setDrawDraft(stroke.current);
          } else if (event.target === event.currentTarget) onSelect?.(null);
        }}>
        <div className="lesson-scene-background" data-scene-background={plan.background.mediaType ?? 'color'}>
          {plan.background.mediaType === 'image' && plan.background.src && <img src={plan.background.src} alt="" draggable={false} />}
          {plan.background.mediaType === 'video' && (video ?? (surface === 'edit' && plan.background.src ? <EditSceneVideo key={plan.background.src} src={plan.background.src} interactive={!drawing} /> : null))}
        </div>
        {plan.objects.map((object, index) => {
          const box = draft?.id === object.id ? draft.box : object.box;
          const active = surface === 'edit' && selectedObjectId === object.id;
          return <div key={object.id} data-scene-object={object.id} data-scene-kind={object.kind} className="lesson-scene-object"
            style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: index + 1 }}>
            <ObjectVisual object={{ ...object, box }} />
            {surface !== 'present' && !drawing && <div className={`lesson-object-hit${active ? ' is-selected' : ''}`} role="button" tabIndex={0}
              aria-label={`${surface === 'edit' ? 'Select' : 'Interact with'} ${object.kind}`} onPointerDown={event => begin(event, object)}
              onClick={() => { onSelect?.(object.id); if (surface === 'teach') onInteract?.(object.id); }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(object.id); if (surface === 'teach') onInteract?.(object.id); } }}>
              {active && onGeometryChange && <button className="lesson-object-resize" aria-label="Resize object" onPointerDown={event => begin(event, object, true)} />}
            </div>}
          </div>;
        })}
        <PassiveDrawings frame={plan.frame} markers={normalizedSceneDrawings([...plan.drawings, ...(drawDraft ? [drawDraft] : [])], plan.frame)} />
      </div>
      {plan.rewards && <div data-lesson-rewards="true" style={{ position: 'absolute', inset: 0, zIndex: 30000, pointerEvents: 'none' }}><RewardScene presentation={plan.rewards} /></div>}
    </LogicalSceneFrame>
  </div>;
}
