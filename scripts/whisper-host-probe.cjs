// Developer-only real-runtime lifecycle and timing probe. No production imports.
const {spawn}=require('node:child_process');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const backend=process.argv[2]||'cpu';const model=process.argv[3]||'base.en';
const hashes={'base.en':'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002','small.en':'c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d'};
const exe=path.resolve('native/whisper-host/bin/win32-x64/whisper-host.exe');
function frame(kind,id,pcm=Buffer.alloc(0)){const h=Buffer.alloc(12);h.writeUInt32LE(kind);h.writeUInt32LE(id,4);h.writeUInt32LE(pcm.length/4,8);return Buffer.concat([h,pcm]);}
function wav(file){const b=fs.readFileSync(file);let fmt,data;for(let p=12;p+8<=b.length;){const n=b.readUInt32LE(p+4),tag=b.toString('ascii',p,p+4);if(tag==='fmt ')fmt=b.subarray(p+8,p+8+n);if(tag==='data')data=b.subarray(p+8,p+8+n);p+=8+n+(n%2);}assert.equal(fmt.readUInt16LE(2),1);assert.equal(fmt.readUInt32LE(4),16000);assert.equal(fmt.readUInt16LE(14),16);const f=Buffer.alloc(data.length*2);for(let i=0;i<data.length/2;i++)f.writeFloatLE(data.readInt16LE(i*2)/32768,i*4);return f;}
async function main(){
 assert.ok(fs.existsSync(exe),'bundled host exists');
 const owner=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
 const p=spawn(exe,['--runtime-dir',path.resolve(`.translation-cache/whisper-1.8.2${backend==='cuda'?'-cuda':''}/Release`),'--model',path.resolve('.translation-cache',hashes[model]),'--backend',backend,'--parent-pid',String(owner.pid)],{windowsHide:true});
 let text='',log='',events=[],waiters=[];p.stderr.on('data',b=>log+=b);p.stdout.on('data',b=>{text+=b;let i;while((i=text.indexOf('\n'))>=0){const event=JSON.parse(text.slice(0,i));text=text.slice(i+1);events.push(event);for(const w of waiters.splice(0))w();}});
 const wait=async pred=>{const end=Date.now()+180000;while(!events.some(pred)){if(Date.now()>end)throw Error('host timeout '+log.slice(-2000));await Promise.race([new Promise(r=>waiters.push(r)),new Promise(r=>setTimeout(r,100))]);}return events.find(pred);};
 try{
 const ready=await wait(e=>e.type==='ready');assert.equal(ready.pid,p.pid);console.log(JSON.stringify(ready));
 const pcm=wav('docs/phase3.1-evidence/live-0.wav');
 for(let id=1;id<=2;id++){p.stdin.write(frame(1,id,pcm));const e=await wait(e=>e.id===id);assert.equal(e.type,'result');assert.ok(e.text.trim());console.log(JSON.stringify(e));}
 p.stdin.write(frame(1,3,Buffer.alloc(320000*4)));p.stdin.write(frame(2,3));assert.equal((await wait(e=>e.id===3)).type,'cancelled');
 p.stdin.write(frame(1,4,pcm));assert.equal((await wait(e=>e.id===4)).type,'result');
 // Owner death must terminate the resident host even with an open stdin handle.
 p.stdin.write(frame(1,5,Buffer.alloc(320000*4)));await new Promise(r=>setTimeout(r,100));
 const exited=new Promise(r=>p.once('exit',r));owner.kill();await Promise.race([exited,new Promise((_,j)=>setTimeout(()=>j(Error('orphan host')),5000))]);
 console.log(JSON.stringify({type:'probe-passed',pid:p.pid,backend,model,cudaVerified:require('../src/main/translation/whisper.cjs').verifyCudaLog&&backend==='cuda'?require('../src/main/translation/whisper.cjs').verifyCudaLog(log):null}));
 }finally{owner.kill();p.kill();}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={frame,wav};
