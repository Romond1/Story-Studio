import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium,_electron}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/user/.codex/skills/develop-web-game/node_modules/playwright');
const {DEFAULT_AUDIO_SETTINGS}=require('../dist-test/shared/audioSettings.js');
let browser;
if(process.env.TEST_ELECTRON){
 const dir=await mkdtemp(join(tmpdir(),'story-timeline-'));
 const main=join(dir,'main.cjs');
 await writeFile(main,"const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1440,height:960,webPreferences:{offscreen:true,backgroundThrottling:false}});w.loadURL('about:blank');});");
 const app=await _electron.launch({executablePath:require('electron'),args:[main]});
 browser={newPage:async({viewport})=>{const page=await app.firstWindow();await page.setViewportSize(viewport);return page;},close:()=>app.close()};
}else browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true});
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
assert.deepEqual(errors,[]);

await page.evaluate(()=>{
 let n=0;
 const imported=()=>({importedAssets:[{id:'pool-audio',filename:'music.mp3',relativePath:'fixture.mp3',originalName:'New audio.mp3',mediaType:'audio',binId:'nested',sizeBytes:1,importedAt:''},{id:'pool-image',filename:'new.png',relativePath:'fixture.svg',originalName:'New picture.png',mediaType:'image',binId:'nested',sizeBytes:1,importedAt:''},{id:'pool-video',filename:'new.webm',relativePath:'fixture.webm',originalName:'New movie.webm',mediaType:'video',binId:'nested',sizeBytes:1,importedAt:''}],createdSlides:[],importedBins:[{id:'episode',name:'Episode folder'},{id:'nested',name:'Part 1',parentId:'episode'}],failures:[]});
 window.appApi.importMediaFolder=async()=>imported();
 window.appApi.getPathForFile=file=>file.name;
 window.appApi.importDroppedMedia=async paths=>{window.dropCalls=(window.dropCalls??[]).concat([paths]);n++;return {importedAssets:[{id:'drop'+n,filename:'drop.png',relativePath:'fixture.svg',originalName:'Dropped '+n+'.png',mediaType:'image',sizeBytes:1,importedAt:''}],createdSlides:[]};};
});
const pool=page.getByRole('region',{name:'Media Pool'});
await pool.getByRole('button',{name:'Import Folder',exact:true}).click();
await page.waitForTimeout(150);
assert.equal(await pool.getByRole('listbox').getByRole('option').count(),5);
await pool.getByRole('button',{name:'Episode folder',exact:true}).click();
await pool.locator('summary').first().click({position:{x:3,y:5}});
await pool.getByRole('button',{name:'All media',exact:true}).click();
await pool.getByRole('textbox',{name:'Search media'}).fill('New picture');
assert.equal(await pool.getByRole('listbox').getByRole('option').count(),1);
await pool.getByRole('textbox',{name:'Search media'}).fill('');
await pool.getByRole('combobox',{name:'Media type'}).selectOption('video');
assert.equal(await pool.getByRole('listbox').getByRole('option').count(),2);
await pool.getByRole('combobox',{name:'Media type'}).selectOption('all');
const options=pool.getByRole('listbox').getByRole('option');
// Real browser drags cover hit testing and dragover acceptance, not just synthetic drop events.
const opening=page.getByRole('region',{name:'Opening',exact:true});
const sourceImage=options.filter({hasText:'New picture'});
const sourceVideo=options.filter({hasText:'New movie'});
async function dragAndUndo(source,target,position,label,expectedOrder){
 await source.dragTo(target,position?{targetPosition:position}:{});
 await page.waitForTimeout(100);
 assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),17,label);
 if(expectedOrder){const names=await opening.locator('[data-slide-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));assert.deepEqual(names,expectedOrder,label+' order');}
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),16);
}
await dragAndUndo(sourceImage,page.getByRole('button',{name:'Insert before Scene 3',exact:true}),undefined,'native slot drop');
await dragAndUndo(sourceImage,page.locator('[data-slide-id="slide1"]'),{x:20,y:35},'image onto timeline item',['Scene 1','New picture',...Array.from({length:7},(_,i)=>`Scene ${i+2}`)]);
await dragAndUndo(sourceVideo,page.locator('[data-slide-id="slide1"]'),{x:130,y:35},'video onto right half',['Scene 1','Scene 2','New movie',...Array.from({length:6},(_,i)=>`Scene ${i+3}`)]);
await dragAndUndo(sourceVideo,opening.locator('.timeline-section-name'),undefined,'video onto section header',[...Array.from({length:8},(_,i)=>`Scene ${i+1}`),'New movie']);
await page.getByRole('button',{name:'Collapse Opening',exact:true}).click();
await sourceImage.dragTo(opening.locator('.timeline-collapsed'));
await page.getByRole('button',{name:'Expand Opening',exact:true}).click();
assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),17,'collapsed section accepts media');
await page.getByRole('button',{name:'Undo',exact:true}).click();
await options.filter({hasText:'New picture'}).click();
await options.filter({hasText:'New movie'}).click({modifiers:['Control']});
const transfer=await page.evaluateHandle(()=>new DataTransfer());
await options.filter({hasText:'New picture'}).dispatchEvent('dragstart',{dataTransfer:transfer});
const slot=page.getByRole('button',{name:'Insert before Scene 3',exact:true});
await slot.dispatchEvent('dragover',{dataTransfer:transfer});assert.ok((await slot.getAttribute('class')).includes('is-drop'));
await slot.dispatchEvent('drop',{dataTransfer:transfer});
await page.waitForTimeout(100);
assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),18);
await page.getByRole('button',{name:'Undo',exact:true}).click();
assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),16);
await page.getByRole('button',{name:'Redo',exact:true}).click();
assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),18);
const order=await page.locator('.timeline-object[data-slide-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
assert.deepEqual(order.slice(1,5),['Scene 2','New picture','New movie','Scene 3']);
await options.filter({hasText:'New audio'}).click();
await pool.getByRole('combobox',{name:'Attach selected audio'}).selectOption('dialogue');
await pool.getByRole('combobox',{name:'Media usage'}).selectOption('unused');
assert.equal(await pool.getByRole('listbox').getByRole('option').count(),0);
await pool.getByRole('combobox',{name:'Media usage'}).selectOption('all');
// Explorer routes use the same injected IPC importer; UI decides whether to place.
const files=await page.evaluateHandle(()=>{const dt=new DataTransfer();dt.items.add(new File(['bytes'],'explorer.png',{type:'image/png'}));return dt;});
await pool.dispatchEvent('drop',{dataTransfer:files});await page.waitForTimeout(100);
assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),18);
await slot.dispatchEvent('drop',{dataTransfer:files});await page.waitForTimeout(100);
assert.equal(await page.locator('.timeline-object[data-slide-id]').count(),19);
assert.equal(await page.evaluate(()=>window.dropCalls.length),2);
// Reorder existing item through the same slot UI.
const move=await page.evaluateHandle(()=>new DataTransfer());
await page.locator('[data-slide-id="slide0"]').dispatchEvent('dragstart',{dataTransfer:move});
await page.getByRole('button',{name:'Insert before Scene 4',exact:true}).dispatchEvent('drop',{dataTransfer:move});
assert.equal((await page.locator('.timeline-object[data-slide-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-slide-id'))))[0],'slide1');
// Structure and collapse remain one row.
await page.getByRole('button',{name:'+ Section',exact:true}).click();
await page.getByRole('button',{name:'+ Break',exact:true}).click();
await page.getByRole('button',{name:'+ Lesson area',exact:true}).click();
await page.getByRole('button',{name:'Collapse Opening',exact:true}).click();
assert.ok(await page.locator('.timeline-collapsed').isVisible());
await page.getByRole('button',{name:'Expand Opening',exact:true}).click();
const rows=await page.locator('.timeline-object').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().top)));
assert.equal(new Set(rows).size,1);
await page.locator('[data-slide-id="slide15"]').click();
const transport=page.getByRole('group',{name:'Edit video playback'});
const toolbarBox=await page.locator('.timeline-toolbar').boundingBox();
const transportBox=await transport.boundingBox();
assert.ok(transportBox.y>=toolbarBox.y&&transportBox.y+transportBox.height<=toolbarBox.y+toolbarBox.height,'transport fits within the existing timeline toolbar');
const stopsBeforePreview=await page.evaluate(()=>window.audioStops.slice());
await transport.getByRole('button',{name:'▶ Play',exact:true}).click({timeout:3000});
await page.waitForTimeout(350);
const previewVideo=page.locator('video.media-content');
assert.ok(await previewVideo.evaluate(v=>!v.paused&&v.currentTime>0),'Edit preview plays');
assert.ok(Number(await transport.getByRole('slider').inputValue())>0,'playhead advances');
await transport.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
assert.ok(await previewVideo.evaluate(v=>v.paused));
await transport.getByRole('slider').fill('0.8');
await page.waitForTimeout(100);
const seekState=await previewVideo.evaluate(v=>({time:v.currentTime,duration:v.duration,paused:v.paused,seekable:Array.from({length:v.seekable.length},(_,i)=>[v.seekable.start(i),v.seekable.end(i)])}));
assert.ok(Math.abs(seekState.time-.8)<.05,`playhead seeks the selected preview: ${JSON.stringify(seekState)}`);
await page.screenshot({path:'docs/media-pool-evidence/video-transport.png',fullPage:true});
await transport.getByRole('button',{name:'■ Stop',exact:true}).click();
assert.ok(await previewVideo.evaluate(v=>v.paused&&v.currentTime<0.05),'Stop resets preview');
assert.equal(await page.evaluate(()=>window.lastSnapshot.target.occurrenceId),live15);
assert.deepEqual(await page.evaluate(()=>window.audioStops),stopsBeforePreview,'local transport never stops Live audio');
await page.getByRole('slider',{name:'Timeline zoom'}).fill('2.4');
await page.locator('[data-slide-id="slide15"]').scrollIntoViewIfNeeded();
const frameVideo=page.locator('[data-slide-id="slide15"] .timeline-preview video');
await frameVideo.waitFor({state:'attached'});
await page.waitForTimeout(200);
assert.ok(await frameVideo.evaluate(v=>v.readyState>=2&&v.paused&&v.muted&&v.getBoundingClientRect().height>=50),'video frame stays visible and passive');
await page.locator('[data-slide-id="slide1"]').click();
assert.ok(await transport.getByRole('button',{name:'▶ Play',exact:true}).isDisabled());
await page.getByRole('slider',{name:'Timeline zoom'}).fill('2.4');
await page.waitForTimeout(150);
assert.equal(await page.locator('.lesson-timeline').getAttribute('data-density'),'frame');
await page.locator('[data-slide-id="slide1"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
const frameImage=await page.locator('[data-slide-id="slide1"] .timeline-preview img').evaluateAll(nodes=>nodes.map(n=>({loaded:n.naturalWidth>0,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,host:n.closest('.timeline-preview').getBoundingClientRect().toJSON()})));
assert.ok(frameImage.some(n=>n.loaded&&n.width>30&&n.height>=50&&n.host.height>=50),`Frame thumbnail remains visible: ${JSON.stringify(frameImage)}`);
await page.getByRole('separator',{name:'Lesson timeline height'}).press('End');
// Test pointer anchoring against a visible object's fractional position.
await page.locator('.timeline-strip').evaluate(node=>node.scrollLeft=450);
const anchorBox=await page.locator('.timeline-strip').boundingBox();
const px=anchorBox.x+Math.min(300,anchorBox.width/2),py=anchorBox.y+65;
const point=()=>page.evaluate(({x,y})=>{const n=document.elementFromPoint(x,y)?.closest('[data-timeline-anchor]');if(!n)return null;const r=n.getBoundingClientRect();return {id:n.dataset.timelineAnchor,fraction:(x-r.left)/r.width};},{x:px,y:py});
const before=await point();
await page.mouse.move(px,py);await page.keyboard.down('Alt');await page.mouse.wheel(0,-60);await page.keyboard.up('Alt');await page.waitForTimeout(120);
const after=await point();
assert.ok(before&&after,'pointer is over a timeline object');
if(before&&after){assert.equal(after.id,before.id);assert.ok(Math.abs(after.fraction-before.fraction)<.03);}
const panBefore=await page.locator('.timeline-strip').evaluate(n=>n.scrollLeft);
await page.mouse.move(px,py);await page.mouse.down({button:'middle'});await page.mouse.move(px-90,py,{steps:5});await page.mouse.up({button:'middle'});
assert.ok(await page.locator('.timeline-strip').evaluate(n=>n.scrollLeft)>panBefore+60);
await page.locator('.timeline-strip').evaluate(n=>n.scrollLeft=0);
await page.getByRole('button',{name:'Scene 2',exact:true}).click();
await mkdir('docs/media-pool-evidence',{recursive:true});
await page.screenshot({path:'docs/media-pool-evidence/desktop.png',fullPage:true});
await page.getByRole('slider',{name:'Timeline zoom'}).fill('0.5');
await page.screenshot({path:'docs/media-pool-evidence/overview.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'docs/media-pool-evidence/narrow.png',fullPage:true});
await page.setViewportSize({width:1440,height:960});
await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).last().click();await page.waitForTimeout(100);
const poolSaved=await page.evaluate(()=>window.savedProject);
assert.equal(poolSaved.mediaBins.length,2);assert.equal(poolSaved.assets.length,7);assert.equal(poolSaved.slides.length,19);
assert.equal(await page.evaluate(()=>window.lastSnapshot.target.occurrenceId),live15);
assert.deepEqual(errors,[]);
console.log('PASS: Pool import/filter/multi-drag, Explorer routes, reorder, structures, zoom/pan, passive frames, save and LIVE independence');

} finally {await browser.close();}
