const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-wheel-editor-'));
  const folder = path.join(temp, 'Lesson'), evidence = path.join(root, 'output/playwright/spinning-wheel-editor');
  await fs.mkdir(folder); await fs.mkdir(evidence, { recursive: true });
  const { createLesson, addCard } = require('../dist/main/shared/lesson/commands');
  const { insertBreak } = require('../dist/main/shared/lesson/sections');
  const { createWheelConfig, addWheelActivity } = require('../dist/main/shared/lesson/spinningWheel');
  let project = createLesson('Wheel editor checks'); const ids = [];
  for (const title of ['Story review', 'Classic review', 'Future game', 'Invalid wheel']) {
    const added = insertBreak(project, 'story'); project = added.project;
    const entry = project.sequences.story.find(e => e.id === added.entryId); ids.push(entry.id);
    project.scenes[entry.sceneId].title = title;
  }
  const sceneId = project.sequences.story.find(e => e.id === ids[0]).sceneId;
  let config = createWheelConfig();
  for (let i = 0; i < 15; i++) {
    let cardId;
    if (i < 8) {
      const added = addCard(project, sceneId); project = added.project;
      cardId = project.scenes[sceneId].objects.find(o => o.id === added.objectId).cardId;
      project.cards[cardId].label = `Question ${i + 1}`;
    }
    config = addWheelActivity(config, i < 8 ? 'question' : 'event', cardId);
    config.activities[i].config.label = i < 8 ? `Story question ${i + 1}` : `Story event ${i - 7}`;
  }
  project.scenes[sceneId].breakExperience = config;
  project.scenes[project.sequences.story.find(e => e.id === ids[2]).sceneId].breakExperience = { ...createWheelConfig(), gameType: 'future-game', configVersion: 99 };
  project.scenes[project.sequences.story.find(e => e.id === ids[3]).sceneId].breakExperience = { mode: 'minigame', gameType: 'spinning-wheel', configVersion: 2, settings: createWheelConfig().settings, activities: null };
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('dialog', d => d.accept());
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    const button = name => page.getByRole('button', { name, exact: true });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1600, 1050));
    await button('Adventure').click();
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
    await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor(); await button('Edit').click();
    const entry = i => page.locator(`[data-entry-id="${ids[i]}"]`);
    const inspector = page.getByRole('region', { name: 'Break Inspector', exact: true });
    await entry(0).click();
    await page.getByLabel('Spinning Wheel static preview', { exact: true }).waitFor();
    assert.equal(await inspector.locator('.wheel-activity').count(), 15);
    assert.equal(await inspector.getByLabel('Activities to play', { exact: true }).inputValue(), '6');
    await inspector.getByLabel('Game title', { exact: true }).fill('Story review wheel');
    await inspector.getByLabel('Activities to play', { exact: true }).fill('8');
    await inspector.getByLabel('Questions to play', { exact: true }).fill('4');
    await inspector.getByLabel('Activity sequence', { exact: true }).selectOption('randomized');
    await inspector.getByLabel('Activity sequence', { exact: true }).selectOption('teacher-selected');
    await inspector.getByLabel('Activity sequence', { exact: true }).selectOption('alternating');
    await inspector.getByLabel('Activities to play', { exact: true }).fill('6');
    await inspector.getByLabel('Questions to play', { exact: true }).fill('3');
    await button('Add question').click();
    let row = inspector.locator('.wheel-activity').last(); await row.locator('summary').click();
    await row.getByLabel('Activity label (optional)', { exact: true }).fill('Final reflection');
    await row.getByLabel('Question Card', { exact: true }).selectOption(Object.keys(project.cards)[0]);
    await row.getByRole('button', { name: 'Edit Card', exact: true }).click();
    await inspector.getByLabel('Card name', { exact: true }).fill('Recall a character');
    await inspector.getByLabel('Card text', { exact: true }).fill('Who helped the hero?');
    await button('Back to wheel preview').click();
    await page.getByLabel('Spinning Wheel static preview', { exact: true }).waitFor();
    row = inspector.locator('.wheel-activity').last();
    await row.getByRole('button', { name: 'New Card', exact: true }).click();
    await inspector.getByLabel('Card name', { exact: true }).fill('New reflection Card');
    await inspector.getByLabel('Card text', { exact: true }).fill('What would you do next?');
    await button('Back to wheel preview').click();
    await button('Add event').click(); row = inspector.locator('.wheel-activity').last(); await row.locator('summary').click();
    await row.getByLabel('Activity label (optional)', { exact: true }).fill('Quick stretch');
    await row.getByLabel('Teacher instructions', { exact: true }).fill('Stand and stretch.');
    await inspector.locator('.wheel-segments > summary').click();
    await button('Add segment').click();
    const segment = inspector.locator('.wheel-segments fieldset').last();
    await segment.getByLabel('Segment activity', { exact: true }).selectOption(config.activities[0].id);
    await segment.getByLabel('Segment label (optional)', { exact: true }).fill('Recall');
    assert.equal(await page.getByLabel('Spinning Wheel static preview', { exact: true }).getAttribute('data-wheel-segments'), '18');
    await inspector.getByLabel('Mode', { exact: true }).selectOption('classic');
    assert.equal(await page.getByLabel('Spinning Wheel static preview', { exact: true }).count(), 0);
    await inspector.getByLabel('Mode', { exact: true }).selectOption('minigame');
    await inspector.getByLabel('Game', { exact: true }).selectOption('magic-hat');
    await inspector.getByText('Coming Soon. Your other game setups are saved.', { exact: true }).waitFor();
    await inspector.getByLabel('Game', { exact: true }).selectOption('mystery-cards');
    await inspector.getByLabel('Game', { exact: true }).selectOption('spinning-wheel');
    assert.equal(await inspector.getByLabel('Game title', { exact: true }).inputValue(), 'Story review wheel');
    assert.equal(await inspector.locator('.wheel-activity').count(), 17);
    await button('Edit review board').click(); await button('Wheel preview').click();
    await entry(0).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Duplicate Break', exact: true }).click();
    assert.equal(await page.locator('.lesson-timeline-item').count(), 5);
    await button('Undo').click();
    assert.equal(await page.locator('.lesson-timeline-item').count(), 4);
    await entry(0).click();
    await button('Save').click();
    await page.waitForFunction(() => !document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved'));
    const saved = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
    assert.equal(saved.scenes[sceneId].breakExperience.settings.playCount, 6);
    assert.equal(saved.scenes[sceneId].breakExperience.activities.length, 17);
    await inspector.locator('.mini-game-editor').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(evidence, 'desktop.png') });
    await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor(); await entry(0).click();
    assert.equal(await inspector.getByLabel('Game title', { exact: true }).inputValue(), 'Story review wheel');
    await entry(1).click(); assert.equal(await inspector.getByLabel('Mode', { exact: true }).inputValue(), 'classic');
    await entry(2).click(); await inspector.getByText('This game is unavailable. Its saved content has been kept.', { exact: true }).waitFor();
    await entry(3).click(); await inspector.getByText('This wheel cannot be edited here. Its saved content has been kept.', { exact: true }).waitFor();
    await entry(0).click();
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => !w.webContents.getURL().includes('present.html')); w.setMinimumSize(320, 400); w.setSize(700, 950); });
    await page.waitForFunction(() => window.innerWidth < 900);
    await inspector.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidence, 'narrow.png'), fullPage: true });
    await inspector.getByLabel('Game title', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidence, 'narrow-controls.png') });
    const visualIssues = await inspector.locator('.mini-game-editor').evaluate(root => {
      const issues = [];
      if (root.scrollWidth > root.clientWidth + 2) issues.push('Editor overflows its panel');
      for (const control of root.querySelectorAll('input,select,textarea')) {
        if (!control.getClientRects().length) continue;
        if (!control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby') && !control.labels?.length) issues.push('Unnamed editor control');
        const r = control.getBoundingClientRect(); if (r.width < 24 || r.height < 24) issues.push('Editor control too small');
      }
      return issues;
    });
    assert.deepEqual(visualIssues, []);
    assert.deepEqual(errors, []);
    console.log('PASS: wheel editor, pool/session/segments, existing/new Cards, mode/game retention, save/reload, Classic/future/invalid fallbacks and narrow view.');
  } catch (error) {
    const page = app.windows()[0];
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png') }); console.error(await page.locator('.lesson-inspector').innerText()); }
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
