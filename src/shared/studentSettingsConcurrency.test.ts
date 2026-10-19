import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {StudentSettingsRepository} from '../main/studentSettingsRepository';
import {StudentService} from '../main/studentService';
test('serialized audio and profile updates retain both and backup previous valid snapshot',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'student-queue-'));try{
 const file=path.join(dir,'settings.json'),repo=new StudentSettingsRepository(file),service=new StudentService(repo);
 await Promise.all([service.createProfile({name:'A',nickname:'Alpha',avatar:'star'}),repo.update(s=>({...s,audio:{...s.audio,volumes:{...s.audio.volumes,master:0.42}},customSetting:'preserved'}))]);
 const before=await repo.read();assert.equal(before.studentRoster.length,1);assert.equal(before.customSetting,'preserved');assert.equal(before.audio.volumes.master,0.42);
 await service.createProfile({name:'B'});
 assert.deepEqual(JSON.parse(await readFile(file+'.backup','utf8')),before);
 const [a,b]=(await service.getSnapshot()).studentRoster;
 await service.saveLegacy({version:1,studentRoster:[{id:a.id,name:'Renamed',createdAt:a.createdAt,updatedAt:a.updatedAt,archived:false}]});
 const after=await service.getSnapshot();assert.equal(after.studentRoster.length,2);assert.equal(after.studentRoster[0].nickname,'Alpha');assert.equal(after.studentRoster[0].avatar,'star');assert.equal(after.studentRoster[1].id,b.id);
 await assert.rejects(()=>service.updateProfile({id:a.id,avatar:'https://example.com/avatar.png'}));
 assert.equal((await service.getSnapshot()).studentRoster[0].avatar,'star');
 }finally{await rm(dir,{recursive:true,force:true});}
});
