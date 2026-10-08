import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { updateSectionInProjectData } from './sectionMutations';
import { ProjectHistory } from './projectHistory';
import { applyMediaImportToProjectData } from './mediaImport';
import { addCardToHost } from './cardAuthoring';
import { applyPresentationDrawing, createPresentationSession, presentationToken, reducePresentationSession, resolvePresentationTarget } from './presentationSession';

// Exercise the real IPC handlers, replacing only Electron's window/dialog boundary.
function mainHarness() {
  const handlers = new Map<string, (...args: any[]) => any>();
  let selection: string | null = null;
  const electron = {
    app: { requestSingleInstanceLock: () => true, whenReady: () => ({ then() {} }), on() {} },
    BrowserWindow: function () {},
    dialog: { showOpenDialog: async () => ({ canceled: !selection, filePaths: selection ? [selection] : [] }) },
    ipcMain: {
      handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn),
      on: (name: string, fn: (...args: any[]) => any) => handlers.set(name, (_, ...args) => {
        const event = { returnValue: undefined }; fn(event, ...args); return event.returnValue;
      }),
    },
    protocol: { registerSchemesAsPrivileged() {} },
  };
  const cache = new Map<string, any>();
  function load(filename: string): any {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const nativeRequire = createRequire(filename);
    let source = readFileSync(filename, 'utf8');
    if (filename.endsWith(`${path.sep}main.ts`)) source += '\nmainWindow = {} as BrowserWindow;';
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
    vm.runInNewContext(js, {
      module, exports: module.exports, __dirname: path.dirname(filename), console, process,
      require: (id: string) => id === 'electron' ? electron : id.startsWith('.') ? load(path.resolve(path.dirname(filename), `${id}.ts`)) : nativeRequire(id),
    }, { filename });
    return module.exports;
  }
  load(path.resolve('src/main/main.ts'));
  const call = (name: string, ...args: any[]) => handlers.get(name)!(null, ...args);
  return {
    call,
    select: (folder: string | null) => { selection = folder; },
    open: async (folder: string) => {
      const candidate = await call('project:open-path', folder);
      if (candidate.activationToken) await call('project:activate', candidate.activationToken);
      return candidate;
    },
  };
}

const fixture = () => ({ version: 1, createdAt: '2020-01-01', updatedAt: '2020-01-01', slides: [], assets: [], sections: [] });

test('direct card host attachments and local appearance survive real save/reopen', async t => {
  const root=await sandbox(t);
  await fs.writeFile(path.join(root,'project.json'),JSON.stringify({...fixture(),sections:[{id:'story',name:'Story'},{id:'break',name:'Break',type:'break'}],slides:[{id:'slide',sectionId:'story',assetId:'image',transition:'none'}],boostPack:{activationSequence:[{id:'prompt',type:'promptCard',body:'Question'}],languageSequence:[],gamesSequence:[]}}));
  const api=mainHarness(),active=await api.open(root);let data=active.data,serial=0;
  const fresh=()=>`persist-${++serial}`;
  const placements:string[]=[];
  for(const host of [{kind:'slide' as const,id:'slide'},{kind:'section' as const,id:'break'},{kind:'booster' as const,id:'prompt',tab:'activation' as const}]){
    const added=addCardToHost(data,host,fresh);data=added.data;placements.push(added.placementId);
    data.cardsV2.activities[data.cardsV2.placements[added.placementId].activityId].instances[0].style={preset:'dark',borderWidth:4};
  }
  await api.call('project:save',data,'save',root);const reopened=await api.open(root);
  assert.equal(reopened.data.slides[0].cardPlacementId,placements[0]);
  assert.equal(reopened.data.sections.find((s:any)=>s.id==='break').cardPlacementId,placements[1]);
  assert.equal(reopened.data.boostPack.activationSequence[0].cardPlacementId,placements[2]);
  assert.deepEqual(jsonValue(reopened.data.cardsV2),jsonValue(data.cardsV2));
  assert.equal('session' in reopened.data.cardsV2,false);
});

