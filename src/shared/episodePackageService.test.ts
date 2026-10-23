import type { AssetItem } from './types';
import { addReviewMedia } from './lesson/sections';
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLesson, createScene } from './lesson/commands';
import { createModuleTemplate } from './modules/templates';
import { exportEpisodePackage, importEpisodePackage, rejectPackageFolder } from '../main/episodePackageService';
const fixture=()=>({...createLesson('Portable'),format:'story-studio-episode',version:1,adventure:{id:'adventure',version:'1'},requiredCapabilities:['derived-images-v1','manual-catalog-v1','adventure-definitions-v1'],derivedImages:[],catalog:{entities:[]},adventureDefinition:{id:'adventure',version:'1',name:'Adventure',description:'',rewards:[],relics:[]}});

test('portable scene bubbles retain vector style, tail, delay and font settings',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-bubbles-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'source'),target=path.join(root,'package'),editable=path.join(root,'editable');for(const folder of [source,target,editable])await fs.mkdir(folder);
 const scene=createScene('Dialogue');scene.objects=[{id:'bubble',kind:'bubble',visible:true,box:{x:20,y:20,width:200,height:70},text:'What happens next?',fontSize:32,color:'#182331',align:'center',bubbleDefId:'BD_OVAL',bubbleTail:'top-right',appearDelayMs:1200,disappearAtMs:3200}];
 const data={...fixture(),scenes:{[scene.id]:scene},sequences:{story:[{id:'entry',sceneId:scene.id,section:''}],activation:[]}};
 await fs.writeFile(path.join(source,'project.json'),JSON.stringify(data));await exportEpisodePackage({source,target,data,builtinRoot:root,assertCurrent:()=>{}});const imported=await importEpisodePackage({source:target,target:editable,assertCurrent:()=>{}});
 const reloaded=JSON.parse(await fs.readFile(path.join(editable,'project.json'),'utf8'));assert.deepEqual(reloaded.scenes[scene.id].objects,scene.objects);
});

