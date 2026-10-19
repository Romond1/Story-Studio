import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPortableProjection,validatePortableEpisode,parsePackageManifest,validatePackageClosure} from './package/validation';
import {createEpisodeFromScene,putAdventureDefinition,putEpisodeActivity} from './episode/commands';
import {createLesson,createScene,insertScene} from './lesson/commands';
import {remapModuleAssets} from './modules/media';
import {putDerivedImage,putActivityOccurrence} from './episode/commands';
import {createModuleTemplate} from './modules/templates';
import type {PackageManifestV1} from './package/model';
const episode=()=>putAdventureDefinition(createEpisodeFromScene(createLesson('Portable'),{id:'a',version:'1'}),{id:'a',version:'1',name:'Adventure',description:'',rewards:[],relics:[]});
const hash='0'.repeat(64);
const manifest=(id:string):PackageManifestV1=>({format:'story-studio-package',version:1,episodeId:id,adventure:{id:'a',version:'1'},requiredCapabilities:episode().requiredCapabilities,files:[{path:'project.json',bytes:1,sha256:hash},{path:'definitions/adventure.json',bytes:1,sha256:hash}],definitions:[{kind:'adventure',adventureId:'a',version:'1',bundledPath:'definitions/adventure.json',sha256:hash}],adventureDependencies:[{adventureId:'a',version:'1',bundledPath:'definitions/adventure.json',sha256:hash}]});
test('portable projection preserves all authored content and rejects private extensions',()=>{
 const p=episode(),projected=projectPortableProjection(p);assert.deepEqual(projected,p);assert.notEqual(projected,p);
 assert.throws(()=>projectPortableProjection({...p,studentRoster:[{name:'Private'}]}));assert.throws(()=>validatePortableEpisode({...p,adventureDefinition:undefined}));
 const boss=putEpisodeActivity(p,{id:'boss',moduleType:'final-boss-hero',moduleVersion:1,configVersion:1,config:createModuleTemplate('final-boss-hero')});assert.throws(()=>validatePortableEpisode(boss),/builtin/i);
});
test('manifest rejects unsafe/colliding paths, unknown capabilities and malformed hashes',()=>{
 const p=episode(),m=manifest(p.id);assert.deepEqual(parsePackageManifest(m),m);
 for(const path of ['../secret','/absolute','C:/secret','assets\\bad.png','assets/%2e%2e/secret','assets/CON.png','assets/file.','assets/a|b.png','assets/a<b.png','assets/CONIN$.png'])assert.throws(()=>parsePackageManifest({...m,files:[...m.files,{path,bytes:1,sha256:hash}]}));
 assert.throws(()=>parsePackageManifest({...m,files:[...m.files,{path:'PROJECT.JSON',bytes:1,sha256:hash}]}));assert.throws(()=>parsePackageManifest({...m,requiredCapabilities:['unknown']}));assert.throws(()=>parsePackageManifest({...m,files:[{path:'project.json',bytes:1,sha256:'bad'}]}));
});
test('closure requires exact definition identity and files, including unused authored assets',()=>{
 const p=episode(),m=manifest(p.id);validatePackageClosure(p,m,p.adventureDefinition!);
 assert.throws(()=>validatePackageClosure(p,m,{...p.adventureDefinition!,name:'Tampered'}));
 p.assets.push({id:'unused',relativePath:'assets/unused.png',filename:'unused.png',originalName:'unused.png',mediaType:'image',sizeBytes:1,importedAt:''});assert.throws(()=>validatePackageClosure(p,m,p.adventureDefinition!));
 const complete={...m,files:[...m.files,{path:'assets/unused.png',bytes:1,sha256:hash}]};validatePackageClosure(p,complete,p.adventureDefinition!);
 assert.throws(()=>validatePackageClosure(p,{...complete,files:[...complete.files,{path:'assets/private.json',bytes:1,sha256:hash}]},p.adventureDefinition!));
});

test('portable closure preserves all modules, derived originals, definitions and unplaced authored media',()=>{
 let p=episode();p=insertScene(p,'activation',createScene()).project;const sceneId=Object.keys(p.scenes)[0];
 p.assets.push({id:'source',relativePath:'assets/source.png',filename:'source.png',originalName:'source.png',mediaType:'image',sizeBytes:1,importedAt:''});
 p=putDerivedImage(p,{id:'derived',kind:'derived-image',sourceAssetId:'source',transform:{version:1,flipX:true},presentation:{fit:'contain'}});
 p=putAdventureDefinition(p,{...p.adventureDefinition!,rewards:[{id:'reward',name:'Same',kind:'badge',iconAssetId:'derived'}],relics:[{id:'relic',name:'Same',imageAssetId:'source',stages:[{id:'stage',name:'Stage',requiredProgress:2,imageAssetId:'derived'}]}]});
 p=putEpisodeActivity(p,{id:'activation',moduleType:'activation-cards',moduleVersion:1,configVersion:1,config:{sceneIds:[sceneId]}});
 p=putActivityOccurrence(p,{id:'activation-occurrence',activityId:'activation',section:'activation'});
 p=putEpisodeActivity(p,{id:'snake',moduleType:'language-snake',moduleVersion:1,configVersion:1,config:{...createModuleTemplate('language-snake'),backgroundImage:'asset:derived'}});
 const boss=remapModuleAssets({id:'boss',moduleType:'final-boss-hero',moduleVersion:1,configVersion:1,config:createModuleTemplate('final-boss-hero')},()=> 'asset:source');p=putEpisodeActivity(p,boss);
 const before=JSON.stringify(p);assert.deepEqual(validatePortableEpisode(p),p);assert.equal(JSON.stringify(p),before);
 const m={...manifest(p.id),requiredCapabilities:p.requiredCapabilities,files:[...manifest(p.id).files,{path:'assets/source.png',bytes:1,sha256:hash}]};validatePackageClosure(p,m,p.adventureDefinition!);
 assert.throws(()=>validatePortableEpisode({...p,assets:[]}));assert.throws(()=>validatePortableEpisode({...p,assets:p.assets.map(asset=>({...asset,mediaType:'audio'}))}));
});
test('materialized builtin provenance pins known module version and exact asset file digest',()=>{
 const p=episode();p.assets.push({id:'builtin-start',relativePath:'assets/start.png',filename:'start.png',originalName:'start.png',mediaType:'image',sizeBytes:1,importedAt:''});
 const m={...manifest(p.id),files:[...manifest(p.id).files,{path:'assets/start.png',bytes:1,sha256:hash}],materializedBuiltins:[{ref:'builtin:final-boss-hero/assets/board-dash/start.png',moduleVersion:1,assetId:'builtin-start',sha256:hash}]};
 validatePackageClosure(p,m,p.adventureDefinition!);
 assert.throws(()=>parsePackageManifest({...m,materializedBuiltins:[{...m.materializedBuiltins[0],ref:'builtin:final-boss-hero/unknown.png'}]}));
 assert.throws(()=>validatePackageClosure(p,{...m,materializedBuiltins:[{...m.materializedBuiltins[0],sha256:'1'.repeat(64)}]},p.adventureDefinition!));
 assert.throws(()=>parsePackageManifest({...m,materializedBuiltins:[m.materializedBuiltins[0],m.materializedBuiltins[0]]}));
});
