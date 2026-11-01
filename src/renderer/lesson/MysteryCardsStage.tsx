import { useEffect, useId, useRef } from 'react';
import type { GameReveal, GameShuffle, MysterySlot } from '../../shared/lesson/gameStage';
import './mysteryCardsStage.css';

export interface MysteryCardsStageProps {
 reveal?: GameReveal;
 phase: string;
 slots: MysterySlot[];
 shuffle?: GameShuffle;
 onSelect?: (index: number) => void;
}

/** A passive, clock-seekable view. Slot identities and outcomes belong to the runtime. */
export function MysteryCardsStage({ reveal, phase, slots, shuffle, onSelect }: MysteryCardsStageProps) {
 const uid = useId().replace(/:/g, '');
 const root = useRef<SVGSVGElement>(null);
 const paint = (name: string) => `url(#${uid}-${name})`;
 const count = slots.length;
 const scale = count >= 5 ? .8 : count === 4 ? 1 : 1.12;
 const pitch = count >= 5 ? 132 : count === 4 ? 170 : 210;
 useEffect(() => {
  const svg = root.current;
  if (!svg) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const tick = () => {
   const now = Date.now();
   const progress = (event: GameReveal | GameShuffle | undefined) => event ? Math.max(0, Math.min(1, (now - event.startedAt) / Math.max(1, event.durationMs))) : 0;
   const rp = progress(reveal), sp = progress(shuffle);
   svg.querySelectorAll<SVGGElement>('[data-card-motion]').forEach((node, i) => {
    const slot = slots[i];
    const chosen = reveal ? (reveal.selectedIndex === undefined ? slot.selected : slot.index === reveal.selectedIndex) : slot.selected;
    const t = reduced.matches ? (rp > 0 ? 1 : 0) : rp;
    const lift = chosen && reveal ? Math.sin(Math.min(1, t / .38) * Math.PI / 2) : 0;
    const flip = chosen && reveal ? Math.max(0, Math.min(1, (t - .3) / .42)) : 0;
    const sway = shuffle && sp > 0 && sp < 1 && !reduced.matches ? Math.sin(sp * Math.PI * 6 + i * .8) * Math.sin(sp * Math.PI) : 0;
    node.setAttribute('transform', `translate(${sway * 5} ${-lift * 24 + sway * 12}) rotate(${sway * 5}) scale(${(1 + lift * .1) * Math.max(.025, Math.abs(Math.cos(flip * Math.PI)))} ${1 + lift * .1})`);
    node.querySelector('[data-card-back]')?.setAttribute('display', flip > .5 ? 'none' : 'inline');
    node.querySelector('[data-card-front]')?.setAttribute('display', flip > .5 ? 'inline' : 'none');
   });
   if ((reveal && rp < 1) || (shuffle && sp < 1)) frame = requestAnimationFrame(tick);
  };
  tick();
  const refresh = () => { cancelAnimationFrame(frame); tick(); };
  reduced.addEventListener('change', refresh);
  return () => { cancelAnimationFrame(frame); reduced.removeEventListener('change', refresh); };
 }, [reveal, shuffle, slots]);
 return <svg ref={root} className="mystery-cards-stage" viewBox="0 0 720 620" width="100%" height="100%" aria-label="Mystery cards">
  <defs>
   <linearGradient id={`${uid}-gold`} x2=".8" y2="1"><stop stopColor="#fff2c1"/><stop offset=".28" stopColor="#d2a45c"/><stop offset=".5" stopColor="#73502d"/><stop offset=".7" stopColor="#f5d28d"/><stop offset="1" stopColor="#a2733f"/></linearGradient>
   <linearGradient id={`${uid}-velvet`} x2="1" y2="1"><stop stopColor="#314f68"/><stop offset=".5" stopColor="#173843"/><stop offset="1" stopColor="#362341"/></linearGradient>
   <radialGradient id={`${uid}-light`}><stop stopColor="#9adbd7" stopOpacity=".2"/><stop offset="1" stopColor="#81b8d8" stopOpacity="0"/></radialGradient>
   <linearGradient id={`${uid}-face`} x2=".4" y2="1"><stop stopColor="#f6e8ba"/><stop offset="1" stopColor="#bca373"/></linearGradient>
  </defs>
  <ellipse cx="360" cy="320" rx="350" ry="245" fill={paint('light')}/>
  <g fill="none" stroke="#cba765" className="mystery-observatory" aria-hidden="true">
   <ellipse cx="360" cy="375" rx="319" ry="156"/>
   <ellipse cx="360" cy="375" rx="294" ry="137"/>
   <path d="M70 375H650M360 219V531M148 271L572 479M148 479L572 271" strokeOpacity=".3"/>
   <path d="M225 126H330L360 107L390 126H495M225 548H330L360 567L390 548H495"/>
   <path d="M360 77V96M350 86H370M360 578V593M353 585H367"/>
  </g>
  <text x="360" y="169" className="mystery-inscription" textAnchor="middle">THE VEILED ARCHIVE</text>
  <g aria-hidden="true" fill="#e8cb8b" className="mystery-stars"><path d="M108 195l3 9 9 3-9 3-3 9-3-9-9-3 9-3ZM610 462l3 9 9 3-9 3-3 9-3-9-9-3 9-3Z"/><circle cx="577" cy="191" r="2"/><circle cx="153" cy="490" r="2"/></g>
  {slots.map((slot, position) => {
   const interactive = phase === 'selecting' && !!onSelect && !slot.used;
   const x = 360 + (position - (count - 1) / 2) * pitch;
   return <g key={slot.id} transform={`translate(${x} 331) scale(${scale})`}>
    <ellipse cx="0" cy="145" rx="65" ry="12" fill="#070b1c" opacity=".45"/>
    <g data-card-motion="" className={`mystery-card-motion${slot.selected ? ' is-selected' : ''}${slot.used ? ' is-used' : ''}`}>
     <g className={`mystery-card${interactive ? ' is-interactive' : ''}`} role={interactive ? 'button' : 'img'} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `Choose card ${slot.index + 1}` : `Card ${slot.index + 1}${slot.used ? ', used' : slot.selected ? ', selected' : ''}`} onClick={interactive ? () => onSelect?.(slot.index) : undefined} onKeyDown={interactive ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) onSelect?.(slot.index); } } : undefined}>
      <rect className="mystery-card-halo" x="-76" y="-127" width="152" height="254" rx="15" fill="none" stroke="#b7f6e9" strokeWidth="3"/>
      <rect x="-68" y="-114" width="140" height="240" rx="12" fill="#090e21" stroke="#705134" strokeWidth="3"/>
      <rect x="-70" y="-120" width="140" height="240" rx="12" fill={paint('gold')} stroke="#f7dca5"/>
      <g data-card-back="">
       <rect x="-64" y="-114" width="128" height="228" rx="8" fill={paint('velvet')}/>
       <path d="M-54-83L-32-104H32L54-83V83L32 104H-32L-54 83Z" fill="none" stroke="#d8b775" strokeWidth="1.5"/>
       <path d="M-47-73L0-99L47-73V73L0 99L-47 73Z" fill="none" stroke="#b6d2bd" strokeOpacity=".35"/>
       {[-1, 1].map(sign => <g key={sign} transform={`scale(1 ${sign})`} fill="none" stroke="#d9bb7d"><path d="M-51-96q18 0 18 19M51-96q-18 0-18 19M-12-83L0-92L12-83M-8-70L0-75L8-70"/><circle cy="-102" r="2" fill="#e9d5a0"/></g>)}
       <circle r="43" fill="#101e34" stroke={paint('gold')} strokeWidth="3"/>
       <circle r="35" fill="none" stroke="#81b9ba" strokeDasharray="1 6"/>
       <path d="M0-43L13-13L43 0L13 13L0 43L-13 13L-43 0L-13-13Z" fill={paint('gold')}/>
       <path d="M0-27L15 0L0 27L-15 0Z" fill="#46888b" stroke="#c7f4e2"/>
       <path d="M0-17L7 0L0 17L-7 0Z" fill="#bdeee2"/>
      </g>
      <g data-card-front="" display="none" aria-hidden="true">
       <rect x="-64" y="-114" width="128" height="228" rx="8" fill={paint('face')}/>
       <path d="M-52-86L-29-103H29L52-86V86L29 103H-29L-52 86Z" fill="none" stroke="#765a3f"/>
       <circle r="38" fill="#233f50" stroke="#947342" strokeWidth="3"/>
       <path d="M0-58L13-15L45 0L13 15L0 58L-13 15L-45 0L-13-15Z" fill={paint('gold')} stroke="#725235"/>
       <circle r="9" fill="#d8fff0" stroke="#358584" strokeWidth="3"/>
      </g>
      {slot.used && <g className="mystery-used-seal" aria-hidden="true"><circle cy="79" r="14" fill="#152c37" stroke="#b9a472"/><path d="M-6 79l4 5 9-10" fill="none" stroke="#d9c38c" strokeWidth="2"/></g>}
     </g>
    </g>
    <g aria-hidden="true"><path d="M-23 161L0 148L23 161L0 174Z" fill="#18233b" stroke="#b69b65"/><text y="167" textAnchor="middle" className="mystery-card-number">{slot.index + 1}</text></g>
   </g>;
  })}
 </svg>;
}
