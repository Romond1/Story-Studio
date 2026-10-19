import {parseDashConfig} from '../heroDash';
import {collectModuleAssets} from './media';
import type { EpisodeActivity, ModuleConfigMap, ModuleType } from './model';
import { MINI_GAME_IDS } from './finalBossTypes';
import { arr,background,bool,color,fail,identity,icon,media,num,one,record,shape,str,unique,type Validator } from './checks';
const games=arr(one(MINI_GAME_IDS));const strings=arr(str);const ids=arr(identity);
const fighter=shape({name:str,portrait:media,health:num(),energy:num()},{description:str,video:media});
const rewardOptional={icon,category:str,applicableGames:games,effectType:str,effectValue:num(-1000000)};
const card=shape({id:identity,title:str,image:media,value:num(-1000000),pairId:str,tags:strings},{description:str,frontImage:media,backImage:media,frontText:str,backText:str,textColor:color,fontSize:num(1,1000),textAlign:one(['left','center','right']),cardWidth:num(1,10000),cardHeight:num(1,10000),miniGames:games,boardDashQuestion:str});
const boss=shape({encounter:shape({
 id:identity,name:str,hero:fighter,villain:fighter,
 introSetup:shape({enabled:bool,title:str,subtitle:str,startButtonLabel:str,heroes:arr(shape({id:identity,name:str,portrait:media},{subtitle:str,video:media}))}),
 background,selectedCardIds:ids,enabledMiniGames:arr(one(MINI_GAME_IDS),1,5),gameOrder:arr(one(MINI_GAME_IDS),1,100),
 roundSettings:shape({roundCount:num(1,1000,true),difficulty:one(['easy','normal','hard'])}),
 rewards:arr(shape({id:identity,name:str,description:str,value:num(-1000000)},rewardOptional)),
 powerUps:arr(shape({id:identity,name:str,description:str,charges:num(0,100000,true)},{...rewardOptional,energyCost:num()})),
 battleSettings:shape({heroStartHp:num(),heroMaxHp:num(1),heroStartEnergy:num(),heroMaxEnergy:num(),villainStartHp:num(),villainMaxHp:num(1),villainStartEnergy:num(),villainMaxEnergy:num(),resolution:shape({baseDamage:num(),bonusDamagePerScore:num(),drawDamage:num(),participationEnergyCost:num(),winnerEnergyGain:num(),loserEnergyLoss:num(),drawEnergyGain:num()})}),
 cutscenes:arr(shape({id:identity,name:str,mediaSource:media,mediaType:one(['image','video']),tags:strings},{description:str})),
 actionItems:arr(shape({id:identity,text:str},{emoji:str,category:str})),
 boardDashMedallionCounts:shape({move:num(0,1000,true),bonus:num(0,1000,true),back3:num(0,1000,true),rollAgain:num(0,1000,true),steal:num(0,1000,true)}),boardDashCardLimit:num(1,2000,true),boardDashCardIds:ids,
 pointerHighlight:shape({enabledByDefault:bool,shortcut:str,paletteShortcut:str,clickOnly:bool,defaultPalette:one(['kids','villain']),kidsColors:arr(color,1,100),villainColors:arr(color,1,100),ringSize:num(1,1000),trailSize:num(1,1000),trailLength:num(0,10000,true),fadeMs:num(0,100000),spawnMs:num(1,100000)})
},{gameBackgrounds:record(background,one(MINI_GAME_IDS),5)}),cardLibrary:arr(card,1)});
const direction=(value:Validator)=>shape({up:value,down:value,left:value,right:value});
const snake=shape({questionText:str,setup:shape({mode:one(['versus','coop']),lessonType:one(['solo','group']),boardWidth:num(4,100,true),boardHeight:num(4,100,true),crystalCount:num(1,10000,true),coopTimerSeconds:num(10,86400,true),playerCount:num(2,4,true)}),
 playerDirectionLabels:record(direction(str),one(['player-1','player-2','player-3','player-4']),4),playerKeyBindings:record(direction(arr(str,1,8)),one(['player-1','player-2','player-3','player-4']),4),
 heroCrownSettings:shape({enabled:bool,frequency:one(['low','medium','high']),expiresAfterMoves:num(1,10000,true),cosmeticDurationSeconds:num(1,86400),bonusValue:num()}),heroCrownChallengeText:str,
 enemySettings:shape({enabled:bool,speed:one(['slow','normal']),respawnDelayTurns:num(1,10000,true),defeatReward:num()}),
 backgroundControls:shape({blur:num(0,100),brightness:num(0,10),overlay:num(0,1),panelOpacity:num(0,1),boardOpacity:num(0,1)}),backgroundImage:media
},{sounds:record(media,one(['correct','wrong','eat','crash','crown','congrats','cheer','confetti','villain']),9),music:media});
export function parseModuleConfig<K extends ModuleType>(type:K,value:unknown):ModuleConfigMap[K] {
 if(JSON.stringify(value)?.length>4000000)fail('config size');
 const validators:Record<ModuleType,Validator>={'hero-dash':(v)=>{parseDashConfig(v);},'language-snake':snake,'final-boss-hero':boss,'activation-cards':shape({sceneIds:ids})};
 if(!Object.hasOwnProperty.call(validators,type))fail('type');validators[type](value,'config');
 const result=JSON.parse(JSON.stringify(value)) as ModuleConfigMap[K];
 if(type==='final-boss-hero'){
  const b=result as ModuleConfigMap['final-boss-hero'];const e=b.encounter;const cardIds=b.cardLibrary.map(c=>c.id);unique(cardIds,'cardLibrary/id');
  for(const key of ['selectedCardIds','boardDashCardIds'] as const){unique(e[key],`encounter/${key}`);if(e[key].some(id=>!cardIds.includes(id)))fail(`encounter/${key}`);}
  unique(e.enabledMiniGames,'enabledMiniGames');if(e.gameOrder.some(game=>!e.enabledMiniGames.includes(game)))fail('gameOrder');
  for(const values of [e.rewards,e.powerUps,e.actionItems,e.cutscenes,e.introSetup.heroes])unique(values.map(v=>v.id),'nested identity');
  for(const side of ['hero','villain'] as const){if(e.battleSettings[`${side}StartHp`]>e.battleSettings[`${side}MaxHp`]||e.battleSettings[`${side}StartEnergy`]>e.battleSettings[`${side}MaxEnergy`])fail('battleSettings bounds');}
 }
 if(type==='activation-cards')unique((result as ModuleConfigMap['activation-cards']).sceneIds,'sceneIds');
 const activity={id:'validation',moduleType:type,moduleVersion:1,configVersion:1,config:result} as EpisodeActivity;
 const builtinBoss=new Set(['start','finish','move','bonus','back3','roll-again','steal'].map(key=>`builtin:final-boss-hero/assets/board-dash/${key}.png`));
 for(const ref of collectModuleAssets(activity))if(ref.ref.startsWith('builtin:')&&(type!=='final-boss-hero'||!builtinBoss.has(ref.ref)))fail(`${ref.field} builtin reference`);
 return result;
}
export function parseEpisodeActivity(value:unknown):EpisodeActivity {
 shape({id:identity,moduleType:one(['activation-cards','language-snake','final-boss-hero','hero-dash']),moduleVersion:(v,p)=>{if(v!==1)fail(p);},configVersion:(v,p)=>{if(v!==1)fail(p);},config:()=>{}},{rewardBindings:record(identity,identity,2000)})(value,'activity');
 const v=value as EpisodeActivity,config=parseModuleConfig(v.moduleType,v.config);
 const sources=v.moduleType==='language-snake'?['hero-crown']:v.moduleType==='final-boss-hero'?(config as ModuleConfigMap['final-boss-hero']).encounter.rewards.map(reward=>reward.id):[];
 if(Object.keys(v.rewardBindings??{}).some(key=>!sources.includes(key)))fail('activity reward binding source');
 return {...v,config} as EpisodeActivity;
}
export {createModuleTemplate} from './templates';

