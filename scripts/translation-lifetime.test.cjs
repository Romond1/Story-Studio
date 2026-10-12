const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {EventEmitter}=require('node:events');
function setup({pause=false,failGpu=false,failGpuInference=false,pauseWorker=false,pauseCancel=false,probe={device:'NVIDIA test'}}={}){
 const workers=[],sessions=[],states=[];
 class Worker extends EventEmitter{
  constructor(){super();workers.push(this);this.messages=[];this.dead=false;}
  postMessage(m){this.messages.push(m);if(!pauseWorker)queueMicrotask(()=>this.emit('message',{id:m.id,result:m.kind==='speech'?{exe:'cli',host:'host',modelPath:m.model,backend:m.backend}:m.kind==='prepare'?{loadMs:9}:m.kind==='format'?[{text:m.text}]:{text:'translated',loadMs:0,translationMs:1},metrics:{}}));}
  async terminate(){this.dead=true;}
 }
 class WhisperSession{
  constructor(onCrash){this.onCrash=onCrash;this.alive=false;this.stopped=false;this.pid=100+sessions.length;sessions.push(this);}
  async start(p){this.prepared=p;if(failGpu&&p.backend==='cuda')throw Error('CUDA allocation verification failed');this.alive=true;this.backend={backend:p.backend,...(p.backend==='cuda'?{device:'NVIDIA test'}:{})};this.metrics={modelLoadMs:10,speechPid:this.pid};return {backend:this.backend,metrics:this.metrics};}
  async transcribe(){this.calls=(this.calls||0)+1;if(failGpuInference&&this.backend.backend==='cuda'){this.crash();throw Error('CUDA inference failed');}if(pause)return new Promise((resolve,reject)=>{this.resolve=()=>resolve({text:'hello',metrics:{transcriptionMs:2,speechPid:this.pid}});this.reject=reject;});return {text:'hello',metrics:{transcriptionMs:2,speechPid:this.pid}};}
  async cancel(){if(pauseCancel)await new Promise(r=>{this.releaseCancel=r;});this.reject?.(Error('Cancelled'));}
  async stop(){this.stopped=true;this.alive=false;await this.cancel();}
  crash(){this.alive=false;this.onCrash(Error('Native engine exited'));}
 }
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/main/translation/service.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText;
 const context={exports:{},__dirname:__dirname,Buffer,performance,setTimeout,clearTimeout,require:n=>n==='node:worker_threads'?{Worker}:n==='./whisper-session.cjs'?{WhisperSession}:n==='./whisper.cjs'?{probeNvidia:async()=>probe}:n==='../../shared/translation'?{hasSpeech:a=>a.length>=4800}:require(n)};
 vm.runInNewContext(source,context);return {service:new context.exports.TranslationService('cache',()=>{},undefined,s=>states.push(s)),workers,sessions,states};
}
const settings={target:'ja',model:'base.en',execution:'gpu'},audio=Array(4800).fill(.1),request={...settings,audio};
test('enable prepares both models and repeated utterances retain recognition and translation',async()=>{
 const s=setup();await s.service.prepare(settings);assert.equal(s.service.getState().phase,'ready');assert.equal(s.sessions.length,1);assert.ok(s.workers[0].messages.some(m=>m.kind==='prepare'));
 await s.service.run(request);await s.service.run(request);assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].calls,2);assert.equal(s.workers.length,1);await s.service.cancelCurrent(true);assert.equal(s.service.getState().phase,'off');assert.equal(s.sessions[0].stopped,true);assert.equal(s.workers[0].dead,true);
});
test('target switching replaces only translator; model switching replaces only recognizer',async()=>{
 const s=setup();await s.service.prepare(settings);await s.service.prepare({...settings,target:'it'});assert.equal(s.sessions.length,1);assert.equal(s.workers.length,2);assert.equal(s.workers[0].dead,true);
 await s.service.prepare({...settings,target:'it',model:'small.en'});assert.equal(s.sessions.length,2);assert.equal(s.sessions[0].stopped,true);assert.equal(s.workers.length,2);await s.service.cancelCurrent(true);
});
test('idle cancellation retains engines and in-flight cancellation rejects stale output without reloading',async()=>{
 const s=setup({pause:true});await s.service.prepare(settings);await s.service.cancelCurrent(false);assert.equal(s.sessions[0].stopped,false);
 const pending=s.service.run(request),rejected=assert.rejects(pending,/Cancelled/);await new Promise(r=>setImmediate(r));await assert.rejects(s.service.run(request),/Finish|busy/i);await s.service.cancelCurrent(false);await rejected;assert.equal(s.sessions[0].stopped,false);assert.equal(s.service.getState().phase,'ready');await s.service.cancelCurrent(true);
});
test('Auto prepares independent CPU fallback while explicit GPU reports error',async()=>{
 const s=setup({failGpu:true});const result=await s.service.prepare({...settings,execution:'auto'});assert.equal(result.backend.backend,'cpu');assert.match(result.backend.reason,/CUDA/);assert.equal(s.sessions[0].stopped,true);await s.service.cancelCurrent(true);
 const forced=setup({failGpu:true});await assert.rejects(forced.service.prepare(settings),/GPU|CUDA/);assert.equal(forced.service.getState().phase,'error');await forced.service.cancelCurrent(true);
});
test('idle native crash invalidates Ready and retry creates fresh engine',async()=>{
 const s=setup();await s.service.prepare(settings);s.sessions[0].crash();assert.equal(s.service.getState().phase,'error');await s.service.prepare(settings);assert.equal(s.sessions.length,2);assert.equal(s.service.getState().phase,'ready');await s.service.cancelCurrent(true);
});
test('disabling during an utterance prevents stale translation and releases both models',async()=>{
 const s=setup({pause:true});await s.service.prepare(settings);const pending=s.service.run(request),rejected=assert.rejects(pending,/Cancelled/);await new Promise(r=>setImmediate(r));await s.service.cancelCurrent(true);await rejected;assert.equal(s.service.getState().phase,'off');assert.equal(s.sessions[0].stopped,true);assert.equal(s.workers[0].dead,true);assert.equal(s.workers[0].messages.filter(m=>m.kind==='translate').length,0);
});
test('invalid settings and invalid audio cannot start either engine',async()=>{
 const s=setup();await assert.rejects(s.service.prepare({...settings,execution:'magic'}),/Invalid/);await assert.rejects(s.service.run({...request,audio:[]}),/speech/);assert.equal(s.workers.length+s.sessions.length,0);
});
test('Auto without NVIDIA prepares CPU directly; explicit GPU is actionable',async()=>{
 const s=setup({probe:{reason:'NVIDIA unavailable'}});await s.service.prepare({...settings,execution:'auto'});assert.equal(s.sessions.length,1);assert.equal(s.sessions[0].backend.backend,'cpu');assert.match(s.service.getState().backend.reason,/NVIDIA/);await s.service.cancel();
 const f=setup({probe:{reason:'NVIDIA unavailable'}});await assert.rejects(f.service.prepare(settings),/Select CPU/);assert.equal(f.sessions.length,0);await f.service.cancel();
});
test('cancel while native files prepare never starts a native process',async()=>{
 const s=setup({pauseWorker:true});const p=s.service.prepare(settings),rejected=assert.rejects(p,/Cancelled/);await new Promise(r=>setImmediate(r));await s.service.cancel();await rejected;assert.equal(s.sessions.length,0);assert.equal(s.workers[0].dead,true);assert.equal(s.service.getState().phase,'off');
});
test('translator crash retains recognizer and preparation recovers only the worker',async()=>{
 const s=setup();await s.service.prepare(settings);s.workers[0].emit('error',Error('translator crashed'));assert.equal(s.service.getState().phase,'error');await s.service.prepare(settings);assert.equal(s.workers.length,2);assert.equal(s.sessions.length,1);assert.equal(s.service.getState().phase,'ready');await s.service.cancel();
});
test('engine diagnostics never retain or broadcast private audio',async()=>{
 const s=setup();await s.service.run(request);assert.equal(s.service.getState().settings.audio,undefined);assert.equal(JSON.stringify(s.states).includes('"audio"'),false);await s.service.cancel();
});
test('text translation reuses model and language change releases old worker',async()=>{
 const s=setup();await s.service.run({...settings,text:'hello'});await s.service.run({...settings,text:'next'});assert.equal(s.workers.length,1);assert.equal(s.sessions.length,0);await s.service.run({...settings,target:'ro',text:'hello'});assert.equal(s.workers[0].dead,true);assert.equal(s.workers.length,2);await s.service.cancel();
});
test('new preparation waits for previous native cancellation acknowledgement',async()=>{
 const s=setup({pauseCancel:true});await s.service.prepare(settings);const cancelling=s.service.cancelCurrent(false);let prepared=false;const next=s.service.prepare(settings).then(()=>prepared=true);await new Promise(r=>setImmediate(r));assert.equal(prepared,false);s.sessions[0].releaseCancel();await cancelling;await next;s.sessions[0].cancel=async()=>{};await s.service.cancel();
});
test('Auto inference failure replaces CUDA with resident CPU and updates diagnostics',async()=>{
 const s=setup({failGpuInference:true});const result=await s.service.run({...request,execution:'auto'});assert.equal(result.speechBackend.backend,'cpu');assert.match(result.speechBackend.reason,/CUDA inference/);assert.equal(s.sessions[0].stopped,true);assert.equal(s.sessions.length,2);assert.equal(s.workers.length,1);assert.equal(s.service.getState().metrics.speechPid,s.sessions[1].pid);await s.service.cancel();
});
