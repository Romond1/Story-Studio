const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const math = require('./src/components/zoomMath.ts');
const metrics = { viewportWidth: 320, viewportHeight: 440, contentWidth: 800, contentHeight: 480, fitZoom: .4 };

test('initial and resized play areas fit all critical content without manual zoom', () => {
  assert.equal(typeof math.reclampPlayAreaView, 'function', 'The original zoom model must support automatic fitting');
  const next = math.reclampPlayAreaView(metrics, { zoom: 1, offsetX: 0, offsetY: 0 }, true);
  assert.equal(next.zoom, .4);
  assert.ok(metrics.contentWidth * next.zoom <= metrics.viewportWidth);
  assert.ok(metrics.contentHeight * next.zoom <= metrics.viewportHeight);
});

test('explicit wheel zoom is preserved when content observation runs', () => {
  assert.equal(typeof math.reclampPlayAreaView, 'function');
  const current = { zoom: 1.64, offsetX: -30, offsetY: -15 };
  assert.deepEqual(math.reclampPlayAreaView(metrics, current, false), current);
});

test('automatic fit centers smaller content and retains correct local pan coordinates', () => {
  assert.equal(typeof math.reclampPlayAreaView, 'function');
  const next = math.reclampPlayAreaView(metrics, { zoom: 1.64, offsetX: -150, offsetY: -80 }, true);
  assert.deepEqual(next, { zoom: .4, offsetX: 0, offsetY: 124 });
});

test('dense Board Dash can automatically fit below the original minimum zoom', () => {
  assert.equal(typeof math.computePlayAreaFitZoom, 'function');
  const dense = { viewportWidth: 324, viewportHeight: 422, contentWidth: 1700, contentHeight: 1600 };
  const zoom = math.computePlayAreaFitZoom(dense, true);
  assert.ok(zoom < .28 && zoom >= .05);
  assert.ok(dense.contentWidth * zoom <= dense.viewportWidth);
  assert.ok(dense.contentHeight * zoom <= dense.viewportHeight);
});

test('other mini-games retain their original minimum fitting zoom', () => {
  assert.equal(typeof math.computePlayAreaFitZoom, 'function');
  assert.equal(math.computePlayAreaFitZoom({ viewportWidth: 324, viewportHeight: 422, contentWidth: 1700, contentHeight: 1600 }, false), .28);
});

test('wheel zoom follows delta magnitude and is consistent across wheel units',()=>{
 assert.equal(typeof math.wheelZoom,'function');
 assert.ok(math.wheelZoom(1,-1,0,.4,3.5)-1<.005);
 assert.ok(math.wheelZoom(1,-100,0,.4,3.5)>math.wheelZoom(1,-10,0,.4,3.5));
 assert.equal(math.wheelZoom(1,-3,1,.4,3.5),math.wheelZoom(1,-48,0,.4,3.5));
 assert.equal(math.wheelZoom(.4,100,0,.4,3.5),.4);
 assert.equal(math.wheelZoom(3.5,-100,0,.4,3.5),3.5);
});
