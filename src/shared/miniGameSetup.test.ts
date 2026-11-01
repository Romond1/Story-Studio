import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameConfig,addWheelActivity} from './lesson/spinningWheel';
import {prepareMiniGame} from './lesson/miniGameSetup';
import {selectBreakGame,resolveBreakExperience} from './lesson/miniGameBreak';
test('spoken labels and partial pools can start without rewriting authored content',()=>{
 let c=addWheelActivity(addWheelActivity(createGameConfig('spinning-wheel'),'question'),'question');
 c.activities[0].config={label:'What did you like?'}; const saved=JSON.stringify(c);
 const p=prepareMiniGame(c);assert.equal(p.readyCount,1);assert.equal(p.draftCount,1);assert.equal(p.config.settings.playCount,1);assert.equal(p.config.settings.questionCount,1);assert.equal(p.config.activities[0].config!.prompt,'What did you like?');assert.equal(JSON.stringify(c),saved);
});
test('empty games have a clearly identifiable playable sample without saving it',()=>{
 const c=createGameConfig('magic-hat'),p=prepareMiniGame(c);assert.equal(p.sample,true);assert.ok(p.config.activities.length);assert.equal(c.activities.length,0);
});
test('all game types share content and preserve independent saved configurations',()=>{
 let c=addWheelActivity(createGameConfig('spinning-wheel'),'question');c.activities[0].config={prompt:'A question'};
 const h=selectBreakGame(c,'magic-hat');assert.equal(h.mode,'minigame');if(h.mode!=='minigame')return;
 assert.equal(h.activities[0].id,c.activities[0].id);assert.equal(resolveBreakExperience(h).status,'planned');
 const back=selectBreakGame(h,'spinning-wheel');assert.equal(back.mode,'minigame');if(back.mode==='minigame')assert.deepEqual(back.activities,c.activities);
});

test('excluded drafts and sample rounds retain valid sequence metadata',()=>{
 let c=addWheelActivity(addWheelActivity(createGameConfig('magic-hat'),'question'),'question');c.activities[0].config={prompt:'Ready'};c.settings.sequence=c.activities.map(a=>a.id);
 const prepared=prepareMiniGame(c).config;assert.equal(resolveBreakExperience(prepared).status,'planned');assert.deepEqual(prepared.settings.sequence,[c.activities[0].id]);
 c.activities[0].config={};assert.equal(resolveBreakExperience(prepareMiniGame(c).config).status,'planned');
});

