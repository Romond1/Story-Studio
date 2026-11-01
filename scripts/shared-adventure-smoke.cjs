const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {_electron} = require(process.env.STORY_STUDIO_PLAYWRIGHT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'studio-shared-adventure-'));
  const evidence=path.join(root,'output/playwright/shared-adventure'),folder=path.join(temp,'Group lesson'),soloFolder=path.join(temp,'Solo lesson');
  await fs.mkdir(evidence,{recursive:true});await fs.mkdir(folder);await fs.mkdir(path.join(soloFolder,'assets'),{recursive:true});
  const image=path.join(temp,'clue.png');
  execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','color=c=gold:s=400x300','-frames:v','1',image]);
  const {createLesson,insertScene,createScene}=require('../dist/main/shared/lesson/commands');
  const solo=insertScene(createLesson('Solo regression'),'story',createScene('Original solo scene')).project;
  await fs.writeFile(path.join(soloFolder,'project.json'),JSON.stringify(solo));
  const app=await _electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
  const errors=[];
  try {
    const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));page.on('dialog',dialog=>dialog.accept());
    const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
    const pick=async target=>app.evaluate(({dialog},target)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[target]});},target);
    const shot=async(name,surface=page)=>surface.screenshot({path:path.join(evidence,`${name}.png`)});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1550,1000));
    await button('Team Play').click();await page.getByRole('heading',{name:'Team Play',exact:true}).waitFor();
    assert.equal(await page.locator('.shared-adventure').evaluate(node=>getComputedStyle(node).overflowY),'auto');
    for(const location of ['Italy','Japan']){await page.getByLabel('New device / location',{exact:true}).fill(location);await button('Add device').click();}
    for(const [index,location] of [[1,'Italy'],[2,'Italy'],[3,'Japan']])await page.getByLabel(`Device Student ${index}`,{exact:true}).selectOption({label:location});
    await page.getByLabel('Award Student 1',{exact:true}).check();await page.getByLabel('Award Student 2',{exact:true}).check();
    await button('Award selected').click();await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await button('Award team').click();await page.getByText('◆ Team 25 / 30',{exact:true}).waitFor();
    await button('Undo points').click();await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await page.getByLabel('Shared prompt',{exact:true}).fill('Describe the golden secret.');
    await pick(image);await button('Import group media').click();await page.getByLabel('Shared image',{exact:true}).selectOption({label:'clue.png'});
    await button('Open Present').click();let present;
    await page.waitForFunction(()=>!!window.appApi);
    for(let i=0;i<100;i++){present=app.windows().find(window=>window!==page);if(present)break;await new Promise(resolve=>setTimeout(resolve,50));}
    assert.ok(present);present.on('pageerror',error=>errors.push(String(error)));
    await present.getByText('Listen to your teacher. Get ready to work together.',{exact:true}).waitFor();
    assert.equal(await present.getByText('Describe the golden secret.',{exact:true}).count(),0);
    await button('Reveal content').click();await present.getByText('Describe the golden secret.',{exact:true}).waitFor();
    await present.waitForFunction(()=>Array.from(document.images).some(image=>image.naturalWidth===400));
    await button('Show scoreboard').click();await present.getByText('◆ Team 10 / 30     •     Objectives 0 / 1',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'Team Play',exact:true}).scrollIntoViewIfNeeded();await shot('control-desktop');await shot('present-desktop',present);
    await page.keyboard.press('a');await page.keyboard.press('Digit1');
    await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await pick(folder);await button('Save group lesson').click();await page.getByText('Lesson saved.',{exact:true}).waitFor();
    const saved=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));
    assert.deepEqual(Object.values(saved.sharedAdventure.live.scores),[5,5]);
    assert.equal(saved.sharedAdventure.preparation.students[0].deviceId,saved.sharedAdventure.preparation.students[1].deviceId);
    assert.notEqual(saved.sharedAdventure.preparation.students[0].deviceId,saved.sharedAdventure.preparation.students[2].deviceId);
    assert.equal(saved.assets.length,1);assert.equal(await fs.readFile(image,'hex'),await fs.readFile(path.join(folder,saved.assets[0].relativePath),'hex'));
    await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
    await button('Open group lesson').click();await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await button('New group lesson').click();await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await button('Save group lesson as').click();await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await pick(folder);
    await button('Award team').click();await button('Open group lesson').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();
    await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();await button('Undo points').click();await page.getByText('◆ Team 0 / 30',{exact:true}).waitFor();
    await button('Award team').click();await page.getByRole('checkbox',{name:'Work together and speak English',exact:true}).check();
    await button('Reset group session').click();await page.getByText('◆ Team 0 / 30',{exact:true}).waitFor();
    assert.equal(await page.getByRole('checkbox',{name:'Work together and speak English',exact:true}).isChecked(),false);
    assert.equal(await page.getByLabel('Device Student 2',{exact:true}).inputValue(),saved.sharedAdventure.preparation.students[1].deviceId);
    await page.setViewportSize({width:560,height:900});await shot('control-narrow');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.shared-adventure').evaluate(node=>node.scrollWidth>node.clientWidth),false);
    await present.setViewportSize({width:800,height:600});await shot('present-narrow',present);
    await present.reload();await present.getByText('Listen to your teacher. Get ready to work together.',{exact:true}).waitFor();
    await page.getByLabel('Award Student 3',{exact:true}).check();await button('Remove student',page.locator('.shared-student').nth(2)).click();
    await button('Award selected').click();await page.getByText('◆ Team 10 / 30',{exact:true}).waitFor();
    await button('✦ Story Studio').click();await button('Adventure').click();await pick(soloFolder);await button('Open project').click();await page.getByText('Lesson opened.',{exact:true}).waitFor();
    await button('Teach').click();await present.getByText('Listen to your teacher. Get ready to work together.',{exact:true}).waitFor({state:'detached'});
    assert.equal(await page.getByRole('heading',{name:'Team Play',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: group launch, three profiles/two devices, selected/team awards, exact undo, media copy, private hidden prompt, existing Presenter, save/reopen ledger, reset, narrow layout, Presenter reload, solo workflow.');
    console.log(`Evidence: ${evidence}\nDisposable lesson: ${folder}`);
  } catch(error) {
    for(const [index,window] of app.windows().entries()){await window.screenshot({path:path.join(evidence,`failure-${index}.png`)}).catch(()=>{});console.error((await window.locator('body').innerText()).slice(-5000));}
    throw error;
  } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
