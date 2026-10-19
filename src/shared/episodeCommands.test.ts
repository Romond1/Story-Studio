import test from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, createScene, insertScene, addCard, putScene } from './lesson/commands';
import { addSection } from './lesson/sections';
import { createEpisodeFromScene, putCatalogEntity, putCatalogCollection, removeCatalogEntity, removeCatalogCollection } from './episode/commands';
import { ProjectHistory } from './projectHistory';
import type { EpisodeProject } from './episode/model';
import { copyObjects, pasteObjects } from './lesson/objectClipboard';
import { mergeLessonMediaImport } from './lesson/mediaImport';
test('immutable scene commands and history preserve the episode envelope',()=>{
 const original=createLesson('Source'),before=JSON.stringify(original);let episode=createEpisodeFromScene(original,{id:'adventure',version:'1'});
 const history=new ProjectHistory<EpisodeProject>();history.reset(episode);
 const added=insertScene(episode,'story',createScene());episode=added.project;
 episode=putScene(episode,{...episode.scenes[Object.keys(episode.scenes)[0]],title:'Edited'});
 episode=addCard(episode,Object.keys(episode.scenes)[0]).project;episode=addSection(episode,'story','Act').project;
 const sceneId=Object.keys(episode.scenes)[0];episode=pasteObjects(episode,sceneId,copyObjects(episode,sceneId,episode.scenes[sceneId].objects.map(object=>object.id))).project;
 episode=mergeLessonMediaImport(episode,{importedAssets:[{id:'new',filename:'new.png',originalName:'new.png',relativePath:'assets/new.png',mediaType:'image',sizeBytes:1,importedAt:''}],createdSlides:[]});
 history.record(episode);assert.equal(episode.format,'story-studio-episode');assert.equal(episode.adventure.id,'adventure');assert.deepEqual(episode.catalog.entities,[]);
 assert.equal(JSON.stringify(original),before);assert.equal(history.undo()?.format,'story-studio-episode');assert.equal(history.redo()?.format,'story-studio-episode');
});
test('catalog membership validates references and requires reassignment before entity deletion',()=>{
 let episode=createEpisodeFromScene(createLesson('Catalog'),{id:'a',version:'1'});
 episode=putCatalogEntity(episode,{id:'entity',adventureId:'a',kind:'item',name:'Key',tags:['manual'],assetIds:[]});
 assert.equal(episode.catalog.entities[0].tagAnnotations?.[0].source,'manual');
 assert.throws(()=>putCatalogCollection(episode,{id:'c',adventureId:'a',name:'Collection',entityIds:['missing']}),/references/);
 episode=putCatalogCollection(episode,{id:'c',adventureId:'a',name:'Collection',entityIds:['entity']});
 assert.throws(()=>removeCatalogEntity(episode,'entity'),/referenced/);
 episode=removeCatalogCollection(episode,'c');episode=removeCatalogEntity(episode,'entity');assert.equal(episode.catalog.entities.length,0);
});
