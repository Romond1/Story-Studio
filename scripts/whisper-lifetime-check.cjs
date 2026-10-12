const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {TranslationService}=require('../dist/main/main/translation/service');const {pcm}=require('./whisper-benchmark.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/whisper-lifetime-evidence/lifecycle-runtime.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
(async()=>{
 const rows=[],s=new TranslationService(path.join(root,'.translation-cache'),()=>{});const audio=pcm(await fs.readFile(path.join(root,'docs/phase3.1-evidence/live-0.wav')));const base={target:'ja',model:'base.en',execution:'gpu'};
 const prepare=async(settings,label)=>{const start=performance.now(),state=await s.prepare(settings);rows.push({test:label,ms:performance.now()-start,state});return state.metrics.speechPid;};
 try{
  const initial=await prepare(base,'enable Base GPU + Japanese');
  for(const target of ['it','ro','ja']){assert.equal(await prepare({...base,target},`target switch to ${target}`),initial);const r=await s.run({...base,target,audio});assert.equal(r.metrics.translationLoadMs,0);rows.push({test:`prepared ${target} request`,result:r});}
  const small=await prepare({...base,model:'small.en'},'switch Base to Small');assert.notEqual(small,initial);assert.equal(alive(initial),false);
  const current=await prepare(base,'switch Small to Base');assert.equal(alive(small),false);
  const pending=s.run({...base,audio:Array.from({length:320000},(_,i)=>audio[i%audio.length])});const rejected=assert.rejects(pending,/cancel/i);await sleep(10);const started=performance.now();await s.cancelCurrent(false);await rejected;rows.push({test:'cancel in-flight request retains host',ms:performance.now()-started,pid:current});assert.equal(alive(current),true);assert.equal(s.getState().phase,'ready');
  assert.match((await s.run({...base,audio})).transcript,/books/);
  process.kill(current);for(let i=0;i<50&&s.getState().phase!=='error';i++)await sleep(20);assert.equal(s.getState().phase,'error');const recovered=await prepare(base,'recover crashed native host');assert.notEqual(recovered,current);
  const stop=performance.now();await s.cancel();rows.push({test:'disable releases host and worker',ms:performance.now()-stop,pid:recovered,alive:alive(recovered),state:s.getState()});assert.equal(alive(recovered),false);assert.equal(s.getState().phase,'off');
  const previousMask=process.env.CUDA_VISIBLE_DEVICES;process.env.CUDA_VISIBLE_DEVICES='-1';
  try{
   await prepare({...base,execution:'auto'},'Auto falls back after CUDA initialization unavailable');assert.equal(s.getState().backend.backend,'cpu');assert.ok(s.getState().backend.reason);await s.cancel();
   await assert.rejects(s.prepare(base),/GPU preparation failed.*CPU/);rows.push({test:'forced GPU missing hardware is actionable',state:s.getState()});await s.cancel();
  }finally{if(previousMask===undefined)delete process.env.CUDA_VISIBLE_DEVICES;else process.env.CUDA_VISIBLE_DEVICES=previousMask;}
  await prepare(base,'GPU works again after temporary mask');assert.equal(s.getState().backend.backend,'cuda');
 }finally{await s.cancel();await fs.writeFile(output,JSON.stringify({rows},null,2));}
 console.log('PASS target/model switches, ready reuse, cancellation, crash recovery, disable and CPU fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
