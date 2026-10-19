import type {ActivityEvent,ModuleLifecycle,ModuleType,RunContext} from '../modules/model';
import type {AdventureDefinition} from '../definitions/model';
import type {ProgressionResult,ProgressionState,RunInventory} from './model';
export interface ProgressionApi {
 getSnapshot():Promise<ProgressionState>;
 registerRun(input:{expectedFolder:string;activityId:string;commandId?:string;context:RunContext;moduleType:ModuleType;adventureDefinition?:AdventureDefinition;rewardBindings?:Record<string,string>}):Promise<ProgressionResult>;
 recordEvent(event:ActivityEvent):Promise<ProgressionResult>;
 lifecycle(input:{runId:string;state:ModuleLifecycle}):Promise<void>;
 completeActivation(input:{commandId:string;runId:string;outcome:'completed'|'won'|'lost'|'draw'}):Promise<ProgressionResult>;
 decideReward(input:{commandId:string;requestId:string;decision:'approve'|'reject';rewardId?:string;reason?:string}):Promise<ProgressionResult>;
 requestReward(input:{commandId:string;eventKey:string;rewardId:string;quantity:number}):Promise<ProgressionResult>;
 adjustReward(input:{commandId:string;expectedFolder:string;studentId:string;adventureDefinition:AdventureDefinition;rewardId:string;delta:number;reason:string}):Promise<ProgressionResult>;
 advanceRelic(input:{commandId:string;expectedFolder:string;studentId:string;adventureDefinition:AdventureDefinition;relicId:string;progress:number;reason:string}):Promise<ProgressionResult>;
 completeEpisode(input:{commandId:string;expectedFolder:string;studentIds:string[];adventureId:string;episodeId:string;reason:string}):Promise<ProgressionResult>;
 getRunInventory(context:RunContext):Promise<RunInventory[]>;
}
