import type {MiniGameConfig} from './miniGameBreak';
import type {LessonProject} from './model';
import {readWheelSettings,questionHasContent} from './spinningWheel';
/** Build a playable round without changing the teacher's saved pool or drafts. */
export function prepareMiniGame(original:MiniGameConfig,project?:LessonProject) {
 const settings=readWheelSettings(original);
 if(!settings)return {config:original,readyCount:0,draftCount:0,sample:false,adjusted:false};
 const config:MiniGameConfig=JSON.parse(JSON.stringify(original));
 const assigned=new Set(settings.segments.map(s=>s.activityId));
 config.activities=config.activities.filter(a=>assigned.has(a.id)).map(a=>{
  if(a.kind!=='question')return a;
  if(project && a.contentRef && !project.cards[a.contentRef]?.faces.length)delete a.contentRef;
  if(project && typeof a.config?.mediaAssetId==='string' && !project.assets.some(m=>m.id===a.config!.mediaAssetId && ['image','video','audio'].includes(m.mediaType)))delete a.config!.mediaAssetId;
  if(!a.contentRef && !a.config?.mediaAssetId && !(typeof a.config?.prompt==='string' && a.config.prompt.trim()) && typeof a.config?.label==='string' && a.config.label.trim())a.config={...a.config,prompt:a.config.label};
  return a;
 }).filter(a=>a.kind==='event' || questionHasContent(a));
 const readyCount=config.activities.length,draftCount=original.activities.length-readyCount,sample=!readyCount;
 if(sample)config.activities=[{id:'practice-question',kind:'question',config:{prompt:'Name something you learned today.',label:'A question to try'}},{id:'practice-event',kind:'event',config:{label:'A little magic',studentText:'Give your class a round of applause!',surpriseStyle:'portal'}}];
 let segments=settings.segments.filter(s=>config.activities.some(a=>a.id===s.activityId));
 if(sample)segments=config.activities.map(a=>({id:`sample-${a.id}`,activityId:a.id,label:''}));
 const questions=config.activities.filter(a=>a.kind==='question').length,events=config.activities.length-questions;
 const playCount=sample?2:settings.autoSession===true?readyCount:Math.min(settings.playCount,readyCount);
 const questionCount=settings.autoSession===true || sample?questions:Math.max(playCount-events,Math.min(settings.questionCount,questions,playCount));
 const sequenceMode=sample?'randomized':settings.sequenceMode==='alternating' && ![playCount-questionCount,playCount-questionCount+1].includes(questionCount)?'randomized':settings.sequenceMode;
 config.settings={...settings,playCount,questionCount,sequenceMode,segments,...(Array.isArray(settings.sequence)?{sequence:settings.sequence.filter(id=>config.activities.some(a=>a.id===id))}:{})};
 return {config,readyCount,draftCount,sample,adjusted:playCount!==settings.playCount || questionCount!==settings.questionCount || sequenceMode!==settings.sequenceMode};
}