test('pool bins and unused project assets survive the actual save/open pipeline', async t => {
  const root = await sandbox(t);
  await fs.writeFile(path.join(root,'project.json'),JSON.stringify(fixture()));
  const input=path.join(root,'source.png');await fs.writeFile(input,'test image');
  const api=mainHarness();const active=await api.open(root);
  const imported=await api.call('project:import-dropped-media',[input]);
  const data={...active.data,mediaBins:[{id:'bin',name:'Lesson media'}],assets:imported.importedAssets.map((asset:any)=>({...asset,binId:'bin'}))};
  await api.call('project:save',data,'save',root);
  const reopened=await api.open(root);
  assert.equal(reopened.data.mediaBins[0].name,'Lesson media');
  assert.equal(reopened.data.assets[0].binId,'bin');
  assert.equal(reopened.data.slides.length,0);
  assert.equal('editSelection' in reopened.data,false);
  assert.match(reopened.data.assets[0].relativePath,/^assets\//);
});

test('asset copy pins the active folder and excludes Save As until completion', async t => {
  const root = await sandbox(t); const source = path.join(root, 'project'); await fs.mkdir(source);
  const image = path.join(root, 'image.png'); await fs.writeFile(image, 'image bytes');
  await fs.writeFile(path.join(source, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness(); const active = await api.open(source);
  const candidate = await api.call('project:open-path', source);
  let started!: () => void; let release!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const originalCopy = fs.copyFile;
  fs.copyFile = async (...args) => { started(); await waiting; return originalCopy(...args); };
  const importing = api.call('project:import-dropped-media', [image]);
  try {
    await ready;
    assert.match(await api.call('project:activate', candidate.activationToken), /import/i);
    await assert.rejects(api.call('project:save', active.data, 'saveAs', source), /import/i);
  } finally { release(); await importing; fs.copyFile = originalCopy; }
  await api.call('project:save', active.data, 'save', source);
});
async function sandbox(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'story-phase0-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

for (const entry of ['project.json', 'notes.txt', '.hidden', 'assets']) {
  test(`New refuses a populated directory containing ${entry}`, async t => {
    const root = await sandbox(t);
    const target = path.join(root, entry);
    if (entry === 'assets') await fs.mkdir(target);
    else await fs.writeFile(target, 'existing content');
    const api = mainHarness();
    api.select(root);
    await assert.rejects(api.call('project:create'), /empty/i);
    assert.deepEqual(await fs.readdir(root), [entry]);
    if (entry !== 'assets') assert.equal(await fs.readFile(target, 'utf8'), 'existing content');
  });
}

for (const channel of ['project:open', 'project:open-path']) {
  test(`${channel}: invalid JSON cannot redirect a subsequent Save`, async t => {
    const root = await sandbox(t);
    const good = path.join(root, 'good');
    const bad = path.join(root, 'bad');
    await fs.mkdir(good); await fs.mkdir(bad);
    await fs.writeFile(path.join(good, 'project.json'), JSON.stringify(fixture()));
    await fs.writeFile(path.join(bad, 'project.json'), 'broken JSON');
    const api = mainHarness();
    const active = await api.open(good);
    api.select(bad);
    await assert.rejects(api.call(channel, bad));
    await api.call('project:save', { ...active.data, phase0Test: true }, 'save', good);
    assert.equal(JSON.parse(await fs.readFile(path.join(good, 'project.json'), 'utf8')).phase0Test, true);
    assert.equal(await fs.readFile(path.join(bad, 'project.json'), 'utf8'), 'broken JSON');
    assert.deepEqual(await fs.readdir(bad), ['project.json']);
  });
}

test('opening a candidate does not switch identity until renderer preparation succeeds', async t => {
  const root = await sandbox(t);
  const a = path.join(root, 'a'); const b = path.join(root, 'b');
  await fs.mkdir(a); await fs.mkdir(b);
  for (const folder of [a, b]) await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness();
  const active = await api.open(a);
  await api.call('project:open-path', b); // Simulate renderer rejecting this candidate.
  await api.call('project:save', { ...active.data, keptA: true }, 'save', a);
  assert.equal(JSON.parse(await fs.readFile(path.join(a, 'project.json'), 'utf8')).keptA, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(b, 'project.json'), 'utf8')).keptA, undefined);
});

test('save replacement failure preserves prior JSON and cleans only its own temporary file', async t => {
  const root = await sandbox(t);
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(fixture()));
  await fs.writeFile(path.join(root, 'project.tmp.json'), 'unrelated old temp');
  const api = mainHarness(); const active = await api.open(root);
  const originalRename = fs.rename;
  fs.rename = async () => { throw new Error('disk unavailable'); };
  try { await assert.rejects(api.call('project:save', active.data, 'save', root), /disk unavailable/); }
  finally { fs.rename = originalRename; }
  assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), JSON.stringify(fixture()));
  assert.equal(await fs.readFile(path.join(root, 'project.tmp.json'), 'utf8'), 'unrelated old temp');
  assert.deepEqual((await fs.readdir(root)).sort(), ['project.json', 'project.tmp.json']);
});

