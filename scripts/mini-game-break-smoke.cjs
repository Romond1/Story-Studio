const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-mini-break-'));
  const folder = path.join(temp, 'Lesson');
  const evidence = path.join(root, 'output/playwright/mini-game-break');
  await fs.mkdir(folder); await fs.mkdir(evidence, { recursive: true });
  const { createLesson } = require('../dist/main/shared/lesson/commands');
  const { insertBreak } = require('../dist/main/shared/lesson/sections');
  const { defaultExperience } = require('../dist/main/shared/lesson/miniGameBreak');
  let project = createLesson('Mini-game architecture');
  const ids = [];
  for (const title of ['Classic break', 'Planned break', 'Unknown break']) {
    const added = insertBreak(project, 'story'); project = added.project;
    const entry = project.sequences.story.find(e => e.id === added.entryId);
    const scene = project.scenes[entry.sceneId]; scene.title = title; ids.push(entry.id);
    if (title !== 'Classic break') scene.breakExperience = defaultExperience(title === 'Planned break' ? 'spinning-wheel' : 'future-game');
  }
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('dialog', d => d.accept()); const errors = []; page.on('pageerror', e => errors.push(String(e)));
    const button = name => page.getByRole('button', { name, exact: true });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1600, 1000));
    await button('Adventure').click();
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
    await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    await button('Edit').click();
    const entry = i => page.locator(`[data-entry-id="${ids[i]}"]`);
    await entry(0).click();
    const inspector = page.getByRole('region', { name: 'Break Inspector', exact: true });
    assert.equal(await inspector.getByLabel('Mode', { exact: true }).inputValue(), 'classic');
    assert.equal(await page.locator('.lesson-canvas [data-mini-game-status]').count(), 0);
    await inspector.getByLabel('Mode', { exact: true }).selectOption('minigame');
    await inspector.getByLabel('Game', { exact: true }).selectOption('magic-hat');
    await page.locator('.lesson-canvas [data-mini-game-status="planned"]').waitFor();
    await button('Save').click();
    await page.waitForFunction(() => !document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved'));
    const saved = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
    assert.equal(saved.scenes[project.sequences.story.find(e => e.id === ids[0]).sceneId].breakExperience.gameType, 'magic-hat');
    await page.screenshot({ path: path.join(evidence, 'edit.png') });
    await button('Show in Present').click(); await button('Open Present').click();
    const present = app.windows().find(w => w !== page) || await app.waitForEvent('window');
    present.setDefaultTimeout(15000); present.on('pageerror', e => errors.push(String(e)));
    await present.locator('[data-mini-game-status="planned"]').waitFor();
    await present.screenshot({ path: path.join(evidence, 'present.png') });
    await button('Teach').click();
    await page.getByRole('heading', { name: 'Mini-game Break', exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, 'teach.png') });
    await button('Edit').click(); await entry(2).click(); await button('Show in Present').click();
    await present.locator('[data-mini-game-status="unavailable"]').waitFor();
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => !w.webContents.getURL().includes('present.html')); w.setMinimumSize(320, 400); w.setSize(700, 900); });
    await page.waitForFunction(() => window.innerWidth < 900);
    await page.screenshot({ path: path.join(evidence, 'narrow.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: Classic, authoring/save, Edit/Teach/Present, unavailable fallback and narrow view.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
