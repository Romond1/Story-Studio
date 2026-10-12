/* Synthetic-device Electron acceptance; never opens the physical webcam.
 * Build renderer/main and npm test first. Requires ffmpeg and bundled Playwright.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { _electron } = require(process.env.STORY_STUDIO_PLAYWRIGHT || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const commands = require('../dist-test/shared/lesson/commands');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'story-camera-'));
  const evidence = process.env.STORY_STUDIO_CAMERA_EVIDENCE || path.join(root, 'docs/camera-phase1-evidence');
  await fs.mkdir(evidence, { recursive: true });
  const fixture = path.join(temporary, 'camera.y4m');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=1280x720:r=30,drawbox=x=160:y=180:w=240:h=360:color=red:t=fill', '-t', '1', '-pix_fmt', 'yuv420p', fixture]);
  const folder = path.join(temporary, 'lesson'); await fs.mkdir(folder);
  let project = commands.createLesson('Camera acceptance');
  for (const [title, color] of [['Blue story', '#0000ff'], ['White story', '#ffffff']]) {
    const scene = commands.createScene(title); scene.background.color = color;
    project = commands.insertScene(project, 'story', scene).project;
  }
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root, args: [root,
    `--user-data-dir=${path.join(temporary, 'profile')}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fixture}`] });
  const results = [], errors = [];
  const pass = name => { results.push(name); console.log('PASS', name); };
  try {
    const control = await app.firstWindow(); control.setDefaultTimeout(15000);
    control.on('pageerror', error => errors.push(String(error)));
    await control.evaluate(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.cameraCalls = [];
      navigator.mediaDevices.getUserMedia = constraints => { window.cameraCalls.push(constraints); return original(constraints); };
    });
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); dialog.showMessageBox = async () => ({ response: 1 }); }, folder);
    const button = name => control.getByRole('button', { name, exact: true });
    await button('Adventure').click(); await button('Open project').click(); await button('Teach').click();
    await button('Turn camera on').click();
    await button('Turn camera on').waitFor({ state: 'visible' });
    assert.equal((await control.evaluate(() => window.cameraControl.get())).settings.enabled, false);
    pass('Private permission cancellation leaves camera off');
    const present = app.windows().find(page => page !== control) || await app.waitForEvent('window');
    present.setDefaultTimeout(15000); present.on('pageerror', error => errors.push(String(error)));
    await present.evaluate(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.cameraCalls = []; window.cameraTracks = [];
      navigator.mediaDevices.getUserMedia = async constraints => {
        window.cameraCalls.push(constraints);
        const stream = await original(constraints); window.cameraTracks.push(...stream.getTracks()); return stream;
      };
    });
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); });
    await button('Turn camera on').click();
    await control.getByText('Camera live in Presenter', { exact: true }).waitFor();
    assert.equal(await present.evaluate(() => window.cameraCalls.length), 1);
    assert.equal(await present.evaluate(() => window.cameraCalls[0].audio), false);
    assert.equal(await control.evaluate(() => window.cameraCalls.filter(c => c.video).length), 0);
    assert.equal(await present.locator('button, select, input').count(), 0);
    pass('One video-only Presenter capture; no Control camera stream or student-facing controls');
    const set = patch => control.evaluate(async patch => {
      const { settings } = await window.cameraControl.get(); return window.cameraControl.set({ ...settings, ...patch });
    }, patch);
    const settle = () => present.waitForTimeout(180);
    const pixel = async (x, y) => {
      const png = await present.screenshot();
      return app.evaluate(({ nativeImage }, { bytes, x, y }) => {
        const image = nativeImage.createFromBuffer(Buffer.from(bytes));
        const data = image.crop({ x, y, width: 1, height: 1 }).toBitmap();
        return [data[2], data[1], data[0], data[3]];
      }, { bytes: [...png], x, y });
    };
    await set({ preset: 'full', mirror: false }); await settle();
    const size = await present.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const sampleX = Math.floor(size.width * .7), sampleY = Math.floor(size.height * .5);
    let color = await pixel(sampleX, sampleY);
    // Chromium's YUV conversion varies slightly by GPU/color profile.
    assert.ok(color[1] > 200 && color[0] < 120 && color[2] < 40, `raw green ${color}`);
    await control.getByLabel('Green-screen chroma key').check(); await settle();
    color = await pixel(sampleX, sampleY);
    assert.ok(color[2] > 220 && color[1] < 40, `key reveals blue story ${color}`);
    await present.screenshot({ path: path.join(evidence, 'keyed-full.png') });
    pass('Actual WebGL2 key turns synthetic green transparent over the blue story');
    await button('Next scene').click(); await settle();
    color = await pixel(sampleX, sampleY);
    assert.ok(color.slice(0, 3).every(c => c > 220), `navigation shows white story ${color}`);
    await button('Previous scene').click(); await settle();
    await set({ mirror: true }); await settle();
    color = await pixel(sampleX, sampleY);
    assert.ok(color[0] > 220 && color[1] < 40, `mirror moves red subject ${color}`);
    await set({ brightness: -.5, contrast: 1 }); await settle();
    color = await pixel(sampleX, sampleY);
    assert.ok(color[0] > 90 && color[0] < 160, `brightness changes subject ${color}`);
    await set({ brightness: 0, contrast: 0 }); await settle();
    color = await pixel(sampleX, sampleY);
    assert.ok(color.slice(0, 3).every(c => c > 110 && c < 145), `contrast ${color}`);
    await set({ contrast: 1 });
    pass('Scene navigation, mirror, brightness and contrast update without replacing capture');
    for (const preset of ['lower-left', 'lower-right', 'hidden', 'full']) {
      await control.getByLabel('Display preset').selectOption(preset); await settle();
      assert.equal(await present.locator(`.camera-${preset}`).count(), 1);
      if (preset === 'hidden') assert.equal(await present.locator('.camera-layer').isVisible(), false);
      else assert.equal(await present.locator('.camera-layer').isVisible(), true);
    }
    assert.equal(await present.evaluate(() => window.cameraCalls.length), 1);
    await set({ preset: 'lower-right' }); await settle();
    const beforeZoom = await present.locator('.camera-layer').boundingBox();
    await control.getByLabel('Live zoom').fill('2'); await settle();
    assert.deepEqual(await present.locator('.camera-layer').boundingBox(), beforeZoom);
    await present.screenshot({ path: path.join(evidence, 'keyed-corner.png') });
    await control.getByRole('region', { name: 'Camera', exact: true }).scrollIntoViewIfNeeded();
    await control.screenshot({ path: path.join(evidence, 'controls-desktop.png') });
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows().find(w => !w.getTitle().includes('— Present')); w.setMinimumSize(320, 400); w.setSize(480, 850); });
    await control.getByRole('region', { name: 'Camera', exact: true }).scrollIntoViewIfNeeded();
    await control.screenshot({ path: path.join(evidence, 'controls-narrow.png') });
    const controlsAudit = await control.getByRole('region', { name: 'Camera', exact: true }).evaluate(section => ({
      overflow: section.scrollWidth > section.clientWidth + 1,
      sliders: [...section.querySelectorAll('.camera-slider')].every(label => getComputedStyle(label).display === 'grid'),
      toggles: [...section.querySelectorAll('.camera-toggle')].every(label => getComputedStyle(label).flexDirection === 'row'),
    }));
    assert.deepEqual(controlsAudit, { overflow: false, sliders: true, toggles: true });
    pass('Four presets and story zoom preserve camera session and independent placement');
    await button('Turn camera off').click();
    await present.waitForFunction(() => window.cameraTracks.every(t => t.readyState === 'ended'));
    pass('Camera off ends all capture tracks');
    await set({ deviceId: 'missing-camera', enabled: true });
    await control.getByText(/Selected camera is unavailable/).waitFor();
    assert.equal(await present.locator('.camera-layer').isVisible(), false);
    assert.equal(await present.locator('.lesson-scene-content').count(), 1);
    pass('Missing camera reports privately and leaves story alive');
    await set({ enabled: false, deviceId: '' });
    await present.evaluate(() => {
      window.workingCamera = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Synthetic denial', 'NotAllowedError'); };
    });
    await set({ enabled: true });
    await control.getByText(/Camera permission denied/).waitFor();
    assert.equal(await present.locator('.camera-layer').isVisible(), false);
    await set({ enabled: false });
    await present.evaluate(() => { navigator.mediaDevices.getUserMedia = window.workingCamera; });
    pass('Simulated OS permission denial is recoverable and private');
    await set({ enabled: true }); await control.getByText('Camera live in Presenter', { exact: true }).waitFor();
    await present.evaluate(() => window.cameraTracks.at(-1).dispatchEvent(new Event('ended')));
    await control.getByText(/Camera disconnected/).waitFor();
    assert.equal(await present.evaluate(() => window.cameraTracks.every(t => t.readyState === 'ended')), true);
    await set({ enabled: false });
    await set({ enabled: true }); await control.getByText('Camera live in Presenter', { exact: true }).waitFor();
    pass('Simulated device disconnect releases capture and allows retry');
    await present.evaluate(() => {
      const gl = document.querySelector('.camera-layer canvas').getContext('webgl2');
      window.loseCameraContext = gl.getExtension('WEBGL_lose_context');
      window.loseCameraContext.loseContext();
    });
    await control.getByText(/Camera graphics context was lost/).waitFor();
    assert.equal(await present.locator('.lesson-scene-content').count(), 1);
    assert.equal(await present.evaluate(() => window.cameraTracks.every(t => t.readyState === 'ended')), true);
    await set({ enabled: false });
    await present.evaluate(() => window.loseCameraContext.restoreContext());
    await present.waitForFunction(() => !document.querySelector('.camera-layer canvas').getContext('webgl2').isContextLost());
    await set({ enabled: true }); await control.getByText('Camera live in Presenter', { exact: true }).waitFor();
    pass('WebGL context loss hides only camera, releases tracks, and recovers after restore');
    await present.close();
    await control.waitForFunction(async () => !(await window.cameraControl.get()).settings.enabled);
    pass('Closing Presenter resets camera to off');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ syntheticOnly: true, results, errors }, null, 2));
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
