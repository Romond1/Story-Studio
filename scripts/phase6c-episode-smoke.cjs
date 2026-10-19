/* Native Phase 6C acceptance. Synthetic disposable source only; dialogs are the
 * sole mocked boundary. Run after main/renderer build; no build is performed. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
function playwright() {
  if(process.env.STORY_STUDIO_PLAYWRIGHT)return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try{return require('playwright');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
(async()=>{
  const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'story-phase6c-'));
  const source=path.join(temp,'Scene source'),episode=path.join(temp,'Episode copy'),second=path.join(temp,'Second adventure');
  const evidence=process.env.STORY_STUDIO_EVIDENCE||path.join(root,'docs/phase6c-evidence/native');
  await Promise.all([path.join(source,'assets'),episode,second,evidence].map(p=>fs.mkdir(p,{recursive:true})));
  const imageFile=path.join(source,'assets/split.png');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=red:s=320x180','-vf','drawbox=x=160:y=0:w=160:h=180:color=blue:t=fill','-frames:v','1',imageFile]);
  const c=require('../dist/main/shared/lesson/commands');
  let original=c.createLesson('Episode conversion source');
  original.assets=[{id:'split-source',filename:'split.png',originalName:'Split red blue',relativePath:'assets/split.png',mediaType:'image',sizeBytes:(await fs.stat(imageFile)).size,importedAt:new Date().toISOString()}];
  original=c.insertScene(original,'story',c.createScene('Adventure image','split-source')).project;
  original=c.insertScene(original,'activation',c.createScene('Activation image')).project;
  const sourceJson=path.join(source,'project.json');await fs.writeFile(sourceJson,JSON.stringify(original,null,2));
  const originalHash=sha(await fs.readFile(sourceJson)),imageHash=sha(await fs.readFile(imageFile));
  const app=await playwright()._electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
  let page;const passed=[],errors=[];const pass=name=>{passed.push(name);console.log('PASS',name);};
  try{
    page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
    const button=name=>page.getByRole('button',{name,exact:true}),field=name=>page.locator('label').filter({hasText:new RegExp(`^${name}${name==='Filter by entity'?'(?! kind)':''}`)}).locator('input,select,textarea').first();
    const choose=folder=>app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
    const open=async folder=>{await choose(folder);await button('Open project').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();};
    const save=async()=>{await button('Save').click();await page.waitForFunction(()=>!document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved')&&!document.querySelector('.lesson-status')?.textContent.includes('Working'));};
    await button('Adventure').click();await open(source);await button('Edit').click();
    // This is deliberately the first capability assertion: a pre-6C build fails here.
    await page.locator('summary').filter({hasText:/^Episode content$/}).click();
    await field('Adventure ID').fill('native-adventure-one');await field('Adventure version').fill('1');
    await choose(episode);await button('Convert to episode copy').click();
    await page.waitForFunction(()=>document.querySelector('.episode-content')?.textContent.includes('native-adventure-one')&&document.querySelector('.episode-content')?.textContent.includes('Derived images'));
    if(!await page.locator('summary').filter({hasText:/^Derived images$/}).isVisible())await page.locator('summary').filter({hasText:/^Episode content$/}).click();
    await page.locator('summary').filter({hasText:/^Derived images$/}).click();await field('Source image').waitFor();
    assert.equal(sha(await fs.readFile(sourceJson)),originalHash);assert.equal(sha(await fs.readFile(imageFile)),imageHash);
    const backups=path.join(temp,'profile','migration-backups');
    const backupIds=await fs.readdir(backups);assert.equal(backupIds.length,1,'One private conversion backup');
    const backup=path.join(backups,backupIds[0],'source');
    assert.equal(sha(await fs.readFile(path.join(backup,'project.json'))),originalHash);
    assert.equal(sha(await fs.readFile(path.join(backup,'assets/split.png'))),imageHash);
    pass('Explicit conversion leaves original scene JSON and image bytes unchanged');
    const derived=[];
    for(const [name,left] of [['Red crop','0'],['Blue crop','0.5']]){
      const reset=button('New derived image');if(await reset.count())await reset.click();
      await field('Source image').selectOption('split-source');await field('Derived image name').fill(name);
      for(const [label,value]of [['Crop left',left],['Crop top','0'],['Crop width','0.5'],['Crop height','1'],['Brightness','1'],['Contrast','1'],['Saturation','1']])await field(label).fill(value);
      await field('Rotation').selectOption('0');await field('Fit').selectOption('contain');
      await field('Focal X').fill('0.5');await field('Focal Y').fill('0.5');
      await button('Preview derived image').click();await button('Save derived image').click();
      derived.push(name);
    }
    await button('Scene properties').click();
    const options=await field('Background media').locator('option').evaluateAll(nodes=>nodes.map(n=>({label:n.textContent,value:n.value})));
    const red=options.find(o=>o.label.includes('Red crop')),blue=options.find(o=>o.label.includes('Blue crop'));
    assert.ok(red&&blue&&red.value!==blue.value,'Two independently identified derived images available as backgrounds');
    await field('Background media').selectOption(red.value);
    const pixelProbe=async({selector,channel})=>{const node=document.querySelector(selector);if(!node)return false;const url=node.getAttribute('src')||node.getAttribute('href');if(!url)return false;const img=new Image();img.src=url;try{await img.decode();}catch{return false;}const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixel=[...ctx.getImageData(canvas.width/2,canvas.height/2,1,1).data];if(channel!==undefined)return pixel[channel]>200&&pixel[channel===0?2:0]<40;return {width:canvas.width,height:canvas.height,pixel,url};};
    const pixels=async(target=page,channel)=>{const selector=target===page?'.lesson-canvas img, .lesson-canvas image':'[data-scene-surface] img, [data-scene-surface] image';for(let i=0;i<150;i++){const result=await target.evaluate(pixelProbe,{selector});if(result&&(!Number.isInteger(channel)||result.pixel[channel]>200&&result.pixel[channel===0?2:0]<40))return result;await target.waitForTimeout(100);}throw new Error(`Expected decoded image pixels for channel ${channel}`);};
    const waitColor=channel=>pixels(page,channel);
    await waitColor(0);const redPixels=await pixels();assert.ok(redPixels.pixel[0]>200&&redPixels.pixel[2]<40,'Red crop pixels');
    await button('Discovery').click();await button('Add Card').click();await field('Face layout').selectOption('image-only');await field('Face image').selectOption(blue.value);
    await waitColor(2);const bluePixels=await pixels();assert.ok(bluePixels.pixel[2]>200&&bluePixels.pixel[0]<40,'Blue crop pixels');
    await button('Show in Present').click();await button('Open Present').click();
    const present=app.windows().find(window=>window!==page)||await app.waitForEvent('window');present.setDefaultTimeout(15000);present.on('pageerror',e=>errors.push(String(e)));
    await pixels(present,2);
    await button('Teach').click();await waitColor(2);await button('Edit').click();
    await present.screenshot({path:path.join(evidence,'derived-present.png')});
    pass('Two same-source derived images render distinct crop pixels in Adventure background and Activation card');
    if(!await page.locator('summary').filter({hasText:/^Content identities and tags$/}).isVisible())await page.locator('summary').filter({hasText:/^Episode content$/}).click();
    await page.locator('summary').filter({hasText:/^Content identities and tags$/}).click();
    await field('Entity name').fill('Hero');await field('Entity kind').selectOption('character');await field('Entity tags').fill('native,hero');
    await page.getByRole('checkbox',{name:/Red crop/}).check();await button('Save entity').click();
    await page.locator('summary').filter({hasText:/^Content collections$/}).click();
    await field('Collection name').fill('Native cast');await page.getByRole('group',{name:'Collection entities'}).getByRole('checkbox',{name:'Hero · character',exact:true}).check();await button('Save collection').click();
    await field('Filter by tag').fill('native');
    await field('Filter by entity').selectOption({label:'Hero'});await field('Filter media type').selectOption('image');
    await field('Filter by entity kind').selectOption('character');await field('Filter by collection').selectOption({label:'Native cast'});
    assert.equal(await page.getByLabel('Adventure content',{exact:true}).locator('button').count(),1);
    await field('Filter media type').selectOption('audio');assert.equal(await page.getByLabel('Adventure content',{exact:true}).locator('button').count(),0);
    await field('Filter media type').selectOption('image');
    await save();
    const stored=JSON.parse(await fs.readFile(path.join(episode,'project.json'),'utf8'));
    assert.equal(stored.format,'story-studio-episode');assert.equal(stored.adventure.id,'native-adventure-one');
    assert.equal(stored.derivedImages.length,2);assert.deepEqual(stored.derivedImages.map(d=>d.sourceAssetId),['split-source','split-source']);
    assert.equal(stored.assets.length,1,'Derived images do not duplicate source asset records');
    assert.equal(stored.scenes[stored.sequences.story[0].sceneId].background.assetId,red.value);
    assert.ok(Object.values(stored.cards).some(c=>c.faces.some(f=>f.imageAssetId===blue.value)));
    assert.equal(JSON.stringify(stored).includes('media://scoped/'),false);
    assert.equal(JSON.stringify(stored).includes('media://scoped-derived/'),false);
    const firstEntity=stored.catalog.entities.find(e=>e.name==='Hero');assert.ok(firstEntity);assert.equal(firstEntity.adventureId,'native-adventure-one');
    assert.ok(firstEntity.tags.includes('native'));assert.ok(firstEntity.assetIds.includes(red.value));
    assert.ok(stored.catalog.collections.some(collection=>collection.name==='Native cast'&&collection.entityIds.includes(firstEntity.id)));
    await open(episode);await waitColor(2);
    assert.equal(sha(await fs.readFile(sourceJson)),originalHash);assert.equal(sha(await fs.readFile(imageFile)),imageHash);
    await page.screenshot({path:path.join(evidence,'episode-reopened.png')});
    pass('Entity metadata, derived references, and episode reopen survive save');
    const unsupported=path.join(temp,'Unsupported capability');await fs.cp(episode,unsupported,{recursive:true});
    const future={...stored,requiredCapabilities:[...stored.requiredCapabilities,'future-unsupported-native']};
    await fs.writeFile(path.join(unsupported,'project.json'),JSON.stringify(future));
    await choose(unsupported);await button('Open project').click();
    await page.locator('.lesson-error').filter({hasText:/capabilit|unsupported/i}).waitFor();
    assert.ok(await page.locator('.lesson-status').textContent().then(text=>text.includes(episode)),'Rejected capability leaves active episode unchanged');
    pass('Unsupported required capability rejects before active project changes');
    await open(source);assert.equal(sha(await fs.readFile(sourceJson)),originalHash);
    pass('Original scene project remains safely reopenable');
    const summary=page.locator('summary').filter({hasText:/^Episode content$/});
    if(!await field('Adventure ID').isVisible())await summary.click();
    await field('Adventure ID').fill('native-adventure-two');await field('Adventure version').fill('1');
    await choose(second);await button('Convert to episode copy').click();
    await page.waitForFunction(()=>document.querySelector('.episode-content')?.textContent.includes('native-adventure-two')&&document.querySelector('.episode-content')?.textContent.includes('Derived images'));
    if(!await page.locator('summary').filter({hasText:/^Content identities and tags$/}).isVisible())await page.locator('summary').filter({hasText:/^Episode content$/}).click();
    const entityDetails=page.locator('summary').filter({hasText:/^Content identities and tags$/});await entityDetails.waitFor();
    if(!await field('Entity name').isVisible())await entityDetails.click();
    await field('Entity name').fill('Hero');await field('Entity kind').selectOption('character');await field('Entity tags').fill('native');await button('Save entity').click();await save();
    const secondStored=JSON.parse(await fs.readFile(path.join(second,'project.json'),'utf8'));
    const secondEntity=secondStored.catalog.entities.find(e=>e.name==='Hero');assert.ok(secondEntity);assert.notEqual(secondEntity.id,firstEntity.id);assert.equal(secondEntity.adventureId,'native-adventure-two');
    assert.equal(sha(await fs.readFile(sourceJson)),originalHash);assert.equal(sha(await fs.readFile(imageFile)),imageHash);
    pass('Same entity display name stays independently identified across two adventures');
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(evidence,'results.json'),JSON.stringify({passed,errors,temp,originalHash,imageHash,redPixels,bluePixels},null,2));
  }catch(error){if(page)await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});await fs.writeFile(path.join(evidence,'failure.json'),JSON.stringify({passed,errors,temp,failure:String(error.stack||error)},null,2));throw error;}
  finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});

