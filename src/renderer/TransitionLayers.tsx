import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { SceneTransitionEvent } from '../shared/sceneTransition';
import { transitionTiming } from '../shared/sceneTransition';
import { PassiveImage, PassiveOverlays } from './StaticScene';
import './transitions.css';

/** Mount timing only seeks Core's event; no navigation, audio, or event completion commands. */
export function TransitionLayers({ event, heightFraction = 1, children }: { event?: SceneTransitionEvent | null; heightFraction?: number; children: ReactNode }) {
  const layerIdentity = useRef('initial');
  if (event) layerIdentity.current = event.id;
  return <TransitionInstance key={layerIdentity.current} event={event} heightFraction={heightFraction}>{children}</TransitionInstance>;
}
function TransitionInstance({ event, heightFraction, children }: { event?: SceneTransitionEvent | null; heightFraction: number; children: ReactNode }) {
  const [timing] = useState(() => event ? transitionTiming(event, Date.now()) : null);
  const [finished, finish] = useState(timing?.settled ?? true);
  useEffect(() => {
    if (!timing || timing.settled) return;
    const timer = window.setTimeout(() => finish(true), timing.remainingMs);
    return () => clearTimeout(timer);
  }, []);
  const active = event && !finished;
  const direction = active && event.kind === 'card-slide' ? `card-slide-${event.direction}` : event?.kind;
  const layerStyle = (incoming: boolean, fraction: number): CSSProperties => ({
    position: 'absolute', left: 0, top: 0, width: '100%', height: `${fraction * 100}%`, overflow: 'hidden',
    ...(active ? { '--transition-duration': `${event.durationMs}ms`, animationDelay: `${(incoming && event.kind === 'fade-black' ? event.durationMs * 0.2 : 0) - (timing?.elapsedMs ?? 0)}ms` } : {}),
  } as CSSProperties);
  const oldScene = event?.from.scene;
  return <>
    {active && <div data-transition-outgoing={event.id} className={`transition-${direction}-out`} style={layerStyle(false, oldScene?.imageHeightFraction ?? 1)}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${oldScene?.viewport?.pan.x ?? 0}px, ${oldScene?.viewport?.pan.y ?? 0}px) scale(${oldScene?.viewport?.zoom ?? 1})` }}>
        <PassiveImage src={event.from.src} adjustments={oldScene?.adjustments} />
        <PassiveOverlays overlays={oldScene?.overlays ?? []} />
      </div>
    </div>}
    <div data-transition-incoming={active ? event.id : undefined} className={active ? `transition-${direction}-in` : undefined} style={layerStyle(true, heightFraction)}>{children}</div>
  </>;
}
