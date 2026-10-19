/* Real Electron legacy consumers, disposable synthetic project only.
 * Build renderer/main and compile shared tests first. Only native dialogs mocked. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
function playwright() {
  if (process.env.STORY_STUDIO_PLAYWRIGHT) return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try { return require('playwright'); } catch (e) { if(e.code!=='MODULE_NOT_FOUND')throw e; return require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-phase6b-legacy-'));
  const folder = path.join(temp, 'Legacy synthetic'), assets = path.join(folder, 'assets');
  const evidence = path.join(root, 'docs/phase6b-evidence/legacy');
  await fs.mkdir(assets, { recursive: true }); await fs.mkdir(evidence, { recursive: true });
  const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
  ffmpeg(['-f','lavfi','-i','color=c=0x276d8b:s=320x180','-frames:v','1',path.join(assets,'image.png')]);
  ffmpeg(['-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5',path.join(assets,'voice.wav')]);
  const asset = (id, filename, mediaType) => ({id,filename,originalName:filename,relativePath:`assets/${filename}`,mediaType,sizeBytes:1,importedAt:new Date().toISOString()});
  let data = {version:4,createdAt:'2026-10-12',updatedAt:'2026-10-12',assets:[asset('picture','image.png','image'),asset('voice','voice.wav','audio')],sections:[{id:'story',name:'Native legacy'}],slides:[{id:'slide',sectionId:'story',assetId:'picture',transition:'none',dialogue:[{url:'assets/voice.wav',name:'Native voice',volume:.15}]}],boostPack:{activationSequence:[],languageSequence:[],gamesSequence:[]},badgeImageAssetId:'picture',badgeConfig:{background:{assetId:'picture'},tabBackground:{assetId:'picture'},celebrationDurationMs:30000},sparkStudents:[{id:'student',name:'Native student',yellowSparks:1,blueSparks:0,pinkSparks:0,crowns:0,stars:0,badgeVisible:true}],activeStudentId:'student'};
  const { addCardToHost } = require('../dist-test/shared/cardAuthoring'); let serial=0;
  data=addCardToHost(data,{kind:'slide',id:'slide'},()=>`native-${++serial}`).data;
  const card=Object.values(data.cardsV2.cards)[0]; card.faces[0].layout='image-only';card.faces[0].imageAssetId='picture';card.faces[0].alt='Native scoped card';
  const file=path.join(folder,'project.json');await fs.writeFile(file,JSON.stringify(data));
  const before=sha(await fs.readFile(file)), imageBefore=sha(await fs.readFile(path.join(assets,'image.png'))), audioBefore=sha(await fs.readFile(path.join(assets,'voice.wav')));
  const app=await playwright()._electron.launch({executablePath:require('electron'),cwd:root,args:[root,`--user-data-dir=${path.join(temp,'profile')}`]});
  let page; const passed=[],errors=[];
  const pass=name=>{passed.push(name);console.log('PASS',name);};
  try {
    page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
    await page.goto(page.url().split('?')[0]+'?legacy=1');
    const button=name=>page.getByRole('button',{name,exact:true});
    await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);
    await button('Open Project').click(); await button('Switch to Edit').click();
    await page.locator('.media-pool img').first().waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.media-pool img')].some(img=>img.complete&&img.naturalWidth&&img.src.startsWith('media://scoped/')));
    const cardUrls = async target => target.locator('.card-v2-scene image').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')||node.getAttribute('xlink:href')));
    await page.waitForFunction(()=>[...document.querySelectorAll('.card-v2-scene image')].some(img=>(img.getAttribute('href')||'').startsWith('media://scoped/')));
    const assertDecoded=async(target,urls)=>{assert.ok(urls.length,'Card has an image');for(const url of urls){assert.ok(url.startsWith('media://scoped/'));assert.equal(await target.evaluate(url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=url;}),url),true);}};
    await assertDecoded(page,await cardUrls(page));
    pass('Legacy Media Pool and CardV2 editor image use decoded scoped grants');
    await page.screenshot({path:path.join(evidence,'edit.png')});
    await button('Edit').click();await button('Open / Reopen Present').click();
    const present=app.windows().find(p=>p!==page)||await app.waitForEvent('window');present.setDefaultTimeout(15000);present.on('pageerror',e=>errors.push(String(e)));
    await present.locator('.card-v2-scene image').first().waitFor();await assertDecoded(present,await cardUrls(present));
    pass('Legacy CardV2 image renders in actual Present');
    const audio=page.getByRole('region',{name:'Slide audio'});
    await audio.getByRole('button',{name:'Play',exact:true}).click();await audio.getByText('Playing',{exact:true}).waitFor();
    await audio.getByRole('button',{name:'Stop',exact:true}).click();pass('Legacy dialogue preload and actual playback succeed');
    await button('Badges / students').click();await button('Show Final Badge').click();
    await present.waitForFunction(()=>[...document.querySelectorAll('.badge-background-img')].some(img=>img.src.startsWith('media://scoped/')&&img.complete&&img.naturalWidth>0));
    const snapshot=await present.evaluate(()=>window.presentApi.requestSnapshot());
    assert.ok(snapshot.snapshot.rewards?.final?.image?.startsWith('media://scoped/'),'Final reward projection includes scoped background');
    await present.screenshot({path:path.join(evidence,'reward-present.png')});pass('Legacy reward presentation renders scoped custom background');
    assert.equal(sha(await fs.readFile(file)),before);assert.equal(sha(await fs.readFile(path.join(assets,'image.png'))),imageBefore);assert.equal(sha(await fs.readFile(path.join(assets,'voice.wav'))),audioBefore);assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(evidence,'results.json'),JSON.stringify({passed,errors,temporary:temp,sourceUnchanged:true,originalLessonsTouched:false},null,2));
  } catch(error) {if(page)await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});await fs.writeFile(path.join(evidence,'failure.json'),JSON.stringify({passed,errors,failure:String(error.stack||error),temporary:temp},null,2));throw error;}
  finally {
    // Legacy session/reward controls can dirty the disposable in-memory project.
    // Exit the isolated process without a save-confirmation dialog or disk write.
    await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
    await app.close().catch(()=>{});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

