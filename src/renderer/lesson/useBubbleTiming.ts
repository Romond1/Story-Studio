import { useEffect, useRef, useState, type RefObject } from 'react';
import type { SceneObjectPlan } from '../../shared/lesson/projection';
import { bubbleVisibleAt } from '../../shared/lesson/bubbleAppearance';

/** Use the existing decoder's source time; still scenes use a single next-boundary timer. */
export function useBubbleTiming(host: RefObject<HTMLDivElement>, objects: SceneObjectPlan[], key: string, active: boolean, videoScene: boolean, playback?: {positionSec:number;playing:boolean}) {
  const visit=useRef({key,startedAt:Date.now(),videoMs:0});
  if(visit.current.key!==key)visit.current={key,startedAt:Date.now(),videoMs:0};
  const [tick,refresh]=useState(0);
  const anchor=useRef({key,positionSec:playback?.positionSec??0,playing:playback?.playing??false,at:Date.now()});
  if(anchor.current.key!==key||anchor.current.positionSec!==playback?.positionSec||anchor.current.playing!==playback?.playing)anchor.current={key,positionSec:playback?.positionSec??0,playing:playback?.playing??false,at:Date.now()};
  const sourceTime=()=>anchor.current.positionSec*1000+(anchor.current.playing?Date.now()-anchor.current.at:0);
  const boundaries=objects.flatMap(object=>object.kind==='bubble'?[object.appearDelayMs??0,...(object.disappearAtMs===undefined?[]:[object.disappearAtMs])]:[]);
  const boundaryKey=JSON.stringify(boundaries);
  const time=playback?sourceTime():videoScene?visit.current.videoMs:Date.now()-visit.current.startedAt;
  const signature=(time:number)=>boundaries.map(boundary=>time>=boundary?'1':'0').join('');
  const renderedSignature=signature(time);
  useEffect(()=>{
    if(!active||(videoScene&&!playback)||(playback&&!playback.playing))return;
    const elapsed=playback?sourceTime():Date.now()-visit.current.startedAt;
    if(signature(elapsed)!==renderedSignature){refresh(value=>value+1);return;}
    const next=Math.min(...boundaries.filter(time=>time>elapsed));
    if(!Number.isFinite(next))return;
    const timer=window.setTimeout(()=>refresh(value=>value+1),Math.max(1,next-elapsed));
    return()=>window.clearTimeout(timer);
  },[key,active,videoScene,boundaryKey,tick,playback?.positionSec,playback?.playing,renderedSignature]);
  useEffect(()=>{
    if(!active||!videoScene||playback||!boundaries.some(time=>time>0))return;
    const root=host.current;if(!root)return;
    let video:HTMLVideoElement|null=null,frame=0;
    const signature=(time:number)=>boundaries.map(boundary=>time>=boundary?'1':'0').join('');
    let previous=signature(visit.current.videoMs);
    const cancel=()=>{if(frame)window.cancelAnimationFrame(frame);frame=0;};
    const update=()=>{
      if(!video)return;
      visit.current.videoMs=Number.isFinite(video.currentTime)?video.currentTime*1000:0;
      const next=signature(visit.current.videoMs);if(next!==previous){previous=next;refresh(value=>value+1);}
      if(!video.paused&&!video.ended&&!frame)frame=window.requestAnimationFrame(()=>{frame=0;update();});else if(video.paused||video.ended)cancel();
    };
    const events=['loadedmetadata','timeupdate','seeking','seeked','play','pause','ended','emptied'];
    const detach=()=>{cancel();events.forEach(event=>video?.removeEventListener(event,update));};
    const connect=()=>{const next=root.querySelector<HTMLVideoElement>('.lesson-scene-background video');if(next===video)return;detach();video=next;if(video){events.forEach(event=>video!.addEventListener(event,update));update();}};
    connect();const observer=new MutationObserver(connect);observer.observe(root,{childList:true,subtree:true});
    return()=>{observer.disconnect();detach();};
  },[key,active,videoScene,boundaryKey,!!playback]);
  return (object:SceneObjectPlan)=>active&&object.kind==='bubble'&&!bubbleVisibleAt(object,time);
}
