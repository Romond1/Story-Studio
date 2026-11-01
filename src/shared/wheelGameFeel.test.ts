import test from 'node:test';
import assert from 'node:assert/strict';
import {createLesson,addCard} from './lesson/commands';
import {insertBreak} from './lesson/sections';
import {createWheelConfig,addWheelActivity} from './lesson/spinningWheel';
import {createSession,navigate,actOnMiniGame} from './lesson/session';
import {initializeLessonRewards,awardLessonReward,addLessonRewardStudent} from './lesson/rewards';
import {projectScene,parseScenePlan} from './lesson/projection';
import type {WheelAction,WheelRuntimeState} from './lesson/wheelRuntime';
function fixture(){
 let p=createLesson(); const b=insertBreak(p,'story'); p=b.project; const entry=p.sequences.story[0];
 const c=addCard(p,entry.sceneId);p=c.project;const card=p.scenes[entry.sceneId].objects.find(o=>o.kind==='card')!;if(card.kind!=='card')throw Error();
 let config=createWheelConfig();config=addWheelActivity(config,'question',card.cardId);config=addWheelActivity(config,'event');
 config.activities[1].config={studentText:'Jump like a frog!',instructions:'PRIVATE',surpriseStyle:'chest'};
 config.settings={...config.settings,playCount:2,questionCount:1};p.scenes[entry.sceneId].breakExperience=config;
 let session=initializeLessonRewards(navigate(p,createSession(),{sequence:'story',entryId:entry.id}),[]);
 const action=(type:WheelAction['type'],extra:Partial<WheelAction>={}):WheelAction=>{const state=session.miniGame as WheelRuntimeState;return {type,sessionId:session.id,occurrenceId:entry.id,visit:session.visit,expectedRevision:state.revision,configKey:state.configKey,atMs:10000,entropy:0,...extra};};
 const send=(type:WheelAction['type'],extra:Partial<WheelAction>={})=>session=actOnMiniGame(p,session,action(type,extra));
 return {p,entry,action,send,addRecipient:(id:string,name:string)=>session=addLessonRewardStudent(session,name,id),away:()=>session=navigate(p,session,null),back:()=>session=navigate(p,session,{sequence:'story',entryId:entry.id}),get session(){return session;}};
}
test('fresh awards can repeat per turn; duplicate commands, replay and confirm never rescore',()=>{
 const f=fixture();f.send('start');f.send('select');f.send('show');
 const award=f.action('award',{rewardVariant:'gold',amount:3,studentId:'lesson-class'});
 f.send('award',{rewardVariant:'gold',amount:3,studentId:'lesson-class'});assert.equal(f.session.rewards!.students[0].stars,3);
 assert.equal(actOnMiniGame(f.p,f.session,award),f.session);
 f.send('award',{rewardVariant:'crown',amount:2,studentId:'lesson-class'});assert.equal(f.session.rewards!.students[0].stars,5);
 f.send('effect',{effectKind:'coins'});const cue=(f.session.miniGame as WheelRuntimeState).effect!;
 f.send('replay-effect');assert.notEqual((f.session.miniGame as WheelRuntimeState).effect!.id,cue.id);assert.equal(f.session.rewards!.students[0].stars,5);
 f.send('skip-effect');assert.equal((f.session.miniGame as WheelRuntimeState).effect,undefined);
 f.send('confirm-outcome');assert.equal(f.session.rewards!.students[0].stars,5);
 const plan=projectScene(f.p,f.entry.sceneId,f.session);assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))),plan);
 assert.equal(JSON.stringify(plan).includes('appliedEventIds'),false);
});
test('invalid awards do not score; explicit awards work after skipping and on the next turn',()=>{
 const f=fixture();f.send('start');f.send('select');f.send('show');
 for(const patch of [{amount:0},{amount:11},{studentId:'missing'}])f.send('award',{rewardVariant:'crown',amount:1,studentId:'lesson-class',...patch});
 assert.equal(f.session.rewards!.students[0].stars,0);f.send('skip-reward');f.send('award',{rewardVariant:'gold',amount:1,studentId:'lesson-class'});assert.equal(f.session.rewards!.students[0].stars,1);
 f.send('complete');f.send('next');f.send('select');f.send('show');
 const plan=projectScene(f.p,f.entry.sceneId,f.session);assert.equal(plan.wheel!.effect!.kind,'chest');assert.equal(JSON.stringify(plan).includes('PRIVATE'),false);
 f.send('award',{rewardVariant:'crown',amount:2,studentId:'lesson-class'});assert.equal(f.session.rewards!.students[0].crowns,2);
 f.send('reset');assert.equal(f.session.rewards!.students[0].crowns,2);assert.equal((f.session.miniGame as WheelRuntimeState).effect,undefined);
});
test('existing reward primitive supports bounded batch scoring with one event identity',()=>{
 let s=initializeLessonRewards(createSession(),[]);s=awardLessonReward(s,'blue','batch',1000,4);assert.equal(s.rewards!.students[0].blueSparks,4);assert.equal(s.rewards!.sparks[0].delta,4);
 assert.equal(awardLessonReward(s,'blue','batch',1001,4),s);
});


