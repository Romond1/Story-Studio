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
 await page.getByRole('button',{name:'Adventure',exact:true}).click();await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByRole('button',{name:'Open project',exact:true}).click();await page.getByText('Lesson opened.',{exact:true}).waitFor(); await page.setViewportSize({width:1440,height:950});
 for(const [section,game] of [['Mastery','Final Boss Hero'],['Challenge','Language Snake']]){
  await page.getByRole('button',{name:section,exact:true}).click();
  const launch=page.getByRole('button',{name:`Launch ${game}`,exact:true});await launch.waitFor();assert.ok((await launch.boundingBox()).y<300);
  assert.equal(await page.getByRole('heading',{name:'Lesson media pool',exact:true}).count(),0);
  const create=page.getByRole('button',{name:'Create activity from bundled template',exact:true});await create.click();
  await page.locator('.game-control-present').getByRole('heading',{name:'Present controls'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:path.join(evidence,`control-${section.toLowerCase()}.png`)});
  if(section==='Mastery'){await page.getByText('Card images',{exact:true}).click();await page.locator('details').filter({has:page.locator('summary').getByText('Card images',{exact:true})}).last().locator('select').first().selectOption('card-1');await page.locator('details').filter({has:page.locator('summary').getByText('Card images',{exact:true})}).last().locator('select').nth(1).waitFor();await page.getByText('Card images',{exact:true}).click();}
  else {await page.getByText('Questions and background',{exact:true}).click();await page.locator('.game-activity-compartment textarea').first().fill('Compact control test');}
  await launch.click();await page.getByText('Activity: running',{exact:true}).waitFor();await page.getByRole('button',{name:'Return to game selection',exact:true}).click();await launch.waitFor();
 }
 await page.setViewportSize({width:600,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:path.join(evidence,'control-narrow.png')});
 assert.deepEqual(errors,[]);console.log('PASS compact Mastery and Challenge, top launch buttons, collapsible setup, unchanged Present controls, both hosted launches, narrow layout');
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});


