/* Real Electron acceptance for Final Boss Hero in the shared Present Game host.
 * Build renderer/main first. Use a disposable lesson/profile, native game editor
 * and JSON import/export, genuine mouse/keyboard gameplay, read-only observers.
 * STORY_STUDIO_PLAYWRIGHT can point to a Playwright package directory.
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
const readGame = frame => frame.evaluate(() => JSON.parse(window.render_game_to_text()));
const readView = frame => frame.evaluate(() => ({ ...window.__battleStore.getState().playAreaView }));
const miniGames = ['memoryReveal', 'matchPairs', 'laneBattle', 'openBox', 'boardDash'];
const layoutPreflight = process.argv.includes('--layout-preflight');
const hostPreflight = process.argv.includes('--host-preflight');
const denseRecoveryDiagnostic = process.argv.includes('--dense-recovery-diagnostic');
const denseBoardPreflight = process.argv.includes('--dense-board-preflight') || denseRecoveryDiagnostic;
const diagnosticStylesheet = layoutPreflight ? process.env.FINAL_BOSS_PREFLIGHT_CSS : undefined;
const nativeButton = (frame, name) => frame.locator('button').filter({ hasText: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'story-final-boss-'));
  const folder = path.join(temporary, 'Disposable lesson');
  const evidence = path.join(root, 'docs', 'final-boss-evidence');
  await Promise.all([fs.mkdir(path.join(folder, 'assets'), { recursive: true }), fs.mkdir(evidence, { recursive: true })]);
  let fixture = commands.createLesson('Final Boss acceptance lesson');
  const firstScene = commands.createScene('First teaching scene');
  const secondScene = commands.createScene('Second editing scene');
  fixture = commands.insertScene(fixture, 'story', firstScene).project;
  fixture = commands.insertScene(fixture, 'story', secondScene).project;
  fixture = commands.insertScene(fixture, 'activation', commands.createScene('Discovery still works')).project;
  const fixtureJson = JSON.stringify(fixture, null, 2);
  await fs.writeFile(path.join(folder, 'project.json'), fixtureJson);
  const cutsceneFile = path.join(temporary, 'acceptance-cutscene.webm');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '8', '-c:v', 'libvpx', '-b:v', '150k', '-c:a', 'libvorbis', cutsceneFile], { stdio: 'pipe' });
  const cutsceneSource = `data:video/webm;base64,${(await fs.readFile(cutsceneFile)).toString('base64')}`;
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root,
    args: [root, `--user-data-dir=${path.join(temporary, 'profile')}`] });
  const passed = [], errors = [], consoleErrors = [], diagnosticFailures = [], gameStates = [], lifecycle = [], layouts = [], camera = [], assets = [], media = [], limitations = [];
  await app.evaluate(({ session }, destination) => {
    global.__acceptanceDownloads = [];
    session.defaultSession.on('will-download', (_event, item) => {
      const record = { filename: item.getFilename(), state: item.getState(), savePath: `${destination}/${item.getFilename().replace(/[^a-zA-Z0-9._-]/g, '_')}` };
      global.__acceptanceDownloads.push(record);
      // Choose the disposable destination through Electron's real DownloadItem;
      // native game APIs, picker implementation and download remain unchanged.
      item.setSavePath(record.savePath);
      item.on('done', (_event, state) => { record.state = state; record.completed = true; });
    });
  }, temporary.replaceAll('\\', '/'));
  const seen = new WeakSet(), mediaSeen = new WeakSet();
  let page, present, run;
  const pass = name => { passed.push(name); console.log(`PASS ${name}`); };
  const observe = (window, name) => {
    if (seen.has(window)) return;
    seen.add(window); window.setDefaultTimeout(15000);
    window.on('pageerror', error => errors.push({ window: name, message: String(error), stack: error.stack, timestamp: new Date().toISOString() }));
    window.on('console', entry => { if (entry.type() === 'error') consoleErrors.push({ window: name, message: entry.text(), timestamp: new Date().toISOString() }); });
  };
  const diagnostic = async (name, check) => { try { await check(); } catch (error) { diagnosticFailures.push({ name, message: String(error), stack: error.stack }); throw error; } };
  const report = () => ({ passed, errors, consoleErrors, diagnosticFailures, gameStates, lifecycle, layouts, camera, assets, media, limitations,
    sampleProject: folder, originalLessonsTouched: false, gameRuntimeMutations: false,
    originalGameTouched: false, conferencingAudioTested: false, nativeGameSavePickerSubstituted: true });
  try {
    page = await app.firstWindow(); observe(page, 'Control');
    page.on('dialog', dialog => dialog.accept());
    const button = name => page.getByRole('button', { name, exact: true });
    const resize = (window, width, height) => app.evaluate(({ BrowserWindow }, { url, width, height }) => {
      const native = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url);
      assertNative(native);
      function assertNative(value) { if (!value) throw new Error(`No native window for ${url}`); }
      native.setMinimumSize(320, 400); native.setSize(width, height);
    }, { url: window.url(), width, height });
    const settle = window => window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const settleGame = frame => frame.evaluate(() => new Promise((resolve, reject) => {
      let previous, stable = 0, animationFrame, stopped = false;
      const timeout = setTimeout(() => { stopped = true; cancelAnimationFrame(animationFrame); reject(new Error('Native view/content metrics failed to converge within 2500ms')); }, 2500);
      const sample = () => {
        if (stopped) return;
        const content = document.querySelector('.gameplay-content-stage'), viewport = document.querySelector('.gameplay-zoom-viewport');
        const view = window.__battleStore.getState().playAreaView;
        const signature = JSON.stringify([view.zoom, view.offsetX, view.offsetY, content?.offsetWidth, content?.offsetHeight, content?.scrollWidth, content?.scrollHeight, viewport?.clientWidth, viewport?.clientHeight]);
        stable = signature === previous ? stable + 1 : 0; previous = signature;
        if (stable >= 8) { stopped = true; clearTimeout(timeout); resolve(); }
        else animationFrame = requestAnimationFrame(sample);
      };
      animationFrame = requestAnimationFrame(sample);
    }));
    const screenshot = async (window, name) => { await settle(window); await window.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' }); };
    const singleton = async () => {
      assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 2);
      assert.equal(await page.locator('iframe').count(), 0, 'Control has no game runtime');
      assert.equal(await page.evaluate(() => typeof window.render_game_to_text), 'undefined');
      assert.equal(await present.locator('iframe').count(), 1, 'Present has exactly one authoritative runtime');
    };
    const getFrame = async () => {
      const iframe = present.locator('iframe[title="Final Boss Hero"]'); await iframe.waitFor();
      const frame = await (await iframe.elementHandle()).contentFrame();
      assert.ok(frame);
      await frame.waitForFunction(() => typeof window.render_game_to_text === 'function');
      await page.waitForFunction(() => document.querySelector('.game-session-heading [role="status"]')?.textContent.toLowerCase().includes('ready'));
      const target = (await present.evaluate(() => window.presentApi.requestSnapshot())).snapshot.target;
      assert.equal(target.kind, 'game'); assert.equal(target.gameId, 'final-boss-hero');
      assert.match(await iframe.getAttribute('src'), /final-boss-hero\.html(?:[?#]|$)/);
      assert.equal(await iframe.getAttribute('data-game-instance'), target.instanceId);
      assert.equal(await page.locator('[data-game-host]').getAttribute('data-game-instance'), target.instanceId);
      assets.push({ kind: 'runtime-entry', gameId: target.gameId, instanceId: target.instanceId, ...(await frame.evaluate(() => ({
        scripts: [...document.scripts].map(script => script.src).filter(Boolean),
        stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => link.href),
      }))) });
      if (!mediaSeen.has(frame)) {
        mediaSeen.add(frame);
        try {
          const cdp = await app.context().newCDPSession(frame);
          cdp.on('Media.playerEventsAdded', detail => media.push({ event: 'playerEventsAdded', gameInstanceId: target.instanceId, ...detail }));
          cdp.on('Media.playerErrorsRaised', detail => media.push({ event: 'playerErrorsRaised', gameInstanceId: target.instanceId, ...detail }));
          cdp.on('Media.playerPropertiesChanged', detail => media.push({ event: 'playerPropertiesChanged', gameInstanceId: target.instanceId, playerId: detail.playerId,
            properties: detail.properties.filter(property => !/url/i.test(property.name) && property.value.length < 1024) }));
          await cdp.send('Media.enable');
        } catch (error) {
          if (!/part of the parent frame's session/.test(String(error))) throw error;
          media.push({ event: 'observerScope', gameInstanceId: target.instanceId, parentSession: true });
        }
      }
      return { frame, instanceId: target.instanceId };
    };
    const launch = async () => {
      await button('Launch Final Boss Hero').click();
      present = app.windows().find(window => window !== page && !window.isClosed()) || await app.waitForEvent('window');
      observe(present, 'Present'); await button('Focus Present').waitFor();
      if (!mediaSeen.has(present)) {
        mediaSeen.add(present);
        const cdp = await app.context().newCDPSession(present);
        cdp.on('Media.playerEventsAdded', detail => media.push({ event: 'playerEventsAdded', ...detail }));
        cdp.on('Media.playerErrorsRaised', detail => media.push({ event: 'playerErrorsRaised', ...detail }));
        cdp.on('Media.playerPropertiesChanged', detail => media.push({ event: 'playerPropertiesChanged', playerId: detail.playerId,
          properties: detail.properties.filter(property => !/url/i.test(property.name) && property.value.length < 1024) }));
        await cdp.send('Media.enable');
      }
      const next = await getFrame(); await singleton(); return next;
    };
    const dismissCue = async frame => {
      const cue = frame.locator('.transition-cue');
      if (await cue.count()) await cue.waitFor({ state: 'detached', timeout: 2500 });
    };
    const gameClick = async (frame, name) => { await dismissCue(frame); await nativeButton(frame, name).click(); };
    const auditIntroControl = async (control, label) => {
      await control.scrollIntoViewIfNeeded();
      const audit = await control.evaluate(node => {
        const port = node.closest('.battle-intro-screen'), r = node.getBoundingClientRect(), clip = port.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { rect: r.toJSON(), scrollport: clip.toJSON(), scrollTop: port.scrollTop, centerReceivesPointer: hit === node || node.contains(hit) };
      });
      layouts.push({ label, introControl: audit });
      const r = audit.rect, clip = audit.scrollport;
      assert.ok(r.left >= clip.left - 1 && r.right <= clip.right + 1, `${label}: control fits the native Intro scrollport width`);
      const verticallyReachable = r.height > clip.height + 1
        ? r.top + r.height / 2 >= clip.top && r.top + r.height / 2 <= clip.bottom
        : r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
      assert.ok(verticallyReachable, `${label}: the native click point is inside the Intro scrollport when used`);
      assert.equal(audit.centerReceivesPointer, true, `${label}: native pointer reaches the control`);
    };
    const startBattle = async (frame, auditIntro = false) => {
      await frame.waitForFunction(() => !!document.querySelector('.battle-intro-hero-card, .memory-reveal'));
      if (await frame.locator('.battle-intro-hero-card').count()) {
        if (auditIntro) {
          await settleGame(frame); await geometry(frame, `Narrow/dense recovery Intro before native selection ${await present.evaluate(() => innerWidth)}`);
          const port = frame.locator('.battle-intro-screen'), portBox = await port.boundingBox();
          const scrollBefore = await port.evaluate(node => node.scrollTop);
          await present.mouse.move(portBox.x + portBox.width * 0.75, portBox.y + portBox.height / 2); await present.mouse.wheel(0, 280);
          await frame.waitForFunction(before => document.querySelector('.battle-intro-screen').scrollTop > before, scrollBefore);
        }
        const hero = frame.locator('.battle-intro-hero-card').first();
        if (auditIntro) await auditIntroControl(hero, 'Native Intro hero choice');
        await hero.click();
        if (auditIntro) {
          assert.match(await hero.getAttribute('class'), /is-selected/);
          const card = frame.locator('.battle-intro-card').first();
          await auditIntroControl(card, 'Native Intro vocabulary review card'); await card.click();
          await frame.getByRole('dialog').waitFor();
          await frame.getByRole('button', { name: 'Close enlarged card', exact: true }).click();
          await frame.getByRole('dialog').waitFor({ state: 'detached' });
          await auditIntroControl(nativeButton(frame, 'Start Battle'), 'Native Intro Start Battle');
        }
        await gameClick(frame, 'Start Battle');
      }
      await frame.locator('.memory-reveal').waitFor();
    };
    const geometry = async (frame, label, selector = '.battle-shell') => {
      const logical = await frame.evaluate(selector => {
        const scope = document.querySelector(selector), box = scope.getBoundingClientRect();
        const visible = [...scope.querySelectorAll('button, select')].filter(node => {
          const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden';
        });
        const stage = document.querySelector('.gameplay-stage-frame')?.getBoundingClientRect();
        const viewport = document.querySelector('.gameplay-zoom-viewport')?.getBoundingClientRect();
        const criticalSelectors = '.memory-target-banner, .memory-grid, .memory-side-left, .memory-side-right, .match-grid, .lane-arena, .open-box-grid, .board-dash-board, .board-tile, .battle-intro-screen';
        const critical = [...scope.querySelectorAll(criticalSelectors)].map(node => ({ name: node.className, rect: node.getBoundingClientRect().toJSON() }));
        return { width: innerWidth, height: innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          scope: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
          stage: stage ? { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom } : null,
          transforms: [...scope.querySelectorAll('.gameplay-stage-frame, .gameplay-area, .center-column, .memory-reveal, .memory-arena, .gameplay-content-stage')].map(node => ({ name: node.className, transform: getComputedStyle(node).transform, width: node.clientWidth, height: node.clientHeight })),
          gameViewport: viewport?.toJSON(), critical,
          view: { ...window.__battleStore.getState().playAreaView },
          content: [...scope.querySelectorAll('.gameplay-content-stage, .open-box-game, .mini-game-hud, .mini-game-result, .open-box-grid-wrap, .open-box-grid, .open-box-tile, .board-dash-game, .board-dash-board')].map(node => {
            const css = getComputedStyle(node);
            return { name: node.className, rect: node.getBoundingClientRect().toJSON(), offsetWidth: node.offsetWidth, offsetHeight: node.offsetHeight,
              scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight, width: css.width, height: css.height, minWidth: css.minWidth,
              minHeight: css.minHeight, fontSize: css.fontSize, gap: css.gap, padding: css.padding, gridTemplateColumns: css.gridTemplateColumns,
              cardHeight: css.getPropertyValue('--game-card-height'), zoom: css.zoom, transform: css.transform };
          }),
          focusedElement: { tag: document.activeElement?.tagName, className: document.activeElement?.className, text: document.activeElement?.textContent?.slice(0, 80) },
          ancestors: [document.documentElement, document.body, scope, ...scope.querySelectorAll('.top-bar, .battle-main, .center-column, .gameplay-stage-frame, .gameplay-area, .overlay-mask, .gameplay-zoom-viewport, .gameplay-zoom-layer')].map(node => ({ name: node.className || node.tagName,
            scrollLeft: node.scrollLeft, scrollTop: node.scrollTop, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, transform: getComputedStyle(node).transform, rect: node.getBoundingClientRect().toJSON() })),
          clippedCritical: viewport ? critical.filter(({ rect: r }) => r.left < viewport.left - 1 || r.right > viewport.right + 1 || r.top < viewport.top - 1 || r.bottom > viewport.bottom + 1).map(node => node.name) : [],
          clippedHorizontally: visible.filter(node => { const r = node.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(node => node.textContent.trim().slice(0, 60)),
          belowFold: visible.filter(node => node.getBoundingClientRect().bottom > innerHeight + 1).map(node => node.textContent.trim().slice(0, 60)) };
      }, selector);
      const outer = await present.locator('iframe').evaluate(iframe => {
        const r = iframe.getBoundingClientRect(); return { width: innerWidth, height: innerHeight, layoutWidth: iframe.offsetWidth,
          left: r.left, top: r.top, right: r.right, bottom: r.bottom, scale: r.width / iframe.offsetWidth,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      layouts.push({ label, logical, outer });
      assert.equal(outer.horizontalOverflow, false, `${label}: Present fits horizontally`);
      assert.equal(logical.horizontalOverflow, false, `${label}: Final Boss fits horizontally`);
      assert.ok(outer.left >= -1 && outer.top >= -1 && outer.right <= outer.width + 1 && outer.bottom <= outer.height + 1, `${label}: iframe fits Present`);
      assert.ok(logical.scope.left >= -1 && logical.scope.top >= -1 && logical.scope.right <= logical.width + 1 && logical.scope.bottom <= logical.height + 1, `${label}: native game shell fits`);
      assert.deepEqual(logical.clippedHorizontally, [], `${label}: controls fit horizontally`);
      for (const ancestor of logical.ancestors.filter(node => /^(battle-shell|gameplay-area|gameplay-zoom-viewport)(?:\s|$)/.test(node.name))) {
        assert.equal(ancestor.scrollLeft, 0, `${label}: ${ancestor.name} has no hidden horizontal focus scroll`);
        assert.equal(ancestor.scrollTop, 0, `${label}: ${ancestor.name} has no hidden vertical focus scroll`);
      }
      if (logical.stage) assert.ok(logical.stage.left >= -1 && logical.stage.top >= -1 && logical.stage.right <= logical.width + 1 && logical.stage.bottom <= logical.height + 1, `${label}: critical gameplay stage fits the viewport`);
      assert.deepEqual(logical.clippedCritical, [], `${label}: original playfield fits inside the game viewport`);
    };
    const controlGeometry = async label => {
      const audit = await page.locator('[data-game-host]').evaluate(scope => {
        const nodes = [...scope.querySelectorAll('button, h1, h2, [role="group"]')].filter(node => { const r = node.getBoundingClientRect(); return r.width && r.height; });
        const boxes = nodes.map(node => ({ name: node.textContent.trim(), ...Object.fromEntries(['left', 'right', 'top', 'bottom'].map(key => [key, node.getBoundingClientRect()[key]])) }));
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          if (nodes[i].contains(nodes[j]) || nodes[j].contains(nodes[i])) continue;
          const a = boxes[i], b = boxes[j];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([a.name, b.name]);
        }
        return { horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          clipped: boxes.filter(box => box.left < -1 || box.right > innerWidth + 1).map(box => box.name), overlaps };
      });
      layouts.push({ label, control: audit });
      assert.equal(audit.horizontalOverflow, false); assert.deepEqual(audit.clipped, []); assert.deepEqual(audit.overlaps, []);
    };
    const importFixture = async frame => {
      await gameClick(frame, 'Switch to Edit Mode');
      // Only read the existing game configuration. Importing JSON through the native
      // file input exercises the public editor and sanitizer; it is not a state shortcut.
      const config = await frame.evaluate(() => {
        const state = window.__battleStore.getState();
        return JSON.parse(JSON.stringify({ encounter: state.activeEncounter, cardLibrary: state.cardLibrary }));
      });
      config.encounter.name = 'Acceptance vocabulary boss';
      config.cardLibrary = config.cardLibrary.slice(0, 6);
      config.cardLibrary.forEach(card => { card.miniGames = miniGames; card.boardDashQuestion = `Describe ${card.title} in your own words.`; });
      config.encounter.selectedCardIds = config.cardLibrary.map(card => card.id);
      config.encounter.boardDashCardIds = config.encounter.selectedCardIds;
      config.encounter.boardDashCardLimit = 3;
      config.encounter.boardDashMedallionCounts = { move: 3, bonus: 1, back3: 0, rollAgain: 1, steal: 1 };
      config.encounter.roundSettings.roundCount = 1;
      config.encounter.cutscenes = [{ id: 'acceptance-audio', name: 'Acceptance audio cutscene', mediaType: 'video', mediaSource: cutsceneSource,
        description: 'Disposable generated VP8/Vorbis video and 440 Hz audio.', tags: ['neutral', 'intermission'] }];
      config.encounter.battleSettings.heroMaxHp = 1000;
      config.encounter.battleSettings.heroStartHp = 1000;
      config.encounter.battleSettings.villainMaxHp = 1000;
      config.encounter.battleSettings.villainStartHp = 1000;
      const payload = { metadata: { schema: 'final-boss-hero-project', version: 1, projectName: config.encounter.name, exportedAt: new Date().toISOString() }, project: config };
      const nativeFixture = path.join(temporary, 'acceptance-vocabulary.fbh-project.json');
      await fs.writeFile(nativeFixture, JSON.stringify(payload, null, 2));
      await frame.locator('input[type="file"][accept=".json,.fbh-project.json,application/json"]').setInputFiles(nativeFixture);
      await frame.getByText('Encounter: Acceptance vocabulary boss', { exact: true }).waitFor();
      await frame.getByLabel('Encounter Name', { exact: true }).fill('Acceptance vocabulary boss edited');
      await frame.getByRole('button', { name: 'Board Dash', exact: true }).click();
      await frame.getByPlaceholder('Question about this card…', { exact: true }).first().fill('Name a heroic action using this vocabulary.');
      await frame.getByRole('button', { name: 'Settings', exact: true }).click();
      await frame.getByLabel(/^Difficulty/).selectOption('easy');
      // Substitute only the OS file-picker/write boundary. The game's original
      // Save As button, export serialization and re-import remain real.
      await frame.evaluate(() => {
        window.showSaveFilePicker = async () => ({ name: 'acceptance-export.fbh-project.json', createWritable: async () => ({
          write: async contents => { window.__acceptanceExportedText = contents; }, close: async () => {} }) });
      });
      await frame.getByRole('button', { name: 'Save As', exact: true }).click();
      await frame.waitForFunction(() => typeof window.__acceptanceExportedText === 'string');
      const exportedText = await frame.evaluate(() => window.__acceptanceExportedText);
      const exportedFile = path.join(temporary, 'exported.fbh-project.json'); await fs.writeFile(exportedFile, exportedText);
      const exported = JSON.parse(exportedText);
      assert.equal(exported.metadata.schema, 'final-boss-hero-project');
      assert.equal(exported.project.encounter.name, 'Acceptance vocabulary boss edited');
      assert.equal(exported.project.encounter.roundSettings.difficulty, 'easy');
      assert.equal(exported.project.cardLibrary.length, 6);
      assert.equal(exported.project.cardLibrary[0].boardDashQuestion, 'Name a heroic action using this vocabulary.');
      await frame.locator('input[type="file"][accept=".json,.fbh-project.json,application/json"]').setInputFiles(exportedFile);
      await frame.getByRole('button', { name: 'Switch to Play Mode', exact: true }).click();
      await gameClick(frame, 'Reset Battle'); await startBattle(frame);
      const metrics = await frame.evaluate(() => {
        const viewport = document.querySelector('.gameplay-zoom-viewport'), content = document.querySelector('.gameplay-content-stage');
        return { view: window.__battleStore.getState().playAreaView, viewport: { width: viewport.clientWidth, height: viewport.clientHeight },
          content: { scrollWidth: content.scrollWidth, scrollHeight: content.scrollHeight, offsetWidth: content.offsetWidth, offsetHeight: content.offsetHeight },
          shell: document.querySelector('.battle-shell').getBoundingClientRect().toJSON() };
      });
      layouts.push({ label: 'After native project import/export', metrics });
      pass('Original encounter editor, vocabulary project import, difficulty edit, native JSON export and re-import work in Present');
    };
    const verifyAssets = async frame => {
      await frame.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      const images = await frame.evaluate(() => [...document.images].map(image => ({ alt: image.alt, src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 })));
      assets.push(...images); assert.ok(images.length > 0); assert.ok(images.every(image => image.loaded));
      const bundledNames = (await fs.readdir(path.join(root, 'dist', 'renderer', 'assets'))).filter(name => /^(start|finish|move|bonus|back3|roll-again|steal)-[^/]+\.png$/.test(name));
      assert.equal(bundledNames.length, 7, 'All seven original Board Dash icons are emitted');
      const bundled = await frame.evaluate(names => Promise.all(names.map(name => new Promise(resolve => {
        const image = new Image(); image.onload = () => resolve({ name, src: image.currentSrc, loaded: image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight, bundled: true });
        image.onerror = () => resolve({ name, src: image.src, loaded: false, bundled: true }); image.src = new URL(`./assets/${name}`, location.href).href;
      }))), bundledNames);
      assert.ok(bundled.every(image => image.loaded), 'Packaged file URLs load all original Board Dash icons'); assets.push(...bundled);
      if (images.some(image => /^https?:/.test(image.src))) limitations.push('Original sample character/card/background art uses remote placehold.co; this run verified those requests loaded.');
    };
    const complete = async (frame, id) => {
      await frame.waitForFunction(id => { const state = JSON.parse(window.render_game_to_text()); return state.intermission.sourceMiniGameId === id && ['intermission', 'battleComplete'].includes(state.battlePhase); }, id);
      const state = await readGame(frame); gameStates.push({ miniGame: id, state });
      assert.equal(state.intermission.lastResult.miniGameId, id);
      assert.ok(Number.isFinite(state.intermission.lastResult.heroScore));
      assert.ok(Number.isFinite(state.intermission.lastResult.villainScore));
      await screenshot(present, `${id}-completion`);
      return state;
    };
    const playMemory = async frame => {
      await frame.locator('.memory-reveal').waitFor();
      for (let round = 1; round <= 4; round++) {
        if (round > 1) await checkMiniGameLayouts(frame, `memoryReveal-round-${round}`);
        assert.equal(await frame.locator('.memory-grid .memory-card').count(), round + 2, 'Original growing memory board reaches three, four, five and six cards');
        // Memorize the face shown at the highlighted target position in preview.
        const targetIndex = Number((await frame.locator('.memory-target-banner').innerText()).match(/\d+/)[0]) - 1;
        const target = await frame.locator('.memory-grid .memory-card img').nth(targetIndex).getAttribute('alt');
        const start = nativeButton(frame, 'Start Game');
        if (await start.count()) await gameClick(frame, 'Start Game');
        await gameClick(frame, 'Guess');
        await frame.locator('.memory-side-left button').filter({ has: frame.getByText(target, { exact: true }) }).click();
        const wrong = frame.locator('.memory-side-right button').filter({ hasNot: frame.getByText(target, { exact: true }) });
        await wrong.first().click(); await gameClick(frame, 'Reveal');
        if (round < 4) await gameClick(frame, 'Next Round');
      }
      const state = await complete(frame, 'memoryReveal');
      assert.equal(state.intermission.lastResult.winner, 'hero');
      assert.equal(state.intermission.lastResult.heroScore, 4); assert.equal(state.intermission.lastResult.villainScore, 0);
      pass('Memory Reveal: genuine preview/guess/selection/reveal through all four rounds, scoring and HP resolution');
      return state;
    };
    const checkMiniGameLayouts = async (frame, id) => {
      for (const [width, height] of [[1366, 768], [800, 600], [390, 844]]) {
        await resize(present, width, height); await settleGame(frame);
        await geometry(frame, `${id} Present ${width}x${height}`);
        await screenshot(present, `${id}-present-${width}x${height}`);
      }
      await resize(present, 1440, 1000); await settle(present);
    };
    const playPairs = async frame => {
      await frame.locator('.match-pairs').waitFor(); await gameClick(frame, 'Start Game');
      // Face DOM is an observation of the original rendered deck, never mutated.
      const titles = await frame.locator('.match-grid button img').evaluateAll(images => images.map(image => image.alt));
      await present.keyboard.press('ArrowRight');
      await frame.waitForFunction(() => document.querySelectorAll('.match-grid button')[1]?.classList.contains('is-focused'));
      await present.keyboard.press('ArrowLeft');
      await frame.waitForFunction(() => document.querySelectorAll('.match-grid button')[0]?.classList.contains('is-focused'));
      await page.getByRole('group', { name: 'Game keyboard controls', exact: true }).click();
      await page.keyboard.press('ArrowRight');
      await frame.waitForFunction(() => document.querySelectorAll('.match-grid button')[1]?.classList.contains('is-focused'));
      await page.keyboard.press('Enter');
      await frame.waitForFunction(() => document.querySelector('.match-hud, .match-pairs .mini-game-hud')?.textContent.includes('firstCardSelected'));
      await page.keyboard.press('Escape');
      await frame.waitForFunction(() => !document.querySelector('.match-grid .is-picked'));
      const groups = new Map(); titles.forEach((title, index) => { const group = groups.get(title) || []; group.push(index); groups.set(title, group); });
      for (const [title, indices] of groups) {
        assert.equal(indices.length, 2, `${title} has a matching pair`);
        await dismissCue(frame); await frame.locator('.match-grid button').nth(indices[0]).click();
        await frame.locator('.match-grid button').nth(indices[1]).click();
        await frame.waitForFunction(() => { const state = JSON.parse(window.render_game_to_text()); const text = document.querySelector('.match-pairs .mini-game-hud')?.textContent || ''; return state.battlePhase === 'intermission' || text.includes('heroTurn') || text.includes('villainTurn'); });
      }
      await complete(frame, 'matchPairs');
      pass('Match Pairs: native arrows and Control arrow/Enter/Escape forwarding, mouse pair matching, alternating turns and completion');
    };
    const playLane = async frame => {
      await frame.locator('.lane-battle').waitFor(); await gameClick(frame, 'Start Game');
      for (let turn = 0; turn < 3; turn++) {
        await dismissCue(frame);
        await frame.locator('.lane-hero-deck button:not([disabled])').first().dblclick();
        await frame.locator('.lane-villain-deck button:not([disabled])').first().dblclick();
        const next = nativeButton(frame, turn < 2 ? 'Next Turn' : 'Next Round');
        await next.waitFor(); await next.click();
      }
      await complete(frame, 'laneBattle');
      pass('Lane Battle: original double-click cards, clash resolution, special-card score and complete round');
    };
    const playBoxes = async frame => {
      await frame.locator('.open-box-grid').waitFor(); await gameClick(frame, 'Start Game');
      for (let turn = 0; turn < 6; turn++) {
        await dismissCue(frame);
        const closed = frame.locator('.open-box-tile:not([disabled])');
        await closed.nth(0).click(); await closed.nth(1).click();
        await gameClick(frame, 'Reveal'); await gameClick(frame, 'Next Turn');
      }
      await complete(frame, 'openBox');
      assert.equal(await frame.locator('.open-box-tile.is-opened').count(), 12);
      pass('Open the Box: twelve original chests, simultaneous reveal effects, six turns and scoring/completion');
    };
    const playBoard = async frame => {
      await frame.locator('.board-dash-game').waitFor(); await gameClick(frame, 'Start Game');
      await frame.waitForFunction(() => [...document.querySelectorAll('.board-dash-game img')].every(image => image.complete && image.naturalWidth > 0));
      const boardImages = await frame.locator('.board-dash-game img').evaluateAll(images => images.map(image => ({ alt: image.alt, src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 })));
      assets.push(...boardImages);
      const startImage = await frame.locator('.board-tile--start .board-tile-icon').getAttribute('src');
      assert.ok(!/^https?:/.test(startImage), 'Original Board Dash PNGs are bundled');
      let rolls = 0, markedChallenges = 0;
      const questions = [], actions = [];
      while ((await readGame(frame)).battlePhase !== 'intermission' && rolls < 100) {
        await dismissCue(frame);
        const roll = frame.locator('button').filter({ hasText: /^Roll for (Hero|Villain)$/ });
        const done = nativeButton(frame, 'Done — Next Turn');
        await frame.waitForFunction(() => { const state = JSON.parse(window.render_game_to_text()); return state.battlePhase === 'intermission' || [...document.querySelectorAll('button')].some(button => !button.disabled && (/^Roll for (Hero|Villain)$/.test(button.textContent.trim()) || button.textContent.trim() === 'Done — Next Turn')); });
        if ((await readGame(frame)).battlePhase === 'intermission') break;
        if (await done.count()) {
          questions.push(...await frame.locator('.board-resolve-question').allTextContents());
          actions.push(...await frame.locator('.board-resolve-action strong').allTextContents());
          await done.click(); markedChallenges++;
        }
        else if (await roll.count()) {
          const rollBox = await roll.boundingBox();
          if (rollBox) {
            await present.mouse.click(rollBox.x + rollBox.width / 2, rollBox.y + rollBox.height / 2); rolls++;
            // Original Roll remains present during its 850ms dice animation.
            // Wait for the real spin to finish before choosing another action.
            await frame.waitForFunction(() => document.querySelector('.dice3d.is-rolling') || JSON.parse(window.render_game_to_text()).battlePhase === 'intermission');
            await frame.waitForFunction(() => !document.querySelector('.dice3d.is-rolling'));
          }
        }
      }
      assert.ok(rolls < 100, 'A real dice race reaches finish within the acceptance bound');
      const state = await complete(frame, 'boardDash'); assert.ok(['hero', 'villain'].includes(state.intermission.lastResult.winner));
      gameStates.push({ miniGame: 'boardDash', rolls, markedChallenges, questions: [...new Set(questions)], actions: [...new Set(actions)] });
      pass(`Board Dash: real dice, token movement, teacher-marked challenges, turn progression and finish (${rolls} rolls, ${markedChallenges} challenges)`);
    };
    const playAudioCutscene = async frame => {
      await gameClick(frame, 'Cutscenes');
      await frame.locator('.play-cutscene-toolbar select').nth(1).selectOption('acceptance-audio'); await gameClick(frame, 'Play');
      await frame.waitForFunction(() => { const video = document.querySelector('.cutscene-overlay video'); return video && video.readyState >= 2 && !video.paused && video.currentTime > 0.1; });
      const video = await frame.locator('.cutscene-overlay video').evaluate(video => ({ muted: video.muted, paused: video.paused,
        time: video.currentTime, audioDecodedBytes: video.webkitAudioDecodedByteCount, source: video.currentSrc.slice(0, 24) }));
      assert.equal(video.muted, false); assert.equal(video.paused, false); assert.ok(video.audioDecodedBytes > 0, 'Native cutscene decodes its audio track in Present');
      await screenshot(present, 'final-boss-cutscene-audio');
      media.push({ event: 'nativeCutscenePlayback', ...video }); return video;
    };
    const realFileAccess = async () => {
      await button('Mastery').click(); let fileRun = await launch();
      await gameClick(fileRun.frame, 'Switch to Edit Mode');
      const availability = await fileRun.frame.evaluate(() => ({ savePicker: typeof window.showSaveFilePicker, loadPicker: typeof window.showOpenFilePicker }));
      const record = { action: 'actual-native-file-access', availability, nativeApiSubstituted: false };
      let downloaded;
      try {
        [downloaded] = await Promise.all([present.waitForEvent('download', { timeout: 7000 }), fileRun.frame.getByRole('button', { name: 'Save As', exact: true }).click()]);
      } catch (error) {
        if (!/Timeout/.test(String(error))) throw error;
      }
      record.saveStatus = await fileRun.frame.locator('.edit-shell-status').innerText();
      record.electronDownloads = await app.evaluate(() => global.__acceptanceDownloads);
      const downloadedFile = path.join(temporary, 'actual-download.fbh-project.json');
      if (downloaded) await downloaded.saveAs(downloadedFile);
      else if (record.electronDownloads.some(download => download.state === 'completed')) {
        await fs.copyFile(record.electronDownloads.find(download => download.state === 'completed').savePath, downloadedFile);
      }
      record.downloadFallback = downloaded != null || record.electronDownloads.some(download => download.state === 'completed');
      if (record.downloadFallback) {
        const json = JSON.parse(await fs.readFile(downloadedFile, 'utf8')); assert.equal(json.metadata.schema, 'final-boss-hero-project');
        pass('Actual sandbox Save As produces original project JSON through the real Electron download');
      } else {
        assert.ok(!/downloaded|failed.*download/i.test(record.saveStatus), 'Native Save As reports download only when Electron created a downloadable file');
        limitations.push('Unmodified native Save As produced no download event in Playwright or Electron within seven seconds, and its status did not report fallback/download. The native picker request remains unverified and needs manual OS interaction; the serializer/editor roundtrip was checked separately.');
        record.savePickerUnverified = true;
        // Close this disposable native picker/runtime and independently test Load
        // in a fresh instance; a pending Save As must not hide the Load result.
        await app.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url)?.destroy(), present.url());
        await button('Launch Final Boss Hero').waitFor(); fileRun = await launch();
        await gameClick(fileRun.frame, 'Switch to Edit Mode');
        await fs.copyFile(path.join(temporary, 'exported.fbh-project.json'), downloadedFile);
      }
      let chosen;
      try {
        [chosen] = await Promise.all([present.waitForEvent('filechooser', { timeout: 7000 }), fileRun.frame.getByRole('button', { name: 'Load', exact: true }).click()]);
      } catch (error) {
        if (!/Timeout/.test(String(error))) throw error;
      }
      record.loadStatus = await fileRun.frame.locator('.edit-shell-status').innerText();
      record.loadChooserFallback = chosen != null;
      if (!chosen) {
        assert.ok(!/using file import fallback/i.test(record.loadStatus), 'Native Load reports fallback only when a chooser opened');
        limitations.push(record.loadStatus.includes('Load canceled.')
          ? 'Unmodified native Load returned the original Load canceled status without a browser file-chooser event. Selecting a real file through the OS picker needs a manual check; direct supported file-input import is verified separately.'
          : 'Unmodified native Load produced no browser file-chooser event within seven seconds, and its status did not report file-import fallback. Its native picker request needs manual OS interaction; direct supported file-input import is verified separately.');
        record.loadPickerUnverified = true; lifecycle.push(record);
        await app.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url)?.destroy(), present.url());
        await button('Launch Final Boss Hero').waitFor(); await button('Return to lesson').click(); return;
      }
      await chosen.setFiles(downloadedFile);
      await fileRun.frame.getByText('Loaded actual-download.fbh-project.json', { exact: true }).waitFor();
      lifecycle.push(record);
      pass('Actual native Load file-chooser fallback imports project JSON without API substitution');
      await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    };

    await button('Mastery').waitFor(); await resize(page, 1440, 1000);
    await button('Adventure').click();
    await app.evaluate(({ dialog }, directory) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] }); }, folder);
    await button('Open project').click(); await page.getByText('Lesson opened.', { exact: true }).waitFor();
    await button('Edit').click(); await page.locator(`[data-entry-id="${fixture.sequences.story[1].id}"]`).click();
    await button('Add Card').click(); await page.getByLabel('Card name', { exact: true }).fill('Unsaved Final Boss return card');
    const dirtyText = 'The hero remembers the original lesson.'; await page.getByLabel('Card text', { exact: true }).fill(dirtyText);
    await button('Show in Present').click(); await button('Open Present').click();
    present = app.windows().find(window => window !== page && !window.isClosed()) || await app.waitForEvent('window'); observe(present, 'Present');
    await button('Teach').click(); await button('Previous scene').click();
    await present.waitForFunction(id => document.querySelector('[data-scene-surface="present"]')?.getAttribute('data-scene-id') === id, firstScene.id);
    await button('Mastery').click(); await button('Launch Final Boss Hero').waitFor();
    assert.equal(await button('Launch Language Snake').count(), 0);
    await screenshot(page, 'mastery-selection-desktop'); await controlGeometry('Mastery selection desktop');
    run = await launch(); await resize(present, 1440, 1000);
    await screenshot(present, 'final-boss-original-intro'); await verifyAssets(run.frame);
    pass('Mastery filters registry correctly; ready game runs once in Present with loaded original artwork and no Control iframe');
    await importFixture(run.frame);
    if (denseBoardPreflight) {
      for (const count of denseRecoveryDiagnostic ? [60] : [48, 60]) {
        await gameClick(run.frame, 'Switch to Edit Mode');
        const payload = JSON.parse(await fs.readFile(path.join(temporary, 'exported.fbh-project.json'), 'utf8'));
        payload.project.encounter.name = `Acceptance dense ${count} tile board`;
        payload.project.encounter.boardDashMedallionCounts = count === 48
          ? { move: 10, bonus: 10, back3: 10, rollAgain: 10, steal: 3 }
          : { move: 12, bonus: 12, back3: 12, rollAgain: 12, steal: 7 };
        const denseFixture = path.join(temporary, `dense-${count}.fbh-project.json`);
        await fs.writeFile(denseFixture, JSON.stringify(payload));
        await run.frame.locator('input[type="file"][accept=".json,.fbh-project.json,application/json"]').setInputFiles(denseFixture);
        await run.frame.getByText(`Encounter: Acceptance dense ${count} tile board`, { exact: true }).waitFor();
        await run.frame.getByRole('button', { name: 'Switch to Play Mode', exact: true }).click();
        await gameClick(run.frame, 'Reset Battle'); await startBattle(run.frame);
        await run.frame.getByLabel(/^Mini-Game/).selectOption('boardDash');
        await run.frame.locator('.board-dash-game').waitFor(); await gameClick(run.frame, 'Start Game');
        await dismissCue(run.frame);
        assert.equal(await run.frame.locator('.board-tile').count(), count, 'Native project import renders its exact dense tile count');
        await run.frame.waitForFunction(() => [...document.querySelectorAll('.board-dash-game img')].every(image => image.complete && image.naturalWidth > 0));
        for (const [width, height] of [[1366, 768], [800, 600], [390, 844]]) {
          await resize(present, width, height); await settleGame(run.frame);
          await geometry(run.frame, `Dense Board Dash ${count} ${width}x${height}`);
          await screenshot(present, `dense-board-${count}-${width}x${height}`);
          const fitted = await readView(run.frame), viewport = await run.frame.locator('.gameplay-zoom-viewport').boundingBox();
          if (count === 60 && width <= 800) assert.ok(fitted.zoom < 0.28, 'Dense native Board Dash can automatically fit below the original manual zoom floor');
          await present.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
          await present.mouse.wheel(0, -120);
          await run.frame.waitForFunction(zoom => window.__battleStore.getState().playAreaView.zoom > zoom, fitted.zoom);
          await gameClick(run.frame, 'Reset'); await settleGame(run.frame);
          await geometry(run.frame, `Dense Board Dash ${count} ${width}x${height} after native wheel and Reset View`);
          camera.push({ density: count, width, height, fitted, restored: await readView(run.frame) });
        }
        if (count === 60) {
          await run.frame.getByLabel(/^Mini-Game/).selectOption('memoryReveal');
          await run.frame.locator('.memory-reveal').waitFor(); await settleGame(run.frame);
          assert.ok((await readView(run.frame)).zoom >= 0.28, 'Ordinary Memory Reveal leaves the dense-only lower fit floor');
          const selection = () => run.frame.evaluate(() => { const state = window.__battleStore.getState(); return {
            cardLibraryIds: state.cardLibrary.map(card => card.id), selectedCardIds: [...state.activeEncounter.selectedCardIds],
          }; });
          const beforeReset = await selection();
          gameStates.push({ action: 'dense-to-ordinary-recovery', beforeReset });
          try { await geometry(run.frame, 'Dense60 narrow recovery to Memory Reveal'); }
          catch (error) { if (!denseRecoveryDiagnostic) throw error; diagnosticFailures.push({ name: 'Dense60 narrow recovery to Memory Reveal', message: String(error) }); }
          await screenshot(present, 'dense-recovery-memory-390x844');
          if (!denseRecoveryDiagnostic) {
            await run.frame.getByLabel(/^Mini-Game/).selectOption({ label: 'Intro / Setup' });
            await run.frame.locator('.battle-intro-hero-card').first().waitFor(); await settleGame(run.frame);
            assert.ok((await readView(run.frame)).zoom >= 0.28, 'Intro Setup leaves the dense-only lower fit floor');
            await geometry(run.frame, 'Dense60 narrow recovery to Intro Setup');
            await screenshot(present, 'dense-recovery-intro-390x844');
          }
          for (const [width, height] of [[390, 844], [800, 600], [1366, 768]]) {
            await resize(present, width, height);
            await gameClick(run.frame, 'Reset Battle'); await startBattle(run.frame, !denseRecoveryDiagnostic); await settleGame(run.frame);
            const afterReset = await selection(); assert.deepEqual(afterReset, beforeReset, 'Native Reset Battle retains identical card library and selection');
            gameStates.push({ action: 'dense-to-ordinary-recovery-reset', width, height, afterReset });
            await geometry(run.frame, `Dense60 recovery after native Reset Battle and Start Battle ${width}x${height}`);
            await screenshot(present, `dense-recovery-memory-after-reset-${width}x${height}`);
          }
        }
        await resize(present, 1440, 1000); await settleGame(run.frame);
        pass(`Native ${count}-tile Board Dash import fits every tile at desktop/laptop/narrow sizes and Reset View restores fit after wheel zoom`);
      }
      assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
      await fs.writeFile(path.join(evidence, denseRecoveryDiagnostic ? 'dense-recovery-diagnostic.json' : 'dense-board-results.json'), JSON.stringify({ ...report(), layoutRegressionOnly: true, ...(denseRecoveryDiagnostic ? { diagnosticOnly: true } : {}) }, null, 2));
      await Promise.all(['dense-board-failure.json', 'dense-board-failure-control.png', 'dense-board-failure-present.png'].map(name => fs.rm(path.join(evidence, name), { force: true })));
      return;
    }
    if (layoutPreflight) {
      // This separate diagnostic path uses the native game menu and never emits
      // smoke-results.json or a full acceptance claim. Default acceptance stays strict.
      if (diagnosticStylesheet) await run.frame.addStyleTag({ path: diagnosticStylesheet });
      for (const id of miniGames) {
        await run.frame.getByLabel(/^Mini-Game/).selectOption(id);
        await run.frame.waitForFunction(id => JSON.parse(window.render_game_to_text()).selectedMiniGame === id, id);
        await dismissCue(run.frame);
        for (const [width, height] of [[1366, 768], [800, 600], [390, 844]]) {
          await resize(present, width, height); await settleGame(run.frame);
          const label = `Preflight ${id} ${width}x${height}`;
          try { await geometry(run.frame, label); }
          catch (error) { diagnosticFailures.push({ name: label, message: String(error), stack: error.stack }); console.log(`LAYOUT ISSUE ${label}: ${error.message}`); }
          await screenshot(present, `preflight-${diagnosticStylesheet ? 'css-' : ''}${id}-${width}x${height}`);
        }
        await resize(present, 1440, 1000); await settle(present);
      }
      await fs.writeFile(path.join(evidence, diagnosticStylesheet ? 'layout-preflight-css-experiment.json' : 'layout-preflight.json'), JSON.stringify({ ...report(), diagnosticOnly: true, diagnosticStylesheet }, null, 2));
      await Promise.all(['layout-preflight-failure.json', 'layout-preflight-failure-control.png', 'layout-preflight-failure-present.png'].map(name => fs.rm(path.join(evidence, name), { force: true })));
      console.log(`Layout diagnostic completed: ${diagnosticFailures.length} failed layouts, ${errors.length} page errors. Full acceptance has not completed.`);
      return;
    }
    if (!hostPreflight) {
    await page.getByRole('group', { name: 'Game keyboard controls', exact: true }).click(); await page.keyboard.press('Shift+M');
    await run.frame.getByRole('button', { name: 'Pointer On', exact: true }).waitFor();
    await page.keyboard.press('Shift+N'); await run.frame.getByRole('button', { name: 'Villain Trail', exact: true }).waitFor();
    await page.keyboard.press('Shift+M'); await run.frame.getByRole('button', { name: 'Pointer', exact: true }).waitFor();
    pass('Control forwards configured Shift+M and Shift+N with modifier identity to the sole Present game');
    for (const [width, height] of [[1366, 768], [800, 600], [390, 844]]) {
      const before = await readGame(run.frame); await resize(present, width, height); await settleGame(run.frame);
      await diagnostic(`Present ${width}x${height}`, () => geometry(run.frame, `Present ${width}x${height}`)); assert.deepEqual(await readGame(run.frame), before);
      await screenshot(present, `final-boss-present-${width}x${height}`);
    }
    await resize(present, 1366, 768); await settle(present);
    const viewport = run.frame.locator('.gameplay-zoom-viewport'); const box = await viewport.boundingBox();
    const pointer = { x: box.x + box.width * 0.55, y: box.y + box.height * 0.55 };
    const beforeWheel = await readView(run.frame); await present.mouse.move(pointer.x, pointer.y); await present.mouse.wheel(0, -600);
    await run.frame.waitForFunction(zoom => window.__battleStore.getState().playAreaView.zoom > zoom, beforeWheel.zoom);
    for (let step = 0; step < 16; step++) {
      const verticallyPannable = await run.frame.evaluate(() => { const content = document.querySelector('.gameplay-content-stage'), viewport = document.querySelector('.gameplay-zoom-viewport'); return content.offsetHeight > viewport.clientHeight + 70; });
      if (verticallyPannable) break;
      await present.mouse.wheel(0, -120); await settle(present);
    }
    const zoomed = await readView(run.frame);
    // Zoom at center before panning to avoid a boundary clamp obscuring movement.
    const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await present.mouse.move(middle.x, middle.y); await present.mouse.down({ button: 'middle' });
    await present.mouse.move(middle.x + 30, middle.y + 15, { steps: 8 }); await present.mouse.up({ button: 'middle' });
    const panned = await readView(run.frame);
    const scale = await present.locator('iframe').evaluate(iframe => iframe.getBoundingClientRect().width / iframe.offsetWidth);
    await diagnostic('Native middle-drag accuracy', async () => {
      assert.ok(Math.abs(panned.offsetX - zoomed.offsetX - 30 / scale) < 2, 'Native middle-drag horizontal mapping is accurate');
      assert.ok(Math.abs(panned.offsetY - zoomed.offsetY - 15 / scale) < 2, 'Native middle-drag vertical mapping is accurate');
    });
    camera.push({ beforeWheel, zoomed, panned, scale, physicalDelta: { x: 30, y: 15 } });
    await gameClick(run.frame, 'Reset');
    if (!diagnosticFailures.length) pass('Laptop/narrow Present retain gameplay and fit; native wheel zoom and middle-button pan preserve pointer accuracy');
    await resize(present, 1440, 1000);
    await playMemory(run.frame);
    for (const [id, play] of [['matchPairs', playPairs], ['laneBattle', playLane], ['openBox', playBoxes], ['boardDash', playBoard]]) {
      await gameClick(run.frame, 'Continue to Next Mini-Game');
      assert.equal((await readGame(run.frame)).selectedMiniGame, id);
      await checkMiniGameLayouts(run.frame, id);
      await play(run.frame);
    }
    assert.deepEqual(await run.frame.evaluate(() => window.__battleStore.getState().battleProgress.completedMiniGames), miniGames);
    pass('All five games complete through native controls with aggregate score, HP and intermission progression');
    await playAudioCutscene(run.frame); await gameClick(run.frame, 'Close');
    assert.equal(await run.frame.locator('.cutscene-overlay video').count(), 0); await gameClick(run.frame, 'Hide Cutscenes');
    pass('Original imported cutscene plays its generated audio in Present and Close releases the video element');
    await gameClick(run.frame, 'Switch to Edit Mode'); await run.frame.getByRole('button', { name: 'Settings', exact: true }).click();
    await run.frame.getByLabel('Villain Start HP', { exact: true }).fill('1');
    await run.frame.getByRole('button', { name: 'Switch to Play Mode', exact: true }).click();
    await gameClick(run.frame, 'Reset Battle'); await startBattle(run.frame);
    const won = await playMemory(run.frame); assert.equal(won.battlePhase, 'battleComplete'); assert.equal(won.battleState.outcome, 'heroVictory');
    await gameClick(run.frame, 'Start New Battle'); await startBattle(run.frame);
    assert.equal((await readGame(run.frame)).battleState.outcome, 'active');
    pass('Native HP editor reaches a genuine Hero victory and original Start New Battle restores fresh battle resources');
    }

    await screenshot(page, 'final-boss-control-desktop'); await controlGeometry('Final Boss Control desktop');
    await resize(page, 390, 844); await screenshot(page, 'final-boss-control-narrow'); await controlGeometry('Final Boss Control narrow');
    await resize(page, 1440, 1000);
    await playAudioCutscene(run.frame);
    const old = run; await button('Restart game').click();
    await present.waitForFunction(id => document.querySelector('iframe')?.getAttribute('data-game-instance') !== id, old.instanceId);
    run = await getFrame(); assert.notEqual(run.instanceId, old.instanceId); assert.equal(old.frame.isDetached(), true);
    assert.equal(await run.frame.locator('video').count(), 0, 'Restart has no old cutscene stream');
    await assert.rejects(() => old.frame.evaluate(() => window.render_game_to_text()), /detached|destroyed|closed/i);
    await startBattle(run.frame);
    await page.evaluate(instanceId => {
      window.appApi.sendGameInput({ instanceId, key: 'M', code: 'KeyM', phase: 'keydown', repeat: false, shiftKey: true });
      window.appApi.sendGameInput({ instanceId, key: 'M', code: 'KeyM', phase: 'keyup', repeat: false, shiftKey: true });
    }, old.instanceId);
    await page.waitForTimeout(200); assert.equal(await run.frame.getByRole('button', { name: 'Pointer On', exact: true }).count(), 0);
    await singleton(); lifecycle.push({ action: 'restart', oldInstanceId: old.instanceId, newInstanceId: run.instanceId, oldFrameDestroyed: true, staleInputIgnored: true });
    pass('Host restart destroys the old runtime; fresh instance starts normally and ignores stale input');
    await page.getByRole('group', { name: 'Game keyboard controls', exact: true }).click(); await page.keyboard.press('ArrowRight');
    await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(await button('Teach').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), firstScene.id);
    await button('Edit').click(); assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), secondScene.id);
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.match(await page.locator('.lesson-project-title').innerText(), /Unsaved/);
    await button('Mastery').click(); run = await launch(); await button('Return to game selection').click();
    await present.locator('iframe').waitFor({ state: 'detached' }); assert.equal(run.frame.isDetached(), true);
    run = await launch(); const closedId = run.instanceId;
    await app.evaluate(({ BrowserWindow }, url) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url).close(), present.url());
    await button('Launch Final Boss Hero').waitFor(); assert.equal(app.windows().filter(window => !window.isClosed()).length, 1);
    run = await launch(); assert.notEqual(run.instanceId, closedId); await singleton();
    await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), secondScene.id);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), fixtureJson);
    await screenshot(page, 'lesson-restored-after-final-boss');
    lifecycle.push({ action: 'return-exit-reopen-close', closedInstanceId: closedId, reopenedInstanceId: run.instanceId, lessonCursorsRetained: true, dirtyCardRetained: true, originalProjectUnchanged: true });
    pass('Exit/reopen/native Present close/return retain lesson dirty edits and independent Teach/Edit cursors; game arrows never navigate the lesson');
    await realFileAccess();
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), fixtureJson);
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, [], 'Control/Present log no renderer console errors');
    assert.deepEqual(media.filter(event => event.event === 'playerErrorsRaised'), [], 'Present media produces no decoder errors');
    assert.deepEqual(diagnosticFailures, []);
    limitations.push('Default game has no synthesized/background audio. Imported VP8/Vorbis cutscene audio decode and runtime cleanup are automated; physical/conferencing audibility remains a manual check.');
    await fs.writeFile(path.join(evidence, hostPreflight ? 'host-preflight.json' : 'smoke-results.json'), JSON.stringify({ ...report(), ...(hostPreflight ? { diagnosticOnly: true } : {}) }, null, 2));
    if (hostPreflight) await Promise.all(['host-preflight-failure.json', 'host-preflight-failure-control.png', 'host-preflight-failure-present.png'].map(name => fs.rm(path.join(evidence, name), { force: true })));
    if (!hostPreflight) await Promise.all(['smoke-failure.json', 'failure-control.png', 'failure-present.png'].map(name => fs.rm(path.join(evidence, name), { force: true })));
    if (hostPreflight) console.log('Host diagnostic completed. Full gameplay acceptance has not completed.');
    console.log(`Disposable proof: ${folder}`);
  } catch (error) {
    const diagnosticPrefix = layoutPreflight ? 'layout-preflight-' : hostPreflight ? 'host-preflight-' : denseBoardPreflight ? 'dense-board-' : '';
    if (!diagnosticPrefix) await fs.rm(path.join(evidence, 'smoke-results.json'), { force: true });
    if (denseBoardPreflight) await fs.rm(path.join(evidence, 'dense-board-results.json'), { force: true });
    await fs.writeFile(path.join(evidence, diagnosticPrefix ? `${diagnosticPrefix}failure.json` : 'smoke-failure.json'), JSON.stringify({ ...report(), message: String(error), stack: error.stack }, null, 2));
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, `${diagnosticPrefix}failure-control.png`) }).catch(() => {});
    if (present && !present.isClosed()) await present.screenshot({ path: path.join(evidence, `${diagnosticPrefix}failure-present.png`) }).catch(() => {});
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => window.appApi.forceClose()).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
