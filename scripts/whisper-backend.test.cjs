const test=require('node:test');
const assert=require('node:assert/strict');
const whisper=require('../src/main/translation/whisper.cjs');
test('CUDA requires real model and compute allocations, not discovery or use_gpu',()=>{
  assert.equal(typeof whisper.verifyCudaLog,'function');
  assert.throws(()=>whisper.verifyCudaLog('ggml_cuda_init: found 1 CUDA devices\nuse_gpu = 1'),/allocation/i);
  assert.throws(()=>whisper.verifyCudaLog('whisper_model_load: CUDA0 total size = 0.00 MB\nwhisper_init_state: compute buffer (encode) = 12.00 MB'),/allocation/i);
  assert.equal(whisper.verifyCudaLog('whisper_backend_init_gpu: using CUDA0 backend\nwhisper_model_load: CUDA0 total size = 145.00 MB\nwhisper_init_state: compute buffer (encode) = 12.00 MB'),true);
});
test('CUDA allocation without CUDA backend initialization is not proof of GPU execution',()=>{
 assert.throws(()=>whisper.verifyCudaLog('whisper_model_load: CUDA0 total size = 145.00 MB\nwhisper_init_state: compute buffer (encode) = 12.00 MB'),/allocation/);
});

test('worker memoizes successful preparation and retries a failed preparation',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
 const port=new EventEmitter(),messages=[],calls=[];port.postMessage=m=>messages.push(m);
 let fail=true;
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/main/translation/inference.cjs'),'utf8'),{process,performance,require:name=>{
   if(name==='node:worker_threads')return {parentPort:port,workerData:{cache:'cache'}};
   if(name==='./bergamot.cjs')return {MozillaProvider:class{}};
   if(name==='./whisper.cjs')return {prepareResidentSpeech:async(cache,model,status,backend)=>{calls.push({model,backend});if(fail){fail=false;throw Error('temporary failure');}return {exe:backend,modelPath:model};}};
   return require(name);
 }});
 for(const id of [1,2,3]){port.emit('message',{id,kind:'speech',model:'base.en',backend:'cuda'});await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(calls.length,2);assert.match(messages[0].error,/temporary/);assert.equal(messages[1].result.exe,'cuda');assert.equal(messages[2].result.exe,'cuda');
 port.emit('message',{id:4,kind:'speech',model:'base.en',backend:'cpu'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,3);
});

