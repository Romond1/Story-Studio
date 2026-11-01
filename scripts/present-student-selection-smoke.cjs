/* Native Present selection regression: real Electron, persistent student service and teacher UI. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
function playwright() {
  try { return require(process.env.STORY_STUDIO_PLAYWRIGHT || 'playwright'); }
  catch { return require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
}
(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-present-students-'));
  const folder = path.join(temp, 'Episode');
  const evidence = process.env.STORY_STUDIO_EVIDENCE || path.join(temp, 'evidence');
  await fs.mkdir(evidence, { recursive: true });
  await require('./phase6f-fixture.cjs')(folder, 'present-students-adventure');
  const passed = [], errors = [];
  const pass = name => { passed.push(name); console.log('PASS', name); };
  let app, page, present;
  try {
    app = await playwright()._electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
    page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.accept());
    const button = name => page.getByRole('button', { name, exact: true });
    const seeded = await page.evaluate(async () => {
      for (let i = 0; i < 12; i++) await window.appApi.students.createProfile({ name: `Private roster student ${i + 1}`, nickname: `Hero ${i + 1}`, avatar: 'star' });
      let state = await window.appApi.students.getSnapshot();
      state = await window.appApi.students.createClass({ name: 'Whole class' });
      const whole = state.classes.find(group => group.name === 'Whole class');
      await window.appApi.students.updateClass({ id: whole.id, studentIds: state.studentRoster.map(student => student.id) });
      state = await window.appApi.students.createClass({ name: 'Small class' });
      const small = state.classes.find(group => group.name === 'Small class');
      await window.appApi.students.updateClass({ id: small.id, studentIds: state.studentRoster.slice(0, 2).map(student => student.id) });
      state = await window.appApi.students.selectClass({ id: whole.id });
      return { students: state.studentRoster, whole: whole.id, small: small.id };
    });
    await page.reload();
    const openLesson = async () => {
      await button('Adventure').click();
      await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
      await button('Open project').click();
      await page.getByText('Lesson opened.', { exact: true }).waitFor();
      await button('Teach').click();
      const summary = page.locator('summary').filter({ hasText: /^Present roster settings$/ });
      if (!await summary.evaluate(el => el.parentElement.open)) await summary.click();
    };
    await openLesson();
    const selection = () => page.locator('fieldset').filter({ has: page.locator('legend').filter({ hasText: /^Show in Present/ }) });
    const participantPanel = page.locator('.teach-students details').filter({ has: page.locator('summary').filter({ hasText: /^Participants/ }) }).first();
    if (!await participantPanel.evaluate(el => el.open)) await participantPanel.locator('summary').first().click();
    await button('Clear participants').click();
    await participantPanel.getByLabel(seeded.students[0].name, { exact: true }).check();
    assert.equal(await participantPanel.locator('input:checked').count(), 1);
    assert.equal(await selection().locator('input:checked').count(), 12);
    await page.getByLabel('Show roster in Present', { exact: true }).check();
    await page.getByLabel('Show reward totals', { exact: true }).check();
    await button('Open Present').click();
    present = app.windows().find(window => window !== page) || await app.waitForEvent('window');
    present.setDefaultTimeout(20000); present.on('pageerror', error => errors.push(String(error)));
    await present.waitForFunction(() => document.querySelectorAll('.present-roster-entry').length === 12);
    assert.equal(await participantPanel.locator('input:checked').count(), 1);
    await present.screenshot({ path: path.join(evidence, 'present-all-twelve.png') });
    pass('All twelve selected students appear in Present independently of one activity participant');
    for (const student of seeded.students.slice(10)) await selection().getByLabel(student.name, { exact: true }).uncheck();
    await present.waitForFunction(() => document.querySelectorAll('.present-roster-entry').length === 10);
    assert.equal(await participantPanel.locator('input:checked').count(), 1);
    await page.getByLabel('Active class', { exact: true }).selectOption(seeded.small);
    await present.waitForFunction(() => document.querySelectorAll('.present-roster-entry').length === 2);
    await page.getByLabel('Active class', { exact: true }).selectOption(seeded.whole);
    await present.waitForFunction(() => document.querySelectorAll('.present-roster-entry').length === 10);
    assert.equal(await selection().locator('input:checked').count(), 10);
    pass('Deselecting two students changes only Present and saved selections survive switching classes');
    await page.getByLabel('Reward student', { exact: true }).selectOption(seeded.students[0].id);
    await button('Award yellow').click();
    await present.waitForFunction(async () => (await window.presentApi.requestSnapshot()).snapshot.roster?.entries[0]?.rewards === 1);
    const safe = await present.evaluate(async () => (await window.presentApi.requestSnapshot()).snapshot.roster);
    assert.equal(safe.entries[0].rewards, 1);
    const fullSnapshot = await present.evaluate(async () => (await window.presentApi.requestSnapshot()).snapshot);
    for (const student of seeded.students) assert.equal(JSON.stringify(fullSnapshot).includes(student.name), false, 'Reward animations must use public names');
    await button('Show celebration').click();
    await present.waitForFunction(async () => { const packet = (await window.presentApi.requestSnapshot()).snapshot; return packet.target?.plan?.rewards?.final?.students?.some(student => student.name === 'Hero 1') && !JSON.stringify(packet).includes('Private roster student'); });
    await selection().getByLabel(seeded.students[0].name, { exact: true }).uncheck();
    await present.waitForFunction(async () => { const packet = (await window.presentApi.requestSnapshot()).snapshot; return packet.roster?.entries.length === 9 && !JSON.stringify(packet).includes(JSON.stringify('Hero 1')); });
    const hidden = await present.evaluate(async () => (await window.presentApi.requestSnapshot()).snapshot);
    assert.equal(JSON.stringify(hidden).includes(seeded.students[0].name), false);
    assert.equal(JSON.stringify(hidden).includes(JSON.stringify('Hero 1')), false, 'Deselected reward student is absent from sparks and celebration');
    await selection().getByLabel(seeded.students[0].name, { exact: true }).check();
    await present.waitForFunction(async () => (await window.presentApi.requestSnapshot()).snapshot.roster?.entries.some(entry => entry.nickname === 'Hero 1' && entry.rewards === 1));
    await button('Hide celebration').click();
    pass('Present reward animations and celebrations follow selected public identities while preserving earned balances');
    for (const student of seeded.students) for (const secret of [student.id, student.name]) assert.equal(JSON.stringify(safe).includes(secret), false);
    for (const entry of safe.entries) assert.ok(Object.keys(entry).every(key => ['nickname', 'avatar', 'score', 'rewards', 'relicProgress'].includes(key)));
    assert.equal(await present.evaluate(() => typeof window.appApi?.students), 'undefined');
    pass('Reward totals refresh from session awards and roster packets expose only public fields');
    for (const [width, height] of [[1184, 720], [620, 360]]) {
      await present.setViewportSize({ width, height });
      const geometry = await present.evaluate(() => {
        const band = document.querySelector('.present-roster').getBoundingClientRect();
        const story = document.querySelector('.present-story-layers').getBoundingClientRect();
        return { band: { top: band.top, bottom: band.bottom, right: band.right }, story: { bottom: story.bottom } };
      });
      assert.ok(geometry.story.bottom <= geometry.band.top + 1);
      assert.ok(geometry.band.bottom <= height + 1 && geometry.band.right <= width + 1);
      await present.screenshot({ path: path.join(evidence, `present-${width}.png`) });
    }
    pass('Multirow roster keeps story space separate at desktop and narrow viewport sizes');
    await page.reload();
    await openLesson();
    assert.equal(await selection().locator('input:checked').count(), 10);
    assert.equal(await selection().getByLabel(seeded.students[11].name, { exact: true }).isChecked(), false);
    await button('Select all students').click();
    assert.equal(await selection().locator('input:checked').count(), 12);
    await button('Clear Present selection').click();
    assert.equal(await selection().locator('input:checked').count(), 0);
    pass('Class selection survives reload and select all/clear remain usable');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ passed, errors, temp, safeRoster: safe }, null, 2));
    console.log(JSON.stringify({ passed, evidence }));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, 'failure-control.png') }).catch(() => {});
    if (present) await present.screenshot({ path: path.join(evidence, 'failure-present.png') }).catch(() => {});
    await fs.writeFile(path.join(evidence, 'failure.json'), JSON.stringify({ passed, errors, temp, error: String(error.stack || error) }, null, 2));
    throw error;
  } finally {
    if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
