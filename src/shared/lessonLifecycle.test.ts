import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createLesson } from './lesson/commands';
import { parseLessonProject } from './lesson/validation';
import { ProjectHistory } from './projectHistory';
import { mergeLessonMediaImport } from './lesson/mediaImport';

/** Exercise the actual root callbacks across async IPC, without a second implementation. */
function harness() {
  const project = createLesson(), history = new ProjectHistory<typeof project>(); history.reset(project);
  const source = ts.createSourceFile('LessonApp.tsx', readFileSync('src/renderer/lesson/LessonApp.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations: string[] = [];
  const names = new Set(['run', 'save', 'importMedia']);
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.has(node.name.text)) declarations.push(`const ${node.getText(source)};`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  const state = { project, file: { folderPath: 'source', data: project }, error: '', notice: '', busy: false };
  const latest = { current: project }, operationRef = { current: false };
  const context: any = {
    project, file: state.file, latest, history: { current: history }, busy: false, operationRef, operation: operationRef, activeBinId: '',
    parseLessonProject, mergeLessonMediaImport, window: { lessonApi: {}, appApi: {} },
    setBusy: (value: boolean) => { state.busy = value; },
    setError: (value: string) => { state.error = value; },
    setNotice: (value: string) => { state.notice = value; },
    setFile: (value: typeof state.file) => { state.file = value; },
    setProject: (value: typeof project) => { state.project = value; },
  };
  vm.createContext(context);
  const js = ts.transpileModule(`${declarations.join('\n')}\nglobalThis.callbacks={run,save,importMedia};`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInContext(js, context);
  return { context, state, latest, history, callbacks: context.callbacks, operationRef };
}
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };

test('lesson save completion marks the written revision and retains newer edits and dirty status', async () => {
  const h = harness(), pending = deferred<{ folderPath: string; lastSavedAt: string }>();
  const written = h.state.project;
  h.context.window.lessonApi.saveProject = () => pending.promise;
  const saving = h.callbacks.save('saveAs');
  const newer = { ...written, title: 'Newer changes' }; h.latest.current = newer; h.history.record(newer); h.state.project = newer;
  pending.resolve({ folderPath: 'copy', lastSavedAt: '2026-10-08' }); await saving;
  assert.equal(h.state.project, newer); assert.equal(h.state.file.folderPath, 'copy'); assert.equal(h.history.isDirty, true);
  assert.equal(h.history.undo(), written); assert.equal(h.history.isDirty, false);
});

test('lesson Save As cancellation and failed save keep the current file and dirty revision', async () => {
  const h = harness(), changed = { ...h.state.project, title: 'Changed' };
  h.history.record(changed);
  h.context.window.lessonApi.saveProject = async () => null;
  await h.callbacks.save('saveAs'); assert.equal(h.state.file.folderPath, 'source'); assert.equal(h.history.isDirty, true);
  h.context.window.lessonApi.saveProject = async () => { throw Error('disk unavailable'); };
  await h.callbacks.save('save'); assert.match(h.state.error, /disk unavailable/); assert.equal(h.history.isDirty, true); assert.equal(h.state.busy, false);
});

test('lesson folder import preserves actual imported bin identities and edits made during file copy', async () => {
  const h = harness(), pending = deferred<any>();
  h.context.window.appApi.importMediaFolder = () => pending.promise;
  const importing = h.callbacks.importMedia('folder');
  h.latest.current = { ...h.state.project, title: 'Edited while importing' };
  const asset = { id: 'image', mediaType: 'image', filename: 'image.png', originalName: 'image.png', relativePath: 'assets/image.png', binId: 'bin', sizeBytes: 2, importedAt: '2026-10-08' };
  pending.resolve({ importedAssets: [asset], importedBins: [{ id: 'bin', name: 'Lesson media' }], createdSlides: [], failures: [] });
  await importing;
  assert.equal(h.state.project.title, 'Edited while importing');
  assert.equal(h.state.project.mediaBins[0].id, 'bin');
  assert.equal(parseLessonProject(h.state.project).assets[0].binId, 'bin');
});

test('lesson operations serialize immediately before React can publish a busy render', async () => {
  const h = harness(), pending = deferred<{ folderPath: string; lastSavedAt: string }>(); let saves = 0;
  h.context.window.lessonApi.saveProject = () => { saves++; return pending.promise; };
  const first = h.callbacks.save('save'), second = h.callbacks.save('save');
  pending.resolve({ folderPath: 'source', lastSavedAt: '2026-10-08' }); await Promise.all([first, second]);
  assert.equal(saves, 1);
});

test('image-dialog import captures the active bin before its asynchronous picker returns', async () => {
  const h = harness(), pending = deferred<any>();
  h.context.activeBinId = 'chosen';
  h.latest.current = { ...h.state.project, mediaBins: [{ id: 'chosen', name: 'Chosen' }, { id: 'other', name: 'Other' }] };
  h.context.window.appApi.importMedia = () => pending.promise;
  const importing = h.callbacks.importMedia('files');
  h.context.activeBinId = 'other';
  pending.resolve({ importedAssets: [{ id: 'image', mediaType: 'image', filename: 'image.png', originalName: 'image.png', relativePath: 'assets/image.png', sizeBytes: 2, importedAt: '2026-10-09' }], createdSlides: [] });
  await importing;
  assert.equal(h.state.error, '');
  assert.equal(h.state.project.assets[0].binId, 'chosen');
});
