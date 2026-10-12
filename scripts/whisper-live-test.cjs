// Explicit local microphone accuracy test. Run: npx electron scripts/whisper-live-test.cjs
if(process.type==='renderer'){
 const {contextBridge,ipcRenderer}=require('electron');
 contextBridge.exposeInMainWorld('speechTest',{compare:payload=>ipcRenderer.invoke('speech-test:compare',payload)});
}else{
 const {app,BrowserWindow,ipcMain,session}=require('electron');
 const fs=require('node:fs/promises'),path=require('node:path');
 const {TranslationService}=require('../dist/main/main/translation/service');
 const {wer}=require('./whisper-benchmark.cjs');
 const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/phase3.1-evidence');let service,win;const results=[];
 app.setPath('userData',path.join(require('node:os').tmpdir(),`story-whisper-live-${process.pid}`));
 app.whenReady().then(async()=>{
  service=new TranslationService(path.join(root,'.translation-cache'),console.log);
  session.defaultSession.setPermissionRequestHandler((wc,permission,cb)=>cb(wc===win?.webContents&&permission==='media'));
  ipcMain.handle('speech-test:compare',async(event,{audio,reference,index})=>{
   if(event.sender!==win.webContents||!Array.isArray(audio)||audio.length>320000||!Number.isInteger(index)||index<0||index>4)throw Error('Invalid recording');
   const wav=Buffer.alloc(44+audio.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(audio.length*2,40);audio.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));
   await fs.writeFile(path.join(output,`live-${index}.wav`),wav);
   const comparisons=[];for(const execution of ['cpu','gpu']){const r=await service.run({audio,model:'base.en',target:'ja',execution});comparisons.push({execution,...r,wer:wer(reference,r.transcript)});}
   results.push({index,reference,seconds:audio.length/16000,comparisons});await fs.writeFile(path.join(output,'live-test.json'),JSON.stringify({fixture:'User recorded microphone speech, same PCM replayed CPU and GPU',results},null,2));return comparisons;
  });
  win=new BrowserWindow({width:900,height:780,title:'Story Studio — live speech comparison',webPreferences:{preload:__filename,contextIsolation:true,nodeIntegration:false,sandbox:false}});await win.loadFile(path.join(__dirname,'whisper-live-test.html'));win.show();
 });
 app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>service?.cancel());
}
