import test from 'node:test';
import assert from 'node:assert/strict';
import {createLesson,createScene,insertScene} from './lesson/commands';
import {insertBreak} from './lesson/sections';
import {createSession,navigate,enterTeach,actOnMiniGame} from './lesson/session';
import {createWheelConfig,addWheelActivity,prepareWheelPractice} from './lesson/spinningWheel';
import {wheelSessionProblems,type WheelAction,type WheelRuntimeState} from './lesson/wheelRuntime';
import {projectScene,parseScenePlan,sceneImageSources} from './lesson/projection';
import {createMediaRegistry} from './content/mediaRegistry';
import {collectMediaDependencies} from './content/mediaDependencies';
function fixture(){let p=insertScene(createLesson(),'story',createScene('Previous live scene')).project;const b=insertBreak(p,'story');p=b.project;const entry=p.sequences.story.find(e=>e.id===b.entryId)!;let config=addWheelActivity(createWheelConfig(),'question');config.settings={...config.settings,playCount:1,questionCount:1};config.activities[0].config={prompt:'What can you see?',mediaAssetId:'picture'};p.scenes[entry.sceneId].breakExperience=config;p.assets=[{id:'picture',relativePath:'assets/picture.png',filename:'picture.png',originalName:'picture.png',mediaType:'image',sizeBytes:20,importedAt:'2026-10-25'}];return {p,entry,config};}
test('Teach enters the selected mini-game Break instead of resuming the previous live scene',()=>{
 const f=fixture(),previous=f.p.sequences.story[0];const live=navigate(f.p,createSession(),{sequence:'story',entryId:previous.id});
 const taught=enterTeach(f.p,live,{sequence:'story',entryId:f.entry.id});assert.equal(taught.cursor?.entryId,f.entry.id);assert.ok(projectScene(f.p,f.entry.sceneId,taught).wheel);
 assert.equal(enterTeach(f.p,taught,{sequence:'story',entryId:f.entry.id}),taught);
 assert.equal(enterTeach(f.p,taught,{sequence:'story',entryId:previous.id}),taught);
});
test('picture/text questions need no Card, remain private before reveal and serialize through Present',()=>{
 const f=fixture();assert.deepEqual(wheelSessionProblems(f.config,id=>!!f.p.cards[id],id=>f.p.assets.some(a=>a.id===id)),[]);
 let s=enterTeach(f.p,createSession(),{sequence:'story',entryId:f.entry.id});
 const send=(type:WheelAction['type'])=>{const state=s.miniGame as WheelRuntimeState;s=actOnMiniGame(f.p,s,{type,sessionId:s.id,occurrenceId:f.entry.id,visit:s.visit,expectedRevision:state.revision,configKey:state.configKey,entropy:0,atMs:10000});};
 const plan=()=>projectScene(f.p,f.entry.sceneId,s,id=>`media://assets/${id}.png`);
 send('start');send('select');assert.equal(plan().wheel!.activity?.prompt,undefined);assert.equal(plan().wheel!.activity?.media,undefined);
 send('show');const active=plan();assert.equal(active.wheel!.activity!.prompt,'What can you see?');assert.equal(active.wheel!.activity!.media!.kind,'image');assert.deepEqual(sceneImageSources(active),['media://assets/picture.png']);assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(active))),active);
 const bad=JSON.parse(JSON.stringify(active));bad.wheel.activity.media.src='https://remote.invalid/a.png';assert.equal(parseScenePlan(bad),null);
});
test('attachments in active and retained wheel drafts participate in portable dependency tracking',()=>{
 const f=fixture();const saved=JSON.parse(JSON.stringify(f.config));f.p.scenes[f.entry.sceneId].breakExperience={...f.config,savedMiniGames:[saved]};
 const registry=createMediaRegistry({format:'scene',data:f.p});const report=collectMediaDependencies({format:'scene',data:f.p},{get:id=>registry.get(id),has:id=>!!registry.get(id),resolvePath:value=>registry.resolvePath(value)});
 assert.equal(report.complete,true);assert.equal(report.uses.filter(u=>u.assetId==='picture').length,2);
 assert.ok(report.uses.some(u=>u.field.includes('savedMiniGames/0/activities/0/config/mediaAssetId')));
});