// Compile selected real renderer callbacks without mounting the media/audio UI.
// Dependencies remain explicit; deferred promises reproduce edits during IPC.
function rendererHarness(mode = 'edit') {
  const source = ts.createSourceFile('App.tsx', readFileSync('src/renderer/App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['setProject', 'setIsDirty', 'performSave', 'onSave', 'updateCurrentSlideMarkerStrokes', 'clearCurrentSlideDrawings', 'handleConfirmSave', 'onImportBubbleTemplate', 'updateSection', 'onRefreshApp', 'applyHistory', 'onImportMedia', 'applyImportedMedia'];
  const declarations = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) {
      declarations.set(node.name.text, `const ${node.getText(source)};`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  let current: any = { folderPath: 'A', data: { ...fixture(), slides: [{ id: 's1' }] }, lastSavedAt: 'old' };
  let dirty = true;
  let resolve: (value: any) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  let calls = 0; let closes = 0; let error: string | null = null; let recoveryWrites = 0;
  let notifySave!: () => void;
  const saveStarted = new Promise<void>(resolve => { notifySave = resolve; });
  const projectRef = { current };
  const presentationRef = { current: reducePresentationSession(createPresentationSession('test-session'), { type: 'project', projectId: 'test-project', slideId: 's1', sectionId: null }) };
  const dirtyRef = { current: dirty };
  const history = new ProjectHistory<any>(); history.reset(current.data, false);
  let completeImport!: (value: any) => void;
  const ctx: any = {
    historyRef: { current: history }, gestureRef: { current: undefined }, textEditRef: { current: undefined },
    applyHistory() {},
    project: current, projectRef, dirtyRef, operationRef: { current: false },
    presentation: { ref: presentationRef }, selection: { ref: presentationRef }, applyPresentationDrawing,
    activeTargetToken: presentationToken(presentationRef.current, resolvePresentationTarget(current.data, presentationRef.current)),
    appMode: mode, currentSlide: current.data.slides[0], currentIndex: 0,
    selectedSectionType: 'story', selectedSection: null,
    pendingAction: 'close', setPendingAction() {}, setShowConfirmModal() {},
    executePendingAction: () => { closes++; },
    ensureEditMode: (value: string) => value === 'edit',
    useCallback: (fn: any) => fn,
    renderProject: (value: any) => { current = value; },
    renderDirty: (value: boolean) => { dirty = value; },
    updateSectionInProjectData,
    setContextMenu() {}, setPendingSectionDeleteId() {},
    setCurrentIndex() {}, setPreviousIndex() {}, setActiveOverlayId() {}, setSelectedStoryRefId() {},
    setSelectedSlideIds() {}, setSelectedSectionId() {}, setExpandedSectionId() {}, setSelectedACardId() {}, setSelectedBadgeSpriteId() {},
    selectedSectionId: null, applyMediaImportToProjectData,
    persistLiveSessionSnapshot: () => { recoveryWrites++; },
    LIVE_SESSION_AUTO_RESTORE_KEY: 'restore', isDirty: true,
    setIsSaveInProgress() {}, setShowSaveChoiceModal() {}, setDrawClearSignal() {},
    setError: (value: string) => { error = value; }, showToast() {},
    window: {
      localStorage: { setItem() {} },
      api: { importBubbleTemplate: async () => ({ success: true, relativePath: 'assets/bubbles/example.png' }) },
      appApi: {
        importMedia: () => new Promise(resolve => { completeImport = resolve; }),
        saveProject: () => { calls++; notifySave(); return new Promise((yes, no) => { resolve = yes; reject = no; }); },
      },
    },
  };
  vm.createContext(ctx);
  const js = ts.transpileModule([...declarations.values()].join('\n') + `\nglobalThis.callbacks = { ${names.join(',')} };`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInContext(js, ctx);
  return {
    ...ctx.callbacks,
    saveStarted,
    finishImport: () => completeImport({ importedAssets: [{ id: 'asset', originalName: 'test.png', filename: 'test.png', mediaType: 'image', relativePath: 'assets/test.png' }], createdSlides: [{ id: 'imported', assetId: 'asset' }] }),
    edit: () => { ctx.callbacks.setProject({ ...current, data: { ...current.data, newer: true } }); ctx.callbacks.setIsDirty(true); },
    resolve: (folderPath = 'A') => resolve({ folderPath, lastSavedAt: 'saved' }),
    cancel: () => resolve(null), fail: () => reject(new Error('Disk full: free space and retry')),
    selectBreak: () => {
      ctx.callbacks.setProject({ ...current, data: { ...current.data, sections: [{ id: 'break', type: 'break', markerStrokes: [{ id: 'old' }] }] } });
      ctx.selectedSectionType = 'break'; ctx.selectedSection = current.data.sections[0];
      presentationRef.current = reducePresentationSession(presentationRef.current, { type: 'select', changes: { sectionId: 'break' } });
      ctx.activeTargetToken = presentationToken(presentationRef.current, resolvePresentationTarget(current.data, presentationRef.current));
    },
    state: () => ({ current, dirty, calls, closes, error, recoveryWrites }),
  };
}

test('save completion preserves newer edits and does not authorize close', async () => {
  const ui = rendererHarness();
  const saving = ui.handleConfirmSave();
  ui.edit(); ui.resolve(); await saving;
  assert.equal(ui.state().current.data.newer, true);
  assert.equal(ui.state().dirty, true);
  assert.equal(ui.state().closes, 0);
});

test('Teach-mode close saves permitted persistent changes', async () => {
  const ui = rendererHarness('teach');
  const saving = ui.handleConfirmSave();
  assert.equal(ui.state().calls, 1);
  ui.resolve(); await saving;
  assert.equal(ui.state().dirty, false);
  assert.equal(ui.state().closes, 1);
});

test('save failure keeps memory and dirty state and reports the error', async () => {
  const ui = rendererHarness(); const before = ui.state().current;
  const saving = ui.performSave('save'); ui.fail();
  assert.equal(await saving, false);
  assert.equal(ui.state().current, before);
  assert.equal(ui.state().dirty, true);
  assert.match(ui.state().error!, /Disk full/);
});

test('overlapping saves cannot race their disk writes', async () => {
  const ui = rendererHarness(); const saving = ui.performSave('save');
  const duplicate = ui.performSave('save');
  assert.equal(ui.state().calls, 1);
  ui.resolve(); await saving; await duplicate;
});

test('Save As moves the identity but retains edits made during the write', async () => {
  const ui = rendererHarness(); const saving = ui.performSave('saveAs');
  ui.edit(); ui.resolve('B'); await saving;
  assert.equal(ui.state().current.folderPath, 'B');
  assert.equal(ui.state().current.data.newer, true);
  assert.equal(ui.state().dirty, true);
});

test('persistent marker addition and clear both dirty a saved project', async () => {
  const ui = rendererHarness();
  const firstSave = ui.performSave('save'); ui.resolve(); await firstSave;
  ui.updateCurrentSlideMarkerStrokes([{ id: 'marker', points: [1, 2] }]);
  assert.equal(ui.state().dirty, true);
  const secondSave = ui.performSave('save'); ui.resolve(); await secondSave;
  ui.clearCurrentSlideDrawings();
  assert.equal(ui.state().dirty, true);
  assert.equal(ui.state().current.data.slides[0].markerStrokes.length, 0);
});

test('clearing only transient drawing leaves the saved project clean', async () => {
  const ui = rendererHarness();
  const saving = ui.performSave('save'); ui.resolve(); await saving;
  ui.clearCurrentSlideDrawings();
  assert.equal(ui.state().dirty, false);
});

test('Save As cancellation preserves project identity and unsaved changes', async () => {
  const ui = rendererHarness(); const before = ui.state().current;
  const saving = ui.performSave('saveAs'); ui.cancel();
  assert.equal(await saving, false);
  assert.equal(ui.state().current, before);
  assert.equal(ui.state().dirty, true);
  const retry = ui.performSave('save'); ui.resolve();
  assert.equal(await retry, true);
});

test('New creates a usable project and never persists the activation token', async t => {
  const root = await sandbox(t); const api = mainHarness(); api.select(root);
  const candidate = await api.call('project:create');
  assert.equal(await api.call('project:activate', candidate.activationToken), null);
  await api.call('project:save', candidate.data, 'save', root);
  const data = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.equal(data.version, 4);
  assert.equal(data.activationToken, undefined);
  assert.deepEqual((await fs.readdir(root)).sort(), ['assets', 'project.json']);
});

test('failed New publication leaves no valid project or owned staging files', async t => {
  const root = await sandbox(t); const api = mainHarness(); api.select(root);
  const originalLink = fs.link;
  fs.link = async () => { throw new Error('publication denied'); };
  try { await assert.rejects(api.call('project:create'), /publication denied/); }
  finally { fs.link = originalLink; }
  assert.deepEqual(await fs.readdir(root), []);
});

test('a project.json created during New is never replaced or deleted', async t => {
  const root = await sandbox(t); const api = mainHarness(); api.select(root);
  const originalLink = fs.link;
  fs.link = async (from, to) => {
    await fs.writeFile(to, 'concurrent user file');
    await originalLink(from, to);
  };
  try { await assert.rejects(api.call('project:create'), /EEXIST/); }
  finally { fs.link = originalLink; }
  assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), 'concurrent user file');
  assert.deepEqual(await fs.readdir(root), ['project.json']);
});

test('structurally invalid or unnormalizable candidates cannot replace the active project', async t => {
  const root = await sandbox(t); const bad = path.join(root, 'bad'); await fs.mkdir(bad);
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness(); const active = await api.open(root);
  for (const broken of [null, [], {}, { ...fixture(), sections: [null] }]) {
    await fs.writeFile(path.join(bad, 'project.json'), JSON.stringify(broken));
    await assert.rejects(api.call('project:open-path', bad));
    await api.call('project:save', active.data, 'save', root);
    assert.equal(await fs.readFile(path.join(bad, 'project.json'), 'utf8'), JSON.stringify(broken));
  }
});

test('Save rejects a renderer document belonging to a different folder', async t => {
  const root = await sandbox(t); await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness(); const active = await api.open(root);
  await assert.rejects(api.call('project:save', active.data, 'save', 'wrong-folder'), /changed/i);
  assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), JSON.stringify(fixture()));
});

