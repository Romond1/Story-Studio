const {test}=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');const {PassThrough}=require('node:stream');
const {WhisperSession}=require('../src/main/translation/whisper-session.cjs');
function fixture(){const child=new EventEmitter();child.pid=123;child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>queueMicrotask(()=>child.emit('close',0));child.send=e=>child.stdout.write(JSON.stringify(e)+'\n');return child;}
test('session retains PID across inference and cancellation, then closes',async()=>{
 const child=fixture();let crashes=0;const session=new WhisperSession(()=>crashes++,{spawn:()=>child});
 const starting=session.start({host:'host.exe',exe:'runtime/cli.exe',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{prepareMs:10}});await starting;
 const first=session.transcribe([0,0]);child.send({type:'result',id:1,text:' [BLANK_AUDIO] hello ',metrics:{inferenceMs:2}});assert.equal((await first).text,'hello');assert.equal(session.metrics.speechPid,123);
 const second=session.transcribe([0]);const rejection=assert.rejects(second,/cancel/i);const cancelling=session.cancel();child.send({type:'cancelled',id:2});await cancelling;await rejection;assert.equal(session.alive,true);
 const third=session.transcribe([0]);child.send({type:'result',id:3,text:'again',metrics:{inferenceMs:1}});assert.equal((await third).text,'again');
 const stopping=session.stop();child.emit('close',0);await stopping;assert.equal(session.alive,false);assert.equal(crashes,0);
});
test('unexpected close rejects request and reports crash once',async()=>{
 const child=fixture();let crashes=0;const session=new WhisperSession(()=>crashes++,{spawn:()=>child});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;const request=session.transcribe([0]);child.emit('close',1);await assert.rejects(request,/exited/);assert.equal(crashes,1);assert.equal(session.alive,false);
});
test('CUDA ready waits for allocation evidence arriving on separate pipe',async()=>{
 const child=fixture();const session=new WhisperSession(()=>{},{spawn:()=>child});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cuda'});child.send({type:'ready',metrics:{}});assert.equal(session.alive,false);
 child.stderr.write('Device 0: NVIDIA Test, compute capability 8.9\nwhisper_backend_init_gpu: using CUDA0 backend\nwhisper_model_load: CUDA0 total size = 145.00 MB\nwhisper_init_state: compute buffer (encode) = 12.00 MB\n');assert.equal((await start).backend.device,'NVIDIA Test');const stop=session.stop();child.emit('close',0);await stop;
});
test('split UTF-8 output survives pipe chunk boundaries',async()=>{
 const child=fixture();const session=new WhisperSession(()=>{},{spawn:()=>child});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;
 const request=session.transcribe([0]);const data=Buffer.from(JSON.stringify({type:'result',id:1,text:'café'})+'\n');const position=data.indexOf(Buffer.from('é'));child.stdout.write(data.subarray(0,position+1));child.stdout.write(data.subarray(position+1));assert.equal((await request).text,'café');const stop=session.stop();child.emit('close',0);await stop;
});
test('PCM serialization clamps finite overshoot and rejects nonfinite without killing session',async()=>{
 const child=fixture(),writes=[];child.stdin.on('data',b=>writes.push(b));const session=new WhisperSession(()=>{},{spawn:()=>child});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;
 const request=session.transcribe([-1.2,1.3,0.25]);assert.equal(writes[0].readFloatLE(12),-1);assert.equal(writes[0].readFloatLE(16),1);assert.equal(writes[0].readFloatLE(20),0.25);child.send({type:'result',id:1,text:'ok'});await request;
 await assert.rejects(session.transcribe([NaN]),/finite/);assert.equal(session.alive,true);assert.equal(writes.length,1);const stop=session.stop();child.emit('close',0);await stop;
});
for(const operation of ['stop','cancel'])test(`${operation} during preparation ignores late ready and awaits termination`,async()=>{
 const child=fixture();const session=new WhisperSession(()=>{},{spawn:()=>child,stopGraceMs:5,closeDeadlineMs:30});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});const rejected=assert.rejects(start,/cancel|stopp/i);const stopping=session[operation]();child.send({type:'ready',metrics:{}});assert.equal(session.alive,false);await stopping;await rejected;
});
test('cancellation deadline terminates hung inference',async()=>{
 const child=fixture();const session=new WhisperSession(()=>{},{spawn:()=>child,cancelMs:5,stopGraceMs:5,closeDeadlineMs:30});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;const request=session.transcribe([0]);const rejected=assert.rejects(request,/cancellation timed out/i);await session.cancel();await rejected;assert.equal(session.alive,false);
});
test('failed OS termination rejects stop with actionable error within deadline',async()=>{
 const child=fixture();child.kill=()=>false;const session=new WhisperSession(()=>{},{spawn:()=>child,stopGraceMs:5,closeDeadlineMs:15});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;await assert.rejects(session.stop(),/could not terminate.*123/i);assert.equal(session.alive,false);
});
test('preparation timeout rejects and closes the host',async()=>{
 const child=fixture();const session=new WhisperSession(()=>{},{spawn:()=>child,startMs:5,stopGraceMs:5,closeDeadlineMs:30});await assert.rejects(session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'}),/preparation timed out/);assert.equal(session.child,null);
});
test('inference timeout rejects pending work and closes host',async()=>{
 const child=fixture();const session=new WhisperSession(()=>{},{spawn:()=>child,requestMs:5,stopGraceMs:5,closeDeadlineMs:30});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;await assert.rejects(session.transcribe([0]),/inference timed out/);await session.stop();assert.equal(session.alive,false);
});
test('synchronous OS kill failure cannot escape timeout cleanup',async()=>{
 const child=fixture();child.kill=()=>{throw Error('access denied');};const session=new WhisperSession(()=>{},{spawn:()=>child,cancelMs:5,stopGraceMs:5,closeDeadlineMs:15});const start=session.start({host:'host',exe:'cli',modelPath:'model',backend:'cpu'});child.send({type:'ready',metrics:{}});await start;const request=session.transcribe([0]);const rejected=assert.rejects(request,/cancellation timed out/);await assert.rejects(session.cancel(),/Could not terminate/);await rejected;
});