test('portable export/import preserves custom display titles, original filenames, IDs and exact media bytes', async t => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'package-titles-'));
 t.after(() => fs.rm(root, { recursive: true, force: true }));
 const source = path.join(root, 'source'), target = path.join(root, 'package'), destination = path.join(root, 'editable');
 for (const folder of [source, target, destination]) await fs.mkdir(folder);
 await fs.mkdir(path.join(source, 'assets'));
 const bytes = await fs.readFile(path.resolve('assets/Splash Screen/Story.png'));
 const asset = { id: 'stable-picture', relativePath: 'assets/stable.png', filename: 'stable.png', originalName: 'FOREST_1920x1080_export.png', displayTitle: 'Forest at Dawn', hiddenFromMediaPool: true, mediaType: 'image', sizeBytes: bytes.length, importedAt: '' };
 const videoBytes = await fs.readFile(path.resolve('docs/timeline-ux-demo/assets/video.webm'));
 const video = { id: 'stable-video', relativePath: 'assets/stable.webm', filename: 'stable.webm', originalName: 'FOREST_WALK_1080p_30fps.webm', displayTitle: 'Walking Through the Forest', mediaType: 'video', sizeBytes: videoBytes.length, importedAt: '' };
 const data = { ...fixture(), assets: [asset, video] };
 const scene = createScene('Trimmed video', video.id); scene.background.videoTrim = { inSec: .5, outSec: 1.5 };
 data.scenes[scene.id] = scene; data.sequences.story.push({ id: 'trimmed-entry', sceneId: scene.id, section: '' });
 const review = addReviewMedia(addReviewMedia(createScene('Review board'), asset as AssetItem, 'Door'), video as AssetItem, 'Dialogue');
 review.background={color:'#112233',assetId:asset.id,imageAppearance:{blur:8,feather:15,scale:1.2}};
 const picture=review.objects.find(o=>o.kind==='image');if(picture?.kind==='image')picture.appearance={blur:4,border:1,opacity:.8};
 data.scenes[review.id] = review; data.sequences.story.push({ id: 'review-entry', sceneId: review.id, section: '', kind: 'break' } as typeof data.sequences.story[number]);
 const before = JSON.stringify(data);
 await fs.writeFile(path.join(source, asset.relativePath), bytes);
 await fs.writeFile(path.join(source, video.relativePath), videoBytes);
 await exportEpisodePackage({ source, target, data, builtinRoot: root, assertCurrent: () => {} });
 const imported = await importEpisodePackage({ source: target, target: destination, assertCurrent: () => {} });
 assert.deepEqual(imported.data.assets, [asset, video]);
 assert.deepEqual(imported.data.scenes[review.id],review);
 assert.equal(imported.data.sequences.story.find(e=>e.id==='review-entry')?.kind,'break');
 assert.deepEqual(imported.data.scenes[scene.id].background.videoTrim, { inSec: .5, outSec: 1.5 });
 assert.equal(JSON.stringify(data), before);
 assert.deepEqual(await fs.readFile(path.join(destination, asset.relativePath)), bytes);
 assert.deepEqual(await fs.readFile(path.join(destination, video.relativePath)), videoBytes);
});
test('package export excludes private files and import creates an editable verified copy',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-roundtrip-'));
 try{const source=path.join(root,'source'),target=path.join(root,'package'),destination=path.join(root,'editable');for(const p of [source,target,destination])await fs.mkdir(p);
 const data=fixture();await fs.writeFile(path.join(source,'project.json'),JSON.stringify(data));await fs.writeFile(path.join(source,'student-progress.json'),'PRIVATE');
 await exportEpisodePackage({source,target,data,builtinRoot:root,assertCurrent:()=>{}});
 assert.deepEqual((await fs.readdir(target)).sort(),['definitions','manifest.json','project.json']);
 await assert.rejects(rejectPackageFolder(target),/Import/);
 const imported=await importEpisodePackage({source:target,target:destination,assertCurrent:()=>{}});assert.equal(imported.data.id,data.id);assert.deepEqual(await fs.readdir(destination),['project.json']);
 assert.equal(await fs.readFile(path.join(source,'student-progress.json'),'utf8'),'PRIVATE');
 await fs.writeFile(path.join(target,'project.json'),'{}');const bad=path.join(root,'bad');await fs.mkdir(bad);
 await assert.rejects(importEpisodePackage({source:target,target:bad,assertCurrent:()=>{}}),/hash|digest/i);assert.deepEqual(await fs.readdir(bad),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('all authored unused bytes and exact builtin files survive portable remapping',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-media-'));
 try{const source=path.join(root,'source'),target=path.join(root,'package');await fs.mkdir(source);await fs.mkdir(target);await fs.mkdir(path.join(source,'assets'));const content=Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00');await fs.writeFile(path.join(source,'assets','unused.mp3'),content);
 const data={...fixture(),requiredCapabilities:[...fixture().requiredCapabilities,'bundled-modules-v1'],assets:[{id:'unused',relativePath:'assets/unused.mp3',filename:'unused.mp3',originalName:'unused.mp3',mediaType:'audio',sizeBytes:content.length,importedAt:new Date().toISOString()}],activities:[{id:'boss',moduleType:'final-boss-hero',moduleVersion:1,configVersion:1,config:createModuleTemplate('final-boss-hero')}],occurrences:[]};const before=JSON.stringify(data);
 await exportEpisodePackage({source,target,data,builtinRoot:path.resolve('games'),assertCurrent:()=>{}});assert.equal(JSON.stringify(data),before);const saved=JSON.parse(await fs.readFile(path.join(target,'project.json'),'utf8'));assert.equal(saved.assets.length,3);assert.ok(saved.activities[0].config.cardLibrary.every((c:any)=>c.image.startsWith('asset:')));
 for(const asset of saved.assets.filter((a:any)=>a.id!=='unused'))assert.deepEqual(await fs.readFile(path.join(target,asset.relativePath)),await fs.readFile(path.join('games/final-boss-hero/assets/board-dash',asset.originalName)));
 assert.deepEqual(await fs.readFile(path.join(target,'assets/unused.mp3')),content);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('wrong image bytes block publication even with matching declared size',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-image-'));
 try{const source=path.join(root,'source'),target=path.join(root,'package');await fs.mkdir(source);await fs.mkdir(target);await fs.mkdir(path.join(source,'assets'));await fs.writeFile(path.join(source,'assets','x.png'),'not an image');
 const data={...fixture(),assets:[{id:'x',relativePath:'assets/x.png',filename:'x.png',originalName:'x.png',mediaType:'image',sizeBytes:12,importedAt:new Date().toISOString()}]};await assert.rejects(exportEpisodePackage({source,target,data,builtinRoot:root,assertCurrent:()=>{}}),/media.*type|signature/i);assert.deepEqual(await fs.readdir(target),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('junction escapes and publication interruption leave the selected target empty',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-junction-'));
 try{const source=path.join(root,'source'),target=path.join(root,'package'),outside=path.join(root,'outside');for(const p of [source,target,outside])await fs.mkdir(p);await fs.writeFile(path.join(outside,'x.png'),'outside');await fs.symlink(outside,path.join(source,'assets'),'junction');
 const data={...fixture(),assets:[{id:'x',relativePath:'assets/x.png',filename:'x.png',originalName:'x.png',mediaType:'image',sizeBytes:7,importedAt:new Date().toISOString()}]};await assert.rejects(exportEpisodePackage({source,target,data,builtinRoot:root,assertCurrent:()=>{}}),/symbolic/);assert.deepEqual(await fs.readdir(target),[]);
 let checks=0;await assert.rejects(exportEpisodePackage({source,target,data:fixture(),builtinRoot:root,assertCurrent:()=>{if(++checks>1)throw Error('interrupted');}}),/interrupted/);assert.deepEqual(await fs.readdir(target),[]);assert.equal((await fs.readdir(root)).some(n=>n.startsWith('.story-package-')),false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('unlisted files, stale export and unsafe manifests never publish',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-reject-'));
 try{const source=path.join(root,'source'),target=path.join(root,'package'),destination=path.join(root,'editable');for(const p of [source,target,destination])await fs.mkdir(p);
 await assert.rejects(exportEpisodePackage({source,target,data:fixture(),builtinRoot:root,assertCurrent:()=>{throw Error('stale lease');}}),/stale/);assert.deepEqual(await fs.readdir(target),[]);
 await exportEpisodePackage({source,target,data:fixture(),builtinRoot:root,assertCurrent:()=>{}});
 await fs.writeFile(path.join(target,'private.json'),'{}');await assert.rejects(importEpisodePackage({source:target,target:destination,assertCurrent:()=>{}}),/unlisted|inventory/i);assert.deepEqual(await fs.readdir(destination),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('unsafe, colliding, unsupported and oversized manifests fail before editable publication',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-manifest-'));
 try{const source=path.join(root,'source'),target=path.join(root,'package'),destination=path.join(root,'editable');for(const p of [source,target,destination])await fs.mkdir(p);await exportEpisodePackage({source,target,data:fixture(),builtinRoot:root,assertCurrent:()=>{}});
 const manifest=JSON.parse(await fs.readFile(path.join(target,'manifest.json'),'utf8'));
 const mutations=[(m:any)=>{m.files[0].path='../project.json';},(m:any)=>{m.files.push({...m.files[0],path:'PROJECT.JSON'});},(m:any)=>{m.requiredCapabilities.push('unknown-capability');},(m:any)=>{m.files[0].bytes=Number.MAX_SAFE_INTEGER;},(m:any)=>{m.files[0].path='assets/NUL.png';}];
 for(const mutate of mutations){const changed=structuredClone(manifest);mutate(changed);await fs.writeFile(path.join(target,'manifest.json'),JSON.stringify(changed));await assert.rejects(importEpisodePackage({source:target,target:destination,assertCurrent:()=>{}}));assert.deepEqual(await fs.readdir(destination),[]);}
 await fs.writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest));await fs.mkdir(path.join(target,'empty'));let folder=path.join(target,'empty');for(let i=0;i<33;i++){folder=path.join(folder,'d');await fs.mkdir(folder);}await assert.rejects(importEpisodePackage({source:target,target:destination,assertCurrent:()=>{}}),/depth/);assert.deepEqual(await fs.readdir(destination),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
