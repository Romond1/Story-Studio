/* Native Phase 6B acceptance. Only native dialogs are mocked. All writes are to
 * disposable fixtures and docs/phase6b-evidence; build main + renderer first. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
function playwright() {
  if (process.env.STORY_STUDIO_PLAYWRIGHT) return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try { return require('playwright'); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-phase6b-'));
  const folder = path.join(temp, 'Authored'), copy = path.join(temp, 'SaveAs'), other = path.join(temp, 'Other');
  const source = path.join(temp, 'original.png');
  const evidence = process.env.STORY_STUDIO_EVIDENCE || path.join(root, 'docs/phase6b-evidence/native');
  await Promise.all([folder, copy, other, evidence].map(p => fs.mkdir(p, { recursive: true })));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x23586b:s=320x180', '-frames:v', '1', source]);
  const sourceHash = hash(await fs.readFile(source));
  const commands = require('../dist/main/shared/lesson/commands');
  const { createMediaRegistry } = require('../dist/main/shared/content/mediaRegistry');
  const app = await playwright()._electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  const passed = [], errors = []; let page;
  const pass = name => { passed.push(name); console.log(`PASS ${name}`); };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(String(error))); page.on('dialog', dialog => dialog.accept());
    const button = name => page.getByRole('button', { name, exact: true });
    const choose = target => app.evaluate(({ dialog }, target) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] }); }, target);
    const read = target => fs.readFile(path.join(target, 'project.json'), 'utf8').then(JSON.parse);
    const saved = () => page.waitForFunction(() => !document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved') && !document.querySelector('.lesson-status')?.textContent.includes('Working'));
    const open = async target => { await choose(target); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor(); };
    const imageReady = target => target.waitForFunction(() => [...document.querySelectorAll('.lesson-canvas img, [data-scene-surface] img')].some(img => img.complete && img.naturalWidth > 0 && img.src.startsWith('media://scoped/')));
    await button('Adventure').click(); await button('Edit').click();
    await choose(folder); await button('New project').click(); await button('Edit').click();
    await button('Media bins').click();
    for (const name of ['Parent', 'Nested']) { await button('New bin').click(); await page.getByLabel('New bin name', { exact: true }).fill(name); await button('Create bin').click(); }
    await choose(source); await button('Import files').click();
    const assetButton = page.locator('.lesson-pool-asset').filter({ hasText: 'original.png' });
    await assetButton.dragTo(button('Add scene to Ungrouped'));
    await page.getByLabel('Scene title', { exact: true }).fill('Story image');
    await button('Timeline actions').click(); await page.getByRole('menuitem', { name: 'Copy to Discovery', exact: true }).click();
    await button('Save').click(); await saved();
    let authored = await read(folder); assert.equal(authored.assets.length, 1); assert.equal(authored.mediaBins.length, 2);
    assert.equal(JSON.stringify(authored).includes('media://scoped/'), false, 'Save keeps runtime grants out of authored JSON');
    const asset = authored.assets[0]; assert.equal(authored.mediaBins[1].parentId, authored.mediaBins[0].id); assert.equal(asset.binId, authored.mediaBins[1].id);
    assert.equal(authored.scenes[authored.sequences.story[0].sceneId].background.assetId, asset.id);
    assert.equal(authored.scenes[authored.sequences.activation[0].sceneId].background.assetId, asset.id);
    pass('Native UI import, nested bins, one asset shared by story and activation');
    // Author a library-only definition in the disposable saved fixture; never production.
    const card = commands.createCard(); card.label = 'Unplaced image card'; card.faces[0].imageAssetId = asset.id;
    authored.cards[card.id] = card; authored.library.push(card.id);
    await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(authored, null, 2));
    const authoredHash = hash(await fs.readFile(path.join(folder, 'project.json')));
    await open(folder); await imageReady(page);
    const uses = createMediaRegistry({ format: 'scene', data: authored }).usages(asset.id);
    assert.ok(uses.some(use => use.ownerType === 'card' && use.ownerId === card.id)); assert.equal(uses.length, 3);
    pass('Unplaced library card included in complete authored reference usage');
    await choose(copy); await button('Save as').click(); await saved();
    const copied = await read(copy); assert.deepEqual(copied.assets, authored.assets); assert.deepEqual(copied.mediaBins, authored.mediaBins); assert.deepEqual(copied.cards, authored.cards);
    assert.equal(JSON.stringify(copied).includes('media://scoped/'), false, 'Runtime grants never enter saved authored JSON');
    assert.equal(hash(await fs.readFile(path.join(copy, asset.relativePath))), sourceHash);
    await open(copy); await imageReady(page);
    assert.deepEqual((await read(copy)).assets, authored.assets);
    await button('Open Present').click();
    const present = app.windows().find(window => window !== page) || await app.waitForEvent('window');
    present.setDefaultTimeout(15000); present.on('pageerror', error => errors.push(String(error)));
    await button('Show in Present').click(); await imageReady(present);
    await page.screenshot({ path: path.join(evidence, 'control.png') }); await present.screenshot({ path: path.join(evidence, 'present.png') });
    const oldUrl = await page.locator('.lesson-canvas img').first().getAttribute('src'); assert.ok(oldUrl.startsWith('media://scoped/'));
    pass('SaveAs and reopen preserve IDs/bins/cards and render scoped image in Control and Present');
    let different = commands.createLesson('Same path, different project'); different.assets = [{ ...asset, binId: undefined }];
    different = commands.insertScene(different, 'story', commands.createScene('Different image', asset.id)).project;
    await fs.mkdir(path.dirname(path.join(other, asset.relativePath)), { recursive: true });
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x180', '-frames:v', '1', path.join(other, asset.relativePath)]);
    await fs.writeFile(path.join(other, 'project.json'), JSON.stringify(different));
    await button('Adventure').click(); await open(other); await imageReady(page);
    await page.waitForFunction(folder => document.querySelector('.lesson-status')?.textContent.includes(folder), other);
    await page.waitForFunction(old => { const img = document.querySelector('.lesson-canvas img'); return img?.complete && img.naturalWidth > 0 && img.src !== old; }, oldUrl);
    const staleLoaded = await page.evaluate(async url => { try { return (await fetch(url, { cache: 'no-store' })).ok; } catch { return false; } }, oldUrl);
    assert.equal(staleLoaded, false); pass('Old scoped URL rejected after switch to project with identical relative path');
    // Terminal security probe: deliberately replace only this disposable project's manifest.
    const missing = await page.evaluate(async ({ folder, assets }) => {
      const api = window.appApi.mediaRegistry, lease = await api.getLease(folder);
      const revision = 1000000;
      const registered = await api.register({ leaseId: lease.id, expectedFolder: folder, revision, assets: assets.map(a => ({ ...a, relativePath: 'assets/absent.png' })), legacyPaths: [] });
      return { registered, result: await api.resolve({ leaseId: lease.id, revision, assetId: assets[0].id, expectedType: 'image' }) };
    }, { folder: other, assets: different.assets });
    assert.equal(missing.registered.ok, true); assert.deepEqual(missing.result, { ok: false, code: 'missing' });
    pass('Missing file resolves to explicit missing diagnostic');
    assert.equal(hash(await fs.readFile(source)), sourceHash); assert.equal(hash(await fs.readFile(path.join(folder, 'project.json'))), authoredHash);
    assert.equal(hash(await fs.readFile(path.join(folder, asset.relativePath))), sourceHash); assert.deepEqual(errors, []);
    pass('Imported source image and original project bytes unchanged; no renderer errors');
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ passed, errors, temporary: temp, sourceHash, originalLessonsTouched: false }, null, 2));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {});
    await fs.writeFile(path.join(evidence, 'failure.json'), JSON.stringify({ passed, errors, failure: String(error.stack || error), temporary: temp }, null, 2)); throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
