/* Real Electron acceptance for the reusable Game host.
 * Build renderer and main first. Native folder picking is substituted; one deliberate
 * HTML request abort verifies load failure/recovery. Gameplay and IPC remain real.
 * STORY_STUDIO_PLAYWRIGHT may point at a Playwright package directory.
 * Evidence is isolated in docs/game-host-evidence; no existing lessons are opened.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

function playwright() {
  if (process.env.STORY_STUDIO_PLAYWRIGHT) return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try { return require('playwright'); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'));
  }
}
const { _electron } = playwright();
const commands = require('../dist/main/shared/lesson/commands');
const directions = [
  { name: 'up', x: 0, y: -1 }, { name: 'right', x: 1, y: 0 },
  { name: 'down', x: 0, y: 1 }, { name: 'left', x: -1, y: 0 },
];
const keyFor = (playerIndex, direction) => [
  { up: 'w', right: 'd', down: 's', left: 'a' },
  { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' },
][playerIndex][direction];
const cellKey = cell => `${cell.x},${cell.y}`;

// Read the original rendered crystals and observer. All gameplay uses mouse/key input.
async function readGame(frame) {
  return frame.evaluate(() => JSON.parse(window.render_game_to_text()));
}
async function readCrystals(frame, board) {
  return frame.evaluate(board => [...document.querySelectorAll('div[style]')]
    .filter(element => element.style.zIndex === '2' && element.style.left.endsWith('%')
      && element.querySelector('svg.lucide-sparkles, svg.lucide-flame'))
    .map(element => ({ x: Math.round(parseFloat(element.style.left) * board.width / 100),
      y: Math.round(parseFloat(element.style.top) * board.height / 100),
      normal: /250,204,21/.test((element.children[1]?.style.boxShadow ?? '').replace(/\s/g, '')) })), board);
}
function routeToNormalCrystal(state, crystals) {
  const player = state.players.find(player => player.id === state.activeTurn);
  const blocked = new Set(state.players.flatMap(player => player.snake.map(cellKey)));
  for (const crystal of crystals.filter(crystal => !crystal.normal)) blocked.add(cellKey(crystal));
  const targets = new Set(crystals.filter(crystal => crystal.normal).map(cellKey));
  const head = player.snake[0], queue = [{ ...head, first: null }], seen = new Set([cellKey(head)]);
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (targets.has(cellKey(cell))) return cell.first;
    for (const direction of directions) {
      const next = { x: cell.x + direction.x, y: cell.y + direction.y, first: cell.first ?? direction };
      const key = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= state.board.width || next.y >= state.board.height || blocked.has(key) || seen.has(key)) continue;
      seen.add(key); queue.push(next);
    }
  }
  throw new Error('No genuine route to a normal crystal was available.');
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'story-game-host-'));
  const folder = path.join(temporary, 'Disposable lesson');
  const evidence = path.join(root, 'docs', 'game-host-evidence');
  await Promise.all([fs.mkdir(path.join(folder, 'assets'), { recursive: true }), fs.mkdir(evidence, { recursive: true })]);
  let fixture = commands.createLesson('Game host acceptance lesson');
  const firstScene = commands.createScene('First teaching scene');
  const secondScene = commands.createScene('Second editing scene');
  fixture = commands.insertScene(fixture, 'story', firstScene).project;
  fixture = commands.insertScene(fixture, 'story', secondScene).project;
  fixture = commands.insertScene(fixture, 'activation', commands.createScene('Activation stays available')).project;
  const fixtureJson = JSON.stringify(fixture, null, 2);
  await fs.writeFile(path.join(folder, 'project.json'), fixtureJson);

  const app = await _electron.launch({ executablePath: require('electron'), cwd: root,
    args: [root, `--user-data-dir=${path.join(temporary, 'profile')}`] });
  const passed = [], errors = [], visualAudits = [], gameStates = [], audioEvents = [], lifecycle = [], presentLayouts = [], cameraDrags = [];
  const observedWindows = new WeakSet(), audioWindows = new WeakSet();
  let page, present;
  const pass = name => { passed.push(name); console.log(`PASS ${name}`); };
  const observe = (window, name) => {
    if (observedWindows.has(window)) return;
    observedWindows.add(window);
    window.setDefaultTimeout(12000);
    window.on('pageerror', error => errors.push({ window: name, message: String(error) }));
  };
  const observeAudio = async window => {
    if (audioWindows.has(window)) return;
    audioWindows.add(window);
    const cdp = await app.context().newCDPSession(window);
    for (const event of ['contextCreated', 'contextChanged', 'contextWillBeDestroyed', 'audioNodeCreated'])
      cdp.on(`WebAudio.${event}`, detail => audioEvents.push({ event, ...detail }));
    await cdp.send('WebAudio.enable');
  };
  try {
    page = await app.firstWindow(); observe(page, 'Control');
    page.on('dialog', dialog => dialog.accept());
    await page.evaluate(() => {
      window.__gameSmokeEndedEvents = [];
      window.appApi.onGameEnded(event => window.__gameSmokeEndedEvents.push(event));
    });
    const button = name => page.getByRole('button', { name, exact: true });
    const chooseFolder = directory => app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
    }, directory);
    const resize = (window, width, height) => app.evaluate(({ BrowserWindow }, { url, width, height }) => {
      const native = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url);
      if (!native) throw new Error(`No native window for ${url}`);
      native.setMinimumSize(320, 400); native.setSize(width, height);
    }, { url: window.url(), width, height });
    const settle = window => window.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const screenshot = async (window, name) => { await settle(window); await window.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' }); };
    const singleton = async () => {
      assert.equal(app.windows().filter(window => !window.isClosed()).length, 2, 'Exactly Control and one Present window');
      assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 2, 'Native Present is a singleton');
      assert.equal(await page.locator('iframe').count(), 0, 'Control never mounts any game iframe');
      assert.equal(await page.evaluate(() => typeof window.render_game_to_text), 'undefined', 'Control never runs the game');
      assert.equal(await present.locator('iframe').count(), 1, 'Present owns the sole runtime');
    };
    const snapshotTarget = async () => (await present.evaluate(() => window.presentApi.requestSnapshot())).snapshot.target;
    const getFrame = async () => {
      const iframe = present.locator('iframe[title="Language Snake"]');
      await iframe.waitFor();
      const handle = await iframe.elementHandle(), frame = await handle.contentFrame();
      assert.ok(frame, 'The original game has its own frame');
      await frame.waitForFunction(() => typeof window.render_game_to_text === 'function');
      assert.match(await iframe.getAttribute('src'), /language-snake\.html(?:[?#]|$)/);
      const target = await snapshotTarget();
      assert.equal(target.kind, 'game'); assert.equal(target.gameId, 'language-snake');
      assert.equal(await iframe.getAttribute('data-game-instance'), target.instanceId);
      assert.equal(await page.locator('[data-game-host]').getAttribute('data-game-instance'), target.instanceId);
      return { frame, instanceId: target.instanceId };
    };
    const launch = async () => {
      await button('Launch Language Snake').click();
      present = app.windows().find(window => window !== page && !window.isClosed()) || await app.waitForEvent('window');
      observe(present, 'Present');
      await observeAudio(present);
      await button('Focus Present').waitFor();
      const run = await getFrame(); await singleton();
      assert.equal((await readGame(run.frame)).splashVisible, true, 'A new host session starts at the original splash');
      return run;
    };
    const startRound = async frame => {
      await frame.locator('#splash-continue').click();
      await frame.getByLabel('Enable crown challenges', { exact: true }).uncheck();
      await frame.locator('#start-game').click();
      await frame.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'collection');
      const state = await readGame(frame);
      assert.equal(state.mode, 'versus'); assert.equal(state.players.length, 2); assert.equal(state.crystalsRemaining, 36);
      assert.deepEqual(state.players.map(player => player.score), [0, 0]);
      return state;
    };
    const move = async (frame, state, direction, input = 'control') => {
      const index = state.players.findIndex(player => player.id === state.activeTurn), player = state.players[index];
      const expected = { x: player.snake[0].x + direction.x, y: player.snake[0].y + direction.y };
      if (input === 'mouse') {
        const card = frame.getByRole('heading', { name: player.name, exact: true }).first().locator('..').locator('..');
        await card.getByRole('button', { name: direction.name.toUpperCase(), exact: true }).click();
      } else {
        await page.getByRole('group', { name: 'Game keyboard controls', exact: true }).click();
        await page.keyboard.press(keyFor(index, direction.name));
      }
      await frame.waitForFunction(({ id, expected }) => {
        const player = JSON.parse(window.render_game_to_text()).players.find(player => player.id === id);
        return player.snake[0].x === expected.x && player.snake[0].y === expected.y;
      }, { id: player.id, expected });
      const next = await readGame(frame);
      assert.ok(next.pendingPickup || next.activeTurn !== state.activeTurn, 'A real move advances the original turn or opens a pickup');
      return next;
    };
    const audit = async (name, window, selector) => {
      const result = await window.evaluate(selector => {
        const scope = document.querySelector(selector);
        if (!scope) throw new Error(`Missing layout scope ${selector}`);
        const nodes = [...scope.querySelectorAll('button, h1, h2, [role="group"]')].filter(node => {
          const rect = node.getBoundingClientRect(); return rect.width && rect.height && getComputedStyle(node).visibility !== 'hidden';
        });
        const boxes = nodes.map(node => ({ name: node.textContent.trim().slice(0, 70), tag: node.tagName, ...Object.fromEntries(['left', 'right', 'top', 'bottom'].map(key => [key, node.getBoundingClientRect()[key]])) }));
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          if (nodes[i].contains(nodes[j]) || nodes[j].contains(nodes[i])) continue;
          const a = boxes[i], b = boxes[j];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([a.name, b.name]);
        }
        return { viewport: { width: innerWidth, height: innerHeight }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          clippedControls: boxes.filter(box => box.left < -1 || box.right > innerWidth + 1).map(box => box.name), overlaps };
      }, selector);
      visualAudits.push({ name, ...result });
      assert.equal(result.horizontalOverflow, false, `${name}: no horizontal overflow`);
      assert.deepEqual(result.clippedControls, [], `${name}: controls fit the window`);
      assert.deepEqual(result.overlaps, [], `${name}: controls and headings do not overlap`);
    };
    const presentLayout = async (frame, width, height) => {
      const beforeState = await readGame(frame);
      const beforeInstance = await present.locator('iframe[title="Language Snake"]').getAttribute('data-game-instance');
      await resize(present, width, height); await settle(present);
      await frame.evaluate(() => { document.getElementById('game-viewport').scrollTop = 0; });
      await settle(present);
      const logical = await frame.evaluate(() => {
        const viewport = document.getElementById('game-viewport');
        const board = [...document.querySelectorAll('div[style]')].find(element => element.style.aspectRatio && element.style.borderRadius === '28px');
        const box = board.getBoundingClientRect(), stage = viewport.getBoundingClientRect();
        const scrollbar = getComputedStyle(viewport, '::-webkit-scrollbar');
        return { innerWidth, innerHeight, dpr: devicePixelRatio, transform: getComputedStyle(viewport).transform, scrollTop: viewport.scrollTop,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 || viewport.scrollWidth > viewport.clientWidth + 1,
          scrollbar: { width: getComputedStyle(viewport).scrollbarWidth, webkitDisplay: scrollbar.display, webkitWidth: scrollbar.width, allocatedWidth: viewport.offsetWidth - viewport.clientWidth },
          columns: getComputedStyle(document.querySelector('.top-layout')).gridTemplateColumns.split(' ').filter(Boolean).length,
          board: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
          logicalViewport: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom } };
      });
      const outer = await present.locator('iframe[title="Language Snake"]').evaluate(iframe => {
        const box = iframe.getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, transform: getComputedStyle(iframe).transform, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
          layoutWidth: iframe.offsetWidth, layoutHeight: iframe.offsetHeight,
          frame: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } };
      });
      assert.equal(frame.isDetached(), false, 'Resizing retains the original game browsing context');
      assert.equal(await present.locator('iframe[title="Language Snake"]').getAttribute('data-game-instance'), beforeInstance, 'Resizing retains the game instance');
      assert.deepEqual(await readGame(frame), beforeState, 'Resizing never resets live gameplay state');
      presentLayouts.push({ nativeSize: { width, height }, logical, outer, retainedInstanceId: beforeInstance, gameStatePreserved: true });
      await screenshot(present, `language-snake-present-native-${width}x${height}`);
    };
    const cameraDrag = async frame => {
      const board = frame.locator('div[style*="aspect-ratio"][style*="border-radius: 28px"]');
      const pan = () => board.evaluate(element => {
        const match = element.style.transform.match(/translate\(([-.\d]+)px,\s*([-.\d]+)px\)/);
        if (!match) throw new Error(`Missing original 3D camera transform: ${element.style.transform}`);
        return { x: Number(match[1]), y: Number(match[2]) };
      });
      const before = await pan(), box = await board.boundingBox();
      const scale = await present.locator('iframe[title="Language Snake"]').evaluate(iframe => iframe.getBoundingClientRect().width / iframe.offsetWidth);
      const physicalDelta = 30, start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await present.mouse.move(start.x, start.y); await present.mouse.down();
      await present.mouse.move(start.x + physicalDelta, start.y, { steps: 6 }); await present.mouse.up();
      const after = await pan(), expectedDelta = physicalDelta / scale;
      assert.ok(Math.abs(after.x - before.x - expectedDelta) < 2, 'Original camera drag follows native pointer coordinates');
      assert.ok(Math.abs(after.y - before.y) < 2, 'A horizontal physical drag preserves vertical camera pan');
      cameraDrags.push({ scale, physicalDelta, expectedLogicalDelta: expectedDelta, before, after });
      await frame.locator('summary').filter({ hasText: '3D Camera' }).click();
      await frame.getByRole('button', { name: 'Reset camera', exact: true }).click();
      assert.deepEqual(await pan(), { x: 0, y: 0 }, 'The original camera reset works after a native drag');
    };

    await button('Challenge').waitFor(); await resize(page, 1440, 1000);
    await button('Challenge').click(); await button('Launch Language Snake').waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    await screenshot(page, 'game-selection-desktop'); await audit('Game selection desktop', page, '[data-game-host]');
    await button('Mastery').click();
    await button('Launch Final Boss Hero').waitFor();
    assert.equal(await button('Launch Language Snake').count(), 0, 'Mastery filters the shared game library');
    assert.equal(app.windows().filter(window => !window.isClosed()).length, 1, 'Selecting Mastery does not auto-launch a Present runtime');
    await screenshot(page, 'mastery-selection-desktop');
    await button('Challenge').click();
    pass('Beginning Challenge and Mastery use the reusable library without starting a runtime');

    let run = await launch(); await resize(present, 1440, 1000);
    const initial = await startRound(run.frame);
    let state = initial, moves = 0, controlMoves = 0, scored = false;
    while (!scored && moves < 100) {
      const crystals = await readCrystals(run.frame, state.board);
      assert.equal(crystals.length, state.crystalsRemaining, 'Observer and original visible crystal board agree');
      const previous = state, direction = routeToNormalCrystal(state, crystals);
      state = await move(run.frame, state, direction, moves === 0 ? 'mouse' : 'control'); moves++;
      if (moves > 1) controlMoves++;
      if (state.pendingPickup) {
        assert.equal(state.pendingPickup.foodType, 'normal');
        const id = state.pendingPickup.playerId, before = previous.players.find(player => player.id === id);
        assert.equal(state.players.find(player => player.id === id).snake.length, before.snake.length + 1, 'Eating a crystal grows the original snake');
        assert.equal(state.pendingPickup.answerRevealed, false);
        await page.getByRole('group', { name: 'Game keyboard controls', exact: true }).click();
        await page.keyboard.press('1');
        await run.frame.waitForFunction(() => JSON.parse(window.render_game_to_text()).pendingPickup?.answerRevealed);
        await run.frame.getByRole('button', { name: 'Correct (1)', exact: true }).click();
        await run.frame.waitForFunction(id => {
          const state = JSON.parse(window.render_game_to_text()); return !state.pendingPickup && state.players.find(player => player.id === id).score > 0;
        }, id);
        state = await readGame(run.frame);
        assert.equal(state.players.find(player => player.id === id).score, before.score + 1);
        assert.equal(state.players.find(player => player.id === id).snake.length, before.snake.length + 1);
        assert.notEqual(state.activeTurn, id, 'Scoring hands the turn to the next player'); scored = true;
      }
    }
    assert.ok(scored, 'The real original game must collect, reveal, score and advance turns');
    if (!controlMoves) {
      // A randomly adjacent crystal can finish scoring on the first mouse move.
      // Still require one direction key to move the other player's real snake.
      const player = state.players.find(player => player.id === state.activeTurn);
      const occupied = new Set([...state.players.flatMap(player => player.snake), ...await readCrystals(run.frame, state.board)].map(cellKey));
      const direction = directions.find(direction => {
        const cell = { x: player.snake[0].x + direction.x, y: player.snake[0].y + direction.y };
        return cell.x >= 0 && cell.y >= 0 && cell.x < state.board.width && cell.y < state.board.height && !occupied.has(cellKey(cell));
      });
      assert.ok(direction, 'The next player has an ordinary move for keyboard acceptance');
      state = await move(run.frame, state, direction); moves++; controlMoves++;
    }
    await page.waitForTimeout(150);
    assert.ok(audioEvents.some(event => event.context?.contextState === 'running'), 'The real click starts a running native WebAudio context');
    assert.ok(audioEvents.some(event => /^(Oscillator|OscillatorNode)$/.test(event.node?.nodeType)), 'Original synthesized sound creates native audio nodes');
    gameStates.push({ name: 'Original mechanics after genuine input', moves, controlMoves, initial, final: state });
    await button('Focus Present').click(); await button('Focus Present').click();
    await page.evaluate(async () => { await window.appApi.openPresent(); await window.appApi.openPresent(); });
    await singleton();
    await presentLayout(run.frame, 960, 600); await presentLayout(run.frame, 600, 900); await presentLayout(run.frame, 1920, 1080);
    for (const layout of presentLayouts) {
      assert.equal(layout.logical.innerWidth, layout.outer.width, 'The game renders at the full native Present width');
      assert.equal(layout.logical.innerHeight, layout.outer.height, 'The game renders at the full native Present height');
      assert.equal(layout.logical.dpr, layout.outer.dpr, 'The game retains native Present device-pixel density');
      assert.equal(layout.outer.transform, 'none', 'Present does not stretch a smaller iframe raster');
      assert.equal(layout.logical.transform, 'none', 'The inner adapter uses native rendering without a scaling transform');
      assert.equal(layout.logical.scrollTop, 0);
      assert.equal(layout.outer.horizontalOverflow, false, 'Present has no horizontal overflow');
      assert.equal(layout.logical.horizontalOverflow, false, 'The game has no horizontal overflow');
      assert.ok(layout.logical.scrollbar.width === 'none' || layout.logical.scrollbar.webkitDisplay === 'none' || layout.logical.scrollbar.webkitWidth === '0px', 'The game vertical scrollbar is explicitly hidden');
      assert.equal(layout.logical.scrollbar.allocatedWidth, 0, 'A hidden scrollbar consumes no render width');
      assert.ok(Math.abs(layout.outer.frame.left) < 1 && Math.abs(layout.outer.frame.top) < 1
        && Math.abs(layout.outer.frame.width - layout.outer.width) < 1 && Math.abs(layout.outer.frame.height - layout.outer.height) < 1, 'The runtime covers Present without letterbox gaps');
      assert.ok(Math.abs(layout.logical.logicalViewport.left) < 1 && Math.abs(layout.logical.logicalViewport.top) < 1
        && Math.abs(layout.logical.logicalViewport.right - layout.outer.width) < 1 && Math.abs(layout.logical.logicalViewport.bottom - layout.outer.height) < 1, 'The inner viewport covers the entire native game frame');
      assert.ok(layout.logical.board.left >= -1 && layout.logical.board.right <= layout.outer.width + 1, 'The playfield fits the native render width');
      assert.ok(layout.logical.board.top >= -1 && layout.logical.board.bottom <= layout.outer.height + 1, 'The default 3D playfield fits the native render height');
    }
    await cameraDrag(run.frame);
    await resize(present, 1440, 1000);
    await run.frame.evaluate(() => { document.getElementById('game-viewport').scrollTop = 0; });
    await screenshot(present, 'language-snake-present-desktop');
    pass('Original mouse movement, Control keyboard forwarding, alternating turns, crystal growth, answer reveal and scoring; native WebAudio runs; singleton Present fills windowed, portrait and large sizes at native resolution without visible scrollbars or resize resets');

    const oldRun = run;
    await button('Restart game').click();
    await present.waitForFunction(oldId => document.querySelector('iframe[title="Language Snake"]')?.getAttribute('data-game-instance') !== oldId, oldRun.instanceId);
    run = await getFrame(); assert.notEqual(run.instanceId, oldRun.instanceId); assert.equal(oldRun.frame.isDetached(), true, 'Restart destroys the prior iframe and its runtime');
    await assert.rejects(() => oldRun.frame.evaluate(() => window.render_game_to_text()), /detached|destroyed|closed/i);
    await startRound(run.frame);
    const beforeStale = await readGame(run.frame);
    await page.evaluate(instanceId => {
      window.appApi.sendGameInput({ instanceId, key: 'd', code: 'KeyD', phase: 'keydown', repeat: false });
      window.appApi.sendGameInput({ instanceId, key: 'd', code: 'KeyD', phase: 'keyup', repeat: false });
    }, oldRun.instanceId);
    await page.waitForTimeout(200);
    assert.deepEqual((await readGame(run.frame)).players, beforeStale.players, 'Stale instance input cannot reach the replacement runtime');
    await singleton();
    await button('Return to game selection').click(); await button('Launch Language Snake').waitFor();
    await present.locator('iframe').waitFor({ state: 'detached' }); assert.equal(run.frame.isDetached(), true);
    await button('Back to Beginning').click(); await button('Adventure').waitFor();
    pass('Restart creates a fresh instance and disposes the old runtime; stale input is ignored; exit returns to selection and Beginning');

    await button('Adventure').click(); await chooseFolder(folder); await button('Open project').click();
    await page.getByText('Lesson opened.', { exact: true }).waitFor(); await button('Edit').click();
    await page.locator(`[data-entry-id="${fixture.sequences.story[1].id}"]`).click();
    await button('Add Card').click();
    await page.getByLabel('Card name', { exact: true }).fill('Unsaved card retained across game');
    const dirtyText = 'The dragon stays in the forest.';
    await page.getByLabel('Card text', { exact: true }).fill(dirtyText);
    await button('Show in Present').click(); await button('Open Present').click(); await button('Teach').click(); await button('Previous scene').click();
    await present.waitForFunction(id => document.querySelector('[data-scene-surface="present"]')?.getAttribute('data-scene-id') === id, firstScene.id);
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), firstScene.id);
    assert.match(await page.locator('.lesson-project-title').innerText(), /Unsaved/);
    await button('Challenge').click(); run = await launch(); await startRound(run.frame);
    await screenshot(page, 'game-control-desktop'); await audit('Game Control desktop', page, '[data-game-host]');
    await resize(page, 390, 844); await screenshot(page, 'game-control-narrow'); await audit('Game Control narrow', page, '[data-game-host]');
    await resize(page, 1440, 1000);
    // Arrow keys would navigate the hidden teaching cursor if the lesson handler were still active.
    await page.getByRole('group', { name: 'Game keyboard controls', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    await button('Return to lesson').click();
    await present.locator('iframe').waitFor({ state: 'detached' }); assert.equal(run.frame.isDetached(), true);
    assert.equal(await button('Teach').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), firstScene.id, 'Game keys do not navigate the teaching cursor');
    await present.waitForFunction(id => document.querySelector('[data-scene-surface="present"]')?.getAttribute('data-scene-id') === id, firstScene.id);
    await button('Edit').click();
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), secondScene.id, 'The independent editing cursor is retained');
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.equal(await page.getByLabel('Card name', { exact: true }).inputValue(), 'Unsaved card retained across game');
    assert.match(await page.locator('.lesson-project-title').innerText(), /Unsaved/);
    assert.equal(await button('Save').isEnabled(), true);
    await screenshot(page, 'lesson-restored-edit');
    pass('Return restores Teach and Edit cursors, selected card, dirty edits and lesson projection; game arrows cannot navigate the lesson; desktop/narrow controls fit without overlap');

    await button('Challenge').click(); run = await launch();
    const closedInstance = run.instanceId, closingUrl = present.url();
    await app.evaluate(({ BrowserWindow }, url) => {
      const native = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url); native.close();
    }, closingUrl);
    await page.waitForFunction(() => !![...document.querySelectorAll('button')].find(button => button.textContent === 'Launch Language Snake'));
    assert.equal(app.windows().filter(window => !window.isClosed()).length, 1);
    await screenshot(page, 'game-selection-after-present-close');
    run = await launch(); assert.notEqual(run.instanceId, closedInstance, 'Reopening after close starts a new instance');
    assert.equal((await readGame(run.frame)).splashVisible, true);
    await singleton(); await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(await button('Edit').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), secondScene.id);
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    await button('Mastery').click(); await button('Launch Final Boss Hero').waitFor();
    assert.equal(await present.locator('iframe').count(), 0, 'Selecting Mastery leaves Present on the lesson');
    assert.equal(await button('Launch Language Snake').count(), 0); await button('Return to lesson').click();
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), fixtureJson, 'Unsaved game navigation never writes the lesson');
    pass('Closing Present ends the run, reopening gets a fresh singleton runtime, and the dirty lesson survives close/reopen and Mastery navigation');

    await button('Challenge').click(); run = await launch();
    const reloadedInstance = run.instanceId, reloadingUrl = present.url();
    await Promise.all([
      present.waitForEvent('load'),
      app.evaluate(({ BrowserWindow }, url) => {
        BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url).webContents.reloadIgnoringCache();
      }, reloadingUrl),
    ]);
    await button('Launch Language Snake').waitFor();
    await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(run.frame.isDetached(), true, 'Present reload destroys the game frame');
    assert.equal(app.windows().filter(window => !window.isClosed()).length, 2, 'Present reload retains the native singleton');
    assert.ok((await page.evaluate(() => window.__gameSmokeEndedEvents)).some(event => event.instanceId === reloadedInstance && event.reason === 'reload'));
    run = await launch(); assert.notEqual(run.instanceId, reloadedInstance);
    await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    lifecycle.push({ operation: 'reload', instanceId: reloadedInstance, freshInstanceId: run.instanceId });
    pass('Native Present reload ends the game, removes the runtime, and allows a fresh run while preserving dirty lesson state');

    await button('Challenge').click(); run = await launch();
    const nativeProcesses = await app.evaluate(({ BrowserWindow }, { controlUrl, presentUrl }) => {
      const windows = BrowserWindow.getAllWindows();
      return { control: windows.find(window => window.webContents.getURL() === controlUrl).webContents.getOSProcessId(),
        present: windows.find(window => window.webContents.getURL() === presentUrl).webContents.getOSProcessId() };
    }, { controlUrl: page.url(), presentUrl: present.url() });
    if (nativeProcesses.control === nativeProcesses.present) throw new Error('Present and Control unexpectedly share a renderer process; crash isolation cannot be accepted safely.');
    const crashedInstance = run.instanceId;
    await app.evaluate(({ BrowserWindow }, url) => {
      BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url).webContents.forcefullyCrashRenderer();
    }, present.url());
    await button('Launch Language Snake').waitFor();
    await page.waitForFunction(id => window.__gameSmokeEndedEvents.some(event => event.instanceId === id && event.reason === 'crashed'), crashedInstance);
    assert.equal(page.isClosed(), false, 'Crashing Present leaves Control alive');
    assert.equal(app.windows().filter(window => !window.isClosed()).length, 1, 'Crashed Present is disposed');
    run = await launch(); assert.notEqual(run.instanceId, crashedInstance); await singleton();
    await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.equal(await page.locator('.lesson-canvas [data-scene-surface]').getAttribute('data-scene-id'), secondScene.id);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), fixtureJson);
    lifecycle.push({ operation: 'crash', instanceId: crashedInstance, freshInstanceId: run.instanceId, separateProcesses: true });
    pass('Deliberate native Present renderer crash leaves Control and dirty lesson alive; crashed runtime is disposed and reopening starts a fresh singleton');

    await button('Challenge').click();
    const loadRoute = /\/language-snake\.html(?:\?|$)/;
    let abortedLoads = 0;
    const failOneHtml = async route => { if (abortedLoads++ === 0) await route.abort('failed'); else await route.continue(); };
    await app.context().route(loadRoute, failOneHtml);
    await button('Launch Language Snake').click();
    const failedInstance = await page.locator('[data-game-host]').getAttribute('data-game-instance');
    await present.getByRole('alert').waitFor({ timeout: 28000 });
    assert.equal(abortedLoads, 1, 'The injected load failure aborts exactly one original game HTML request');
    assert.equal(await present.locator('iframe').count(), 0, 'An errored load unmounts the runtime');
    await page.waitForFunction(() => document.querySelector('.game-session-heading [role="status"]')?.textContent.includes('Restart'));
    await screenshot(page, 'game-load-error-control'); await screenshot(present, 'game-load-error-present');
    await app.context().unroute(loadRoute, failOneHtml);
    await button('Restart game').click(); run = await getFrame();
    assert.notEqual(run.instanceId, failedInstance); assert.equal((await readGame(run.frame)).splashVisible, true);
    await singleton();
    await button('Return to lesson').click(); await present.locator('iframe').waitFor({ state: 'detached' });
    assert.equal(await page.getByLabel('Card text', { exact: true }).inputValue(), dirtyText);
    assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), fixtureJson);
    lifecycle.push({ operation: 'load failure', instanceId: failedInstance, freshInstanceId: run.instanceId, abortedHtmlRequests: abortedLoads });
    pass('A deliberately failed game HTML load reports a recoverable error, removes its iframe, and Restart restores a fresh original game without losing the lesson');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(evidence, 'smoke-results.json'), JSON.stringify({ passed, errors, visualAudits, gameStates, audioEvents, lifecycle, presentLayouts, cameraDrags,
      gameEndedEvents: await page.evaluate(() => window.__gameSmokeEndedEvents), sampleProject: folder, originalLessonsTouched: false,
      gameRuntimeMutations: false, audioObservation: 'Read-only Chromium WebAudio protocol; physical audibility requires a manual listening check.' }, null, 2));
    await Promise.all(['smoke-failure.json', 'failure-control.png', 'failure-present.png'].map(file => fs.rm(path.join(evidence, file), { force: true })));
    console.log(`Disposable proof: ${folder}`);
  } catch (error) {
    await fs.writeFile(path.join(evidence, 'smoke-failure.json'), JSON.stringify({ passed, errors, visualAudits, gameStates, audioEvents, lifecycle, presentLayouts, cameraDrags, message: String(error), stack: error.stack }, null, 2));
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, 'failure-control.png') }).catch(() => {});
    if (present && !present.isClosed()) await present.screenshot({ path: path.join(evidence, 'failure-present.png') }).catch(() => {});
    throw error;
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => window.appApi.forceClose()).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
