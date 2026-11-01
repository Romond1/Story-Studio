const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
 const root=path.resolve(__dirname,'..'), temp=await fs.mkdtemp(path.join(os.tmpdir(),'studio-variety-'));
 const folder=path.join(temp,'Lesson'), evidence=path.join(root,'output/playwright/mini-game-variety');
 await fs.mkdir(folder); await fs.mkdir(evidence,{recursive:true});
 const {createLesson,createScene,insertScene}=require('../dist/main/shared/lesson/commands');
 const {insertBreak}=require('../dist/main/shared/lesson/sections');
 const {createGameConfig,addWheelActivity}=require('../dist/main/shared/lesson/spinningWheel');
 let project=insertScene(createLesson('Mini-game variety checks'),'story',createScene('Earlier scene')).project;
 const ids={}, configs={};
 for(const key of ['wheel-label-draft','wheel-empty','magic-hat','mystery-cards']) {
  const added=insertBreak(project,'story'); project=added.project; ids[key]=added.entryId;
  const entry=project.sequences.story.find(e=>e.id===added.entryId), scene=project.scenes[entry.sceneId]; scene.title=key;
  let config=createGameConfig(key.startsWith('wheel')?'spinning-wheel':key);
  if(key!=='wheel-empty') {
   for(let i=0;i<6;i++) {config=addWheelActivity(config,i<3?'question':'event'); config.activities[i].config={label:i<3?`Public question ${i+1}`:`Event ${i-2}`,...(i>=3?{instructions:'PRIVATE TEACHER NOTE',studentText:'Wave hello!'}:{})};}
   if(key==='wheel-label-draft') config=addWheelActivity(config,'question');
  }
  scene.breakExperience=config; configs[key]=config;
 }
 const original=JSON.stringify(project); await fs.writeFile(path.join(folder,'project.json'),original);
 const app=await _electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
 const errors=[];
 try {
  const page=await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror',e=>errors.push(String(e))); page.on('dialog',d=>d.accept());
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1700,1050));
  const button=name=>page.getByRole('button',{name,exact:true});
  await button('Adventure').click();
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
  await button('Open project').click(); await page.getByText('Lesson opened.',{exact:true}).waitFor(); await button('Edit').click();
  const practice=page.getByRole('dialog',{name:'Test mini-game',exact:true});
  const action=name=>practice.getByRole('button',{name,exact:true});
  const shot=(name,window=page)=>window.screenshot({path:path.join(evidence,`${name}.png`)});
  await page.emulateMedia({reducedMotion:'reduce'});
  // A usable label-only pool can run while an unfinished draft remains in authoring.
  await page.locator(`[data-entry-id="${ids['wheel-label-draft']}"]`).click(); await button('Test game').click();
  assert.equal(await action('Start Game').isEnabled(),true); await action('Start Game').click(); await action('Spin Wheel').click();
  await practice.locator('[data-wheel-phase="active"]').waitFor(); await shot('wheel-label-with-draft'); await action('Close test').click();
  await page.locator(`[data-entry-id="${ids['wheel-empty']}"]`).click(); await button('Test game').click();
  await action('Start sample game').click(); await action('Spin Wheel').click(); await practice.locator('[data-wheel-phase="active"]').waitFor();
  await shot('empty-sample-game'); await action('Close test').click();
  // The sample and usable-draft paths must not rewrite project.json.
  assert.equal(await fs.readFile(path.join(folder,'project.json'),'utf8'),original);
  for(const key of ['magic-hat','mystery-cards']) {
   await page.locator(`[data-entry-id="${ids[key]}"]`).click(); await shot(`${key}-editor`); await button('Test game').click();
   await action('Start Game').click();
   if(key==='magic-hat') {await practice.getByLabel('Reveal automatically',{exact:true}).uncheck();await action('Draw from Hat').click();await action('Reveal').click();}
   else { await action('Shuffle Cards').click(); await practice.getByRole('button',{name:'Choose card 2',exact:true}).click(); }
   await practice.locator('[data-wheel-phase="active"]').waitFor(); if(await action('Skip animation').count()) await action('Skip animation').click(); await shot(`${key}-practice`);
   await action('Award reward').click(); await practice.getByText('Class: 1 total. Animations never change scores.',{exact:true}).waitFor();
   assert.equal(await action('Award reward').count(),0); await action('Replay animation').click();
   await practice.getByText('Class: 1 total. Animations never change scores.',{exact:true}).waitFor();
   await action('Close test').click();
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await button('Teach').click(); await button('Open Present').click();
  let present=app.windows().find(w=>w!==page)||await app.waitForEvent('window'); present.setDefaultTimeout(15000); present.on('pageerror',e=>errors.push(String(e)));
  await present.emulateMedia({reducedMotion:'no-preference'});
  const snapshot=async()=>{const result=await present.evaluate(()=>window.presentApi.requestSnapshot()); assert.equal(JSON.stringify(result).includes('PRIVATE TEACHER NOTE'),false); return result.snapshot.target.plan.wheel;};
  for(const key of ['magic-hat','mystery-cards']) {
   await page.locator(`[data-entry-id="${ids[key]}"]`).click();
   const controls=page.getByRole('region',{name:`${key==='magic-hat'?'Magic Hat':'Mystery Cards'} controls`,exact:true});
   const act=name=>controls.getByRole('button',{name,exact:true}).click();
   await act('Start Game');
   assert.equal(JSON.stringify(await snapshot()).includes('Public question'),false);
   if(key==='magic-hat') await act('Draw from Hat'); else { await act('Shuffle Cards'); await act('Choose Card 1'); }
   await present.locator('[data-wheel-phase="revealed"]').waitFor(); const mid=await snapshot(); assert.equal(mid.activity?.prompt,undefined); assert.ok(mid.reveal);
   await shot(`${key}-during-reveal`,present);await present.reload();
   await present.locator('[data-wheel-phase="active"]').waitFor(); const selected=await snapshot();assert.equal(selected.selectedSegmentId,mid.selectedSegmentId); assert.equal(selected.gameType,key); assert.ok(selected.selectedSegmentId);
   if(key==='mystery-cards') {assert.equal(selected.reveal.selectedIndex,0); assert.equal(selected.slots[0].selected,true);}
   if(await controls.getByRole('button',{name:'Skip animation',exact:true}).count()) await act('Skip animation');
   await shot(`${key}-present`,present); await shot(`${key}-teach`);
   await present.reload(); await present.locator('[data-wheel-phase="active"]').waitFor();
   const restored=await snapshot(); assert.equal(restored.selectedSegmentId,selected.selectedSegmentId); assert.deepEqual(restored.reveal,selected.reveal);
   await act('Complete Activity'); await present.locator('[data-wheel-phase="activity-complete"]').waitFor();
   if(key==='mystery-cards') {await act('Next Activity'); await page.getByRole('button',{name:'Choose card 2',exact:true}).click(); await present.locator('[data-wheel-phase="active"]').waitFor(); assert.equal((await snapshot()).reveal.selectedIndex,1); await shot('cards-clicked-stage',present);}
  }
  assert.equal(await fs.readFile(path.join(folder,'project.json'),'utf8'),original); assert.deepEqual(errors,[]);
  console.log('PASS: label-only wheel plus blank draft, empty sample, hat/cards editor and isolated practice, direct/numbered card selection, Teach/Present and reload mapping, reduced motion, reward duplicate prevention, privacy and unchanged authored file.');
 } catch(error) {
  for(const [i,w] of app.windows().entries()) {await w.screenshot({path:path.join(evidence,`failure-${i}.png`)}); console.error((await w.locator('body').innerText()).slice(-6500));}
  throw error;
 } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

