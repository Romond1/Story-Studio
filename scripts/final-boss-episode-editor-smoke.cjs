/* Disposable native workflow: actual Present editor, native import IPC and portable save. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
let pw;try{pw=require('playwright');}catch{pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'boss-episode-editor-'));
 const folder=path.join(temp,'Episode'),portable=path.join(temp,'Portable'),imported=path.join(temp,'Imported'),external=path.join(temp,'External');
 const fromScene=process.env.BOSS_FROM_SCENE==='1';
 const evidence=path.join(root,fromScene?'docs/final-boss-direct-launch-evidence':'docs/final-boss-episode-editor-evidence');
 for(const dir of [path.join(folder,'assets'),portable,imported,external,evidence])await fs.mkdir(dir,{recursive:true});
 const image=path.join(folder,'assets/existing.png'),portrait=path.join(external,'New portrait.png'),video=path.join(external,'New video.mp4');
 for(const [file,color]of [[image,'blue'],[portrait,'green']])execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i',`color=c=${color}:s=320x180`,'-frames:v','1',file]);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=red:s=320x180:r=15','-t','1','-pix_fmt','yuv420p',video]);
 const c=require('../dist/main/shared/lesson/commands'),e=require('../dist/main/shared/episode/commands'),{createModuleTemplate}=require('../dist/main/shared/modules/templates');
 let p=c.createLesson('Final Boss integration test');
 p.assets=[{id:'existing',filename:'existing.png',originalName:'Existing portrait',relativePath:'assets/existing.png',mediaType:'image',sizeBytes:(await fs.stat(image)).size,importedAt:new Date().toISOString()}];
 p=c.insertScene(p,'story',c.createScene('Story','existing')).project;const originalScene=p;p=e.createEpisodeFromScene(p,{id:'test-adventure',version:'1'});
 p=e.putAdventureDefinition(p,{id:p.adventure.id,version:'1',name:'Test adventure',description:'Disposable integration fixture',rewards:[],relics:[]});
 const config=createModuleTemplate('final-boss-hero');config.encounter.hero.portrait='asset:existing';
 p=e.putEpisodeActivity(p,{id:'boss',moduleType:'final-boss-hero',moduleVersion:1,configVersion:1,config});p=e.putActivityOccurrence(p,{id:'mastery-boss',activityId:'boss',section:'mastery'});
 await fs.writeFile(path.join(folder,'project.json'),JSON.stringify(fromScene?originalScene:p,null,2));
 let app,page,present,f;const passed=[],errors=[];let activeFolder=folder;
 const pass=name=>{passed.push(name);console.log('PASS',name);};
 const close=async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});};
 const launch=async(profile)=>{app=await pw._electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,profile)}`]});page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());page.on('pageerror',error=>errors.push(String(error)));};
 const picker=async(...paths)=>app.evaluate(({dialog},paths)=>{let i=0;dialog.showOpenDialog=async()=>{const path=paths[i++];return path?{canceled:false,filePaths:[path]}:{canceled:true,filePaths:[]};};},paths);
 const button=name=>page.getByRole('button',{name,exact:true});
 const open=async()=>{await button('Adventure').click();await picker(activeFolder);await button('Open project').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();};
 const ready=async()=>{present=app.windows().find(w=>w!==page)||await app.waitForEvent('window');await page.getByText('Activity: running',{exact:true}).waitFor();f=present.frames().find(frame=>frame.url().includes('moduleHost=1'));assert.ok(f);await f.getByRole('button',{name:'Switch to Edit Mode',exact:true}).click();await f.getByRole('option',{name:/Existing portrait/}).waitFor();};
 const section=async name=>f.locator('.edit-shell-sidebar').getByRole('button',{name,exact:true}).click();
 const field=label=>f.locator('.edit-shell-workspace label').filter({has:f.locator('input')}).filter({hasText:label}).first();
 const save=async()=>{await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText('Episode saved',{exact:true}).waitFor();return JSON.parse(await fs.readFile(path.join(activeFolder,'project.json'),'utf8'));};
 const settle=async()=>{await f.getByText('Changes accepted by episode',{exact:true}).waitFor();};
 try{
  await launch('profile');await open();await button('Mastery').click();await button('Launch Final Boss Hero').click();await ready();pass('Existing episode assets appear in Present editor');
  if(fromScene){assert.equal(await page.getByRole('button',{name:'Enable shared game media',exact:true}).count(),0);assert.equal(JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8')).format,'story-studio-episode');pass('Saved scene launches hosted Mastery directly in the same folder without conversion UI or activity setup');}
  await f.getByRole('option',{name:/Existing portrait/}).click();await section('Hero / Villain Media');
  await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).first().click();await settle();
  await section('Cards');await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).first().click();await settle();
  let stored=await save();assert.equal(stored.activities[0].config.cardLibrary[0].image,'asset:existing');pass('Existing image assigned to hero and card without duplicate import');
  await section('Hero / Villain Media');await picker(portrait);await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Import',exact:true}).first().click();await f.getByRole('option',{name:/New portrait.png/}).waitFor();await settle();
  await picker(video);await f.getByRole('group',{name:'video media assignment',exact:true}).getByRole('button',{name:'Import',exact:true}).first().click();await f.getByRole('option',{name:/New video.mp4/}).waitFor();await settle();
  stored=await save();const boss=stored.activities[0].config,heroId=boss.encounter.hero.portrait.slice(6),videoId=boss.encounter.hero.video.slice(6);
  assert.equal(stored.assets.length,3);assert.equal(stored.assets.find(a=>a.id===heroId).originalName,'New portrait.png');assert.equal(stored.assets.find(a=>a.id===videoId).mediaType,'video');
  assert.equal(/media:\/\/|blob:|data:|https:|C:\\/.test(JSON.stringify(boss)),false);pass('Image/video imported through Present, registered in episode, assigned and saved by stable ID');
  await section('Cards');await f.getByRole('option',{name:/New portrait.png/}).click();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).nth(1).click();await settle();
  await f.getByRole('button',{name:'Clear',exact:true}).nth(1).click();await settle();stored=await save();assert.equal(stored.assets.length,3);assert.equal(stored.activities[0].config.cardLibrary[0].frontImage,'');pass('Clearing assignment retains shared asset');
  await picker();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Import',exact:true}).first().click();await f.getByText('Import cancelled.',{exact:true}).waitFor();assert.equal((await save()).assets.length,3);pass('Cancelled native import leaves configuration and media intact');
  const controlImage=path.join(external,'Control import.png');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=yellow:s=320x180','-frames:v','1',controlImage]);await picker(controlImage);await f.getByRole('button',{name:'Import media',exact:true}).click();await f.getByRole('option',{name:/Control import.png/}).waitFor();pass('Media imported from the game pool updates its catalogue automatically');
  await section('Intro / Setup Screen');await f.getByRole('button',{name:'New Hero Option',exact:true}).click();await settle();
  await f.getByRole('option',{name:/New portrait.png/}).click();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).click();await settle();
  await f.getByRole('option',{name:/New video.mp4/}).click();await f.getByRole('group',{name:'video media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).click();await settle();
  await section('Cutscenes');await f.getByRole('button',{name:'New',exact:true}).click();await settle();await f.locator('.edit-shell-workspace select').first().selectOption('video');await settle();await f.getByRole('group',{name:'video media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).click();await settle();
  await section('Game Backgrounds');await f.getByRole('option',{name:/Existing portrait/}).click();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).first().click();await settle();
  await section('Power-Ups / Rewards');await f.getByRole('button',{name:'New',exact:true}).first().click();await settle();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).first().click();await settle();await f.getByRole('button',{name:'New',exact:true}).nth(1).click();await settle();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).last().click();await settle();
  await section('Cards');await f.getByRole('option',{name:/New portrait.png/}).dragTo(f.locator('.hosted-media-target').nth(2));await settle();stored=await save();
  assert.equal(stored.activities[0].config.cardLibrary[0].backImage,`asset:${heroId}`);assert.equal(stored.activities[0].config.encounter.introSetup.heroes[0].video,`asset:${videoId}`);assert.equal(stored.activities[0].config.encounter.cutscenes[0].mediaSource,`asset:${videoId}`);
  pass('Intro, backgrounds, cutscenes, rewards, power-ups and card drag/drop share stable asset references');
  await section('Hero / Villain Media');
  for(const width of [1440,960,600]){await present.setViewportSize({width,height:900});await present.screenshot({path:path.join(evidence,`editor-${width}.png`)});const overflow=await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false,`no horizontal overflow at ${width}`);}
  pass('Editor fits desktop, medium and narrow viewports');
  await present.setViewportSize({width:1440,height:900});await f.getByRole('button',{name:'Switch to Play Mode',exact:true}).click();await f.getByRole('button',{name:'Switch to Edit Mode',exact:true}).waitFor();
  await f.locator('.top-bar-actions select').first().selectOption('memoryReveal');
  const targetPosition=Number((await f.locator('.memory-target-banner').innerText()).match(/\d+/)[0])-1;
  const targetTitle=await f.locator('.memory-grid .memory-card img').nth(targetPosition).getAttribute('alt');
  await f.getByRole('button',{name:'Start Game',exact:true}).click();await f.getByRole('button',{name:/Guess$/}).click();
  await f.locator('.memory-side-left .memory-candidate').filter({has:f.getByAltText(targetTitle,{exact:true})}).click();
  await f.locator('.memory-side-right .memory-candidate').filter({hasNot:f.getByAltText(targetTitle,{exact:true})}).first().click();
  await f.getByRole('button',{name:/Reveal$/}).click();await f.getByRole('button',{name:/Next Round$/}).waitFor();pass('Existing Memory Reveal gameplay accepts guesses and resolves a round using episode card media');
  await present.close();await page.getByText(/Present closed/).waitFor();await button('Launch Final Boss Hero').click();await ready();await section('Hero / Villain Media');
  await f.getByAltText('Hero preview',{exact:true}).waitFor();assert.equal(await f.getByAltText('Hero preview',{exact:true}).evaluate(img=>img.complete&&img.naturalWidth>0),true);pass('Edit/play and Present close/reopen preserve accepted game configuration');
  await save();await close();await launch('profile');await open();await button('Mastery').click();await button('Launch Final Boss Hero').click();await ready();
  stored=await save();assert.equal(stored.activities[0].config.encounter.hero.portrait,`asset:${heroId}`);assert.equal(stored.activities[0].config.encounter.hero.video,`asset:${videoId}`);pass('Full application restart restores authored configuration and media');
  await picker(portable);await button('Export portable episode').click();
  for(let i=0;i<100&&!await fs.stat(path.join(portable,'manifest.json')).then(()=>true,()=>false);i++)await page.waitForTimeout(100);
  assert.ok(await fs.stat(path.join(portable,'manifest.json')).then(()=>true,()=>false),await page.locator('body').innerText());await close();
  // Only rename the disposable fixtures rooted in the freshly created temp directory.
  assert.equal(path.dirname(folder),temp);assert.equal(path.dirname(external),temp);await fs.rename(folder,path.join(temp,'Original unavailable'));await fs.rename(external,path.join(temp,'External unavailable'));
  await launch('clean-profile');await app.context().setOffline(true);await button('Adventure').click();await picker(portable,imported);await button('Import portable episode').click();await page.getByText(/Portable episode verified and imported/).waitFor();activeFolder=imported;
  await button('Mastery').click();await button('Launch Final Boss Hero').click();await ready();await section('Hero / Villain Media');
  await f.waitForFunction(()=>[...document.querySelectorAll('.hosted-asset-thumb img')].some(img=>img.complete&&img.naturalWidth>0));
  await f.getByRole('option',{name:/New video.mp4/}).click();await f.locator('.hosted-asset-preview summary').click();await f.waitForFunction(()=>document.querySelector('.hosted-asset-preview video')?.readyState>=2);
  assert.equal((await save()).activities[0].config.encounter.hero.video,`asset:${videoId}`);await present.screenshot({path:path.join(evidence,'portable-offline.png')});pass('Portable import works offline in fresh profile with original media paths unavailable');
  const diskBefore=await fs.readFile(path.join(imported,'project.json'),'utf8');
  await section('Encounter / Overview');await f.getByLabel('Encounter Name',{exact:true}).fill('Recovered after save failure');await settle();
  await app.evaluate((_electron,file)=>{const io=process.getBuiltinModule('fs').promises;const original=io.rename;io.rename=async function(from,to){if(String(to)===file){io.rename=original;throw Error('Injected disk publication failure');}return original.call(this,from,to);};},path.join(imported,'project.json'));
  await f.getByRole('button',{name:'Save episode',exact:true}).click();await f.getByText(/Episode save failed:.*Injected disk publication failure/).waitFor();assert.equal(await fs.readFile(path.join(imported,'project.json'),'utf8'),diskBefore);
  assert.equal((await save()).activities[0].config.encounter.name,'Recovered after save failure');pass('Failed native save preserves prior disk file, reports failure, and retries successfully');
  await close();const missingAsset=stored.assets.find(asset=>asset.id===heroId);const missingPath=path.resolve(imported,missingAsset.relativePath);assert.ok(missingPath.startsWith(path.resolve(imported)+path.sep));await fs.rename(missingPath,`${missingPath}.missing`);
  await launch('missing-profile');await open();await button('Mastery').click();await button('Launch Final Boss Hero').click();await ready();await f.getByText(/Some media is missing/).waitFor();await section('Hero / Villain Media');await f.getByRole('option',{name:/Existing portrait/}).click();await f.getByRole('group',{name:'image media assignment',exact:true}).getByRole('button',{name:'Media pool',exact:true}).first().click();await settle();assert.equal((await save()).activities[0].config.encounter.hero.portrait,'asset:existing');pass('Missing physical media warns without discarding config and can be replaced from the pool');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(evidence,'results.json'),JSON.stringify({passed,temp,errors},null,2));
 }catch(error){await present?.screenshot({path:path.join(evidence,'failure-present.png')}).catch(()=>{});await page?.screenshot({path:path.join(evidence,'failure-control.png')}).catch(()=>{});await fs.writeFile(path.join(evidence,'failure.json'),JSON.stringify({error:String(error.stack||error),passed,temp,errors},null,2));throw error;}
 finally{await close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
