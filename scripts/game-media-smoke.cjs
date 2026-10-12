/* Real Electron regression: game navigation must retain the lesson video position.
 * Run after renderer/main builds. Only the native folder picker is mocked.
 * The fixture, profile, and generated video are disposable; lessons stay untouched.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function playwright() {
  if (process.env.STORY_STUDIO_PLAYWRIGHT) return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try { return require('playwright'); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'));
  }
}
const { _electron } = playwright();
const commands = require('../dist/main/shared/lesson/commands');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'story-game-media-'));
  const folder = path.join(temporary, 'Disposable video lesson');
  const evidence = process.env.STORY_STUDIO_EVIDENCE || path.join(root, 'docs', 'game-host-evidence', 'media-return');
  await Promise.all([fs.mkdir(path.join(folder, 'assets'), { recursive: true }), fs.mkdir(evidence, { recursive: true })]);
  const filename = 'lesson-video.webm', file = path.join(folder, 'assets', filename);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '8', '-c:v', 'libvpx', '-b:v', '300k', '-c:a', 'libvorbis', file], { stdio: 'pipe' });
  let fixture = commands.createLesson('Game media return regression');
  fixture.assets.push({ id: 'video-regression', relativePath: `assets/${filename}`, filename, originalName: filename, mediaType: 'video', sizeBytes: (await fs.stat(file)).size, importedAt: new Date().toISOString() });
  const scene = commands.createScene('Retained teaching video', 'video-regression');
  fixture = commands.insertScene(fixture, 'story', scene).project;
  const fixtureJson = JSON.stringify(fixture, null, 2);
  await fs.writeFile(path.join(folder, 'project.json'), fixtureJson);
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temporary, 'profile')}`] });
  const observations = [], failures = [], errors = [];
  let page, present;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push({ window: 'Control', message: String(error) }));
    page.on('dialog', dialog => dialog.accept());
    const button = name => page.getByRole('button', { name, exact: true });
    await button('Adventure').click();
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, folder);
    await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    await button('Teach').click(); await button('Open Present').click();
    present = app.windows().find(window => window !== page) || await app.waitForEvent('window');
    present.setDefaultTimeout(15000); present.on('pageerror', error => errors.push({ window: 'Present', message: String(error) }));
    const readVideo = () => present.locator('video').evaluate(video => ({ currentTime: video.currentTime, paused: video.paused, readyState: video.readyState, duration: video.duration }));
    const waitVideoReady = async () => {
      await present.locator('video').waitFor();
      await present.waitForFunction(() => { const video = document.querySelector('video'); return video && video.readyState >= 2 && !video.seeking && video.duration > 2; });
      await page.waitForFunction(async () => (await window.appApi.getPresentStatus()).state === 'ready');
    };
    const preparePausedVideo = async () => {
      await waitVideoReady();
      await button('Play video').click();
      await present.waitForFunction(() => document.querySelector('video')?.currentTime > 0.2);
      await button('Pause video').click();
      await present.waitForFunction(() => document.querySelector('video')?.paused);
      const position = page.getByLabel('Video position', { exact: true });
      await position.waitFor();
      const bounds = await position.boundingBox(), maximum = Number(await position.getAttribute('max'));
      assert.ok(bounds && maximum > 2, 'Teacher seek slider has the real video duration');
      // Native slider click produces one teacher seek command without racing
      // several bridge epochs from a rapid series of arrow presses.
      await position.click({ position: { x: 8 + (bounds.width - 16) * 2 / maximum, y: bounds.height / 2 } });
      await present.waitForFunction(() => { const video = document.querySelector('video'); return video?.paused && video.currentTime >= 1.8 && !video.seeking; });
      await waitVideoReady();
      const state = await readVideo(); assert.ok(state.currentTime >= 1.8, 'Fixture video reached the requested time through teacher controls');
      return state;
    };
    const checkReturn = async (name, before, expectedMode = 'teach', returnButton = 'Return to lesson') => {
      await button(returnButton).click();
      await present.locator('iframe').waitFor({ state: 'detached' });
      await waitVideoReady();
      const after = await readVideo();
      const sceneId = await present.locator('[data-scene-surface]').getAttribute('data-scene-id');
      const target = (await present.evaluate(() => window.presentApi.requestSnapshot())).snapshot.target;
      const result = { name, before, after, sceneId, intent: target.media };
      observations.push(result);
      await present.screenshot({ path: path.join(evidence, `${name}-present.png`) });
      await page.screenshot({ path: path.join(evidence, `${name}-control.png`) });
      try {
        if (expectedMode) assert.equal(await button(expectedMode === 'edit' ? 'Edit' : 'Teach').getAttribute('aria-pressed'), 'true', 'The previous lesson mode returns');
        assert.equal(sceneId, scene.id, 'The same teaching scene returns');
        assert.ok(after.paused, 'Returning never resumes lesson video without a teacher command');
        assert.ok(after.currentTime >= 1.8 && Math.abs(after.currentTime - before.currentTime) < 0.4, `${name}: video position retained, before ${before.currentTime}, after ${after.currentTime}`);
        console.log(`PASS ${name}: paused at ${after.currentTime.toFixed(3)} seconds`);
      } catch (error) { failures.push({ name, message: String(error) }); console.error(`FAIL ${name}: ${error.message}`); }
    };
    const launch = async () => {
      await button('Launch Language Snake').click();
      await present.locator('iframe[title="Language Snake"]').waitFor();
      await page.waitForFunction(() => document.querySelector('.game-session-panel [role="status"]')?.textContent === 'Ready in Present');
      assert.equal(await page.locator('iframe').count(), 0, 'Control has no duplicate runtime');
      assert.equal(await present.locator('iframe').count(), 1, 'Present has exactly one game runtime');
    };

    let before = await preparePausedVideo();
    await button('Challenge').click();
    await checkReturn('selection-return', before);

    before = await preparePausedVideo();
    await button('Challenge').click(); await launch();
    await checkReturn('launch-return', before);

    before = await preparePausedVideo();
    await button('Challenge').click(); await launch();
    const oldInstance = await present.locator('iframe').getAttribute('data-game-instance');
    await button('Restart game').click();
    await present.waitForFunction(old => document.querySelector('iframe')?.getAttribute('data-game-instance') !== old, oldInstance);
    await page.waitForFunction(() => document.querySelector('.game-session-panel [role="status"]')?.textContent === 'Ready in Present');
    await checkReturn('restart-return', before);

    before = await preparePausedVideo();
    await button('Edit').click();
    await button('Challenge').click(); await launch();
    await checkReturn('edit-launch-return', before, 'edit');

    before = await readVideo();
    await button('Challenge').click(); await launch();
    await checkReturn('game-selection-return', before, null, 'Return to game selection');
    assert.equal(await button('Launch Language Snake').count(), 1, 'Returning to selection retains the game library');
    await launch();
    await checkReturn('selection-relaunch-return', before, 'edit');

    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), fixtureJson, 'Game navigation never writes the lesson');
    assert.deepEqual(errors, []);
    const report = { observations, failures, errors, sampleProject: folder, originalLessonsTouched: false };
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(failures, [], 'Every game return retains the paused lesson video position');
  } catch (error) {
    const actualVideo = present && !present.isClosed() ? await present.locator('video').evaluateAll(videos => videos.map(video => ({ position: video.currentTime, paused: video.paused, readyState: video.readyState }))).catch(() => []) : [];
    await fs.writeFile(path.join(evidence, 'failure.json'), JSON.stringify({ observations, failures, errors, actualVideo, message: String(error), stack: error.stack }, null, 2));
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, 'failure-control.png') }).catch(() => {});
    if (present && !present.isClosed()) await present.screenshot({ path: path.join(evidence, 'failure-present.png') }).catch(() => {});
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => window.appApi.forceClose()).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
