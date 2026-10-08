import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
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
 window.appApi=new Proxy({onPresentMediaRuntime:callback=>{window.emitPresentRuntime=callback;return ()=>{};},onPresentStatus:callback=>{window.emitPresentStatus=callback;return ()=>{};},openProject:async()=>project,getAudioSettings:async()=>audio,saveAudioSettings:async s=>s,getStudentRoster:async()=>({version:1,students:[]}),getPresentStatus:async()=>({state:'closed',generation:0,sequence:0,needsReshare:false}),getPresentMediaRuntime:async()=>({generation:0,available:false}),saveProject:async(data)=>{window.savedProject=data;return {folderPath:'C:/fixture',lastSavedAt:new Date().toISOString()}}},{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>null});
},{audio:DEFAULT_AUDIO_SETTINGS});
await page.route('**/fixture.svg*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#263e53"/><circle cx="850" cy="200" r="100" fill="#f4c578"/><path d="M0 700L400 220L800 700L1050 330L1280 720" fill="#487b79"/></svg>'}));
await page.goto(process.env.STORY_STUDIO_URL || 'http://localhost:5173');
await page.getByRole('button',{name:'Open Project',exact:true}).click();
await page.waitForTimeout(500);
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
await page.waitForTimeout(300);
// Resizing must work in both modes while packing more slides into the available width.
const timelineHeight = () => page.locator('.teach-navigator').evaluate(node => node.getBoundingClientRect().height);
const dragTimeline = async (delta) => {
 const handle = await page.getByRole('separator', {name:'Lesson timeline height'}).boundingBox();
 await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
 await page.mouse.down();
 await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - delta, {steps:5});
 await page.mouse.up();
};
const initialEditHeight = await timelineHeight();
const initialStripWidth = await page.locator('.teach-nav-strip').evaluate(node => node.scrollWidth);
await dragTimeline(160);
assert.ok(Math.abs(await timelineHeight() - initialEditHeight - 160) < 2);
await page.getByRole('button',{name:'Edit',exact:true}).click();
const initialTeachHeight = await timelineHeight();
await dragTimeline(128);
assert.ok(Math.abs(await timelineHeight() - initialTeachHeight - 128) < 2);
await page.getByRole('separator',{name:'Lesson timeline height'}).press('ArrowUp');
assert.ok(Math.abs(await timelineHeight() - initialTeachHeight - 160) < 2);
await page.screenshot({path:'docs/edit-workspace-evidence/expanded-teach.png',fullPage:true});
assert.ok(Number(await page.locator('.teach-navigator').getAttribute('data-rows')) >= 2);
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
assert.ok(Math.abs(await timelineHeight() - initialEditHeight - 160) < 2);
const resizedRows = await page.locator('.teach-nav-item').evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().top)));
assert.ok(new Set(resizedRows).size >= 2);
assert.ok(await page.locator('.teach-nav-strip').evaluate(node => node.scrollWidth) < initialStripWidth);
const positions = await page.getByRole('group',{name:'Opening',exact:true}).locator('.teach-nav-item').evaluateAll(items => items.map(item => ({x:item.getBoundingClientRect().left,y:item.getBoundingClientRect().top})));
for(let i=1;i<positions.length;i++) assert.ok(positions[i].y > positions[i-1].y || (positions[i].y === positions[i-1].y && positions[i].x > positions[i-1].x));
await page.screenshot({path:'docs/edit-workspace-evidence/expanded-edit.png',fullPage:true});
assert.equal(await page.evaluate(()=>Number(localStorage.getItem('story-studio.edit-navigator-height'))), initialEditHeight + 160);
await page.getByRole('separator',{name:'Lesson timeline height'}).press('Home');

