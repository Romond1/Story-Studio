import test from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, createScene, insertScene } from './lesson/commands';
import { parseLessonProject, parseSceneDocument } from './lesson/validation';
import { createEpisodeFromScene, putDerivedImage, putCatalogEntity } from './episode/commands';
import { parseEpisodeProject } from './episode/validation';
import { createMediaRegistry } from './content/mediaRegistry';
export function episodeFixture() {
 const scene=createLesson('Source');scene.assets=[{id:'physical',filename:'source.png',originalName:'source.png',relativePath:'assets/source.png',mediaType:'image',sizeBytes:16,importedAt:''}];
 return createEpisodeFromScene(scene,{id:'adventure',version:'1'});
}
test('episode discriminator never enters scene reader; strict capabilities and media identities',()=>{
 const episode=episodeFixture(),before=JSON.stringify(episode);
 assert.throws(()=>parseLessonProject(episode),/format/);assert.equal(parseSceneDocument(episode).format,'story-studio-episode');
 assert.equal(JSON.stringify(episode),before);
 for(const patch of [{version:2},{requiredCapabilities:['unknown']},{derivedImages:[{id:'physical',kind:'derived-image',sourceAssetId:'physical',transform:{version:1},presentation:{fit:'contain'}}]}]) assert.throws(()=>parseEpisodeProject({...episode,...patch}));
});
test('derived references accept physical images only and unify background/card/image lookup',()=>{
 const episode=putDerivedImage(episodeFixture(),{id:'derived',kind:'derived-image',sourceAssetId:'physical',transform:{version:1,rotation:90},presentation:{fit:'contain'}});
 const scene=createScene('Derived','derived');const withScene=insertScene(episode,'story',scene).project;
 assert.equal(parseEpisodeProject(withScene).scenes[scene.id].background.assetId,'derived');
 const registry=createMediaRegistry({format:'scene',data:withScene});assert.deepEqual(registry.images().map(item=>item.id),['physical','derived']);assert.equal(registry.list().length,1);
 assert.equal(registry.usages('physical').length,1);assert.equal(registry.usages('derived').length,1);
 for(const source of ['missing','derived'])assert.throws(()=>putDerivedImage(episode,{...episode.derivedImages[0],sourceAssetId:source}));
 assert.throws(()=>parseEpisodeProject({...episode,assets:episode.assets.map(a=>({...a,mediaType:'audio'}))}));
});
test('catalog identity is scoped, duplicate display names are valid and unknown fields refuse',()=>{
 let episode=putCatalogEntity(episodeFixture(),{id:'one',adventureId:'adventure',kind:'character',name:'Same',tags:[],assetIds:['physical']});
 episode=putCatalogEntity(episode,{id:'two',adventureId:'adventure',kind:'location',name:'Same',tags:[],assetIds:[]});
 assert.equal(episode.catalog.entities.length,2);
 assert.throws(()=>putCatalogEntity(episode,{...episode.catalog.entities[0],adventureId:'other'}));
 assert.throws(()=>parseEpisodeProject({...episode,session:{students:['private']}}),/field/);
 const other=createEpisodeFromScene(createLesson('Other'),{id:'other',version:'1'});
 const sameName=putCatalogEntity(other,{id:'one',adventureId:'other',kind:'character',name:'Same',tags:[],assetIds:[]});
 assert.equal(sameName.catalog.entities[0].name,episode.catalog.entities[0].name);
 assert.throws(()=>putCatalogEntity(episode,sameName.catalog.entities[0]),/adventure/);
});
test('episode nested unknown payloads cannot become hidden runtime or unsupported content',()=>{
 const scene=createScene('Scene');const episode=insertScene(episodeFixture(),'story',scene).project;
 assert.throws(()=>parseEpisodeProject({...episode,scenes:{[scene.id]:{...scene,studentProgress:{a:10}}}}),/field/);
 assert.throws(()=>parseEpisodeProject({...episode,assets:episode.assets.map(asset=>({...asset,derivedTransform:{rotation:45}}))}),/field/);
});
