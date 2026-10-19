import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ProgressionState, ProgressionCommand, ProgressionAuthority, ProgressionResult } from '../shared/progression/model';
import { applyProgressionCommand, createProgressionState, findProgressionReplay } from '../shared/progression/reducer';
import { parseProgressionState } from '../shared/progression/validation';

const MAX_STORE_BYTES=32*1024*1024;
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
/** One private file owns both effects and receipts; memory advances only after atomic replacement. */
export class ProgressionRepository {
 private state:ProgressionState|null=null;
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private file:string,private hooks:{beforeRename?:()=>void|Promise<void>}={}){}
 private serialize<T>(operation:()=>Promise<T>):Promise<T>{const result=this.queue.then(operation,operation);this.queue=result.then(()=>undefined,()=>undefined);return result;}
 private async load(){
  if(this.state)return this.state;
  let handle:Awaited<ReturnType<typeof fs.open>>;
  try{handle=await fs.open(this.file,'r');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){this.state=createProgressionState();return this.state;}throw error;}
  const chunks:Buffer[]=[];let bytes=0;
  try{if((await handle.stat()).size>MAX_STORE_BYTES)throw Error('Private progression store size limit exceeded.');while(true){const buffer=Buffer.alloc(Math.min(65536,MAX_STORE_BYTES+1-bytes)),result=await handle.read(buffer,0,buffer.length,null);if(!result.bytesRead)break;bytes+=result.bytesRead;if(bytes>MAX_STORE_BYTES)throw Error('Private progression store size limit exceeded.');chunks.push(buffer.subarray(0,result.bytesRead));}}finally{await handle.close();}
  this.state=parseProgressionState(JSON.parse(Buffer.concat(chunks).toString('utf8')));return this.state;
 }
 snapshot(){return this.serialize(async()=>copy(await this.load()));}
 private async backup(previous:ProgressionState){
  const temporary=path.join(path.dirname(this.file),`.progression-backup-${randomUUID()}.tmp`);
  try{const handle=await fs.open(temporary,'wx');try{await handle.writeFile(JSON.stringify(previous));await handle.sync();}finally{await handle.close();}await fs.rename(temporary,`${this.file}.backup`);}finally{await fs.unlink(temporary).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});}
 }
 transact(command:ProgressionCommand,authority:ProgressionAuthority|(()=>Promise<ProgressionAuthority>),authorizeNew?:(state:ProgressionState)=>void|Promise<void>):Promise<ProgressionResult>{return this.serialize(async()=>{
  const previous=await this.load(),replay=findProgressionReplay(previous,command);if(replay)return copy(replay);
  await authorizeNew?.(copy(previous));const currentAuthority=typeof authority==='function'?await authority():authority;
  const applied=applyProgressionCommand(previous,command,currentAuthority);if(!applied.result.accepted)return copy(applied.result);
  const next=parseProgressionState(applied.state),bytes=Buffer.from(JSON.stringify(next));if(bytes.length>MAX_STORE_BYTES)throw Error('Private progression store is full; no receipts were discarded.');
  await fs.mkdir(path.dirname(this.file),{recursive:true});const temporary=path.join(path.dirname(this.file),`.progression-${randomUUID()}.tmp`);
  try{const handle=await fs.open(temporary,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await this.hooks.beforeRename?.();await authorizeNew?.(copy(previous));await this.backup(previous);await authorizeNew?.(copy(previous));await fs.rename(temporary,this.file);this.state=next;}finally{await fs.unlink(temporary).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});}
  return copy(applied.result);
 });}
}
