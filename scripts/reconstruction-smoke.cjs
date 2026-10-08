/* Real Electron acceptance. Native folder/file dialogs are the only mocked boundary.
 * Requires Playwright (or STORY_STUDIO_PLAYWRIGHT pointing at its package directory)
 * and ffmpeg on PATH. Run after build:renderer and build:main. */
const { _electron } = require(process.env.STORY_STUDIO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'story-scene-acceptance-'));
  const folder = path.join(temporary, 'Episode-7');
  const source = path.join(temporary, 'source');
  const evidence = process.env.STORY_STUDIO_EVIDENCE || path.join(root, 'docs', 'reconstruction-evidence');
  await Promise.all([fs.mkdir(folder), fs.mkdir(source), fs.mkdir(evidence, { recursive: true })]);
  const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'pipe' });
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x23586b:s=960x540', '-frames:v', '1', path.join(source, 'lesson-image.png')]);
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=size=960x540:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '4', '-c:v', 'libvpx', '-b:v', '400k', '-c:a', 'libvorbis', path.join(source, 'lesson-video.webm')]);
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root,
    args: [root, `--user-data-dir=${path.join(temporary, 'profile')}`] });
  const errors = [];
  const results = [];
  const passed = name => { results.push(name); console.log(`PASS ${name}`); };
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(8000);
    page.on('pageerror', e => errors.push(String(e)));
    page.on('dialog', dialog => dialog.accept());
    const choose = async directory => app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, directory);
    const button = name => page.getByRole('button', { name, exact: true });
    const label = name => page.getByLabel(name, { exact: true });
    const read = async () => JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8'));
    const save = async () => {
      await button('Save').click();
      await page.waitForFunction(() => !document.querySelector('.lesson-project-title')?.textContent.includes('Unsaved')
        && !document.querySelector('.lesson-status')?.textContent.includes('Working'));
    };
    await choose(folder); await button('Create a new lesson').click();
    await choose(source); await button('Media filters').click(); await button('Import folder').click(); await button('Media filters').click();
    await page.locator('.lesson-pool-asset').filter({ hasText: 'lesson-image.png' }).dragTo(button('Add scene to Ungrouped'));
    await label('Scene title').fill('Story image');
    await button('Add Card').click(); await label('Card name').fill('Story question'); await label('Card text').fill('Where is the dragon?');
    await page.getByRole('tab', { name: 'Answer', exact: true }).click(); await label('Card text').fill('Behind the mountain.');
    await button('Add Bubble').click(); await label('Bubble text').fill('Let us find the dragon!');
    await save();
    assert.equal((await read()).format, 'story-studio-scene'); passed('Create/import/direct Card and Bubble/save');

    await button('Open Present').click();
    let present = app.windows().find(window => window !== page);
    if (!present) present = await app.waitForEvent('window', { timeout: 8000 });
    present.setDefaultTimeout(8000); present.on('pageerror', e => errors.push(String(e)));
    await present.locator('[data-scene-kind="card"]').waitFor();
    assert.equal(await present.getByRole('button').count(), 0);
    assert.equal(await present.locator('[data-scene-kind="bubble"]').count(), 1);
    await button('Teach').click(); await button('Next face').click();
    await present.waitForFunction(() => document.body.textContent.includes('Behind the'));
    await button('Conceal').click(); await present.waitForFunction(() => document.querySelector('[data-scene-kind="card"]')?.textContent === '?');
    await button('Reveal').click(); passed('Actual Present composition, no tools, face/conceal/reveal');
    await present.screenshot({ path: path.join(evidence, 'smoke-story-present.png') });
    await label('New reward student').fill('Acceptance student'); await button('Add student').click();
    await button('Award blue').click();
    await page.getByText('Acceptance student: 1 total', { exact: false }).waitFor();
    await present.locator('.spark-anchor').first().waitFor();
    await button('Show celebration').click();
    await present.getByText('Acceptance student', { exact: true }).first().waitFor();
    assert.equal(await present.getByRole('button').count(), 0);
    await present.screenshot({ path: path.join(evidence, 'smoke-rewards-present.png'), animations: 'disabled' });
    const rewardFrame = await present.locator('[data-logical-scene]').first().boundingBox();
    for (const selector of ['.badge-shield-svg', '.badge-student-grid']) {
      const bounds = await present.locator(selector).boundingBox();
      assert.ok(bounds.y >= rewardFrame.y - 1 && bounds.y + bounds.height <= rewardFrame.y + rewardFrame.height + 1, `${selector} fits the logical frame`);
    }
    await button('Hide celebration').click();
    passed('Existing student spark and badge visuals in Present, session-only totals, no student tools');

    await button('Edit').click(); await button('Timeline actions').click(); await page.getByRole('menuitem', { name: 'Copy to Activation', exact: true }).click();
    await button('Add Card').click(); await label('Card name').fill('Activation clue'); await label('Card text').fill('What did we discover?');
    const hit = await page.locator('.lesson-object-hit.is-selected').boundingBox();
    await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2); await page.mouse.down();
    await page.mouse.move(hit.x + hit.width / 2 + hit.width * .65, hit.y + hit.height / 2 + 12, { steps: 8 }); await page.mouse.up();
    const resize = await button('Resize object').boundingBox();
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2); await page.mouse.down(); await page.mouse.move(resize.x + resize.width / 2 + 18, resize.y + resize.height / 2 + 10, { steps: 6 }); await page.mouse.up();
    await page.locator('.lesson-side').getByRole('button', { name: 'Duplicate', exact: true }).click(); await save();
    let data = await read(); const activationId = data.sequences.activation[0].sceneId;
    const cards = data.scenes[activationId].objects.filter(o => o.kind === 'card');
    assert.equal(cards.length, 3); assert.notEqual(cards[1].cardId, cards[2].cardId); assert.ok(cards[1].box.x > 80 && cards[1].box.width > 360);
    passed('Same Activation editor, independent scene/Card copies, pointer move and resize');

    await button('Show in Present').click(); await present.waitForFunction(() => document.querySelectorAll('[data-scene-kind="card"]').length === 3);
    await button('Delete card').click(); await present.waitForFunction(() => document.querySelectorAll('[data-scene-kind="card"]').length === 2);
    await button('Undo').click(); await present.waitForFunction(() => document.querySelectorAll('[data-scene-kind="card"]').length === 3);
    await button('Redo').click(); await present.waitForFunction(() => document.querySelectorAll('[data-scene-kind="card"]').length === 2);
    await button('Story').click(); assert.equal(await present.locator('[data-scene-surface]').getAttribute('data-scene-id'), activationId);
    await button('Teach').click(); await button('Return to Story').click();
    await present.waitForFunction(id => document.querySelector('[data-scene-surface]')?.getAttribute('data-scene-id') === id, data.sequences.story[0].sceneId);
    passed('Edit deletion reaches Present; undo/redo; independent Edit cursor; stable Story return');

    await button('Edit').click();
    await page.locator('.lesson-pool-asset').filter({ hasText: 'lesson-video.webm' }).dragTo(button('Add scene to Ungrouped'));
    const preview = page.locator('.lesson-canvas video');
    assert.equal(await preview.getAttribute('controls'), '');
    assert.equal(await preview.evaluate(video => video.muted), true);
    await button('Add Card').click(); await label('Card text').fill('Watch closely.');
    await button('Add Bubble').click(); await label('Bubble text').fill('Look for a pattern.');
    await save(); await button('Show in Present').click(); await button('Teach').click();
    await button('Play video').click();
    await present.waitForFunction(() => document.querySelector('video')?.currentTime > .4, undefined, { timeout: 15000 });
    assert.equal(await present.locator('video').count(), 1);
    assert.deepEqual(await page.locator('.lesson-canvas video').evaluateAll(videos => videos.map(v => ({ file: !!v.getAttribute('src'), muted: v.muted, stream: !!v.srcObject }))), [{ file: false, muted: true, stream: true }]);
    assert.equal(await present.locator('[data-scene-kind="card"]').count(), 1); assert.equal(await present.locator('[data-scene-kind="bubble"]').count(), 1);
    await button('Pause video').click(); passed('Present owns live video; teacher consumes muted received frames; overlays remain visible');
    const teachingId = await present.locator('[data-scene-surface]').getAttribute('data-scene-id');
    await button('Story').click(); await page.keyboard.press('Control+z');
    assert.equal(await present.locator('[data-scene-surface]').getAttribute('data-scene-id'), teachingId);
    assert.equal(await page.locator('.lesson-canvas [data-scene-kind="card"]').count(), 1);
    assert.equal(await page.locator('.lesson-canvas [data-scene-kind="bubble"]').count(), 1);
    passed('Active Story tab and Teach keyboard undo preserve the live lesson and authored objects');
    await present.screenshot({ path: path.join(evidence, 'smoke-video-present.png') });
    await page.screenshot({ path: path.join(evidence, 'smoke-video-teach.png') });

    await button('Edit').click(); await button('Timeline actions').click(); await page.getByRole('menuitem', { name: 'Copy to Activation', exact: true }).click();
    await button('Show in Present').click(); await button('Teach').click(); await button('Play video').click();
    await present.waitForFunction(() => document.querySelector('video')?.currentTime > .4, undefined, { timeout: 15000 });
    await button('Return to Story').click(); await button('Pause video').click();
    passed('Activation video with overlays and return to the stored Story video');
    await button('Edit').click(); await button('Activation').click(); await button('Scene properties').click();
    await label('Canvas preset').selectOption({ label: 'Standard · 4:3' });
    await page.locator('summary').filter({ hasText: 'Transition' }).click(); await label('Scene transition').selectOption('fade');
    await button('Draw').click();
    const canvas = await page.locator('.lesson-canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .55, canvas.y + canvas.height * .7); await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .8, canvas.y + canvas.height * .8, { steps: 12 }); await page.mouse.up(); await button('Draw').click();
    await button('Show in Present').click(); await save();
    data = await read(); assert.equal(data.scenes[activationId].frame.width, 1024); assert.ok(data.scenes[activationId].drawings.length);
    assert.equal(data.sequences.activation.length, 2);
    await present.waitForFunction(id => document.querySelector('[data-scene-surface]')?.getAttribute('data-scene-id') === id, activationId);
    await present.waitForFunction(() => {
      const canvas = document.querySelector('.lesson-scene-content > canvas');
      if (!canvas?.width) return false;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) return true;
      return false;
    });
    await page.screenshot({ path: path.join(evidence, 'smoke-activation-edit.png') });
    await present.screenshot({ path: path.join(evidence, 'smoke-activation-present.png'), animations: 'disabled' });
    await choose(folder); await button('Open project').click();
    await page.getByText('Lesson opened.', { exact: true }).waitFor();
    await button('Activation').click(); await button('Show in Present').click();
    await present.locator('[data-scene-kind="card"]').first().waitFor();
    assert.equal(await present.locator('[data-scene-kind="card"]').count(), 2);
    const reopened = await read(); assert.deepEqual(reopened, data);
    passed('4:3 logical frame, authored drawing/transition, save and reopen complete lesson');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'smoke-results.json'), JSON.stringify({ passed: results, errors, sampleProject: folder, originalLessonsTouched: false }, null, 2));
    console.log(`Disposable proof: ${folder}`);
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => window.appApi.forceClose()).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