test('failed Save As does not publish copied stale JSON or redirect the original identity', async t => {
  const root = await sandbox(t); const target = path.join(root, 'copy'); const source = path.join(root, 'source');
  await fs.mkdir(target); await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness(); const active = await api.open(source); api.select(target);
  const originalLink = fs.link;
  fs.link = async () => { throw new Error('publication denied'); };
  try { await assert.rejects(api.call('project:save', active.data, 'saveAs', source), /publication denied/); }
  finally { fs.link = originalLink; }
  assert.deepEqual(await fs.readdir(target), []);
  await api.call('project:save', active.data, 'save', source);
});

test('main process rejects overlapping writes and identity commits while saving', async t => {
  const root = await sandbox(t); await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness(); const active = await api.open(root);
  const candidate = await api.call('project:open-path', root);
  const originalRename = fs.rename;
  let release!: () => void; let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  fs.rename = async (from, to) => { started(); await wait; await originalRename(from, to); };
  const saving = api.call('project:save', active.data, 'save', root);
  try {
    await ready;
    assert.match(await api.call('project:activate', candidate.activationToken), /saving/i);
    await assert.rejects(api.call('project:save', active.data, 'save', root), /saving/i);
  } finally { release(); await saving; fs.rename = originalRename; }
});

test('bubble import autosave keeps edits made while it is writing', async () => {
  const ui = rendererHarness(); const importing = ui.onImportBubbleTemplate();
  await ui.saveStarted;
  assert.equal(ui.state().calls, 1);
  ui.edit(); ui.resolve(); await importing;
  assert.equal(ui.state().dirty, true);
  assert.equal(ui.state().current.data.newer, true);
  assert.equal(ui.state().current.data.bubbleDefinitions.length, 1);
});

test('break marker addition and clear participate in dirty state', async () => {
  const ui = rendererHarness(); ui.selectBreak();
  const saving = ui.performSave('save'); ui.resolve(); await saving;
  ui.updateSection('break', { markerStrokes: [{ id: 'new' }] });
  assert.equal(ui.state().dirty, true);
  const savingAgain = ui.performSave('save'); ui.resolve(); await savingAgain;
  ui.clearCurrentSlideDrawings();
  assert.equal(ui.state().dirty, true);
  assert.equal(ui.state().current.data.sections[0].markerStrokes.length, 0);
});

test('refresh cannot change recovery state while a save is pending', async () => {
  const ui = rendererHarness(); const saving = ui.performSave('save');
  await ui.onRefreshApp();
  ui.resolve(); await saving;
  assert.equal(ui.state().recoveryWrites, 0);
});

