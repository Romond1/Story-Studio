import { createDash, dashProjection, type DashState } from '../heroDash';
import { createScene } from '../lesson/commands';
import type { LessonSession, SceneLessonProject } from '../lesson/model';
import { projectScene } from '../lesson/projection';
import { createSession, navigate } from '../lesson/session';
import { createGameConfig, readWheelSettings } from '../lesson/spinningWheel';
import type { PresentTarget } from '../presentationSnapshot';
import { teamEntryProblems, validateTeamSequence, type TeamActivityEntry } from './activities';

export type TeamRun =
  | {kind:'wheel';instanceId:string;entry:TeamActivityEntry;project:SceneLessonProject;session:LessonSession}
  | {kind:'dash';instanceId:string;entry:TeamActivityEntry;state:DashState};
/** Capture prepared content once. Never mutate the lesson, media pool, or group scores. */
export function createTeamRun(project:SceneLessonProject,entry:TeamActivityEntry,instanceId:string):TeamRun {
  validateTeamSequence([entry]);
  const problems=teamEntryProblems(entry,id=>project.assets.some(asset=>asset.id===id&&asset.mediaType==='image'));
  if(problems.length)throw Error(problems.join(' '));
  const captured=JSON.parse(JSON.stringify(entry)) as TeamActivityEntry;
  if(entry.activityId==='mastery.hero-dash')return {kind:'dash',instanceId,entry:captured,state:createDash({title:entry.title,names:[...entry.settings.racers],checkpoints:entry.settings.trackLength,showText:true,cards:entry.content.questions.map(question=>({id:question.id,image:`asset:${question.imageAssetId!}`,text:question.prompt,note:'',reward:1}))})};
  const scene=createScene(entry.title);scene.id=`team-scene-${instanceId}`;
  const config=createGameConfig('spinning-wheel');
  config.activities=entry.content.questions.map(question=>({id:question.id,kind:'question',config:{label:question.prompt.slice(0,80)||'Image question',prompt:question.prompt,...(question.imageAssetId?{mediaAssetId:question.imageAssetId}:{})}}));
  config.settings={...config.settings,title:entry.title,playCount:config.activities.length,questionCount:config.activities.length,sequenceMode:'randomized',segments:config.activities.map((activity,index)=>({id:`team-segment-${index}`,activityId:activity.id,label:''}))};
  if(!readWheelSettings(config))throw Error('The prepared Wheel configuration is unavailable. Check its questions before launching.');
  scene.breakExperience=config;
  const cursor={sequence:'story' as const,entryId:`team-entry-${instanceId}`};
  const sandbox:SceneLessonProject={...project,scenes:{[scene.id]:scene},sequences:{story:[{id:cursor.entryId,sceneId:scene.id,section:'',kind:'break'}],activation:[]},sections:[]};
  return {kind:'wheel',instanceId,entry:captured,project:sandbox,session:navigate(sandbox,createSession(),cursor)};
}
export function teamRunTarget(run:TeamRun,resolve:(id:string)=>string|undefined):PresentTarget {
  if(run.kind==='dash')return {kind:'game',gameId:'hero-dash',instanceId:run.instanceId,occurrenceId:run.instanceId,dash:dashProjection(run.state,resolve)};
  return {kind:'scene',occurrenceId:run.instanceId,plan:projectScene(run.project,run.project.sequences.story[0].sceneId,run.session,resolve,'break')};
}
