import { useEffect, useState } from 'react';
import type { Slide } from '../shared/types';
import { getEffectiveVideoTrim } from '../shared/videoTrim';

/** Controls the existing Edit decoder only. Never sends presentation commands. */
export function EditVideoTransport({video,trim,label}:{video:HTMLVideoElement|null;trim?:Slide['videoTrim'];label?:string}) {
  const [status,setStatus]=useState({position:0,duration:0,playing:false});
  const [error,setError]=useState('');
  useEffect(()=>{
    setError('');
    const update=()=>setStatus({position:video?.currentTime??0,duration:video&&Number.isFinite(video.duration)?video.duration:0,playing:!!video&&!video.paused&&!video.ended});
    const events=['loadedmetadata','durationchange','timeupdate','seeked','play','pause','ended','emptied'];
    events.forEach(event=>video?.addEventListener(event,update));update();
    return()=>events.forEach(event=>video?.removeEventListener(event,update));
  },[video]);
  const range=getEffectiveVideoTrim(trim,status.duration);
  const ready=!!video&&status.duration>0;
  const clock=(time:number)=>`${Math.floor(time/60)}:${Math.floor(time%60).toString().padStart(2,'0')}`;
  return <div className="edit-video-transport" role="group" aria-label="Edit video playback">
    <strong title={label}>{video?label||'Selected video':'Video preview'}</strong>
    <button disabled={!ready||status.playing} onClick={()=>{if(!video)return;if(video.currentTime>=range.outSec)video.currentTime=range.inSec;setError('');void video.play().catch(()=>setError('Unable to play this video.'));}}>▶ Play</button>
    <button disabled={!ready||!status.playing} onClick={()=>video?.pause()}>Ⅱ Pause</button>
    <button disabled={!ready} onClick={()=>{if(video){video.pause();video.currentTime=range.inSec;}}}>■ Stop</button>
    <input aria-label="Edit video playhead" type="range" min={range.inSec} max={Math.max(range.inSec,range.outSec)} step="0.01" disabled={!ready}
      value={Math.max(range.inSec,Math.min(range.outSec,status.position))} onChange={e=>{const position=Number(e.target.value);setStatus(old=>({...old,position}));if(video)video.currentTime=position;}}/>
    <output aria-label="Edit video time">{clock(status.position)} / {clock(range.outSec)}</output>
    {!video&&<span>Select a video to preview</span>}{error&&<span role="alert">{error}</span>}
  </div>;
}
