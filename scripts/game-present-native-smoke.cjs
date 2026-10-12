/* Real Electron native-resolution acceptance, including a separate 2x-DPR profile.
 * Build renderer/main first. No game state, preload API or asset request is mocked.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
let playwright;
try { playwright = require(process.env.STORY_STUDIO_PLAYWRIGHT || 'playwright'); }
catch (error) {
  if (process.env.STORY_STUDIO_PLAYWRIGHT || error.code !== 'MODULE_NOT_FOUND') throw error;
  playwright = require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'));
}
const { _electron } = playwright;
const readGame = frame => frame.evaluate(() => JSON.parse(window.render_game_to_text()));
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function inspect(present, frame) {
  const outer = await present.locator('iframe[title="Language Snake"]').evaluate(iframe => {
    const rect = iframe.getBoundingClientRect();
    return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, transform: getComputedStyle(iframe).transform,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      iframe: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, layoutWidth: iframe.offsetWidth, layoutHeight: iframe.offsetHeight } };
  });
  const inner = await frame.evaluate(() => {
    const viewport = document.getElementById('game-viewport'), rect = viewport.getBoundingClientRect();
    const board = document.querySelector('.game-board') ?? [...document.querySelectorAll('div[style]')].find(node => node.style.aspectRatio && node.style.borderRadius === '28px');
    const playfield = board.getBoundingClientRect(), bar = getComputedStyle(viewport, '::-webkit-scrollbar');
    return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, transform: getComputedStyle(viewport).transform,
      columns: getComputedStyle(document.querySelector('.top-layout')).gridTemplateColumns.split(' ').filter(Boolean).length,
      boardPanelTop: document.querySelector('.game-board-panel').getBoundingClientRect().top,
      playerCards: [...document.querySelectorAll('.player-column > div:first-child')].map(card => {
        const box = card.getBoundingClientRect();
        return { name: card.querySelector('h3')?.textContent, bounds: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          buttons: [...card.querySelectorAll('button')].map(button => { const buttonBox = button.getBoundingClientRect(); return { name: button.textContent.trim(), left: buttonBox.left, right: buttonBox.right, top: buttonBox.top, bottom: buttonBox.bottom }; }) };
      }),
      viewport: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      board: { left: playfield.left, right: playfield.right, top: playfield.top, bottom: playfield.bottom },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 || viewport.scrollWidth > viewport.clientWidth + 1,
      scrollbar: { width: getComputedStyle(viewport).scrollbarWidth, webkitDisplay: bar.display, webkitWidth: bar.width, allocatedWidth: viewport.offsetWidth - viewport.clientWidth } };
  });
  return { outer, inner };
}
function assertGeometry(sample) {
  const { outer, inner } = sample;
  assert.equal(inner.width, outer.width, 'Iframe renders at native Present client width');
  assert.equal(inner.height, outer.height, 'Iframe renders at native Present client height');
  assert.equal(inner.dpr, outer.dpr, 'Iframe preserves native parent DPR');
  assert.equal(outer.transform, 'none', 'Parent applies no raster scaling transform');
  assert.equal(inner.transform, 'none', 'Game viewport applies no raster scaling transform');
  for (const box of [outer.iframe, inner.viewport]) {
    assert.ok(Math.abs(box.x) <= 1 && Math.abs(box.y) <= 1 && Math.abs(box.width - outer.width) <= 1 && Math.abs(box.height - outer.height) <= 1, 'Native game covers the full Present viewport without black gaps');
  }
  assert.equal(outer.iframe.layoutWidth, outer.width); assert.equal(outer.iframe.layoutHeight, outer.height);
  assert.equal(outer.horizontalOverflow, false); assert.equal(inner.horizontalOverflow, false);
  assert.ok(inner.scrollbar.width === 'none' || inner.scrollbar.webkitDisplay === 'none' || inner.scrollbar.webkitWidth === '0px', 'Vertical scrollbar is explicitly hidden');
  assert.equal(inner.scrollbar.allocatedWidth, 0, 'Hidden scrollbar consumes no render width');
  assert.ok(inner.board.left >= -1 && inner.board.right <= inner.width + 1 && inner.board.top >= -1 && inner.board.bottom <= inner.height + 1, 'Default 3D playfield fits the native viewport');
  assert.equal(inner.columns, inner.width > 880 ? 3 : inner.width > 480 ? 2 : 1, 'Windowed desktop keeps side players while narrow portrait puts the board first');
  if (inner.width > 880) {
    assert.equal(inner.playerCards.length, 2, 'Both original players retain their side panels');
    for (const card of inner.playerCards) {
      assert.ok(card.bounds.left >= -1 && card.bounds.right <= inner.width + 1 && card.bounds.top >= -1 && card.bounds.bottom <= inner.height + 1, `${card.name} remains visible beside the board`);
      assert.equal(card.buttons.length, 4, `${card.name} retains all four movement buttons`);
      for (const button of card.buttons) assert.ok(button.left >= -1 && button.right <= inner.width + 1 && button.top >= -1 && button.bottom <= inner.height + 1, `${card.name} ${button.name} is visible without scrolling`);
    }
  } else for (const card of inner.playerCards) assert.ok(inner.boardPanelTop < card.bounds.top, 'Narrow portrait puts the board before both player panels');
}

(async () => {
  const root = path.resolve(__dirname, '..'), evidence = path.join(root, 'docs', 'game-host-evidence', 'native-resolution');
  await fs.mkdir(evidence, { recursive: true });
  const profiles = [], errors = [];
  for (const dpr of [1, 2]) {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), `story-native-dpr${dpr}-`));
    const app = await _electron.launch({ executablePath: require('electron'), cwd: root,
      args: [root, `--user-data-dir=${path.join(temporary, 'profile')}`, `--force-device-scale-factor=${dpr}`] });
    let control, present, keyboardCheck;
    try {
      control = await app.firstWindow(); control.setDefaultTimeout(14000);
      control.on('pageerror', error => errors.push({ dpr, window: 'Control', message: String(error) }));
      const button = name => control.getByRole('button', { name, exact: true });
      await button('Challenge').click(); await button('Launch Language Snake').click();
      present = app.windows().find(page => page !== control) || await app.waitForEvent('window');
      present.setDefaultTimeout(14000); present.on('pageerror', error => errors.push({ dpr, window: 'Present', message: String(error) }));
      const iframe = present.locator('iframe[title="Language Snake"]'); await iframe.waitFor();
      const frame = await (await iframe.elementHandle()).contentFrame();
      await frame.waitForFunction(() => typeof window.render_game_to_text === 'function');
      const instanceId = await iframe.getAttribute('data-game-instance');
      const native = async (operation, size) => app.evaluate(({ BrowserWindow }, { url, operation, size }) => {
        const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url);
        if (operation === 'maximize') window.maximize();
        else { window.unmaximize(); window.setMinimumSize(320, 400); window.setSize(...size); }
      }, { url: present.url(), operation, size });
      await native('resize', [1440, 1000]); await settle(present);
      await frame.locator('#splash-continue').click();
      await frame.getByLabel('Enable crown challenges', { exact: true }).uncheck();
      await frame.locator('#start-game').click();
      await frame.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'collection');
      // Genuine input establishes an observable live state before resize assertions.
      await frame.getByRole('button', { name: 'UP', exact: true }).first().click();
      if ((await readGame(frame)).pendingPickup) {
        await frame.getByRole('button', { name: 'Show answer (1)', exact: true }).click();
        await frame.getByRole('button', { name: 'Correct (1)', exact: true }).click();
        if ((await readGame(frame)).pickupResolution) await frame.getByRole('button', { name: 'Continue', exact: true }).click();
      }
      const liveState = await readGame(frame), samples = [];
      const sample = async name => {
        await settle(present);
        await frame.evaluate(() => { document.getElementById('game-viewport').scrollTop = 0; });
        await settle(present);
        const geometry = await inspect(present, frame);
        assert.equal(frame.isDetached(), false, 'Native resize retains the game browsing context');
        assert.equal(await iframe.getAttribute('data-game-instance'), instanceId, 'Native resize retains the instance ID');
        assert.deepEqual(await readGame(frame), liveState, 'Native resize retains live gameplay state');
        const screenshot = await present.screenshot({ path: path.join(evidence, `native-dpr${dpr}-${name}.png`), animations: 'disabled' });
        const pixels = { width: screenshot.readUInt32BE(16), height: screenshot.readUInt32BE(20) };
        samples.push({ name, ...geometry, screenshotPixels: pixels, retainedInstanceId: instanceId });
        assertGeometry(geometry); assert.equal(geometry.outer.dpr, dpr, 'Forced native device density applies to Present');
        assert.equal(pixels.width, Math.round(geometry.outer.width * dpr), 'Screenshot raster width matches native device pixels');
        assert.equal(pixels.height, Math.round(geometry.outer.height * dpr), 'Screenshot raster height matches native device pixels');
      };
      for (const size of [[960, 600], [600, 900], [1920, 1080]]) { await native('resize', size); await sample(size.join('x')); }
      await native('maximize'); await present.waitForTimeout(100); await sample('maximized');
      // Play directly in Present: direction keys must move the snake without
      // also triggering the focused scroll region's browser navigation default.
      await native('resize', [960, 600]); await settle(present);
      await frame.evaluate(() => { document.getElementById('game-viewport').scrollTop = 0; });
      const beforeKey = await readGame(frame), activePlayer = beforeKey.players.find(player => player.id === beforeKey.activeTurn);
      assert.equal(activePlayer.id, beforeKey.players[1].id, 'The original first move hands the turn to the arrow-key player');
      await frame.getByRole('region', { name: 'Language Snake playfield and settings', exact: true }).focus();
      await present.keyboard.press('ArrowDown');
      await frame.waitForFunction(({ id, x, y }) => {
        const player = JSON.parse(window.render_game_to_text()).players.find(player => player.id === id);
        return player.snake[0].x === x && player.snake[0].y === y + 1;
      }, { id: activePlayer.id, ...activePlayer.snake[0] });
      await present.waitForTimeout(250);
      keyboardCheck = { key: 'ArrowDown', playerId: activePlayer.id, beforeHead: activePlayer.snake[0],
        afterHead: (await readGame(frame)).players.find(player => player.id === activePlayer.id).snake[0],
        scrollBefore: 0, scrollAfter: await frame.evaluate(() => document.getElementById('game-viewport').scrollTop) };
      assert.equal(keyboardCheck.scrollAfter, 0, 'Direct Present movement arrows do not scroll the game viewport');
      if ((await readGame(frame)).pendingPickup) {
        await frame.getByRole('button', { name: 'Show answer (1)', exact: true }).click();
        await frame.getByRole('button', { name: 'Correct (1)', exact: true }).click();
        if ((await readGame(frame)).pickupResolution) await frame.getByRole('button', { name: 'Continue', exact: true }).click();
      }
      // Settings remain reachable with wheel input while their native scrollbar is hidden.
      await native('resize', [960, 600]); await settle(present);
      await frame.getByRole('button', { name: 'Reset Round', exact: true }).click();
      await frame.getByRole('heading', { name: 'Question Setup', exact: true }).waitFor();
      await frame.evaluate(() => { document.getElementById('game-viewport').scrollTop = 0; });
      await frame.getByRole('region', { name: 'Language Snake playfield and settings', exact: true }).focus();
      await present.keyboard.press('PageDown'); await present.waitForTimeout(150);
      const pageDownScrollTop = await frame.evaluate(() => document.getElementById('game-viewport').scrollTop);
      assert.ok(pageDownScrollTop > 0, 'PageDown retains native settings navigation');
      await present.keyboard.press('PageUp'); await present.waitForTimeout(150);
      const pageUpScrollTop = await frame.evaluate(() => document.getElementById('game-viewport').scrollTop);
      assert.ok(pageUpScrollTop < pageDownScrollTop, 'PageUp retains native settings navigation');
      keyboardCheck.settingsNavigation = { pageDownScrollTop, pageUpScrollTop };
      await frame.evaluate(() => { document.getElementById('game-viewport').scrollTop = 0; });
      const target = await iframe.boundingBox();
      await present.mouse.move(target.x + target.width / 2, target.y + target.height / 2); await present.mouse.wheel(0, 700);
      await frame.waitForFunction(() => document.getElementById('game-viewport').scrollTop > 0);
      const scrollTopAfterWheel = await frame.evaluate(() => document.getElementById('game-viewport').scrollTop);
      const questions = frame.getByRole('heading', { name: 'Question Setup', exact: true }); await questions.scrollIntoViewIfNeeded();
      const questionText = frame.locator('textarea').first(); await questionText.fill('Native rendering question\nAnswer: native pixels');
      assert.equal(await questionText.inputValue(), 'Native rendering question\nAnswer: native pixels');
      await questionText.press('Control+Home');
      const caretBefore = await questionText.evaluate(textarea => textarea.selectionStart);
      await questionText.press('ArrowRight');
      const caretAfter = await questionText.evaluate(textarea => textarea.selectionStart);
      assert.equal(caretBefore, 0); assert.equal(caretAfter, 1, 'Arrow keys retain native caret movement while editing game questions');
      keyboardCheck.formArrowCaret = { before: caretBefore, after: caretAfter };
      const settingsBox = await questionText.boundingBox(), gameBox = await iframe.boundingBox();
      assert.ok(settingsBox.x >= gameBox.x - 1 && settingsBox.x + settingsBox.width <= gameBox.x + gameBox.width + 1, 'Settings fit the native width');
      await present.screenshot({ path: path.join(evidence, `native-dpr${dpr}-settings.png`), animations: 'disabled' });
      profiles.push({ dpr, samples, scrollTopAfterWheel, settingsReachable: true, keyboardCheck, liveState, errors: errors.filter(error => error.dpr === dpr) });
      console.log(`PASS native rendering DPR ${dpr}: 960x600, 600x900, 1920x1080, maximized; state retained; direct Present arrows move without scrolling; form arrows/wheel/settings reachable`);
    } catch (error) {
      await fs.writeFile(path.join(evidence, 'native-smoke-failure.json'), JSON.stringify({ profiles, errors, dpr, keyboardCheck, message: String(error), stack: error.stack }, null, 2));
      if (present && !present.isClosed()) await present.screenshot({ path: path.join(evidence, `native-dpr${dpr}-failure.png`) }).catch(() => {});
      throw error;
    } finally {
      if (control && !control.isClosed()) await control.evaluate(() => window.appApi.forceClose()).catch(() => {});
      await app.close().catch(() => {});
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(evidence, 'native-smoke-results.json'), JSON.stringify({ profiles, errors, gameStateInjected: false, originalLessonsTouched: false }, null, 2));
  await Promise.all(['native-smoke-failure.json', 'native-dpr1-failure.png', 'native-dpr2-failure.png'].map(file => fs.rm(path.join(evidence, file), { force: true })));
})().catch(error => { console.error(error); process.exitCode = 1; });
