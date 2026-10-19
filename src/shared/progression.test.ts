import test from 'node:test';import assert from 'node:assert/strict';
import {createProgressionState,applyProgressionCommand,findProgressionReplay,getRunInventory} from './progression/reducer';
import {parseProgressionState} from './progression/validation';
import type {ProgressionAuthority,ProgressionCommand} from './progression/model';
import type {RunContext} from './modules/model';
const context:RunContext={sessionId:'s',runId:'run',instanceId:'i',occurrenceId:'o',episodeId:'episode',adventureId:'world',participantIds:['student','guest:visitor']};
const definition={id:'world',version:'1',name:'World',description:'',rewards:[{id:'gem',name:'Gem',kind:'collectible' as const}],relics:[{id:'key',name:'Key',stages:[{id:'one',name:'One',requiredProgress:1}]}]};
const authority:ProgressionAuthority={roster:[{id:'student',name:'Student',archived:false,createdAt:'',updatedAt:''}],activeRun:{context,moduleType:'language-snake',state:'running'}};
const registered=()=>applyProgressionCommand(createProgressionState(),{type:'register-run',commandId:'register',run:{context,moduleType:'language-snake',adventureDefinition:definition,rewardBindings:{'hero-crown':'gem'}}},authority).state;
const reward:ProgressionCommand={type:'record-event',event:{version:1,eventId:'reward',context,sequence:1,type:'reward-requested',payload:{requests:[{participantId:'student',rewardId:'hero-crown',quantity:1},{participantId:'guest:visitor',rewardId:'hero-crown',quantity:1}]}}};
test('durable event replay survives serialization without duplicate request and rejects collision',()=>{
 const before=registered(),once=applyProgressionCommand(before,reward,authority);assert.equal(once.result.accepted,true);assert.equal(before.requests.length,0);
 const restored=parseProgressionState(JSON.parse(JSON.stringify(once.state)));const replay=applyProgressionCommand(restored,reward,{roster:[]});assert.equal(replay.result.duplicate,true);assert.equal(replay.state.revision,once.state.revision);
 const collision={...reward,event:{...reward.event,type:'reward-requested' as const,payload:{requests:[{participantId:'student',rewardId:'hero-crown',quantity:2}]}}};assert.equal(findProgressionReplay(restored,collision)?.accepted,false);
});
test('teacher decisions grant exactly once, guests never grant, snapshots retain identity',()=>{
 let state=applyProgressionCommand(registered(),reward,authority).state;
 const command:ProgressionCommand={type:'decide-reward',commandId:'approve',requestId:state.requests[0].id,decision:'approve'};
 state=applyProgressionCommand(state,command,authority).state;assert.equal(state.students[0].inventory.gem,1);
 assert.equal(applyProgressionCommand(state,{...command,commandId:'another'},authority).result.accepted,false);assert.equal(applyProgressionCommand(state,command,authority).result.duplicate,true);
 assert.equal(applyProgressionCommand(state,{...command,commandId:'guest',requestId:state.requests[1].id},authority).result.accepted,false);
 assert.deepEqual(getRunInventory(state,context)[0],{participantId:'student',rewards:[{rewardId:'gem',quantity:1}]});
});
test('stale, paused, unknown student and corrupt durable state fail closed',()=>{
 assert.equal(applyProgressionCommand(createProgressionState(),{type:'register-run',commandId:'bad',run:{context:{...context,participantIds:['missing']},moduleType:'language-snake'}},authority).result.accepted,false);
 assert.equal(applyProgressionCommand(registered(),reward,{...authority,activeRun:{...authority.activeRun!,state:'paused'}}).result.accepted,false);
 assert.throws(()=>parseProgressionState({...registered(),inventory:{}}));assert.throws(()=>parseProgressionState({...registered(),revision:NaN}));
});
test('teacher request uses captured completion, manual progress isolates adventures',()=>{
 const completion:ProgressionCommand={type:'record-event',event:{version:1,eventId:'done',context,sequence:1,type:'activity-completed',payload:{participantIds:['student'],outcome:'completed'}}};
 let state=applyProgressionCommand(registered(),completion,authority).state;const key=state.history[0].id;
 state=applyProgressionCommand(state,{type:'request-reward',commandId:'request',eventKey:key,rewardId:'gem',quantity:2},authority).state;assert.deepEqual(state.requests.map(r=>r.studentId),['student']);
 state=applyProgressionCommand(state,{type:'advance-relic',commandId:'relic',studentId:'student',adventureDefinition:definition,relicId:'key',progress:3,reason:'Teacher decision'},authority).state;
 state=applyProgressionCommand(state,{type:'adjust-reward',commandId:'other-world',studentId:'student',adventureDefinition:{...definition,id:'other'},rewardId:'gem',delta:2,reason:'Manual'},authority).state;
 assert.equal(state.students.find(s=>s.adventureId==='world')?.relics.key,3);assert.equal(state.students.find(s=>s.adventureId==='other')?.inventory.gem,2);
});

test('prototype-named reward identities use only own authored dictionary values',()=>{
 const d={...definition,rewards:[{id:'toString',name:'Reward',kind:'collectible' as const}]};
 const result=applyProgressionCommand(createProgressionState(),{type:'adjust-reward',commandId:'prototype-test',studentId:'student',adventureDefinition:d,rewardId:'toString',delta:1,reason:'Explicit'},authority);assert.equal(result.result.accepted,true);assert.equal(result.state.students[0].inventory.toString,1);
});

test('durable store rejects receipt identity mismatch and balances without receipts',()=>{
 const stored=registered();assert.throws(()=>parseProgressionState({...stored,receipts:stored.receipts.map(receipt=>({...receipt,key:'forged'}))}));
 assert.throws(()=>parseProgressionState({...stored,students:[{studentId:'student',adventureId:'world',inventory:{gem:99},relics:{},completedEpisodes:[]}]}));
});
test('unknown reward stays actionable, archived approvals fail and captured definition is immutable',()=>{
 const noBinding=applyProgressionCommand(createProgressionState(),{type:'register-run',commandId:'register-no-binding',run:{context,moduleType:'language-snake',adventureDefinition:definition}},authority).state;
 const event:ProgressionCommand={type:'record-event',event:{version:1,eventId:'unknown',context,sequence:1,type:'reward-requested',payload:{requests:[{participantId:'student',rewardId:'unmapped',quantity:1}]}}};
 let state=applyProgressionCommand(noBinding,event,authority).state;assert.match(state.requests[0].blockedReason!,/Choose/);
 const decision:ProgressionCommand={type:'decide-reward',commandId:'select',requestId:state.requests[0].id,decision:'approve',rewardId:'gem'};
 assert.equal(applyProgressionCommand(state,decision,{...authority,roster:authority.roster.map(s=>({...s,archived:true}))}).result.accepted,false);
 state=applyProgressionCommand(state,decision,authority).state;assert.equal(state.students[0].inventory.gem,1);assert.equal(state.history.at(-1)?.delta,1);
});
