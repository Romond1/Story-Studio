import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MediaRegistryService } from '../main/mediaRegistryService';
import { DerivedMediaService } from '../main/derivedMediaService';
const png = new Uint8Array(33);
png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
test('derived grants fence source digest and retire with manifest without changing original',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'derived-media-'));
 try {await fs.writeFile(path.join(root,'a.png'),'source bytes');const registry=new MediaRegistryService(),lease=registry.activate(root);
 registry.register({leaseId:lease.id,revision:1,expectedFolder:root,assets:[{id:'a',relativePath:'a.png',mediaType:'image'}] as any,legacyPaths:[]});
 const service=new DerivedMediaService(registry,()=>({width:1,height:1}));const request={leaseId:lease.id,revision:1,sourceAssetId:'a'};
 const source=await service.getSource(request);assert.match(source.digest,/^[a-f0-9]{64}$/);
 const granted=await service.publish({...request,sourceDigest:source.digest,key:'transform',png});assert.deepEqual(await service.read(granted.url),png);
 assert.equal(await fs.readFile(path.join(root,'a.png'),'utf8'),'source bytes');
 await fs.writeFile(path.join(root,'a.png'),'changed');await assert.rejects(service.publish({...request,sourceDigest:source.digest,key:'transform',png}),/changed/);
 registry.register({leaseId:lease.id,revision:2,expectedFolder:root,assets:[],legacyPaths:[]});assert.equal(await service.read(granted.url),null);
 await assert.rejects(service.getSource(request),/stale/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('derived PNG validation enforces signature, byte and decoded image limits',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'derived-limits-'));
 try{await fs.writeFile(path.join(root,'a.png'),'x');const registry=new MediaRegistryService(),lease=registry.activate(root);registry.register({leaseId:lease.id,revision:0,expectedFolder:root,assets:[{id:'a',relativePath:'a.png',mediaType:'image'}] as any,legacyPaths:[]});
 const service=new DerivedMediaService(registry,()=>({width:4097,height:1}));const request={leaseId:lease.id,revision:0,sourceAssetId:'a'},source=await service.getSource(request);
 await assert.rejects(service.publish({...request,sourceDigest:source.digest,key:'x',png:new Uint8Array([1])}),/PNG/);
 await assert.rejects(service.publish({...request,sourceDigest:source.digest,key:'x',png:new Uint8Array(8*1024*1024+1)}),/PNG/);
 await assert.rejects(service.publish({...request,sourceDigest:source.digest,key:'x',png}),/dimensions/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('derived cache reuses identical content and refuses growth beyond its total budget',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'derived-budget-'));
 try{await fs.writeFile(path.join(root,'a.png'),'x');const registry=new MediaRegistryService(),lease=registry.activate(root);registry.register({leaseId:lease.id,revision:0,expectedFolder:root,assets:[{id:'a',relativePath:'a.png',mediaType:'image'}] as any,legacyPaths:[]});const service=new DerivedMediaService(registry,()=>({width:1,height:1}));const request={leaseId:lease.id,revision:0,sourceAssetId:'a'},source=await service.getSource(request);const large=new Uint8Array(8*1024*1024);large.set(png);
 const first=await service.publish({...request,sourceDigest:source.digest,key:'0',png:large});assert.deepEqual(await service.publish({...request,sourceDigest:source.digest,key:'0',png:large}),first);
 for(let index=1;index<8;index++)await service.publish({...request,sourceDigest:source.digest,key:String(index),png:large});
 await assert.rejects(service.publish({...request,sourceDigest:source.digest,key:'overflow',png:large}),/cache is full/);
 registry.activate(root);assert.equal(await service.read(first.url),null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('derived generations reclaim superseded edits while retaining current presentation pixels',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'derived-generations-'));
 try{await fs.writeFile(path.join(root,'a.png'),'x');const registry=new MediaRegistryService(),lease=registry.activate(root);registry.register({leaseId:lease.id,revision:0,expectedFolder:root,assets:[{id:'a',relativePath:'a.png',mediaType:'image'}] as any,legacyPaths:[]});const service=new DerivedMediaService(registry,()=>({width:1,height:1}));const base={leaseId:lease.id,revision:0,sourceAssetId:'a'},source=await service.getSource(base);const large=new Uint8Array(8*1024*1024);large.set(png);let current:string|undefined,obsolete:string|undefined,priorGeneration:number|undefined;
 for(let index=0;index<12;index++){
  const {generation}=service.begin({...base,keepUrls:current?[current]:[]});
  if(priorGeneration!==undefined)await assert.rejects(service.publish({...base,generation:priorGeneration,sourceDigest:source.digest,key:'late',png}),/stale/);
  if(current)assert.ok(await service.read(current));if(obsolete)assert.equal(await service.read(obsolete),null);
  const next=await service.publish({...base,generation,sourceDigest:source.digest,key:String(index),png:large});
  if(current)assert.ok(await service.read(current));obsolete=current;current=next.url;priorGeneration=generation;
 }
 service.begin({...base,keepUrls:[]});assert.equal(await service.read(current!),null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
