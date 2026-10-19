import type {AdventureDefinition} from './model';
import {arr,fail,identity,num,one,shape,str,unique} from '../modules/checks';
const optionalImage=(value:unknown,path:string)=>{if(value!==undefined)identity(value,path);};
const label=(value:unknown,path:string)=>{str(value,path);if(typeof value!=='string'||!value.trim()||value.length>500)fail(path);};
export function parseAdventureDefinition(value:unknown):AdventureDefinition {
 shape({id:identity,version:identity,name:label,description:str,rewards:arr(shape({id:identity,name:label,kind:one(['collectible','currency','badge'])},{iconAssetId:optionalImage})),relics:arr(shape({id:identity,name:label,stages:arr(shape({id:identity,name:label,requiredProgress:num(1,1000000000,true)},{imageAssetId:optionalImage}),1,1000)},{imageAssetId:optionalImage}))})(value,'adventureDefinition');
 const definition=JSON.parse(JSON.stringify(value)) as AdventureDefinition;
 unique(definition.rewards.map(item=>item.id),'reward identity');unique(definition.relics.map(item=>item.id),'relic identity');
 for(const relic of definition.relics){unique(relic.stages.map(stage=>stage.id),'relic stage identity');if(relic.stages.some((stage,i)=>i>0&&stage.requiredProgress<=relic.stages[i-1].requiredProgress))fail('relic stage thresholds');}
 return definition;
}
export function collectDefinitionAssets(definition:AdventureDefinition):{assetId:string;field:string;ownerType:'reward'|'relic';ownerId:string}[]{
 const refs:{assetId:string;field:string;ownerType:'reward'|'relic';ownerId:string}[]=[];
 definition.rewards.forEach((reward,i)=>{if(reward.iconAssetId)refs.push({ownerType:'reward',ownerId:reward.id,assetId:reward.iconAssetId,field:`/adventureDefinition/rewards/${i}/iconAssetId`});});
 definition.relics.forEach((relic,i)=>{if(relic.imageAssetId)refs.push({ownerType:'relic',ownerId:relic.id,assetId:relic.imageAssetId,field:`/adventureDefinition/relics/${i}/imageAssetId`});relic.stages.forEach((stage,j)=>{if(stage.imageAssetId)refs.push({ownerType:'relic',ownerId:relic.id,assetId:stage.imageAssetId,field:`/adventureDefinition/relics/${i}/stages/${j}/imageAssetId`});});});
 return refs;
}
