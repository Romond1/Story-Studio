import { useEffect,useRef,useState } from 'react';
import type { ProjectData,Slide } from '../shared/types';
import type { LogicalFrame } from '../shared/staticScene';
import { createPresentationSession,resolvePresentationTarget } from '../shared/presentationSession';
import { LogicalSceneFrame,PassiveImage,PassiveOverlays,PassiveDrawings } from './StaticScene';
import { PassiveActivities } from './ActivityScene';
import { composeActivityScene } from './composeActivityScene';
import { resolvePassiveOverlays } from './mediaUrls';

/** Inspection only. Reuses passive scene primitives; no media/audio/runtime commands. */
export function TimelineFrame({data,slide,frame,resolveUrl,scope}:{data:ProjectData;slide:Slide;frame:LogicalFrame;resolveUrl:(path:string)=>string;scope:string}){
  const host=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{const node=host.current;if(!node)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));observer.observe(node);return()=>observer.disconnect();},[]);
  const asset=data.assets.find(a=>a.id===slide.assetId);
  const session={...createPresentationSession('thumbnail'),projectId:'thumbnail',sectionId:slide.sectionId,storySlideId:slide.id};
  const target=resolvePresentationTarget(data,session);
  const activity=composeActivityScene(data,session,target,(_ref,instances)=>({state:{instances,states:{},startedAt:0},move:()=>{},setState:()=>{},toggle:()=>{},shuffle:()=>{}}),{isRunning:false,startTime:0,accumulated:0},scope,false);
  return <span ref={host} style={{position:'absolute',inset:0,pointerEvents:'none'}} aria-hidden="true">{visible&&<LogicalSceneFrame frame={frame}>
    {asset?.mediaType==='image'?<PassiveImage src={resolveUrl(asset.relativePath)} adjustments={slide.imageAdjustments}/>:asset?.mediaType==='video'?<video src={resolveUrl(asset.relativePath)} muted preload="metadata" onLoadedMetadata={e=>{e.currentTarget.currentTime=slide.videoTrim?.inSec??0;}} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:null}
    <PassiveOverlays overlays={resolvePassiveOverlays(slide.overlays??[],data.bubbleDefinitions,scope)}/><PassiveActivities scene={activity}/>
    {!!slide.markerStrokes?.length&&<PassiveDrawings frame={frame} markers={slide.markerStrokes}/>}
  </LogicalSceneFrame>}</span>;
}