test('undo and redo cross the savepoint without changing the Save As folder', async () => {
  const ui = rendererHarness(); const saving = ui.performSave('save'); ui.resolve(); await saving;
  ui.edit(); const copying = ui.performSave('saveAs'); ui.resolve('B'); await copying;
  ui.applyHistory('undo');
  assert.equal(ui.state().current.folderPath, 'B');
  assert.equal(ui.state().current.data.newer, undefined);
  assert.equal(ui.state().dirty, true);
  ui.applyHistory('redo');
  assert.equal(ui.state().current.data.newer, true);
  assert.equal(ui.state().dirty, false);
});

test('undo while saving leaves the written revision as the redo savepoint', async () => {
  const ui = rendererHarness(); ui.edit(); const saving = ui.performSave('save');
  ui.applyHistory('undo'); ui.resolve(); await saving;
  assert.equal(ui.state().current.data.newer, undefined);
  assert.equal(ui.state().dirty, true);
  ui.applyHistory('redo'); assert.equal(ui.state().dirty, false);
});

test('pending media import preserves newer edits and blocks Save As until completion', async () => {
  const ui = rendererHarness(); const importing = ui.onImportMedia();
  ui.edit();
  const copying = ui.performSave('saveAs');
  const callsBeforeImportFinished = ui.state().calls;
  ui.finishImport(); await importing;
  if (callsBeforeImportFinished) ui.resolve('B');
  await copying;
  assert.equal(callsBeforeImportFinished, 0);
  assert.equal(ui.state().current.data.newer, true);
  assert.equal(ui.state().current.folderPath, 'A');
  assert.equal(ui.state().current.data.slides.at(-1).id, 'imported');
});

test('legacy project opens read-only and preserves markers and unknown fields when explicitly saved', async t => {
  const root = await sandbox(t);
  const marker = { id: 'm', color: '#fff', size: 12, opacity: 1, rainbow: false, points: [{ x: 0, y: 0, t: 1 }, { x: 1, y: 1, t: 2 }] };
  const legacy = { ...fixture(), customLessonMetadata: { keep: true },
    slides: [{ id: 'slide', assetId: 'asset', transition: 'fade', markerStrokes: [marker] }],
    assets: [{ id: 'asset', mediaType: 'image', relativePath: 'assets/legacy.png' }],
    sections: [{ id: 'section', name: 'Break', type: 'break', markerStrokes: [marker] }],
  };
  const bytes = JSON.stringify(legacy);
  await fs.writeFile(path.join(root, 'project.json'), bytes);
  const api = mainHarness(); const active = await api.open(root);
  assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), bytes);
  assert.deepEqual(await fs.readdir(root), ['project.json']);
  await api.call('project:save', active.data, 'save', root);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.slides[0].markerStrokes, [marker]);
  assert.deepEqual(saved.sections[0].markerStrokes, [marker]);
  assert.deepEqual(saved.customLessonMetadata, { keep: true });
  assert.equal(saved.assets[0].relativePath, 'assets/legacy.png');
});

for (const failedOperation of ['writeFile', 'sync'] as const) {
  test(`Save ${failedOperation} failure preserves source JSON, identity, and retry`, async t => {
    const root = await sandbox(t);
    const originalBytes = JSON.stringify(fixture());
    await fs.writeFile(path.join(root, 'project.json'), originalBytes);
    const api = mainHarness(); const active = await api.open(root);
    const originalOpen = fs.open;
    fs.open = async (...args: Parameters<typeof fs.open>) => {
      const file = await originalOpen(...args);
      if (path.dirname(String(args[0])) === root && path.basename(String(args[0])).startsWith('.project-')) {
        const originalWrite = file.writeFile.bind(file);
        if (failedOperation === 'writeFile') {
          file.writeFile = async () => {
            await originalWrite('partial staging bytes', 'utf8');
            throw new Error('injected staging write failure');
          };
        } else {
          file.sync = async () => { throw new Error('injected staging sync failure'); };
        }
      }
      return file;
    };
    try {
      await assert.rejects(api.call('project:save', { ...active.data, failedRevision: true }, 'save', root), /injected staging/);
    } finally { fs.open = originalOpen; }
    assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), originalBytes);
    assert.deepEqual(await fs.readdir(root), ['project.json']);
    await api.call('project:save', { ...active.data, successfulRetry: true }, 'save', root);
    const retried = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
    assert.equal(retried.successfulRetry, true);
    assert.equal(retried.failedRevision, undefined);
  });
}

test('Save As copies nested asset bytes and makes subsequent Save target the copy', async t => {
  const root = await sandbox(t); const source = path.join(root, 'source'); const target = path.join(root, 'copy');
  await fs.mkdir(path.join(source, 'assets', 'nested'), { recursive: true });
  await fs.mkdir(target);
  const originalBytes = JSON.stringify(fixture());
  const mediaBytes = Buffer.from([0, 255, 1, 128, 10, 13, 0, 42]);
  await fs.writeFile(path.join(source, 'project.json'), originalBytes);
  await fs.writeFile(path.join(source, 'assets', 'nested', 'sample.bin'), mediaBytes);
  await fs.writeFile(path.join(source, 'assets', 'notes.txt'), 'nested asset companion');
  const api = mainHarness(); const active = await api.open(source); api.select(target);
  const response = await api.call('project:save', { ...active.data, copiedRevision: true }, 'saveAs', source);
  assert.equal(response.folderPath, target);
  assert.deepEqual(await fs.readFile(path.join(target, 'assets', 'nested', 'sample.bin')), mediaBytes);
  assert.equal(await fs.readFile(path.join(target, 'assets', 'notes.txt'), 'utf8'), 'nested asset companion');
  assert.equal(JSON.parse(await fs.readFile(path.join(target, 'project.json'), 'utf8')).copiedRevision, true);
  await api.call('project:save', { ...active.data, nextRevision: true }, 'save', target);
  assert.equal(JSON.parse(await fs.readFile(path.join(target, 'project.json'), 'utf8')).nextRevision, true);
  assert.equal(await fs.readFile(path.join(source, 'project.json'), 'utf8'), originalBytes);
  assert.deepEqual(await fs.readFile(path.join(source, 'assets', 'nested', 'sample.bin')), mediaBytes);
  await assert.rejects(api.call('project:save', active.data, 'save', source), /changed/i);
});

