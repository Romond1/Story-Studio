import type {ActivityEvent,LifecycleCommand,ModuleConfigMap,ModuleType,RunContext} from './model';
import {arr,bool,fail,identity,num,obj,one,record,shape,str,unique} from './checks';
import {parseModuleConfig} from './validation';
export type {RunContext,ActivityEvent} from './model';
export type EditorOperation='media-list'|'media-import'|'episode-save';
export type EditorAsset={id:string;name:string;mediaType:'image'|'video'|'audio';url?:string};
export type EditorResult={ok:boolean;assets?:EditorAsset[];importedIds?:string[];cancelled?:boolean;reason?:string};
interface Envelope {channel:'story-studio-module';version:1;moduleType:ModuleType;moduleVersion:1;hostGeneration:number;requestId:string;context:RunContext}
export type HostToModuleMessage=Envelope&(
 {type:'media-catalogue';assets:EditorAsset[]}|
 {type:'editor-response';ok:boolean;assets?:EditorAsset[];importedIds?:string[];cancelled?:boolean;reason?:string}|
 {type:'initialize';configVersion:1;config:ModuleConfigMap[ModuleType];configRevision:number;mediaMap:Record<string,string>}|
 {type:Exclude<LifecycleCommand,'initialize'>|'config-request'}|
 {type:'inventory-response';inventory:{participantId:string;rewards:{rewardId:string;quantity:number}[]}[]}|
 {type:'config-ack';accepted:boolean;configRevision:number;reason?:string}|
 {type:'event-ack';eventId:string;accepted:boolean;reason?:string});
export type ModuleToHostMessage=Envelope&{sequence:number}&(
 {type:'editor-request';operation:EditorOperation}|
 {type:'ready'}|{type:'inventory-request'}|{type:'ack';command:LifecycleCommand}|{type:'error'|'config-failed';message:string}|
 {type:'config-proposal';expectedRevision:number;configVersion:1;config:ModuleConfigMap[ModuleType]}|
 {type:'event';event:ActivityEvent});
const literal=(expected:unknown)=>(v:unknown,p:string)=>{if(v!==expected)fail(p);};
export const validateRunContext=shape({sessionId:identity,runId:identity,instanceId:identity,occurrenceId:identity,episodeId:identity,adventureId:identity,participantIds:arr(identity,0,1000)});
export function sameRunContext(a:RunContext,b:RunContext):boolean{return ['sessionId','runId','instanceId','occurrenceId','episodeId','adventureId'].every(key=>a[key as keyof RunContext]===b[key as keyof RunContext])&&a.participantIds.length===b.participantIds.length&&a.participantIds.every((id,i)=>id===b.participantIds[i]);}
export function parseActivityEvent(value:unknown):ActivityEvent|null {try{
 if(!obj(value))return null;const payloads={
 'activity-completed':shape({participantIds:arr(identity,1,1000),outcome:one(['completed','won','lost','draw'])}),
 'score-reported':shape({scores:arr(shape({participantId:identity,score:num(-1000000000,1000000000)}),1,1000)}),
 'reward-requested':shape({requests:arr(shape({participantId:identity,rewardId:identity,quantity:num(1,100000,true)}),1,1000)})};
 if(!Object.hasOwnProperty.call(payloads,value.type))return null;
 shape({version:literal(1),eventId:identity,context:validateRunContext,sequence:num(1,Number.MAX_SAFE_INTEGER,true),type:one(Object.keys(payloads)),payload:payloads[value.type as keyof typeof payloads]})(value,'event');
 unique(value.context.participantIds,'context participants');
 const participants:string[]=value.type==='activity-completed'?value.payload.participantIds:value.type==='score-reported'?value.payload.scores.map((x:any)=>x.participantId):value.payload.requests.map((x:any)=>x.participantId);
 if(participants.some(id=>!value.context.participantIds.includes(id)))return null;
 if(value.type!=='reward-requested')unique(participants,'event participants');else unique(value.payload.requests.map((x:any)=>`${x.participantId}\0${x.rewardId}`),'reward requests');
 return JSON.parse(JSON.stringify(value));
 }catch{return null;}}
const envelope={channel:literal('story-studio-module'),version:literal(1),moduleType:one(['activation-cards','language-snake','final-boss-hero']),moduleVersion:literal(1),hostGeneration:num(0,Number.MAX_SAFE_INTEGER,true),requestId:identity,context:validateRunContext};
const lifecycle=['initialize','start','pause','resume','reset','stop','dispose'];
const editorAssets=arr(shape({id:identity,name:str,mediaType:one(['image','video','audio'])},{url:str}),0,20000);
export function parseHostToModuleMessage(value:unknown):HostToModuleMessage|null {try{
 if(!obj(value))return null;let extra:Record<string,(v:unknown,p:string)=>void>={},optional:typeof extra={};
 if(value.type==='initialize')extra={configVersion:literal(1),config:()=>{},configRevision:num(0,Number.MAX_SAFE_INTEGER,true),mediaMap:record(str)};
 else if(value.type==='editor-response'){extra={ok:bool};optional={assets:editorAssets,importedIds:arr(identity,0,20000),cancelled:bool,reason:str};}
 else if(value.type==='media-catalogue')extra={assets:editorAssets};
 else if(value.type==='inventory-response')extra={inventory:arr(shape({participantId:identity,rewards:arr(shape({rewardId:identity,quantity:num(0,1000000000,true)}))}),0,1000)};
 else if(value.type==='config-ack'){extra={accepted:bool,configRevision:num(0,Number.MAX_SAFE_INTEGER,true)};optional={reason:str};}
 else if(value.type==='event-ack'){extra={eventId:identity,accepted:bool};optional={reason:str};}
 else if(value.type!=='config-request'&&!lifecycle.slice(1).includes(value.type))return null;
 shape({...envelope,type:literal(value.type),...extra},optional)(value,'message');unique(value.context.participantIds,'participants');
 if(value.type==='inventory-response'){unique(value.inventory.map((row:any)=>row.participantId),'inventory participants');for(const row of value.inventory){if(!value.context.participantIds.includes(row.participantId))return null;unique(row.rewards.map((reward:any)=>reward.rewardId),'inventory rewards');}}
 if(value.type==='initialize')parseModuleConfig(value.moduleType,value.config);
 return JSON.parse(JSON.stringify(value));
 }catch{return null;}}
export function parseModuleToHostMessage(value:unknown):ModuleToHostMessage|null {try{
 if(!obj(value))return null;let extra:Record<string,(v:unknown,p:string)=>void>;
 switch(value.type){case'editor-request':extra={operation:one(['media-list','media-import','episode-save'])};break;case'inventory-request':case'ready':extra={};break;case'ack':extra={command:one(lifecycle)};break;case'config-failed':case'error':extra={message:str};break;case'config-proposal':extra={expectedRevision:num(0,Number.MAX_SAFE_INTEGER,true),configVersion:literal(1),config:()=>{}};break;case'event':extra={event:()=>{}};break;default:return null;}
 shape({...envelope,type:literal(value.type),sequence:num(1,Number.MAX_SAFE_INTEGER,true),...extra})(value,'message');unique(value.context.participantIds,'participants');
 if(value.type==='config-proposal')parseModuleConfig(value.moduleType,value.config);
 if(value.type==='event'){const event=parseActivityEvent(value.event);if(!event||!sameRunContext(event.context,value.context)||event.sequence!==value.sequence)return null;}
 return JSON.parse(JSON.stringify(value));
 }catch{return null;}}
