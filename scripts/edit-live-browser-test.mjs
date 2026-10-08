import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/user/.codex/skills/develop-web-game/node_modules/playwright');
const {DEFAULT_AUDIO_SETTINGS}=require('../dist-test/shared/audioSettings.js');
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
// A real, locally generated video verifies Edit decoding without a Present renderer.
const videoBytes=await page.evaluate(async()=>{
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
 const stream=canvas.captureStream(20);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];
 recorder.ondataavailable=event=>chunks.push(event.data);
 const finished=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
 for(let i=0;i<25;i++){const context=canvas.getContext('2d');context.fillStyle=i%2?'#487b79':'#f4c578';context.fillRect(0,0,160,90);await new Promise(resolve=>setTimeout(resolve,50));}
 recorder.stop();await finished;stream.getTracks().forEach(track=>track.stop());
 return Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()));
});
await page.route('**/fixture.webm*',route=>route.fulfill({contentType:'video/webm',body:Buffer.from(videoBytes)}));
await page.addInitScript(({audio})=>{
 const sections=[{id:'s1',name:'Opening',type:'section'},{id:'break',name:'Stretch break',type:'break',questions:'Take a stretch',timer:true,timerDuration:60,breakMedia:[{id:'bm',slideId:'slide0',fit:'contain',x:0,y:0,scale:1}]},{id:'s2',name:'Adventure',type:'section'}];
 const data={version:1,createdAt:'2026-10-06',updatedAt:'2026-10-06',sections,slides:Array.from({length:16},(_,i)=>({id:`slide${i}`,assetId:i===15?'video':'image',sectionId:i<8?'s1':'s2',name:`Scene ${i+1}`,transition:'fade',tags:[]})),assets:[{id:'image',relativePath:'fixture.svg',filename:'fixture.svg',originalName:'Landscape',mediaType:'image',sizeBytes:1,importedAt:'2026-10-06'},{id:'video',relativePath:'fixture.webm',filename:'fixture.webm',originalName:'Video',mediaType:'video',sizeBytes:1,importedAt:'2026-10-06'}]};
 const project={activationToken:'fixture',folderPath:'C:/fixture',data};
 window.appApi=new Proxy({publishPresentSnapshot:async s=>{window.lastSnapshot=s;},onPresentMediaRuntime:callback=>{window.emitPresentRuntime=callback;return ()=>{};},onPresentStatus:callback=>{window.emitPresentStatus=callback;return ()=>{};},openProject:async()=>({...project,data:window.savedProject||project.data}),getAudioSettings:async()=>audio,saveAudioSettings:async s=>s,getStudentRoster:async()=>({version:1,students:[]}),getPresentStatus:async()=>({state:'closed',generation:0,sequence:0,needsReshare:false}),getPresentMediaRuntime:async()=>({generation:0,available:false}),saveProject:async(data)=>{window.savedProject=data;return {folderPath:'C:/fixture',lastSavedAt:new Date().toISOString()}}},{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>null});
},{audio:DEFAULT_AUDIO_SETTINGS});
await page.route('**/fixture.svg*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#263e53"/><circle cx="850" cy="200" r="100" fill="#f4c578"/><path d="M0 700L400 220L800 700L1050 330L1280 720" fill="#487b79"/></svg>'}));
await page.goto(process.env.STORY_STUDIO_URL || 'http://localhost:5173');
await page.getByRole('button',{name:'Open Project',exact:true}).click();
await page.waitForTimeout(500);

await page.getByRole('navigation',{name:'Live presentation navigation'}).getByRole('button',{name:/Scene 12/}).click();
await page.waitForTimeout(100);
const live12=await page.evaluate(()=>window.lastSnapshot.target.occurrenceId);
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
await page.evaluate(async()=>{
 const {audioManager}=await import('/src/renderer/audio/AudioManager.ts');window.audioStops=[];
 for(const key of ['stopSlideAudio','stopSectionMusic']) {const original=audioManager[key].bind(audioManager);audioManager[key]=(...args)=>{window.audioStops.push(key);return original(...args);};}
});
await page.getByRole('navigation',{name:'Edit lesson timeline'}).getByRole('button',{name:'Scene 15',exact:true}).click();
await page.waitForTimeout(150);
assert.equal(await page.evaluate(()=>window.lastSnapshot.target.occurrenceId),live12);
assert.deepEqual(await page.evaluate(()=>window.audioStops),[]);
await page.getByPlaceholder('Add tag and press Enter').fill('independent-edit');
await page.getByPlaceholder('Add tag and press Enter').press('Enter');
await page.getByRole('button',{name:'Show in Present',exact:true}).click();
await page.waitForTimeout(150);
const live15=await page.evaluate(()=>window.lastSnapshot.target.occurrenceId);
assert.notEqual(live15,live12);assert.ok(live15.includes('slide14'));
await page.getByRole('navigation',{name:'Edit lesson timeline'}).getByRole('button',{name:'Opening',exact:true}).click();
await page.waitForTimeout(150);
assert.equal(await page.evaluate(()=>window.lastSnapshot.target.occurrenceId),live15);
await page.getByRole('button',{name:'Save',exact:true}).click();
await page.waitForTimeout(200);
await page.getByRole('button',{name:'Save',exact:true}).last().click();
await page.waitForTimeout(200);
const saved=await page.evaluate(()=>window.savedProject);
assert.ok(saved.slides[14].tags.includes('independent-edit'));
assert.ok(!saved.slides[11].tags.includes('independent-edit'));
assert.equal('editSelection' in saved,false);
await page.getByRole('button',{name:'Edit',exact:true}).click();
assert.ok(await page.getByRole('navigation',{name:'Live presentation navigation'}).getByRole('button',{name:/Scene 15/}).getAttribute('aria-current'));
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
assert.equal(await page.locator('[data-slide-id="slide0"]').getAttribute('aria-current'),'step');
assert.equal(await page.evaluate(()=>window.lastSnapshot.target.occurrenceId),live15);
// Live video intent survives Edit entry and another authored selection.
await page.getByRole('button',{name:'Edit',exact:true}).click();
await page.evaluate(()=>window.emitPresentRuntime({generation:1,available:true}));
await page.getByRole('navigation',{name:'Live presentation navigation'}).getByRole('button',{name:/Scene 16/}).click();
await page.waitForTimeout(100);
const mediaBefore=await page.evaluate(()=>window.lastSnapshot.target.media);
assert.ok(mediaBefore?.identity.includes('slide15'));
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
await page.getByRole('button',{name:'Scene 3',exact:true}).click();
await page.waitForTimeout(100);
assert.deepEqual(await page.evaluate(()=>window.lastSnapshot.target.media),mediaBefore);
assert.deepEqual(errors,[]);
console.log('PASS: mounted Edit/Live independence, explicit presentation, audio stops, authored target and save');
} finally {await browser.close();}