test('reward decisions and ledger survive navigation and JSON restoration without duplicate awarding',()=>{
 const f=fixture();f.send('start');f.send('select');f.send('show');
 const delayed=f.action('award',{rewardVariant:'pink',amount:2,studentId:'lesson-class'});
 f.send('award',{rewardVariant:'pink',amount:2,studentId:'lesson-class'});
 f.away();f.back();assert.equal(f.session.rewards!.students[0].pinkSparks,2);
 assert.equal(actOnMiniGame(f.p,f.session,delayed),f.session);
 f.send('award',{rewardVariant:'gold',amount:5,studentId:'lesson-class'});assert.equal(f.session.rewards!.students[0].stars,7);
 const restored=JSON.parse(JSON.stringify(f.session));
 const fresh={...f.action('award'),rewardVariant:'crown' as const,amount:5,studentId:'lesson-class'};const next=actOnMiniGame(f.p,restored,fresh);assert.equal(next.rewards!.students[0].stars,12);assert.equal(actOnMiniGame(f.p,next,fresh),next);
});
test('effects replace rather than queue, preserve replay parameters, and reset cancels stale visual commands',()=>{
 const f=fixture();f.send('start');f.send('select');f.send('show');
 const command=f.action('effect',{effectKind:'coins',durationMs:1700,intensity:.4,sound:true});
 f.send('effect',{effectKind:'coins',durationMs:1700,intensity:.4,sound:true});
 assert.equal(actOnMiniGame(f.p,f.session,command),f.session);
 const first=(f.session.miniGame as WheelRuntimeState).effect!;
 f.send('replay-effect');const replay=(f.session.miniGame as WheelRuntimeState).effect!;
 assert.notEqual(first.id,replay.id);assert.equal(replay.durationMs,1700);assert.equal(replay.intensity,.4);assert.equal(replay.sound,true);
 const plan=projectScene(f.p,f.entry.sceneId,f.session);assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))),plan);
 const before=f.session;f.send('effect',{effectKind:'stars',durationMs:999999});assert.equal(f.session,before);
 f.send('reset');assert.equal((f.session.miniGame as WheelRuntimeState).effect,undefined);assert.equal(actOnMiniGame(f.p,f.session,command),f.session);
 assert.equal(f.session.rewards!.students[0].stars,0);
});

test('magic appearance scale survives public projection and replay without scoring',()=>{
 const f=fixture();f.send('start');f.send('select');f.send('show');f.send('effect',{effectKind:'stars',scale:2.5,intensity:3,durationMs:6000});
 let plan=projectScene(f.p,f.entry.sceneId,f.session);assert.equal(plan.wheel!.effect!.scale,2.5);assert.equal(plan.wheel!.effect!.intensity,3);assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))),plan);
 f.send('replay-effect');plan=projectScene(f.p,f.entry.sceneId,f.session);assert.equal(plan.wheel!.effect!.scale,2.5);assert.equal(plan.wheel!.effect!.durationMs,6000);assert.equal(f.session.rewards!.students[0].stars,0);
});
test('each explicit game award creates its own personal reward pop-up',()=>{
 const f=fixture();f.send('start');f.send('select');f.send('show');f.send('award',{rewardVariant:'pink',amount:1,studentId:'lesson-class'});assert.equal(f.session.rewards!.sparks.length,1);assert.equal(f.session.rewards!.sparks[0].variant,'pink');f.send('award',{rewardVariant:'pink',amount:1,studentId:'lesson-class'});assert.equal(f.session.rewards!.sparks.length,2);
});

test('multiple students can receive repeated awards and magic during the same activity',()=>{
 const f=fixture();f.addRecipient('second','Second student');f.send('start');f.send('select');f.send('show');
 for(let i=0;i<10;i++)f.send('award',{rewardVariant:'gold',amount:1,studentId:i%2?'second':'lesson-class'});
 assert.equal(f.session.rewards!.students.find(s=>s.id==='lesson-class')!.stars,5);
 assert.equal(f.session.rewards!.students.find(s=>s.id==='second')!.stars,5);
 assert.equal(f.session.rewards!.sparks.length,10);
 assert.equal(new Set(f.session.rewards!.sparks.map(s=>s.id)).size,10);
 const before=f.session.rewards!.students;
 f.send('effect',{effectKind:'stars'});f.send('effect',{effectKind:'coins'});f.send('replay-effect');
 assert.deepEqual(f.session.rewards!.students,before);
 f.send('skip-effect');assert.equal(f.session.rewards!.sparks.length,0);
});