test('Save As copy failure preserves source bytes and identity without publishing target JSON', async t => {
  const root = await sandbox(t); const source = path.join(root, 'source'); const target = path.join(root, 'copy');
  const sourceAssets = path.join(source, 'assets');
  await fs.mkdir(path.join(sourceAssets, 'nested'), { recursive: true }); await fs.mkdir(target);
  const originalBytes = JSON.stringify(fixture()); const assetBytes = Buffer.from([7, 0, 255, 99]);
  await fs.writeFile(path.join(source, 'project.json'), originalBytes);
  await fs.writeFile(path.join(sourceAssets, 'nested', 'sample.bin'), assetBytes);
  const api = mainHarness(); const active = await api.open(source); api.select(target);
  const originalCopy = fs.cp;
  fs.cp = async (...args: Parameters<typeof fs.cp>) => {
    await originalCopy(...args);
    if (String(args[0]) === sourceAssets) throw new Error('injected copy failure after asset copy');
  };
  try {
    await assert.rejects(api.call('project:save', { ...active.data, failedCopy: true }, 'saveAs', source), /injected copy failure/);
  } finally { fs.cp = originalCopy; }
  assert.equal(await fs.readFile(path.join(source, 'project.json'), 'utf8'), originalBytes);
  assert.deepEqual(await fs.readFile(path.join(sourceAssets, 'nested', 'sample.bin')), assetBytes);
  await assert.rejects(fs.access(path.join(target, 'project.json')), { code: 'ENOENT' });
  await api.call('project:save', { ...active.data, originalStillActive: true }, 'save', source);
  assert.equal(JSON.parse(await fs.readFile(path.join(source, 'project.json'), 'utf8')).originalStillActive, true);
  await assert.rejects(fs.access(path.join(target, 'project.json')), { code: 'ENOENT' });
});

for (const channel of ['project:create', 'project:open']) {
  test(`${channel} cancellation preserves original identity and source bytes`, async t => {
    const root = await sandbox(t); const originalBytes = JSON.stringify(fixture());
    await fs.writeFile(path.join(root, 'project.json'), originalBytes);
    const api = mainHarness(); const active = await api.open(root); api.select(null);
    assert.equal(await api.call(channel), null);
    assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), originalBytes);
    assert.deepEqual(await fs.readdir(root), ['project.json']);
    await api.call('project:save', { ...active.data, savedAfterCancellation: true }, 'save', root);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8')).savedAfterCancellation, true);
  });
}

// Legacy authored syntax must survive runtime compatibility normalization.
const legacyRef = (id: string) => ({ id, type: 'bCardRef', bCardId: 'card', position: { x: 100, y: 120 }, extraLegacyField: 'keep' });
const legacyCards = () => ({
  aCardLibrary: { board: { id: 'board', name: 'Board', stageMode: 'full', background: { offsetX: 0, offsetY: 0, scale: 1, blur: 0 }, bCardInstances: [] } },
  bCardLibrary: { card: { id: 'card', name: 'Card', front: { text: 'Question' }, back: { text: 'Answer' } } },
});
const jsonValue = (value: unknown) => JSON.parse(JSON.stringify(value));

for (const hostType of ['sections', 'slides'] as const) {
  test(`untouched legacy ${hostType} refs retain authored syntax after unrelated edits and repeated saves`, async t => {
    const root = await sandbox(t);
    const refs = [legacyRef('old'), { id: 'board-ref', type: 'aCardRef', aCardId: 'board', custom: 'keep' }];
    const raw = { ...fixture(), ...legacyCards(), [hostType]: [{ id: 'host', name: 'Before', storyReferences: refs }] };
    await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness(); const active = await api.open(root);
    assert.equal(active.data[hostType][0].bCardInstances[0].bCardId, 'card');
    active.data[hostType][0].name = 'Edited host name';
    for (let i = 0; i < 2; i++) {
      await api.call('project:save', active.data, 'save', root);
      const saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
      assert.deepEqual(saved[hostType][0].storyReferences, refs);
      assert.equal(Object.prototype.hasOwnProperty.call(saved[hostType][0], 'bCardInstances'), false);
      assert.equal(saved[hostType][0].name, 'Edited host name');
    }
    const reopened = await api.open(root);
    assert.deepEqual(jsonValue(reopened.data[hostType][0].bCardInstances), jsonValue(active.data[hostType][0].bCardInstances));
  });
}

