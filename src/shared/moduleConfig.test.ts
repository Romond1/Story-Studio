import {createMediaRegistry} from './content/mediaRegistry';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createModuleTemplate } from './modules/templates';
import { parseModuleConfig } from './modules/validation';
import { collectModuleAssets, remapModuleAssets } from './modules/media';
import { createEpisodeFromScene, putEpisodeActivity, putActivityOccurrence } from './episode/commands';
import { createLesson } from './lesson/commands';
import { parseEpisodeProject } from './episode/validation';
test('strict module authored schemas reject runtime and names without falling back',()=>{
 for(const type of ['language-snake','final-boss-hero','activation-cards'] as const){
  const config=createModuleTemplate(type);assert.deepEqual(parseModuleConfig(type,config),config);
  assert.throws(()=>parseModuleConfig(type,{...config,session:{scores:1}}));
 }
 const snake=createModuleTemplate('language-snake');assert.throws(()=>parseModuleConfig('language-snake',{...snake,setup:{...snake.setup,playerNames:['Private']}}));
 assert.throws(()=>parseModuleConfig('language-snake',{...snake,backgroundImage:'story-media://scope/file.png'}));
 const boss=createModuleTemplate('final-boss-hero');assert.throws(()=>parseModuleConfig('final-boss-hero',{...boss,cardLibrary:[]}));
});
test('typed media enumeration and remapping preserve nonmedia text and original',()=>{
 const config=createModuleTemplate('final-boss-hero');config.cardLibrary[0].image='asset:picture';config.cardLibrary[0].description='asset:not-media';
 const activity={id:'boss',moduleType:'final-boss-hero' as const,moduleVersion:1 as const,configVersion:1 as const,config};
 const before=JSON.stringify(activity);const refs=collectModuleAssets(activity);assert.ok(refs.some(ref=>ref.assetId==='picture'));assert.ok(!refs.some(ref=>ref.assetId==='not-media'));
 const mapped=remapModuleAssets(activity,ref=>ref==='asset:picture'?'asset:replacement':ref);assert.equal(mapped.config.cardLibrary[0].image,'asset:replacement');assert.equal(JSON.stringify(activity),before);
});
test('episode activities preserve order and require capability and valid references',()=>{
 const original=createEpisodeFromScene(createLesson('Episode'),{id:'adventure',version:'1'});
 let p=putEpisodeActivity(original,{id:'snake',moduleType:'language-snake',moduleVersion:1,configVersion:1,config:createModuleTemplate('language-snake')});
 p=putActivityOccurrence(p,{id:'first',activityId:'snake',section:'challenge'});p=putActivityOccurrence(p,{id:'second',activityId:'snake',section:'challenge'});
 assert.deepEqual(p.occurrences?.map(x=>x.id),['first','second']);assert.equal(original.activities,undefined);
 assert.throws(()=>parseEpisodeProject({...p,requiredCapabilities:[]}));assert.throws(()=>putActivityOccurrence(p,{id:'bad',activityId:'missing',section:'mastery'}));
 assert.throws(()=>parseEpisodeProject({...p,activities:[...p.activities!,p.activities![0]]}));
});
test('Final Boss preserves all optional authoring fields and enumerates every media-bearing field',()=>{
 const config=createModuleTemplate('final-boss-hero'),e=config.encounter,c=config.cardLibrary[0];
 Object.assign(c,{description:'Detail',frontImage:'asset:front',backImage:'asset:back',frontText:'Prompt',backText:'Answer',textColor:'#ffcc00',fontSize:24,textAlign:'center',cardWidth:240,cardHeight:320,miniGames:['boardDash'],boardDashQuestion:'Question'});
 e.hero.portrait='asset:hero';e.hero.video='asset:heroVideo';e.villain.portrait='asset:villain';e.villain.video='asset:villainVideo';
 e.introSetup.heroes=[{id:'hero-option',name:'Hero',portrait:'asset:option',video:'asset:optionVideo',subtitle:'Story'}];
 e.background='asset:background';e.gameBackgrounds={memoryReveal:'asset:memory',matchPairs:'asset:pairs',laneBattle:'asset:lane',openBox:'asset:box',boardDash:'asset:board'};
 e.cutscenes=[{id:'cut',name:'Movie',mediaSource:'asset:movie',mediaType:'video',description:'Movie description',tags:['tag']}];
 e.rewards=[{id:'reward',name:'Gem',description:'Reward',value:2,icon:'asset:icon',category:'item',applicableGames:['boardDash'],effectType:'custom',effectValue:3}];
 e.powerUps=[{id:'power',name:'Power',description:'Power',charges:2,energyCost:1,icon:'⭐',category:'magic',applicableGames:['matchPairs'],effectType:'heal',effectValue:5}];
 e.actionItems=[{id:'action',text:'Jump',emoji:'⭐',category:'movement'}];
 assert.deepEqual(parseModuleConfig('final-boss-hero',config),config);
 const refs=collectModuleAssets({id:'boss',moduleType:'final-boss-hero',moduleVersion:1,configVersion:1,config});
 assert.equal(refs.filter(r=>r.assetId).length,16);assert.ok(!refs.some(r=>r.ref==='⭐'));
 for(const bad of ['https://remote/image.png','data:image/png;base64,x','assets/local.png','builtin:final-boss-hero/unknown.png'])assert.throws(()=>parseModuleConfig('final-boss-hero',{...config,encounter:{...e,background:bad}}));
});

test('module dependencies cover unplaced activities and flag unknown authored config',()=>{
 const episode=createEpisodeFromScene(createLesson('Dependencies'),{id:'a',version:'1'});
 episode.assets.push({id:'background',filename:'bg.png',originalName:'bg.png',relativePath:'assets/bg.png',mediaType:'image',sizeBytes:1,importedAt:''});
 const config=createModuleTemplate('language-snake');config.backgroundImage='asset:background';config.questionText='asset:not-media';
 const project=putEpisodeActivity(episode,{id:'unused',moduleType:'language-snake',moduleVersion:1,configVersion:1,config});
 const report=createMediaRegistry({format:'scene',data:project}).dependencies();assert.equal(report.complete,true);assert.ok(report.uses.some(use=>use.ownerType==='module'&&use.assetId==='background'));assert.ok(!report.uses.some(use=>use.assetId==='not-media'));
 (project.activities![0].config as any).futureMedia={image:'asset:hidden'};
 assert.equal(createMediaRegistry({format:'scene',data:project}).dependencies().complete,false);
});
test('activity reward bindings require declared source keys and exact adventure reward identities',()=>{
 const original=createEpisodeFromScene(createLesson('Bindings'),{id:'a',version:'1'});
 const p={...original,requiredCapabilities:[...original.requiredCapabilities,'adventure-definitions-v1' as const],adventureDefinition:{id:'a',version:'1',name:'A',description:'',rewards:[{id:'gem',name:'Crown',kind:'badge' as const}],relics:[]}};
 const activity={id:'snake',moduleType:'language-snake' as const,moduleVersion:1 as const,configVersion:1 as const,config:createModuleTemplate('language-snake'),rewardBindings:{'hero-crown':'gem'}};
 assert.equal(putEpisodeActivity(p,activity).activities?.[0].rewardBindings?.['hero-crown'],'gem');
 assert.throws(()=>putEpisodeActivity(p,{...activity,rewardBindings:{unknown:'gem'}}));assert.throws(()=>putEpisodeActivity(p,{...activity,rewardBindings:{'hero-crown':'Crown'}}));assert.throws(()=>putEpisodeActivity(original,activity));
});
