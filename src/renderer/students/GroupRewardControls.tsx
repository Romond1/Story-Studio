import {useEffect,useRef,useState} from 'react';
import type {EpisodeProject} from '../../shared/episode/model';
import type {StudentRosterEntry} from '../../shared/types';
import {applyStoredGroupReward,groupRewardInFlight,captureGroupReward,type GroupRewardPlan} from '../../shared/students/groupRewards';
export function GroupRewardControls({project,folder,participants,roster,onChange,intentStore,refreshKey}:{project:EpisodeProject;folder:string;participants:string[];roster:StudentRosterEntry[];onChange:()=>void;intentStore?:Map<string,GroupRewardPlan>;refreshKey?:number}) {
 const fallback=useRef(new Map<string,GroupRewardPlan>());const store=intentStore??fallback.current;const key=JSON.stringify([folder,project.adventure.id,project.id]);
 const [rewardId,setRewardId]=useState(''),[delta,setDelta]=useState(1),[reason,setReason]=useState(''),[error,setError]=useState('');
 const [plan,setPlan]=useState<GroupRewardPlan|null>(()=>store.get(key)??null),[busy,setBusy]=useState(()=>groupRewardInFlight(store,key));const lock=useRef(false);
 useEffect(()=>{setPlan(store.get(key)??null);setBusy(groupRewardInFlight(store,key));},[store,key,refreshKey]);
 const definition=project.adventureDefinition;
 const run=async(captured:GroupRewardPlan)=>{if(lock.current||groupRewardInFlight(store,key))return;lock.current=true;setBusy(true);setError('');setPlan(captured);try{const result=await applyStoredGroupReward(store,key,store.get(key)??captured,input=>window.appApi.progression.adjustReward(input));setPlan(result);}catch(failure){setError(String(failure));}finally{lock.current=false;setBusy(false);onChange();}};
 const start=()=>{if(lock.current||plan||store.has(key))return;try{if(!definition)throw Error('Add adventure reward definitions first.');const captured=captureGroupReward({participants,roster,definition,folder,rewardId,delta,reason},()=>crypto.randomUUID());void run(captured);}catch(failure){setError(String(failure));}};
 return <details className="lesson-panel-content"><summary>Group rewards</summary><p>Adjust the selected active permanent students. Guests are excluded. Each adjustment is recorded by Core with your reason.</p>
 {!definition?<p>Add adventure reward definitions in Edit first.</p>:<>
 <label className="lesson-field">Group reward<select value={rewardId} disabled={busy||!!plan} onChange={event=>setRewardId(event.target.value)}><option value="">Choose reward</option>{definition.rewards.map(reward=><option key={reward.id} value={reward.id}>{reward.name}</option>)}</select></label>
 <label className="lesson-field">Group amount<input type="number" min={-1000} max={1000} step={1} value={delta} disabled={busy||!!plan} onChange={event=>setDelta(Number(event.target.value))}/></label>
 <label className="lesson-field">Group reason<input value={reason} disabled={busy||!!plan} onChange={event=>setReason(event.target.value)}/></label>
 {!plan&&<button disabled={busy||!rewardId||!reason.trim()} onClick={start}>Apply group adjustment</button>}
 </>}
 {plan&&<div aria-live="polite"><p>{plan.applied.length} applied; {plan.remaining.length} remaining{busy?' — applying…':''}.</p>{plan.applied.length>0&&<p>Applied: {plan.applied.map(target=>`${target.name} (${target.studentId})`).join(', ')}</p>}
 {plan.remaining.length>0&&<><p>Captured recipients and amounts stay fixed for retries. Archived or missing students may be rejected by Core; successful adjustments remain applied.</p><ul>{plan.remaining.map(target=><li key={target.studentId}>{target.name} ({target.studentId}){target.error?`: ${target.error}`:''}</li>)}</ul><button disabled={busy} onClick={()=>void run(plan)}>Retry remaining</button></>}
 {plan.remaining.length===0&&<button disabled={busy} onClick={()=>{if(groupRewardInFlight(store,key)||store.get(key)?.remaining.length)return;store.delete(key);setPlan(null);setReason('');setError('');}}>New group adjustment</button>}</div>}
 {error&&<p role="alert" className="lesson-error">{error}</p>}
 </details>;
}
