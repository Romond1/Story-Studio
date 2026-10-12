const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {TranslationService}=require('../dist/main/main/translation/service');
const sentences=["Don't open the door yet.","Wait until I say go.","Move the red block to the left.","Mia has the sword, and Yuki has the shield.","Kage, can you find the hidden key?","If you choose the wrong door, the dragon will wake up."];
(async()=>{
 const cache=path.resolve(process.env.STORY_STUDIO_TRANSLATION_CACHE||'.translation-cache');
 const service=new TranslationService(cache,console.log);
 const results=[];
 try{
  for(const target of ['ja','it','ro']){
   for(const text of sentences){const result=await service.run({text,target,model:'base.en'});assert.ok(result.translation.trim());results.push({target,...result});console.log(JSON.stringify(results.at(-1)));}
  }
  service.cancel();
  process.env.STORY_STUDIO_TRANSLATION_OFFLINE='1';
  for(const target of ['ja','it','ro']){const result=await service.run({text:sentences[0],target,model:'base.en'});assert.equal(result.translation,results.find(r=>r.target===target).translation);}
  service.cancel();
  const formatted={};for(const mode of ['standard','kana','furigana'])formatted[mode]=await service.format('勇者はドアを開けないでください。',mode);
  assert.ok(formatted.furigana.some(t=>t.reading));assert.ok(!/[\u3400-\u9fff]/.test(formatted.kana.map(t=>t.text).join('')));
  service.cancel();
  const cancelled=service.run({text:sentences[0],target:'ja',model:'base.en'});service.cancel();await assert.rejects(cancelled,/Cancelled/);
  await assert.rejects(service.run({audio:Array(16000).fill(0),target:'ja',model:'base.en'}),/No clear speech/);
  const evidence={date:new Date().toISOString(),kind:'Node isolated inference; not live lesson or language evaluation',offlinePassed:true,cancelPassed:true,silencePassed:true,results,formatted};
  await fs.mkdir('docs/phase3-evidence',{recursive:true});await fs.writeFile('docs/phase3-evidence/local-model-results.json',JSON.stringify(evidence,null,2));
  console.log('PASS all three languages, offline reuse, Japanese formatting, cancellation and silence rejection');
 }finally{service.cancel();}
})().catch(e=>{console.error(e);process.exitCode=1;});
