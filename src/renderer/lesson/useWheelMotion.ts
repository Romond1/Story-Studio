import { useLayoutEffect, useRef, useState } from 'react';
import { sampleWheelSpin, type WheelSpin } from '../../shared/lesson/wheelAnimation';
/** Only this SVG transform changes per frame. React updates once when the spin lands. */
export function useWheelMotion(spin: WheelSpin | undefined, restingDegrees: number, segmentCount = 1) {
 const rotor = useRef<SVGGElement>(null);
 const [landedId,setLandedId] = useState<string>();
 const moving = !!spin && landedId !== spin.id && Date.now() < spin.startedAt + spin.durationMs;
 useLayoutEffect(()=>{
   let frame=0,timer=0; const media=window.matchMedia('(prefers-reduced-motion: reduce)');
   const draw=()=>{
     const sample=spin ? sampleWheelSpin(spin,Date.now(),media.matches) : undefined;
     const pointer=rotor.current?.parentElement?.querySelector('.wheel-pointer');
     const fraction=sample ? ((sample.degrees/360*segmentCount)%1+1)%1 : 1;
     pointer?.setAttribute('transform',`rotate(${sample && sample.phase!=='landed' && !media.matches ? -9*Math.max(0,1-fraction*5) : 0} 360 114)`);
     rotor.current?.setAttribute('transform',`rotate(${sample?.degrees ?? restingDegrees} 360 380)`);
     if(sample && sample.phase !== 'landed') {
       if(media.matches) timer=window.setTimeout(draw,Math.max(1,spin!.startedAt+spin!.durationMs-Date.now()));
       else frame=requestAnimationFrame(draw);
     }
     else if(spin) setLandedId(spin.id);
   };
   const changed=()=>{cancelAnimationFrame(frame);window.clearTimeout(timer);draw();};
   media.addEventListener('change',changed);
   draw(); return ()=>{cancelAnimationFrame(frame);window.clearTimeout(timer);media.removeEventListener('change',changed);};
 },[spin?.id,spin?.startedAt,spin?.durationMs,spin?.fromDegrees,spin?.toDegrees,restingDegrees,segmentCount]);
 return {rotor,moving};
}
