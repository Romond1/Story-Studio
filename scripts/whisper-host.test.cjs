const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const exe=path.resolve('native/whisper-host/bin/win32-x64/whisper-host.exe');
test('bundled executable matches manifest',()=>{
 const manifest=require('../native/whisper-host/manifest.json');
 const bytes=fs.readFileSync(exe);assert.equal(bytes.length,manifest.size);
 assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
});
test('native host is bundled and rejects missing arguments',{skip:process.platform!=='win32'||process.arch!=='x64'},async()=>{
 assert.ok(fs.existsSync(exe),'bundled whisper-host executable must exist');
 const p=spawn(exe,[],{windowsHide:true}); let out='';p.stdout.on('data',b=>out+=b);
 const code=await new Promise(r=>p.on('exit',r));
 assert.notEqual(code,0);assert.match(out,/"type":"error"/);
});
test('parent PID zero is rejected before loading model',{skip:process.platform!=='win32'||process.arch!=='x64'},async()=>{
 const p=spawn(exe,['--runtime-dir',path.resolve('.'),'--model',path.resolve('missing.bin'),'--backend','cpu','--parent-pid','0'],{windowsHide:true});
 let out='';p.stdout.on('data',b=>out+=b);assert.notEqual(await new Promise(r=>p.on('exit',r)),0);assert.match(out,/Required:/);
});
