import type { StudentRosterEntry } from '../types';
import type { AdventureDefinition } from '../definitions/model';
import type { ProgressionApi } from '../progression/protocol';
type Adjustment=Parameters<ProgressionApi['adjustReward']>[0];
export interface GroupRewardTarget {studentId:string;name:string;input:Adjustment;error?:string}
export interface GroupRewardPlan {applied:GroupRewardTarget[];remaining:GroupRewardTarget[]}
const inFlight=new WeakMap<Map<string,GroupRewardPlan>,Set<string>>();
export const groupRewardInFlight=(store:Map<string,GroupRewardPlan>,key:string)=>inFlight.get(store)?.has(key)??false;
export async function applyStoredGroupReward(store:Map<string,GroupRewardPlan>,key:string,plan:GroupRewardPlan,send:ProgressionApi['adjustReward']):Promise<GroupRewardPlan> {
 if(groupRewardInFlight(store,key))return store.get(key)??plan;
 let locks=inFlight.get(store);if(!locks){locks=new Set();inFlight.set(store,locks);}locks.add(key);
 store.set(key,plan);
 try{const result=await applyGroupReward(plan,send);store.set(key,result);return result;}finally{locks.delete(key);}
}
export function captureGroupReward(input:{participants:string[];roster:StudentRosterEntry[];definition:AdventureDefinition;folder:string;rewardId:string;delta:number;reason:string},uuid:()=>string):GroupRewardPlan {
 if(!Number.isInteger(input.delta)||!input.delta||Math.abs(input.delta)>1000)throw Error('Enter a nonzero whole amount between -1000 and 1000.');
 if(!input.reason.trim())throw Error('A teacher reason is required.');
 if(!input.definition.rewards.some(reward=>reward.id===input.rewardId))throw Error('Choose an authored reward.');
 const targets=[...new Set(input.participants)].flatMap(id=>{const profile=input.roster.find(row=>row.id===id&&!row.archived&&!id.startsWith('guest:'));return profile?[profile]:[];});
 if(!targets.length)throw Error('Select an active permanent student.');
 return {applied:[],remaining:targets.map(profile=>({studentId:profile.id,name:profile.name,input:{commandId:uuid(),expectedFolder:input.folder,studentId:profile.id,adventureDefinition:structuredClone(input.definition),rewardId:input.rewardId,delta:input.delta,reason:input.reason.trim()}}))};
}
export async function applyGroupReward(plan:GroupRewardPlan,send:ProgressionApi['adjustReward']):Promise<GroupRewardPlan> {
 const applied=[...plan.applied],remaining:GroupRewardTarget[]=[];
 for(const target of plan.remaining){try{const result=await send(structuredClone(target.input));if(!result.accepted)throw Error(result.reason??'Core rejected adjustment');applied.push({...target,error:undefined});}catch(error){remaining.push({...target,error:String(error)});}}
 return {applied,remaining};
}
