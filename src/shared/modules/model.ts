import type { CardData, EncounterConfig } from './finalBossTypes';
export type ModuleType = 'activation-cards'|'language-snake'|'final-boss-hero'|'hero-dash';
export type Direction = 'up'|'down'|'left'|'right';
export type SoundSlot = 'correct'|'wrong'|'eat'|'crash'|'crown'|'congrats'|'cheer'|'confetti'|'villain';
export interface SnakeConfig {
 questionText:string;
 setup:{mode:'versus'|'coop';lessonType:'solo'|'group';boardWidth:number;boardHeight:number;crystalCount:number;coopTimerSeconds:number;playerCount:number};
 playerDirectionLabels:Record<string,Record<Direction,string>>;
 playerKeyBindings:Record<string,Record<Direction,string[]>>;
 heroCrownSettings:{enabled:boolean;frequency:'low'|'medium'|'high';expiresAfterMoves:number;cosmeticDurationSeconds:number;bonusValue:number};
 heroCrownChallengeText:string;
 enemySettings:{enabled:boolean;speed:'slow'|'normal';respawnDelayTurns:number;defeatReward:number};
 backgroundControls:{blur:number;brightness:number;overlay:number;panelOpacity:number;boardOpacity:number};
 backgroundImage:string; sounds?:Partial<Record<SoundSlot,string>>;music?:string;
}
export interface FinalBossConfig {encounter:EncounterConfig;cardLibrary:CardData[]}
export interface ActivationConfig {sceneIds:string[]}
export interface ModuleConfigMap {'hero-dash':import('../heroDash').DashConfig;'language-snake':SnakeConfig;'final-boss-hero':FinalBossConfig;'activation-cards':ActivationConfig}
export type EpisodeActivity = {[K in ModuleType]:{id:string;moduleType:K;moduleVersion:1;configVersion:1;config:ModuleConfigMap[K];rewardBindings?:Record<string,string>}}[ModuleType];
export interface ActivityOccurrence {id:string;activityId:string;section:'activation'|'challenge'|'mastery'}
export interface RunContext {sessionId:string;runId:string;instanceId:string;occurrenceId:string;episodeId:string;adventureId:string;participantIds:string[]}
export type ActivityEvent = {version:1;eventId:string;context:RunContext;sequence:number}&(
 {type:'activity-completed';payload:{participantIds:string[];outcome:'completed'|'won'|'lost'|'draw'}}|
 {type:'score-reported';payload:{scores:{participantId:string;score:number}[]}}|
 {type:'reward-requested';payload:{requests:{participantId:string;rewardId:string;quantity:number}[]}});
export type LifecycleCommand='initialize'|'start'|'pause'|'resume'|'reset'|'stop'|'dispose';
export type ModuleLifecycle='initialized'|'running'|'paused'|'stopped'|'disposed';
