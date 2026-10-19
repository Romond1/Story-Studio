import test from 'node:test';
import assert from 'node:assert/strict';
import { captureGroupReward, applyGroupReward, applyStoredGroupReward, groupRewardInFlight, type GroupRewardPlan } from './students/groupRewards';
import type { AdventureDefinition } from './definitions/model';
const definition:AdventureDefinition={id:'world',version:'1',name:'World',description:'',rewards:[{id:'coin',name:'Coin',kind:'currency'}],relics:[]};
const roster=['a','b','archived'].map(id=>({id,name:id,archived:id==='archived',createdAt:'',updatedAt:''}));
test('partial lost ACK retries exact captured recipients and IDs without double mint',async()=>{
 let serial=0; const participants=['a','b','a','guest:x','archived','missing'];
 const plan=captureGroupReward({participants,roster,definition,folder:'folder',rewardId:'coin',delta:2,reason:'Team effort'},()=>`id-${++serial}`);
 participants.splice(0,participants.length,'other'); const originalName=definition.name;definition.name='Changed';
 const minted=new Map<string,number>(); const calls:any[]=[]; let lose=true;
 const send=async(input:any)=>{calls.push(structuredClone(input));if(!minted.has(input.commandId))minted.set(input.commandId,input.delta);if(input.studentId==='b'&&lose){lose=false;throw Error('Lost acknowledgement');}return {accepted:true,revision:1};};
 const first=await applyGroupReward(plan,send);assert.equal(first.applied.length,1);assert.equal(first.remaining.length,1);
 const second=await applyGroupReward(first,send);assert.equal(second.applied.length,2);assert.equal(second.remaining.length,0);assert.equal(minted.size,2);assert.deepEqual(calls[1],calls[2]);assert.equal(calls[0].adventureDefinition.name,originalName);definition.name=originalName;
});
test('negative changes retain failed archived target rather than replacing with selection',async()=>{
 const plan=captureGroupReward({participants:['a','b'],roster,definition,folder:'folder',rewardId:'coin',delta:-1,reason:'Correction'},()=>Math.random().toString());
 const result=await applyGroupReward(plan,async input=>({accepted:input.studentId==='a',revision:2,reason:'Student archived'}));
 assert.deepEqual(result.applied.map(row=>row.studentId),['a']);assert.deepEqual(result.remaining.map(row=>row.studentId),['b']);assert.equal(result.remaining[0].input.delta,-1);assert.match(result.remaining[0].error??'',/archived/);
});
test('invalid and empty group intents reject before any command allocation',()=>{
 const input={participants:['guest:x'],roster,definition,folder:'folder',rewardId:'coin',delta:1,reason:'Reason'};
 assert.throws(()=>captureGroupReward(input,()=>{throw Error('allocated');}),/permanent/);
 assert.throws(()=>captureGroupReward({...input,participants:['a'],delta:0},()=>''),/amount/);
 assert.throws(()=>captureGroupReward({...input,participants:['a'],reason:' '},()=>''),/reason/);
});
test('root store retains lost ACK intent across remount and locks concurrent retry',async()=>{
 const store=new Map<string,GroupRewardPlan>(),key='scope';
 const plan=captureGroupReward({participants:['a'],roster,definition,folder:'folder',rewardId:'coin',delta:1,reason:'Reward'},()=> 'stable-id');
 let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});let calls=0;
 const first=applyStoredGroupReward(store,key,plan,async()=>{calls++;await barrier;throw Error('Lost ACK');});
 assert.equal(store.get(key),plan);assert.equal(groupRewardInFlight(store,key),true);
 await applyStoredGroupReward(store,key,store.get(key)!,async()=>{calls++;return {accepted:true,revision:1};});assert.equal(calls,1);
 release();await first;assert.equal(groupRewardInFlight(store,key),false);
 const remountedPlan=store.get(key)!;assert.equal(remountedPlan.remaining[0].input.commandId,'stable-id');
 await applyStoredGroupReward(store,key,remountedPlan,async input=>{assert.equal(input.commandId,'stable-id');return {accepted:true,revision:1,duplicate:true};});
 assert.equal(store.get(key)?.remaining.length,0);assert.equal(store.get(key)?.applied.length,1);
});
