import type {ActivityEvent,LifecycleCommand,ModuleLifecycle,RunContext} from './model';
import {acceptActivityEvent,createEventLedger,transitionLifecycle,type EventLedger} from './runtime';
import {validateRunContext} from './protocol';
export interface ActivationRun {sceneIds:string[];index:number;context:RunContext;state:ModuleLifecycle;ledger:EventLedger}
export function initializeActivation(sceneIds:readonly string[],context:RunContext):ActivationRun {
 validateRunContext(context,'context');if(new Set(context.participantIds).size!==context.participantIds.length)throw new Error('Duplicate participants');if(!sceneIds.length||new Set(sceneIds).size!==sceneIds.length)throw new Error('Choose at least one existing Activation scene');
 const captured=JSON.parse(JSON.stringify(context));return {sceneIds:[...sceneIds],index:0,context:captured,state:'initialized',ledger:createEventLedger(captured,'activation-cards')};
}
export function commandActivation(run:ActivationRun,command:LifecycleCommand,nextRunId=run.context.runId):ActivationRun {
 const state=transitionLifecycle(run.state,command,run.context.runId,nextRunId);
 if(command==='reset'){const context={...run.context,runId:nextRunId};return {...run,state,index:0,context,ledger:createEventLedger(context,'activation-cards')};}
 return {...run,state};
}
export function nextActivationScene(run:ActivationRun):ActivationRun {if(run.state!=='running')throw new Error('Activation is not running');return {...run,index:Math.min(run.sceneIds.length-1,run.index+1)};}
export function completeActivation(run:ActivationRun,eventId:string):{run:ActivationRun;event:ActivityEvent} {
 if(run.state!=='running')throw new Error('Activation is not running');
 const event:ActivityEvent={version:1,eventId,context:JSON.parse(JSON.stringify(run.context)),sequence:run.ledger.lastSequence+1,type:'activity-completed',payload:{participantIds:[...run.context.participantIds],outcome:'completed'}};
 const accepted=acceptActivityEvent(run.ledger,event);if(!accepted.result.accepted)throw new Error(accepted.result.reason);
 return {run:{...commandActivation(run,'stop'),ledger:accepted.ledger},event};
}
export async function completeActivationAsync(run:ActivationRun,eventId:string,emit?:(event:ActivityEvent)=>void|Promise<void|{accepted:boolean;reason?:string}>):Promise<{run:ActivationRun;event:ActivityEvent}> {
 const completion=completeActivation(run,eventId);const result=await emit?.(completion.event);if(result&&!result.accepted)throw Error(result.reason??'Activation completion was rejected');return completion;
}
