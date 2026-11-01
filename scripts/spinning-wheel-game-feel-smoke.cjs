const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-wheel-runtime-'));
  const folder = path.join(temp, 'Lesson'), evidence = path.join(root, 'output/playwright/spinning-wheel-game-feel');
  await fs.mkdir(folder); await fs.mkdir(evidence, { recursive: true });
  const { createLesson, addCard, duplicateEntry } = require('../dist/main/shared/lesson/commands');
  const { insertBreak } = require('../dist/main/shared/lesson/sections');
  const { createWheelConfig, addWheelActivity } = require('../dist/main/shared/lesson/spinningWheel');
  let project = createLesson('Wheel runtime checks'); const ids = [], configs = [];
  for (const mode of ['alternating', 'randomized', 'teacher-selected', 'classic', 'missing']) {
    const added = insertBreak(project, 'story'); project = added.project;
    const entry = project.sequences.story.find(e => e.id === added.entryId); ids.push(entry.id);
    project.scenes[entry.sceneId].title = mode === 'classic' ? 'Classic review' : `Wheel ${mode}`;
    if (mode === 'classic') { configs.push(null); continue; }
    const card = addCard(project, entry.sceneId); project = card.project;
    const placement = project.scenes[entry.sceneId].objects.find(o => o.id === card.objectId);
    const definition = project.cards[placement.cardId]; definition.label = 'Recall Card';
    definition.faces[0].text = 'PUBLIC QUESTION'; definition.faces[1].text = 'SECRET ANSWER';
    placement.initialFaceId = definition.faces[1].id;
    let config = createWheelConfig();
    for (let i = 0; i < 8; i++) {
      config = addWheelActivity(config, i < 4 ? 'question' : 'event', i < 4 ? mode === 'missing' ? 'missing-card' : placement.cardId : undefined);
      config.activities[i].config = { label: i < 4 ? `Question ${i + 1}` : `Event ${i - 3}`, ...(i < 4 ? {} : { instructions: 'TEACHER PRIVATE: check the class.', studentText: 'Stand up and stretch!', surpriseStyle:['portal','chest','sprite'][i%3] }) };
    }
    config.settings = { ...config.settings, title: `Story wheel ${mode}`, playCount: 4, questionCount: 2, sequenceMode: mode === 'missing' ? 'alternating' : mode };
    project.scenes[entry.sceneId].breakExperience = config; configs.push(config);
  }
  const linked = duplicateEntry(project, 'story', ids[0], 'story', true); project = linked.project; ids.push(linked.entryId);
  const original = JSON.stringify(project); await fs.writeFile(path.join(folder, 'project.json'), original);
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('dialog', d => d.accept());
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1700, 1050));
    const button = name => page.getByRole('button', { name, exact: true });
    await button('Adventure').click();
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
    await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    await button('Edit').click(); await page.locator(`[data-entry-id="${ids[0]}"]`).click();
    // Existing Card editor still renders selected Card faces, rather than an empty live wheel plan.
    await page.getByRole('listbox', { name: 'Select a scene object' }).getByRole('option', { name: 'Recall Card', exact: true }).click();
    await page.locator('.lesson-canvas [data-scene-kind="card"]').waitFor();
    await button('Teach').click();
    const controls = page.getByRole('region', { name: 'Spinning Wheel controls', exact: true });
    const act = async name => {
      if (/^Show (Question|Event)$/.test(name)) { await page.locator('[data-wheel-phase="active"]').waitFor(); return; }
      return controls.getByRole('button', { name: ['Reveal Activity','Select Activity'].includes(name) ? 'Spin Wheel' : name, exact: true }).click();
    };
    await act('Start Game'); await act('Reveal Activity');
    await button('Open Present').click();
    let present = app.windows().find(w => w !== page) || await app.waitForEvent('window');
    present.setDefaultTimeout(15000); present.on('pageerror', e => errors.push(String(e)));
    const phase = async (name, progress) => {
      await present.locator(`[data-wheel-phase="${name}"]${progress === undefined ? '' : `[data-wheel-progress="${progress}"]`}`).waitFor();
      const snapshot = await present.evaluate(() => window.presentApi.requestSnapshot());
      const wire = JSON.stringify(snapshot); assert.equal(wire.includes('SECRET ANSWER'), false); assert.equal(wire.includes('TEACHER PRIVATE'), false);
      assert.equal(await present.getByRole('button', { name: 'Start Game', exact: true }).count(), 0);
      return snapshot.snapshot.target.plan.wheel;
    };
    // Connect and reload in flight, seek the same authoritative spin and send no frames over IPC.
    await present.locator('[data-wheel-motion="spinning"]').waitFor();
    const before = await present.evaluate(()=>window.presentApi.requestSnapshot());
    const spin = before.snapshot.target.plan.wheel.spin; assert.ok(spin); assert.equal(spin.durationMs,4800);
    assert.equal(await present.locator('.wheel-question').count(),0);
    await present.screenshot({path:path.join(evidence,'spinning-present.png')});
    await present.reload(); await present.locator('[data-wheel-motion="spinning"]').waitFor();
    const reloaded = await present.evaluate(()=>window.presentApi.requestSnapshot());
    assert.deepEqual(reloaded.snapshot.target.plan.wheel.spin,spin);
    assert.equal(reloaded.snapshot.target.plan.wheel.revision,before.snapshot.target.plan.wheel.revision);
    let view = await phase('active', 0);
    assert.equal(view.spin.id,spin.id);
    const angle = Number((await present.locator('.wheel-graphic > g').getAttribute('transform')).match(/rotate\(([-.0-9]+)/)[1]);
    assert.equal(angle,spin.toDegrees);
    // Explicit face changes send only the chosen face; ordinary snapshots never include the answer.
    await controls.getByLabel('Card face',{exact:true}).selectOption({index:1});
    await present.getByText('SECRET ANSWER',{exact:true}).waitFor();
    const answerWire=JSON.stringify(await present.evaluate(()=>window.presentApi.requestSnapshot()));
    assert.equal(answerWire.includes('PUBLIC QUESTION'),false);
    await controls.getByLabel('Card face',{exact:true}).selectOption({index:0});
    await present.getByText('PUBLIC QUESTION',{exact:true}).waitFor();
    await app.evaluate(({ BrowserWindow })=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('present.html'));w.setSize(1460,900);});
    const feedback=controls.getByRole('region',{name:'Game rewards and magic',exact:true});
    const total=async()=> (await present.evaluate(()=>window.presentApi.requestSnapshot())).snapshot.target.plan.wheel.rewardIndicator.total;
    await controls.getByLabel('Game sounds',{exact:true}).check();
    await feedback.getByLabel('Reward amount',{exact:true}).fill('3');
    await feedback.getByRole('button',{name:'Award reward',exact:true}).dblclick();
    await present.locator('.game-effects[data-effect-kind="stars"][data-effect-status="active"]').waitFor();
    assert.equal(await total(),3);
    await present.waitForTimeout(600); await present.screenshot({path:path.join(evidence,'star-explosion.png')});
    const effectBefore=(await present.evaluate(()=>window.presentApi.requestSnapshot())).snapshot.target.plan.wheel.effect;
    await present.reload();
    const effectAfter=(await present.evaluate(()=>window.presentApi.requestSnapshot())).snapshot.target.plan.wheel.effect;
    assert.equal(effectAfter.id,effectBefore.id);assert.equal(await total(),3);
    await feedback.getByRole('button',{name:'Replay animation',exact:true}).dblclick();
    const replayed=(await present.evaluate(()=>window.presentApi.requestSnapshot())).snapshot.target.plan.wheel.effect;
    assert.notEqual(replayed.id,effectBefore.id);assert.equal(await total(),3);
    for(const kind of ['coins','portal','chest','sprite','crown']) {
      await feedback.getByLabel('Game animation',{exact:true}).selectOption(kind);
      await feedback.getByRole('button',{name:'Play animation',exact:true}).click();
      await present.locator(`.game-effects[data-effect-kind="${kind}"][data-effect-status="active"]`).waitFor();
      if(kind==='coins') {
        const intervals=await present.evaluate(()=>new Promise(resolve=>{const list=[];let previous=performance.now();const run=now=>{list.push(now-previous);previous=now;list.length<45?requestAnimationFrame(run):resolve(list);};requestAnimationFrame(run);}));
        console.log('Coin effect frame intervals (ms): median',intervals.sort((a,b)=>a-b)[22].toFixed(1),'max',Math.max(...intervals).toFixed(1));
      } else await present.waitForTimeout(kind==='chest'?1300:650);
      await present.screenshot({path:path.join(evidence,`${kind}-effect.png`)});
      assert.equal(await total(),3);
    }
    await feedback.getByRole('button',{name:'Skip animation',exact:true}).click();
    assert.equal(await present.locator('.game-effects').count(),0);
    await feedback.getByRole('button',{name:'Encourage another try',exact:true}).click();
    await present.locator('.game-effects[data-effect-kind="sprite"]').waitFor();assert.equal(await total(),3);
    await feedback.getByRole('button',{name:'Confirm outcome',exact:true}).click();
    assert.equal(await feedback.getByRole('button',{name:'Award reward',exact:true}).count(),0);
    await feedback.getByRole('button',{name:'Skip animation',exact:true}).click();
    await controls.getByLabel('Game sounds',{exact:true}).uncheck();
    await page.emulateMedia({reducedMotion:'reduce'}); await present.emulateMedia({reducedMotion:'reduce'}); assert.equal(view.activity.kind, 'question');
    assert.ok((await present.locator('.wheel-question').innerText()).includes('PUBLIC QUESTION'));
    const selected = view.selectedSegmentId;
    page.removeAllListeners('dialog'); page.once('dialog', dialog => dialog.dismiss());
    await button('Reset scene').click(); await phase('active', 0);
    page.on('dialog', dialog => dialog.accept());
    await present.screenshot({ path: path.join(evidence, 'question-present.png') }); await page.screenshot({ path: path.join(evidence, 'question-teach.png') });
    await present.reload(); view = await phase('active', 0); assert.equal(view.selectedSegmentId, selected);
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('present.html')); w.setMinimumSize(320, 320); w.setSize(620, 960); });
    await present.waitForFunction(() => window.innerWidth < 700); await present.screenshot({ path: path.join(evidence, 'portrait-present.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('present.html')).setSize(1280, 800));
    // A linked occurrence shares configuration but never the live game.
    await page.locator(`[data-entry-id="${ids[5]}"]`).click(); await phase('ready', 0);
    await page.locator(`[data-entry-id="${ids[0]}"]`).click(); view = await phase('active', 0); assert.equal(view.selectedSegmentId, selected);
    await act('Reset Game'); await act('Cancel'); await phase('active', 0);
    await act('Reset Game'); await act('Confirm reset'); await phase('ready', 0);
    await act('Start Game'); await act('Reveal Activity'); await act('Skip Activity'); await phase('activity-complete', 1);
    await act('Next Activity');
    await page.emulateMedia({reducedMotion:'no-preference'}); await present.emulateMedia({reducedMotion:'no-preference'});
    await act('Reveal Activity'); await act('Show Event');
    await present.getByText('Something magical is coming…',{exact:true}).waitFor();
    assert.equal(await present.locator('.wheel-student-event').count(),0);
    await present.screenshot({path:path.join(evidence,'event-suspense.png')});
    await present.locator('.wheel-student-event').waitFor();
    await page.emulateMedia({reducedMotion:'reduce'}); await present.emulateMedia({reducedMotion:'reduce'});
    view = await phase('active', 1); assert.equal(view.activity.studentText, 'Stand up and stretch!');
    assert.ok((await controls.innerText()).includes('TEACHER PRIVATE'));
    await present.screenshot({ path: path.join(evidence, 'event-present.png') });
    await act('Complete Activity'); await phase('activity-complete', 2);
    for (const kind of ['Question', 'Event']) {
      await act('Next Activity'); await act('Reveal Activity'); await act(`Show ${kind}`); await act('Complete Activity');
    }
    await phase('session-complete', 4); await present.screenshot({ path: path.join(evidence, 'complete-present.png') });
    await act('Continue lesson'); await phase('ready', 0);
    await page.locator(`[data-entry-id="${ids[1]}"]`).click(); await act('Start Game'); await act('Reveal Activity');
    await page.locator('[data-wheel-phase="active"]').waitFor(); await phase('active', 0);
    await act('Finish Game'); await act('Confirm finish'); await phase('session-complete', 0);
    await page.locator(`[data-entry-id="${ids[2]}"]`).click(); await act('Start Game');
    const event = configs[2].activities.find(a => a.kind === 'event'), segment = configs[2].settings.segments.find(s => s.activityId === event.id);
    await controls.getByLabel('Choose an activity', { exact: true }).selectOption(segment.id);
    await act('Select Activity'); view = await phase('revealed', 0); assert.equal(view.selectedSegmentId, segment.id);
    await act('Show Event'); await phase('active', 0);
    // Reduced-motion effects draw an opaque, static emblem and clean up at expiry.
    await feedback.getByLabel('Game animation',{exact:true}).selectOption('portal');
    await feedback.getByRole('button',{name:'Play animation',exact:true}).click();
    await present.locator('.game-effects[data-effect-status="active"]').waitFor();
    const opaquePixels=await present.locator('.game-effects canvas').evaluate(canvas=>{const c=canvas.getContext('2d'),d=c.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i]>200)count++;return count;});
    assert.ok(opaquePixels>1000,`Static reduced-motion emblem must be visible: ${opaquePixels}`);
    await present.screenshot({path:path.join(evidence,'reduced-motion-portal.png')});
    await present.locator('.game-effects[data-effect-status="finished"]').waitFor({state:'attached'});
    await feedback.getByRole('button',{name:'Skip animation',exact:true}).click();
    assert.equal(await present.locator('.game-effects canvas').count(),0);
    // Close/reopen restores the same state using the retained relay snapshot.
    await present.close(); await button('Open Present').click();
    present = app.windows().find(w => w !== page) || await app.waitForEvent('window'); present.setDefaultTimeout(15000);
    present.on('pageerror', e => errors.push(String(e))); view = await phase('active', 0); assert.equal(view.selectedSegmentId, segment.id);
    await page.locator(`[data-entry-id="${ids[4]}"]`).click(); view = await phase('ready', 0); assert.equal(view.blocked, false);
    assert.equal(await controls.getByRole('button', { name: 'Start Game', exact: true }).isDisabled(), false);
    await page.locator(`[data-entry-id="${ids[3]}"]`).click(); await present.getByText('Review together', { exact: true }).waitFor();
    assert.equal(await present.locator('[data-wheel-phase]').count(), 0);
    // Leave and return during a full spin, then reset before landing. Old timers cannot reveal again.
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator(`[data-entry-id="${ids[5]}"]`).click(); await phase('ready',0);
    await controls.getByLabel('Game sounds',{exact:true}).check();
    await act('Start Game'); await act('Reveal Activity');
    await present.locator('[data-wheel-motion="spinning"]').waitFor();
    const running = (await present.evaluate(()=>window.presentApi.requestSnapshot())).snapshot.target.plan.wheel.spin;
    const frames = await present.evaluate(()=>new Promise(resolve=>{
      const samples=[]; let previous=performance.now();
      const frame=now=>{samples.push(now-previous);previous=now;if(samples.length<30)requestAnimationFrame(frame);else resolve(samples);};requestAnimationFrame(frame);
    }));
    console.log('Animation frame intervals (ms): median',frames.sort((a,b)=>a-b)[15].toFixed(1),'max',Math.max(...frames).toFixed(1));
    await page.locator(`[data-entry-id="${ids[3]}"]`).click(); await present.getByText('Review together',{exact:true}).waitFor();
    await page.locator(`[data-entry-id="${ids[5]}"]`).click(); await phase('revealed',0);
    assert.equal((await present.evaluate(()=>window.presentApi.requestSnapshot())).snapshot.target.plan.wheel.spin.id,running.id);
    await act('Reset Game'); await act('Confirm reset'); await phase('ready',0);
    await controls.getByLabel('Game sounds',{exact:true}).uncheck();
    await page.waitForTimeout(Math.max(0,running.startedAt+running.durationMs-Date.now())+150);
    await phase('ready',0);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), original);
    assert.deepEqual(errors, []);
    console.log('PASS: six fantasy effects, batch reward exactly once, visual replay without scoring, in-flight effect reload, encouragement, skip/confirm, timed animation, late in-flight connection/reload, exact landing, no frame messages, intentional Card face privacy, reduced motion,  all sequence modes, quotas, skip/reset/finish, Card editor/privacy, late/reloaded/reopened Present, linked occurrence return, missing Cards, Classic, portrait layout and no authored mutation.');
  } catch (error) {
    for (const [i, w] of app.windows().entries()) { await w.screenshot({ path: path.join(evidence, `failure-${i}.png`) }); console.error((await w.locator('body').innerText()).slice(-5000)); }
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
