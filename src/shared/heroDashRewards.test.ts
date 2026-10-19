import test from 'node:test';
import assert from 'node:assert/strict';
import {createDash,dashAction,dashProjection} from './heroDash';
import {positiveDashReward,cheerPose} from './heroDashRewards';
test('only positive awards trigger correct rewards, including prepared rewards',()=>{
 const view=(s:ReturnType<typeof createDash>)=>dashProjection(s,()=>undefined);
 let s=dashAction(createDash(),{type:'start'});
 for(const amount of [1,2,3,5]){const next=dashAction(s,{type:'move',amount});assert.equal(positiveDashReward(view(s),view(next)),0);s=next;}
 for(const action of [{type:'incorrect'},{type:'move',amount:0},{type:'set-position',position:15},{type:'undo'},{type:'reset'}] as const){const next=dashAction(s,action);assert.equal(positiveDashReward(view(s),view(next)),null);}
 s=dashAction(s,{type:'select',racer:1});assert.equal(positiveDashReward(view(s),view(dashAction(s,{type:'move',amount:2}))),1);
 const reset=dashAction(s,{type:'reset'});assert.equal(positiveDashReward(view(reset),view(dashAction(reset,{type:'undo'}))),null);
});
test('arrival cheer makes exactly three hops and settles back on the ground',()=>{
 for(let jump=0;jump<3;jump++){assert.ok(cheerPose(jump*.65+.325,3).height>.65);assert.equal(cheerPose(jump*.65,3).height,0);}
 assert.deepEqual(cheerPose(1.96,3),{height:0,arms:0,jumps:3,done:true});
});
