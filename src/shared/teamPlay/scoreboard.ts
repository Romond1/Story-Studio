import type { SharedAdventure } from '../sharedAdventure';

export interface TeamScoreboard {name:string;score:number;target:number;completed:number;objectives:number;students:{name:string;color:string;score:number;participating:boolean}[]}
const name=(value:unknown,max=200):value is string=>typeof value==='string'&&value.length<=max;
const integer=(value:unknown,max=1000000):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
export function parseTeamScoreboard(raw:unknown):TeamScoreboard|null {
  const value=raw as TeamScoreboard;
  if(!value||typeof value!=='object'||!name(value.name)||!integer(value.score,200000000)||!integer(value.target)||!value.target||!integer(value.completed,200)||!integer(value.objectives,200)||value.completed>value.objectives||!Array.isArray(value.students)||value.students.length>200)return null;
  const students:TeamScoreboard['students']=[];
  for(const student of value.students){if(!student||!name(student.name,80)||!/^#[\da-f]{6}$/i.test(student.color)||!integer(student.score)||typeof student.participating!=='boolean')return null;students.push({name:student.name,color:student.color,score:student.score,participating:student.participating});}
  if(students.reduce((sum,student)=>sum+student.score,0)!==value.score)return null;
  return {name:value.name,score:value.score,target:value.target,completed:value.completed,objectives:value.objectives,students};
}
export function projectTeamScoreboard(group:SharedAdventure):TeamScoreboard {
  const {preparation:p,live:l}=group;
  return {name:p.name==='Shared Adventure'?'Team Play':p.name,score:Object.values(l.scores).reduce((sum,score)=>sum+score,0),target:p.target,completed:l.completedObjectiveIds.length,objectives:p.objectives.length,students:p.students.map(student=>({name:student.name,color:student.color,score:l.scores[student.id]??0,participating:student.participating}))};
}
