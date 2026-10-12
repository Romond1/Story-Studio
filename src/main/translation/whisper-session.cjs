const {spawn}=require('node:child_process');
const path=require('node:path');
const {StringDecoder}=require('node:string_decoder');
const {verifyCudaLog,cudaDeviceFromLog}=require('./whisper.cjs');
const MAX_LOG=1024*1024;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function frame(kind,id,audio){const count=audio?.length||0,b=Buffer.allocUnsafe(12+count*4);b.writeUInt32LE(kind);b.writeUInt32LE(id,4);b.writeUInt32LE(count,8);for(let i=0;i<count;i++){if(!Number.isFinite(audio[i]))throw Error('PCM samples must be finite numbers');b.writeFloatLE(Math.max(-1,Math.min(1,audio[i])),12+i*4);}return b;}
class WhisperSession{
 constructor(onCrash=()=>{},options={}){this.onCrash=onCrash;this.spawn=options.spawn||spawn;this.timeouts={start:options.startMs??120000,request:options.requestMs??120000,cancel:options.cancelMs??3000,stopGrace:options.stopGraceMs??1500,closeDeadline:options.closeDeadlineMs??5000};this.alive=false;this.backend=null;this.metrics={};this.nextId=0;this.pending=null;this.child=null;}
 async start(prepared){
  if(this.child)throw Error('Whisper session already started');
  this.expectedClose=false;this.crashReported=false;this.readyDone=false;this.readyEvent=null;this.stopPromise=null;this.stderr='';this.stdout='';this.ready=deferred();this.closed=deferred();this.prepared=prepared;
  this.decoder=new StringDecoder('utf8');this.stderrDecoder=new StringDecoder('utf8');
  const child=this.child=this.spawn(prepared.host,['--runtime-dir',path.dirname(prepared.exe),'--model',prepared.modelPath,'--backend',prepared.backend,'--parent-pid',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  child.stdout.on('data',b=>this.read(b));child.stderr.on('data',b=>{this.stderr=(this.stderr+this.stderrDecoder.write(b)).slice(-MAX_LOG);this.checkReady();});
  child.stdin.on('error',e=>this.fail(e));child.on('error',e=>this.fail(e));
  child.once('close',(code,signal)=>{this.alive=false;clearTimeout(this.startTimer);clearTimeout(this.readyLogTimer);const error=Error(`Whisper host exited (${code??signal})`);this.ready.reject(error);if(this.pending)this.finish(error);this.closed.resolve();this.child=null;if(!this.expectedClose&&!this.crashReported){this.crashReported=true;this.onCrash(error);}});
  this.startTimer=setTimeout(()=>this.fail(Error('Whisper host preparation timed out')),this.timeouts.start);
  try{return await this.ready.promise;}catch(e){await this.stop();throw e;}
 }
 checkReady(){
  if(!this.readyEvent||this.readyDone||this.expectedClose||!this.child)return;
  if(this.prepared.backend==='cuda'){
   try{verifyCudaLog(this.stderr);}catch(e){if(!this.readyLogTimer)this.readyLogTimer=setTimeout(()=>this.fail(e),1000);return;}
  }
  this.readyDone=true;clearTimeout(this.readyLogTimer);clearTimeout(this.startTimer);this.alive=true;
  this.backend={backend:this.prepared.backend,...(this.prepared.backend==='cuda'?{device:cudaDeviceFromLog(this.stderr)}:{})};this.metrics={...this.readyEvent.metrics,speechPid:this.child.pid};this.ready.resolve({backend:this.backend,metrics:this.metrics});
 }
 read(bytes){
  this.stdout+=this.decoder.write(bytes);if(this.stdout.length>MAX_LOG)return this.fail(Error('Whisper host stdout limit exceeded'));
  let i;while((i=this.stdout.indexOf('\n'))>=0){const line=this.stdout.slice(0,i);this.stdout=this.stdout.slice(i+1);let event;try{event=JSON.parse(line);}catch{return this.fail(Error('Invalid Whisper host JSON'));}
   if(event.type==='ready'){this.readyEvent=event;this.checkReady();}
   else if(event.type==='error'&&!this.readyDone)this.fail(Error(event.error));
   else if(this.pending&&event.id===this.pending.id){if(event.type==='result'){if(this.pending.cancelled)this.finish(Error('Transcription cancelled'));else this.finish(null,{text:String(event.text||'').replace(/\[(?:BLANK_AUDIO|SILENCE|MUSIC)\]/gi,'').trim(),metrics:{...event.metrics,transcriptionMs:performance.now()-this.pending.started,speechPid:this.child.pid}});}else if(event.type==='cancelled')this.finish(Error('Transcription cancelled'));else if(event.type==='error')this.finish(Error(event.error));}
  }
 }
 fail(error){this.ready?.reject(error);if(this.pending)this.finish(error);this.alive=false;try{this.child?.kill();}catch{/* stop() supplies the bounded termination error if the OS refuses. */}}
 finish(error,result){const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);error?p.reject(error):p.resolve(result);p.done.resolve();}
 async transcribe(audio){
  if(!this.alive||!this.child)throw Error('Whisper host is not ready');if(this.pending)throw Error('Whisper inference already active');
  // Validate before installing pending state: bad input must not poison a healthy engine.
  const payload=frame(1,this.nextId+1,audio);
  const p=deferred();p.id=++this.nextId;p.started=performance.now();p.done=deferred();this.pending=p;
  p.timer=setTimeout(()=>this.fail(Error('Whisper inference timed out')),this.timeouts.request);
  try{this.child.stdin.write(payload);}catch(e){this.fail(e);}return p.promise;
 }
 async cancel(){if(this.child&&!this.readyDone)return this.stop();const p=this.pending;if(!p)return;p.cancelled=true;try{this.child.stdin.write(frame(2,p.id));}catch(e){this.fail(e);}
  let timer;await Promise.race([p.done.promise,new Promise(resolve=>{timer=setTimeout(()=>{this.fail(Error('Whisper cancellation timed out'));resolve();},this.timeouts.cancel);})]);clearTimeout(timer);if(!this.alive)await this.stop();
 }
 async stop(){
  if(this.stopPromise)return this.stopPromise;
  if(!this.child)return;this.expectedClose=true;this.alive=false;if(this.pending){this.pending.cancelled=true;this.finish(Error('Transcription cancelled'));}
  clearTimeout(this.startTimer);clearTimeout(this.readyLogTimer);this.ready.reject(Error('Whisper preparation cancelled by stop'));
  const child=this.child;try{child.stdin.end(frame(3,0));}catch{try{child.kill();}catch{}}
  const timer=setTimeout(()=>{try{child.kill();}catch{}},this.timeouts.stopGrace);let deadline;
  this.stopPromise=Promise.race([this.closed.promise,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error(`Could not terminate Whisper host PID ${child.pid}; close the app or end that process in Task Manager before retrying.`)),this.timeouts.closeDeadline);})]).finally(()=>{clearTimeout(timer);clearTimeout(deadline);});return this.stopPromise;
 }
}
module.exports={WhisperSession};
