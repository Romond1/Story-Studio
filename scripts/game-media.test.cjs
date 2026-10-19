const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpile(require('node:fs').readFileSync(filename, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }), filename);
const { addGameMedia } = require('../src/shared/modules/gameMedia.ts');
const { createModuleTemplate } = require('../src/shared/modules/templates.ts');
const { parseEpisodeActivity } = require('../src/shared/modules/validation.ts');
const activity = moduleType => ({ id: 'activity', moduleType, moduleVersion: 1, configVersion: 1, config: createModuleTemplate(moduleType) });
test('Mastery media becomes playable cards and cutscenes with stable references', () => {
  const source = activity('final-boss-hero');
  const next = addGameMedia(source, [{ id: 'image', mediaType: 'image', label: 'Apple' }, { id: 'clip', mediaType: 'video', label: 'Intro' }]);
  const card = next.config.cardLibrary.at(-1);
  assert.equal(card.image, 'asset:image');
  assert.ok(next.config.encounter.selectedCardIds.includes(card.id));
  assert.ok(next.config.encounter.boardDashCardIds.includes(card.id));
  assert.equal(next.config.encounter.cutscenes.at(-1).mediaSource, 'asset:clip');
  assert.equal(source.config.cardLibrary.length, 2);
  assert.deepEqual(parseEpisodeActivity(next), next);
});
test('Challenge selects one image and rejects unsupported or ambiguous choices', () => {
  const source = activity('language-snake');
  assert.equal(addGameMedia(source, [{ id: 'sky', mediaType: 'image', label: 'Sky' }]).config.backgroundImage, 'asset:sky');
  assert.throws(() => addGameMedia(source, [{ id: 'clip', mediaType: 'video', label: 'Clip' }]));
  assert.throws(() => addGameMedia(source, [{ id: 'a', mediaType: 'image', label: 'A' }, { id: 'b', mediaType: 'image', label: 'B' }]));
});
