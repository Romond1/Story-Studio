const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
// Reuse the existing real-IPC test harness without launching Electron.
const source = fs.readFileSync('src/shared/projectPersistence.test.ts', 'utf8');
const harness = source.slice(source.indexOf('function mainHarness()'), source.indexOf('\nconst fixture'));
const compiled = ts.transpileModule(harness, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
const context = { require, readFileSync: fs.readFileSync, path, vm, ts, createRequire: require('node:module').createRequire, console, process };
vm.runInNewContext(compiled + '\nglobalThis.auditHarness = mainHarness;', context);
const paths = [
  'EPISODE 1/WIN APP/Prod EP1', 'EPISODE 2/Ep2 Studio', 'EPISODE 3/STORY STUDIO/ep3 raw',
  'EPISODE 4/STORY STUDIO', 'EPISODE 5/STORY STUDIO', 'EPISODE 6/STORY STUDIO',
].map(p => path.join('D:/AI/SET OUT/TWIN STAR', p, 'project.json'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function blocks(data) {
  const out = { aCardLibrary: data.aCardLibrary, bCardLibrary: data.bCardLibrary };
  for (const [group, hosts] of Object.entries({ slides: data.slides, sections: data.sections, ...data.boostPack })) {
    for (const h of hosts || []) {
      if ('bCardInstances' in h) out[group + '/' + h.id + '/bCardInstances'] = h.bCardInstances;
      if ('storyReferences' in h) out[group + '/' + h.id + '/storyReferences'] = h.storyReferences;
      if (h.type === 'aCardRef' || h.type === 'bCardRef') out[group + '/' + h.id] = h;
    }
  }
  return JSON.parse(JSON.stringify(out));
}
async function roundtrip(raw) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'story-card-v2-baseline-'));
  // Only this newly created temporary directory is ever written; production sources are read-only.
  const file = path.join(folder, 'project.json');
  const bytes = JSON.stringify(raw);
  fs.writeFileSync(file, bytes);
  const api = context.auditHarness();
  const opened = await api.open(folder);
  assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'Open must not write source JSON');
  await api.call('project:save', opened.data, 'save', folder);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  const reopened = await api.open(folder);
  assert.deepEqual(blocks(reopened.data), blocks(opened.data), 'Runtime card view must survive save/reopen');
  return { folder, opened: opened.data, saved };
}
(async () => {
  const episodes = [];
  for (const file of paths) {
    const bytes = fs.readFileSync(file);
    const raw = JSON.parse(bytes);
    const result = await roundtrip(raw);
    const before = blocks(raw), after = blocks(result.saved);
    const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(k => ({ block: k, before: before[k], after: after[k] }));
    const entry = { path: file, temporaryCopy: result.folder, sha256Before: hash(bytes), sha256After: hash(fs.readFileSync(file)), changes, noV2Module: !('cardsV2' in result.saved), aCards: Object.keys(raw.aCardLibrary || {}).length, bCards: Object.keys(raw.bCardLibrary || {}).length };
    assert.equal(entry.sha256Before, entry.sha256After);
    assert.deepEqual(changes, [], 'All authored card blocks must be preserved');
    assert.equal(entry.noV2Module, true);
    episodes.push(entry);
  }
  const raw = {
    version: 4, createdAt: '2020-01-01', updatedAt: '2020-01-01', slides: [], assets: [],
    sections: [{ id: 'section', name: 'Story', storyReferences: [{ id: 'old-placement', type: 'bCardRef', bCardId: 'card', position: { x: 100, y: 120 }, size: { width: 270, height: 390 } }] }],
    aCardLibrary: {}, bCardLibrary: { card: { id: 'card', name: 'Legacy', front: { text: 'Question' }, back: { text: 'Answer' } } },
  };
  const result = await roundtrip(raw);
  const preservation = { condition: 'B', resolved: true, temporaryCopy: result.folder, before: raw.sections[0], after: result.saved.sections[0] };
  assert.deepEqual(result.saved.sections[0].storyReferences, raw.sections[0].storyReferences);
  assert.equal('bCardInstances' in result.saved.sections[0], false);
  assert.equal(result.opened.sections[0].bCardInstances.length, 1);
  fs.writeFileSync('docs/card-v2-implementation/legacy-preservation-audit.json', JSON.stringify({ episodes, preservation }, null, 2));
  console.log(JSON.stringify({ episodes: episodes.map(x => ({ path: x.path, changedBlocks: x.changes.length, unchangedSource: x.sha256Before === x.sha256After })), preservation }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
