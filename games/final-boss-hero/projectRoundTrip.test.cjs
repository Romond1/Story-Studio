const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile the real store in memory. No original/copy source or build outputs are written.
const sourceRoot = path.join(__dirname, 'src');
const originalTsLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot + path.sep)) return originalTsLoader?.(module, filename);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const { useBattleStore } = require('./src/store/battleStore.ts');
const { MINI_GAME_IDS } = require('./src/types/game.ts');
const initial = useBattleStore.getState();
test.afterEach(() => useBattleStore.setState(initial, true));

test('default project roundtrip preserves cards that omit optional game assignments', () => {
  const project = JSON.parse(JSON.stringify(useBattleStore.getState().exportProjectFile()));
  assert.equal(project.project.cardLibrary[0].miniGames, undefined, 'Original sample cards intentionally apply to every game');
  assert.deepEqual(useBattleStore.getState().importProjectFile(project), { ok: true });
  for (const card of useBattleStore.getState().cardLibrary) {
    for (const id of MINI_GAME_IDS) {
      assert.ok(!card.miniGames || card.miniGames.includes(id), `${card.title} stays available in ${id} after import`);
    }
  }
});

test('explicit empty game assignments remain empty during project import', () => {
  const project = JSON.parse(JSON.stringify(useBattleStore.getState().exportProjectFile()));
  project.project.cardLibrary[0].miniGames = [];
  useBattleStore.getState().importProjectFile(project);
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames, []);
});

test('explicit game assignments retain only supported unique game ids', () => {
  const project = JSON.parse(JSON.stringify(useBattleStore.getState().exportProjectFile()));
  project.project.cardLibrary[0].miniGames = ['laneBattle', 'unsupported', 'laneBattle'];
  useBattleStore.getState().importProjectFile(project);
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames, ['laneBattle']);
});
