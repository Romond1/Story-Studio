// Hardware/offline failure paths, isolated from the teacher's app. No driver changes.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {TranslationService}=require('../dist/main/main/translation/service');
const {pcm}=require('./whisper-benchmark.cjs');
(async()=>{const output=path.resolve('docs/phase3.1-evidence'),audio=pcm(await fs.readFile(path.join(output,'utterance-0.wav')));const results=[];process.env.STORY_STUDIO_TRANSLATION_OFFLINE='1';
 const run=async execution=>{const s=new TranslationService(path.resolve('.translation-cache'),()=>{});try{return await s.run({audio,model:'base.en',target:'ja',execution});}finally{s.cancel();}};
 results.push({test:'offline explicit CPU',result:await run('cpu')});assert.equal(results.at(-1).result.speechBackend.backend,'cpu');
 // Discovery still sees the card, but CUDA has no visible devices. Driver remains untouched.
 process.env.CUDA_VISIBLE_DEVICES='-1';
 results.push({test:'Auto falls back when native CUDA initialization is unavailable',result:await run('auto')});assert.equal(results.at(-1).result.speechBackend.backend,'cpu');assert.ok(results.at(-1).result.speechBackend.reason);
 await assert.rejects(run('gpu'),error=>{results.push({test:'forced GPU returns actionable error',error:error.message});return /GPU transcription failed/.test(error.message)&&/CPU or Auto/.test(error.message);});
 delete process.env.CUDA_VISIBLE_DEVICES;
 results.push({test:'offline GPU after CPU/failure releases old resources',result:await run('gpu')});assert.equal(results.at(-1).result.speechBackend.backend,'cuda');
 const s=new TranslationService(path.resolve('.translation-cache'),()=>{});let pending;try{pending=s.run({audio,model:'base.en',target:'ja',execution:'gpu'});setTimeout(()=>s.cancel(),100);await assert.rejects(pending,/Cancelled/);const r=await s.run({audio,model:'base.en',target:'ja',execution:'cpu'});assert.equal(r.speechBackend.backend,'cpu');results.push({test:'cancel GPU preparation then CPU retry',result:r});}finally{s.cancel();}
 await fs.writeFile(path.join(output,'runtime-checks.json'),JSON.stringify({offline:true,results},null,2));console.log('PASS',results.map(r=>r.test));
})().catch(e=>{console.error(e);process.exitCode=1;});
