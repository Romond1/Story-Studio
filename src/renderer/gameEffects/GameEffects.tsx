import { useLayoutEffect, useRef } from 'react';
import { effectParticleCount, effectProgress, sampleEffectParticle, type GameEffectCue } from '../../shared/gameEffects';
import { getRewardShapePath } from '../../shared/sparkRewards';
import './gameEffects.css';

function sprite(kind:'coin'|'star'|'crown') {
 const image=document.createElement('canvas');image.width=96;image.height=96;const c=image.getContext('2d')!;
 const gold=c.createLinearGradient(18,10,76,85);gold.addColorStop(0,'#fff7c1');gold.addColorStop(.35,'#f6cd58');gold.addColorStop(.65,'#b87721');gold.addColorStop(1,'#f9d47a');
 c.fillStyle=gold;c.strokeStyle='#ffefb2';c.lineWidth=3;
 if(kind==='coin') {
  c.beginPath();c.arc(48,48,36,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='#9f611d';c.lineWidth=2;c.beginPath();c.arc(48,48,28,0,Math.PI*2);c.stroke();
  c.save();c.translate(28,26);c.scale(1.65,1.65);c.fillStyle='#ffed9a';c.fill(new Path2D(getRewardShapePath('star')));c.restore();
 } else {c.translate(8,8);c.scale(3.3,3.3);c.lineWidth=.65;const path=new Path2D(getRewardShapePath(kind==='star'?'star':'crown'));c.fill(path);c.stroke(path);}
 return image;
}
function portal(c:CanvasRenderingContext2D,x:number,y:number,r:number,t:number,low:boolean) {
 c.save();c.translate(x,y);
 const glow=c.createRadialGradient(0,0,r*.05,0,0,r);glow.addColorStop(0,'#c3b2ff55');glow.addColorStop(.65,'#9770ee25');glow.addColorStop(1,'#9770ee00');c.fillStyle=glow;c.fillRect(-r,-r,r*2,r*2);
 for(let ring=0;ring<3;ring++) {c.save();c.rotate(low?0:t*5*(ring%2?1:-1));c.strokeStyle=['#e8dcff','#bfa1f6','#70dfe7'][ring];c.lineWidth=ring===0?3:2;c.setLineDash([r*.7,r*.12,r*.04,r*.12]);c.beginPath();c.ellipse(0,0,r*(.72+ring*.09),r*(.72+ring*.09),0,0,Math.PI*2);c.stroke();c.restore();}
 c.fillStyle='#f5f0ff';c.beginPath();c.moveTo(0,-r*.46);c.lineTo(r*.23,0);c.lineTo(0,r*.46);c.lineTo(-r*.23,0);c.closePath();c.fill();
 c.fillStyle='#a4e9ed';c.beginPath();c.moveTo(0,-r*.46);c.lineTo(r*.23,0);c.lineTo(0,r*.46);c.closePath();c.fill();c.restore();
}
function chest(c:CanvasRenderingContext2D,x:number,y:number,size:number,t:number,low:boolean) {
 c.save();c.translate(x,y);c.scale(size/160,size/160);
 const open=low?1:Math.max(0,Math.min(1,(t-.22)*3));
 if(open>0) {c.save();c.globalAlpha=open*.6;c.fillStyle='#ffe6a2';for(let i=0;i<7;i++){c.save();c.rotate((i-3)*.18);c.beginPath();c.moveTo(-10,-10);c.lineTo(-30,-185);c.lineTo(-8,-195);c.lineTo(10,-10);c.fill();c.restore();}c.restore();}
 c.fillStyle='#100e2d55';c.beginPath();c.ellipse(0,64,100,16,0,0,Math.PI*2);c.fill();
 // Dimensional oak body, inset panels and gold bands.
 const wood=c.createLinearGradient(-80,0,80,80);wood.addColorStop(0,'#a96635');wood.addColorStop(1,'#4d2840');c.fillStyle=wood;c.strokeStyle='#f0cb7a';c.lineWidth=5;c.beginPath();c.roundRect(-84,-5,168,70,10);c.fill();c.stroke();
 c.strokeStyle='#4e2635';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-70,13+i*17);c.lineTo(70,13+i*17);c.stroke();}
 c.fillStyle='#dcac59';c.fillRect(-63,-3,13,67);c.fillRect(50,-3,13,67);
 c.save();c.translate(0,-8-open*50);c.scale(1,1-open*.48);if(!low)c.rotate(Math.sin(t*45)*(t<.23?.035:0));c.fillStyle=wood;c.strokeStyle='#ffdf95';c.lineWidth=5;c.beginPath();c.roundRect(-87,-56,174,58,[26,26,5,5]);c.fill();c.stroke();c.fillStyle='#e9be6b';c.fillRect(-64,-53,14,53);c.fillRect(50,-53,14,53);c.restore();
 c.fillStyle='#ffdf8b';c.beginPath();c.roundRect(-15,3,30,37,6);c.fill();c.fillStyle='#3c263a';c.beginPath();c.arc(0,16,5,0,6.3);c.fill();c.fillRect(-3,16,6,13);c.restore();
}
function creature(c:CanvasRenderingContext2D,x:number,y:number,r:number,t:number,low:boolean) {
 c.save();c.translate(x,y+(low?0:Math.sin(t*18)*r*.12));c.rotate(low?0:Math.sin(t*9)*.12);
 const body=c.createRadialGradient(-r*.2,-r*.3,5,0,0,r);body.addColorStop(0,'#d3fff4');body.addColorStop(.55,'#79cfce');body.addColorStop(1,'#316a9b');c.fillStyle=body;
 c.beginPath();c.moveTo(-r*.65,r*.45);c.bezierCurveTo(-r*1.1,-r*.9,r*.8,-r*1.2,r*.7,r*.25);c.lineTo(r*.47,r*.6);c.lineTo(r*.15,r*.4);c.lineTo(-r*.12,r*.65);c.lineTo(-r*.4,r*.4);c.closePath();c.fill();
 c.fillStyle='#1a3153';for(const dx of [-.25,.25]){c.beginPath();c.ellipse(r*dx,-r*.14,r*.07,r*.13,0,0,6.3);c.fill();}
 c.strokeStyle='#254b69';c.lineWidth=3;c.beginPath();c.arc(0,r*.03,r*.19,.1,3.04);c.stroke();c.fillStyle='#ecc591';c.globalAlpha=.65;for(const dx of [-.4,.4]){c.beginPath();c.ellipse(r*dx,r*.08,r*.12,r*.055,0,0,6.3);c.fill();}c.restore();
}
/** Broad light bloom and fine rays make intensity visible independently of emblem size. */
function radiance(c:CanvasRenderingContext2D,x:number,y:number,r:number,t:number,intensity:number,low:boolean) {
 if(intensity<=0)return;
 c.save();c.translate(x,y);
 const halo=c.createRadialGradient(0,0,r*.08,0,0,r*1.65);
 halo.addColorStop(0,'#fff6cf99');halo.addColorStop(.32,'#ffd76555');halo.addColorStop(1,'#ffce5300');
 c.globalAlpha*=Math.min(1,intensity*.55);c.fillStyle=halo;c.fillRect(-r*1.65,-r*1.65,r*3.3,r*3.3);
 if(!low){c.rotate(t*.9);for(let i=0;i<24;i++){c.rotate(Math.PI/12);c.fillStyle=i%2?'#fff4bc22':'#ffd77833';c.beginPath();c.moveTo(0,0);c.lineTo(-r*.055,-r*(1.15+intensity*.15));c.lineTo(r*.055,-r*(1.15+intensity*.15));c.closePath();c.fill();}}
 c.strokeStyle='#fff1bd';c.lineWidth=2;c.globalAlpha*=.55;
 for(let i=0;i<2;i++){c.beginPath();c.arc(0,0,r*(.65+i*.3+(low?0:t*.2)),0,Math.PI*2);c.stroke();}
 c.restore();
}
/** One bounded visual intent at a time, reconstructable anywhere. No gameplay callbacks. */
export function GameEffects({cue,frame}:{cue?:GameEffectCue;frame:{width:number;height:number}}) {
 const canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!cue || !canvas.current || !host.current) return;
  const node=canvas.current,root=host.current,c=node.getContext('2d');if(!c)return;
  const density=Math.min(1.5,window.devicePixelRatio||1);node.width=Math.round(frame.width*density);node.height=Math.round(frame.height*density);c.scale(density,density);
  const coin=sprite('coin'),star=sprite('star'),crown=sprite('crown'),media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0,timer=0;
  const draw=()=>{
   const now=Date.now(),t=effectProgress(cue,now),low=media.matches,w=frame.width,h=frame.height,unit=Math.min(w/1280,h/720)*(cue.scale ?? 1);
   c.clearRect(0,0,w,h);root.dataset.effectStatus=t>=1?'finished':now<cue.startedAt?'waiting':'active';root.style.visibility=t>=1||now<cue.startedAt?'hidden':'visible';
   if(t>=1)return;
   if(now<cue.startedAt){timer=window.setTimeout(draw,cue.startedAt-now);return;}
   c.save();c.globalAlpha=low?1:Math.min(1,t*12,(1-t)*7);
   const x=w*.265,y=h*.51,r=150*unit;
   radiance(c,x,y,r,t,cue.intensity,low);
   if(low) {if(cue.kind==='chest')chest(c,x,y,150*unit,.6,true);else if(cue.kind==='sprite')creature(c,x,y,90*unit,.6,true);else if(cue.kind==='portal')portal(c,x,y,r,.6,true);else c.drawImage(cue.kind==='coins'?coin:cue.kind==='crown'?crown:star,x-62*unit,y-62*unit,124*unit,124*unit);}
   else {
    if(cue.kind==='stars'||cue.kind==='coins'){const hero=(cue.kind==='stars'?210:175)*unit*(1+Math.sin(Math.min(1,t*4)*Math.PI)*.22);c.drawImage(cue.kind==='stars'?star:coin,x-hero/2,y-hero/2,hero,hero);}
    if(cue.kind==='portal')portal(c,x,y,r*(.7+Math.min(1,t*3)*.3),t,false);
    if(cue.kind==='chest')chest(c,x,y,165*unit,t,false);
    if(cue.kind==='sprite')creature(c,x,y,95*unit,t,false);
    if(cue.kind==='crown'){const scale=1+Math.sin(Math.min(1,t*3)*Math.PI)*.18;c.drawImage(crown,x-85*unit*scale,y-85*unit*scale,170*unit*scale,170*unit*scale);}
    for(let i=0;i<effectParticleCount(cue);i++) {
     const p=sampleEffectParticle(cue,i,t),size=(cue.kind==='coins'?46:cue.kind==='stars'?40:20)*unit*p.scale;
     c.save();c.globalAlpha*=p.alpha;c.translate(x+(p.x*w-w*.29)*(cue.scale ?? 1),y+(p.y*h-h*.5)*(cue.scale ?? 1));c.rotate(p.rotation);
     if(cue.kind==='coins')c.scale(Math.max(.12,Math.abs(Math.cos(t*18+i))),1);
     c.drawImage(cue.kind==='coins'?coin:star,-size/2,-size/2,size,size);c.restore();
    }
   }
   c.restore();
   if(low)timer=window.setTimeout(draw,Math.max(1,cue.startedAt+cue.durationMs-Date.now()));else raf=requestAnimationFrame(draw);
  };
  const changed=()=>{cancelAnimationFrame(raf);window.clearTimeout(timer);draw();};media.addEventListener('change',changed);draw();
  return ()=>{cancelAnimationFrame(raf);window.clearTimeout(timer);media.removeEventListener('change',changed);c.clearRect(0,0,frame.width,frame.height);};
 },[cue?.id,frame.width,frame.height]);
 if(!cue)return null;
 return <div ref={host} className="game-effects" data-effect-id={cue.id} data-effect-kind={cue.kind} aria-label={cue.caption} style={{visibility:'hidden',fontSize:Math.min(frame.width/40,frame.height/22)}}><canvas ref={canvas} aria-hidden="true"/><div className="game-effect-caption" role="status">{cue.caption}</div></div>;
}
