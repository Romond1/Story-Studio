/** Read-only architecture evidence. Never activates, saves, or migrates a lesson.
 * Run from repository root: node scripts/phase6a-audit.mjs
 * Only writes the report under docs/phase6a-evidence.
 */
import assert from 'node:assert/strict';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import ts from 'typescript';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Reuse the real main-process loader with only Electron's UI boundary mocked.
const source = ts.createSourceFile('test.ts', readFileSync('src/shared/projectPersistence.test.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'mainHarness');
assert.ok(declaration, 'Existing persistence harness must be available');
const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
const api = new Function('ts', 'readFileSync', 'createRequire', 'path', 'vm', `${code}; return mainHarness();`)(ts, readFileSync, createRequire, path, vm);
const inventory = readFileSync('docs/card-v2-research/episode-inventory.md', 'utf8');
const paths = [...inventory.matchAll(/^\| ([1-6]) \| `([^`]+project\.json)`/gm)];
assert.equal(paths.length, 6, 'Use only the six documented production paths');
const episodes = [];
for (const [, episode, file] of paths) {
  let bytes;
  try { bytes = await fs.readFile(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    episodes.push({ episode: Number(episode), status: 'unavailable' });
    continue;
  }
  const raw = JSON.parse(bytes.toString('utf8'));
  const opened = await api.call('project:open-path', path.dirname(file));
  const after = await fs.readFile(file);
  assert.equal(hash(after), hash(bytes), 'Opening must not change source bytes');
  assert.deepEqual(JSON.parse(JSON.stringify(opened.data.assets)), raw.assets, 'Opening must preserve asset records');
  const ids = raw.assets.map(asset => asset.id);
  const files = { available: 0, missing: 0, outsideRoot: 0 };
  const root = path.resolve(path.dirname(file));
  for (const asset of raw.assets) {
    const resolved = path.resolve(root, asset.relativePath);
    const relative = path.relative(root, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { files.outsideRoot++; continue; }
    try { const stat = await fs.stat(resolved); stat.isFile() ? files.available++ : files.missing++; }
    catch (error) { if (error.code !== 'ENOENT') throw error; files.missing++; }
  }
  episodes.push({ episode: Number(episode), status: 'opened-read-only', sourceVersion: raw.version,
    normalizedVersion: opened.data.version, assets: ids.length, duplicateAssetIds: ids.length - new Set(ids).size,
    bins: raw.mediaBins?.length ?? 0, slides: raw.slides.length, sections: raw.sections?.length ?? 0,
    hasLegacyCards: !!(raw.aCardLibrary || raw.bCardLibrary), hasCardV2: !!raw.cardsV2,
    storedStudentCount: raw.sparkStudents?.length ?? 0,
    storedRelicProgressCount: Object.keys(raw.relicSystem?.studentProgress ?? {}).length,
    files, sha256Before: hash(bytes), sha256After: hash(after), unchanged: true });
}

// Characterize the present usage gap without changing production code.
const poolSource = ts.createSourceFile('pool.tsx', readFileSync('src/renderer/lesson/LessonMediaPool.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const usageDeclaration = poolSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'lessonAssetUsage');
assert.ok(usageDeclaration);
const usageCode = ts.transpileModule(usageDeclaration.getText(poolSource), { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', usageCode)(exports);
const libraryOnly = { scenes: {}, cards: { card: { faces: [{ imageAssetId: 'image' }] } } };
assert.equal(exports.lessonAssetUsage(libraryOnly, 'image'), 0);

// Scene reader validates known fields but currently preserves unrecognized top-level data.
const require = createRequire(import.meta.url);
const { createLesson } = require('../dist-test/shared/lesson/commands.js');
const { parseLessonProject } = require('../dist-test/shared/lesson/validation.js');
globalThis.crypto ??= webcrypto;
assert.equal(parseLessonProject({ ...createLesson(), auditUnknown: true }).auditUnknown, true);
const report = { date: '2026-10-12', scope: 'JSON hashes and registered-asset existence; no source media content hashes, UI launch, activation, or save',
  episodes, characterization: { libraryOnlyImageHasZeroSceneUses: true, unknownLessonTopLevelFieldRetained: true } };
await fs.mkdir('docs/phase6a-evidence', { recursive: true });
await fs.writeFile('docs/phase6a-evidence/audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
