/** Read-only architecture evidence. Never activates, saves, or migrates a lesson.
 * Run from repository root: node scripts/phase6b-audit.mjs
 * Only writes the report under docs/phase6b-evidence.
 */
import assert from 'node:assert/strict';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import ts from 'typescript';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Reuse the real main-process loader with only Electron's UI boundary mocked.
const source = ts.createSourceFile('test.ts', readFileSync('src/shared/projectPersistence.test.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'mainHarness');
assert.ok(declaration, 'Existing persistence harness must be available');
const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
const api = new Function('ts', 'readFileSync', 'createRequire', 'path', 'vm', 'os', 'randomUUID', `${code}; return mainHarness();`)(ts, readFileSync, createRequire, path, vm, os, randomUUID);
const inventory = readFileSync('docs/card-v2-research/episode-inventory.md', 'utf8');
const paths = [...inventory.matchAll(/^\| ([1-6]) \| `([^`]+project\.json)`/gm)];
assert.equal(paths.length, 6, 'Use only the six documented production paths');
const episodes = [];
const require = createRequire(import.meta.url);
const { createMediaRegistry } = require('../dist/main/shared/content/mediaRegistry.js');
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
  const registry = createMediaRegistry({ format: 'legacy', data: opened.data });
  const dependencies = registry.dependencies();
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
    files, registryDiagnostics: registry.diagnostics(), dependencySummary: {
      uses: dependencies.uses.length, issues: dependencies.issues.length, complete: dependencies.complete,
      issueKinds: Object.fromEntries([...new Set(dependencies.issues.map(issue => issue.kind))].map(kind => [kind, dependencies.issues.filter(issue => issue.kind === kind).length])),
    }, sha256Before: hash(bytes), sha256After: hash(after), unchanged: true });
}

globalThis.crypto ??= webcrypto;
const { createLesson, createCard } = require('../dist/main/shared/lesson/commands.js');
const lesson = createLesson('Read-only library dependency characterization');
lesson.assets.push({ id: 'image', filename: 'image.png', originalName: 'image.png', relativePath: 'assets/image.png', mediaType: 'image', sizeBytes: 1, importedAt: new Date().toISOString() });
const card = createCard(); card.faces[0].imageAssetId = 'image'; lesson.cards[card.id] = card; lesson.library.push(card.id);
const libraryUses = createMediaRegistry({ format: 'scene', data: lesson }).usages('image');
assert.equal(libraryUses.length, 1); assert.equal(libraryUses[0].ownerType, 'card');
const report = { date: new Date().toISOString(), scope: 'Read-only real loader; six documented JSON hashes and registered-file existence. No activation, save, migration, or source-media content hashing.', episodes,
  characterization: { unplacedLibraryImageIncludedInAuthoredDependencies: true } };
const evidenceDirectory = process.env.STORY_STUDIO_EVIDENCE || 'docs/phase6b-evidence';
await fs.mkdir(evidenceDirectory, { recursive: true });
await fs.writeFile(path.join(evidenceDirectory, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));


