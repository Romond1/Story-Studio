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
 await f.locator('.top-bar-actions select').first().selectOption('memoryReveal');await present.waitForTimeout(300);
 const box=await f.locator('.gameplay-zoom-viewport').boundingBox();await present.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<3;i++){await present.mouse.wheel(0,-100);await present.waitForTimeout(100);}await present.waitForTimeout(400);
 const state=()=>f.evaluate(()=>{const l=document.querySelector('.gameplay-zoom-layer'),m=new DOMMatrix(getComputedStyle(l).transform);return {zoom:Number(getComputedStyle(l).zoom),scale:m.a,width:document.querySelector('.gameplay-content-stage').offsetWidth};});
 const enlarged=await state();assert.ok(enlarged.zoom>1.5&&enlarged.zoom<1.65);assert.equal(enlarged.scale,1,'Zoom must repaint at target resolution, not upscale a composited layer');
 await present.screenshot({path:path.join(evidence,'zoom-sharpness-157.png')});
 for(let i=0;i<3;i++){await present.mouse.wheel(0,-100);await present.waitForTimeout(100);}await present.waitForTimeout(300);
 const larger=await state();assert.ok(larger.zoom>2.4);assert.ok(Math.abs(larger.width-enlarged.width)<=2);assert.equal(larger.scale,1);
 await present.screenshot({path:path.join(evidence,'zoom-sharpness-246.png')});
 await f.locator('.zoom-toolbar').getByRole('button',{name:'Reset',exact:true}).click();await present.waitForTimeout(300);assert.ok((await state()).zoom<=1);
 console.log('PASS native sharp raster zoom at 157% and 246%, stable layout, reset');
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
