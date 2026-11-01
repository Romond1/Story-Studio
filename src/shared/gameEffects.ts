/** Renderer-independent visual intents. These never award rewards or advance gameplay. */
export const GAME_EFFECT_KINDS = ['coins','stars','portal','chest','sprite','crown'] as const;
export type GameEffectKind = typeof GAME_EFFECT_KINDS[number];
export interface GameEffectCue { version:1; id:string; kind:GameEffectKind; startedAt:number; durationMs:number; intensity:number; scale?:number; sound:boolean; caption:string }
export function parseGameEffect(value:unknown):GameEffectCue|null {
 const v=value as GameEffectCue|undefined;
 if(!v || v.version!==1 || typeof v.id!=='string' || !v.id || v.id.length>1600 || !GAME_EFFECT_KINDS.includes(v.kind)
  || !Number.isSafeInteger(v.startedAt) || v.startedAt<0 || !Number.isFinite(v.durationMs) || v.durationMs<600 || v.durationMs>8000
  || !Number.isFinite(v.intensity) || v.intensity<0 || v.intensity>3 || (v.scale!==undefined && (!Number.isFinite(v.scale) || v.scale<.5 || v.scale>3)) || typeof v.sound!=='boolean' || typeof v.caption!=='string' || v.caption.length>200) return null;
 return {version:1,id:v.id,kind:v.kind,startedAt:v.startedAt,durationMs:v.durationMs,intensity:v.intensity,...(v.scale===undefined?{}:{scale:v.scale}),sound:v.sound,caption:v.caption};
}
export const effectProgress=(cue:GameEffectCue,now:number)=>Math.max(0,Math.min(1,(now-cue.startedAt)/cue.durationMs));
export const effectParticleCount=(cue:GameEffectCue)=>Math.min(160,Math.max(0,Math.round((cue.kind==='coins'?54:46)*cue.intensity)));
export function effectRandom(id:string,index:number) {
 let seed=2166136261;for(let i=0;i<id.length;i++)seed=Math.imul(seed^id.charCodeAt(i),16777619);
 seed=Math.imul(seed^(index+1),2246822519);seed^=seed>>>13;return (seed>>>0)/4294967296;
}
/** Normalized coordinates, independent of frame rate, window size and mount time. */
export function sampleEffectParticle(cue:GameEffectCue,index:number,progress:number) {
 const r=effectRandom(cue.id,index*3),r2=effectRandom(cue.id,index*3+1),r3=effectRandom(cue.id,index*3+2);
 const t=Math.max(0,Math.min(1,progress)),angle=r*Math.PI*2;
 let x:number,y:number;
 if(cue.kind==='coins') {
   const age=Math.max(0,t-r3*.2)*1.5;
   x=.29+(r-.5)*.7*age; const flight=.69-(.55+r2*.4)*age+.85*age*age;
   y=flight>.85 ? .85-Math.abs(Math.sin((flight-.85)*4))*.12*(1-t) : flight;
 } else if(cue.kind==='stars') {
   // Continue drifting outwards until transparent; never gather into a corner.
   const burst=1-Math.pow(1-t,3);
   x=.29+Math.cos(angle)*(.1+r2*.2)*burst;
   y=.5+Math.sin(angle)*(.15+r2*.3)*burst;
 } else {const radius=(.04+t*.28)*(1+r2*.3);x=.29+Math.cos(angle+t*4)*radius;y=.5+Math.sin(angle+t*4)*radius;}
 return {x,y,rotation:r3*6.28+t*(r-.5)*14,scale:.65+r2*.7,alpha:Math.max(0,Math.min(1,t*12,(1-t)*5))};
}
