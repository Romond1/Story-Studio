const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {_electron}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'studio-wheel-media-')),folder=path.join(temp,'Lesson'),evidence=path.join(root,'output/playwright/wheel-question-media');
 await fs.mkdir(path.join(folder,'assets'),{recursive:true});await fs.mkdir(evidence,{recursive:true});
 execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','testsrc2=s=480x270:r=12','-f','lavfi','-i','sine=frequency=330:sample_rate=48000','-t','6','-af','volume=0.02','-c:v','libvpx','-b:v','180k','-c:a','libvorbis',path.join(folder,'assets/video.webm')]);
 execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','color=c=teal:s=480x270','-frames:v','1',path.join(folder,'assets/picture.png')]);
 execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','6','-af','volume=0.02',path.join(folder,'assets/audio.wav')]);
 const external=path.join(temp,'Imported question picture.png');await fs.copyFile(path.join(folder,'assets/picture.png'),external);
 const {createLesson,insertScene,createScene,addCard}=require('../dist/main/shared/lesson/commands'),{insertBreak}=require('../dist/main/shared/lesson/sections'),{createWheelConfig,addWheelActivity}=require('../dist/main/shared/lesson/spinningWheel');
 let project=insertScene(createLesson('Question media'),'story',createScene('Earlier live scene')).project;
 const b=insertBreak(project,'story');project=b.project;const entry=project.sequences.story.find(e=>e.id===b.entryId);const added=addCard(project,entry.sceneId);project=added.project;const cardId=project.scenes[entry.sceneId].objects.find(o=>o.id===added.objectId).cardId;
 project.cards[cardId].faces[0].text='PUBLIC CARD';project.cards[cardId].faces[1].text='PRIVATE ANSWER';
 project.assets=await Promise.all(['picture','video','audio'].map(async(id)=>{const filename=id==='picture'?'picture.png':id==='video'?'video.webm':'audio.wav';return{id,filename,originalName:filename,relativePath:`assets/${filename}`,mediaType:id==='picture'?'image':id,sizeBytes:(await fs.stat(path.join(folder,'assets',filename))).size,importedAt:new Date().toISOString()};}));
 let config=createWheelConfig();for(const [i,id]of ['picture','video','audio','text'].entries()){config=addWheelActivity(config,'question',i===0?cardId:undefined);config.activities[i].config={label:`Challenge ${i+1}`,prompt:`Question with ${id}`,...(id!=='text'?{mediaAssetId:id}:{})};}
 config.settings={...config.settings,title:'A wheel of discoveries',playCount:4,questionCount:4,sequenceMode:'teacher-selected'};project.scenes[entry.sceneId].breakExperience=config;await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1700,1050));const button=name=>page.getByRole('button',{name,exact:true});
  await button('Adventure').click();await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await button('Open project').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();
  await button('Edit').click();await page.locator(`[data-entry-id="${entry.id}"]`).click();const inspector=page.getByRole('region',{name:'Break Inspector',exact:true});
  await inspector.locator('.wheel-activity').first().locator('summary').first().click();const activity=inspector.locator('.wheel-activity').first();
  assert.ok((await activity.getByLabel('Question media',{exact:true}).innerText()).toLowerCase().includes('picture'));
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},external);
  await activity.getByRole('button',{name:'Import question media',exact:true}).click();
  await activity.getByLabel('Question media',{exact:true}).click();const importedChoice=activity.getByRole('button',{name:/Imported question picture.*Picture/i});await importedChoice.waitFor();assert.equal(await importedChoice.locator('img').count(),1);await importedChoice.click();
  await button('Save').click();await page.getByText('Lesson saved.',{exact:true}).waitFor();
  const saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8')),imported=saved.assets.find(asset=>asset.originalName==='Imported question picture.png')?.id;assert.ok(imported);assert.equal(saved.scenes[entry.sceneId].breakExperience.activities[0].config.mediaAssetId,imported);
  await button('Teach').click();await button('Open Present').click();let present=app.windows().find(w=>w!==page)||await app.waitForEvent('window');present.setDefaultTimeout(15000);present.on('pageerror',e=>errors.push(String(e)));
  await page.emulateMedia({reducedMotion:'reduce'});await present.emulateMedia({reducedMotion:'reduce'});
  const controls=page.getByRole('region',{name:'Spinning Wheel controls',exact:true}),act=name=>controls.getByRole('button',{name,exact:true}).click();await act('Start Game');
  for(let i=0;i<4;i++){
   if(i)await act('Next Activity');await controls.getByLabel('Choose an activity',{exact:true}).selectOption(config.settings.segments[i].id);await act('Spin Wheel');await present.locator('[data-wheel-phase="active"]').waitFor();
   await present.getByText(`Question with ${['picture','video','audio','text'][i]}`,{exact:true}).waitFor();
   if(i===0){await present.locator('.wheel-question-attachment img').waitFor();assert.ok(await present.locator('.wheel-question-attachment img').evaluate(n=>n.complete&&n.naturalWidth>0));await present.getByText('PUBLIC CARD',{exact:true}).waitFor();}
   if(i===1||i===2){await act('Play question media');await present.waitForFunction(()=>{const n=document.querySelector('.wheel-question-attachment video');return n&&n.readyState>0&&!n.paused&&n.currentTime>.15;});assert.equal(await present.locator('.wheel-question-attachment video').evaluate(n=>n.muted),true);
    await act('Pause question media');await present.waitForFunction(()=>document.querySelector('.wheel-question-attachment video')?.paused);const position=await present.locator('.wheel-question-attachment video').evaluate(n=>n.currentTime);assert.ok(position>.1);
    await present.reload();await present.waitForFunction(()=>{const n=document.querySelector('.wheel-question-attachment video');return n&&n.readyState>0&&n.paused;});assert.ok(Math.abs(await present.locator('.wheel-question-attachment video').evaluate(n=>n.currentTime)-position)<.3);
    await act('Restart question media');await present.waitForFunction(()=>{const n=document.querySelector('.wheel-question-attachment video');return n&&!n.paused&&n.currentTime<2;});await act('Pause question media');}
   assert.equal(JSON.stringify(await present.evaluate(()=>window.presentApi.requestSnapshot())).includes('PRIVATE ANSWER'),false);
   await present.screenshot({path:path.join(evidence,`${['card-and-picture','video','audio','text'][i]}-present.png`)});await act('Complete Activity');
  }
  await present.locator('[data-wheel-phase="session-complete"]').waitFor();assert.deepEqual(errors,[]);
  console.log('PASS: question media import/save, optional Card+picture, video, audio and text-only questions, Teach selected Break, synchronized play/pause/restart, muted Present, reload seek and answer privacy.');
 }catch(error){for(const [i,w]of app.windows().entries()){await w.screenshot({path:path.join(evidence,`failure-${i}.png`)});console.error((await w.locator('body').innerText()).slice(-4000));}throw error;}finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
