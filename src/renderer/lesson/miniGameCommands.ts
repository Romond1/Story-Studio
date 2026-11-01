import type {LessonProject,LessonSession} from '../../shared/lesson/model';
import type {MiniGameConfig} from '../../shared/lesson/miniGameBreak';
import {prepareMiniGame} from '../../shared/lesson/miniGameSetup';
import {restoreWheel,initializeWheel,type WheelAction} from '../../shared/lesson/wheelRuntime';
export function gameCommand(config:MiniGameConfig,session:LessonSession,type:WheelAction['type'],extra:Partial<WheelAction>={}):WheelAction {
 const state=restoreWheel(config,session.miniGame)??initializeWheel(config)!;
 const atMs=Date.now(),durationMs=window.matchMedia('(prefers-reduced-motion: reduce)').matches?240:config.gameType==='magic-hat'?2600:config.gameType==='mystery-cards'?1500:4800;
 return {type,configKey:state.configKey,expectedRevision:state.revision,sessionId:session.id,occurrenceId:session.cursor?.entryId??'',visit:session.visit,atMs,entropy:crypto.getRandomValues(new Uint32Array(1))[0]/4294967296,...(['select','shuffle','start','next'].includes(type)?{spin:{startedAt:atMs,durationMs:type==='select'?durationMs:600}}:{}),...extra};
}
export function cardSelection(project:LessonProject,session:LessonSession,index:number):WheelAction|undefined {
 const entry=session.cursor && project.sequences[session.cursor.sequence].find(e=>e.id===session.cursor!.entryId),c=entry&&project.scenes[entry.sceneId]?.breakExperience;
 if(c?.mode!=='minigame'||c.gameType!=='mystery-cards')return;
 return gameCommand(prepareMiniGame(c,project).config,session,'select',{cardIndex:index});
}

export function questionCardFlip(project:LessonProject,session:LessonSession):WheelAction|undefined {
 const entry=session.cursor && project.sequences[session.cursor.sequence].find(e=>e.id===session.cursor!.entryId),c=entry&&project.scenes[entry.sceneId]?.breakExperience;
 if(c?.mode!=='minigame')return;
 const config=prepareMiniGame(c,project).config,state=restoreWheel(config,session.miniGame);
 if(!state || state.phase!=='active')return;
 const activity=config.activities.find(a=>a.id===state.currentActivityId),faces=activity?.contentRef?project.cards[activity.contentRef]?.faces:undefined;
 if(!faces || faces.length<2)return;
 const current=Math.max(0,faces.findIndex(face=>face.id===state.questionFaceId));
 return gameCommand(config,session,'face',{faceId:faces[(current+1)%faces.length].id});
}