for (const sequence of ['activationSequence', 'languageSequence', 'gamesSequence']) {
  test(`legacy ${sequence} refs survive host text edits and Save As`, async t => {
    const root = await sandbox(t); const copy = await sandbox(t);
    const items = [legacyRef('before'), { id: 'prompt', type: 'promptCard', body: 'Before', custom: 'keep' }, legacyRef('after')];
    const raw = { ...fixture(), ...legacyCards(), boostPack: { [sequence]: items } };
    await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness(); const active = await api.open(root);
    assert.equal(active.data.boostPack[sequence].length, 1);
    assert.equal(active.data.boostPack[sequence][0].bCardInstances.length, 2);
    active.data.boostPack[sequence][0].body = 'Edited prompt';
    api.select(copy);
    await api.call('project:save', active.data, 'saveAs', root);
    await api.call('project:save', active.data, 'save', copy);
    const saved = JSON.parse(await fs.readFile(path.join(copy, 'project.json'), 'utf8'));
    assert.deepEqual(saved.boostPack[sequence], [items[0], { ...items[1], body: 'Edited prompt' }, items[2]]);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8')), raw);
    const reopened = await api.open(copy);
    assert.deepEqual(jsonValue(reopened.data.boostPack[sequence]), jsonValue(active.data.boostPack[sequence]));
  });
}

test('legacy-only booster does not persist its synthetic runtime prompt', async t => {
  const root = await sandbox(t); const sequence = [legacyRef('one'), legacyRef('two')];
  const raw = { ...fixture(), ...legacyCards(), boostPack: { activationSequence: sequence } };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  assert.equal(active.data.boostPack.activationSequence[0].type, 'promptCard');
  await api.call('project:save', active.data, 'save', root);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.boostPack.activationSequence, sequence);
});

test('current A/B card edits, placements, additions and deletions save normally', async t => {
  const root = await sandbox(t);
  const instance = { id: 'placed', bCardId: 'card', position: { x: 30, y: 40 }, size: { width: 270, height: 390 }, zIndex: 1, displayMode: 'overlay' };
  const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', bCardInstances: [instance] }] };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  active.data.bCardLibrary.card.front.text = 'Edited content';
  active.data.aCardLibrary.board.name = 'Edited board';
  active.data.sections[0].bCardInstances[0].position.x = 75;
  active.data.sections[0].bCardInstances.push({ ...instance, id: 'new' });
  await api.call('project:save', active.data, 'save', root);
  let saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.sections[0].bCardInstances, jsonValue(active.data.sections[0].bCardInstances));
  assert.equal(saved.bCardLibrary.card.front.text, 'Edited content');
  assert.equal(saved.aCardLibrary.board.name, 'Edited board');
  active.data.sections[0].bCardInstances = [];
  await api.call('project:save', active.data, 'save', root);
  saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.sections[0].bCardInstances, []);
});

test('opening an unactivated candidate cannot replace the active legacy persistence baseline', async t => {
  const root = await sandbox(t); const other = path.join(root, 'other'); await fs.mkdir(other);
  const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [legacyRef('old')] }] };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  await fs.writeFile(path.join(other, 'project.json'), JSON.stringify(fixture()));
  const api = mainHarness(); const active = await api.open(root);
  await api.call('project:open-path', other);
  await api.call('project:save', active.data, 'save', root);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.sections[0].storyReferences, raw.sections[0].storyReferences);
});



test('legacy trailing booster cards keep their runtime host when another host is appended', async t => {
  const root = await sandbox(t);
  const raw = { ...fixture(), ...legacyCards(), boostPack: { activationSequence: [{ id: 'host', type: 'promptCard', body: 'First' }, legacyRef('tail')] } };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  active.data.boostPack.activationSequence.push({ id: 'new', type: 'promptCard', body: 'Second', bCardInstances: [] });
  await api.call('project:save', active.data, 'save', root);
  const reopened = await api.open(root);
  assert.deepEqual(jsonValue(reopened.data.boostPack.activationSequence), jsonValue(active.data.boostPack.activationSequence));
});

test('legacy baseline survives failed Save As and is replaced only on activation', async t => {
  const root = await sandbox(t); const copy = await sandbox(t); const other = await sandbox(t);
  const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [legacyRef('old')] }] };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  await fs.writeFile(path.join(other, 'project.json'), JSON.stringify({ ...fixture(), sections: [{ id: 'host', name: 'New project' }] }));
  const api = mainHarness(); const active = await api.open(root); api.select(copy);
  const originalLink = fs.link; fs.link = async () => { throw new Error('injected failure'); };
  try { await assert.rejects(api.call('project:save', active.data, 'saveAs', root), /injected failure/); }
  finally { fs.link = originalLink; }
  await api.call('project:save', active.data, 'save', root);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8')).sections[0].storyReferences, raw.sections[0].storyReferences);
  const next = await api.open(other);
  await api.call('project:save', next.data, 'save', other);
  const saved = JSON.parse(await fs.readFile(path.join(other, 'project.json'), 'utf8'));
  assert.equal(saved.sections[0].storyReferences, undefined);
  assert.equal(saved.sections[0].bCardInstances, undefined);
});

test('editing a legacy card definition preserves its untouched placements; explicit placement edits persist', async t => {
  const root = await sandbox(t);
  const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [legacyRef('old')] }] };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  active.data.bCardLibrary.card.front.text = 'Changed question';
  await api.call('project:save', active.data, 'save', root);
  let saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.sections[0].storyReferences, raw.sections[0].storyReferences);
  assert.equal(saved.bCardLibrary.card.front.text, 'Changed question');
  active.data.sections[0].bCardInstances[0].position.x = 60;
  await api.call('project:save', active.data, 'save', root);
  const reopened = await api.open(root);
  assert.equal(reopened.data.sections[0].bCardInstances.length, 1);
  assert.equal(reopened.data.sections[0].bCardInstances[0].position.x, 60);
  active.data.sections[0].bCardInstances = [];
  await api.call('project:save', active.data, 'save', root);
  saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.sections[0].bCardInstances, []);
  assert.deepEqual(saved.sections[0].storyReferences, []);
});

