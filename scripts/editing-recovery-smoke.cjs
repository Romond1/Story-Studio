const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {_electron}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'studio-edit-safety-')),folder=path.join(temp,'Lesson'),evidence=path.join(root,'output/playwright/editing-recovery');await fs.mkdir(folder,{recursive:true});await fs.mkdir(evidence,{recursive:true});
 const c=require('../dist/main/shared/lesson/commands'),s=require('../dist/main/shared/lesson/sections');
 const a=s.addSection(c.createLesson('Safety project'),'story','Section 1'),b=s.addSection(a.project,'story','Section 2');
 let project=s.insertSectionMedia(b.project,'story',[],a.sectionId).project;project=s.insertSectionMedia(project,'story',[],b.sectionId).project;
 const pause=s.insertBreak(project,'story',undefined,a.sectionId);project=pause.project;await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(project));
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
 try{
 const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.evaluate(()=>{const original=window.setInterval.bind(window);window.setInterval=(fn,delay,...args)=>{if(delay===120000){window.__runAutosave=()=>fn(...args);window.__autosaveInterval=delay;}return original(fn,delay,...args)}});
 const win=await app.browserWindow(page);await win.evaluate(w=>w.setSize(1920,1080));const button=name=>page.getByRole('button',{name,exact:true});
 await button('Adventure').click();await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]})},folder);await button('Open project').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();await button('Edit').click();
 const breaks=()=>page.locator('.lesson-break-container');await breaks().first().locator('.lesson-timeline-item').click({button:'right'});await page.getByRole('menuitem',{name:'Duplicate Break',exact:true}).click();assert.equal(await breaks().count(),2);
 const dragHandle=breaks().nth(1).getByRole('button',{name:'Move break',exact:true}),box=await dragHandle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2,{steps:4});
 const slot=await page.getByRole('separator',{name:'Insert break before Section 1',exact:true}).boundingBox();await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2,{steps:15});await page.mouse.up();

 assert.equal(await page.locator('.lesson-section-container').first().getAttribute('data-group-kind'),'break');
 const movedId=await page.locator('.lesson-section-container').first().locator('[data-entry-id]').getAttribute('data-entry-id');
 await button('Undo').click();assert.equal(await page.locator('.lesson-section-container').first().getAttribute('data-group-kind'),'section');await button('Redo').click();assert.equal(await page.locator('.lesson-section-container').first().locator('[data-entry-id]').getAttribute('data-entry-id'),movedId);
 await page.locator(`[data-entry-id="${movedId}"]`).click({button:'right'});await page.getByRole('menuitem',{name:'Add linked copy to Discovery',exact:true}).click();assert.equal(await page.getByRole('navigation',{name:'Adventure timeline',exact:true}).count(),1);
 await button('Undo').click();assert.equal(await breaks().count(),2);assert.equal(await page.locator('.lesson-section-container[data-group-kind=section]').count(),2);assert.ok(await page.locator('.lesson-canvas .lesson-scene-surface').count());await button('Redo').click();
 console.log('PASS actual break handle/drop, move undo/redo and Discovery link without losing source view');
 const title=page.getByLabel('Lesson title',{exact:true});await title.fill('Autosaved work');await title.press('Tab');
 assert.equal(JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8')).title,'Safety project');
 await app.evaluate(({ipcMain})=>{const original=ipcMain._invokeHandlers.get('lesson:autosave');globalThis.__autosaveOriginal=original;ipcMain.removeHandler('lesson:autosave');ipcMain.handle('lesson:autosave',async(event,...args)=>{globalThis.__autosaveEntered=true;await new Promise(resolve=>globalThis.__releaseAutosave=resolve);return original(event,...args)})});
 assert.equal(await page.evaluate(()=>window.__autosaveInterval),120000);await page.evaluate(()=>window.__runAutosave());for(let n=0;n<50&&!(await app.evaluate(()=>globalThis.__autosaveEntered));n++)await new Promise(r=>setTimeout(r,20));await title.fill('Edited during autosave');await title.press('Tab');await app.evaluate(()=>globalThis.__releaseAutosave());await page.waitForFunction(()=>document.querySelector('.lesson-status')?.textContent.includes('Autosaved '));
 const disk=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));assert.equal(disk.title,'Autosaved work');assert.equal(await title.inputValue(),'Edited during autosave');assert.equal(await button('Save').isEnabled(),true);await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('lesson:autosave');ipcMain.handle('lesson:autosave',globalThis.__autosaveOriginal)});assert.equal(disk.sequences.activation.length,1);assert.equal(disk.sequences.story.filter(e=>e.kind==='break').length,2);
 await title.fill('Unsaved work after autosave');await title.press('Tab');
 await button('Recovery').click();const dialog=page.getByRole('dialog',{name:'Project recovery',exact:true});await dialog.locator('.lesson-recovery-versions button').filter({hasText:'Before autosave'}).first().click();await dialog.getByRole('button',{name:'Restore checkpoint',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await title.inputValue(),'Safety project');
 await button('Undo').click();assert.equal(await title.inputValue(),'Unsaved work after autosave');await button('Redo').click();assert.equal(await title.inputValue(),'Safety project');await button('Undo').click();assert.equal(await title.inputValue(),'Unsaved work after autosave');
 assert.equal(JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8')).title,'Autosaved work');
 console.log('PASS registered 2-minute timer saves to disk without losing concurrent edits; recovery preview/restore is undoable');
 for(let n=1;n<=35;n++){await title.fill(`Revision ${n}`);await title.press('Tab');}
 for(let n=0;n<35;n++)await button('Undo').click();assert.equal(await title.inputValue(),'Unsaved work after autosave');for(let n=0;n<35;n++)await button('Redo').click();assert.equal(await title.inputValue(),'Revision 35');
 await page.keyboard.down('Control');await page.keyboard.down('z');await page.keyboard.down('z');await page.keyboard.up('z');await page.keyboard.up('Control');assert.equal(await title.inputValue(),'Revision 34');await button('Redo').click();assert.equal(await title.inputValue(),'Revision 35');
 assert.equal(await page.locator('.lesson-section-container[data-group-kind=section]').count(),2);assert.equal(await breaks().count(),2);assert.deepEqual(errors,[]);
 await button('Recovery').click();await page.getByRole('dialog',{name:'Project recovery'}).locator('.lesson-recovery-versions button').first().waitFor();await page.screenshot({path:path.join(evidence,'recovery.png')});await button('Close recovery').click();
 console.log('PASS 35 authoring actions undo/redo across saves, repeated Ctrl+Z guarded, unrelated sections preserved');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
