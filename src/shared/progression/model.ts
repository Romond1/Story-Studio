import type {AdventureDefinition} from '../definitions/model';
import type {ActivityEvent,ModuleLifecycle,ModuleType,RunContext} from '../modules/model';
import type {StudentRosterEntry} from '../types';
export interface CapturedRun {context:RunContext;moduleType:ModuleType;adventureDefinition?:AdventureDefinition;rewardBindings?:Record<string,string>;lastSequence:number}
export interface ProgressionResult {accepted:boolean;revision:number;duplicate?:boolean;reason?:string;requestIds?:string[]}
export interface ProgressionReceipt {key:string;canonical:string;result:ProgressionResult}
export interface RewardRequest {id:string;eventId:string;runId:string;adventureId:string;episodeId:string;studentId:string;moduleRewardId:string;rewardId?:string;quantity:number;status:'pending'|'approved'|'rejected';blockedReason?:string;decisionCommandId?:string}
export interface StudentAdventureProgress {studentId:string;adventureId:string;inventory:Record<string,number>;relics:Record<string,number>;completedEpisodes:string[]}
export interface ProgressionHistory {id:string;recordedAt:string;kind:'activity-completed'|'score-reported'|'reward-requested'|'reward-approved'|'reward-rejected'|'reward-adjusted'|'relic-progress'|'episode-completed';adventureId:string;episodeId?:string;studentIds:string[];runId?:string;eventId?:string;rewardId?:string;relicId?:string;delta?:number;progress?:number;reason?:string;scores?:{studentId:string;score:number}[]}
export interface ProgressionState {version:1;revision:number;runs:CapturedRun[];receipts:ProgressionReceipt[];requests:RewardRequest[];students:StudentAdventureProgress[];history:ProgressionHistory[]}
export type ProgressionCommand=
 |{type:'register-run';commandId:string;run:Omit<CapturedRun,'lastSequence'>}
 |{type:'record-event';event:ActivityEvent}
 |{type:'decide-reward';commandId:string;requestId:string;decision:'approve'|'reject';rewardId?:string;reason?:string}
 |{type:'request-reward';commandId:string;eventKey:string;rewardId:string;quantity:number}
 |{type:'adjust-reward';commandId:string;studentId:string;adventureDefinition:AdventureDefinition;rewardId:string;delta:number;reason:string}
 |{type:'advance-relic';commandId:string;studentId:string;adventureDefinition:AdventureDefinition;relicId:string;progress:number;reason:string}
 |{type:'complete-episode';commandId:string;studentIds:string[];adventureId:string;episodeId:string;reason:string};
export interface ProgressionAuthority {now?:string;roster:StudentRosterEntry[];activeRun?:{context:RunContext;moduleType:ModuleType;state:ModuleLifecycle}}
export interface RunInventory {participantId:string;rewards:{rewardId:string;quantity:number}[]}
