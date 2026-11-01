const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-wheel-runtime-'));
  const folder = path.join(temp, 'Lesson'), evidence = path.join(root, 'output/playwright/wheel-authoring-usability');
  await fs.mkdir(folder); await fs.mkdir(evidence, { recursive: true });
  const { createLesson, createScene, insertScene, addCard, duplicateEntry } = require('../dist/main/shared/lesson/commands');
  const { insertBreak } = require('../dist/main/shared/lesson/sections');
  const { createWheelConfig, addWheelActivity } = require('../dist/main/shared/lesson/spinningWheel');
  let project = insertScene(createLesson('Wheel runtime checks'),'story',createScene('Earlier live scene')).project; const ids = [], configs = [];
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
      config.activities[i].config = { label: i < 4 ? `Question ${i + 1}` : `Event ${i - 3}`, ...(i < 4 ? {} : { instructions: 'TEACHER PRIVATE: check the class.', studentText: 'Stand up and stretch!' }) };
    }
    config.settings = { ...config.settings, title: `Story wheel ${mode}`, playCount: 4, questionCount: 2, sequenceMode: mode === 'missing' ? 'alternating' : mode };
    project.scenes[entry.sceneId].breakExperience = config; configs.push(config);
  }
  const linked = duplicateEntry(project, 'story', ids[0], 'story', true); project = linked.project; ids.push(linked.entryId);
  const legacy=insertBreak(project,'story');project=legacy.project;const legacyEntry=project.sequences.story.find(e=>e.id===legacy.entryId);project.scenes[legacyEntry.sceneId].breakExperience={...configs[0],configVersion:1,settings:{}};
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
    await button('Open Present').click();
    const priorPresent=app.windows().find(w=>w!==page)||await app.waitForEvent('window');
    await priorPresent.getByText('Earlier live scene',{exact:true}).count();
    await button('Edit').click(); await page.locator(`[data-entry-id="${ids[0]}"]`).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    const beforePractice=await priorPresent.evaluate(()=>window.presentApi.requestSnapshot());
    await button('Test game').click();
    const practice=page.getByRole('dialog',{name:'Test mini-game',exact:true});await practice.waitFor();
    await practice.getByRole('button',{name:'Start Game',exact:true}).click();await practice.getByRole('button',{name:'Spin Wheel',exact:true}).click();
    await practice.locator('[data-wheel-phase="active"]').waitFor();
    await practice.getByRole('button',{name:'Award reward',exact:true}).click();
    await practice.getByText('Class: 1 total. Animations never change scores.',{exact:true}).waitFor();
    await page.screenshot({path:path.join(evidence,'edit-practice.png')});
    assert.deepEqual((await priorPresent.evaluate(()=>window.presentApi.requestSnapshot())).snapshot,beforePractice.snapshot);
    await practice.getByRole('button',{name:'Close test',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'Test mini-game',exact:true}).count(),0);
    await button('Test game').click();await practice.getByRole('button',{name:'Start Game',exact:true}).waitFor();
    await practice.press('Escape');await practice.waitFor({state:'detached'});
    const editor=page.getByRole('region',{name:'Spinning Wheel setup',exact:true});
    const gaps=await page.locator('.mini-game-editor .wheel-editor').evaluate(node=>({gap:parseFloat(getComputedStyle(node).rowGap),labelMargin:parseFloat(getComputedStyle(node.querySelector('label')).marginBottom)}));
    assert.ok(gaps.gap<=8);assert.equal(gaps.labelMargin,0);
    await page.screenshot({path:path.join(evidence,'compact-break-editor.png')});
    // Existing Card editor still renders selected Card faces, rather than an empty live wheel plan.
    await page.getByRole('listbox', { name: 'Select a scene object' }).getByRole('option', { name: 'Recall Card', exact: true }).click();
    await page.locator('.lesson-canvas [data-scene-kind="card"]').waitFor();
    await button('Teach').click();
    const controls = page.getByRole('region', { name: 'Spinning Wheel controls', exact: true });
    await page.emulateMedia({reducedMotion:'reduce'});
    const act = async name => {
      if (/^Show (Question|Event)$/.test(name)) { await page.locator('[data-wheel-phase="active"]').waitFor(); return; }
      return controls.getByRole('button', { name: ['Reveal Activity','Select Activity'].includes(name) ? 'Spin Wheel' : name, exact: true }).click();
    };
    await controls.waitFor({timeout:4000});
    await act('Start Game'); await act('Reveal Activity'); await act('Show Question');
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
    let view = await phase('active', 0); assert.equal(view.activity.kind, 'question');
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
    await act('Next Activity'); await act('Reveal Activity'); await act('Show Event');
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
    // Close/reopen restores the same state using the retained relay snapshot.
    await present.close(); await button('Open Present').click();
    present = app.windows().find(w => w !== page) || await app.waitForEvent('window'); present.setDefaultTimeout(15000);
    present.on('pageerror', e => errors.push(String(e))); view = await phase('active', 0); assert.equal(view.selectedSegmentId, segment.id);
    await page.locator(`[data-entry-id="${ids[4]}"]`).click(); view = await phase('ready', 0); assert.equal(view.blocked, true);
    assert.equal(await controls.getByRole('button', { name: 'Start Game', exact: true }).isDisabled(), true);
    await page.locator(`[data-entry-id="${ids[3]}"]`).click(); await present.getByText('Review together', { exact: true }).waitFor();
    assert.equal(await present.locator('[data-wheel-phase]').count(), 0);
    await button('Edit').click();await page.locator(`[data-entry-id="${legacy.entryId}"]`).click();await button('Test game').click();
    await practice.getByRole('button',{name:'Start Game',exact:true}).click();await practice.getByRole('button',{name:'Spin Wheel',exact:true}).click();await practice.locator('[data-wheel-phase="active"]').waitFor();await practice.getByRole('button',{name:'Close test',exact:true}).click();
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('present.html'));w.setMinimumSize(640,640);w.setSize(780,900);});
    await button('Test game').click();await practice.getByRole('button',{name:'Start Game',exact:true}).waitFor();
    assert.ok(await practice.evaluate(n=>n.getBoundingClientRect().right<=window.innerWidth));
    await page.screenshot({path:path.join(evidence,'edit-practice-narrow.png')});await practice.getByRole('button',{name:'Close test',exact:true}).click();
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), original);
    assert.deepEqual(errors, []);
    console.log('PASS: previous-live-scene Teach regression, isolated Edit practice spins/rewards, Escape cleanup, compact spacing, legacy wheel sandbox, narrow practice layout,  all sequence modes, quotas, skip/reset/finish, Card editor/privacy, late/reloaded/reopened Present, linked occurrence return, missing Cards, Classic, portrait layout and no authored mutation.');
  } catch (error) {
    for (const [i, w] of app.windows().entries()) { await w.screenshot({ path: path.join(evidence, `failure-${i}.png`) }); console.error((await w.locator('body').innerText()).slice(-5000)); }
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
