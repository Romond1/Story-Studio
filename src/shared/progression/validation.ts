import type {ProgressionCommand,ProgressionState,StudentAdventureProgress} from './model';
import {parseAdventureDefinition} from '../definitions/validation';
import {parseActivityEvent,sameRunContext,validateRunContext} from '../modules/protocol';
import {arr,bool,fail,identity,num,obj,one,record,shape,str,unique,type Validator} from '../modules/checks';
const canonical=(value:any):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value);
const literal=(expected:unknown):Validator=>(v,p)=>{if(v!==expected)fail(p);};
const key:Validator=(v,p)=>{if(typeof v!=='string'||!v||v.length>2048)fail(p);};
const reason:Validator=(v,p)=>{str(v,p);if(typeof v!=='string'||!v.trim()||v.length>2000)fail(p);};
const definition:Validator=v=>{parseAdventureDefinition(v);};
const context:Validator=(v,p)=>{validateRunContext(v,p);unique((v as any).participantIds,'participants');};
const bindings=record(identity,identity,2000);
export const validateCapturedRun=(withSequence:boolean)=>shape({context,moduleType:one(['activation-cards','language-snake','final-boss-hero']),...(withSequence?{lastSequence:num(0,Number.MAX_SAFE_INTEGER,true)}:{})},{adventureDefinition:definition,rewardBindings:bindings});
export function parseProgressionCommand(value:unknown):ProgressionCommand {
 if(!obj(value))fail('progression command');const v=value as Record<string,any>;
 const base={type:literal(v.type),commandId:identity};
 switch(v.type){
 case'register-run':shape({...base,run:validateCapturedRun(false)})(v,'register');break;
 case'record-event':shape({type:literal('record-event'),event:()=>{if(!parseActivityEvent(v.event))fail('activity event');}})(v,'event');break;
 case'decide-reward':shape({...base,requestId:key,decision:one(['approve','reject'])},{rewardId:identity,reason})(v,'decision');break;
 case'request-reward':shape({...base,eventKey:key,rewardId:identity,quantity:num(1,100000,true)})(v,'reward request');break;
 case'adjust-reward':shape({...base,studentId:identity,adventureDefinition:definition,rewardId:identity,delta:num(-100000,100000,true),reason})(v,'reward adjustment');if(v.delta===0)fail('zero adjustment');break;
 case'advance-relic':shape({...base,studentId:identity,adventureDefinition:definition,relicId:identity,progress:num(0,1000000000,true),reason})(v,'relic progress');break;
 case'complete-episode':shape({...base,studentIds:arr(identity,1,1000),adventureId:identity,episodeId:identity,reason})(v,'episode completion');unique(v.studentIds,'completion participants');break;
 default:fail('progression command type');
 }return JSON.parse(JSON.stringify(v));
}
const result=shape({accepted:literal(true),revision:num(1,Number.MAX_SAFE_INTEGER,true)},{duplicate:bool,reason:str,requestIds:arr(key)});
const request=shape({id:key,eventId:identity,runId:identity,adventureId:identity,episodeId:identity,studentId:identity,moduleRewardId:identity,quantity:num(1,100000,true),status:one(['pending','approved','rejected'])},{rewardId:identity,blockedReason:str,decisionCommandId:identity});
const history=shape({id:key,recordedAt:(v,p)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v)||!Number.isFinite(Date.parse(v)))fail(p);},kind:one(['activity-completed','score-reported','reward-requested','reward-approved','reward-rejected','reward-adjusted','relic-progress','episode-completed']),adventureId:identity,studentIds:arr(identity,0,1000)},{episodeId:identity,runId:identity,eventId:identity,rewardId:identity,relicId:identity,delta:num(-100000,100000,true),progress:num(0,1000000000,true),reason:str,scores:arr(shape({studentId:identity,score:num(-1000000000,1000000000)}),0,1000)});
export function parseProgressionState(value:unknown):ProgressionState {
 shape({version:literal(1),revision:num(0,100000,true),runs:arr(validateCapturedRun(true),0,10000),receipts:arr(shape({key,canonical:str,result}),0,100000),requests:arr(request,0,100000),students:arr(shape({studentId:identity,adventureId:identity,inventory:record(num(0,1000000000,true)),relics:record(num(0,1000000000,true)),completedEpisodes:arr(identity,0,10000)}),0,100000),history:arr(history,0,100000)})(value,'progression store');
 const s=value as ProgressionState;
 unique(s.runs.map(run=>run.context.runId),'stored runs');unique(s.receipts.map(receipt=>receipt.key),'stored receipts');unique(s.requests.map(request=>request.id),'stored requests');unique(s.students.map(student=>JSON.stringify([student.studentId,student.adventureId])),'stored student scope');unique(s.history.map(item=>item.id),'stored history');
 if(s.receipts.length!==s.revision)fail('store receipt revision');
 const commands=new Map<string,ProgressionCommand>();
 for(const [i,receipt] of s.receipts.entries()){
  if(receipt.result.revision!==i+1||receipt.result.duplicate)fail('stored receipt result');const raw=JSON.parse(receipt.canonical);if(raw.type==='record-event')raw.event.sequence=1;const command=parseProgressionCommand(raw);
  const expectedKey=command.type==='record-event'?JSON.stringify(['event',command.event.context.adventureId,command.event.context.episodeId,command.event.context.runId,command.event.eventId]):JSON.stringify(['command',command.commandId]);if(receipt.key!==expectedKey)fail('stored receipt identity');commands.set(receipt.key,command);
 }

 for(const run of s.runs){if(run.adventureDefinition&&(run.adventureDefinition.id!==run.context.adventureId))fail('stored adventure scope');if(run.rewardBindings&&Object.values(run.rewardBindings).some(id=>!run.adventureDefinition?.rewards.some(reward=>reward.id===id)))fail('stored reward binding');}
 for(const request of s.requests){const run=s.runs.find(run=>run.context.runId===request.runId);if(!run||run.context.adventureId!==request.adventureId||run.context.episodeId!==request.episodeId||!run.context.participantIds.includes(request.studentId))fail('stored request context');if(request.rewardId&&!run?.adventureDefinition?.rewards.some(reward=>reward.id===request.rewardId))fail('stored request reward');if(request.status!=='pending'&&!request.decisionCommandId)fail('stored decision identity');if(request.status==='approved'&&(!request.rewardId||request.studentId.startsWith('guest:')))fail('stored approved request');}
 for(const student of s.students){if(student.studentId.startsWith('guest:'))fail('guest private profile');unique(student.completedEpisodes,'stored episode completions');}
 const registered=[...commands.values()].filter((command):command is Extract<ProgressionCommand,{type:'register-run'}>=>command.type==='register-run');
 for(const command of commands.values()){
  if(command.type==='record-event'){const run=s.runs.find(run=>run.context.runId===command.event.context.runId);if(!run||!sameRunContext(run.context,command.event.context)||(run.moduleType==='activation-cards'&&command.event.type!=='activity-completed'))fail('stored event captured context');}
  if(command.type==='adjust-reward'&&!command.adventureDefinition.rewards.some(reward=>reward.id===command.rewardId))fail('stored reward definition');
  if(command.type==='advance-relic'&&!command.adventureDefinition.relics.some(relic=>relic.id===command.relicId))fail('stored relic definition');
 }
 if(registered.length!==s.runs.length)fail('stored captured runs');
 for(const run of s.runs){const {lastSequence:_sequence,...captured}=run;if(!registered.some(command=>canonical(command.run)===canonical(captured)))fail('captured run changed');}
 const requestIds=s.receipts.flatMap(receipt=>receipt.result.requestIds??[]);unique(requestIds,'stored receipt request IDs');if(requestIds.length!==s.requests.length||requestIds.some(id=>!s.requests.some(request=>request.id===id)))fail('stored request receipts');
 for(const request of s.requests){
  const receipt=s.receipts.find(receipt=>receipt.result.requestIds?.includes(request.id))!,origin=commands.get(receipt.key)!,run=s.runs.find(run=>run.context.runId===request.runId)!;
  let expected:{studentId:string;moduleRewardId:string;quantity:number;eventId:string}|undefined;
  if(origin.type==='record-event'&&origin.event.type==='reward-requested'){const index=origin.event.payload.requests.findIndex((_item,i)=>JSON.stringify(['request',receipt.key,i])===request.id);const item=origin.event.payload.requests[index];if(item){if(origin.event.context.runId!==request.runId)fail('stored request run identity');expected={studentId:item.participantId,moduleRewardId:item.rewardId,quantity:item.quantity,eventId:origin.event.eventId};}}
  if(origin.type==='request-reward'){const completion=commands.get(origin.eventKey);if(completion?.type==='record-event'&&completion.event.type==='activity-completed'){const index=completion.event.payload.participantIds.findIndex((_id,i)=>JSON.stringify(['request',receipt.key,i])===request.id);if(index>=0){if(completion.event.context.runId!==request.runId)fail('stored request run identity');expected={studentId:completion.event.payload.participantIds[index],moduleRewardId:origin.rewardId,quantity:origin.quantity,eventId:completion.event.eventId};}}}
  if(!expected||expected.studentId!==request.studentId||expected.moduleRewardId!==request.moduleRewardId||expected.quantity!==request.quantity||expected.eventId!==request.eventId)fail('stored request payload');
  const decision=request.decisionCommandId?commands.get(JSON.stringify(['command',request.decisionCommandId])):undefined;
  if(request.status!=='pending'&&(decision?.type!=='decide-reward'||decision.requestId!==request.id||decision.decision!==(request.status==='approved'?'approve':'reject')))fail('stored decision receipt');
  if(request.status==='approved'&&decision?.type==='decide-reward'){
   const binding=run.rewardBindings&&Object.hasOwnProperty.call(run.rewardBindings,request.moduleRewardId)?run.rewardBindings[request.moduleRewardId]:undefined;
   const rewardId=decision.rewardId??binding??(run.adventureDefinition?.rewards.some(reward=>reward.id===request.moduleRewardId)?request.moduleRewardId:undefined);if(rewardId!==request.rewardId)fail('stored approved reward identity');
  }
 }
 const expectedRows:StudentAdventureProgress[]=[];
 const progress=(studentId:string,adventureId:string)=>{let row=expectedRows.find(row=>row.studentId===studentId&&row.adventureId===adventureId);if(!row){row={studentId,adventureId,inventory:{},relics:{},completedEpisodes:[]};expectedRows.push(row);}return row;};
 const add=(studentId:string,adventureId:string,rewardId:string,delta:number)=>{const row=progress(studentId,adventureId),old=Object.hasOwnProperty.call(row.inventory,rewardId)?row.inventory[rewardId]:0;row.inventory[rewardId]=old+delta;if(row.inventory[rewardId]<0||row.inventory[rewardId]>1000000000)fail('stored balance bounds');};
 for(const command of commands.values()){
  if(command.type==='adjust-reward')add(command.studentId,command.adventureDefinition.id,command.rewardId,command.delta);
  if(command.type==='advance-relic')progress(command.studentId,command.adventureDefinition.id).relics[command.relicId]=command.progress;
  if(command.type==='complete-episode')for(const studentId of command.studentIds){const row=progress(studentId,command.adventureId);if(!row.completedEpisodes.includes(command.episodeId))row.completedEpisodes.push(command.episodeId);}
  if(command.type==='decide-reward'&&command.decision==='approve'){const request=s.requests.find(request=>request.id===command.requestId);if(!request||request.status!=='approved'||request.decisionCommandId!==command.commandId||!request.rewardId)fail('stored duplicate decision');add(request!.studentId,request!.adventureId,request!.rewardId!,request!.quantity);}
 }
 if(canonical(expectedRows)!==canonical(s.students))fail('stored balances do not match durable receipts');
 if(s.history.length!==s.receipts.length-registered.length)fail('stored history count');
 for(const item of s.history){
  const command=commands.get(item.id);if(!command)fail('stored history receipt');let expected:any;
  if(command?.type==='record-event'){const event=command.event;const base={kind:event.type,adventureId:event.context.adventureId,episodeId:event.context.episodeId,runId:event.context.runId,eventId:event.eventId};
   if(event.type==='activity-completed')expected={...base,studentIds:event.payload.participantIds};else if(event.type==='score-reported')expected={...base,studentIds:event.payload.scores.map(score=>score.participantId),scores:event.payload.scores.map(score=>({studentId:score.participantId,score:score.score}))};else expected={...base,studentIds:[...new Set(event.payload.requests.map(request=>request.participantId))]};
  }
  if(command?.type==='request-reward'){const source=commands.get(command.eventKey);if(source?.type!=='record-event'||source.event.type!=='activity-completed')fail('stored completion request');const event=(source as Extract<ProgressionCommand,{type:'record-event'}>).event;if(event.type==='activity-completed')expected={kind:'reward-requested',adventureId:event.context.adventureId,episodeId:event.context.episodeId,runId:event.context.runId,eventId:event.eventId,studentIds:event.payload.participantIds,rewardId:command.rewardId};}
  if(command?.type==='decide-reward'){const request=s.requests.find(request=>request.id===command.requestId);if(request)expected={kind:command.decision==='approve'?'reward-approved':'reward-rejected',adventureId:request.adventureId,episodeId:request.episodeId,runId:request.runId,studentIds:[request.studentId],...(request.rewardId?{rewardId:request.rewardId}:{}),...(command.decision==='approve'?{delta:request.quantity}:{}),...(command.reason?{reason:command.reason}:{})};}
  if(command?.type==='adjust-reward')expected={kind:'reward-adjusted',adventureId:command.adventureDefinition.id,studentIds:[command.studentId],rewardId:command.rewardId,delta:command.delta,reason:command.reason};
  if(command?.type==='advance-relic')expected={kind:'relic-progress',adventureId:command.adventureDefinition.id,studentIds:[command.studentId],relicId:command.relicId,progress:command.progress,reason:command.reason};
  if(command?.type==='complete-episode')expected={kind:'episode-completed',adventureId:command.adventureId,episodeId:command.episodeId,studentIds:command.studentIds,reason:command.reason};
  const {id:_id,recordedAt:_time,...data}=item;if(!expected||canonical(data)!==canonical(expected))fail('stored history payload');
 }
 return JSON.parse(JSON.stringify(s));
}
