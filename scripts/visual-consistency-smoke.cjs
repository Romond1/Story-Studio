/* Visual QA for the shared teacher theme. All authored content is disposable. */
const { _electron } = require(process.env.STORY_STUDIO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const c = require('../dist-test/shared/lesson/commands');
const sections = require('../dist-test/shared/lesson/sections');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = await fs.mkdtemp(path.join(os.tmpdir(), 'story-theme-'));
  const folder = path.join(temp, 'Lesson'), evidence = path.join(root, 'docs', 'visual-consistency-evidence');
  await fs.mkdir(path.join(folder, 'assets'), { recursive: true }); await fs.mkdir(evidence, { recursive: true });
  let project = c.createLesson('Beyond the enchanted forest');
  for (const [id, filename] of [['forest', 'Intro screen BG image.png'], ['story', 'Story.png'], ['activation', 'Activation.png'], ['mastery', 'Mastery.png']]) {
    await fs.copyFile(path.join(root, 'assets', 'Splash Screen', filename), path.join(folder, 'assets', filename));
    project.assets.push({ id, filename, originalName: filename, relativePath: `assets/${filename}`, mediaType: 'image', sizeBytes: 1000, importedAt: new Date().toISOString() });
  }
  const chapter = sections.addSection(project, 'story', 'The discovery'); project = chapter.project;
  const opening = c.insertScene(project, 'story', c.createScene('A door to another world', 'forest')); project = sections.moveEntryToSection(opening.project, 'story', opening.entryId, chapter.sectionId);
  const sceneId = project.sequences.story[0].sceneId;
  const card = c.addCard(project, sceneId); project = card.project;
  project.cards[project.scenes[sceneId].objects[0].cardId].faces[0].text = 'What might be waiting beyond the portal?';
  project.cards[project.scenes[sceneId].objects[0].cardId].faces[1].text = 'A new adventure begins with a question.';
  project = c.insertScene(project, 'story', c.createScene('Follow the clues')).project;
  project = c.insertScene(project, 'activation', c.createScene('Share your discovery')).project;
  await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(project));
  const app = await _electron.launch({ executablePath: require('electron'), cwd: root, args: [root, `--user-data-dir=${path.join(temp, 'profile')}`] });
  let page; const errors = [], results = [];
  const pass = name => { results.push(name); console.log('PASS', name); };
  try {
    page = await app.firstWindow(); const controlWindow = await app.browserWindow(page); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(String(e))); page.on('dialog', d => d.accept());
    const button = name => page.getByRole('button', { name, exact: true });
    const resize = async (width, height) => { await controlWindow.evaluate((w, size) => { w.setMinimumSize(320,400); w.setSize(...size); }, [width,height]); await page.waitForFunction(width => Math.abs(innerWidth - width) < 40, width); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
    const shot = async name => { await page.screenshot({ path: path.join(evidence, `${name}.png`) }); };
    await resize(1500, 1000); await button('Adventure').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.beginning img')].every(i => i.complete && i.naturalWidth));
    const bg = await page.locator('.beginning').evaluate(el => getComputedStyle(el).backgroundImage); assert.match(bg, /Intro.*screen.*BG/);
    await shot('beginning-desktop');
    await button('Adventure').hover(); await shot('beginning-hover');
    await page.keyboard.press('Tab');
    assert.ok(await page.locator(':focus-visible').count());
    await shot('beginning-keyboard');
    await button('Challenge').click(); await shot('game'); await button('Back to Beginning').click();
    await button('Mastery').click(); await shot('mastery'); await button('Back to Beginning').click();
    await resize(390,844); await shot('beginning-mobile');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await resize(1500,1000); pass('Atmospheric launcher, placeholders, hover, keyboard focus and mobile fit');
    await button('Adventure').click();
    await app.evaluate(({dialog}, folder) => { dialog.showOpenDialog = async()=>({canceled:false,filePaths:[folder]}); }, folder);
    await button('Open project').click(); await page.getByText('Lesson opened.', {exact:true}).waitFor();
    await page.locator('.lesson-object-hit').first().click();
    await page.getByRole('listbox', {name:'Project media'}).getByRole('option', {name:/Story.png/}).click();
    await shot('editor-desktop'); await button('Scene properties').click(); await shot('scene-inspector');
    const contrast = await page.evaluate(() => {
      const root = getComputedStyle(document.querySelector('.lesson-app'));
      const hex = name => root.getPropertyValue(name).trim();
      const lum = value => { const rgb = value.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; };
      const ratio = (a,b) => { const x=lum(hex(a)),y=lum(hex(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
      return {
        bodyText: ratio('--studio-text','--studio-surface'),
        mutedText: ratio('--studio-muted','--studio-raised'),
        selectedText: ratio('--studio-text','--studio-selected'),
        cyanLabel: ratio('--studio-cyan','--studio-surface'),
        violetLabel: ratio('--studio-violet','--studio-surface'),
        presentText: ratio('--studio-ink','--studio-cyan'),
      };
    });
    for (const [name,value] of Object.entries(contrast)) assert.ok(value >= 4.5, `${name}: ${value}`);
    await button('Add Card').hover(); await shot('editor-hover');
    await button('Add Card').focus(); await page.keyboard.press('Tab');
    const focus = await page.locator(':focus-visible').first().evaluate(el => ({ outline: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth }));
    assert.equal(focus.outline, 'solid'); assert.equal(focus.width, '2px');
    await shot('editor-keyboard');
    const selected = await page.locator('.lesson-pool-asset.is-selected').evaluate(el => getComputedStyle(el).borderColor);
    assert.equal(selected, 'rgb(117, 228, 245)');
    const disabled = await button('Redo').evaluate(el => ({disabled:el.disabled, shadow:getComputedStyle(el).boxShadow}));
    assert.equal(disabled.disabled, true); assert.equal(disabled.shadow, 'none');
    await app.evaluate(({dialog}) => { dialog.showOpenDialog = () => new Promise(resolve => { globalThis.cancelThemePicker = () => resolve({canceled:true,filePaths:[]}); }); });
    await button('Import files').click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].find(b=>b.textContent==='Open Present')?.disabled);
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Open Present');
      return button && getComputedStyle(button).boxShadow === 'none';
    });
    const disabledPresent = await button('Open Present').evaluate(el=>({color:getComputedStyle(el).color,shadow:getComputedStyle(el).boxShadow}));
    assert.equal(disabledPresent.color, 'rgb(167, 184, 208)'); assert.equal(disabledPresent.shadow, 'none');
    await shot('editor-busy');
    await app.evaluate(() => { globalThis.cancelThemePicker(); delete globalThis.cancelThemePicker; });
    await button('Import files').waitFor();
    pass('Editor token contrast, selected media, creative hover, focus ring and quiet disabled states');
    await page.getByLabel('Edit canvas',{exact:true}).click({button:'right',position:{x:15,y:15}});
    await page.getByRole('menuitem',{name:'Add Image',exact:true}).click(); await shot('image-dialog'); await button('Cancel').click();
    await button('Audio settings').click(); await page.getByRole('dialog').waitFor(); await shot('settings'); await page.keyboard.press('Escape');
    await button('Teach').click(); await shot('teach');
    await button('Discovery').click(); await shot('activation');
    await button('Adventure').click(); await button('Open Present').click();
    const present = app.windows().find(p=>p!==page) || await app.waitForEvent('window');
    await present.locator('[data-scene-kind="card"]').waitFor();
    assert.equal(await present.getByRole('button').count(),0);
    await present.screenshot({path:path.join(evidence,'present.png')});
    pass('Image dialog, audio settings, Teach, Discovery and passive student Present remain usable');
    await button('Edit').click(); await resize(700,1000); await shot('editor-narrow');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await fs.writeFile(path.join(evidence,'results.json'),JSON.stringify({results,errors,contrast,focus,selected,disabled},null,2));
    assert.deepEqual(errors,[]);
  } catch (e) { if(page) await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});throw e; }
  finally { await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