import {createLesson,createScene,insertScene,duplicateEntry} from './lesson/commands';
import {parseLessonProject} from './lesson/validation';
import {createSession,navigate,actOnMiniGame,reconcileSession} from './lesson/session';
import {projectScene,parseScenePlan} from './lesson/projection';
import {initializeLessonRewards} from './lesson/rewards';
import type {WheelAction,WheelRuntimeState} from './lesson/wheelRuntime';
test('hat/cards share timed reveal, reload, privacy, quotas and exactly-once rewards',()=>{
 for(const gameType of ['magic-hat','mystery-cards']){
 const added=insertScene(createLesson(),'story',createScene('Break'));const p=added.project,entry=p.sequences.story[0];entry.kind='break';
 let c=createGameConfig(gameType);for(let i=0;i<6;i++){c=addWheelActivity(c,i<3?'question':'event');c.activities[i].config={label:`Outcome ${i}`,prompt:`PRIVATE QUESTION ${i}`,instructions:'TEACHER SECRET',studentText:'A surprise'};}
 c.settings={...c.settings,autoSession:false,playCount:4,questionCount:2,sequenceMode:'alternating'};p.scenes[entry.sceneId].breakExperience=c;
 const roundTrip=parseLessonProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(roundTrip.scenes[entry.sceneId].breakExperience,c);
 const copied=duplicateEntry(p,'story',entry.id,'story');const copy=copied.project.scenes[copied.project.sequences.story.find(e=>e.id===copied.entryId)!.sceneId].breakExperience;
 assert.equal(copy?.mode,'minigame');if(copy?.mode==='minigame')assert.notEqual(copy.activities[0].id,c.activities[0].id);
 let session=initializeLessonRewards(navigate(p,createSession(),{sequence:'story',entryId:entry.id}),[]);
 const command=(type:WheelAction['type'],extra:Partial<WheelAction>={}):WheelAction=>{const state=session.miniGame as WheelRuntimeState;return {type,sessionId:session.id,occurrenceId:entry.id,visit:session.visit,expectedRevision:state.revision,configKey:state.configKey,entropy:.3,cardIndex:0,atMs:10000,...extra};};
 const send=(type:WheelAction['type'],extra:Partial<WheelAction>={})=>{session=actOnMiniGame(p,session,command(type,extra));};
 const plan=()=>projectScene(p,entry.sceneId,session);
 assert.ok(!JSON.stringify(plan().wheel).includes('PRIVATE QUESTION'));
 send('start');const before=plan();assert.ok(!JSON.stringify(before.wheel).includes('PRIVATE QUESTION'));assert.ok(!JSON.stringify(before.wheel).includes('dealtSegmentIds'));assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(before))),before);
 send('select',{spin:{startedAt:10000,durationMs:1500}});assert.equal(session.miniGame!.phase,'revealed');const selected=plan();assert.ok(!JSON.stringify(selected.wheel).includes('PRIVATE QUESTION'));assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(selected))),selected);
 send('show',{atMs:11000});assert.equal(session.miniGame!.phase,'revealed');session=reconcileSession(p,JSON.parse(JSON.stringify(session)));send('show',{atMs:11500});assert.equal(session.miniGame!.phase,'active');assert.ok(JSON.stringify(plan().wheel).includes('PRIVATE QUESTION'));assert.ok(!JSON.stringify(plan().wheel).includes('TEACHER SECRET'));
 const revealBefore=plan().wheel!.reveal;
 const award=command('award',{rewardVariant:'gold',amount:1,studentId:session.rewards!.students[0].id,atMs:12000});session=actOnMiniGame(p,session,award);assert.deepEqual(plan().wheel!.reveal,revealBefore);const after=JSON.stringify(session);session=actOnMiniGame(p,session,award);assert.equal(JSON.stringify(session),after);
 send('complete',{atMs:12000});for(let i=1;i<4;i++){send('next');send('select');send('show');send('complete');}assert.equal(session.miniGame!.phase,'session-complete');const state=session.miniGame as WheelRuntimeState;assert.equal(new Set(state.usedActivityIds).size,4);assert.equal(state.usedActivityIds.filter(id=>c.activities.find(a=>a.id===id)?.kind==='question').length,2);
 assert.deepEqual(parseScenePlan(JSON.parse(JSON.stringify(plan()))),plan());send('reset');assert.equal(session.miniGame!.phase,'ready');
 }
});

import {createEpisodeFromScene} from './episode/commands';
import {parseSceneDocument} from './lesson/validation';
import {exportEpisodePackage,importEpisodePackage} from '../main/episodePackageService';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
test('hat and cards portable packages preserve active and retained game settings',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'game-variety-package-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(const gameType of ['magic-hat','mystery-cards']){
 const added=insertScene(createLesson(),'story',createScene('Break')),p=added.project,entry=p.sequences.story[0];entry.kind='break';let c=addWheelActivity(createGameConfig(gameType),'question');c.activities[0].config={prompt:'Keep this question'};
 p.scenes[entry.sceneId].breakExperience={...c,savedMiniGames:[createGameConfig(gameType==='magic-hat'?'mystery-cards':'magic-hat',c)]};
 const episode={...createEpisodeFromScene(p,{id:'adventure',version:'1'}),adventureDefinition:{id:'adventure',version:'1',name:'Adventure',description:'',rewards:[],relics:[]}};episode.requiredCapabilities.push('adventure-definitions-v1');
 const source=path.join(root,gameType+'-source'),target=path.join(root,gameType+'-package'),editable=path.join(root,gameType+'-editable');for(const folder of [source,target,editable])await fs.mkdir(folder);
 await fs.writeFile(path.join(source,'project.json'),JSON.stringify(episode));await exportEpisodePackage({source,target,data:episode,builtinRoot:root,assertCurrent:()=>{}});await importEpisodePackage({source:target,target:editable,assertCurrent:()=>{}});
 const loaded=parseSceneDocument(JSON.parse(await fs.readFile(path.join(editable,'project.json'),'utf8')));assert.deepEqual(loaded.scenes[entry.sceneId].breakExperience,p.scenes[entry.sceneId].breakExperience);assert.ok(!JSON.stringify(loaded).includes('dealtSegmentIds'));
 }
});
