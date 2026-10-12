const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const commands=require('../dist-test/shared/lesson/commands');
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/whisper-lifetime-evidence'),packaged=process.argv.includes('--packaged'),prefix=packaged?'packaged':'ui';
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'story-lifetime-ui-')),profile=path.join(temporary,'profile'),folder=path.join(temporary,'lesson');await fs.mkdir(profile);await fs.mkdir(folder);await fs.symlink(path.join(root,'.translation-cache'),path.join(profile,'translation-models'),'junction');
 let project=commands.createLesson('Resident translation acceptance');project=commands.insertScene(project,'story',commands.createScene('Resident models')).project;await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const args=[`--user-data-dir=${profile}`,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${path.join(root,'docs/phase3.1-evidence/live-0.wav')}`];if(!packaged)args.unshift(root);
 const app=await _electron.launch({executablePath:packaged?path.join(root,'output/lifetime-release/win-unpacked/Story Studio.exe'):require('electron'),cwd:root,env:{...process.env,VITE_DEV_SERVER_URL:'',STORY_STUDIO_TRANSLATION_OFFLINE:'1'},args});
 const results=[],errors=[],pids=[];let control;
 try{
  control=await app.firstWindow();control.setDefaultTimeout(120000);control.on('pageerror',e=>errors.push(String(e)));await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:0});},folder);
  const button=name=>control.getByRole('button',{name,exact:true});await button('Adventure').click();await button('Open project').click();await button('Teach').click();await button('Open Present').click();const present=app.windows().find(p=>p!==control)||await app.waitForEvent('window');await present.waitForLoadState();present.on('pageerror',e=>errors.push(String(e)));
  control.on('console',m=>{if(m.text().startsWith('ENGINE '))console.log(m.text());});await control.evaluate(()=>window.translationControl.subscribeState(s=>console.log('ENGINE '+JSON.stringify(s))));
  await button('Turn translation on').click();await control.getByText('Engine: READY',{exact:true}).waitFor();const panel=control.getByRole('region',{name:'Translation',exact:true});await panel.locator('summary').click();await control.getByLabel('Auto-publish (skip review)',{exact:true}).check();
  await button('Audio settings').click();await button('Microphone Input').click();await control.getByRole('listbox',{name:'Microphone Input'}).getByRole('option').first().click();await control.getByText('Stream active',{exact:true}).first().waitFor();await button('Close Audio Settings').click();
  for(const execution of ['cpu','gpu','auto']){
   await control.getByRole('combobox',{name:/^Speech processing/}).selectOption(execution);
   const deadline=Date.now()+120000;for(;;){const s=await control.evaluate(()=>window.translationControl.getState());if(s.phase==='ready'&&s.settings.execution===execution)break;if(Date.now()>deadline)throw Error('Preparation deadline: '+JSON.stringify(s));await control.waitForTimeout(100);}
   const prepared=await control.evaluate(()=>window.translationControl.getState());console.log('PREPARED',JSON.stringify(prepared));pids.push(prepared.metrics.speechPid);assert.equal(prepared.backend.backend,execution==='cpu'?'cpu':'cuda');
   for(let trial=0;trial<2;trial++){
    const held=button('Hold to talk');await held.focus();await control.keyboard.down('Space');await control.waitForTimeout(4500);const stopped=performance.now();await control.keyboard.up('Space');await control.waitForFunction(()=>document.querySelector('.translation-controls textarea')?.value.trim());const releaseToTranscriptMs=performance.now()-stopped;
    await panel.getByText('Translation published',{exact:true}).waitFor();await present.locator('.translation-caption').waitFor();const releaseToCaptionMs=performance.now()-stopped;
    const state=await control.evaluate(()=>window.translationControl.getState());assert.equal(state.metrics.speechPid,prepared.metrics.speechPid);const draft=await control.getByLabel('Translation draft').inputValue();assert.equal(await present.locator('.translation-caption').innerText(),draft);
    results.push({execution,trial,prepared,releaseToTranscriptMs,releaseToCaptionMs,transcript:await control.getByLabel('English · private').inputValue(),translation:draft});console.log('PASS',execution,trial,Math.round(releaseToTranscriptMs),Math.round(releaseToCaptionMs),'pid',state.metrics.speechPid);
   }
  }
  await control.screenshot({path:path.join(output,prefix+'-control.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('— Present')).close());await button('Turn translation on').waitFor();for(let i=0;i<50&&pids.some(alive);i++)await control.waitForTimeout(50);assert.equal(pids.some(alive),false);assert.equal((await control.evaluate(()=>window.translationControl.getState())).phase,'off');
  await button('Turn translation on').click();await control.getByText('Engine: READY',{exact:true}).waitFor();pids.push((await control.evaluate(()=>window.translationControl.getState())).metrics.speechPid);assert.deepEqual(errors,[]);
 }catch(e){errors.push(String(e));if(control)await control.screenshot({path:path.join(output,prefix+'-error.png')}).catch(()=>{});throw e;}
 finally{
  await app.close();for(let i=0;i<50&&pids.some(alive);i++)await new Promise(r=>setTimeout(r,50));const orphanPids=pids.filter(alive);if(orphanPids.length)errors.push('Orphan native processes: '+orphanPids);
  await fs.writeFile(path.join(output,prefix+'-checks.json'),JSON.stringify({packaged,offline:true,fixture:'Recorded user WAV loop through actual AudioController/MediaRecorder capture; intervals may cross phrase boundaries',results,errors,orphanPids},null,2));assert.equal(orphanPids.length,0);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
