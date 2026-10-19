import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeAudioSettings } from './audioSettings';
import { StudentSettingsRepository } from '../main/studentSettingsRepository';
import { StudentService } from '../main/studentService';
const date='2026-01-01T00:00:00.000Z';
const student=(id:string)=>({id,name:'Same display name',archived:false,createdAt:date,updatedAt:date});
const settings=()=>({version:1,studentRoster:[student('first'),student('second')],audio:normalizeAudioSettings(undefined),legacyMappings:[],futureSettings:{preserve:['unchanged',42]}});
test('profile read is nonmutating; duplicate names remain distinct through edits and archive',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'profile-safety-'));
 try{const file=path.join(root,'settings.json'),data=settings(),original=JSON.stringify(data,null,2);await fs.writeFile(file,original);const service=new StudentService(new StudentSettingsRepository(file));
 assert.deepEqual((await service.getSnapshot()).studentRoster.map(s=>s.id),['first','second']);assert.equal(await fs.readFile(file,'utf8'),original);
 await service.updateProfile({id:'first',nickname:'Hero One'});await service.setArchived({id:'first',archived:true});const archived=await service.getSnapshot();assert.equal(archived.studentRoster.length,2);assert.equal(archived.studentRoster.find(s=>s.id==='first')?.archived,true);assert.equal(archived.studentRoster.find(s=>s.id==='second')?.archived,false);
 await service.setArchived({id:'first',archived:false});assert.equal((await service.getSnapshot()).studentRoster.find(s=>s.id==='first')?.createdAt,date);const stored=JSON.parse(await fs.readFile(file,'utf8'));assert.deepEqual(stored.audio,data.audio);assert.deepEqual(stored.futureSettings,data.futureSettings);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('malformed and duplicate-ID settings fail closed without rewriting or replacing the source',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'profile-corrupt-'));
 try{const file=path.join(root,'settings.json');for(const original of ['{broken',JSON.stringify({...settings(),studentRoster:[student('same'),student('same')]})]){await fs.writeFile(file,original);const service=new StudentService(new StudentSettingsRepository(file));await assert.rejects(service.getSnapshot());await assert.rejects(service.createProfile({name:'New'}));assert.equal(await fs.readFile(file,'utf8'),original);}}
 finally{await fs.rm(root,{recursive:true,force:true});}
});
test('legacy mapping requires explicit source identity and cannot merge equal names or retarget a saved mapping',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'profile-mapping-'));
 try{const file=path.join(root,'settings.json');await fs.writeFile(file,JSON.stringify(settings()));const service=new StudentService(new StudentSettingsRepository(file));await service.mapLegacy({source:'fixture-project',sourceStudentId:'legacy-1',targetStudentId:'first'});await service.mapLegacy({source:'fixture-project',sourceStudentId:'legacy-2',targetStudentId:'second'});const before=await fs.readFile(file,'utf8');await assert.rejects(service.mapLegacy({source:'fixture-project',sourceStudentId:'legacy-1',targetStudentId:'second'}));assert.equal(await fs.readFile(file,'utf8'),before);assert.equal((await service.getSnapshot()).studentRoster.length,2);
 const imported=await service.importProfile({source:'another-project',sourceStudentId:'legacy-1',name:'Same display name'});assert.equal(imported.studentRoster.length,3);assert.equal(new Set(imported.studentRoster.map(s=>s.id)).size,3);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('oversized updates reject before replacing settings or its recovery backup',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'profile-size-'));
 try{const file=path.join(root,'settings.json'),original=JSON.stringify(settings());await fs.writeFile(file,original);const repository=new StudentSettingsRepository(file);await assert.rejects(repository.update(current=>({...current,oversized:'x'.repeat(16*1024*1024)})),/large|size|limit/i);assert.equal(await fs.readFile(file,'utf8'),original);await assert.rejects(fs.stat(`${file}.backup`),/ENOENT/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
