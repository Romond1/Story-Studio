import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { convertSceneToEpisode } from '../main/episodeConversion';
import { createLesson } from './lesson/commands';
const writeAtomic=async(folder:string,data:unknown)=>{await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(data),{flag:'wx'});return 'saved';};
test('conversion preserves source and backup hashes, publishes episode only to empty target',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'episode-convert-'));
 try{const source=path.join(root,'source'),target=path.join(root,'target'),backupRoot=path.join(root,'private');await fs.mkdir(source);await fs.mkdir(target);const data=createLesson('Original');const original=JSON.stringify(data,null,2);await fs.writeFile(path.join(source,'project.json'),original);await fs.mkdir(path.join(source,'assets'));await fs.writeFile(path.join(source,'assets','unused.png'),'preserve unused');
 const result=await convertSceneToEpisode({source,target,backupRoot,data,adventure:{id:'adventure',version:'1'},writeAtomic});
 assert.equal(result.data.format,'story-studio-episode');assert.equal(result.data.id,data.id);assert.equal(await fs.readFile(path.join(source,'project.json'),'utf8'),original);assert.equal(await fs.readFile(path.join(result.backupPath,'source','project.json'),'utf8'),original);
 assert.equal(await fs.readFile(path.join(target,'assets','unused.png'),'utf8'),'preserve unused');assert.match(await fs.readFile(result.migrationReport,'utf8'),/sha256/);
 await assert.rejects(convertSceneToEpisode({source,target,backupRoot,data,adventure:{id:'adventure',version:'1'},writeAtomic}),/empty/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('conversion failure never changes source or publishes a fallback episode',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'episode-fail-'));
 try{const source=path.join(root,'source'),target=path.join(root,'target');await fs.mkdir(source);await fs.mkdir(target);const data=createLesson();const original=JSON.stringify(data);await fs.writeFile(path.join(source,'project.json'),original);
 await assert.rejects(convertSceneToEpisode({source,target,backupRoot:path.join(root,'private'),data,adventure:{id:'adventure',version:'1'},writeAtomic:async()=>{throw Error('injected publication failure');}}),/injected/);
 assert.equal(await fs.readFile(path.join(source,'project.json'),'utf8'),original);await assert.rejects(fs.stat(path.join(target,'project.json')),/ENOENT/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
function ipcHarness(privateRoot:string){
 const handlers=new Map<string,(...args:any[])=>any>(),control={mainFrame:{}};let selection:string|null=null;
 const electron={app:{requestSingleInstanceLock:()=>true,whenReady:()=>({then(){}}),on(){},getPath:()=>privateRoot},BrowserWindow:function(){},dialog:{showOpenDialog:async()=>({canceled:!selection,filePaths:selection?[selection]:[]})},ipcMain:{handle:(name:string,fn:(...args:any[])=>any)=>handlers.set(name,fn),on:(name:string,fn:(...args:any[])=>any)=>handlers.set(name,(_,...args)=>{const event={returnValue:undefined};fn(event,...args);return event.returnValue;})},protocol:{registerSchemesAsPrivileged(){}}};
 const cache=new Map<string,any>();
 const load=(filename:string):any=>{if(cache.has(filename))return cache.get(filename);const module={exports:{}};cache.set(filename,module.exports);const nativeRequire=createRequire(filename);let source=readFileSync(filename,'utf8');if(filename.endsWith(`${path.sep}main.ts`))source+='\nmainWindow={webContents:__control} as unknown as BrowserWindow;';const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{module,exports:module.exports,__dirname:path.dirname(filename),console,process,Buffer,crypto:globalThis.crypto,__control:control,require:(id:string)=>id==='electron'?electron:id.startsWith('.')?load(path.resolve(path.dirname(filename),`${id}.ts`)):nativeRequire(id)},{filename});return module.exports;};
 load(path.resolve('src/main/main.ts'));
 return {call:(name:string,...args:any[])=>handlers.get(name)!({sender:control,senderFrame:control.mainFrame},...args),untrusted:(name:string,...args:any[])=>handlers.get(name)!({sender:{},senderFrame:{}},...args),select:(folder:string|null)=>{selection=folder;}};
}
test('real IPC converts explicitly, saves/reopens episode and refuses cross-format overwrite',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'episode-ipc-'));
 try{const source=path.join(root,'source'),target=path.join(root,'target');await fs.mkdir(source);await fs.mkdir(target);const data=createLesson('Convert');const original=JSON.stringify(data);await fs.writeFile(path.join(source,'project.json'),original);const api=ipcHarness(path.join(root,'private'));
 const initial=await api.call('lesson:open-path',source);assert.equal(await api.call('lesson:activate',initial.activationToken),null);
 api.select(null);assert.equal(await api.call('lesson:convert',data,{id:'adventure',version:'1'},source),null);
 api.select(target);const result=await api.call('lesson:convert',data,{id:'adventure',version:'1'},source);assert.equal(result.data.format,'story-studio-episode');
 // Conversion is prepared, never activated implicitly.
 await api.call('lesson:save',data,'save',source);
 assert.equal(await api.call('lesson:activate',result.activationToken),null);
 await api.call('lesson:save',{...result.data,title:'Episode edit'},'save',target);
 const reopened=await api.call('lesson:open-path',target);assert.equal(reopened.data.title,'Episode edit');assert.equal(reopened.data.format,'story-studio-episode');
 await assert.rejects(api.call('lesson:save',data,'save',target),/format/);
 assert.equal(JSON.parse(await fs.readFile(path.join(source,'project.json'),'utf8')).format,'story-studio-scene');
 assert.equal(await fs.readFile(path.join(result.backupPath,'source','project.json'),'utf8'),original);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('episode conversion, package, progression and derived IPC require the Control main frame',()=>{const api=ipcHarness('unused');for(const channel of ['lesson:convert','lesson:export-package','lesson:import-package','derived-media:source','derived-media:publish',...['getSnapshot','registerRun','recordEvent','lifecycle','completeActivation','decideReward','requestReward','adjustReward','advanceRelic','completeEpisode','getRunInventory'].map(method=>`progression:${method}`)])assert.throws(()=>api.untrusted(channel,{}),/Control window required/);});

test('ordinary scene and legacy Open reject immutable package folders',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'package-open-'));try{await fs.writeFile(path.join(root,'project.json'),JSON.stringify(createLesson()));await fs.writeFile(path.join(root,'manifest.json'),'malformed still immutable');const api=ipcHarness(path.join(root,'private'));for(const channel of ['lesson:open-path','project:open-path'])await assert.rejects(api.call(channel,root),/Import portable episode/);}finally{await fs.rm(root,{recursive:true,force:true});}});