test('video/audio playback is scoped, reconstructable and cleared on completion',()=>{
 for(const kind of ['video','audio'] as const){
 const f=fixture();f.p.assets[0]={...f.p.assets[0],mediaType:kind,relativePath:`assets/question.${kind==='video'?'webm':'wav'}`};
 let s=enterTeach(f.p,createSession(),{sequence:'story',entryId:f.entry.id});
 const action=(type:WheelAction['type'],atMs=10000):WheelAction=>{const state=s.miniGame as WheelRuntimeState;return {type,sessionId:s.id,occurrenceId:f.entry.id,visit:s.visit,expectedRevision:state.revision,configKey:state.configKey,entropy:0,atMs};};
 const send=(type:WheelAction['type'],atMs=10000)=>s=actOnMiniGame(f.p,s,action(type,atMs));
 send('start');send('select');send('show');send('media-play');const duplicate=action('media-pause',12000);send('media-pause',12000);
 assert.equal((s.miniGame as WheelRuntimeState).questionPlayback?.positionSec,2);assert.equal(actOnMiniGame(f.p,s,duplicate),s);
 send('media-play',13000);const plan=projectScene(f.p,f.entry.sceneId,s,id=>`media://assets/${id}.webm`);assert.equal(plan.wheel!.activity!.media!.kind,kind);assert.equal(plan.wheel!.activity!.media!.playback!.positionSec,2);assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))),plan);
 send('media-restart',14000);assert.equal((s.miniGame as WheelRuntimeState).questionPlayback!.positionSec,0);send('complete',15000);assert.equal((s.miniGame as WheelRuntimeState).questionPlayback,undefined);
 }
});

test('practice upgrades old wheel drafts without changing saved authored content',()=>{
 const f=fixture();f.p.scenes[f.entry.sceneId].breakExperience={...f.config,configVersion:1,settings:{}};const saved=JSON.stringify(f.p);
 const sandbox=prepareWheelPractice(f.p,{sequence:'story',entryId:f.entry.id});assert.equal(sandbox.scenes[f.entry.sceneId].breakExperience!.mode,'minigame');
 assert.equal((sandbox.scenes[f.entry.sceneId].breakExperience as typeof f.config).configVersion,2);assert.equal(JSON.stringify(f.p),saved);
});
test('malformed retained future drafts stay portable without crashing dependency enumeration',()=>{
 const f=fixture();f.p.scenes[f.entry.sceneId].breakExperience={mode:'classic',savedMiniGames:{}} as any;
 const registry=createMediaRegistry({format:'scene',data:f.p});assert.doesNotThrow(()=>collectMediaDependencies({format:'scene',data:f.p},{get:id=>registry.get(id),has:id=>!!registry.get(id),resolvePath:value=>registry.resolvePath(value)}));
});

test('mini-game projection keeps live zoom and live ink while excluding authored review content',()=>{
 const f=fixture();const scene=f.p.scenes[f.entry.sceneId];
 const authored={id:'private-board-ink',rainbow:false,color:'#ffaa00',size:5,opacity:1,points:[{x:10,y:10,t:1},{x:20,y:20,t:2}]};scene.drawings=[authored];
 const liveInk={...authored,id:'live-game-ink',points:[{x:500,y:300,t:3},{x:600,y:350,t:4}]};
 const session={...navigate(f.p,createSession(),{sequence:'story',entryId:f.entry.id}),viewport:{zoom:2,pan:{x:-300,y:-100}},drawings:[liveInk]};
 const plan=projectScene(f.p,scene.id,session);assert.deepEqual(plan.viewport,session.viewport);assert.deepEqual(plan.drawings,[liveInk]);assert.deepEqual(plan.objects,[]);
 assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan))),plan);assert.ok(!JSON.stringify(plan).includes('private-board-ink'));
 const malformed=JSON.parse(JSON.stringify(plan));malformed.drawings[0].points[0].x='bad';assert.equal(parseScenePlan(malformed),null);
});
