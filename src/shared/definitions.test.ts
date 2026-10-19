import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAdventureDefinition} from './definitions/validation';
import {putAdventureDefinition,createEpisodeFromScene} from './episode/commands';
import {createLesson} from './lesson/commands';
import {parseEpisodeProject} from './episode/validation';
import type {AdventureDefinition} from './definitions/model';
const definition=():AdventureDefinition=>({id:'adventure',version:'1',name:'World',description:'Story',rewards:[{id:'gem',name:'Same name',kind:'collectible'}],relics:[{id:'relic',name:'Same name',stages:[{id:'one',name:'One',requiredProgress:1},{id:'two',name:'Two',requiredProgress:3}]}]});
test('adventure definitions are authored, strictly versioned, and reject nested private state',()=>{
 assert.deepEqual(parseAdventureDefinition(definition()),definition());
 for(const bad of [{...definition(),studentProgress:{}},{...definition(),rewards:[{...definition().rewards[0],balance:2}]},{...definition(),relics:[{...definition().relics[0],progress:1}]}])assert.throws(()=>parseAdventureDefinition(bad));
 assert.throws(()=>parseAdventureDefinition({...definition(),rewards:[definition().rewards[0],definition().rewards[0]]}));
 assert.throws(()=>parseAdventureDefinition({...definition(),relics:[{...definition().relics[0],stages:[{id:'one',name:'One',requiredProgress:3},{id:'two',name:'Two',requiredProgress:2}]}]}));
});
test('definition command preserves immutable episode and validates adventure identity/capability/media',()=>{
 const before=createEpisodeFromScene(createLesson('Episode'),{id:'adventure',version:'1'});const next=putAdventureDefinition(before,definition());
 assert.equal(before.adventureDefinition,undefined);assert.ok(next.requiredCapabilities.includes('adventure-definitions-v1'));
 assert.throws(()=>putAdventureDefinition(before,{...definition(),id:'different'}));assert.throws(()=>putAdventureDefinition(before,{...definition(),version:'2'}));
 assert.throws(()=>parseEpisodeProject({...next,requiredCapabilities:[]}));
 assert.throws(()=>putAdventureDefinition(before,{...definition(),rewards:[{id:'gem',name:'Gem',kind:'badge',iconAssetId:'missing'}]}));
});

test('clearing optional definition images removes the authored property',()=>{
 const parsed=parseAdventureDefinition({...definition(),rewards:[{...definition().rewards[0],iconAssetId:undefined}],relics:[{...definition().relics[0],imageAssetId:undefined,stages:[{...definition().relics[0].stages[0],imageAssetId:undefined}]}]});
 assert.ok(!Object.hasOwnProperty.call(parsed.rewards[0],'iconAssetId'));assert.ok(!Object.hasOwnProperty.call(parsed.relics[0],'imageAssetId'));
});
