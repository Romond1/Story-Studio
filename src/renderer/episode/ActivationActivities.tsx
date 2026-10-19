import {useEffect,useRef,useState} from 'react';
import type {EpisodeProject} from '../../shared/episode/model';
import type {ActivityEvent,EpisodeActivity,ModuleLifecycle,RunContext} from '../../shared/modules/model';
import {putActivityOccurrence,putEpisodeActivity} from '../../shared/episode/commands';
import {commandActivation,completeActivationAsync,initializeActivation,nextActivationScene,type ActivationRun} from '../../shared/modules/activation';
export interface ActivationActivitiesProps {
 project:EpisodeProject;onChange:(project:EpisodeProject)=>void;participants:string[];sessionId:string;
 onStart:(sceneId:string)=>void;onPaused:(paused:boolean)=>void;onStop:()=>void;onEvent?:(event:ActivityEvent)=>void|Promise<void|{accepted:boolean;reason?:string}>;
 onRegisterRun?:(context:RunContext,activity:EpisodeActivity)=>Promise<void|{accepted:boolean;reason?:string}>;onLifecycle?:(context:RunContext,state:ModuleLifecycle)=>Promise<void>;
 disabled?:boolean;readOnly?:boolean;
}
/** Runs existing scene/card definitions through the existing teaching scene session. */
export function ActivationActivities({project,onChange,participants,sessionId,onStart,onPaused,onStop,onEvent,onRegisterRun,onLifecycle,disabled=false,readOnly=false}:ActivationActivitiesProps) {
 const [selected,setSelected]=useState(''),[sceneIds,setSceneIds]=useState<string[]>([]),[error,setError]=useState(''),[view,setView]=useState<ActivationRun|null>(null),[pending,setPending]=useState(false);
 const busy=useRef(false),epoch=useRef(0),pendingEvent=useRef<string|null>(null),activeActivity=useRef<EpisodeActivity|null>(null);const blocked=disabled||pending;
 const run=useRef<ActivationRun|null>(null),callbacks=useRef({onPaused,onStop,onLifecycle});callbacks.current={onPaused,onStop,onLifecycle};
 const activities=(project.activities??[]).filter((activity):activity is Extract<EpisodeActivity,{moduleType:'activation-cards'}>=>activity.moduleType==='activation-cards');
 const available=[...new Set(project.sequences.activation.map(entry=>entry.sceneId))].filter(id=>!!project.scenes[id]);
 const active=!!view&&!['stopped','disposed'].includes(view.state);
 const publish=(value:ActivationRun)=>{run.current=value;setView(value);};
 const attempt=async(operation:()=>void|Promise<void>)=>{if(busy.current)return;const generation=epoch.current;busy.current=true;setPending(true);try{await operation();if(generation===epoch.current)setError('');}catch(reason){if(generation===epoch.current)setError(String(reason));}finally{if(generation===epoch.current){busy.current=false;setPending(false);}}};
 const stop=()=>attempt(async()=>{const current=run.current,generation=epoch.current;if(current&&current.state!=='disposed'){onPaused(true);try{await onLifecycle?.(current.context,'stopped');if(generation!==epoch.current)return;publish(commandActivation(current,'stop'));}catch(error){if(generation===epoch.current)onPaused(false);throw error;}}pendingEvent.current=null;onPaused(false);onStop();});
 const startAuthorized=async(current:ActivationRun,activity:EpisodeActivity)=>{const generation=epoch.current;const registered=await onRegisterRun?.(current.context,activity);if(registered&&!registered.accepted)throw Error(registered.reason??'Activation registration rejected');
  if(generation!==epoch.current){await onLifecycle?.(current.context,'stopped');return;}await onLifecycle?.(current.context,'running');if(generation!==epoch.current){await onLifecycle?.(current.context,'stopped');return;}activeActivity.current=activity;pendingEvent.current=null;publish(commandActivation(current,'start'));onPaused(false);onStart(current.sceneIds[0]);};
 useEffect(()=>{const activity=activities.find(item=>item.id===selected);setSceneIds(activity?.config.sceneIds??[]);},[selected,project.activities]);
 useEffect(()=>{++epoch.current;busy.current=false;setPending(false);run.current=null;pendingEvent.current=null;activeActivity.current=null;setView(null);setSelected('');setError('');return ()=>{++epoch.current;if(run.current&&!['stopped','disposed'].includes(run.current.state)){run.current=commandActivation(run.current,'dispose');void callbacks.current.onLifecycle?.(run.current.context,'disposed').catch(()=>{});callbacks.current.onPaused(false);callbacks.current.onStop();}};},[project.id,project.adventure.id]);
 useEffect(()=>{const current=run.current;if(current&&!['stopped','disposed'].includes(current.state)&&current.sceneIds.some(id=>!project.scenes[id])){publish(commandActivation(current,'stop'));void onLifecycle?.(current.context,'stopped').catch(()=>{});onPaused(false);onStop();setError('An Activation scene is no longer available.');}},[project.scenes]);
 const start=()=>attempt(async()=>{
  const activity=activities.find(item=>item.id===selected);if(!activity)throw new Error('Choose an Activation activity');
  const occurrence=project.occurrences?.find(item=>item.activityId===activity.id&&item.section==='activation');if(!occurrence)throw new Error('Activation occurrence is missing');
  if(!participants.length)throw new Error('Choose participants before starting Activation');
  if(activity.config.sceneIds.some(id=>!project.scenes[id]))throw new Error('Activation scene is missing');
  const current=initializeActivation(activity.config.sceneIds,{sessionId,runId:crypto.randomUUID(),instanceId:activity.id,occurrenceId:occurrence.id,episodeId:project.id,adventureId:project.adventure.id,participantIds:[...participants]});await startAuthorized(current,activity);
 });
 return <details className="lesson-panel" open><summary>Activation activities</summary>
  <label className="lesson-field">Activation activity<select disabled={blocked||active} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Choose activity</option>{activities.map((activity,i)=><option key={activity.id} value={activity.id}>Activation {i+1}</option>)}</select></label>
  {!readOnly&&<>
   <button disabled={blocked||active} onClick={()=>attempt(()=>{const id=crypto.randomUUID();let next=putEpisodeActivity(project,{id,moduleType:'activation-cards',moduleVersion:1,configVersion:1,config:{sceneIds:[]}});next=putActivityOccurrence(next,{id:crypto.randomUUID(),activityId:id,section:'activation'});onChange(next);setSelected(id);})}>Create Activation activity</button>
   {selected&&<><fieldset disabled={blocked||active}><legend>Existing Activation scenes</legend>{available.length?available.map(id=><label key={id} style={{display:'block'}}><input type="checkbox" checked={sceneIds.includes(id)} onChange={event=>setSceneIds(old=>event.target.checked?[...old,id]:old.filter(value=>value!==id))}/>{project.scenes[id].title||'Untitled scene'}</label>):<p>Add scenes to the Activation sequence first.</p>}</fieldset>
   <ol>{sceneIds.map((id,index)=><li key={id}>{project.scenes[id]?.title??'Missing scene'} <button aria-label={`Move Activation scene ${index+1} earlier`} disabled={blocked||active||index===0} onClick={()=>setSceneIds(old=>{const copy=[...old];[copy[index-1],copy[index]]=[copy[index],copy[index-1]];return copy;})}>Earlier</button></li>)}</ol>
   <button disabled={blocked||active||!sceneIds.length} onClick={()=>attempt(()=>onChange(putEpisodeActivity(project,{id:selected,moduleType:'activation-cards',moduleVersion:1,configVersion:1,config:{sceneIds}})))}>Save Activation scenes</button></>}
  </>}
  <p role="status">{view?`Activation ${view.state} · scene ${view.index+1} of ${view.sceneIds.length}`:'Activation stopped'}</p>
  <button disabled={blocked||active||!selected} onClick={start}>Start Activation</button>
  {active&&<>
   <button disabled={blocked||view?.state!=='running'} onClick={()=>attempt(async()=>{if(!run.current)return;const current=run.current,generation=epoch.current;onPaused(true);try{await onLifecycle?.(current.context,'paused');if(generation!==epoch.current)return;publish(commandActivation(current,'pause'));}catch(error){if(generation===epoch.current)onPaused(false);throw error;}})}>Pause Activation</button>
   <button disabled={blocked||view?.state!=='paused'} onClick={()=>attempt(async()=>{if(!run.current)return;const current=run.current,generation=epoch.current;await onLifecycle?.(current.context,'running');if(generation!==epoch.current)return;publish(commandActivation(current,'resume'));onPaused(false);})}>Resume Activation</button>
   <button disabled={blocked||view?.state!=='running'||view.index===view.sceneIds.length-1} onClick={()=>attempt(()=>{if(!run.current)return;const next=nextActivationScene(run.current);publish(next);onStart(next.sceneIds[next.index]);})}>Next Activation scene</button>
   <button disabled={blocked} onClick={()=>attempt(async()=>{if(!run.current||!activeActivity.current)return;const current=run.current,generation=epoch.current;onPaused(true);try{await onLifecycle?.(current.context,'stopped');if(generation!==epoch.current)return;const reset=commandActivation(current,'reset',crypto.randomUUID());publish(commandActivation(current,'stop'));await startAuthorized(reset,activeActivity.current);}catch(error){if(generation===epoch.current){onPaused(false);onStop();}throw error;}})}>Reset Activation</button>
   <button disabled={blocked||view?.state!=='running'} onClick={()=>attempt(async()=>{if(!run.current)return;const current=run.current,generation=epoch.current;pendingEvent.current??=crypto.randomUUID();const completed=await completeActivationAsync(current,pendingEvent.current,onEvent);if(generation!==epoch.current)return;publish(completed.run);pendingEvent.current=null;onPaused(false);onStop();await onLifecycle?.(completed.run.context,'stopped');})}>Complete Activation</button>
   <button disabled={blocked} onClick={stop}>Stop Activation</button>
  </>}
  {error&&<p role="alert">{error}</p>}
 </details>;
}
