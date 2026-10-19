const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
let pw;try{pw=require('playwright');}catch{pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'boss-usability-')),folder=path.join(temp,'Lesson'),evidence=path.join(root,'docs/boss-usability-evidence');
 await fs.mkdir(path.join(folder,'assets'),{recursive:true});await fs.mkdir(evidence,{recursive:true});
 const c=require('../dist/main/shared/lesson/commands');let p=c.createLesson('Editor usability');
 for(let i=0;i<8;i++){const name=`picture-${i}.png`,file=path.join(folder,'assets',name);execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=${['blue','green','red','orange','purple','yellow','cyan','pink'][i]}:s=320x180`,'-frames:v','1',file]);p.assets.push({id:`picture-${i}`,filename:name,originalName:`Long descriptive image name ${i} that should be on hover.png`,relativePath:`assets/${name}`,mediaType:'image',sizeBytes:(await fs.stat(file)).size,importedAt:new Date().toISOString()});}
 await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(p));
 let app;const errors=[],results=[];
 try{
 app=await pw._electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
 await page.getByRole('button',{name:'Adventure',exact:true}).click();await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByRole('button',{name:'Open project',exact:true}).click();await page.getByText('Lesson opened.',{exact:true}).waitFor();await page.getByRole('button',{name:'Mastery',exact:true}).click();await page.getByRole('button',{name:'Launch Final Boss Hero',exact:true}).click();await page.getByText('Activity: running',{exact:true}).waitFor();const present=app.windows().find(w=>w!==page);await present.setViewportSize({width:1440,height:900});present.on('pageerror',e=>errors.push(String(e)));const f=present.frames().find(f=>f.url().includes('moduleHost=1'));
 const metrics=()=>f.evaluate(()=>{const c=document.querySelector('.gameplay-content-stage'),l=document.querySelector('.gameplay-zoom-layer');return {width:c.offsetWidth,height:c.offsetHeight,zoom:document.querySelector('.zoom-toolbar').innerText,transform:l.style.transform};});
 for(const game of ['memoryReveal','matchPairs','laneBattle','openBox','boardDash']){
 await f.locator('.top-bar-actions select').first().selectOption(game);await present.waitForTimeout(450);const before=await metrics();const box=await f.locator('.gameplay-zoom-viewport').boundingBox();await present.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let n=0;n<5;n++){await present.mouse.wheel(0,-10);await present.waitForTimeout(40);}await present.waitForTimeout(350);const after=await metrics();results.push({game,before,after});
 if(!process.env.BOSS_USABILITY_BASELINE){assert.ok(Math.abs(after.width-before.width)<=2,`${game}: zoom must not relayout width`);assert.ok(Math.abs(after.height-before.height)<=2,`${game}: zoom must not relayout height`);await present.waitForTimeout(200);assert.deepEqual(await metrics(),after,`${game}: zoom must settle`);}
 }
 console.log(JSON.stringify(results,null,2));
 if(process.env.BOSS_USABILITY_BASELINE)return;
 await present.screenshot({path:path.join(evidence,'play-desktop.png')});
 for(const width of [960,600]){
  await present.setViewportSize({width,height:900});
  for(const game of ['memoryReveal','matchPairs','laneBattle','openBox','boardDash']){
   await f.locator('.top-bar-actions select').first().selectOption(game);await present.waitForTimeout(250);
   const fit=await f.evaluate(()=>{const a=document.querySelector('.gameplay-content-stage').getBoundingClientRect(),b=document.querySelector('.gameplay-zoom-viewport').getBoundingClientRect();return {width:a.width,height:a.height,vw:b.width,vh:b.height};});
   assert.ok(fit.width<=fit.vw+4&&fit.height<=fit.vh+4,`${game} must fit at ${width}: ${JSON.stringify(fit)}`);
  }
 }
 await present.setViewportSize({width:1440,height:900});
 await f.getByRole('button',{name:'Switch to Edit Mode',exact:true}).click();await f.getByRole('option',{name:/image name 0/}).waitFor();await f.locator('.edit-shell-sidebar').getByRole('button',{name:'Cards',exact:true}).click();
 const source=f.getByRole('option',{name:/image name 0/}),field=f.locator('.editor-grid label').filter({has:f.locator('input[placeholder="No media assigned"]')}).filter({hasText:/^Image/}).first();
 await source.dragTo(field.locator('input'));await f.getByText('Changes accepted by episode',{exact:true}).waitFor();
 await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText('Episode saved',{exact:true}).waitFor();let saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));assert.equal(saved.activities[0].config.cardLibrary[0].image,'asset:picture-0');
 await f.getByRole('option',{name:/image name 1/}).dragTo(f.locator('.edit-card-preview').first());await f.getByText('Changes accepted by episode',{exact:true}).waitFor();await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText('Episode saved',{exact:true}).waitFor();saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));assert.equal(saved.activities[0].config.cardLibrary[0].frontImage,'asset:picture-1');
 await field.getByRole('button',{name:'Clear',exact:true}).click();await f.getByText('Changes accepted by episode',{exact:true}).waitFor();await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText('Episode saved',{exact:true}).waitFor();saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));assert.equal(saved.activities[0].config.cardLibrary[0].image,'');assert.equal(saved.assets.length,8);
 await f.locator('.edit-shell-sidebar').getByRole('button',{name:'Intro / Setup Screen',exact:true}).click();await f.getByRole('button',{name:'New Hero Option',exact:true}).click();await f.getByText('Changes accepted by episode',{exact:true}).waitFor();await source.dragTo(f.getByRole('group',{name:'image media assignment',exact:true}));await f.getByText('Changes accepted by episode',{exact:true}).waitFor();await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText('Episode saved',{exact:true}).waitFor();saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));assert.equal(saved.activities[0].config.encounter.introSetup.heroes[0].portrait,'asset:picture-0');
 await f.locator('.edit-shell-sidebar').getByRole('button',{name:'Cards',exact:true}).click();
 const pool=f.locator('.hosted-media-panel');const initial=(await pool.boundingBox()).width;const sep=f.getByRole('separator',{name:'Resize media pool'});const sb=await sep.boundingBox();await present.mouse.move(sb.x+sb.width/2,sb.y+100);await present.mouse.down();await present.mouse.move(sb.x+140,sb.y+100,{steps:12});await present.mouse.up();assert.ok((await pool.boundingBox()).width>initial+90);
 const nav=f.locator('.edit-shell-sidebar'),navBefore=(await nav.boundingBox()).width;await f.getByRole('separator',{name:'Resize navigation'}).focus();await present.keyboard.press('ArrowLeft');assert.ok((await nav.boundingBox()).width>navBefore);
 const thumb=await source.locator('.hosted-asset-thumb').boundingBox();assert.ok(thumb.width>=130&&thumb.height>=80);assert.ok(await source.getAttribute('title'));await present.screenshot({path:path.join(evidence,'editor-desktop.png')});
 for(const width of [960,600]){await present.setViewportSize({width,height:900});assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await present.screenshot({path:path.join(evidence,`editor-${width}.png`)});}
 await present.setViewportSize({width:1440,height:900});
 await f.locator('.card-item').filter({hasText:'Finish'}).click();await f.getByRole('button',{name:'Delete',exact:true}).click();await f.getByText('Changes accepted by episode',{exact:true}).waitFor();
 await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText('Episode saved',{exact:true}).waitFor();saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));
 assert.equal(saved.activities[0].config.cardLibrary.length,1);assert.deepEqual(saved.activities[0].config.encounter.boardDashCardIds,['card-1']);assert.equal(saved.activities[0].config.cardLibrary[0].frontImage,'asset:picture-1');console.log('PASS deleting a selected Board Dash card then Save episode preserves remaining edits');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(evidence,'results.json'),JSON.stringify({temp,results,errors,editor:'Input and preview drag/drop persisted; both dividers resize; large thumbnails; responsive layouts; delete selected Board Dash card then save passed'},null,2));console.log('PASS editor drag/drop, panel resizing, thumbnails, responsive layouts, stable zoom for all five games');
 }finally{await fs.writeFile(path.join(evidence,process.env.BOSS_USABILITY_BASELINE?'zoom-before.json':'zoom-after.json'),JSON.stringify({temp,results,errors},null,2));await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});

