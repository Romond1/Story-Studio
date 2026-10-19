/* Real model/worker, synthetic webcam made from the upstream public portrait.
 * No physical camera is opened. Pass a local image with STORY_STUDIO_FACE_FIXTURE.
 * Runtime network access is blocked after the fixture has been prepared.
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
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'story-face-'));
  const evidence = process.env.STORY_STUDIO_FACE_EVIDENCE || path.join(root, 'docs/face-tracking-phase2-evidence');
  await fs.mkdir(evidence, { recursive: true });
  const image = process.env.STORY_STUDIO_FACE_FIXTURE || path.join(temporary, 'portrait.jpg');
  if (!process.env.STORY_STUDIO_FACE_FIXTURE) {
    const response = await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');
    if (!response.ok) throw new Error('Unable to download test portrait. Set STORY_STUDIO_FACE_FIXTURE.');
    await fs.writeFile(image, Buffer.from(await response.arrayBuffer()));
  }
  const fixture = path.join(temporary, 'face.y4m');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=1280x720:r=30', '-loop', '1', '-i', image,
    '-filter_complex', '[1:v]crop=600:580:100:0,scale=480:464,rotate=0.18*sin(t):ow=560:oh=550:c=0x00ff00[face];[0:v][face]overlay=x=360+100*sin(t):y=130+35*cos(t):shortest=1',
    '-r', '30', '-t', '4', '-pix_fmt', 'yuv420p', fixture]);
  const folder = path.join(temporary, 'lesson'); await fs.mkdir(folder);
  let project = commands.createLesson('Face tracking acceptance');
  const scene = commands.createScene('Tracking over blue story'); scene.background.color = '#0000ff';
  project = commands.insertScene(project, 'story', scene).project;
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const devUrl = process.env.STORY_STUDIO_FACE_DEV_URL;
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root,
    env: { ...process.env, VITE_DEV_SERVER_URL: devUrl || '' }, args: [root,
    `--user-data-dir=${path.join(temporary, 'profile')}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fixture}`] });
  const results = [], errors = []; let present;
  const pass = name => { results.push(name); console.log('PASS', name); };
  try {
    const control = await app.firstWindow(); control.setDefaultTimeout(25000);
    control.on('pageerror', e => errors.push(String(e)));
    await app.evaluate(({ dialog, session }, { folder, devUrl }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
      dialog.showMessageBox = async () => ({ response: 0 });
      global.blockedNetwork = [];
      session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
        if (devUrl && new URL(details.url).origin === new URL(devUrl).origin) { callback({ cancel: false }); return; }
        global.blockedNetwork.push(details.url); callback({ cancel: true });
      });
    }, { folder, devUrl });
    const button = name => control.getByRole('button', { name, exact: true });
    await button('Adventure').click(); await button('Open project').click(); await button('Teach').click();
    await button('Open Present').click();
    present = app.windows().find(p => p !== control) || await app.waitForEvent('window');
    present.on('pageerror', e => errors.push(String(e))); present.setDefaultTimeout(25000);
    present.on('console', msg => { if (msg.type() === 'error') console.log('PRESENTER', msg.text()); });
    await present.evaluate(() => {
      window.faceMetrics = { acquisitions: 0, activeWorkers: 0, createdWorkers: 0, inFlight: 0, maximumInFlight: 0, results: 0, latencies: [], frames: [], poses: [], cameraDraws: [] };
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function(...args) { window.faceMetrics.cameraDraws.push(performance.now()); return draw.apply(this, args); };
      const drawElements = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function(...args) {
        const result = drawElements.apply(this, args), probe = window.merlinPixelProbe;
        if (probe && probe.samples < 32 && this.canvas.classList?.contains('merlin-costume-overlay') && !this.getParameter(this.FRAMEBUFFER_BINDING)) {
          // Read during drawing: Three.js intentionally does not preserve its
          // framebuffer after presentation. This sees only the 3D overlay,
          // independently of the webcam/2D diagnostic layers underneath/above it.
          const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
          this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels);
          let alpha = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) alpha++;
          probe.samples++; probe.maximumAlphaPixels = Math.max(probe.maximumAlphaPixels, alpha);
        }
        return result;
      };
      const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => { window.faceMetrics.acquisitions++; const stream = await get(constraints); window.testCameraTracks = stream.getTracks(); return stream; };
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) {
          super(...args); window.testFaceWorker = this; window.faceMetrics.createdWorkers++; window.faceMetrics.activeWorkers++;
          this.addEventListener('message', ({ data }) => {
            if (data.type !== 'result') return;
            window.faceMetrics.results++; window.faceMetrics.inFlight--;
            window.faceMetrics.latencies.push(performance.now() - data.timestamp);
            window.latestFace = data.observation;
            if (data.observation) {
              const p = data.observation.landmarks;
              window.faceMetrics.poses.push({ x: p[1].x, y: p[1].y, roll: Math.atan2((p[454].y-p[234].y)*360, (p[454].x-p[234].x)*640) });
            }
          });
        }
        postMessage(data, ...args) {
          if (data.type === 'frame') {
            window.faceMetrics.inFlight++; window.faceMetrics.maximumInFlight = Math.max(window.faceMetrics.maximumInFlight, window.faceMetrics.inFlight);
            window.faceMetrics.frames.push({ width: data.bitmap.width, height: data.bitmap.height, time: data.timestamp });
          }
          super.postMessage(data, ...args);
        }
        terminate() { if (!this.wasTerminated) { this.wasTerminated = true; window.faceMetrics.activeWorkers--; window.faceMetrics.inFlight = 0; } super.terminate(); }
      };
    });
    const set = patch => control.evaluate(async patch => {
      const { settings } = await window.cameraControl.get(); return window.cameraControl.set({ ...settings, ...patch, tracking: { ...settings.tracking, ...patch.tracking } });
    }, patch);
    await button('Turn camera on').click(); await control.getByText('Camera live in Presenter', { exact: true }).waitFor();
    await set({ preset: 'full', mirror: false, chromaKey: true });
    await control.getByLabel('Enable face tracking', { exact: true }).check();
    await control.getByText('Tracking face', { exact: true }).waitFor();
    await present.waitForFunction(() => window.faceMetrics.results >= 8);
    assert.equal(await present.evaluate(() => window.latestFace.landmarks.length), 478);
    assert.equal(await present.evaluate(() => window.latestFace.matrix.length), 16);
    assert.equal(await present.locator('button, input, select').count(), 0);
    assert.deepEqual(await app.evaluate(() => global.blockedNetwork), []);
    pass(`${devUrl ? 'Development' : 'Packaged'} classic worker runs real MediaPipe model locally: 478 landmarks, head matrix, private controls`);
    const painted = () => present.evaluate(() => {
      const canvas = document.querySelector('.face-landmark-overlay');
      return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0);
    });
    const waitPainted = () => present.waitForFunction(() => {
      const c = document.querySelector('.face-landmark-overlay');
      return c.width > 1 && c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i) => i%4===3 && v);
    });
    await waitPainted();
    assert.equal(await painted(), true);
    assert.equal(await control.getByRole('region', { name: 'Merlin developer diagnostics', exact: true }).count(), 0);
    await control.keyboard.press('Control+Alt+Shift+M');
    const diagnostics = control.getByRole('region', { name: 'Merlin developer diagnostics', exact: true });
    await diagnostics.getByRole('button', { name: 'Rigid preset', exact: true }).click();
    await present.waitForFunction(() => {
      const canvas = document.querySelector('.merlin-costume-overlay');
      return canvas.dataset.merlinAsset === 'ready' && canvas.dataset.merlinMode === 'diagnostic' && canvas.dataset.merlinPose === 'tracking';
    });
    let options = await control.evaluate(async () => (await window.cameraControl.get()).settings.tracking.merlinDiagnostics);
    assert.ok(options.enabled && !options.hairRoots && !options.pitchCompensation && !options.residualRegistration && !options.springMotion && !options.jawMotion);
    assert.equal(await present.locator('button, input, select').count(), 0, 'diagnostics must not add Presenter controls');
    await diagnostics.scrollIntoViewIfNeeded();
    await control.screenshot({ path: path.join(evidence, 'merlin-diagnostics-control.png') });
    await present.screenshot({ path: path.join(evidence, 'merlin-rigid-present.png') });
    const guidesOff = { axes: false, referencePoints: false, attachmentOrigins: false, occluderWireframe: false };
    await set({ tracking: { merlinDiagnostics: { ...options, ...guidesOff } } });
    await present.waitForTimeout(200);
    await present.evaluate(() => { window.merlinPixelProbe = { samples: 0, maximumAlphaPixels: 0 }; });
    await present.waitForFunction(() => window.merlinPixelProbe.maximumAlphaPixels > 100);
    const costumePixels = await present.evaluate(() => { const result = window.merlinPixelProbe; window.merlinPixelProbe = null; return result; });
    assert.ok(costumePixels.maximumAlphaPixels > 100, 'real GLB produces visible WebGL pixels with every guide disabled');
    await set({ tracking: { merlinDiagnostics: { ...options, ...guidesOff, costume: false } } });
    await present.waitForTimeout(200);
    await present.evaluate(() => { window.merlinPixelProbe = { samples: 0, maximumAlphaPixels: 0 }; });
    await present.waitForFunction(() => window.merlinPixelProbe.samples >= 3);
    const depthOnlyPixels = await present.evaluate(() => { const result = window.merlinPixelProbe; window.merlinPixelProbe = null; return result; });
    assert.equal(depthOnlyPixels.maximumAlphaPixels, 0, 'depth-only occluders emit no visible pixels when costume and guides are hidden');
    await diagnostics.getByRole('button', { name: 'Rigid preset', exact: true }).click();
    await diagnostics.getByLabel('Costume geometry', { exact: true }).uncheck();
    await diagnostics.getByLabel('Depth occlusion', { exact: true }).uncheck();
    await present.waitForTimeout(200);
    await present.screenshot({ path: path.join(evidence, 'merlin-guides-only-present.png') });
    await set({ mirror: true }); await present.waitForTimeout(200);
    await present.screenshot({ path: path.join(evidence, 'merlin-guides-mirrored-present.png') });
    await set({ mirror: false });
    await diagnostics.getByRole('button', { name: 'Rigid preset', exact: true }).click();
    for (const name of ['Costume geometry', 'Depth occlusion', 'Occluder wireframe', 'Canonical and observed references', 'Attachment origins', 'Head/model axes and pivots']) {
      await diagnostics.getByLabel(name, { exact: true }).uncheck();
      await diagnostics.getByLabel(name, { exact: true }).check();
    }
    await diagnostics.getByRole('button', { name: 'Compensated preset', exact: true }).click();
    options = await control.evaluate(async () => (await window.cameraControl.get()).settings.tracking.merlinDiagnostics);
    assert.ok(options.hairRoots && options.pitchCompensation && options.residualRegistration && options.springMotion && options.jawMotion);
    await present.waitForTimeout(200);
    await present.screenshot({ path: path.join(evidence, 'merlin-compensated-present.png') });
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(window => !window.getTitle().includes('— Present'));
      window.setMinimumSize(320, 400); window.setSize(480, 850);
    });
    await diagnostics.scrollIntoViewIfNeeded();
    assert.equal(await diagnostics.evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
    await control.screenshot({ path: path.join(evidence, 'merlin-diagnostics-narrow.png') });
    await diagnostics.getByRole('button', { name: 'Close diagnostics', exact: true }).click();
    await set({ tracking: { merlin: false } });
    await present.waitForFunction(() => document.querySelector('.merlin-costume-overlay').width === 1);
    assert.equal(await control.evaluate(async () => (await window.cameraControl.get()).settings.tracking.merlinDiagnostics), undefined);
    pass('Real Merlin GLB emits pixels; depth-only proxy stays invisible; hidden developer UI, rigid/compensated presets, toggles and diagnostic teardown work');
    // Exercise independently loaded wardrobe with the real assets and renderer.
    await set({ tracking: { merlin: false, markers: false, hat: true } });
    await control.getByLabel('Show Merlin 3D hat', { exact: true }).check();
    await present.waitForFunction(() => document.querySelector('.merlin-costume-overlay').dataset.merlinHat === 'ready'
      && document.querySelector('.face-landmark-overlay').width === 1);
    await present.waitForTimeout(200);
    await present.evaluate(() => { window.merlinPixelProbe = { samples: 0, maximumAlphaPixels: 0 }; });
    await present.waitForFunction(() => window.merlinPixelProbe.maximumAlphaPixels > 100);
    await present.evaluate(() => { window.merlinPixelProbe = null; });
    await present.screenshot({ path: path.join(evidence, 'wardrobe-hat-only.png') });
    await set({ tracking: { merlinHat: false, hat: false, merlinRobe: true } });
    await present.waitForFunction(() => document.querySelector('.merlin-costume-overlay').dataset.merlinRobe === 'ready');
    await present.waitForTimeout(200);
    await present.evaluate(() => { window.merlinPixelProbe = { samples: 0, maximumAlphaPixels: 0 }; });
    await present.waitForFunction(() => window.merlinPixelProbe.maximumAlphaPixels > 100);
    await present.evaluate(() => { window.merlinPixelProbe = null; });
    await present.screenshot({ path: path.join(evidence, 'wardrobe-robe-only.png') });
    await set({ tracking: { merlin: true, merlinHat: true, merlinRobe: true } });
    await present.waitForFunction(() => document.querySelector('.merlin-costume-overlay').dataset.merlinPose === 'tracking');
    await present.screenshot({ path: path.join(evidence, 'wardrobe-ensemble.png') });
    const beforeMirror = await present.evaluate(() => window.faceMetrics.results);
    await set({ mirror: true });
    await present.waitForFunction(before => window.faceMetrics.results >= before + 3 && window.latestFace
      && document.querySelector('.merlin-costume-overlay').dataset.merlinPose === 'tracking', beforeMirror);
    await present.screenshot({ path: path.join(evidence, 'wardrobe-ensemble-mirrored.png') });
    await control.getByLabel('Show Merlin 3D robe · experimental', { exact: true }).scrollIntoViewIfNeeded();
    await control.screenshot({ path: path.join(evidence, 'wardrobe-controls-narrow.png') });
    await set({ mirror: false, tracking: { merlin: false, merlinHat: false, merlinRobe: false, markers: true, hat: true } });
    await present.waitForFunction(() => document.querySelector('.merlin-costume-overlay').width === 1
      && document.querySelector('.face-landmark-overlay').width > 1);
    pass('Real standalone hat/robe emit pixels independently; temporary hat handoff, ensemble, mirror and teardown work');
    const inspect = async mirror => {
      await set({ mirror });
      await present.waitForTimeout(200);
      const handle = await present.waitForFunction(mirror => {
        const canvas = document.querySelector('.face-landmark-overlay');
        if (!window.latestFace || canvas.width <= 1) return false;
        const ctx = canvas.getContext('2d'), nose = window.latestFace.landmarks[1];
        const x = Math.round((mirror ? 1 - nose.x : nose.x) * canvas.width), y = Math.round(nose.y * canvas.height);
        // Latest inference and smoothed paint can differ slightly on a moving
        // fixture. Search a bounded 24px neighborhood for the tiny pink marker.
        const pixels = ctx.getImageData(x-12, y-12, 25, 25).data;
        let marker = false;
        for (let i=0; i<pixels.length; i+=4) if (pixels[i]>230 && pixels[i+1]>70 && pixels[i+1]<150 && pixels[i+3]>230) marker = true;
        const source = document.querySelector('.camera-layer canvas'), cameraRect = source.getBoundingClientRect(), trackingRect = canvas.getBoundingClientRect();
        const result = { marker, aligned: ['x','y','width','height'].every(k => Math.abs(cameraRect[k] - trackingRect[k]) < .01), fit: getComputedStyle(source).objectFit === getComputedStyle(canvas).objectFit,
          position: getComputedStyle(source).objectPosition === getComputedStyle(canvas).objectPosition, dimensions: source.width === canvas.width && source.height === canvas.height };
        return result.marker && result.aligned && result.fit && result.position && result.dimensions ? result : false;
      }, mirror);
      const result = await handle.jsonValue(); await handle.dispose(); return result;
    };
    for (const preset of ['full', 'lower-left', 'lower-right']) {
      await set({ preset });
      for (const mirror of [false, true]) {
        const sample = await inspect(mirror);
        assert.ok(sample.marker, `nose marker ${JSON.stringify(sample)}`);
        assert.ok(sample.aligned && sample.fit && sample.position && sample.dimensions);
      }
    }
    pass('Nose marker pixel and all camera/overlay dimensions align in both mirror states across Full/Left/Right presets');
    await set({ preset: 'full', mirror: false }); await present.waitForTimeout(200);
    await present.screenshot({ path: path.join(evidence, 'tracked-full.png') });
    await control.getByLabel('Show landmark markers').uncheck(); await control.getByLabel('Show temporary hat').uncheck();
    await present.waitForFunction(() => { const c = document.querySelector('.face-landmark-overlay'); return !c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i) => i%4===3 && v); });
    await control.getByLabel('Show temporary hat').check(); await waitPainted();
    assert.equal(await painted(), true);
    await set({ preset: 'lower-right' }); await present.waitForTimeout(200);
    await present.screenshot({ path: path.join(evidence, 'tracked-corner.png') });
    await control.getByRole('region', { name: 'Face Tracking', exact: true }).scrollIntoViewIfNeeded();
    await control.screenshot({ path: path.join(evidence, 'tracking-controls.png') });
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find(w => !w.getTitle().includes('— Present'));
      w.setMinimumSize(320,400); w.setSize(480,850);
    });
    await control.getByRole('region', { name: 'Face Tracking', exact: true }).scrollIntoViewIfNeeded();
    await control.screenshot({ path: path.join(evidence, 'tracking-controls-narrow.png') });
    assert.equal(await control.getByRole('region', { name: 'Face Tracking', exact: true }).evaluate(s => s.scrollWidth > s.clientWidth + 1), false);
    pass('Hat and debug visibility are independent without restarting inference or camera');
    await present.evaluate(() => {
      window.originalBitmap = window.createImageBitmap;
      const empty = new OffscreenCanvas(640, 360); const ctx = empty.getContext('2d'); ctx.fillStyle = '#00ff00'; ctx.fillRect(0,0,640,360);
      window.createImageBitmap = async () => empty.transferToImageBitmap();
    });
    await control.getByText('Face lost · looking for a face', { exact: true }).waitFor();
    await present.waitForFunction(() => document.querySelector('.face-landmark-overlay').width === 1);
    assert.equal(await painted(), false);
    await present.evaluate(() => { window.createImageBitmap = window.originalBitmap; });
    await control.getByText('Tracking face', { exact: true }).waitFor();
    pass('Actual no-face inference removes hat and recovers on returning face');
    await set({ preset: 'hidden' }); await present.waitForTimeout(500);
    const hiddenFrames = await present.evaluate(() => window.faceMetrics.frames.length);
    await present.waitForTimeout(300);
    assert.equal(await present.evaluate(() => window.faceMetrics.frames.length), hiddenFrames);
    await set({ preset: 'full' }); await control.getByText('Tracking face', { exact: true }).waitFor();
    assert.equal(await present.evaluate(() => window.faceMetrics.createdWorkers), 1);
    assert.equal(await present.evaluate(() => window.faceMetrics.acquisitions), 1);
    const metrics = await present.evaluate(() => window.faceMetrics);
    assert.equal(metrics.maximumInFlight, 1);
    assert.ok(metrics.frames.every(f => Math.max(f.width, f.height) <= 640));
    assert.ok(metrics.frames.slice(1).every((f, i) => f.time - metrics.frames[i].time >= 79));
    const range = key => Math.max(...metrics.poses.map(p => p[key])) - Math.min(...metrics.poses.map(p => p[key]));
    assert.ok(range('x') > .08 && range('y') > .03 && range('roll') > .1, 'real inference follows fixture movement and tilt');
    pass('Real inference follows horizontally/vertically moving and tilting portrait video');
    pass('One webcam, one worker, one in-flight frame; <=640px input, <=12.5Hz admission, Hidden pauses inference');
    await present.evaluate(() => window.testFaceWorker.dispatchEvent(new ErrorEvent('error', { message: 'Synthetic worker failure', cancelable: true })));
    await control.getByText(/Face tracking worker failed/).waitFor();
    await present.waitForFunction(() => document.querySelector('.face-landmark-overlay').width === 1);
    assert.equal(await painted(), false);
    assert.equal(await present.evaluate(() => window.testCameraTracks.every(t => t.readyState === 'live')), true);
    await control.getByLabel('Enable face tracking', { exact: true }).uncheck();
    await control.getByLabel('Enable face tracking', { exact: true }).check();
    await control.getByText('Tracking face', { exact: true }).waitFor();
    pass('Worker failure hides graphics but preserves camera; tracking restarts independently');
    await control.getByLabel('Enable face tracking', { exact: true }).uncheck();
    await present.waitForFunction(() => window.faceMetrics.activeWorkers === 0);
    await present.waitForFunction(() => document.querySelector('.face-landmark-overlay').width === 1);
    assert.equal(await present.evaluate(() => window.testCameraTracks.every(t => t.readyState === 'live')), true);
    await control.getByLabel('Enable face tracking', { exact: true }).check();
    await control.getByText('Tracking face', { exact: true }).waitFor();
    await button('Turn camera off').click();
    await present.waitForFunction(() => window.faceMetrics.activeWorkers === 0 && window.testCameraTracks.every(t => t.readyState === 'ended'));
    assert.equal(await present.locator('.face-landmark-overlay').evaluate(c => c.width), 1, 'camera off releases overlay backing store');
    pass('Tracking off terminates worker only; camera off terminates worker and ends capture tracks');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'results.json'), JSON.stringify({ fixture: 'Google MediaPipe public portrait, synthetic video; not physical-camera tracking', results, errors, metrics }, null, 2));
  } catch (error) {
    if (present && !present.isClosed()) await present.screenshot({ path: path.join(evidence, 'failure.png') }).catch(() => {});
    const control = await app.firstWindow(); console.log(await control.evaluate(() => window.cameraControl?.get()));
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