test('Mastery preparation upgrades the active lesson in place without a picker and preserves its media', async () => {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'episode-inline-'));
 try {
  const source=path.join(root,'source');await fs.mkdir(source);await fs.mkdir(path.join(source,'assets'));
  const data=createLesson('Same folder');const original=JSON.stringify(data);await fs.writeFile(path.join(source,'project.json'),original);await fs.writeFile(path.join(source,'assets','keep.txt'),'unchanged');
  const api=ipcHarness(path.join(root,'private'));const initial=await api.call('lesson:open-path',source);await api.call('lesson:activate',initial.activationToken);
  const result=await api.call('lesson:prepare-games',{...data,title:'Unsaved title'},source);
  assert.equal(result.folderPath,source);assert.equal(result.data.format,'story-studio-episode');assert.equal(result.data.title,'Unsaved title');assert.equal(result.data.id,data.id);
  assert.equal(await fs.readFile(path.join(source,'assets','keep.txt'),'utf8'),'unchanged');
  const backups=await fs.readdir(path.join(root,'private','migration-backups'));
  assert.equal(backups.length,1);assert.equal(await fs.readFile(path.join(root,'private','migration-backups',backups[0],'project.json'),'utf8'),original);
  await api.call('lesson:activate',result.activationToken);await api.call('lesson:save',result.data,'save',source);
  assert.equal((await api.call('lesson:open-path',source)).data.format,'story-studio-episode');
  assert.throws(()=>api.untrusted('lesson:prepare-games',data,source),/Control window/);
 } finally {await fs.rm(root,{recursive:true,force:true});}
});

