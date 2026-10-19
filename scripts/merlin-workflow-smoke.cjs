/* Focused Edit/Teach/Control/Present gate. Native folder selection is replaced;
 * the actual lesson UI, persistence and Presenter relay remain real. No camera. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(process.env.STORY_STUDIO_PLAYWRIGHT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const commands = require('../dist-test/shared/lesson/commands');

(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-merlin-workflow-'));
  const folder = path.join(temp, 'lesson'), evidence = path.join(root, 'docs/merlin-phase1-evidence/core-workflows');
  await fs.mkdir(folder); await fs.mkdir(evidence, { recursive: true });
  let project = commands.createLesson('Merlin phase 1 workflow check');
  for (const [title, color] of [['First scene', '#123456'], ['Second scene', '#abcdef']]) {
    const scene = commands.createScene(title); scene.background.color = color;
    project = commands.insertScene(project, 'story', scene).project;
  }
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root,
    args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  const errors = [], passed = []; let page, present;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
    const button = name => page.getByRole('button', { name, exact: true });
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
    await button('Adventure').click(); await button('Open project').click(); await button('Edit').click();
    await button('Add Bubble').click(); await page.getByLabel('Bubble text', { exact: true }).fill('Merlin workflow regression text');
    await button('Save').click();
    await page.waitForFunction(() => !document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved'));
    const saved = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
    assert.ok(saved.includes('Merlin workflow regression text'));
    passed.push('Edit creates a Bubble and saves authored text');
    await button('Open Present').click();
    present = app.windows().find(window => window !== page) || await app.waitForEvent('window');
    present.on('pageerror', error => errors.push(String(error)));
    await present.getByText('Merlin workflow regression text', { exact: true }).waitFor();
    assert.equal(await present.locator('button,input,select').count(), 0);
    passed.push('Present renders authored content without Control tools');
    await button('Teach').click();
    await page.getByRole('region', { name: 'Face Tracking', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Merlin developer diagnostics', exact: true }).count(), 0);
    await button('Next scene').click();
    await present.getByText('Merlin workflow regression text', { exact: true }).waitFor({ state: 'hidden' });
    await button('Previous scene').click();
    await present.getByText('Merlin workflow regression text', { exact: true }).waitFor();
    passed.push('Teach navigation updates Present while diagnostics remain opt-in');
    await page.keyboard.press('Control+Alt+Shift+M');
    const diagnostics = page.getByRole('region', { name: 'Merlin developer diagnostics', exact: true });
    await diagnostics.waitFor(); await diagnostics.getByRole('button', { name: 'Close diagnostics', exact: true }).click();
    await button('Edit').click();
    assert.ok((await fs.readFile(path.join(folder, 'project.json'), 'utf8')).includes('Merlin workflow regression text'));
    await button('Teach').click();
    assert.equal(await page.getByRole('region', { name: 'Merlin developer diagnostics', exact: true }).count(), 0);
    assert.equal((await page.evaluate(() => window.cameraControl.get())).settings.enabled, false);
    passed.push('Developer UI opens/closes privately; Edit/Teach transitions preserve content and camera state');
    await page.screenshot({ path: path.join(evidence, 'teach-control.png') });
    await present.screenshot({ path: path.join(evidence, 'authored-present.png') });
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ passed, errors, temp }, null, 2));
    passed.forEach(name => console.log('PASS', name));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, 'failure-control.png') }).catch(() => {});
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
