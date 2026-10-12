/* Native Chromium regression for focus-induced hidden scrolling. Run separately:
 * node games/final-boss-hero/hiddenScroll.smoke.cjs
 * STORY_STUDIO_PLAYWRIGHT may point to an installed Playwright package directory.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
function playwright() {
  if (process.env.STORY_STUDIO_PLAYWRIGHT) return require(process.env.STORY_STUDIO_PLAYWRIGHT);
  try { return require('playwright'); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'));
  }
}
(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'final-boss-hidden-scroll-'));
  const main = path.join(temporary, 'main.cjs');
  await fs.writeFile(main, `const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>new BrowserWindow({width:390,height:844,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}}).loadURL('about:blank'));app.on('window-all-closed',()=>app.quit());`);
  const app = await playwright()._electron.launch({ executablePath: require('electron'), args: [main, `--user-data-dir=${path.join(temporary, 'profile')}`] });
  try {
    const page = await app.firstWindow();
    const css = (await fs.readFile(path.join(__dirname, 'src/styles.css'), 'utf8')) + '\n' + (await fs.readFile(path.join(__dirname, 'viewport.css'), 'utf8'));
    await page.setContent(`<style>${css}</style><style>body {margin:0} .battle-shell {display:block;width:240px;height:180px} .gameplay-area {width:220px;height:170px} .gameplay-zoom-viewport {width:200px;height:160px} .fixture-content {position:relative;width:400px;height:300px} button {position:absolute;left:300px;top:250px}</style><div class="battle-shell"><div class="gameplay-area"><div class="gameplay-zoom-viewport"><div class="fixture-content"><button>Focus game choice</button></div></div></div></div>`);
    await page.locator('button').focus();
    const offsets = await page.evaluate(() => [...document.querySelectorAll('.battle-shell,.gameplay-area,.gameplay-zoom-viewport')].map(node => ({ name: node.className, left: node.scrollLeft, top: node.scrollTop })));
    for (const wrapper of offsets) assert.deepEqual([wrapper.left, wrapper.top], [0, 0], `${wrapper.name} must clip without focus scrolling`);
    console.log('PASS native game wrappers cannot retain focus-induced scroll offsets');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
