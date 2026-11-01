import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSharedAdventure, awardSharedPoints, teamPlayDisplayName } from './sharedAdventure';
import { createLesson } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import { listTeamActivities, createTeamEntry, validateTeamSequence } from './teamPlay/activities';
import { createTeamRun, teamRunTarget } from './teamPlay/runtime';
import { projectTeamScoreboard } from './teamPlay/scoreboard';
import { parsePresentSnapshot } from './presentationSnapshot';
import { dashAction } from './heroDash';
import { actOnMiniGame } from './lesson/session';
import { initializeWheel } from './lesson/wheelRuntime';

const lesson = () => ({...createLesson('Team lesson'), sharedAdventure:createSharedAdventure(), assets:[{id:'clue',filename:'clue.png',originalName:'clue.png',relativePath:'assets/clue.png',mediaType:'image' as const,sizeBytes:12,importedAt:new Date().toISOString()}]});
const content = {version:1 as const,questions:[{id:'question',prompt:'What can you see?',imageAssetId:'clue'}]};
test('Team Play navigation keeps internal shared destination and old saved groups load unchanged',()=>{
  const source=readFileSync('src/renderer/Beginning.tsx','utf8');
  assert.match(source,/id: 'shared', label: 'Team Play'/);
  const project=lesson();project.sharedAdventure.preparation.name='Shared Adventure';
  const before=JSON.stringify(project),loaded=parseLessonProject(JSON.parse(before));
  assert.equal(teamPlayDisplayName(loaded.sharedAdventure!.preparation.name),'Team Play');
  assert.equal(loaded.sharedAdventure!.preparation.name,'Shared Adventure');
  assert.equal(teamPlayDisplayName('Our hero team'),'Our hero team');
});
test('registry separates compatibility from launch availability and filters sources',()=>{
  assert.deepEqual(listTeamActivities(undefined,true).map(item=>item.id).sort(),['discovery.spinning-wheel','mastery.hero-dash']);
  assert.ok(listTeamActivities('Challenge').every(item=>!item.playable&&item.compatibility==='Unsupported'));
  assert.ok(listTeamActivities('Team Play').every(item=>!item.playable));
  assert.equal(listTeamActivities('Mastery',true)[0].name,'Hero Dash');
});
test('prepared entries round trip without converting to episodes or changing group scores',()=>{
  const project=lesson();const entry=createTeamEntry('discovery.spinning-wheel',content,'wheel');
  project.sharedAdventure.preparation.activities=[entry];
  project.sharedAdventure=awardSharedPoints(project.sharedAdventure,['student-1'],5);
  const loaded=parseLessonProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(loaded.sharedAdventure,project.sharedAdventure);
  assert.equal(loaded.format,'story-studio-scene');
  const broken=structuredClone(project);broken.sharedAdventure.preparation.activities![0].content.questions[0].imageAssetId='other-episode';
  assert.throws(()=>parseLessonProject(broken));
  assert.throws(()=>validateTeamSequence([entry,entry]));
  assert.throws(()=>createTeamEntry('challenge.language-snake',content,'snake'));
});
test('Spinning Wheel adapter uses existing scene runtime and explicit questions only',()=>{
  const project=lesson(),before=JSON.stringify(project),entry=createTeamEntry('discovery.spinning-wheel',content,'wheel');
  const run=createTeamRun(project,entry,'run-wheel');assert.equal(run.kind,'wheel');if(run.kind!=='wheel')return;
  const scene=run.project.scenes[run.project.sequences.story[0].sceneId],config=scene.breakExperience!;
  assert.equal(config.mode,'minigame');if(config.mode!=='minigame')return;
  const initial=initializeWheel(config)!;
  run.session=actOnMiniGame(run.project,run.session,{type:'start',expectedRevision:initial.revision,configKey:initial.configKey,sessionId:run.session.id,occurrenceId:run.session.cursor!.entryId,visit:run.session.visit,atMs:1000});
  const target=teamRunTarget(run,id=>`media://scoped/test/${id}`);
  assert.equal(target.kind,'scene');assert.ok(target.kind==='scene'&&target.plan.wheel);
  assert.ok(parsePresentSnapshot({sessionId:'group',revision:2,target}));
  assert.equal(JSON.stringify(project),before);
});
test('Hero Dash uses native state and explicit local content without mapping its score to group points',()=>{
  const project=lesson(),entry=createTeamEntry('mastery.hero-dash',content,'race'),before=JSON.stringify(project.sharedAdventure);
  const run=createTeamRun(project,entry,'run-dash');assert.equal(run.kind,'dash');if(run.kind!=='dash')return;
  assert.equal(run.state.config.cards[0].image,'asset:clue');
  run.state=dashAction(dashAction(run.state,{type:'start'}),{type:'move',amount:3});
  const target=teamRunTarget(run,id=>`media://scoped/test/${id}`);
  assert.equal(target.kind,'game');assert.ok(parsePresentSnapshot({sessionId:'group',revision:3,target}));
  assert.equal(JSON.stringify(project.sharedAdventure),before);
  const missing=createTeamEntry('mastery.hero-dash',{version:1,questions:[{id:'text',prompt:'No picture'}]},'missing');
  assert.throws(()=>createTeamRun(project,missing,'invalid'));
});
test('valid long question identities remain playable through the Wheel adapter',()=>{
  const project=lesson(),entry=createTeamEntry('discovery.spinning-wheel',{version:1,questions:[{id:'q'.repeat(200),prompt:'Describe the picture',imageAssetId:'clue'}]},'long-question');
  const target=teamRunTarget(createTeamRun(project,entry,'long-run'),id=>`media://scoped/test/${id}`);
  assert.ok(target.kind==='scene'&&target.plan.wheel,'a valid saved question must not become an unavailable wheel');
});
test('scoreboard overlays are whitelisted across game/scene targets without changing target identity',()=>{
  const project=lesson();project.sharedAdventure.live.scoreboard=true;
  const run=createTeamRun(project,createTeamEntry('mastery.hero-dash',content,'race'),'stable-instance');
  const target=teamRunTarget(run,()=>undefined),before=parsePresentSnapshot({sessionId:'group',revision:3,target})!.target;
  const scoreboard=projectTeamScoreboard(awardSharedPoints(project.sharedAdventure,['student-1','student-2'],5));
  const parsed=parsePresentSnapshot({sessionId:'group',revision:4,target,teamScoreboard:{...scoreboard,teacherAnswer:'PRIVATE',devices:['Italy']}})!;
  assert.deepEqual(parsed.target,before);
  assert.equal(parsed.teamScoreboard!.score,10);
  assert.equal(JSON.stringify(parsed).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(parsed.teamScoreboard).includes('Italy'),false);
  assert.equal(parsePresentSnapshot({sessionId:'group',revision:5,target,teamScoreboard:{...scoreboard,score:NaN}}),null);
});
