const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

// Render the real copied editor/store with React. Only image loading is stubbed;
// source files compile in memory and all editing/import logic remains real.
const sourceRoot = path.join(__dirname, 'src');
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}
require.extensions['.png'] = (module, filename) => { module.exports = filename; };
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(global, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
const { useBattleStore } = require(path.join(sourceRoot, 'store/battleStore.ts'));
const { EditModeShell } = require(path.join(sourceRoot, 'components/EditModeShell.tsx'));
const initial = useBattleStore.getState();
let root, unsubscribe;
test.beforeEach(() => {
  useBattleStore.setState(initial, true);
  root = createRoot(document.getElementById('root'));
  React.act(() => root.render(React.createElement(EditModeShell)));
});
test.afterEach(() => { unsubscribe?.(); unsubscribe = null; React.act(() => root.unmount()); });
test.after(() => dom.window.close());

function watchBoundedUpdates(field) {
  let changes = 0;
  unsubscribe = useBattleStore.subscribe((state, previous) => {
    if (state[field] !== previous[field] && ++changes > 20) throw new Error(`${field} source/draft feedback loop`);
  });
  return () => changes;
}
function clickSection(name) {
  const button = [...document.querySelectorAll('.edit-shell-sidebar button')].find(node => node.textContent === name);
  assert.ok(button, `${name} section exists`);
  React.act(() => button.click());
}
function editLabeledInput(label, value) {
  const element = [...document.querySelectorAll('label')].find(node => node.firstChild?.textContent.trim() === label)?.querySelector('input');
  assert.ok(element, `${label} input exists`);
  editNativeInput(element, value);
}
function editNativeInput(element, value) {
  React.act(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
function gameAssignmentInputs() {
  return [...document.querySelectorAll('label')]
    .filter(node => node.textContent.trim().startsWith('Used in '))
    .map(node => node.querySelector('input'));
}

test('same-id card import settles and subsequent native draft edits still autosave', () => {
  const updates = watchBoundedUpdates('cardLibrary');
  const project = JSON.parse(JSON.stringify(initial.exportProjectFile()));
  project.project.cardLibrary[0].title = 'Imported vocabulary';
  project.project.cardLibrary[0].boardDashQuestion = 'Describe the imported word';
  project.project.cardLibrary[0].miniGames = ['memoryReveal', 'matchPairs', 'laneBattle', 'openBox', 'boardDash'];
  React.act(() => assert.deepEqual(useBattleStore.getState().importProjectFile(project), { ok: true }));
  assert.equal(useBattleStore.getState().cardLibrary[0].title, 'Imported vocabulary');
  assert.equal(useBattleStore.getState().cardLibrary[0].boardDashQuestion, 'Describe the imported word');
  assert.ok(updates() <= 2, 'Import has bounded source updates');
  clickSection('Cards');
  editLabeledInput('Title', 'Edited after import');
  assert.equal(useBattleStore.getState().cardLibrary[0].title, 'Edited after import');
});

test('same-id cutscene import settles and subsequent native media edits still autosave', () => {
  const updates = watchBoundedUpdates('activeEncounter');
  const project = JSON.parse(JSON.stringify(initial.exportProjectFile()));
  project.project.encounter.cutscenes[0].mediaSource = 'data:image/png;base64,aGVsbG8=';
  React.act(() => useBattleStore.getState().importProjectFile(project));
  assert.equal(useBattleStore.getState().activeEncounter.cutscenes[0].mediaSource, 'data:image/png;base64,aGVsbG8=');
  assert.ok(updates() <= 2, 'Import has bounded encounter updates');
  clickSection('Cutscenes');
  editLabeledInput('Media Source', 'https://example.test/updated-cutscene.png');
  assert.equal(useBattleStore.getState().activeEncounter.cutscenes[0].mediaSource, 'https://example.test/updated-cutscene.png');
});

test('explicit empty card assignments remain unchecked through import, selection and native edits', () => {
  const project = JSON.parse(JSON.stringify(initial.exportProjectFile()));
  const cardId = project.project.cardLibrary[0].id;
  project.project.cardLibrary[0].miniGames = [];
  project.project.encounter.boardDashCardIds = [cardId];
  React.act(() => assert.deepEqual(useBattleStore.getState().importProjectFile(project), { ok: true }));
  clickSection('Cards');
  assert.equal(gameAssignmentInputs().length, 5);
  assert.ok(gameAssignmentInputs().every(input => !input.checked), 'Explicit none displays no checked games');
  React.act(() => document.querySelectorAll('.cards-library-grid > button')[1].click());
  React.act(() => document.querySelectorAll('.cards-library-grid > button')[0].click());
  assert.ok(gameAssignmentInputs().every(input => !input.checked), 'Reselecting the card preserves none');
  editLabeledInput('Title', 'Edited card assigned to no games');
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames, []);
  clickSection('Board Dash');
  const question = document.querySelector('.board-dash-card-question');
  assert.ok(question && !question.disabled, 'Native question input is editable');
  editNativeInput(question, 'Edited question without changing game assignments');
  assert.equal(useBattleStore.getState().cardLibrary[0].boardDashQuestion, 'Edited question without changing game assignments');
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames, []);
  clickSection('Cards');
  assert.ok(gameAssignmentInputs().every(input => !input.checked));
  assert.deepEqual(useBattleStore.getState().exportProjectFile().project.cardLibrary[0].miniGames, []);
});

test('unchecking every native game assignment survives subsequent title editing', () => {
  clickSection('Cards');
  assert.equal(gameAssignmentInputs().length, 5);
  assert.ok(gameAssignmentInputs().every(input => input.checked), 'Omitted assignments retain the all-games default');
  for (let index = 0; index < 5; index++) {
    React.act(() => gameAssignmentInputs()[index].click());
  }
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames, []);
  assert.ok(gameAssignmentInputs().every(input => !input.checked), 'Unchecking the final game preserves none');
  editLabeledInput('Title', 'Native card still assigned to no games');
  assert.deepEqual(useBattleStore.getState().cardLibrary[0].miniGames, []);
  assert.ok(gameAssignmentInputs().every(input => !input.checked));
});
