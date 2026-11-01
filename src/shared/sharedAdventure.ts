import type { ScenePlan, SceneObjectPlan } from './lesson/projection';
import { validateTeamSequence, type TeamActivityEntry } from './teamPlay/activities';

export interface SharedStudent { id:string; name:string; color:string; participating:boolean; profileId?:string; deviceId?:string }
export interface SharedAdventure {
  version:1;
  preparation:{name:string; students:SharedStudent[]; devices:{id:string;name:string}[]; objectives:{id:string;text:string}[]; target:number; prompt:string; imageAssetId?:string; activities?:TeamActivityEntry[]};
  live:{scores:Record<string,number>; awards:{studentIds:string[];points:number}[]; completedObjectiveIds:string[]; scoreboard:boolean; revealed:boolean; completedActivityIds?:string[]};
}
export const teamPlayDisplayName=(name:string)=>name==='Shared Adventure'?'Team Play':name;
export function createSharedAdventure():SharedAdventure {
  return {version:1,preparation:{name:'Team Play',students:['#67d9f5','#ffcf66','#f5a5cc'].map((color,index)=>({id:`student-${index+1}`,name:`Student ${index+1}`,color,participating:true})),devices:[],objectives:[{id:'objective-1',text:'Work together and speak English'}],target:30,prompt:'Describe, listen and help your teammates.'},live:{scores:{},awards:[],completedObjectiveIds:[],scoreboard:false,revealed:false}};
}
const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=500):value is string=>typeof value==='string'&&value.length<=max;
const id=(value:unknown):value is string=>text(value,200)&&!!value&&!['__proto__','prototype','constructor',...Object.getOwnPropertyNames(Object.prototype)].includes(value);
const integer=(value:unknown,max=1000000):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max;
const check=(value:unknown)=>{if(!value)throw Error('Invalid Team Play data.');};
export function validateSharedAdventure(value:unknown):asserts value is SharedAdventure {
  check(record(value)); const g=value as SharedAdventure;
  check(g.version===1&&record(g.preparation)&&record(g.live));
  const p=g.preparation,l=g.live;
  if(p.activities!==undefined)validateTeamSequence(p.activities);
  if(l.completedActivityIds!==undefined)check(Array.isArray(l.completedActivityIds)&&new Set(l.completedActivityIds).size===l.completedActivityIds.length&&l.completedActivityIds.every(key=>p.activities?.some(entry=>entry.id===key)));
  check(text(p.name,200)&&!!p.name.trim()&&text(p.prompt,4000)&&integer(p.target)&&p.target>0);
  for(const list of [p.students,p.devices,p.objectives])check(Array.isArray(list)&&list.length<=200&&list.every(row=>record(row)&&id(row.id))&&new Set(list.map(row=>row.id)).size===list.length);
  for(const device of p.devices)check(text(device.name,200)&&!!device.name.trim());
  for(const student of p.students)check(text(student.name,80)&&!!student.name.trim()&&/^#[\da-f]{6}$/i.test(student.color)&&typeof student.participating==='boolean'&&(student.profileId===undefined||id(student.profileId))&&(student.deviceId===undefined||p.devices.some(device=>device.id===student.deviceId)));
  for(const objective of p.objectives)check(text(objective.text,500)&&!!objective.text.trim());
  check(p.imageAssetId===undefined||id(p.imageAssetId));
  check(record(l.scores)&&Object.entries(l.scores).every(([key,score])=>p.students.some(student=>student.id===key)&&integer(score)));
  check(Array.isArray(l.awards)&&l.awards.length<=10000);
  for(const award of l.awards)check(record(award)&&Array.isArray(award.studentIds)&&award.studentIds.length>0&&award.studentIds.length<=200&&new Set(award.studentIds).size===award.studentIds.length&&award.studentIds.every(key=>p.students.some(student=>student.id===key))&&integer(award.points,1000)&&award.points>0);
  // The ledger is the score authority; corrupted undo history cannot create negative balances.
  const totals:Record<string,number>={};
  for(const award of l.awards)for(const key of award.studentIds)totals[key]=(totals[key]??0)+award.points;
  check(new Set([...Object.keys(totals),...Object.keys(l.scores)]).size<=200&&Object.keys(totals).every(key=>totals[key]===l.scores[key])&&Object.keys(l.scores).every(key=>l.scores[key]===(totals[key]??0)));
  check(Array.isArray(l.completedObjectiveIds)&&new Set(l.completedObjectiveIds).size===l.completedObjectiveIds.length&&l.completedObjectiveIds.every(key=>p.objectives.some(objective=>objective.id===key))&&typeof l.scoreboard==='boolean'&&typeof l.revealed==='boolean');
}
export function awardSharedPoints(group:SharedAdventure,studentIds:string[],points:number):SharedAdventure {
  if(!Number.isInteger(points)||points<1||points>1000)throw Error('Choose whole points from 1 to 1000.');
  if(studentIds.some(id=>!group.preparation.students.some(student=>student.id===id)))throw Error('Unknown student.');
  const targets=[...new Set(studentIds)].filter(id=>group.preparation.students.some(student=>student.id===id&&student.participating));
  if(!targets.length)throw Error('Select participating students.');
  if(group.live.awards.length>=10000)throw Error('Start a new session before adding more points.');
  const scores={...group.live.scores};for(const id of targets){scores[id]=(scores[id]??0)+points;if(scores[id]>1000000)throw Error('Score limit reached. Start a new session.');}
  return {...group,live:{...group.live,scores,awards:[...group.live.awards,{studentIds:targets,points}]}};
}
export function undoSharedPoints(group:SharedAdventure):SharedAdventure {
  const award=group.live.awards.at(-1);if(!award)return group;
  const scores={...group.live.scores};for(const id of award.studentIds){scores[id]-=award.points;if(!scores[id])delete scores[id];}
  return {...group,live:{...group.live,scores,awards:group.live.awards.slice(0,-1)}};
}
export function resetSharedAdventure(group:SharedAdventure):SharedAdventure {
  return {...group,live:createSharedAdventure().live};
}
export function sharedTeamScore(group:SharedAdventure):number { return Object.values(group.live.scores).reduce((sum,value)=>sum+value,0); }

/** Public view only: teacher metadata and hidden content never enter the scene plan. */
export function projectSharedAdventure(group:SharedAdventure,resolve:(id:string)=>string|undefined):ScenePlan {
  const p=group.preparation,l=group.live,objects:SceneObjectPlan[]=[];
  const label=(id:string,value:string,x:number,y:number,width:number,height:number,size=30,color='#e5eef9')=>objects.push({id,kind:'text',text:value,box:{x,y,width,height},fontSize:size,color,align:'left'});
  label('group-title',teamPlayDisplayName(p.name),50,30,1180,65,42);
  const current=p.objectives.find(objective=>!l.completedObjectiveIds.includes(objective.id));
  label('group-objective',current?.text??'Mission complete!',50,102,1180,75,27,'#67d9f5');
  label('group-prompt',l.revealed?p.prompt:'Listen to your teacher. Get ready to work together.',50,195,p.imageAssetId&&l.revealed?600:1180,220,36);
  const image=l.revealed&&p.imageAssetId?resolve(p.imageAssetId):undefined;
  if(image)objects.push({id:'group-image',kind:'image',src:image,box:{x:720,y:185,width:500,height:265}});
  if(l.scoreboard){
    label('team-score',`◆ Team ${sharedTeamScore(group)} / ${p.target}     •     Objectives ${l.completedObjectiveIds.length} / ${p.objectives.length}`,50,465,1180,65,32,'#ffcf66');
    const rows=p.students.map(student=>`${student.name}${student.participating?'':' (away)'}: ${l.scores[student.id]??0}`);
    label('individual-scores',rows.join('   ·   '),50,548,1180,150,p.students.length>6?22:28);
  }
  return {version:1,sceneId:'shared-adventure',frame:{width:1280,height:720},background:{color:'#172332'},viewport:{zoom:1,pan:{x:0,y:0}},objects,drawings:[],transition:{kind:'fade',durationMs:180}};
}
