import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {StudentSettingsRepository} from '../main/studentSettingsRepository';
import {StudentService} from '../main/studentService';
async function fixture(fn:(file:string,repo:StudentSettingsRepository,s:StudentService)=>Promise<void>){const dir=await mkdtemp(path.join(tmpdir(),'classes-'));try{const file=path.join(dir,'settings.json'),repo=new StudentSettingsRepository(file);await fn(file,repo,new StudentService(repo));}finally{await rm(dir,{recursive:true,force:true});}}
test('classes preserve distinct identity, multiple enrollment and archived membership across restart',async()=>fixture(async(file,repo,s)=>{
 const a=(await s.createProfile({name:'Same'})).studentRoster[0];const b=(await s.createProfile({name:'Same'})).studentRoster[1];
 const c=(await s.createClass({name:'Same'})).classes[0];const d=(await s.createClass({name:'Same'})).classes[1];assert.notEqual(c.id,d.id);
 await s.updateClass({id:c.id,studentIds:[a.id,b.id]});await s.updateClass({id:d.id,studentIds:[a.id]});await s.selectClass({id:c.id});await s.setArchived({id:a.id,archived:true});
 const restored=await new StudentService(new StudentSettingsRepository(file)).getSnapshot();assert.deepEqual(restored.classes[0].studentIds,[a.id,b.id]);assert.equal(restored.activeClassId,c.id);
 await s.setClassArchived({id:c.id,archived:true});assert.equal((await s.getSnapshot()).activeClassId,null);await assert.rejects(()=>s.selectClass({id:c.id}));await s.setClassArchived({id:c.id,archived:false});await s.selectClass({id:c.id});assert.equal((await repo.read()).classes[0].createdAt,c.createdAt);
}));
test('invalid membership and persisted class references fail closed',async()=>fixture(async(file,repo,s)=>{
 const p=(await s.createProfile({name:'A'})).studentRoster[0];const c=(await s.createClass({name:'A'})).classes[0];const before=await readFile(file,'utf8');
 await assert.rejects(()=>s.updateClass({id:c.id,studentIds:[p.id,p.id]}));await assert.rejects(()=>s.updateClass({id:c.id,studentIds:['unknown']}));assert.equal(await readFile(file,'utf8'),before);
 const invalid=JSON.parse(before);invalid.classes[0].studentIds=['unknown'];await writeFile(file,JSON.stringify(invalid));await assert.rejects(()=>repo.read());await assert.rejects(()=>s.createProfile({name:'B'}));assert.deepEqual(JSON.parse(await readFile(file,'utf8')),invalid);
}));
test('older settings default classes without rewriting and concurrent updates retain all domains',async()=>fixture(async(file,repo,s)=>{
 await s.createProfile({name:'A'});const old=JSON.parse(await readFile(file,'utf8'));delete old.classes;delete old.activeClassId;const raw=JSON.stringify(old);await writeFile(file,raw);
 assert.deepEqual((await s.getSnapshot()).classes,[]);assert.equal((await s.getSnapshot()).activeClassId,null);assert.equal(await readFile(file,'utf8'),raw);
 await Promise.all([s.createClass({name:'C'}),s.createProfile({name:'B'}),repo.update(v=>({...v,audio:{...v.audio,volumes:{...v.audio.volumes,master:0.37}}}))]);const current=await repo.read();assert.equal(current.classes.length,1);assert.equal(current.studentRoster.length,2);assert.equal(current.audio.volumes.master,0.37);
}));
