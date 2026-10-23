/* Real Electron acceptance. Only native picker results are substituted.
 * Build renderer/main first. All authored projects and imports are disposable. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
function playwright() {
  if (process.env.STORY_STUDIO_PLAYWRIGHT) return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try { return require('playwright'); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  }
}
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-pool-usability-'));
  const folder = path.join(temp, 'Lesson'), legacyFolder = path.join(temp, 'Legacy'), imports = path.join(temp, 'Imports');
  const evidence = process.env.STORY_STUDIO_EVIDENCE || path.join(root, 'output/playwright/media-pool');
  await Promise.all([path.join(folder, 'assets'), path.join(legacyFolder, 'assets'), path.join(imports, 'Nested'), evidence].map(file => fs.mkdir(file, { recursive: true })));
  const png = path.join(folder, 'assets', 'image.png'), portrait = path.join(folder, 'assets', 'portrait.png'), webm = path.join(folder, 'assets', 'video.webm');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x24677a:s=960x540', '-vf', 'drawbox=x=600:y=0:w=360:h=540:color=0xdd9b57:t=fill', '-frames:v', '1', png]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x3e7556:s=300x800', '-frames:v', '1', portrait]);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=12', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '4', '-c:v', 'libvpx', '-b:v', '200k', '-c:a', 'libopus', webm]);
  await fs.copyFile(png, path.join(imports, 'garden_walk_1080p_export.png'));
  await fs.copyFile(png, path.join(imports, 'Nested', 'garden_walk_1080p_export.png'));
  const c = require('../dist/main/shared/lesson/commands');
  const asset = async (id, file, originalName, mediaType) => ({ id, relativePath: `assets/${file}`, filename: file, originalName, mediaType, sizeBytes: (await fs.stat(path.join(folder, 'assets', file))).size, importedAt: '' });
  let project = c.createLesson('Media Pool acceptance');
  project.assets = [await asset('picture', 'image.png', 'OCEAN_WALK_20261022_142305_1920x1080_export.png', 'image'),
    await asset('video', 'video.webm', 'FOREST_WALK_1080p_30fps.webm', 'video'),
    await asset('portrait', 'portrait.png', `${'very_long_descriptive_title_'.repeat(13)}portrait.png`, 'image')];
  project = c.insertScene(project, 'story', c.createScene('Keep current scene')).project;
  const initialSceneId = project.sequences.story[0].sceneId;
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  for (const file of ['image.png', 'video.webm', 'portrait.png']) await fs.copyFile(path.join(folder, 'assets', file), path.join(legacyFolder, 'assets', file));
  const legacy = { version: 4, createdAt: '', updatedAt: '', assets: project.assets, slides: [{ id: 'slide', assetId: 'picture', sectionId: 'section', transition: 'none' }], sections: [{ id: 'section', name: 'Media section' }] };
  await fs.writeFile(path.join(legacyFolder, 'project.json'), JSON.stringify(legacy));
  const original = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
  const app = await playwright()._electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  const passed = [], errors = [], audits = [];
  const pass = text => { passed.push(text); console.log('PASS', text); };
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.accept());
    const button = name => page.getByRole('button', { name, exact: true });
    const dialog = () => page.getByRole('dialog');
    const choose = files => app.evaluate(({ dialog }, files) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: Array.isArray(files) ? files : [files] }); }, files);
    const resize = (width, height) => app.evaluate(({ BrowserWindow }, [width, height]) => { const window = BrowserWindow.getAllWindows()[0]; window.setMinimumSize(320, 400); window.setSize(width, height); }, [width, height]);
    const countScenes = () => page.locator('.lesson-timeline-item').count();
    const card = id => page.locator(`.lesson-pool-asset[data-asset-id="${id}"]`);
    const save = async () => { await button('Save').click(); await page.waitForFunction(() => !document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved') && !document.querySelector('.lesson-status')?.textContent.includes('Working')); };
    const close = async () => { await button('Close media preview').click(); await dialog().waitFor({ state: 'detached' }); };
    const shot = async name => page.screenshot({ path: path.join(evidence, `${name}.png`) });
    const auditDialog = async name => {
      const audit = await dialog().evaluate(el => {
        const r = el.getBoundingClientRect();
        const pool = el.closest('.lesson-pool, .media-pool').getBoundingClientRect();
        const expectedLeft = Math.max(12, Math.min(pool.left, innerWidth - r.width - 12));
        const badButtons = [...el.querySelectorAll('button')].filter(button => { const b = button.getBoundingClientRect(); return b.left < r.left || b.right > r.right; }).length;
        return { anchoredToPool: Math.abs(r.left - expectedLeft) <= 1 && Math.abs(r.top - 12) <= 1, inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, horizontalOverflow: el.scrollWidth > el.clientWidth, badButtons, missingAlt: el.querySelectorAll('img:not([alt])').length };
      });
      audits.push({ name, ...audit }); assert.deepEqual(audit, { anchoredToPool: true, inViewport: true, horizontalOverflow: false, badButtons: 0, missingAlt: 0 });
    };
    await resize(1440, 1000);
    await button('Adventure').click(); await choose(folder); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor(); await button('Edit').click();
    await card('picture').waitFor(); assert.equal(await card('picture').getAttribute('aria-label'), 'PIC - Ocean Walk');
    assert.equal(await card('video').getAttribute('aria-label'), 'VID - Forest Walk');
    assert.equal(await page.locator('.lesson-pool-asset small').count(), 0);
    await shot('pool-desktop');
    await card('picture').focus(); await page.keyboard.press('Enter'); await dialog().waitFor();
    await dialog().locator('img').evaluate(img => img.decode());
    const previewLayout = await dialog().evaluate(el => {
      const media = el.querySelector('.media-preview-stage').getBoundingClientRect();
      const heading = el.querySelector('.media-preview-heading').getBoundingClientRect();
      const close = el.querySelector('.media-preview-close').getBoundingClientRect();
      const style = getComputedStyle(el);
      return { borderless: style.borderTopWidth === '0px' && style.paddingTop === '0px', width: el.getBoundingClientRect().width,
        titleBelow: heading.top >= media.bottom, closeOverMedia: close.top >= media.top && close.bottom <= media.bottom };
    });
    assert.ok(previewLayout.borderless && previewLayout.width >= 560 && previewLayout.titleBelow && previewLayout.closeOverMedia);
    assert.equal(await countScenes(), 1); assert.equal(await page.getByLabel('Scene title', { exact: true }).inputValue(), 'Keep current scene');
    await auditDialog('desktop-image'); await shot('image-desktop');
    await page.keyboard.press('Tab'); assert.ok(await dialog().evaluate(el => el.contains(document.activeElement)), 'native dialog contains tab focus');
    await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'detached' }); assert.ok(await card('picture').evaluate(el => el === document.activeElement));
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), original, 'derived old titles never rewrite the project');
    pass('Old imports, clean cards, keyboard preview, focus return and unchanged scene/source');

    await card('picture').dblclick({ force: true }); assert.equal(await countScenes(), 1);
    if (await dialog().count()) await close();
    await card('picture').click(); await page.mouse.click(3, 3); await dialog().waitFor({ state: 'detached' });
    pass('Double-click never inserts; outside click dismisses');

    const mediaMenu = () => page.getByRole('menu', { name: 'Media Pool actions', exact: true });
    await card('video').click({ button: 'right' });
    assert.deepEqual(await mediaMenu().getByRole('menuitem').allTextContents(), ['Remove from Media Pool', 'Add to Sequence']);
    assert.equal(await dialog().count(), 0); assert.equal(await countScenes(), 1);
    await page.keyboard.press('ArrowDown');
    assert.ok(await mediaMenu().getByRole('menuitem', { name: 'Add to Sequence', exact: true }).evaluate(el => el === document.activeElement));
    await page.keyboard.press('Enter');
    assert.equal(await countScenes(), 2); await button('Undo').click(); assert.equal(await countScenes(), 1);
    await card('picture').click({ button: 'right' }); await shot('context-menu-desktop');
    await mediaMenu().getByRole('menuitem', { name: 'Remove from Media Pool', exact: true }).click();
    assert.equal(await card('picture').count(), 0); assert.equal(await card('video').count(), 1); assert.equal(await countScenes(), 1);
    await button('Undo').click(); await card('picture').waitFor();
    await button('Redo').click(); assert.equal(await card('picture').count(), 0);
    await button('Undo').click(); await card('picture').waitFor();
    await card('video').click({ button: 'right' }); await page.keyboard.press('Escape'); await mediaMenu().waitFor({ state: 'detached' });
    assert.ok(await card('video').evaluate(el => el === document.activeElement));
    pass('Two-item context menu: single-target insertion/removal, undo/redo, Escape and focus return');

    await card('picture').click(); await button('Rename').click();
    const title = dialog().getByLabel('Display title', { exact: true }); assert.ok(await title.evaluate(el => el === document.activeElement));
    await title.fill('Ocean at Dawn'); await button('Save title').click();
    await dialog().getByRole('heading', { name: 'Ocean at Dawn', exact: true }).waitFor();
    assert.ok(await button('Rename').evaluate(el => el === document.activeElement)); await close();
    await button('Undo').click(); assert.equal(await card('picture').getAttribute('aria-label'), 'PIC - Ocean Walk');
    await button('Redo').click(); assert.equal(await card('picture').getAttribute('aria-label'), 'PIC - Ocean at Dawn');
    await page.getByRole('searchbox', { name: 'Search media' }).fill('Ocean at Dawn'); assert.equal(await page.locator('.lesson-pool-asset').count(), 1);
    await page.getByRole('searchbox', { name: 'Search media' }).fill('OCEAN_WALK_20261022'); assert.equal(await page.locator('.lesson-pool-asset').count(), 1);
    await page.getByRole('searchbox', { name: 'Search media' }).fill('');
    await save(); const saved = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
    assert.deepEqual(saved.assets[0], { ...project.assets[0], displayTitle: 'Ocean at Dawn' });
    assert.equal(saved.scenes[initialSceneId].title, 'Keep current scene');
    await choose(folder); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    assert.equal(await card('picture').getAttribute('aria-label'), 'PIC - Ocean at Dawn');
    pass('Rename, original/new-name search, undo/redo and save/reload preserve IDs, paths and scenes');

    await card('picture').click({ button: 'right' }); await mediaMenu().getByRole('menuitem', { name: 'Remove from Media Pool', exact: true }).click();
    await save();
    const hidden = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
    assert.equal(hidden.assets[0].hiddenFromMediaPool, true);
    assert.equal(hidden.sequences.story.length, 1);
    await fs.access(path.join(folder, hidden.assets[0].relativePath));
    await choose(folder); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    assert.equal(await card('picture').count(), 0); assert.equal(await card('video').count(), 1);
    // Restore the isolated fixture to run the remaining preview/drag regressions.
    await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(saved));
    await choose(folder); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    pass('Pool removal survives save/reload while the registered source remains available');

    await card('video').click(); const video = dialog().locator('video');
    await page.waitForFunction(() => { const v = document.querySelector('.media-asset-preview video'); return v && !v.paused && v.currentTime > 0 && v.readyState >= 2; });
    assert.deepEqual(await video.evaluate(v => [v.muted, v.volume, v.loop, v.controls]), [false, 1, true, true]);
    assert.equal(await dialog().locator('video').count(), 1);
    await video.evaluate(v => { v.pause(); v.currentTime = 2; }); await page.waitForFunction(() => document.querySelector('.media-asset-preview video')?.currentTime >= 1.9);
    await video.evaluate(v => v.play());
    const handle = await video.elementHandle();
    await shot('video-desktop'); await close();
    assert.deepEqual(await handle.evaluate(v => ({ paused: v.paused, src: v.getAttribute('src'), connected: v.isConnected })), { paused: true, src: null, connected: false }); await handle.dispose();
    await card('video').click(); assert.equal(await dialog().locator('video').count(), 1); await page.keyboard.press('Escape');
    pass('One audible looping preview, playback/seek and source cleanup on close/reopen');

    await page.getByRole('button', { name: 'Clear media selection', exact: true }).click();
    await card('picture').click({ modifiers: ['Control'] }); await card('video').click({ modifiers: ['Control'] });
    assert.equal(await dialog().count(), 0); assert.equal(await page.locator('.lesson-pool-asset[aria-selected="true"]').count(), 2);
    const payload = await card('picture').evaluate(el => { const transfer = new DataTransfer(); el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer })); return JSON.parse(transfer.getData('application/x-story-studio-assets')); });
    assert.deepEqual(payload.sort(), ['picture', 'video']);
    await page.getByRole('button', { name: 'Clear media selection', exact: true }).click();
    await card('picture').dragTo(button('Add scene to Ungrouped')); assert.equal(await countScenes(), 2); assert.equal(await dialog().count(), 0);
    await card('video').click(); assert.equal(await dialog().getByRole('button', { name: 'Add to Sequence', exact: true }).count(), 0); await page.keyboard.press('Escape'); await card('video').click({ button: 'right' }); await mediaMenu().getByRole('menuitem', { name: 'Add to Sequence', exact: true }).click(); assert.equal(await countScenes(), 3);
    pass('Modifier multiselection, unchanged drag IDs, actual scene drop and deliberate sequence insertion');

    await app.evaluate(({dialog})=>{const original=dialog.showMessageBox;dialog.showMessageBox=async(...args)=>args[1]?.title==='Media with this filename already exists'?{response:0,checkboxChecked:true}:original(...args);});
    await choose(imports); await button('Media filters').click(); await button('Import folder').click();
    await page.waitForFunction(() => document.querySelectorAll('.lesson-pool-asset').length === 4);
    const duplicateCards = page.getByRole('option', { name: 'PIC - Garden Walk', exact: true }); assert.equal(await duplicateCards.count(), 1);
    await page.getByLabel('Type', { exact: true }).selectOption('video'); assert.equal(await page.locator('.lesson-pool-asset').count(), 1);
    await page.getByLabel('Type', { exact: true }).selectOption('all'); await button('Media filters').click();
    await save();
    pass('Folder import, duplicate filename skipped without numbering and type filter');

    for (const [width, height, name] of [[700, 850, 'narrow'], [390, 844, 'mobile']]) {
      await resize(width, height); await card('portrait').scrollIntoViewIfNeeded();
      await card('portrait').click({ button: 'right' });
      assert.ok(await mediaMenu().evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
      await page.keyboard.press('Escape');
      const cards = await page.locator('.lesson-pool-asset').evaluateAll(cards => cards.map(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height, titleHeight: card.querySelector('.media-pool-title').getBoundingClientRect().height, overflow: card.scrollWidth > card.clientWidth })));
      assert.ok(cards.every(c => c.height === cards[0].height && c.titleHeight <= 32 && !c.overflow));
      await shot(`pool-${name}`); await card('portrait').click(); await dialog().locator('img').evaluate(img => img.decode());
      await auditDialog(name); assert.equal(await dialog().locator('img').evaluate(img => getComputedStyle(img).objectFit), 'contain');
      await shot(`preview-${name}`); await close();
    }
    pass('Long titles, portrait aspect ratio, consistent cards and viewport-constrained 700/390px previews');

    await resize(1440, 1000); await button('Teach').click(); assert.equal(await dialog().count(), 0);
    assert.equal(await page.locator('.lesson-pool').count(), 0); await button('Edit').click();
    // Existing legacy project route, using the same component and its original insertion/history callbacks.
    await page.getByRole('link', { name: 'Story Studio', exact: true }).click(); await button('Legacy').click();
    await button('Story Studio home').waitFor(); if (await button('Switch to Edit').isVisible()) await button('Switch to Edit').click();
    await choose(legacyFolder); await button('Open Project').click();
    await button('Switch to Edit').waitFor(); await button('Switch to Edit').click();
    await page.locator('.pool-asset').first().waitFor();
    const oldCard = page.locator('.pool-asset[data-asset-id="picture"]');
    await oldCard.click(); assert.equal(await page.locator('.timeline-object').count(), 1);
    await button('Rename').click(); await dialog().getByLabel('Display title', { exact: true }).fill('Legacy Ocean'); await button('Save title').click(); await close();
    await oldCard.click(); assert.equal(await dialog().getByRole('button', { name: 'Add to Sequence', exact: true }).count(), 0); await page.keyboard.press('Escape'); await oldCard.click({ button: 'right' }); await mediaMenu().getByRole('menuitem', { name: 'Add to Sequence', exact: true }).click(); assert.equal(await page.locator('.timeline-object').count(), 2);
    await oldCard.click({ button: 'right' });
    assert.equal(await mediaMenu().getByRole('menuitem').count(), 2);
    await mediaMenu().getByRole('menuitem', { name: 'Add to Sequence', exact: true }).click(); assert.equal(await page.locator('.timeline-object').count(), 3);
    await oldCard.click({ button: 'right' }); await mediaMenu().getByRole('menuitem', { name: 'Remove from Media Pool', exact: true }).click();
    assert.equal(await oldCard.count(), 0); assert.equal(await page.locator('.timeline-object').count(), 3);
    await button('Undo').click(); await oldCard.waitFor();
    pass('Edit/Teach separation and shared legacy preview, rename and explicit insertion');
    await button('+ Card').click();
    const authoredCards = await page.locator('.card-v2-interactive').count(); assert.ok(authoredCards > 0);
    const disclosure = page.locator('.media-pool > header button');
    if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
    await oldCard.click(); await dialog().waitFor();
    for (const key of ['Delete', 'Backspace', 'Control+d', 'Control+z']) {
      await page.keyboard.press(key);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('.card-v2-interactive').count(), authoredCards, `preview must isolate ${key} from selected Cards`);
    }
    await page.keyboard.press('Escape'); await dialog().waitFor({ state: 'detached' });
    assert.equal(await page.locator('.card-v2-interactive').count(), authoredCards);
    pass('Preview owns Delete, Backspace, duplicate, history and Escape even with a selected legacy Card');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ passed, audits, errors }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {}); await fs.writeFile(path.join(evidence, 'failure.txt'), `${error.stack}\n${await page.locator('body').innerText().catch(() => '')}`); }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
