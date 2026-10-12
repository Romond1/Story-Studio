const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
const {TranslationService}=require('../dist/main/main/translation/service');
(async()=>{
 const service=new TranslationService(path.resolve('.translation-cache'),console.log);
 try{
  const wav=await fs.readFile(process.argv[2]||'.tmp-phase3-speech16.wav');
  let offset=12,data;
  while(offset+8<wav.length){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data'){data=wav.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
  assert.ok(data,'PCM16 mono16k WAV required');const audio=Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2)/32768);
  const result=await service.run({audio,target:'ja',model:'base.en'});console.log(JSON.stringify(result,null,2));assert.match(result.transcript,/door/i);
  await fs.writeFile('docs/phase3-evidence/speech-result.json',JSON.stringify({fixture:'Windows SAPI synthesized English, not physical microphone',...result},null,2));
  service.cancel();process.env.STORY_STUDIO_TRANSLATION_OFFLINE='1';
  const offline=await service.run({audio,target:'it',model:'base.en'});assert.match(offline.transcript,/door/i);
  console.log('PASS whisper.cpp base.en + local translation, including offline reload');
 }finally{service.cancel();}
})().catch(e=>{console.error(e);process.exitCode=1;});
