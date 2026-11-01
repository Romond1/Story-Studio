import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { LessonSession, SceneLessonProject } from '../../shared/lesson/model';
import type { TeamActivityEntry } from '../../shared/teamPlay/activities';
import { createTeamRun, teamRunTarget, type TeamRun } from '../../shared/teamPlay/runtime';
import { dashAction, type DashAction } from '../../shared/heroDash';

/** Transient adapter state only. LessonApp remains the only snapshot publisher. */
export function useTeamPlayActivity({project,scope,enabled,resolve,onError}:{project:SceneLessonProject|null;scope:string;enabled:boolean;resolve:(id:string)=>string|undefined;onError:(message:string)=>void}) {
  const [run,setRun]=useState<TeamRun|null>(null);
  const current=useRef(run);current.current=run;
  useEffect(()=>{setRun(null);},[scope,enabled]);
  useEffect(()=>window.appApi.onGameEnded(event=>{
    if(current.current?.kind==='dash'&&current.current.instanceId===event.instanceId){setRun(null);onError('The activity ended because Present closed or restarted. Group scores and preparation are preserved. Launch it again when ready.');}
  }),[onError]);
  useEffect(()=>window.appApi.onDashZoom?.(event=>setRun(value=>value?.kind==='dash'&&value.instanceId===event.instanceId?{...value,state:dashAction(value.state,{type:'zoom',zoom:event.zoom})}:value)),[]);
  const launch=(entry:TeamActivityEntry)=>{
    if(!enabled||!project)return;
    try{
      if(entry.content.questions.some(question=>question.imageAssetId&&!resolve(question.imageAssetId)))throw Error('A selected image is loading or unavailable. Wait for media to finish loading or choose another image.');
      const next=createTeamRun(project,entry,crypto.randomUUID());setRun(next);
      // Native games open through the central launch-game publisher; scenes use normal Present opening.
      if(next.kind==='wheel')void window.appApi.openPresent().catch(reason=>{setRun(value=>value?.instanceId===next.instanceId?null:value);onError(String(reason));});
    }catch(reason){onError(String(reason));}
  };
  const wheelSession:Dispatch<SetStateAction<LessonSession>>=useCallback(update=>setRun(value=>value?.kind==='wheel'?{...value,session:typeof update==='function'?update(value.session):update}:value),[]);
  const dashCommand=useCallback((action:DashAction)=>setRun(value=>value?.kind==='dash'?{...value,state:dashAction(value.state,action)}:value),[]);
  const target=useMemo(()=>run?teamRunTarget(run,resolve):null,[run,resolve]);
  return {run,target,launch,exit:()=>setRun(null),retire:(instanceId:string)=>setRun(value=>value?.instanceId===instanceId?null:value),wheelSession,dashCommand};
}
