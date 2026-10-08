import React, { useEffect, useState } from 'react';
import type { ActivityScene as Scene, BreakVisual } from '../shared/activityScene';
import { timerSeconds } from '../shared/cardRuntime';
import { ACardStageRenderer } from './acards/ACardStageRenderer';
import { BCardInstanceLayer } from './acards/BCardInstanceLayer';
import './breakScene.css';
export function BreakScene({ scene: s }: { scene: BreakVisual }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (!s.timer || !s.anchor.isRunning) return; const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, [s.timer, s.anchor.isRunning]);
  const seconds = timerSeconds(s.anchor, now, s.timerMode, s.timerDuration);
  const transform = s.bgTransform;
  const background: React.CSSProperties = { background: s.background || '#111', backgroundRepeat: 'no-repeat', backgroundSize: transform ? `${transform.scale * 100}%` : 'cover', backgroundPosition: transform ? `calc(50% + ${transform.x}px) calc(50% + ${transform.y}px)` : 'center' };
  return <div className="break-stage" style={{ ...background, width: 1920, height: 1080, ...(transform?.blur && s.background?.startsWith('url') ? { background: 'transparent' } : {}) }}>
    {!!transform?.blur && s.background?.startsWith('url') && <div style={{ ...background, position: 'absolute', zIndex: -1, inset: -100, filter: `blur(${transform.blur}px)` }} />}
    <div className="break-thumbnails-grid">{s.thumbnails.map(t => <div key={t.id} style={{ position: 'relative', width: t.width*t.scale, height: t.width*.5625*t.scale, transform: `translate(${t.x}px, ${t.y}px)`, borderRadius: 8 }}><img alt="" className="break-stage-thumb" src={t.src} style={{ objectFit: t.fit as 'contain' | 'cover', width: '100%', height: '100%' }} /></div>)}</div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center', justifyContent: s.position === 'top' ? 'flex-start' : s.position === 'bottom' ? 'flex-end' : 'center', width: '100%', padding: 40, fontFamily: s.font, color: s.textColor || '#fff', flex: 1 }}>
      <div className="break-title" style={{ fontSize: s.titleFontSize ? `${s.titleFontSize}px` : '2.5rem' }}>{s.title}</div>
      <div className="break-questions" style={{ fontSize: s.fontSize, fontWeight: s.isBold ? 'bold' : 'normal', fontStyle: s.isItalic ? 'italic' : 'normal' }}>{s.questions}</div>
      {s.timer && <div className="break-timer" style={{ fontSize: s.timerSize ? `${s.timerSize}rem` : '4rem' }}>{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</div>}
    </div>
  </div>;
}
export function PassiveActivities({ scene }: { scene: Scene }) {
  const resolveImageUrl = (id: string) => scene.images[id] ?? null;
  return <>{scene.break && <BreakScene scene={scene.break} />}
    {scene.boards.map(b => <div key={b.key} style={{ position: 'absolute', inset: 0, zIndex: 34, pointerEvents: 'none' }}><ACardStageRenderer aCardId={b.card.id} card={b.card} cards={scene.cards} teachStates={b.states} startedAt={b.startedAt} movementAnimation={b.movement} passive resolveImageUrl={resolveImageUrl} /></div>)}
    {scene.overlays && <BCardInstanceLayer instances={scene.overlays.instances} cards={scene.cards} teachStates={scene.overlays.states} passive mode="teach" resolveImageUrl={resolveImageUrl} />}
  </>;
}
