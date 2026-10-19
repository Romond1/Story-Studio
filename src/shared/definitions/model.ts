export interface RewardDefinition {id:string;name:string;kind:'collectible'|'currency'|'badge';iconAssetId?:string}
export interface RelicStageDefinition {id:string;name:string;requiredProgress:number;imageAssetId?:string}
export interface RelicDefinition {id:string;name:string;imageAssetId?:string;stages:RelicStageDefinition[]}
/** Immutable authored snapshot scoped by identity and version, never display name. */
export interface AdventureDefinition {id:string;version:string;name:string;description:string;rewards:RewardDefinition[];relics:RelicDefinition[]}
