import { useEffect, useRef, useState } from 'react';
import type { WheelPresentation } from '../../shared/lesson/wheelPresentation';
import { questionMediaTime } from '../../shared/lesson/questionPlayback';
export function WheelQuestionMedia({media,audible}:{media:NonNullable<NonNullable<WheelPresentation['activity']>['media']>;audible:boolean}) {
 const ref=useRef<HTMLVideoElement>(null),[error,setError]=useState('');
 useEffect(()=>{
  const node=ref.current;if(!node || media.kind==='image')return;
  let cancelled=false,detach:(()=>void)|undefined;
  setError('');node.src=media.src;node.muted=true;
  // Present never loads the audio engine; mounted Teach alone owns mixer output.
  if(audible)void import('../audio/AudioController').then(({audioController})=>{
    if(cancelled)return;audioController.attachMediaElement(node,1,'dialogue',true);node.muted=false;detach=()=>audioController.detachMediaElement(node);
  }).catch(()=>{if(!cancelled)setError('Audio could not start. Check Audio settings.');});
  return ()=>{cancelled=true;node.pause();detach?.();node.removeAttribute('src');node.load();};
 },[media.src,media.kind,audible]);
 useEffect(()=>{
  const node=ref.current;if(!node || media.kind==='image')return;
  let cancelled=false;
  const sync=()=>{
   const state=media.playback,position=state?questionMediaTime(state,Date.now()):0;
   if(node.readyState>0){const end=Number.isFinite(node.duration)?node.duration:position;try{node.currentTime=Math.min(position,end);}catch{/* Metadata may still be loading. */}}
   if(state?.playing && (!Number.isFinite(node.duration)||position<node.duration))void node.play().catch(()=>{if(!cancelled)setError('Playback could not start. Pause and play again.');});else node.pause();
  };
  node.addEventListener('loadedmetadata',sync);sync();return()=>{cancelled=true;node.removeEventListener('loadedmetadata',sync);node.pause();};
 },[media.src,media.playback?.playing,media.playback?.positionSec,media.playback?.startedAt]);
 if(media.kind==='image')return <div className="wheel-question-attachment"><img src={media.src} alt={media.label} draggable={false} decoding="async" data-question-image="original"/></div>;
 return <div className={`wheel-question-attachment${media.kind==='audio'?' wheel-audio-question':''}`}>
  {media.kind==='audio' && <div role="img" aria-label="Audio question">♫<p>{media.label}</p><small>{media.playback?.playing?'Listening…':'Your teacher can play this audio.'}</small></div>}
  <video ref={ref} src={media.src} playsInline preload="metadata" muted={!audible} aria-label={media.kind==='audio'?'Question audio':'Question video'} style={{display:media.kind==='audio'?'none':undefined}} onError={()=>setError('This media could not be played. Check the file in Edit.')} />
  {error && <p role="status">{error}</p>}
 </div>;
}
