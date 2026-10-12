// Opt-in physical camera contention benchmark. Stores timings, never camera footage.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {_electron}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const commands=require('../dist-test/shared/lesson/commands');
const install=require('./profiling/client.cjs');
const {pcm,monitor}=require('./whisper-benchmark.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(process.env.STORY_STUDIO_PROFILE!=='1')throw Error('Set STORY_STUDIO_PROFILE=1.');
(async()=>{
 const root=path.resolve(__dirname,'..'),output=process.env.WHISPER_EVIDENCE_OUTPUT?path.resolve(process.env.WHISPER_EVIDENCE_OUTPUT):path.join(root,'docs/phase3.1-evidence'),build=path.join(root,'.tmp-face-profile-build');
 const synthetic=process.env.WHISPER_CAMERA_FIXTURE;const prefix=synthetic?'synthetic-':'';
 const fixtureDescription=synthetic?'Moving portrait camera fixture; user-recorded speech; actual chroma, MediaPipe face tracking and playing lesson video':'Default live camera; user-recorded speech; actual chroma, MediaPipe face tracking and playing lesson video';
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'story-whisper-camera-')),folder=path.join(temporary,'lesson');await fs.mkdir(path.join(folder,'assets'),{recursive:true});
 if(!process.env.PROFILE_VIDEO_SOURCE)throw Error('Set PROFILE_VIDEO_SOURCE to a 720p/30fps benchmark video.');
 const video=path.join(folder,'assets/benchmark.webm');await fs.copyFile(process.env.PROFILE_VIDEO_SOURCE,video);
 let project=commands.createLesson('GPU speech contention benchmark');const scene=commands.createScene('Camera, chroma, face tracking and lesson video','benchmark-video');
 project.assets.push({id:'benchmark-video',relativePath:'assets/benchmark.webm',filename:'benchmark.webm',originalName:'benchmark.webm',mediaType:'video',sizeBytes:(await fs.stat(video)).size,importedAt:new Date().toISOString()});
 project=commands.insertScene(project,'story',scene).project;require('../dist-test/shared/lesson/validation').parseLessonProject(project);await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const profile=path.join(temporary,'profile');await fs.mkdir(profile);await fs.symlink(path.join(root,'.translation-cache'),path.join(profile,'translation-models'),'junction');
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
 const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel==='/')rel='/index.html';const file=path.resolve(build,'.'+rel);if(!file.startsWith(build+path.sep))throw Error('path');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(5194,'127.0.0.1',r));
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,env:{...process.env,VITE_DEV_SERVER_URL:'http://127.0.0.1:5194',STORY_STUDIO_TRANSLATION_OFFLINE:'1'},args:[root,`--user-data-dir=${profile}`,...(synthetic?['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-video-capture=${synthetic}`]:[])]});
 const results=[],errors=[];let control,present;const stop=monitor(path.join(output,prefix+'camera-resources.json'));
 try{
  control=await app.firstWindow();control.setDefaultTimeout(60000);control.on('pageerror',e=>errors.push(String(e)));
  await app.evaluate(({dialog,BrowserWindow},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});dialog.showMessageBox=async()=>({response:0});const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1280,900);w.setPosition(0,0);},folder);
  const button=name=>control.getByRole('button',{name,exact:true});await button('Adventure').click();await button('Open project').click();await button('Teach').click();await control.evaluate(install);await button('Open Present').click();
  present=app.windows().find(p=>p!==control)||await app.waitForEvent('window');await present.waitForLoadState();present.on('pageerror',e=>errors.push(String(e)));await present.evaluate(install);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('— Present'));w.setFullScreen(false);w.setContentSize(1280,720);w.setPosition(1300,0);w.show();});
  await control.evaluate(async()=>{const {settings}=await window.cameraControl.get();await window.cameraControl.set({...settings,enabled:true,preset:'lower-right',chromaKey:true,tracking:{...settings.tracking,enabled:true,hat:true,markers:true}});});
  await control.getByText('Camera live in Presenter',{exact:true}).waitFor();
  await present.waitForFunction(()=>window.__storyProfile.pose?.landmarks?.length || document.querySelector('video')?.readyState>=2);
  await button('Play video').click();await present.evaluate(()=>document.querySelectorAll('video').forEach(v=>{if(!v.srcObject)v.loop=true;}));
  const fixtures=[];for(let i=0;i<5;i++)fixtures.push(pcm(await fs.readFile(path.join(root,'docs/phase3.1-evidence',`live-${i}.wav`))));
  if(synthetic)await control.getByText('Tracking face',{exact:true}).waitFor();
  const configs=[{name:'idle'}, {name:'base-cpu',model:'base.en',execution:'cpu'},{name:'base-cuda',model:'base.en',execution:'gpu'},{name:'small-cpu',model:'small.en',execution:'cpu'},{name:'small-cuda',model:'small.en',execution:'gpu'}];
  for(const config of (process.env.WHISPER_CAMERA_GPU_BASE_ONLY==='1'?configs.filter(c=>c.name==='idle'||c.name==='base-cuda'):process.env.WHISPER_CAMERA_GPU_ONLY==='1'?configs.filter(c=>!c.model||c.execution==='gpu'):process.env.WHISPER_CAMERA_BASE_ONLY==='1'?configs.slice(0,3):configs)){
   await control.evaluate(()=>window.translationControl.cancel(true));
   if(config.model)await control.evaluate(({audio,config})=>window.translationControl.run({audio,target:'ja',...config}),{audio:fixtures[0],config});
   console.log('WARMUP',config.name);await sleep(10000);await control.evaluate(()=>window.__storyProfile.reset());await present.evaluate(()=>window.__storyProfile.reset());
   const start=Date.now(),runs=[],samples=[];console.log('MEASURING',config.name);
   while(Date.now()-start<60000 || (config.model&&runs.length<5)){
    samples.push(await app.evaluate(({app})=>app.getAppMetrics()));
    if(config.model){const t=performance.now();const result=await control.evaluate(({audio,config})=>window.translationControl.run({audio,target:'ja',...config}),{audio:fixtures[runs.length%5],config});
     const captionStart=performance.now();await control.evaluate(async text=>{await window.translationControl.publish({language:'ja',mode:'standard',tokens:[{text}],fontSize:36,position:'top'});},result.translation);await present.getByText(result.translation,{exact:true}).waitFor();runs.push({...result,speechToCaptionMs:performance.now()-t,publishMs:performance.now()-captionStart});
    }else await sleep(1000);
   }
   const result={config,started:start,finished:Date.now(),runs,samples,control:await control.evaluate(()=>window.__storyProfile.stop()),presenter:await present.evaluate(()=>window.__storyProfile.stop()),camera:await control.evaluate(()=>window.cameraControl.get()),videos:await present.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({camera:!!v.srcObject,paused:v.paused,time:v.currentTime,width:v.videoWidth,height:v.videoHeight,quality:{total:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames}})))};
   results.push(result);await fs.writeFile(path.join(output,prefix+'camera-benchmark.json'),JSON.stringify({fixture:fixtureDescription,results,errors},null,2));console.log('SAVED',config.name,result.presenter.results,result.presenter.faceResults);
  }
  await present.screenshot({path:path.join(output,prefix+'camera-presenter.png')});
 }catch(e){errors.push(String(e));throw e;}finally{await fs.writeFile(path.join(output,prefix+'camera-benchmark.json'),JSON.stringify({fixture:fixtureDescription,results,errors},null,2));await stop();await app.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
