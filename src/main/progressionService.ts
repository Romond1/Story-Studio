import { createHash } from 'node:crypto';
import type { ProgressionApi } from '../shared/progression/protocol';
import type { ProgressionAuthority, ProgressionCommand } from '../shared/progression/model';
import type { ModuleLifecycle, ModuleType, RunContext } from '../shared/modules/model';
import type { HostToModuleMessage, ModuleToHostMessage } from '../shared/modules/protocol';
import { parseActivityEvent, sameRunContext } from '../shared/modules/protocol';
import type { StudentRosterEntry } from '../shared/types';
import { ProgressionRepository } from './progressionRepository';

type Input<K extends keyof ProgressionApi>=Parameters<ProgressionApi[K]>[0];
type Scope={folderPath:string;episodeId:string;adventureId:string;leaseId:string};
type LiveRun={scope:Scope;context:RunContext;moduleType:ModuleType;state:ModuleLifecycle;generation?:number};
const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`:JSON.stringify(value);
const fingerprint=(event:Input<'recordEvent'>)=>{const {sequence:_,...payload}=event;return createHash('sha256').update(canonical(payload)).digest('hex');};
const eventKey=(event:Input<'recordEvent'>)=>JSON.stringify([event.context.adventureId,event.context.episodeId,event.context.runId,event.eventId]);
/** Runtime authorization is ephemeral; durable effects and replay receipts belong to the repository. */
export class ProgressionService implements ProgressionApi {
 private runs=new Map<string,LiveRun>();
 private eligible=new Map<string,string>();
 constructor(private repository:ProgressionRepository,private host:{getScope:()=>Scope|null;getRoster:()=>Promise<StudentRosterEntry[]>}){}
 private capture(folder:unknown){const scope=this.host.getScope();if(!scope||scope.folderPath!==folder)throw Error('Active episode scope changed.');return {...scope};}
 private assertScope(scope:Scope){const now=this.host.getScope();if(!now||now.folderPath!==scope.folderPath||now.episodeId!==scope.episodeId||now.adventureId!==scope.adventureId||now.leaseId!==scope.leaseId)throw Error('Active episode lease changed.');}
 private live(runId:string){const run=this.runs.get(runId);if(!run)throw Error('Run is not registered in this session.');this.assertScope(run.scope);return run;}
 private authority(run?:LiveRun):Promise<ProgressionAuthority>{return this.host.getRoster().then(roster=>({roster,...(run?{activeRun:{context:run.context,moduleType:run.moduleType,state:run.state}}:{})}));}
 getSnapshot(){return this.repository.snapshot();}
 async registerRun(input:Input<'registerRun'>){
  const scope=this.capture(input.expectedFolder);if(input.context?.episodeId!==scope.episodeId||input.context.adventureId!==scope.adventureId)throw Error('Run episode scope changed.');
  const command:ProgressionCommand={type:'register-run',commandId:input.commandId??`register:${input.context.runId}`,run:{context:input.context,moduleType:input.moduleType,...(input.adventureDefinition?{adventureDefinition:input.adventureDefinition}:{}),...(input.rewardBindings?{rewardBindings:input.rewardBindings}:{})}};
  const result=await this.repository.transact(command,()=>this.authority(),()=>this.assertScope(scope));
  if(result.accepted){this.assertScope(scope);if(this.runs.size>=100&&!this.runs.has(input.context.runId)){const oldest=this.runs.keys().next().value;if(oldest)this.runs.delete(oldest);}this.runs.set(input.context.runId,{scope,context:JSON.parse(JSON.stringify(input.context)),moduleType:input.moduleType,state:'initialized'});}
  return result;
 }
 authorizeInitialize(message:HostToModuleMessage){try{const run=this.live(message.context.runId);return run.moduleType===message.moduleType&&sameRunContext(run.context,message.context)&&run.state!=='stopped'&&run.state!=='disposed'&&(run.generation===undefined||run.generation===message.hostGeneration);}catch{return false;}}
 acceptedModule(message:ModuleToHostMessage){
  let run:LiveRun;try{run=this.live(message.context.runId);}catch{return;}if(run.moduleType!==message.moduleType||!sameRunContext(run.context,message.context)||run.generation!==message.hostGeneration)return;
  if(message.type==='ack'){const state=message.command==='start'||message.command==='resume'?'running':message.command==='pause'?'paused':message.command==='initialize'?'initialized':message.command==='dispose'?'disposed':'stopped';run.state=state;}
  if(message.type==='error')run.state='stopped';
  if(message.type==='event'&&run.state==='running'&&this.eligible.size<10000&&!this.eligible.has(eventKey(message.event)))this.eligible.set(eventKey(message.event),fingerprint(message.event));
 }
 hostCommand(message:HostToModuleMessage){const run=this.runs.get(message.context.runId);if(!run||!sameRunContext(run.context,message.context))return;if(message.type==='initialize')run.generation=message.hostGeneration;if(message.type==='pause')run.state='paused';if(message.type==='stop'||message.type==='dispose')run.state=message.type==='stop'?'stopped':'disposed';}
 // Stop prevents new eligibility, while already observed results may finish their queued transaction.
 retire(instanceId?:string){for(const run of this.runs.values())if(!instanceId||run.context.instanceId===instanceId)run.state='stopped';}
 async recordEvent(value:Input<'recordEvent'>){const event=parseActivityEvent(value);if(!event)throw Error('Invalid activity event.');const key=eventKey(event);
  const result=await this.repository.transact({type:'record-event',event},async()=>this.authority({...this.live(event.context.runId),state:'running'}),()=>{const run=this.live(event.context.runId);if(run.moduleType==='activation-cards'||!sameRunContext(run.context,event.context)||this.eligible.get(key)!==fingerprint(event))throw Error('Activity event was not observed by the authorized running transport.');});
  if(result.accepted)this.eligible.delete(key);return result;
 }
 async lifecycle(input:Input<'lifecycle'>){const run=this.live(input.runId);if(run.moduleType!=='activation-cards'){if(input.state==='stopped'||input.state==='disposed')run.state=input.state;else throw Error('Module lifecycle requires transport acknowledgment.');return;}if(!['initialized','running','paused','stopped','disposed'].includes(input.state))throw Error('Invalid lifecycle.');if((run.state==='stopped'||run.state==='disposed')&&input.state!=='stopped'&&input.state!=='disposed')throw Error('Start a new run after stopping.');run.state=input.state;}
 async completeActivation(input:Input<'completeActivation'>){const snapshot=await this.repository.snapshot(),captured=snapshot.runs.find(run=>run.context.runId===input.runId);if(!captured||captured.moduleType!=='activation-cards')throw Error('Activation run required.');
  const event={version:1 as const,eventId:input.commandId,context:captured.context,sequence:captured.lastSequence+1,type:'activity-completed' as const,payload:{participantIds:captured.context.participantIds,outcome:input.outcome}};
  return this.repository.transact({type:'record-event',event},()=>this.authority(this.live(input.runId)),()=>{if(this.live(input.runId).state!=='running')throw Error('Activation is not running.');});
 }
 decideReward(input:Input<'decideReward'>){return this.repository.transact({...input,type:'decide-reward'},()=>this.authority());}
 requestReward(input:Input<'requestReward'>){return this.repository.transact({...input,type:'request-reward'},()=>this.authority());}
 adjustReward(input:Input<'adjustReward'>){const scope=this.capture(input.expectedFolder);if(input.adventureDefinition?.id!==scope.adventureId)throw Error('Adventure scope changed.');const {expectedFolder:_,...value}=input;return this.repository.transact({...value,type:'adjust-reward'},()=>this.authority(),()=>this.assertScope(scope));}
 advanceRelic(input:Input<'advanceRelic'>){const scope=this.capture(input.expectedFolder);if(input.adventureDefinition?.id!==scope.adventureId)throw Error('Adventure scope changed.');const {expectedFolder:_,...value}=input;return this.repository.transact({...value,type:'advance-relic'},()=>this.authority(),()=>this.assertScope(scope));}
 completeEpisode(input:Input<'completeEpisode'>){const scope=this.capture(input.expectedFolder);if(input.episodeId!==scope.episodeId||input.adventureId!==scope.adventureId)throw Error('Episode scope changed.');const {expectedFolder:_,...value}=input;return this.repository.transact({...value,type:'complete-episode'},()=>this.authority(),()=>this.assertScope(scope));}
 async getRunInventory(context:RunContext){const run=this.live(context.runId);if(!sameRunContext(run.context,context))throw Error('Inventory run context changed.');const state=await this.repository.snapshot();this.assertScope(run.scope);return run.context.participantIds.map(participantId=>({participantId,rewards:participantId.startsWith('guest:')?[]:Object.entries(state.students.find(s=>s.studentId===participantId&&s.adventureId===context.adventureId)?.inventory??{}).map(([rewardId,quantity])=>({rewardId,quantity}))}));}
}
