import type {StudentRosterEntry} from '../types';
import type {ProgressionState} from '../progression/model';
import {STUDENT_AVATARS} from './model';
export interface RosterPresentation {position:'top'|'bottom';entries:{nickname:string;avatar?:string;score?:number;rewards?:number;relicProgress?:number}[];remaining:number}
const label=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=80&&!/[\u0000-\u001f<>]|(?:https?:|data:|file:|media:|blob:)/i.test(v);
export function parseRosterPresentation(raw:unknown):RosterPresentation|null {
 if(!raw||typeof raw!=='object')return null;const r=raw as RosterPresentation;
 if(!['top','bottom'].includes(r.position)||!Number.isSafeInteger(r.remaining)||r.remaining<0||r.remaining>10000||!Array.isArray(r.entries)||r.entries.length>8)return null;
 const entries:RosterPresentation['entries']=[];for(const e of r.entries){if(!e||!label(e.nickname)||e.avatar!==undefined&&!(STUDENT_AVATARS as readonly string[]).includes(e.avatar))return null;const clean:RosterPresentation['entries'][number]={nickname:e.nickname,...(e.avatar?{avatar:e.avatar}:{})};for(const key of ['score','rewards','relicProgress'] as const){if(e[key]!==undefined){if(typeof e[key]!=='number'||!Number.isFinite(e[key])||Math.abs(e[key]!)>1e12||(key!=='score'&&e[key]!<0))return null;clean[key]=e[key];}}entries.push(clean);}return {position:r.position,entries,remaining:r.remaining};
}
export function projectRosterPresentation(input:{roster:StudentRosterEntry[];participantIds:string[];progression:ProgressionState|null;adventureId?:string;sessionId:string;position:'top'|'bottom';showScores:boolean;showRewards:boolean;showRelics:boolean}):RosterPresentation {
 const entries:RosterPresentation['entries']=[];let student=0,guest=0;
 for(const id of new Set(input.participantIds)){
 if(id.startsWith('guest:')){entries.push({nickname:`Guest ${++guest}`});continue;}
 const profile=input.roster.find(p=>p.id===id&&!p.archived);if(!profile)continue;
 const entry:RosterPresentation['entries'][number]={nickname:label(profile.nickname)?profile.nickname:`Student ${++student}`};
 if(profile.avatar&&(STUDENT_AVATARS as readonly string[]).includes(profile.avatar))entry.avatar=profile.avatar;
 const progress=input.adventureId?input.progression?.students.find(p=>p.studentId===id&&p.adventureId===input.adventureId):undefined;
 if(progress&&input.showRewards)entry.rewards=Object.values(progress.inventory).reduce((a,b)=>a+b,0);
 if(progress&&input.showRelics)entry.relicProgress=Object.values(progress.relics).reduce((a,b)=>a+b,0);
 if(input.showScores&&input.adventureId&&input.progression){const latestRun=[...input.progression.runs].reverse().find(r=>r.context.sessionId===input.sessionId&&r.context.adventureId===input.adventureId&&r.context.participantIds.includes(id));const score=[...input.progression.history].reverse().find(h=>h.kind==='score-reported'&&h.adventureId===input.adventureId&&h.runId&&h.runId===latestRun?.context.runId&&h.scores?.some(s=>s.studentId===id))?.scores?.find(s=>s.studentId===id)?.score;if(score!==undefined)entry.score=score;}
 entries.push(entry);
 }
 return {position:input.position,entries:entries.slice(0,8),remaining:Math.max(0,entries.length-8)};
}
