const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { _electron } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
 const root=path.resolve(__dirname,'..'), temp=await fs.mkdtemp(path.join(os.tmpdir(),'studio-density-')), folder=path.join(temp,'Lesson'), evidence=path.join(root,'output/playwright/timeline-pool-density');
 await fs.mkdir(path.join(folder,'assets'),{recursive:true});await fs.mkdir(evidence,{recursive:true});
 execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','testsrc2=s=640x360:r=12','-t','2','-c:v','libvpx',path.join(folder,'assets/video.webm')]);
 execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','color=c=blue:s=640x360','-frames:v','1',path.join(folder,'assets/image.png')]);
 const c=require('../dist/main/shared/lesson/commands');let project=c.createLesson('Timeline density');
 project.assets=['image','video'].map(id=>({id, filename:id==='image'?'image.png':'video.webm',originalName:id==='image'?'Four_characters_exploring_volcano_2K_20261008160704.png':'Forest_walk_1080p.webm',relativePath:`assets/${id==='image'?'image.png':'video.webm'}`,mediaType:id,sizeBytes:1,importedAt:''}));
 for(const asset of project.assets) { const scene=c.createScene(asset.originalName,asset.id);if(asset.mediaType==='video')scene.background.videoTrim={inSec:.5,outSec:1.5};project=c.insertScene(project,'story',scene).project; }
 await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
 try {
 const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());
 const resize=async(w,h)=>{await app.evaluate(({BrowserWindow},s)=>{const win=BrowserWindow.getAllWindows()[0];win.setMinimumSize(320,400);win.setSize(...s)},[w,h]);await page.waitForTimeout(250)};
 const button=n=>page.getByRole('button',{name:n,exact:true});
 await resize(1920,1080);await button('Adventure').click();await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]})},folder);await button('Open project').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();await button('Edit').click();
 const items=page.locator('.lesson-timeline-item');
 const geometry=()=>items.evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,thumb:n.querySelector('.lesson-timeline-thumb').getBoundingClientRect().height})));
 for(const z of ['1','0.8','1.25']) {
 await page.getByRole('slider',{name:'Timeline zoom',exact:true}).fill(z);
 await items.nth(0).click();await page.waitForTimeout(200);const before=await geometry();
 await items.nth(1).click();await page.waitForTimeout(200);assert.deepEqual(await geometry(),before);
 assert.equal(await page.getByLabel('Selected scene name').textContent(),'Forest Walk');
 await items.nth(0).click();assert.equal(await page.getByLabel('Selected scene name').textContent(),'Four Characters Exploring Volcano');
 assert.equal(await items.nth(0).locator('strong').evaluate(n=>getComputedStyle(n).webkitLineClamp),'2');
 }
 console.log('PASS stable image/video timeline geometry and readable titles at 80%, 100%, 125%');
 assert.equal(await items.nth(0).locator('.lesson-media-type').textContent(),'PIC');assert.equal(await items.nth(1).locator('.lesson-media-type').textContent(),'VID');
 const timelineThumb=items.nth(1).locator('.lesson-timeline-thumb'), timelineVideo=timelineThumb.locator('video');
 await timelineVideo.evaluate(v=>new Promise(resolve=>{if(v.readyState>=1)resolve();else v.addEventListener('loadedmetadata',resolve,{once:true})}));
 const tr=await timelineThumb.boundingBox();await page.mouse.move(tr.x+tr.width*.2,tr.y+tr.height/2);
 await page.waitForFunction(()=>document.querySelectorAll('.lesson-timeline-thumb video')[0].currentTime>.6);const initialFrame=await timelineVideo.evaluate(v=>v.currentTime);
 await page.mouse.move(tr.x+tr.width*.8,tr.y+tr.height/2);await page.waitForFunction(()=>document.querySelectorAll('.lesson-timeline-thumb video')[0].currentTime>1.2);const laterFrame=await timelineVideo.evaluate(v=>v.currentTime);assert.ok(laterFrame>initialFrame&&initialFrame>=.5&&laterFrame<=1.5);
 await page.waitForTimeout(200);assert.equal(await timelineVideo.evaluate(v=>v.currentTime),laterFrame);assert.equal(await timelineVideo.evaluate(v=>v.paused&&v.muted),true);
 assert.equal(await items.nth(0).getAttribute('aria-current'),'step');
 await page.mouse.move(tr.x+tr.width*.1,tr.y+tr.height/2);await page.waitForFunction(()=>document.querySelectorAll('.lesson-timeline-thumb video')[0].currentTime<.7);
 await page.mouse.move(900,100);await page.screenshot({path:path.join(evidence,'timeline-hover.png')});
 console.log('PASS timeline PIC/VID badges, forward/backward silent paused scrubbing and unchanged selected scene');

 const pool=page.getByRole('region',{name:'Media Pool',exact:true});const zoom=pool.getByRole('slider',{name:'Media Pool zoom',exact:true});
 const card=pool.locator('[data-asset-id="image"]');const size=()=>card.evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n.querySelector('.media-pool-title')).fontSize)}));
 const thumb=card.locator('.media-pool-thumbnail');
 await thumb.hover();await page.locator('.media-pool-hover-preview').waitFor();await page.screenshot({path:path.join(evidence,'image-hover.png')});
 const hover=await page.locator('.media-pool-hover-preview').boundingBox(), original=await thumb.boundingBox();assert.ok(Math.abs(hover.width-original.width*2.5)<1);const ratio=await thumb.locator('img').evaluate(n=>n.naturalWidth/n.naturalHeight);assert.ok(Math.abs(hover.height-hover.width/ratio)<1);assert.ok(hover.height<original.height*2.5);assert.equal(await page.locator('.media-pool-hover-preview').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.mouse.move(900,100);await page.locator('.media-pool-hover-preview').waitFor({state:'detached'});
 const videoThumb=pool.locator('[data-asset-id="video"] .media-pool-thumbnail'), decoder=videoThumb.locator('video');
 await decoder.evaluate(v=>new Promise(resolve=>{if(v.readyState>=1)resolve();else v.addEventListener('loadedmetadata',resolve,{once:true})}));
 const rect=await videoThumb.boundingBox();await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height/2);
 await page.waitForFunction(()=>{const v=document.querySelector('[data-asset-id="video"] video');return Math.abs(v.currentTime-v.duration*.2)<.15});const early=await decoder.evaluate(v=>v.currentTime);
 await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height/2);await page.waitForFunction(()=>{const v=document.querySelector('[data-asset-id="video"] video');return v.currentTime>v.duration*.7});
 const late=await decoder.evaluate(v=>v.currentTime);assert.ok(late>early);await page.waitForTimeout(250);assert.equal(await decoder.evaluate(v=>v.currentTime),late);assert.equal(await decoder.evaluate(v=>v.paused&&v.muted),true);
 await page.mouse.move(900,100);console.log('PASS 2.5x image hover, dismissal, paused positional video scrub and stationary frame');
 const before=await size();await zoom.fill('1.5');const bigger=await size();await page.screenshot({path:path.join(evidence,'zoom-150.png')});assert.ok(bigger.width>before.width*1.45&&bigger.height>before.height*1.45&&bigger.font>before.font);
 await card.hover();await page.keyboard.down('Alt');await page.mouse.wheel(0,100);await page.keyboard.up('Alt');await page.waitForTimeout(120);assert.equal(await zoom.inputValue(),'1.45');
 await page.mouse.wheel(0,100);await page.waitForTimeout(100);assert.equal(await zoom.inputValue(),'1.45');
 await zoom.fill('0.4');const smallest=await size();assert.ok(smallest.width<before.width*.45&&smallest.height<before.height*.45&&smallest.font<before.font*.45);await card.hover();await page.keyboard.down('Alt');await page.mouse.wheel(0,100);await page.keyboard.up('Alt');await page.waitForTimeout(100);assert.equal(await zoom.inputValue(),'0.4');await page.screenshot({path:path.join(evidence,'zoom-40.png')});await zoom.fill('1');await card.click();assert.equal(await page.locator('.media-asset-preview').evaluate(n=>getComputedStyle(n,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await page.locator('.media-asset-preview').getByRole('button',{name:'Add to Sequence',exact:true}).count(),0);assert.equal(await button('Rename').count(),1);await page.keyboard.press('Escape');
 assert.equal(await pool.getByRole('button',{name:/Add .*sequence/i}).count(),0);
 await card.click({button:'right'});assert.equal(await page.getByRole('menuitem',{name:'Add to Sequence',exact:true}).count(),1);await page.keyboard.press('Escape');
 const count=await items.count();await card.dragTo(page.locator('.lesson-section-add').first());await page.waitForTimeout(200);assert.equal(await items.count(),count+1);
 assert.ok(await pool.locator('.lesson-panel-heading').evaluate(n=>n.getBoundingClientRect().height)<=36);
 console.log('PASS pool zoom, Alt wheel, normal wheel, compact heading, removed buttons, context menu and drag to sequence');
 await page.screenshot({path:path.join(evidence,'desktop.png')});await resize(700,900);await page.screenshot({path:path.join(evidence,'narrow.png')});
 await zoom.fill('1.8');assert.ok(await pool.locator('.lesson-pool-assets').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 console.log('PASS narrow pool at maximum zoom');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
