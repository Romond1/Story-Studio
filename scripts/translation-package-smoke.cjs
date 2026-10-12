const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const {_electron}=require(process.env.STORY_STUDIO_PLAYWRIGHT||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'story-translation-package-'));
 const app=await _electron.launch({executablePath:path.resolve('release/win-unpacked/Story Studio.exe'),args:[`--user-data-dir=${profile}`],env:{...process.env,STORY_STUDIO_TRANSLATION_OFFLINE:'1',VITE_DEV_SERVER_URL:''}});
 app.process().stderr.on('data',data=>console.log(String(data)));
 try{
  const page=await app.firstWindow(); console.log('Packaged window ready');
  const cache=path.join(await app.evaluate(({app})=>app.getPath('userData')),'translation-models');
  await fs.cp(path.resolve('.translation-cache'),cache,{recursive:true});
  console.log('Cache provisioned');
  await page.evaluate(()=>window.translationControl.subscribeStatus(s=>console.log('TRANSLATION',s)));
  page.on('console',message=>console.log(message.text()));
  const results=[];
  for(const target of ['ja','it','ro']){
   console.log('Starting',target);let timer;
   try{const result=await Promise.race([page.evaluate(target=>window.translationControl.run({text:"Don't open the door yet.",target,model:'base.en'}),target),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Packaged inference timeout')),30000);})]);assert.ok(result.translation);results.push({target,...result});console.log(target,result.translation);}
   finally{clearTimeout(timer);}
  }
  const tokens=await page.evaluate(()=>window.translationControl.format('勇者はドアを開ける。','furigana'));assert.ok(tokens.some(t=>t.reading));
  const wav=await fs.readFile('.tmp-phase3-speech16.wav');let offset=12,data;
  while(offset+8<wav.length){const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data'){data=wav.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
  assert.ok(data);const audio=Array.from({length:data.length/2},(_,i)=>data.readInt16LE(i*2)/32768);
  const speech=await page.evaluate(audio=>window.translationControl.run({audio,target:'ja',model:'base.en'}),audio);assert.match(speech.transcript,/door/i);
  await fs.writeFile('docs/phase3-evidence/packaged-results.json',JSON.stringify({offline:true,results,tokens,speech},null,2));
  console.log('PASS packaged Windows app: offline three-language inference, Japanese dictionary and native Whisper speech');
 }catch(error){console.error(error);throw error;}finally{
  await app.evaluate(({BrowserWindow})=>{for(const window of BrowserWindow.getAllWindows())window.removeAllListeners('close');}).catch(()=>{});
  await app.close();
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
