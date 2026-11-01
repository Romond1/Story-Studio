import { getGame } from '../gameHost';
import { miniGameRegistry } from '../lesson/miniGameBreak';

export type TeamActivitySource = 'Adventure'|'Discovery'|'Challenge'|'Mastery'|'Team Play';
export interface TeamActivityDefinition {
  id:string; name:string; source:TeamActivitySource; description:string;
  compatibility:'Ready'|'Adaptable'|'Unsupported'; playable:boolean;
  contentRequirements:string; presenter:'scene'|'native-game'|'unavailable'; exitBehavior:string;
}
export interface TeamContent { version:1; questions:{id:string;prompt:string;imageAssetId?:string}[]; sourcePackId?:string }
export interface TeamActivityEntry {
  id:string; activityId:string; title:string; content:TeamContent;
  settings:{trackLength:number;racers:[string,string]};
}
const wheel=miniGameRegistry.get('spinning-wheel')!,dash=getGame('hero-dash')!;
export const teamActivityRegistry:readonly TeamActivityDefinition[] = [
  {id:'adventure.scenes',name:'Scene & Card teaching',source:'Adventure',description:'Reuse authored scenes and Cards for shared storytelling.',compatibility:'Adaptable',playable:false,contentRequirements:'Needs an explicit scene import/selection adapter.',presenter:'scene',exitBehavior:'Not integrated in this milestone.'},
  {id:'discovery.activation-cards',name:'Activation activities',source:'Discovery',description:'Prepared sequences of existing Discovery scenes.',compatibility:'Unsupported',playable:false,contentRequirements:'Existing completion/progression requires episode-authorized runs. A separate group scene adapter is needed.',presenter:'unavailable',exitBehavior:'Use the original Discovery workspace.'},
  {id:'discovery.spinning-wheel',name:wheel.name,source:'Discovery',description:wheel.description,compatibility:'Adaptable',playable:true,contentRequirements:'One or more selected text/image questions. Teacher-led group turns; points awarded manually.',presenter:'scene',exitBehavior:'Complete or exit to the Team Play mission; group state is retained.'},
  ...(['magic-hat','mystery-cards'] as const).map(id=>({id:`discovery.${id}`,name:miniGameRegistry.get(id)!.name,source:'Discovery' as const,description:miniGameRegistry.get(id)!.description,compatibility:'Adaptable' as const,playable:false,contentRequirements:'Existing runtime available; Team Play adapter not yet enabled/tested.',presenter:'scene' as const,exitBehavior:'Not integrated in this milestone.'})),
  {id:'challenge.language-snake',name:getGame('language-snake')!.title,source:'Challenge',description:getGame('language-snake')!.description,compatibility:'Unsupported',playable:false,contentRequirements:'Requires a group adapter for episode-authorized module initialization and content.',presenter:'unavailable',exitBehavior:'Use its original Challenge workspace.'},
  {id:'mastery.hero-dash',name:dash.title,source:'Mastery',description:dash.description,compatibility:'Adaptable',playable:true,contentRequirements:'Every question needs a Team Play image. Two racer roles, any number of students; race scores do not award group points.',presenter:'native-game',exitBehavior:'Complete or exit to the mission. Race progress is transient; group points persist.'},
  {id:'mastery.final-boss-hero',name:getGame('final-boss-hero')!.title,source:'Mastery',description:getGame('final-boss-hero')!.description,compatibility:'Unsupported',playable:false,contentRequirements:'Needs episode module authorization and explicit Card/media mapping.',presenter:'unavailable',exitBehavior:'Use its original Mastery workspace.'},
  {id:'team.exclusive',name:'Cooperative activities',source:'Team Play',description:'Reserved for future Team Play-exclusive activities.',compatibility:'Unsupported',playable:false,contentRequirements:'No activity implementation in this milestone.',presenter:'unavailable',exitBehavior:'Not available.'},
];
export const getTeamActivity=(id:string)=>teamActivityRegistry.find(activity=>activity.id===id);
export const listTeamActivities=(source?:TeamActivitySource,playableOnly=false)=>teamActivityRegistry.filter(activity=>(!source||activity.source===source)&&(!playableOnly||activity.playable));
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
const identity=(v:unknown):v is string=>text(v,200)&&!!v&&!['__proto__','constructor','prototype',...Object.getOwnPropertyNames(Object.prototype)].includes(v);
export function validateTeamSequence(value:unknown):asserts value is TeamActivityEntry[] {
  if(!Array.isArray(value)||value.length>200)throw Error('Invalid Team Play activity sequence.');
  const ids=new Set<string>();
  for(const entry of value){
    if(!object(entry)||!identity(entry.id)||ids.has(entry.id)||!identity(entry.activityId)||!text(entry.title,200)||!entry.title.trim()||!object(entry.content)||entry.content.version!==1||!Array.isArray(entry.content.questions)||entry.content.questions.length>40||!object(entry.settings))throw Error('Invalid Team Play activity.');
    ids.add(entry.id);
    if(entry.content.sourcePackId!==undefined&&!identity(entry.content.sourcePackId))throw Error('Invalid content source.');
    const questionIds=new Set<string>();
    for(const question of entry.content.questions){
      if(!object(question)||!identity(question.id)||questionIds.has(question.id)||!text(question.prompt,2000)||(question.imageAssetId!==undefined&&!identity(question.imageAssetId)))throw Error('Invalid Team Play question.');
      questionIds.add(question.id);
    }
    const settings=entry.settings;
    if(!Number.isInteger(settings.trackLength)||settings.trackLength<10||settings.trackLength>30||!Array.isArray(settings.racers)||settings.racers.length!==2||settings.racers.some((name:unknown)=>!text(name,80)||!name.trim()))throw Error('Invalid Team Play launch settings.');
  }
}
export function createTeamEntry(activityId:string,content:TeamContent,id:string=globalThis.crypto.randomUUID()):TeamActivityEntry {
  const activity=getTeamActivity(activityId);
  if(!activity?.playable)throw Error('This activity does not have a Team Play adapter yet.');
  const entry:TeamActivityEntry={id,activityId,title:activity.name,content:JSON.parse(JSON.stringify(content)),settings:{trackLength:20,racers:['Team A','Team B']}};
  validateTeamSequence([entry]);return entry;
}
export function teamEntryProblems(entry:TeamActivityEntry,hasImage:(id:string)=>boolean):string[] {
  const definition=getTeamActivity(entry.activityId);
  if(!definition?.playable)return ['This activity is unavailable. Its saved preparation has been retained.'];
  if(!entry.content.questions.length)return ['Add at least one question.'];
  if(entry.content.questions.some(question=>!question.prompt.trim()&&!question.imageAssetId))return ['Every question needs text or an image.'];
  if(entry.content.questions.some(question=>question.imageAssetId&&!hasImage(question.imageAssetId)))return ['A selected image is unavailable in this Team Play lesson.'];
  if(entry.activityId==='mastery.hero-dash'&&entry.content.questions.some(question=>!question.imageAssetId))return ['Hero Dash needs an image for every question.'];
  return [];
}
