import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importProjectMedia } from '../main/mediaImportService';
import { registerPoolImport, insertPoolAssets, mediaUsage, groupMediaByType, renameMediaBin, removeMediaBin } from './mediaPool';
import type { ProjectData } from './types';
const data:ProjectData={version:4,createdAt:'',updatedAt:'',assets:[],slides:[],sections:[{id:'one',name:'One'}]};
test('bin rename preserves identity; bin removal reparents media and child bins without deleting references',()=>{
  const assets=['parent','child','grandchild'].map((binId,i)=>({id:`asset${i}`,binId} as ProjectData['assets'][number]));
  const before={...data,assets,mediaBins:[{id:'parent',name:'Parent'},{id:'child',name:'Child',parentId:'parent'},{id:'grandchild',name:'Grandchild',parentId:'child'}]};
  const renamed=renameMediaBin(before,'child','  Review media  ');
  assert.equal(renamed.mediaBins![1].name,'Review media');assert.equal(renamed.mediaBins![1].id,'child');assert.equal(before.mediaBins[1].name,'Child');
  assert.equal(renameMediaBin(before,'child','   '),before);assert.equal(renameMediaBin(before,'','Root'),before);
  const removed=removeMediaBin(renamed,'child');
  assert.deepEqual(removed.mediaBins!.map(b=>[b.id,b.parentId]),[['parent',undefined],['grandchild','parent']]);
  assert.deepEqual(removed.assets.map(a=>a.binId),['parent','parent','grandchild']);assert.equal(removed.slides,before.slides);assert.equal(before.assets[1].binId,'child');
  const rootRemoved=removeMediaBin(before,'parent');assert.equal(rootRemoved.assets[0].binId,undefined);assert.equal(rootRemoved.mediaBins![0].parentId,undefined);
  assert.equal(removeMediaBin(before,'missing'),before);assert.equal(removeMediaBin(before,''),before);
});
test('optional type grouping is stable within types and leaves the original bin order intact',()=>{
  const assets=[{id:'v1',mediaType:'video' as const},{id:'p1',mediaType:'image' as const},{id:'v2',mediaType:'video' as const},{id:'p2',mediaType:'image' as const},{id:'a',mediaType:'audio' as const}];
  assert.deepEqual(groupMediaByType(assets).map(a=>a.id),['p1','p2','v1','v2','a']);
  assert.deepEqual(assets.map(a=>a.id),['v1','p1','v2','p2','a']);
});
test('replacement remaps authored legacy media paths without rewriting prose or the undo snapshot',()=>{
  const original={id:'sound',filename:'old.wav',relativePath:'assets/old.wav',originalName:'sound.wav',mediaType:'audio' as const,sizeBytes:1,importedAt:''};
  const replacement={...original,filename:'new.wav',relativePath:'assets/new.wav'};
  const before={...data,assets:[original],slides:[{id:'slide',assetId:'sound',sectionId:'one',transition:'none' as const,dialogue:[{url:'media://assets/old.wav',volume:1}]}]};
  const next=registerPoolImport(before,{importedAssets:[],createdSlides:[],replacedAssets:[replacement]});
  assert.equal(next.slides[0].dialogue![0].url,'media://assets/new.wav');assert.equal(before.slides[0].dialogue![0].url,'media://assets/old.wav');
});
test('same-name import asks once per conflict, replaces without changing identity and preserves old bytes', async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'story-duplicates-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const folder=path.join(root,'project'), a=path.join(root,'a'), b=path.join(root,'b');await fs.mkdir(a);await fs.mkdir(b);
  await fs.writeFile(path.join(a,'scene.mp4'),'old');await fs.writeFile(path.join(b,'scene.mp4'),'new');
  const first=await importProjectMedia(folder,[path.join(a,'scene.mp4')],'one');
  let prompts=0;const resolveDuplicate=async()=>{prompts++;return 'incoming' as const;};
  const result=await importProjectMedia(folder,[path.join(b,'scene.mp4')],'one',{existingAssets:first.importedAssets,resolveDuplicate});
  assert.equal(prompts,1);assert.equal(result.importedAssets.length,0);assert.equal(result.createdSlides.length,0);
  assert.equal(result.replacedAssets?.[0].id,first.importedAssets[0].id);
  assert.equal(await fs.readFile(path.join(folder,first.importedAssets[0].relativePath),'utf8'),'old');
  assert.equal(await fs.readFile(path.join(folder,result.replacedAssets![0].relativePath),'utf8'),'new');
  const merged=registerPoolImport({...data,assets:first.importedAssets},result);assert.equal(merged.assets.length,1);assert.equal(merged.assets[0].id,first.importedAssets[0].id);
  const skipped=await importProjectMedia(folder,[path.join(b,'scene.mp4')],'one',{existingAssets:merged.assets,resolveDuplicate:async()=> 'existing'});
  assert.equal(skipped.importedAssets.length,0);assert.equal(skipped.replacedAssets?.length??0,0);
});
test('bulk same-name files keep one pool item and one scene wrapper; different names stay distinct',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'story-duplicates-bulk-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'a'));await fs.mkdir(path.join(root,'b'));
  await fs.writeFile(path.join(root,'a','SAME.PNG'),'a');await fs.writeFile(path.join(root,'b','same.png'),'b');await fs.writeFile(path.join(root,'b','different.png'),'b');
  let prompts=0;const result=await importProjectMedia(path.join(root,'project'),[path.join(root,'a'),path.join(root,'b')],'one',{resolveDuplicate:async()=>{prompts++;return 'incoming';}});
  assert.equal(prompts,1);assert.equal(result.importedAssets.length,2);assert.equal(result.createdSlides.length,2);assert.equal(result.replacedAssets?.length??0,0);
});
test('folder import preserves nested bins, UUID files, types and reports unsupported entries without lesson sections',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'story-pool-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=path.join(root,'Episode');await fs.mkdir(path.join(source,'Part'),{recursive:true});
  for(const name of ['same.PNG','Part/same.PNG','Part/scene.mp4','Part/music.mp3','notes.txt'])await fs.writeFile(path.join(source,name),'fixture');
  const result=await importProjectMedia(path.join(root,'project'),[source],'one');
  assert.equal(result.importedAssets.length,3);assert.equal(result.createdSlides.length,2);
  assert.equal(result.importedBins?.length,2);assert.equal(result.failures?.length,1);
  for(const asset of result.importedAssets){assert.match(asset.relativePath,/^assets\/[a-f0-9-]+\.(png|mp4|mp3)$/);assert.ok(asset.binId);await fs.access(path.join(root,'project',asset.relativePath));}
  const pool=registerPoolImport(data,result);assert.equal(pool.sections.length,1);assert.equal(pool.slides.length,0);
  const saved=JSON.parse(JSON.stringify(pool));assert.equal(saved.mediaBins.length,2);assert.equal(saved.assets.length,3);
});
test('pool insertion is deterministic, creates wrappers, counts usage and retains assets on removal',()=>{
  const assets=['a','b'].map(id=>({id,relativePath:`assets/${id}.png`,filename:`${id}.png`,originalName:`${id}.png`,mediaType:'image' as const,sizeBytes:1,importedAt:''}));
  const pool=registerPoolImport(data,{importedAssets:assets,createdSlides:[]});let nextId=0;
  const first=insertPoolAssets(pool,['b','a'],'one',null,()=>`slide${++nextId}`);
  assert.deepEqual(first.slides.map(s=>s.assetId),['b','a']);
  const second=insertPoolAssets(first,['a'],'one',first.slides[1].id,()=>`slide${++nextId}`);
  assert.deepEqual(second.slides.map(s=>s.assetId),['b','a','a']);assert.equal(mediaUsage(second,'a'),2);
  const removed={...second,slides:second.slides.filter(s=>s.assetId!=='a')};assert.equal(mediaUsage(removed,'a'),0);assert.equal(removed.assets.length,2);
  assert.throws(()=>insertPoolAssets(pool,['a'],'missing',null,()=>''),/section/i);
});

