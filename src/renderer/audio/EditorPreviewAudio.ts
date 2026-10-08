import { createContext, useEffect, useMemo } from 'react';

export const EditorPreviewAudioContext = createContext(false);
/** Local HTML media only: never connects to AudioController's broadcast buses. */
export function useEditorPreviewAudio(url:string, enabled:boolean) {
  const preview=useMemo(()=>enabled?new Audio(url):null,[url,enabled]);
  useEffect(()=>()=>{if(preview){preview.pause();preview.removeAttribute('src');preview.load();}},[preview]);
  return {
    isPlaying:(_url:string)=>!!preview&&!preview.paused,
    getDuration:(_url:string)=>preview?.duration||0,
    getCurrentTime:(_url:string)=>preview?.currentTime||0,
    seek:(_url:string,time:number)=>{if(preview)preview.currentTime=time;},
    setVolume:(_url:string,volume:number)=>{if(preview)preview.volume=volume;},
    play:(_url:string,volume:number)=>{if(preview){preview.volume=volume;void preview.play().catch(()=>{});}},
    pause:(_url:string)=>preview?.pause(),
    stop:(_url:string)=>{if(preview){preview.pause();preview.currentTime=0;}},
  };
}
