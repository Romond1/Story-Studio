import type {ReactNode} from 'react';
import { WheelQuestionMedia } from './WheelQuestionMedia';
import { useEffect, useState } from 'react';
import { GameEffects } from '../gameEffects/GameEffects';
import { useWheelMotion } from './useWheelMotion';
import type { WheelPresentation } from '../../shared/lesson/wheelPresentation';
import { WHEEL_CARD_FRAME } from '../../shared/lesson/wheelPresentation';
import { LogicalSceneFrame } from '../StaticScene';
import { CardV2Scene } from '../cardsV2/CardV2Scene';
import { WheelGraphic } from './WheelGraphic';
import { MagicHatStage } from './MagicHatStage';
import { MysteryCardsStage } from './MysteryCardsStage';
import './wheelRuntime.css';
import { RewardScene } from '../RewardScene';
import type { RewardPresentation } from '../../shared/rewardPresentation';

function GameFrame({inScene,frame,children}:{inScene:boolean;frame:{width:number;height:number};children:ReactNode}) {return inScene?<>{children}</>:<LogicalSceneFrame frame={frame}>{children}</LogicalSceneFrame>;}

/** Both Teach preview and Present consume this public plan without running a session. */
export function WheelScene({ plan, frame, rewards, audibleMedia = true, onCardSelect, onQuestionFlip, inScene=false }: { onQuestionFlip?:()=>void; inScene?:boolean; onCardSelect?:(index:number)=>void; audibleMedia?:boolean; plan: WheelPresentation; frame: { width: number; height: number }; rewards?: RewardPresentation }) {
  const gameType = plan.gameType ?? 'spinning-wheel';
  const isHat = gameType === 'magic-hat', isCards = gameType === 'mystery-cards';
  const selectedIndex = plan.segments.findIndex(s=>s.id===plan.selectedSegmentId);
  const restingDegrees = plan.rotationDegrees ?? (selectedIndex < 0 ? 0 : -(selectedIndex+.5)*360/plan.segments.length);
  const {rotor,moving} = useWheelMotion(plan.spin,restingDegrees,plan.segments.length);
  const [revealedEffect,setRevealedEffect]=useState<string>();
  const surprise=plan.activity?.kind==='event' && plan.effect && ['portal','chest','sprite'].includes(plan.effect.kind) ? plan.effect : undefined;
  const suspense=!!surprise && revealedEffect!==surprise.id && Date.now()<surprise.startedAt+850 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(()=>{if(!surprise)return;const timer=window.setTimeout(()=>setRevealedEffect(surprise.id),Math.max(0,surprise.startedAt+850-Date.now()));return()=>window.clearTimeout(timer);},[surprise?.id]);
  const phaseTitle = moving ? isHat ? 'Revealing the magic…' : isCards ? 'Turning the chosen card…' : 'Spinning…' : suspense ? 'Something magical is coming…' : plan.blocked ? 'Ask your teacher to check this game' : {
    ready: 'Ready to play', selecting: 'Choosing the next activity', revealed: 'Activity selected', active: plan.activity?.kind === 'event' ? 'Event' : 'Question',
    'activity-complete': 'Activity complete', 'session-complete': 'Game complete',
  }[plan.phase];
  return <div className="wheel-scene-host" data-game-type={gameType} data-wheel-motion={moving ? 'spinning' : 'landed'} data-wheel-phase={plan.phase} data-wheel-progress={plan.consumed} data-wheel-selected={plan.selectedSegmentId ?? ''}>
    <GameFrame inScene={inScene} frame={frame}>
      <div className="wheel-live" style={{ width: frame.width, height: frame.height, fontSize: Math.min(frame.width / 40, frame.height / 22) }}>
        <div className="wheel-ambient" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,top:`${(i*23)%100}%`,animationDelay:`${-i*.7}s`}}/>)}</div>
        <header><h1><span className="wheel-game-kicker">{isHat ? 'The conjurer’s atelier' : isCards ? 'The veiled archive' : 'The enchanted wheel'}</span>{plan.title}</h1><div className="wheel-hud"><p>{plan.consumed} of {plan.playCount} activities{plan.skipped ? ` · ${plan.skipped} skipped` : ''}</p></div></header>
        <div className="wheel-live-body" style={{ gridTemplateColumns: frame.width / frame.height < 1.1 ? '1fr' : '45% minmax(0, 1fr)', gridTemplateRows: frame.width / frame.height < 1.1 ? '40% minmax(0, 1fr)' : undefined }}>
          <div className="wheel-dial">{isHat ? <MagicHatStage reveal={plan.reveal} phase={plan.phase}/> : isCards ? <MysteryCardsStage reveal={plan.reveal} phase={plan.blocked || moving ? 'unavailable' : plan.phase} slots={plan.slots ?? []} shuffle={plan.shuffle} onSelect={onCardSelect}/> : <svg viewBox="0 80 720 620" width="100%" height="100%" role="img" aria-label={!moving && plan.selectedSegmentId ? `Selected: ${plan.segments.find(s => s.id === plan.selectedSegmentId)?.label ?? 'Activity'}` : 'Spinning Wheel'}><WheelGraphic segments={plan.segments} selectedSegmentId={plan.selectedSegmentId} rotor={rotor} rotationDegrees={restingDegrees} moving={moving} /></svg>}</div>
          <section className={`wheel-result${plan.activity?.kind === 'event' ? ' wheel-event-result' : ''}`} aria-label="Current activity">
            {(!plan.activity || moving || suspense) && <span className="wheel-idle-symbol" aria-hidden="true">{moving?'✧':suspense?'◇':'✦'}</span>}
            <h2 role="status" aria-live="polite">{phaseTitle}</h2>
            {!moving && !suspense && !plan.blocked && plan.activity && plan.activity.label!==plan.activity.prompt && !(plan.phase==='active' && plan.activity.card) && <h3>{plan.activity.label}</h3>}
            {!moving && !plan.blocked && plan.phase === 'revealed' && <p>Your teacher will show the activity.</p>}
            {!moving && !plan.blocked && plan.phase==='active' && plan.activity?.kind==='question' && <>
              {!plan.activity.card && plan.activity.prompt && <p className="wheel-question-prompt">{plan.activity.prompt}</p>}
              <div className={`wheel-content-grid${plan.activity.card && plan.activity.media?' wheel-content-split':''}`}>
                {plan.activity.card && <div className="wheel-question" role={onQuestionFlip?"button":undefined} tabIndex={onQuestionFlip?0:undefined} aria-label={onQuestionFlip?"Flip question card":undefined} onClick={e=>{if(e.detail<=1)onQuestionFlip?.();}} onKeyDown={e=>{if(!e.repeat&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onQuestionFlip?.();}}}><div className="wheel-card-flip" key={plan.activity.card.faceId}><CardV2Scene plan={{engine:'card-v2',version:1,frame:WHEEL_CARD_FRAME,cards:[plan.activity.card]}}/></div></div>}
                {plan.activity.media && <WheelQuestionMedia media={plan.activity.media} audible={audibleMedia}/>}
              </div>
            </>}
            {!moving && !suspense && !plan.blocked && plan.phase === 'active' && plan.activity?.kind === 'event' && <p className="wheel-student-event">{plan.activity.studentText || 'Follow your teacher’s instructions.'}</p>}
            {plan.phase === 'activity-complete' && <p>Ready for the next activity.</p>}
            {plan.phase === 'session-complete' && <p>Thank you for playing.</p>}
          </section>
        </div>
        <div className="wheel-progress" role="progressbar" aria-label="Game progress" aria-valuemin={0} aria-valuemax={plan.playCount} aria-valuenow={plan.consumed}><span style={{ width: `${plan.consumed / plan.playCount * 100}%` }} /></div>
      </div>
      <GameEffects cue={plan.effect} frame={frame}/>
      {rewards && <div data-lesson-rewards="true" style={{ position: 'absolute', inset: 0, zIndex: 30000, pointerEvents: 'none' }}><RewardScene presentation={rewards} /></div>}
    </GameFrame>
  </div>;
}
