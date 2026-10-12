/* Offline combined synthetic-media acceptance; no physical hardware claims. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { _electron } = require(process.env.STORY_STUDIO_PLAYWRIGHT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const commands = require('../dist-test/shared/lesson/commands');
(async () => {
 const root=path.resolve(__dirname,'..'), temporary=await fs.mkdtemp(path.join(os.tmpdir(),'story-translation-'));
 const evidence=path.join(root,'docs/phase3-evidence'); await fs.mkdir(evidence,{recursive:true});
 const fixture=path.join(temporary,'face.y4m');
 const portrait=process.env.STORY_STUDIO_FACE_FIXTURE || path.join(root,'.tmp-face-fixtures/portrait.jpg');
 await fs.access(portrait).catch(()=>{throw new Error('Set STORY_STUDIO_FACE_FIXTURE to the MediaPipe portrait.jpg fixture.');});
 const speechFixture=process.env.STORY_STUDIO_SPEECH_FIXTURE || path.join(root,'.tmp-phase3-speech16.wav');
 await fs.access(speechFixture).catch(()=>{throw new Error('Set STORY_STUDIO_SPEECH_FIXTURE to a short English speech WAV fixture.');});
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x00ff00:s=1280x720:r=30','-loop','1','-i',portrait,'-filter_complex','[1:v]crop=600:580:100:0,scale=480:464,rotate=0.18*sin(t):ow=560:oh=550:c=0x00ff00[face];[0:v][face]overlay=x=360+100*sin(t):y=130+35*cos(t):shortest=1','-r','30','-t','4','-pix_fmt','yuv420p',fixture]);
 const folder=path.join(temporary,'lesson'); await fs.mkdir(folder);
 let project=commands.createLesson('Local multilingual lesson'); const scene=commands.createScene('Translation acceptance'); scene.background.color='#18314f'; project=commands.insertScene(project,'story',scene).project;
 await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,env:{...process.env,VITE_DEV_SERVER_URL:'',STORY_STUDIO_TRANSLATION_OFFLINE:'1'},args:[root,`--user-data-dir=${path.join(temporary,'profile')}`,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-video-capture=${fixture}`,`--use-file-for-fake-audio-capture=${speechFixture}`]});
 const results=[],errors=[],measurements={}; let control,present;
 const pass=name=>{results.push(name);console.log('PASS',name)};
 try {
  control=await app.firstWindow();control.setDefaultTimeout(120000);control.on('pageerror',e=>errors.push(String(e)));
  const userData=await app.evaluate(({app})=>app.getPath('userData'));
  await fs.cp(path.join(root,'.translation-cache'),path.join(userData,'translation-models'),{recursive:true});
  await app.evaluate(({dialog,session},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:0});global.blockedNetwork=[];session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(d,cb)=>{global.blockedNetwork.push(d.url);cb({cancel:true})})},folder);
  const button=name=>control.getByRole('button',{name,exact:true});
  await button('Adventure').click();await button('Open project').click();await button('Teach').click();await button('Open Present').click();
  present=app.windows().find(p=>p!==control)||await app.waitForEvent('window');present.setDefaultTimeout(120000);present.on('pageerror',e=>errors.push(String(e)));
  await present.evaluate(()=>{
   window.metrics={draws:0,results:0,acquisitions:0};
   const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...a){window.metrics.draws++;return draw.apply(this,a)};
   const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{window.metrics.acquisitions++;return get(c)};
   const Original=window.Worker;window.Worker=class extends Original{constructor(...a){super(...a);this.addEventListener('message',({data})=>{if(data.type==='result'){window.metrics.results++;window.latestFace=data.observation}})}};
  });
  await button('Turn camera on').click();await control.getByText('Camera live in Presenter',{exact:true}).waitFor();
  await control.evaluate(async()=>{const {settings}=await window.cameraControl.get();await window.cameraControl.set({...settings,preset:'lower-right',chromaKey:true})});
  await control.getByLabel('Enable face tracking',{exact:true}).check();await control.getByText('Tracking face',{exact:true}).waitFor();
  await present.waitForFunction(()=>window.latestFace?.landmarks.length===478);
  pass('Synthetic camera, chroma key, real MediaPipe 478-landmark tracking and active lesson coexist');
  await button('Turn translation on').click();
  const panel=control.getByRole('region',{name:'Translation',exact:true});

  await control.getByLabel('English · private').fill('The brave hero opens the door.');await button('Translate English').click();await panel.getByText('Ready to review',{exact:true}).waitFor();
  const draft=await control.getByLabel('Translation draft').inputValue();assert.ok(draft.length>0);assert.equal(await present.locator('.translation-caption').count(),0);
  pass('Offline local English-to-Japanese UI draft is private before manual publish');
  await button('Publish translation').click();await present.locator('.translation-caption').waitFor();assert.equal(await present.locator('.translation-caption').innerText(),draft);
  for(const mode of ['kana','furigana','standard']){await control.getByLabel('Japanese display').selectOption(mode);await button('Publish translation').click();await panel.getByText('Translation published',{exact:true}).waitFor();if(mode==='furigana'){assert.ok(await present.locator('ruby rt').count()>0);await present.screenshot({path:path.join(evidence,'electron-presenter-furigana.png')})}if(mode==='kana')assert.ok(!/[\u4e00-\u9fff]/u.test(await present.locator('.translation-caption').innerText()))}
  pass('Standard, kana-only and true ruby furigana publish through UI');
  for(const target of ['it','ro']){await control.getByLabel('Target language').selectOption(target);await button('Translate English').click();await panel.getByText('Ready to review',{exact:true}).waitFor();await button('Publish translation').click();await present.locator(`.translation-caption[lang=${target}]`).waitFor()}
  pass('Italian and Romanian selection, offline translation and publish work');
  await control.getByLabel('Target language').selectOption('ja');await button('Translate English').click();await button('Clear / hide').click();await control.waitForTimeout(1500);assert.equal(await present.locator('.translation-caption').count(),0);assert.equal(await control.getByLabel('Translation draft').inputValue(),'');pass('Clear during inference prevents stale draft/caption resurrection');
  await control.getByLabel('English · private').fill('The brave hero opens the door.');await button('Translate English').click();await panel.getByText('Ready to review',{exact:true}).waitFor();await control.getByLabel('Japanese display').selectOption('furigana');await button('Publish translation').click();await panel.getByText('Translation published',{exact:true}).waitFor();
  await panel.scrollIntoViewIfNeeded();await control.screenshot({path:path.join(evidence,'electron-control-desktop.png')});await present.screenshot({path:path.join(evidence,'electron-presenter-desktop.png')});
  await control.evaluate(()=>{window.micMetrics={acquisitions:0,tracks:[]};const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await get(constraints);if(constraints.audio){window.micMetrics.acquisitions++;window.micMetrics.tracks.push(...stream.getAudioTracks())}return stream}});
  await button('Audio settings').click();await button('Microphone Input').click();await control.getByRole('listbox',{name:'Microphone Input'}).getByRole('option').first().click();await control.getByText('Stream active',{exact:true}).first().waitFor();await button('Close Audio Settings').click();
  const held=button('Hold to talk');await held.focus();await held.press('Space',{delay:4500});await panel.getByText('Ready to review',{exact:true}).waitFor();
  measurements.microphone=await control.evaluate(()=>({acquisitions:window.micMetrics.acquisitions,liveTracks:window.micMetrics.tracks.filter(t=>t.readyState==='live').length}));measurements.speechTranscript=await control.getByLabel('English · private').inputValue();assert.ok(measurements.speechTranscript.length>5);assert.deepEqual(measurements.microphone,{acquisitions:1,liveTracks:1});pass('Synthetic microphone through Audio settings and Hold to talk reuses one live input stream; local Whisper transcript received');
  await button('Publish translation').click();await panel.getByText('Translation published',{exact:true}).waitFor();
  const pcm=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',speechFixture,'-f','f32le','-ac','1','-ar','16000','-']); const audio=Array.from({length:pcm.length/4},(_,i)=>pcm.readFloatLE(i*4));
  const seconds=Number(process.env.STORY_STUDIO_TRANSLATION_SAMPLE_SECONDS||60);
  const sample=async(active)=>{const start=await present.evaluate(()=>({...window.metrics,time:performance.now()}));const cpu=[],inference=[];let translations=0;const until=Date.now()+seconds*1000;while(Date.now()<until){cpu.push(await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,cpu:p.cpu.percentCPUUsage,workingSetKB:p.memory.workingSetSize}))));if(active){inference.push((await control.evaluate(async audio=>window.translationControl.run({audio,target:'ja',model:'base.en'}),audio)).metrics);translations++}await control.waitForTimeout(500)}const end=await present.evaluate(()=>({...window.metrics,time:performance.now()}));const elapsed=(end.time-start.time)/1000;return{seconds:elapsed,cameraDrawFPS:(end.draws-start.draws)/elapsed,trackingResultsHz:(end.results-start.results)/elapsed,translations,inference,electronAverageCpuPercent:cpu.reduce((n,s)=>n+s.reduce((n,p)=>n+p.cpu,0),0)/cpu.length,electronAverageWorkingSetMB:cpu.reduce((n,s)=>n+s.reduce((n,p)=>n+p.workingSetKB,0),0)/cpu.length/1024,processSamples:cpu}};
  console.log('Sampling baseline',seconds);measurements.baseline=await sample(false);console.log('Sampling active',seconds);measurements.translation=await sample(true);
  measurements.camera=await control.evaluate(()=>window.cameraControl.get());measurements.acquisitions=await present.evaluate(()=>window.metrics.acquisitions);
  assert.equal(measurements.acquisitions,1);pass('Translation sampling preserves a single Presenter camera acquisition');
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.setMinimumSize(320,400);w.setSize(480,850)}});await panel.scrollIntoViewIfNeeded();await control.screenshot({path:path.join(evidence,'electron-control-narrow.png')});await present.screenshot({path:path.join(evidence,'electron-presenter-narrow.png')});assert.equal(await panel.evaluate(s=>s.scrollWidth>s.clientWidth+1),false);pass('Narrow Translation control panel has no horizontal overflow');
  measurements.blockedNetwork=await app.evaluate(()=>global.blockedNetwork);assert.deepEqual(measurements.blockedNetwork,[]);assert.deepEqual(errors,[]);
 } catch(error){errors.push(String(error));if(control)await control.screenshot({path:path.join(evidence,'electron-failure-control.png')}).catch(()=>{});console.error(error);console.log('CONTROL',await control.locator('body').innerText());process.exitCode=1}
 finally{await fs.writeFile(path.join(evidence,'electron-results.json'),JSON.stringify({fixture:'Synthetic portrait camera; offline local models. No physical camera or microphone hardware claim.',results,errors,measurements},null,2));await app.close();await fs.rm(temporary,{recursive:true,force:true}).catch(()=>{})}
})().catch(e=>{console.error(e);process.exitCode=1});