test('legacy references without IDs retain their authored syntax on an unrelated save', async t => {
  const root = await sandbox(t);
  const { id, ...ref } = legacyRef('unused');
  const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [ref] }], boostPack: { activationSequence: [ref] } };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  await api.call('project:save', active.data, 'save', root);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8'));
  assert.deepEqual(saved.sections[0].storyReferences, [ref]);
  assert.deepEqual(saved.boostPack.activationSequence, [ref]);
  assert.equal(saved.sections[0].bCardInstances, undefined);
});

test('current-format booster placements and ACard board contents accept edits', async t => {
  const root = await sandbox(t);
  const instance = { id: 'placed', bCardId: 'card', position: { x: 30, y: 40 }, size: { width: 270, height: 390 }, zIndex: 1, displayMode: 'overlay' };
  const raw = { ...fixture(), ...legacyCards(), boostPack: { activationSequence: [{ id: 'prompt', type: 'promptCard', body: 'Prompt', bCardInstances: [instance] }] } };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  active.data.boostPack.activationSequence[0].bCardInstances[0].size.width = 400;
  active.data.aCardLibrary.board.bCardInstances.push({ ...instance, id: 'board-instance' });
  await api.call('project:save', active.data, 'save', root);
  const reopened = await api.open(root);
  assert.equal(reopened.data.boostPack.activationSequence[0].bCardInstances[0].size.width, 400);
  assert.deepEqual(jsonValue(reopened.data.aCardLibrary.board.bCardInstances), jsonValue(active.data.aCardLibrary.board.bCardInstances));
});

const v2PersistenceFixture = () => ({
  engine: 'card-v2', version: 1,
  cards: { card: { id: 'card', label: 'Vocabulary', tags: ['episode-7'], style: { preset: 'classroom' }, faces: [{ id: 'image', label: 'Image', layout: 'image-only', imageAssetId: 'picture' }, { id: 'word', label: 'Word', layout: 'text', text: '猫 · gatto' }] } },
  sets: { set: { id: 'set', label: 'Words', tags: ['vocabulary'], entries: [{ id: 'entry', cardId: 'card' }] } },
  activities: { activity: { id: 'activity', type: 'recall-reveal', label: 'Recall', setId: 'set', frame: { width: 960, height: 720 }, allowCycling: true, allowDirectFace: true, circularCycling: false, instances: [{ id: 'instance', cardId: 'card', geometry: { x: 20, y: 30, width: 300, height: 240 }, initialFaceId: 'image', revealFaceId: 'word', initiallyConcealed: false }] } },
  placements: { placement: { id: 'placement', activityId: 'activity', label: 'Activation' } },
});
test('Card V2 authored module and explicit booster references survive save/reopen beside legacy cards', async t => {
  const root = await sandbox(t);
  const cardsV2 = v2PersistenceFixture();
  const ref = { id: 'v2-item', type: 'cardActivityRef', engine: 'card-v2', placementId: 'placement' };
  const raw = { ...fixture(), ...legacyCards(), cardsV2, boostPack: { activationSequence: [ref] } };
  await fs.writeFile(path.join(root, 'project.json'), JSON.stringify(raw));
  const api = mainHarness(); const active = await api.open(root);
  assert.deepEqual(jsonValue(active.data.boostPack.activationSequence[0]), ref);
  await api.call('project:save', active.data, 'save', root);
  const reopened = await api.open(root);
  assert.deepEqual(jsonValue(reopened.data.cardsV2), cardsV2);
  assert.deepEqual(jsonValue(reopened.data.aCardLibrary), raw.aCardLibrary);
});
for (const invalid of [{ ...v2PersistenceFixture(), version: 99 }, { ...v2PersistenceFixture(), engine: 'unknown' }]) {
  test(`unknown Card V2 discriminator fails safely (${invalid.engine}/${invalid.version})`, async t => {
    const root = await sandbox(t); const raw = JSON.stringify({ ...fixture(), cardsV2: invalid });
    await fs.writeFile(path.join(root, 'project.json'), raw);
    const api = mainHarness();
    await assert.rejects(api.open(root), /card|version|engine/i);
    assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), raw);
  });
}
test('invalid V2 saves are rejected without replacing disk data', async t => {
  const root = await sandbox(t); const raw = JSON.stringify(fixture());
  await fs.writeFile(path.join(root, 'project.json'), raw);
  const api = mainHarness(); const active = await api.open(root);
  await assert.rejects(api.call('project:save', { ...active.data, cardsV2: { ...v2PersistenceFixture(), version: 99 } }, 'save', root), /card|version/i);
  assert.equal(await fs.readFile(path.join(root, 'project.json'), 'utf8'), raw);
});
test('legacy open and unrelated save do not create Card V2 data', async t => {
  const root = await sandbox(t); await fs.writeFile(path.join(root, 'project.json'), JSON.stringify({ ...fixture(), ...legacyCards() }));
  const api = mainHarness(); const active = await api.open(root);
  assert.equal('cardsV2' in active.data, false);
  await api.call('project:save', active.data, 'save', root);
  assert.equal('cardsV2' in JSON.parse(await fs.readFile(path.join(root, 'project.json'), 'utf8')), false);
});
