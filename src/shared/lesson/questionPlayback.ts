/** Small serializable transport state, sampled by both media elements. */
export interface QuestionPlayback {playing:boolean;positionSec:number;startedAt:number}
export function parseQuestionPlayback(value:unknown):QuestionPlayback|null {
 const v=value as QuestionPlayback|undefined;
 return v && typeof v.playing==='boolean' && Number.isFinite(v.positionSec) && v.positionSec>=0 && v.positionSec<=86400 && Number.isSafeInteger(v.startedAt) && v.startedAt>=0 ? {playing:v.playing,positionSec:v.positionSec,startedAt:v.startedAt}:null;
}
export const questionMediaTime=(state:QuestionPlayback,now:number)=>Math.min(86400,state.positionSec+(state.playing?Math.max(0,now-state.startedAt)/1000:0));
