import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MediaRegistryService } from '../main/mediaRegistryService';

test('scoped grants require current manifest, reject stale revisions and retire on activation', async () => {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-lease-'));
 try {
 await fs.mkdir(path.join(root,'assets')); await fs.writeFile(path.join(root,'assets/a.png'),'a');
 const service=new MediaRegistryService(); const lease=service.activate(root);
 const asset={id:'a',relativePath:'assets/a.png',mediaType:'image'} as any;
 assert.equal(service.register({leaseId:lease.id,expectedFolder:root,revision:1,assets:[asset],legacyPaths:[]}).ok,true);
 const result=await service.resolve({leaseId:lease.id,revision:1,assetId:'a'});
 assert.equal(result.ok,true); if(!result.ok) return;
 assert.equal(await service.resolveUrl(result.url),path.join(root,'assets/a.png'));
 assert.equal(service.register({leaseId:lease.id,expectedFolder:root,revision:1,assets:[],legacyPaths:[]}).ok,false);
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:1,assetId:'other'}),{ok:false,code:'unregistered'});
 service.activate(root); assert.equal(await service.resolveUrl(result.url),null);
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:1,assetId:'a'}),{ok:false,code:'stale-project'});
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
test('manifest refuses duplicates and unsafe paths, allows explicit legacy files only',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-lease-'));
 try {await fs.writeFile(path.join(root,'old.png'),'x'); const service=new MediaRegistryService();const lease=service.activate(root);
 const registration=service.register({leaseId:lease.id,expectedFolder:root,revision:0,assets:[{id:'dup',relativePath:'old.png',mediaType:'image'},{id:'dup',relativePath:'old.png',mediaType:'image'},{id:'escape',relativePath:'../outside.png',mediaType:'image'}] as any,legacyPaths:['old.png']});
 assert.equal(registration.diagnostics.some(d=>d.code==='ambiguous'),true);
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:0,assetId:'dup'}),{ok:false,code:'ambiguous'});
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:0,assetId:'escape'}),{ok:false,code:'unsafe-path'});
 assert.equal((await service.resolve({leaseId:lease.id,revision:0,legacyPath:'old.png'})).ok,true);
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:0,legacyPath:'other.png'}),{ok:false,code:'unregistered'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('legacy compatibility rejects traversal before URL normalization can erase it', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-legacy-traversal-'));
 try {
  await fs.writeFile(path.join(root, 'secret.png'), 'inside-root-but-not-requested');
  const service = new MediaRegistryService(); service.activate(root);
  assert.equal(await service.resolveLegacyUrl('media:///assets/../secret.png'), null);
  assert.equal(await service.resolveLegacyUrl('media:///assets/%2e%2e/secret.png'), null);
 } finally { await fs.rm(root, {recursive:true,force:true}); }
});
test('realpath containment rejects junction escape and rechecks grants after filesystem change',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-realpath-'));
 try {
 const project=path.join(root,'project'),outside=path.join(root,'outside');await fs.mkdir(project);await fs.mkdir(outside);await fs.writeFile(path.join(outside,'a.png'),'outside');
 await fs.symlink(outside,path.join(project,'escape'),'junction');
 const service=new MediaRegistryService(),lease=service.activate(project);
 service.register({leaseId:lease.id,expectedFolder:project,revision:0,assets:[{id:'a',relativePath:'escape/a.png',mediaType:'image'},{id:'missing',relativePath:'missing.png',mediaType:'audio'}] as any,legacyPaths:[]});
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:0,assetId:'a'}),{ok:false,code:'unsafe-path'});
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:0,assetId:'missing'}),{ok:false,code:'missing'});
 assert.deepEqual(await service.resolve({leaseId:lease.id,revision:0,assetId:'missing',expectedType:'video'}),{ok:false,code:'wrong-type'});
 await fs.mkdir(path.join(project,'assets'));await fs.writeFile(path.join(project,'assets/a.png'),'inside');
 service.register({leaseId:lease.id,expectedFolder:project,revision:1,assets:[{id:'a',relativePath:'assets/a.png',mediaType:'image'}] as any,legacyPaths:[]});
 const granted=await service.resolve({leaseId:lease.id,revision:1,assetId:'a'});assert.equal(granted.ok,true);
 await fs.rename(path.join(project,'assets'),path.join(project,'old-assets'));await fs.symlink(outside,path.join(project,'assets'),'junction');
 if(granted.ok)assert.equal(await service.resolveUrl(granted.url),null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('resolution in flight cannot issue grants for a retired manifest',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-race-'));
 try{await fs.writeFile(path.join(root,'a.png'),'x');const service=new MediaRegistryService(),lease=service.activate(root);
 service.register({leaseId:lease.id,expectedFolder:root,revision:0,assets:[{id:'a',relativePath:'a.png',mediaType:'image'}] as any,legacyPaths:[]});
 const pending=service.resolve({leaseId:lease.id,revision:0,assetId:'a'});
 service.register({leaseId:lease.id,expectedFolder:root,revision:1,assets:[],legacyPaths:[]});
 assert.deepEqual(await pending,{ok:false,code:'stale-project'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('lease reports manifest revision for renderer reload and rejects Windows path aliases',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-reload-'));
 try {const service=new MediaRegistryService(),lease=service.activate(root);
 service.register({leaseId:lease.id,expectedFolder:root,revision:75,assets:[{id:'dot',relativePath:'assets./a.png',mediaType:'image'},{id:'space',relativePath:'assets /a.png',mediaType:'image'}] as any,legacyPaths:[]});
 assert.equal(service.getLease(root)?.revision,75);
 for(const assetId of ['dot','space'])assert.deepEqual(await service.resolve({leaseId:lease.id,revision:75,assetId}),{ok:false,code:'unsafe-path'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('legacy URL compatibility checks realpath and retains both URL spellings and queries',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'media-legacy-'));
 try {const project=path.join(root,'project'),outside=path.join(root,'outside');await fs.mkdir(project);await fs.mkdir(outside);await fs.mkdir(path.join(project,'assets'));await fs.writeFile(path.join(project,'assets','a b.png'),'safe');await fs.writeFile(path.join(outside,'secret.png'),'private');await fs.symlink(outside,path.join(project,'assets','escape'),'junction');const service=new MediaRegistryService();service.activate(project);
 for(const url of ['media://assets/a%20b.png?render=1','media:///assets/a%20b.png'])assert.equal(await service.resolveLegacyUrl(url),path.join(project,'assets','a b.png'));
 assert.equal(await service.resolveLegacyUrl('media://assets/escape/secret.png'),null);
 assert.equal(await service.resolveLegacyUrl('media://assets/%2e%2e%2foutside/secret.png'),null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
