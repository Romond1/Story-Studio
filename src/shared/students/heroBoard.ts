import type {StudentSnapshot} from './model';
import type {StudentRosterEntry} from '../types';
import type {ProgressionState,ProgressionHistory} from '../progression/model';
import type {AdventureDefinition,RewardDefinition,RelicStageDefinition} from '../definitions/model';
import {parseAdventureDefinition} from '../definitions/validation';
export interface HeroBoardFilters {studentId?:string;classId?:string;adventureId?:string;episodeId?:string}
export interface HeroReward {rewardId:string;name:string;kind?:RewardDefinition['kind'];quantity:number}
export interface HeroProgressRow {studentId:string;adventureId:string;adventureName:string;scope:'adventure-lifetime';inventory:HeroReward[];achievements:HeroReward[];relics:{relicId:string;name:string;progress:number;stages:RelicStageDefinition[];unlockedStageIds:string[]}[];completedEpisodes:string[]}
export interface HeroParticipation {studentId:string;adventureId:string;episodeIds:string[]}
export interface HeroBoardModel {participation:HeroParticipation[];profiles:StudentRosterEntry[];definitions:AdventureDefinition[];history:ProgressionHistory[];progress:HeroProgressRow[]}
/** Views authoritative balances, never infers awards from scores or display names. */
export function selectHeroBoard(snapshot:StudentSnapshot,state:ProgressionState,filters:HeroBoardFilters={},currentDefinition?:AdventureDefinition):HeroBoardModel {
 const definitions=new Map<string,AdventureDefinition>();
 const add=(value:unknown)=>{try{const definition=parseAdventureDefinition(value);definitions.set(definition.id,definition);}catch{/* Ignore unavailable historical labels; stable IDs remain visible. */}};
 for(const run of state.runs)if(run.adventureDefinition)add(run.adventureDefinition);
 // Receipts retain transaction order, including manual changes without a captured run.
 for(const receipt of state.receipts){if(!receipt.result.accepted)continue;try{const command=JSON.parse(receipt.canonical);if(command.type==='register-run')add(command.run?.adventureDefinition);else if(command.type==='adjust-reward'||command.type==='advance-relic')add(command.adventureDefinition);}catch{/* Non-definition receipts do not contribute labels. */}}
 if(currentDefinition)add(currentDefinition);
 const members=filters.classId?new Set(snapshot.classes.find(c=>c.id===filters.classId)?.studentIds??[]):null;
 const profiles=snapshot.studentRoster.filter(p=>(!filters.studentId||p.id===filters.studentId)&&(!members||members.has(p.id))).map(p=>({...p}));
 const selected=new Set(profiles.map(p=>p.id));
 const participationMap=new Map<string,HeroParticipation>();
 const participate=(studentId:string,adventureId:string,episodeId?:string)=>{
 if(!selected.has(studentId)||(filters.adventureId&&adventureId!==filters.adventureId)||(filters.episodeId&&episodeId!==filters.episodeId))return;
 const key=JSON.stringify([studentId,adventureId]);let row=participationMap.get(key);
 if(!row){row={studentId,adventureId,episodeIds:[]};participationMap.set(key,row);}
 if(episodeId&&!row.episodeIds.includes(episodeId))row.episodeIds.push(episodeId);
 };
 for(const run of state.runs)for(const id of run.context.participantIds)participate(id,run.context.adventureId,run.context.episodeId);
 for(const item of state.history)for(const id of item.studentIds)participate(id,item.adventureId,item.episodeId);
 for(const item of state.students){participate(item.studentId,item.adventureId);for(const episodeId of item.completedEpisodes)participate(item.studentId,item.adventureId,episodeId);}
 const history=state.history.filter(h=>(!filters.adventureId||h.adventureId===filters.adventureId)&&(!filters.episodeId||h.episodeId===filters.episodeId)&&h.studentIds.some(id=>selected.has(id))).map(h=>({...h,studentIds:h.studentIds.filter(id=>selected.has(id)),...(h.scores?{scores:h.scores.filter(s=>selected.has(s.studentId)).map(s=>({...s}))}:{})}));
 const progress=state.students.filter(p=>selected.has(p.studentId)&&(!filters.adventureId||p.adventureId===filters.adventureId)&&(!filters.episodeId||p.completedEpisodes.includes(filters.episodeId)||history.some(h=>h.adventureId===p.adventureId&&h.studentIds.includes(p.studentId)))).map((p):HeroProgressRow=>{
 const definition=definitions.get(p.adventureId);
 const inventory=Object.entries(p.inventory).map(([rewardId,quantity])=>{const reward=definition?.rewards.find(r=>r.id===rewardId);return {rewardId,name:reward?.name??rewardId,...(reward?{kind:reward.kind}:{}),quantity};});
 const relics=Object.entries(p.relics).map(([relicId,progress])=>{const relic=definition?.relics.find(r=>r.id===relicId);const stages=(relic?.stages??[]).map(s=>({...s}));return {relicId,name:relic?.name??relicId,progress,stages,unlockedStageIds:stages.filter(s=>progress>=s.requiredProgress).map(s=>s.id)};});
 return {studentId:p.studentId,adventureId:p.adventureId,adventureName:definition?.name??p.adventureId,scope:'adventure-lifetime',inventory,achievements:inventory.filter(r=>r.kind==='badge'&&r.quantity>0).map(r=>({...r})),relics,completedEpisodes:[...p.completedEpisodes]};
 });
 return {profiles,definitions:[...definitions.values()],history,progress,participation:[...participationMap.values()]};
}
