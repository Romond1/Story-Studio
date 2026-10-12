// Explicit developer harness; physical video only, no microphone or footage recording.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {_electron}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const commands=require('../../dist-test/shared/lesson/commands');
const install=require('./client.cjs');
if(process.env.STORY_STUDIO_PROFILE!=='1')throw Error('Set STORY_STUDIO_PROFILE=1.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const root=path.resolve(__dirname,'../..'),output=path.join(root,'docs/performance-evidence'),build=path.join(root,'.tmp-face-profile-build');
 await fs.mkdir(output,{recursive:true});const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'story-profile-')),folder=path.join(temporary,'lesson');await fs.mkdir(folder);
 await fs.mkdir(path.join(folder,'assets'));const video=path.join(folder,'assets/benchmark.webm');if(process.env.PROFILE_VIDEO_SOURCE)await fs.copyFile(process.env.PROFILE_VIDEO_SOURCE,video);else execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=30','-t','90','-c:v','libvpx','-b:v','1500k','-an',video]);
 let project=commands.createLesson('Performance benchmark');const scene=commands.createScene('Live teaching benchmark','benchmark-video');
 if(process.env.PROFILE_SUITE==='video-idle')delete scene.background.assetId;
 scene.objects.push({id:'text',kind:'text',text:'Story Studio performance benchmark',fontSize:40,color:'#ffffff',align:'center',visible:true,box:{x:100,y:60,width:1080,height:90}});
 project.assets.push({id:'benchmark-video',relativePath:'assets/benchmark.webm',filename:'benchmark.webm',originalName:'benchmark.webm',mediaType:'video',sizeBytes:(await fs.stat(video)).size,importedAt:new Date().toISOString()});
 project=commands.insertScene(project,'story',scene).project;require('../../dist-test/shared/lesson/validation').parseLessonProject(project);await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
 const server=http.createServer(async(req,res)=>{try{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel==='/')rel='/index.html';const file=path.resolve(build,'.'+rel);if(!file.startsWith(build+path.sep))throw Error('path');const data=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(5193,'127.0.0.1',r));
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,env:{...process.env,VITE_DEV_SERVER_URL:'http://127.0.0.1:5193'},args:[root,`--user-data-dir=${path.join(temporary,'profile')}`]});
 let present,control,active=false;const errors=[];
 try{
  control=await app.firstWindow();control.setDefaultTimeout(30000);control.on('pageerror',e=>errors.push(String(e)));
  await app.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBox=async()=>({response:0});const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1280,900);w.setPosition(0,0);});
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
  const button=name=>control.getByRole('button',{name,exact:true});await button('Adventure').click();await button('Open project').click();await control.getByText('Lesson opened.',{exact:true}).waitFor();await button('Teach').click();await control.evaluate(install);
  const set=patch=>control.evaluate(async patch=>{const {settings}=await window.cameraControl.get();return window.cameraControl.set({...settings,...patch,tracking:{...settings.tracking,...patch.tracking}});},patch);
  await control.evaluate(()=>{for(const s of document.querySelectorAll('.camera-controls,[aria-label="Face Tracking"]')){s.inert=true;s.style.opacity='0.65';}const note=document.createElement('p');note.textContent='BENCHMARK — camera controls are automatic. Please leave controls unchanged.';note.style.cssText='position:fixed;top:0;left:0;right:0;padding:8px;background:#16283b;color:white;z-index:999999;pointer-events:none';document.body.append(note);});
  await set({enabled:false,tolerance:.42,tracking:{enabled:false}});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.getTitle().includes('— Present')).forEach(w=>w.close()));
  const sys=()=>os.cpus().map(c=>c.times).reduce((a,t)=>({idle:a.idle+t.idle,total:a.total+Object.values(t).reduce((a,b)=>a+b,0)}),{idle:0,total:0});
  const sample=async()=>({wall:performance.now(),system:sys(),free:os.freemem(),processes:await app.evaluate(({app,BrowserWindow})=>{const windows=BrowserWindow.getAllWindows();return app.getAppMetrics().map(m=>({...m,window:windows.find(w=>w.webContents.getOSProcessId()===m.pid)?.getTitle()}));})});
  const metadata=await app.evaluate(async({app,BrowserWindow,screen})=>({versions:process.versions,gpu:await app.getGPUInfo('basic'),gpuStatus:app.getGPUFeatureStatus(),displays:screen.getAllDisplays().map(d=>({size:d.size,scale:d.scaleFactor,frequency:d.displayFrequency})),mainPid:process.pid}));
  await fs.writeFile(path.join(output,process.env.PROFILE_SUITE?`environment-${process.env.PROFILE_SUITE}.json`:'environment.json'),JSON.stringify({date:new Date().toISOString(),cpu:os.cpus()[0].model,logicalProcessors:os.cpus().length,ramBytes:os.totalmem(),...metadata},null,2));
  const measure=async(name,seconds=60)=>{
   console.log('WARMUP',name);await sleep(10000);await control.evaluate(()=>window.__storyProfile.reset());if(present)await present.evaluate(()=>window.__storyProfile.reset());
   const initialState=await control.evaluate(()=>window.cameraControl.get());const samples=[await sample()],actions=[];console.log('MEASURING',name,seconds,'seconds');const start=performance.now();let nextAction=0;
   while(performance.now()-start<seconds*1000){await sleep(1000);samples.push(await sample());
    if(process.env.PROFILE_SUITE==='video-idle'){
     const videos=()=>[...document.querySelectorAll('video')].map(v=>({time:v.currentTime,paused:v.paused,stream:!!v.srcObject,frames:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames}));
     samples.at(-1).videos={control:await control.evaluate(videos),presenter:await present.evaluate(videos)};
    }
    if(active&&performance.now()-start>=nextAction){const t=performance.now();const box=await control.locator('.lesson-canvas').boundingBox();if(box){await control.mouse.move(box.x+box.width*.25,box.y+box.height*.5);await control.mouse.down();await control.mouse.move(box.x+box.width*.65,box.y+box.height*(.55+.1*Math.sin(nextAction)),{steps:12});await control.mouse.up();}actions.push({t:performance.now()-start,duration:performance.now()-t});nextAction+=5000;}
   }
   const cm=await control.evaluate(()=>window.__storyProfile.stop()),pm=present?await present.evaluate(()=>window.__storyProfile.stop()):null;
   const state=await control.evaluate(()=>window.cameraControl.get());let lesson=null;if(present)lesson=await present.evaluate(()=>{const v=document.querySelector('.lesson-scene-content video')||document.querySelector('video');return v?{currentTime:v.currentTime,paused:v.paused,quality:v.getVideoPlaybackQuality(),width:v.videoWidth,height:v.videoHeight}:null;});
   const expected={A:[false,false,false],B:[false,false,false],C:[true,false,false],D:[true,true,false]}[name];
   const validity={settingsStable:JSON.stringify(initialState.settings)===JSON.stringify(state.settings),expectedSettings:!expected||[state.settings.enabled,state.settings.chromaKey,state.settings.tracking.enabled].every((v,i)=>v===expected[i]),presenterClosed:name!=='A'||samples.every(s=>!s.processes.some(p=>p.window?.includes('— Present'))),noUnexpectedInference:!expected||expected[2]||!pm?.results};
   const result={name,samples,control:cm,presenter:pm,initialState,state,validity,lesson,actions,errors:[...errors]};await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(result));console.log('SAVED',name,'processes',samples.at(-1).processes.map(x=>[x.pid,x.type,x.window]),'frames',pm?.camera.length,'results',pm?.results,'face',pm?.faceResults);
   if(Object.values(validity).some(v=>!v))throw Error('Benchmark settings changed: '+name);
  };
  const short=Number(process.env.PROFILE_SECONDS)||60;
  if(process.env.PROFILE_SUITE!=='video-idle')await measure('A',short);
  await button('Open Present').click();present=app.windows().find(p=>p!==control)||await app.waitForEvent('window');await present.waitForLoadState();present.on('pageerror',e=>errors.push(String(e)));await present.evaluate(install);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('— Present'));w.setFullScreen(false);w.setContentSize(1280,720);w.setPosition(1300,0);w.show();});
  if(process.env.PROFILE_SUITE==='video-idle'){
   await measure('B-static',short);project.scenes[scene.id].background.assetId='benchmark-video';await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));await button('Open project').click();await button('Teach').click();await present.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await measure('B-paused-video',short);console.log('VIDEO IDLE COMPARISON COMPLETE');return;
  }
  await measure('B',short);
  console.log('PHYSICAL CAMERA STARTING');await set({enabled:true,preset:'lower-right',mirror:false,chromaKey:false,tracking:{enabled:false}});await control.getByText('Camera live in Presenter',{exact:true}).waitFor();
  await measure('C',short);await set({chromaKey:true});await measure('D',short);
  if(process.env.PROFILE_SUITE==='followup'){
   // Match the 13 retained strokes present throughout the first cadence sweep.
   await button('Draw on scene').click();
   for(let i=0;i<13;i++){const box=await control.locator('.lesson-canvas').boundingBox();await control.mouse.move(box.x+box.width*.25,box.y+box.height*.5);await control.mouse.down();await control.mouse.move(box.x+box.width*.65,box.y+box.height*(.55+.1*Math.sin(i*5000)),{steps:12});await control.mouse.up();}
   await button('Finish drawing').click();
   await present.evaluate(()=>Object.assign(window.__storyProfile,{interval:50,compensated:true}));
   await set({tracking:{enabled:true,hat:true,markers:true}});await control.getByText('Tracking face',{exact:true}).waitFor({timeout:60000});await measure('E-target20-compensated',short);
   await set({tracking:{enabled:false}});await present.evaluate(()=>Object.assign(window.__storyProfile,{interval:80,compensated:false}));await set({tracking:{enabled:true}});await control.getByText('Tracking face',{exact:true}).waitFor({timeout:60000});
   await button('Play video').click();await button('Draw on scene').click();active=true;await measure('F-confirmed',short);active=false;await button('Finish drawing').click();await button('Pause video').click();
   await set({enabled:false,tracking:{enabled:false}});console.log('FOLLOWUP COMPLETE');return;
  }
  console.log('MOTION RUNS START: alternate neutral, left/right turns, nods and brief still holds. No video is recorded.');
  await set({tracking:{enabled:true,hat:true,markers:true}});await control.getByText('Tracking face',{exact:true}).waitFor({timeout:60000});await measure('E',short);
  await button('Play video').click();await present.evaluate(()=>{document.querySelectorAll('video').forEach(v=>v.loop=true);});await button('Draw on scene').click();active=true;await measure('F',short);active=false;await button('Finish drawing').click();await button('Pause video').click();
  for(const [name,interval,smoothing] of [['E-10Hz',100,45],['E-20Hz',50,45],['E-no-smoothing',80,.001],['E-repeat',80,45]]){
   await set({tracking:{enabled:false}});await present.evaluate(({interval,smoothing})=>Object.assign(window.__storyProfile,{interval,smoothing}),{interval,smoothing});await set({tracking:{enabled:true}});await control.getByText('Tracking face',{exact:true}).waitFor({timeout:60000});await measure(name,short);
  }
  await set({enabled:false,tracking:{enabled:false}});await measure('B-after-cleanup',short);
  console.log('COMPLETE');
 }finally{await app.close().catch(()=>{});server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
