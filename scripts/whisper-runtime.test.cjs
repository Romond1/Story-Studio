const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
const helperPath='../src/main/translation/whisper-runtime.cjs';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'whisper-runtime-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const entries=['whisper-cli.exe','ggml.dll'].map(name=>({path:`Release/${name}`,size:4,sha256:createHash('sha256').update('good').digest('hex')}));
 let installs=0;const install=async()=>{installs++;await fs.mkdir(path.join(root,'Release'),{recursive:true});for(const entry of entries)await fs.writeFile(path.join(root,entry.path),'good');};
 await install();installs=0;return {root,entries,install,count:()=>installs};
}
test('verified runtime skips archive access and extraction',async t=>{
 assert.equal(require('node:fs').existsSync(path.join(__dirname,helperPath)),true,'runtime verification helper exists');
 const {ensureRuntime}=require(helperPath),f=await fixture(t);await ensureRuntime(f.root,f.entries,f.install);assert.equal(f.count(),0);
});
for(const damage of ['modified','missing'])test(`${damage} runtime dependency repairs from verified archive`,async t=>{
 const {ensureRuntime}=require(helperPath),f=await fixture(t);const dll=path.join(f.root,'Release/ggml.dll');if(damage==='modified')await fs.writeFile(dll,'evil');else await fs.rm(dll);
 await ensureRuntime(f.root,f.entries,f.install);assert.equal(f.count(),1);assert.equal(await fs.readFile(dll,'utf8'),'good');
});
test('stream read error marks runtime invalid',async t=>{
 const {verifyRuntime}=require(helperPath),f=await fixture(t);const dir=path.join(f.root,'directory');await fs.mkdir(dir);const stat=await fs.stat(dir);
 assert.equal(await verifyRuntime(f.root,[{path:'directory',size:stat.size,sha256:'not-a-file'}]),false);
});
test('failed repair does not accept corrupt runtime',async t=>{
 const {ensureRuntime}=require(helperPath),f=await fixture(t);await fs.writeFile(path.join(f.root,'Release/ggml.dll'),'evil');await assert.rejects(ensureRuntime(f.root,f.entries,async()=>{}),/integrity/i);
});
test('stream failure after stat is treated as invalid runtime',async()=>{
 const vm=require('node:vm'),realFs=require('node:fs');const context={module:{exports:{}},require:name=>name==='node:fs'?{promises:{stat:async()=>({isFile:()=>true,size:4})},createReadStream:()=>({async *[Symbol.asyncIterator](){throw Error('read denied');}})}:require(name)};
 vm.runInNewContext(realFs.readFileSync(path.join(__dirname,helperPath),'utf8'),context);
 assert.equal(await context.module.exports.verifyRuntime('runtime',[{path:'Release/ggml.dll',size:4,sha256:'unused'}]),false);
});
test('speech preparation launches the exact manifest-verified executable and reports verification first',async()=>{
 const vm=require('node:vm'),realFs=require('node:fs'),events=[];let verified;
 const context={module:{exports:{}},process:{platform:'win32',arch:'x64'},require:name=>{
   if(name==='./cache.cjs')return {cached:async()=>{}};
   if(name==='./whisper-runtime.cjs')return {ensureRuntime:async(root,manifest)=>{events.push('verify');verified={root,manifest};}};
   if(name==='./whisper-runtime-manifests.json')return require('../src/main/translation/whisper-runtime-manifests.json');
   if(name==='extract-zip')return async()=>{throw Error('valid runtime must not extract');};
   return require(name);
 }};
 vm.runInNewContext(realFs.readFileSync(path.join(__dirname,'../src/main/translation/whisper.cjs'),'utf8'),context);
 const result=await context.module.exports.prepareSpeech('cache','base.en',message=>events.push(message),'cuda');
 assert.match(events[0],/Verifying.*CUDA/);assert.equal(events[1],'verify');
 assert.equal(result.exe,path.join(verified.root,'Release','whisper-cli.exe'));assert.ok(verified.manifest.some(entry=>entry.path==='Release/whisper-cli.exe'));
});
