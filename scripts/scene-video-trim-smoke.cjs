/* Native Electron trim acceptance. Only native file-picker results are substituted. */
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
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-scene-trim-'));
  const folder = path.join(temp, 'Lesson'), evidence = process.env.STORY_STUDIO_EVIDENCE || path.join(root, 'output/playwright/scene-video-trim');
  await fs.mkdir(path.join(folder, 'assets'), { recursive: true }); await fs.mkdir(evidence, { recursive: true });
  const file = path.join(folder, 'assets', 'video.webm');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '8', '-c:v', 'libvpx', '-b:v', '300k', '-c:a', 'libopus', file]);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex'), originalHash = hash(await fs.readFile(file));
  const c = require('../dist/main/shared/lesson/commands');
  let project = c.createLesson('Video range acceptance');
  project.assets = [{ id: 'video', filename: 'video.webm', originalName: 'Forest_walk.webm', relativePath: 'assets/video.webm', mediaType: 'video', sizeBytes: (await fs.stat(file)).size, importedAt: '' }];
  const first = c.createScene('First video', 'video'), second = c.createScene('Second video', 'video'), blank = c.createScene('Blank scene');
  for (const scene of [first, second, blank]) project = c.insertScene(project, 'story', scene).project;
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const app = await playwright()._electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  const passed = [], errors = [], pass = text => { passed.push(text); console.log('PASS', text); }; let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error))); page.on('dialog', d => d.accept());
    // Observe snapshot acceptance without replacing its validation or transport behavior.
    await app.evaluate(({ ipcMain }, root) => {
      const original = ipcMain._invokeHandlers.get('present:publish');
      globalThis.__trimRejections = [];
      ipcMain.removeHandler('present:publish');
      ipcMain.handle('present:publish', (event, snapshot) => { const result = original(event, snapshot); if (!result) globalThis.__trimRejections.push(snapshot); return result; });
    }, root);
    const button = name => page.getByRole('button', { name, exact: true });
    const choose = () => app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
    const resize = (width, height) => app.evaluate(({ BrowserWindow }, size) => { const window = BrowserWindow.getAllWindows()[0]; window.setMinimumSize(320, 400); window.setSize(...size); }, [width, height]);
    const decoder = () => page.locator('.lesson-canvas video[data-edit-video-preview]');
    const control = () => page.getByRole('group', { name: 'Edit video range controls', exact: true });
    const start = () => control().getByRole('slider', { name: 'Video trim start', exact: true });
    const end = () => control().getByRole('slider', { name: 'Video trim end', exact: true });
    const values = async () => ({ inSec: Number(await start().inputValue()), outSec: Number(await end().inputValue()) });
    const ready = () => page.waitForFunction(() => { const input = document.querySelector('[aria-label="Video trim start"]'); return input && !input.disabled; });
    const near = (actual, expected, tolerance = .08) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be near ${expected}`);
    const select = async title => { await page.locator('.lesson-timeline-item').filter({ hasText: title }).click(); };
    const drag = async (input, value) => {
      const r = await input.boundingBox(), current = Number(await input.inputValue()), max = Number(await input.getAttribute('max'));
      const x = val => r.x + 6 + (r.width - 12) * val / max;
      const y = r.y + ((await input.getAttribute('aria-label')).startsWith('Video trim') ? 21 : r.height / 2);
      await page.mouse.move(x(current), y); await page.mouse.down(); await page.mouse.move(x(value), y, { steps: 10 }); await page.mouse.up();
    };
    await resize(1440, 1000); await button('Adventure').click(); await choose(); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor(); await button('Edit').click(); await select('First video'); await ready();
    assert.equal(await page.getByText('The presentation rejected this scene. Your authored changes are still available.', { exact: true }).count(), 0);
    const placement = await control().evaluate(el => {
      const r = el.getBoundingClientRect(), header = el.closest('.lesson-timeline-toolbar');
      const more = header.querySelector('[aria-label="Timeline actions"]').getBoundingClientRect(), zoom = header.querySelector('.lesson-timeline-zoom').getBoundingClientRect();
      return { inHeader: !!header, afterActions: r.left >= more.right, beforeZoom: r.right <= zoom.left };
    });
    assert.deepEqual(placement, { inHeader: true, afterActions: true, beforeZoom: true });
    assert.equal(await control().locator('video').count(), 0); assert.equal(await decoder().count(), 1);
    await drag(start(), 1.5); near((await values()).inSec, 1.5);
    await button('Undo').click(); near((await values()).inSec, 0); await button('Redo').click(); near((await values()).inSec, 1.5);
    await drag(end(), 5.5); near((await values()).outSec, 5.5);
    await button('Undo').click(); near((await values()).outSec, 8, .1); await button('Redo').click(); near((await values()).outSec, 5.5);
    const editSeek = control().getByRole('slider', { name: 'Edit video position', exact: true });
    await drag(editSeek, 4.2); near(await decoder().evaluate(v => v.currentTime), 4.2, .15);
    const unchanged = await values(); near(unchanged.inSec, 1.5); near(unchanged.outSec, 5.5);
    await page.locator('body').click({position:{x:4,y:4}}); await page.keyboard.press('Space'); await page.waitForFunction(() => !document.querySelector('.lesson-canvas video').paused);
    await page.keyboard.press('Space'); await page.waitForFunction(() => document.querySelector('.lesson-canvas video').paused);
    await page.keyboard.press('e'); await page.getByRole('checkbox', {name:'Rainbow drawing'}).waitFor();
    await page.keyboard.press('e');
    pass('Mouse seeking changes the Edit playhead without changing trim; Space toggles video and E toggles drawing');
    const trimmed = await values(); await page.screenshot({ path: path.join(evidence, 'desktop.png') });
    pass('Toolbar is between timeline actions and zoom; both handles drag and each gesture is one undo step');
    await button('Play edit video').click(); await page.waitForFunction(inSec => { const v = document.querySelector('.lesson-canvas video'); return v && !v.paused && v.currentTime > inSec + .15; }, trimmed.inSec);
    await button('Pause edit video').click(); assert.equal(await decoder().evaluate(v => v.paused), true);
    await button('Stop edit video').click(); near(await decoder().evaluate(v => v.currentTime), trimmed.inSec);
    await button('Play edit video').click(); await page.waitForFunction(outSec => { const v = document.querySelector('.lesson-canvas video'); return v && v.paused && Math.abs(v.currentTime - outSec) < .05; }, trimmed.outSec);
    await button('Play edit video').click(); await page.waitForFunction(inSec => { const v = document.querySelector('.lesson-canvas video'); return v && !v.paused && v.currentTime > inSec + .1 && v.currentTime < inSec + 1; }, trimmed.inSec);
    await button('Stop edit video').click();
    await decoder().evaluate(v => { v.currentTime = 0; }); await page.waitForFunction(inSec => Math.abs(document.querySelector('.lesson-canvas video').currentTime - inSec) < .05, trimmed.inSec);
    await decoder().evaluate(v => { v.currentTime = 7.5; }); await page.waitForFunction(outSec => Math.abs(document.querySelector('.lesson-canvas video').currentTime - outSec) < .05, trimmed.outSec);
    pass('Play/Pause/Stop, end-marker stop, replay and seek clamping use the existing canvas decoder');
    await button('Save').click(); await page.waitForFunction(() => !document.querySelector('.lesson-project-title').textContent.includes('Unsaved'));
    let saved = JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8')); assert.deepEqual(saved.scenes[first.id].background.videoTrim, trimmed); assert.equal(saved.scenes[second.id].background.videoTrim, undefined);
    await choose(); await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor(); await select('First video'); await ready(); assert.deepEqual(await values(), trimmed);
    await button('Play edit video').click(); const old = await decoder().elementHandle(); await select('Second video'); await ready(); assert.equal(await old.evaluate(v => v.paused), true); await old.dispose(); near((await values()).inSec, 0);
    await select('Blank scene'); assert.equal(await control().count(), 0); assert.equal(await decoder().count(), 0);
    await select('First video'); await ready(); assert.deepEqual(await values(), trimmed);
    assert.equal(hash(await fs.readFile(file)), originalHash);
    pass('Per-scene bounds survive save/reload, scene switching pauses the old decoder, and source bytes stay unchanged');
    const splitter = page.getByRole('separator', { name: 'Resize Media Pool', exact: true });
    assert.equal(await splitter.getAttribute('aria-valuemax'), '800');
    const pool = page.locator('.lesson-content-rail'), originalPoolWidth = (await pool.boundingBox()).width;
    const split = await splitter.boundingBox(), savedBeforeResize = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
    await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2); await page.mouse.down(); await page.mouse.move(split.x + 403, split.y + split.height / 2, { steps: 12 }); await page.mouse.up();
    assert.ok((await pool.boundingBox()).width > 600);
    assert.ok((await page.locator('.lesson-canvas').boundingBox()).width >= 240);
    assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('story-studio.workspace.v1'))).pool > 600);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), savedBeforeResize);
    await page.screenshot({ path: path.join(evidence, 'wider-media-pool.png') });
    await resize(1024, 900); assert.ok((await page.locator('.lesson-canvas').boundingBox()).width >= 239);
    await resize(1440, 1000); await splitter.dblclick(); near((await pool.boundingBox()).width, originalPoolWidth, 2);
    await resize(1920, 1080);
    const enlarged = await control().boundingBox(); assert.ok(enlarged.width >= 700 && enlarged.height < 45, 'video controls grow wider without growing taller');
    await page.screenshot({ path: path.join(evidence, 'wide-controls.png') }); await resize(1440, 1000);
    pass('Media Pool divider expands past 600px, preserves canvas/scene data and resets; video controls are wider at original height');
    await start().focus(); const initialStart = Number(await start().inputValue()); await page.keyboard.press('ArrowRight'); near(Number(await start().inputValue()), initialStart + .01, .001); await button('Undo').click(); near(Number(await start().inputValue()), initialStart, .001);
    for (const [width, height] of [[700, 850], [390, 844]]) {
      await resize(width, height); await control().scrollIntoViewIfNeeded();
      assert.ok(await control().evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.scrollWidth <= el.clientWidth; }));
      await page.screenshot({ path: path.join(evidence, `narrow-${width}.png`) });
    }
    pass('Keyboard trim and 700/390px header layouts remain usable');
    await resize(1440, 1000); await button('Teach').click(); await select('First video'); assert.equal(await control().count(), 0);
    await button('Open Present').click();
    const present = app.windows().find(window => window !== page) || await app.waitForEvent('window'); present.setDefaultTimeout(15000); present.on('pageerror', error => errors.push(String(error)));
    await present.waitForFunction(async () => !!(await window.presentApi.requestSnapshot())?.snapshot?.target?.media);
    const snapshot = await present.evaluate(() => window.presentApi.requestSnapshot()); assert.deepEqual(snapshot.snapshot.target.media.trim, trimmed);
    await present.waitForFunction(() => [...document.querySelectorAll('video')].some(video => video.readyState >= 2));
    await button('Play video').click(); await button('Pause video').click();
    const teachSeek = page.getByRole('slider', { name: 'Video position', exact: true });
    await page.waitForFunction(() => Number(document.querySelector('[aria-label="Video position"]').max) > 7);
    await drag(teachSeek, 4.3);
    await present.waitForFunction(() => [...document.querySelectorAll('video')].some(v => v.paused && Math.abs(v.currentTime - 4.3) < .2));
    await page.locator('body').click({position:{x:4,y:4}}); await page.keyboard.press('d');
    await page.waitForFunction(() => document.querySelector('.lesson-phase-tabs').textContent.includes('Second video'));
    await page.keyboard.press('a');
    await page.waitForFunction(() => document.querySelector('.lesson-phase-tabs').textContent.includes('First video'));
    assert.equal(await button('Play video').count(), 1);
    pass('Teach mouse seeking reaches the actual Present decoder; A/D navigate scenes');
    await button('Play video').click();
    await present.waitForFunction(inSec => [...document.querySelectorAll('video')].some(video => !video.paused && video.currentTime > inSec + .1), trimmed.inSec);
    await present.waitForFunction(outSec => [...document.querySelectorAll('video')].some(video => video.paused && Math.abs(video.currentTime - outSec) < .05), trimmed.outSec);
    pass('Teach hides authoring controls and actual Present playback obeys the saved start/end range');
    assert.deepEqual(await app.evaluate(() => globalThis.__trimRejections), []);
    assert.deepEqual(errors, []); await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ passed, trimmed, placement, errors }, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {}); await fs.writeFile(path.join(evidence, 'failure.txt'), `${error.stack}\n${await page.locator('body').innerText().catch(() => '')}`); }
    throw error;
  } finally { await fs.writeFile(path.join(evidence, 'snapshot-rejections.json'), JSON.stringify((await app.evaluate(() => globalThis.__trimRejections).catch(() => [])) ?? [], null, 2)); await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