// Exercise actual component wiring against a synthetic project and IPC boundary.
await page.getByPlaceholder('Add tag and press Enter').fill('workspace-test');
await page.getByPlaceholder('Add tag and press Enter').press('Enter');
await page.getByRole('tab',{name:'Presentation',exact:true}).click();
await page.locator('.edit-inspector .stage-controls select').first().selectOption('crossfade');
await page.getByRole('button',{name:'Apply to Slide',exact:true}).click();
await page.getByRole('button',{name:'Bubbles',exact:true}).click();
await page.getByRole('button',{name:'+ Add',exact:true}).click();
await page.locator('.bubble-stage-select').first().click();
await page.screenshot({path:'docs/edit-workspace-evidence/presentation.png',fullPage:true});
await page.getByRole('tab',{name:'Content',exact:true}).click();
const bubblePanel=page.getByLabel('Selected bubble settings',{exact:true});
assert.ok(await bubblePanel.isVisible());
assert.ok((await bubblePanel.boundingBox()).width <= 520);
await bubblePanel.getByLabel('Font Size',{exact:true}).fill('32');
assert.equal(await bubblePanel.locator('details[open]').count(),0);
await bubblePanel.getByText('Tags & text area',{exact:true}).click();
await bubblePanel.getByLabel('TextRect x',{exact:true}).fill('0.2');
await bubblePanel.getByText('Tags & text area',{exact:true}).click();
await page.screenshot({path:'docs/edit-workspace-evidence/bubble-inspector.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await bubblePanel.scrollIntoViewIfNeeded();
assert.ok((await bubblePanel.boundingBox()).width < 390);
await page.screenshot({path:'docs/edit-workspace-evidence/bubble-narrow.png',fullPage:true});
await page.setViewportSize({width:1440,height:960});

await page.getByRole('tab',{name:'Audio',exact:true}).click();
assert.ok(await page.getByText('Slide Audio',{exact:true}).isVisible());
assert.ok(await page.getByRole('heading',{name:/Section Music/}).isVisible());
await page.getByRole('tab',{name:'Content',exact:true}).click();
const rows=await page.locator('.teach-nav-item').evaluateAll(items=>items.map(item=>item.getBoundingClientRect().top));
assert.equal(new Set(rows.map(Math.round)).size,1);
const geometry=await page.locator('[data-preview-viewport]').boundingBox();
assert.ok(Math.abs(geometry.width/geometry.height-1280/720)<.01);
await page.getByRole('button',{name:'Focus canvas',exact:true}).click();
assert.ok((await page.locator('[data-preview-viewport]').boundingBox()).width>=geometry.width);
await page.getByRole('button',{name:'Show inspector',exact:true}).click();
await page.getByLabel('Jump to section').selectOption('break');
assert.ok(await page.getByText('Break Editor',{exact:true}).isVisible());
assert.equal(await page.getByRole('tab',{name:'Presentation',exact:true}).count(),0);
const thumb=page.locator('.break-stage-thumb');
const before=await thumb.boundingBox();
await page.mouse.move(before.x+20,before.y+20);await page.mouse.down();await page.mouse.move(before.x+80,before.y+50,{steps:5});await page.mouse.up();
const after=await thumb.boundingBox();assert.ok(Math.abs(after.x-before.x-60)<2);assert.ok(Math.abs(after.y-before.y-30)<2);
await page.screenshot({path:'docs/edit-workspace-evidence/break.png',fullPage:true});
await page.getByRole('tab',{name:'Lesson tools',exact:true}).click();
for(const name of ['Boosters','boards','movement','Badges','relics']) {
 await page.getByRole('button',{name,exact:true}).click();
 assert.ok(await page.locator('.edit-inspector .sidebar').isVisible());
}
await page.getByRole('button',{name:'Sections / structure',exact:true}).click();
await page.getByLabel('Jump to section').selectOption('s1');
await page.getByRole('tab',{name:'Content',exact:true}).click();
await page.getByLabel('Jump to section').selectOption('s2');
await page.getByRole('button',{name:/^Scene 16/}).click();
assert.equal(await page.getByRole('button',{name:'Present (preview)',exact:true}).count(),0);
assert.ok(await page.locator('.media video').getAttribute('src'));
assert.equal(await page.locator('.media video').evaluate(video=>video.srcObject),null);
await page.locator('.media video').evaluate(async video=>{video.currentTime=0;await video.play();});
await page.waitForFunction(()=>document.querySelector('.media video')?.currentTime>.2);
await page.evaluate(()=>{window.emitPresentRuntime({generation:2,available:false});window.emitPresentStatus({state:'closed',generation:2,sequence:1,needsReshare:false});});
await page.locator('.media video').evaluate(async video=>{video.currentTime=0;await video.play();});
await page.waitForFunction(()=>document.querySelector('.media video')?.currentTime>.2);
await page.getByRole('button',{name:'Edit',exact:true}).click();
assert.equal(await page.locator('.media video').getAttribute('src'),null);
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
assert.ok(await page.locator('.media video').getAttribute('src'));
await page.locator('.media video').evaluate(async video=>{video.currentTime=0;await video.play();});
await page.waitForFunction(()=>document.querySelector('.media video')?.currentTime>.2);

// Synthetic metadata isolates trim handle wiring from Electron's separate decoder.
await page.locator('.media video').evaluate(video=>{Object.defineProperty(video,'duration',{value:10,configurable:true});video.dispatchEvent(new Event('loadedmetadata',{bubbles:true}));});
const trim=page.getByRole('button',{name:'Video trim in point'});
const handle=await trim.boundingBox();
await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+80,handle.y+handle.height/2,{steps:5});await page.mouse.up();
await page.screenshot({path:'docs/edit-workspace-evidence/video.png',fullPage:true});
await page.getByLabel('Jump to section').selectOption('s1');
await page.getByRole('button',{name:'Save',exact:true}).click();
const saveChoices=page.getByRole('button',{name:'Save',exact:true});
if(await saveChoices.count()>1) await saveChoices.last().click();
await page.waitForFunction(()=>window.savedProject);
const saved=await page.evaluate(()=>window.savedProject);
assert.ok(saved.slides[0].tags.includes('workspace-test'));
assert.equal(saved.slides[0].transition,'crossfade');
assert.equal(saved.slides.length,16);assert.equal(saved.slides[0].overlays.length,1);assert.equal(saved.slides[0].overlays[0].fontSize,32);assert.equal(saved.slides[0].overlays[0].textRect.x,.2);assert.ok(saved.slides[15].videoTrim.inSec>0);
await page.getByRole('button',{name:'Edit',exact:true}).click();
assert.ok(await page.getByRole('navigation',{name:'Live presentation navigation'}).isVisible());
await page.getByRole('button',{name:'Switch to Edit',exact:true}).click();
await page.waitForTimeout(350);

await page.screenshot({path:'docs/edit-workspace-evidence/desktop.png',fullPage:true});
await page.getByRole('button',{name:'Legacy layout',exact:true}).click();
assert.ok(await page.locator('.content > .sidebar').isVisible());
await page.getByRole('button',{name:'Modern workspace',exact:true}).click();
assert.ok(await page.getByRole('tab',{name:'Content',exact:true}).isVisible());
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'docs/edit-workspace-evidence/narrow.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
console.log({errors,overflow,rows:rows.length,geometry,savedTags:saved.slides[0].tags});
assert.deepEqual(errors,[]);

await writeFile('docs/edit-workspace-evidence/initial.json',JSON.stringify({errors,overflow,timelineItems:rows.length,geometry,savedTags:saved.slides[0].tags,transition:saved.slides[0].transition,bubbles:saved.slides[0].overlays.length,trim:saved.slides[15].videoTrim,breakDrag:{dx:after.x-before.x,dy:after.y-before.y}},null,2));
} finally { await browser.close(); }









