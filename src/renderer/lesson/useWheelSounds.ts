import type { GameEffectCue } from '../../shared/gameEffects';
import { useEffect, useRef } from 'react';
import type { WheelSpin } from '../../shared/lesson/wheelAnimation';
import { sampleWheelSpin } from '../../shared/lesson/wheelAnimation';
import { audioController } from '../audio/AudioController';
/** Teach owns audio. Reconnecting Present never plays duplicate cues. No assets or frame IPC. */
export function useWheelSounds(spin: WheelSpin | undefined, count: number, enabled: boolean) {
 const seen = useRef(new Set<string>());
 useEffect(()=>{
   if(!spin || !enabled || seen.current.has(spin.id)) return;
   seen.current.add(spin.id);
   // Navigation/reload resumes visuals silently instead of replaying historical sound.
   if(Date.now()-spin.startedAt > 350 || Date.now() < spin.startedAt) return;
   let frame=0,lastTick=0,lastSlot=-1,slowing=false;
   const cue=(name:Parameters<typeof audioController.playWheelCue>[0])=>{ try { audioController.playWheelCue(name); } catch { /* Sound is optional. */ } };
   cue('start');
   const draw=()=>{
     const now=Date.now(), sample=sampleWheelSpin(spin,now);
     const slot=Math.floor(sample.degrees/(360/Math.max(1,count)));
     if(slot!==lastSlot && now-lastTick>75 && sample.phase!=='landed') { cue('tick');lastTick=now;lastSlot=slot; }
     if(sample.phase==='decelerating' && !slowing) {slowing=true;cue('deceleration');}
     if(sample.phase==='landed') {cue('landing');cue('reveal');} else frame=requestAnimationFrame(draw);
   };
   frame=requestAnimationFrame(draw); return ()=>cancelAnimationFrame(frame);
 },[spin?.id,enabled,count]);
}

/** A visual replay can sound again; reconnects never replay historical cues. */
export function useGameEffectSound(cue:GameEffectCue|undefined,enabled:boolean) {
 const seen=useRef(new Set<string>());
 useEffect(()=>{
  if(!cue || !cue.sound || !enabled || seen.current.has(cue.id))return;
  seen.current.add(cue.id);
  if(Date.now()-cue.startedAt>350 || Date.now()<cue.startedAt)return;
  try{return audioController.playGameEffectCue(cue.kind);}catch{/* Audio never gates gameplay. */}
 },[cue?.id,enabled]);
}
