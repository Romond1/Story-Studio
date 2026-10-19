import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeAudioSettings} from '../shared/audioSettings';
import type {StoryStudioSettings} from '../shared/types';
import type {LegacyStudentMapping,StudentClass} from '../shared/students/model';
import {STUDENT_AVATARS} from '../shared/students/model';
export type StoredStudentSettings = StoryStudioSettings & {legacyMappings:LegacyStudentMapping[];classes:StudentClass[];activeClassId:string|null;[key:string]:unknown};
export function validText(v:unknown,max=200):v is string {return typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);}
export function validateSettings(value:unknown):StoredStudentSettings {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid settings');
 const s=value as StoredStudentSettings;
 if(s.version!==1||!Array.isArray(s.studentRoster)||s.studentRoster.length>10000)throw Error('Invalid settings roster');
 const ids=new Set<string>();
 for(const p of s.studentRoster){
 if(!p||!validText(p.id)||ids.has(p.id)||!validText(p.name)||typeof p.archived!=='boolean'||!validText(p.createdAt)||!validText(p.updatedAt)||!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.updatedAt)))throw Error('Invalid or duplicate student identity');
 if(p.nickname!==undefined&&(typeof p.nickname!=='string'||p.nickname.length>200))throw Error('Invalid nickname');
 if(p.avatar!==undefined&&!(STUDENT_AVATARS as readonly unknown[]).includes(p.avatar))throw Error('Invalid avatar');
 ids.add(p.id);
 }
 const mappings=s.legacyMappings??[];if(!Array.isArray(mappings)||mappings.length>20000)throw Error('Invalid legacy mappings');
 const keys=new Set<string>();for(const m of mappings){const k=JSON.stringify([m?.source,m?.sourceStudentId]);if(!m||!validText(m.source)||!validText(m.sourceStudentId)||!ids.has(m.targetStudentId)||!validText(m.createdAt)||!Number.isFinite(Date.parse(m.createdAt))||keys.has(k))throw Error('Invalid legacy mapping');keys.add(k);}
 const classes=s.classes===undefined?[]:s.classes;
 if(!Array.isArray(classes)||classes.length>10000)throw Error('Invalid classes');
 const classIds=new Set<string>();
 for(const c of classes){
 if(!c||!validText(c.id)||classIds.has(c.id)||!validText(c.name)||typeof c.archived!=='boolean'||!validText(c.createdAt)||!validText(c.updatedAt)||!Number.isFinite(Date.parse(c.createdAt))||!Number.isFinite(Date.parse(c.updatedAt))||!Array.isArray(c.studentIds)||c.studentIds.length>10000||new Set(c.studentIds).size!==c.studentIds.length||c.studentIds.some(id=>!ids.has(id)))throw Error('Invalid class identity or membership');
 classIds.add(c.id);
 }
 const activeClassId=s.activeClassId===undefined?null:s.activeClassId;
 if(activeClassId!==null&&(typeof activeClassId!=='string'||!classes.some(c=>c.id===activeClassId&&!c.archived)))throw Error('Invalid active class');
 return {...s,classes,activeClassId,audio:normalizeAudioSettings(s.audio),legacyMappings:mappings};
}
export class StudentSettingsRepository {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(private file:string){}
 private async load():Promise<StoredStudentSettings>{
 try{const h=await fs.open(this.file,'r');try{const chunks:Buffer[]=[];let total=0;for(;;){const chunk=Buffer.alloc(Math.min(65536,16*1024*1024+1-total));const {bytesRead}=await h.read(chunk,0,chunk.length,null);if(!bytesRead)break;chunks.push(chunk.subarray(0,bytesRead));total+=bytesRead;if(total>16*1024*1024)throw Error('Settings too large');}return validateSettings(JSON.parse(Buffer.concat(chunks).toString('utf8')));}finally{await h.close();}}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,studentRoster:[],audio:normalizeAudioSettings(undefined),legacyMappings:[],classes:[],activeClassId:null};throw e;}
 }
 async read():Promise<StoredStudentSettings>{await this.tail;return this.load();}
 update(mutate:(current:StoredStudentSettings)=>StoredStudentSettings|Promise<StoredStudentSettings>):Promise<StoredStudentSettings>{
 const next=this.tail.then(async()=>{
 const current=await this.load();const result=validateSettings(await mutate(structuredClone(current)));
 const serialized=JSON.stringify(result,null,2);if(Buffer.byteLength(serialized,'utf8')>16*1024*1024)throw Error('Settings too large');
 await fs.mkdir(path.dirname(this.file),{recursive:true});
 const write=async(target:string,data:string)=>{const tmp=target+'.'+randomUUID()+'.tmp';try{const h=await fs.open(tmp,'wx');try{await h.writeFile(data,'utf8');await h.sync();}finally{await h.close();}await fs.rename(tmp,target);}finally{await fs.rm(tmp,{force:true});}};
 try{await fs.access(this.file);await write(this.file+'.backup',JSON.stringify(current,null,2));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await write(this.file,serialized);return structuredClone(result);
 });this.tail=next.catch(()=>undefined);return next;
 }
}
