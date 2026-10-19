import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProgressionRepository } from '../main/progressionRepository';
const roster=[{id:'student',name:'Student',archived:false,createdAt:'now',updatedAt:'now'}];
const definition={id:'adventure',version:'1',name:'Adventure',description:'',rewards:[{id:'coin',name:'Coin',kind:'currency' as const}],relics:[]};
const adjustment=(commandId:string,delta=1)=>({type:'adjust-reward' as const,commandId,studentId:'student',adventureDefinition:definition,rewardId:'coin',delta,reason:'Teacher adjustment'});
test('atomic progression receipts survive restart and concurrent replay grants once',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-repository-'));
 try{const file=path.join(root,'progression.json'),repository=new ProgressionRepository(file);const results=await Promise.all([repository.transact(adjustment('grant'),{roster}),repository.transact(adjustment('grant'),{roster})]);assert.equal(results.filter(r=>r.duplicate).length,1);
 const before=await fs.readFile(file,'utf8'),restarted=new ProgressionRepository(file);assert.equal((await restarted.transact(adjustment('grant'),{roster:[]})).duplicate,true);assert.equal(await fs.readFile(file,'utf8'),before);assert.equal((await restarted.transact(adjustment('grant',2),{roster})).accepted,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('failed publication changes neither memory nor disk and retry remains possible',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-failure-'));
 try{const file=path.join(root,'progression.json');let fail=true;const repository=new ProgressionRepository(file,{beforeRename:()=>{if(fail)throw Error('injected write failure');}});await assert.rejects(repository.transact(adjustment('grant'),{roster}),/injected/);assert.equal((await repository.snapshot()).revision,0);await assert.rejects(fs.stat(file),/ENOENT/);fail=false;assert.equal((await repository.transact(adjustment('grant'),{roster})).accepted,true);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('corrupt private stores are rejected without reset or overwrite',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-corrupt-'));
 try{const file=path.join(root,'progression.json');await fs.writeFile(file,'{"version":999}');const repository=new ProgressionRepository(file);await assert.rejects(repository.snapshot());await assert.rejects(repository.transact(adjustment('grant'),{roster}));assert.equal(await fs.readFile(file,'utf8'),'{"version":999}');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('scope expiring during staging prevents durable publication',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-expired-'));
 try{let current=true;const file=path.join(root,'store.json'),repository=new ProgressionRepository(file,{beforeRename:()=>{current=false;}});await assert.rejects(repository.transact(adjustment('grant'),{roster},()=>{if(!current)throw Error('scope expired');}),/scope expired/);assert.equal((await repository.snapshot()).revision,0);await assert.rejects(fs.stat(file),/ENOENT/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('recovery backup retains the previous complete valid snapshot without silently recovering corrupt primary',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'progression-backup-'));
 try{const file=path.join(root,'store.json'),repository=new ProgressionRepository(file);await repository.transact(adjustment('first'),{roster});const previous=await fs.readFile(file,'utf8');await repository.transact(adjustment('second'),{roster});assert.equal(await fs.readFile(`${file}.backup`,'utf8'),previous);await fs.writeFile(file,'corrupt');await assert.rejects(new ProgressionRepository(file).snapshot());assert.equal(await fs.readFile(`${file}.backup`,'utf8'),previous);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
