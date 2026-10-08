import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { importProjectMedia } from '../main/mediaImportService';
import { registerPoolImport, insertPoolAssets, mediaUsage } from './mediaPool';
import type { ProjectData } from './types';
const data:ProjectData={version:4,createdAt:'',updatedAt:'',assets:[],slides:[],sections:[{id:'one',name:'One'}]};
test('folder import preserves nested bins, UUID files, types and reports unsupported entries without lesson sections',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'story-pool-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const source=path.join(root,'Episode');await fs.mkdir(path.join(source,'Part'),{recursive:true});
  for(const name of ['same.PNG','Part/same.PNG','Part/scene.mp4','Part/music.mp3','notes.txt'])await fs.writeFile(path.join(source,name),'fixture');
  const result=await importProjectMedia(path.join(root,'project'),[source],'one');
  assert.equal(result.importedAssets.length,4);assert.equal(result.createdSlides.length,3);
  assert.equal(result.importedBins?.length,2);assert.equal(result.failures?.length,1);
  for(const asset of result.importedAssets){assert.match(asset.relativePath,/^assets\/[a-f0-9-]+\.(png|mp4|mp3)$/);assert.ok(asset.binId);await fs.access(path.join(root,'project',asset.relativePath));}
  const pool=registerPoolImport(data,result);assert.equal(pool.sections.length,1);assert.equal(pool.slides.length,0);
  const saved=JSON.parse(JSON.stringify(pool));assert.equal(saved.mediaBins.length,2);assert.equal(saved.assets.length,4);
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
