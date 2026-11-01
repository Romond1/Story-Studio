import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeWheel, transitionWheel, restoreWheel, type WheelAction, type WheelRuntimeState } from './lesson/wheelRuntime';
import type { MiniGameConfig } from './lesson/miniGameBreak';
function fixture(): MiniGameConfig {
 return {mode:'minigame',gameType:'mystery-cards',configVersion:2,settings:{title:'Archive',playCount:4,questionCount:4,sequenceMode:'randomized',visibleCards:3,segments:Array.from({length:6},(_,i)=>({id:`s${i}`,activityId:`a${i}`,label:''}))},activities:Array.from({length:6},(_,i)=>({id:`a${i}`,kind:'question',config:{prompt:`Question ${i}`}}))};
}
function act(config:MiniGameConfig,state:WheelRuntimeState,type:WheelAction['type'],extra:Partial<WheelAction>={}) {
 return transitionWheel(config,state,{type,configKey:state.configKey,expectedRevision:state.revision,sessionId:'session',occurrenceId:'entry',visit:1,entropy:.4,...extra});
}
test('mystery deals are authoritative before choice and restored without remapping',()=>{
 const config=fixture(), state=act(config,initializeWheel(config)!,'start');
 assert.equal(state.phase,'selecting'); assert.equal(state.dealtSegmentIds?.length,3);
 const restored=restoreWheel(config,JSON.parse(JSON.stringify(state)))!;
 assert.deepEqual(restored,state);
 const chosen=act(config,restored,'select',{cardIndex:1,entropy:.999,segmentId:'s0'});
 assert.equal(chosen.selectedSegmentId,state.dealtSegmentIds![1]); assert.equal(chosen.selectedCardIndex,1);
 assert.deepEqual(restoreWheel(config,chosen),chosen);
 assert.deepEqual(act(config,state,'select',{cardIndex:99}),state);
 assert.deepEqual(act(config,initializeWheel(config)!,'start'),state);
});
test('next excludes consumed activities and shuffle uses revision guard',()=>{
 const config=fixture(); let state=act(config,initializeWheel(config)!,'start');
 const old=state, shuffled=act(config,state,'shuffle',{entropy:.8,spin:{startedAt:100,durationMs:900}});
 assert.equal(shuffled.revision,state.revision+1); assert.equal(shuffled.shuffle?.startedAt,100);
 assert.deepEqual(restoreWheel(config,shuffled),shuffled);
 assert.equal(act(config,shuffled,'select',{cardIndex:0,expectedRevision:old.revision}),shuffled);
 state=act(config,shuffled,'select',{cardIndex:0}); const used=state.currentActivityId;
 state=act(config,state,'show'); state=act(config,state,'complete');
 assert.deepEqual(restoreWheel(config,state),state);
 state=act(config,state,'next');
 assert.equal(state.phase,'selecting'); assert.equal(state.selectedCardIndex,undefined);
 assert.ok(state.dealtSegmentIds!.every(id=>config.settings.segments && id!==`s${used!.slice(1)}`));
 assert.deepEqual(restoreWheel(config,state),state);
 const corrupt={...state,dealtSegmentIds:['s'+used!.slice(1)]};
 assert.equal(restoreWheel(config,corrupt)?.phase,'ready');
});
test('deal deduplicates activities and validates selected mapping',()=>{
 const config=fixture(); (config.settings.segments as any[]).push({id:'duplicate',activityId:'a0',label:''});
 const state=act(config,initializeWheel(config)!,'start');
 const mapping=config.settings.segments as {id:string;activityId:string}[];
 assert.equal(new Set(state.dealtSegmentIds!.map(id=>mapping.find(s=>s.id===id)!.activityId)).size,state.dealtSegmentIds!.length);
 const selected=act(config,state,'select',{cardIndex:0});
 assert.equal(restoreWheel(config,{...selected,selectedCardIndex:1})?.phase,'ready');
});

test('completed final deal and early finish restore; alternating deals follow the next quota',()=>{
 const config=fixture(); config.settings.playCount=2; config.settings.questionCount=1; config.settings.sequenceMode='alternating';
 config.activities.slice(3).forEach(activity=>{activity.kind='event';activity.config={studentText:'Move'};});
 let state=act(config,initializeWheel(config)!,'start');
 assert.ok(state.dealtSegmentIds!.every(id=>Number(id.slice(1))<3));
 const finished=act(config,state,'finish'); assert.deepEqual(restoreWheel(config,finished),finished);
 state=act(config,state,'select',{cardIndex:0}); state=act(config,state,'show'); state=act(config,state,'complete'); state=act(config,state,'next');
 assert.ok(state.dealtSegmentIds!.every(id=>Number(id.slice(1))>=3));
 state=act(config,state,'select',{cardIndex:0}); state=act(config,state,'show'); state=act(config,state,'complete');
 assert.equal(state.phase,'session-complete'); assert.deepEqual(restoreWheel(config,state),state);
});
test('manual deals preserve authored order until explicit shuffle; each-turn deals consume entropy',()=>{
 const config=fixture(); config.settings.shuffleBehavior='manual';
 let state=act(config,initializeWheel(config)!,'start',{entropy:.99});
 assert.deepEqual(state.dealtSegmentIds,['s0','s1','s2']);
 const shuffled=act(config,state,'shuffle',{entropy:.4});
 assert.notDeepEqual(shuffled.dealtSegmentIds,state.dealtSegmentIds);
 state=act(config,state,'select',{cardIndex:1});state=act(config,state,'show');state=act(config,state,'complete');state=act(config,state,'next',{entropy:.99});
 assert.deepEqual(state.dealtSegmentIds,['s0','s2','s3']);
 config.settings.shuffleBehavior='each-turn';
 const random=act(config,initializeWheel(config)!,'start',{entropy:.4});
 assert.deepEqual(random.dealtSegmentIds,shuffled.dealtSegmentIds);
});
