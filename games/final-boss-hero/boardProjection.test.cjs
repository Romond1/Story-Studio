const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
let projection;
try { projection = require('./src/components/boardProjection.ts').computeBoardProjectionPadding; } catch {}

test('the original 48-tile star projection is included on both horizontal sides', () => {
  assert.equal(typeof projection, 'function', 'Board layout must include its projected overhang');
  const padding = projection(1147, 1147);
  // Native Chromium measured 367.70px at zoom .28, or 1313.22 logical pixels.
  assert.ok(1147 + 2 * padding.inline >= 1313.22 - 1);
  assert.ok(padding.inline > 82 && padding.inline < 84);
});

test('the original capped 60-tile star includes its bottom projection', () => {
  assert.equal(typeof projection, 'function');
  const padding = projection(1376, 1376);
  // Original 1400px perspective and 18-degree tilt project beyond the bottom.
  assert.ok(padding.inline > 122 && padding.inline < 124);
  assert.ok(padding.bottom > 80 && padding.bottom < 90);
});

test('the default shield retains its original aspect and needs no upper projection gutter', () => {
  assert.equal(typeof projection, 'function');
  const padding = projection(670, 804);
  assert.ok(padding.inline > 32 && padding.inline < 34);
  assert.ok(padding.bottom > 15 && padding.bottom < 20);
  assert.deepEqual(Object.keys(padding), ['inline', 'bottom']);
});