test('partial copy failures are returned alongside successful assets, never hidden',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'story-pool-fail-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const good=path.join(root,'good.png');await fs.writeFile(good,'image');
  const result=await importProjectMedia(path.join(root,'project'),[good,path.join(root,'missing.png')],'one');
  assert.equal(result.importedAssets.length,1);assert.equal(result.failures?.length,1);
  assert.equal(result.failures?.[0].name,'missing.png');
  assert.equal(registerPoolImport(data,result).assets.length,1);
});

test('authored usage ignores prose containing asset paths', () => {
  const image = { id: 'img', relativePath: 'assets/img.png', filename: 'img.png', originalName: 'img.png', mediaType: 'image' as const, sizeBytes: 1, importedAt: '' };
  const fixture = { ...data, assets: [image], sections: [{ id: 'one', name: 'Notes about /assets/img.png' }] };
  assert.equal(mediaUsage(fixture, 'img'), 0);
});

test('pool imports refuse asset and bin identity collisions without changing authored data', () => {
  const image = { id: 'img', relativePath: 'assets/img.png', filename: 'img.png', originalName: 'img.png', mediaType: 'image' as const, sizeBytes: 1, importedAt: '' };
  const existing = { ...data, assets: [image], mediaBins: [{ id: 'bin', name: 'Original' }] };
  const before = JSON.stringify(existing);
  assert.throws(() => registerPoolImport(existing, { importedAssets: [image], createdSlides: [] }), /duplicate|collision/i);
  assert.throws(() => registerPoolImport(existing, { importedAssets: [], importedBins: [{ id: 'bin', name: 'Other' }], createdSlides: [] }), /duplicate|collision/i);
  assert.equal(JSON.stringify(existing), before);
  assert.throws(() => registerPoolImport(existing, { importedAssets: [{ ...image, id: 'different' }], createdSlides: [] }), /path.*collision/i);
  assert.throws(() => registerPoolImport(existing, { importedAssets: [{ ...image, id: 'different', relativePath: '../escape.png' }], createdSlides: [] }), /unsafe/i);
  assert.throws(() => registerPoolImport(existing, { importedAssets: [], importedBins: [{ id: 'new', name: 'New', parentId: 'absent' }], createdSlides: [] }), /bin/i);
});
test('break placement creates BreakMedia wrappers and audio remains a pool asset',()=>{
  const image={id:'img',relativePath:'assets/img.png',filename:'img.png',originalName:'1 landscape.png',mediaType:'image' as const,sizeBytes:1,importedAt:''};
  const audio={...image,id:'audio',mediaType:'audio' as const,relativePath:'assets/music.mp3'};
  const pool=registerPoolImport({...data,sections:[{id:'pause',name:'Pause',type:'break'}]},{importedAssets:[image,audio],createdSlides:[]});
  let n=0;const placed=insertPoolAssets(pool,['img'],'pause',null,()=>`id${++n}`);
  assert.equal(placed.sections[0].breakMedia?.[0].slideId,placed.slides[0].id);
  assert.equal(placed.slides[0].sectionId,'pause');
  assert.throws(()=>insertPoolAssets(pool,['audio'],'pause',null,()=>''),/audio/i);
  assert.equal(pool.assets.length,2);
});
