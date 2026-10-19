"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const node_module_1 = require("node:module");
const node_crypto_1 = require("node:crypto");
const typescript_1 = __importDefault(require("typescript"));
const sectionMutations_1 = require("./sectionMutations");
const projectHistory_1 = require("./projectHistory");
const mediaImport_1 = require("./mediaImport");
const cardAuthoring_1 = require("./cardAuthoring");
const presentationSession_1 = require("./presentationSession");
// Exercise the real IPC handlers, replacing only Electron's window/dialog boundary.
function mainHarness() {
    const privateId = (0, node_crypto_1.randomUUID)();
    const handlers = new Map();
    let selection = null;
    const control = { mainFrame: {} };
    const electron = {
        app: { requestSingleInstanceLock: () => true, whenReady: () => ({ then() { } }), on() { }, getPath: () => node_path_1.default.join(node_os_1.default.tmpdir(), `story-persistence-harness-${privateId}`) },
        BrowserWindow: function () { },
        dialog: { showOpenDialog: async () => ({ canceled: !selection, filePaths: selection ? [selection] : [] }) },
        ipcMain: {
            handle: (name, fn) => handlers.set(name, fn),
            on: (name, fn) => handlers.set(name, (_, ...args) => {
                const event = { returnValue: undefined };
                fn(event, ...args);
                return event.returnValue;
            }),
        },
        protocol: { registerSchemesAsPrivileged() { } },
    };
    const cache = new Map();
    function load(filename) {
        if (cache.has(filename))
            return cache.get(filename);
        const module = { exports: {} };
        cache.set(filename, module.exports);
        const nativeRequire = (0, node_module_1.createRequire)(filename);
        let source = (0, node_fs_1.readFileSync)(filename, 'utf8');
        if (filename.endsWith(`${node_path_1.default.sep}main.ts`))
            source += '\nmainWindow = { webContents: __control } as unknown as BrowserWindow;';
        const js = typescript_1.default.transpileModule(source, { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
        node_vm_1.default.runInNewContext(js, {
            module, exports: module.exports, __dirname: node_path_1.default.dirname(filename), console, process, __control: control,
            require: (id) => id === 'electron' ? electron : id.startsWith('.') ? load(node_path_1.default.resolve(node_path_1.default.dirname(filename), `${id}.ts`)) : nativeRequire(id),
        }, { filename });
        return module.exports;
    }
    load(node_path_1.default.resolve('src/main/main.ts'));
    const call = (name, ...args) => handlers.get(name)({ sender: control, senderFrame: control.mainFrame }, ...args);
    return {
        call,
        untrusted: (name, ...args) => handlers.get(name)({ sender: {}, senderFrame: {} }, ...args),
        select: (folder) => { selection = folder; },
        open: async (folder) => {
            const candidate = await call('project:open-path', folder);
            if (candidate.activationToken)
                await call('project:activate', candidate.activationToken);
            return candidate;
        },
    };
}
const fixture = () => ({ version: 1, createdAt: '2020-01-01', updatedAt: '2020-01-01', slides: [], assets: [], sections: [] });
(0, node_test_1.default)('direct card host attachments and local appearance survive real save/reopen', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify({ ...fixture(), sections: [{ id: 'story', name: 'Story' }, { id: 'break', name: 'Break', type: 'break' }], slides: [{ id: 'slide', sectionId: 'story', assetId: 'image', transition: 'none' }], boostPack: { activationSequence: [{ id: 'prompt', type: 'promptCard', body: 'Question' }], languageSequence: [], gamesSequence: [] } }));
    const api = mainHarness(), active = await api.open(root);
    let data = active.data, serial = 0;
    const fresh = () => `persist-${++serial}`;
    const placements = [];
    for (const host of [{ kind: 'slide', id: 'slide' }, { kind: 'section', id: 'break' }, { kind: 'booster', id: 'prompt', tab: 'activation' }]) {
        const added = (0, cardAuthoring_1.addCardToHost)(data, host, fresh);
        data = added.data;
        placements.push(added.placementId);
        data.cardsV2.activities[data.cardsV2.placements[added.placementId].activityId].instances[0].style = { preset: 'dark', borderWidth: 4 };
    }
    await api.call('project:save', data, 'save', root);
    const reopened = await api.open(root);
    strict_1.default.equal(reopened.data.slides[0].cardPlacementId, placements[0]);
    strict_1.default.equal(reopened.data.sections.find((s) => s.id === 'break').cardPlacementId, placements[1]);
    strict_1.default.equal(reopened.data.boostPack.activationSequence[0].cardPlacementId, placements[2]);
    strict_1.default.deepEqual(jsonValue(reopened.data.cardsV2), jsonValue(data.cardsV2));
    strict_1.default.equal('session' in reopened.data.cardsV2, false);
});
(0, node_test_1.default)('pool bins and unused project assets survive the actual save/open pipeline', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(fixture()));
    const input = node_path_1.default.join(root, 'source.png');
    await node_fs_1.promises.writeFile(input, 'test image');
    const api = mainHarness();
    const active = await api.open(root);
    const imported = await api.call('project:import-dropped-media', [input]);
    const data = { ...active.data, mediaBins: [{ id: 'bin', name: 'Lesson media' }], assets: imported.importedAssets.map((asset) => ({ ...asset, binId: 'bin' })) };
    await api.call('project:save', data, 'save', root);
    const reopened = await api.open(root);
    strict_1.default.equal(reopened.data.mediaBins[0].name, 'Lesson media');
    strict_1.default.equal(reopened.data.assets[0].binId, 'bin');
    strict_1.default.equal(reopened.data.slides.length, 0);
    strict_1.default.equal('editSelection' in reopened.data, false);
    strict_1.default.match(reopened.data.assets[0].relativePath, /^assets\//);
});
(0, node_test_1.default)('asset copy pins the active folder and excludes Save As until completion', async (t) => {
    const root = await sandbox(t);
    const source = node_path_1.default.join(root, 'project');
    await node_fs_1.promises.mkdir(source);
    const image = node_path_1.default.join(root, 'image.png');
    await node_fs_1.promises.writeFile(image, 'image bytes');
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(source);
    const candidate = await api.call('project:open-path', source);
    let started;
    let release;
    const ready = new Promise(resolve => { started = resolve; });
    const waiting = new Promise(resolve => { release = resolve; });
    const originalCopy = node_fs_1.promises.copyFile;
    node_fs_1.promises.copyFile = async (...args) => { started(); await waiting; return originalCopy(...args); };
    const importing = api.call('project:import-dropped-media', [image]);
    try {
        await ready;
        strict_1.default.match(await api.call('project:activate', candidate.activationToken), /import/i);
        await strict_1.default.rejects(api.call('project:save', active.data, 'saveAs', source), /import/i);
    }
    finally {
        release();
        await importing;
        node_fs_1.promises.copyFile = originalCopy;
    }
    await api.call('project:save', active.data, 'save', source);
});
async function sandbox(t) {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'story-phase0-'));
    t.after(() => node_fs_1.promises.rm(root, { recursive: true, force: true }));
    return root;
}
for (const entry of ['project.json', 'notes.txt', '.hidden', 'assets']) {
    (0, node_test_1.default)(`New refuses a populated directory containing ${entry}`, async (t) => {
        const root = await sandbox(t);
        const target = node_path_1.default.join(root, entry);
        if (entry === 'assets')
            await node_fs_1.promises.mkdir(target);
        else
            await node_fs_1.promises.writeFile(target, 'existing content');
        const api = mainHarness();
        api.select(root);
        await strict_1.default.rejects(api.call('project:create'), /empty/i);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(root), [entry]);
        if (entry !== 'assets')
            strict_1.default.equal(await node_fs_1.promises.readFile(target, 'utf8'), 'existing content');
    });
}
for (const channel of ['project:open', 'project:open-path']) {
    (0, node_test_1.default)(`${channel}: invalid JSON cannot redirect a subsequent Save`, async (t) => {
        const root = await sandbox(t);
        const good = node_path_1.default.join(root, 'good');
        const bad = node_path_1.default.join(root, 'bad');
        await node_fs_1.promises.mkdir(good);
        await node_fs_1.promises.mkdir(bad);
        await node_fs_1.promises.writeFile(node_path_1.default.join(good, 'project.json'), JSON.stringify(fixture()));
        await node_fs_1.promises.writeFile(node_path_1.default.join(bad, 'project.json'), 'broken JSON');
        const api = mainHarness();
        const active = await api.open(good);
        api.select(bad);
        await strict_1.default.rejects(api.call(channel, bad));
        await api.call('project:save', { ...active.data, phase0Test: true }, 'save', good);
        strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(good, 'project.json'), 'utf8')).phase0Test, true);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(bad, 'project.json'), 'utf8'), 'broken JSON');
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(bad), ['project.json']);
    });
}
(0, node_test_1.default)('opening a candidate does not switch identity until renderer preparation succeeds', async (t) => {
    const root = await sandbox(t);
    const a = node_path_1.default.join(root, 'a');
    const b = node_path_1.default.join(root, 'b');
    await node_fs_1.promises.mkdir(a);
    await node_fs_1.promises.mkdir(b);
    for (const folder of [a, b])
        await node_fs_1.promises.writeFile(node_path_1.default.join(folder, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(a);
    await api.call('project:open-path', b); // Simulate renderer rejecting this candidate.
    await api.call('project:save', { ...active.data, keptA: true }, 'save', a);
    strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(a, 'project.json'), 'utf8')).keptA, true);
    strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(b, 'project.json'), 'utf8')).keptA, undefined);
});
(0, node_test_1.default)('save replacement failure preserves prior JSON and cleans only its own temporary file', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(fixture()));
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.tmp.json'), 'unrelated old temp');
    const api = mainHarness();
    const active = await api.open(root);
    const originalRename = node_fs_1.promises.rename;
    node_fs_1.promises.rename = async () => { throw new Error('disk unavailable'); };
    try {
        await strict_1.default.rejects(api.call('project:save', active.data, 'save', root), /disk unavailable/);
    }
    finally {
        node_fs_1.promises.rename = originalRename;
    }
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), JSON.stringify(fixture()));
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.tmp.json'), 'utf8'), 'unrelated old temp');
    strict_1.default.deepEqual((await node_fs_1.promises.readdir(root)).sort(), ['project.json', 'project.tmp.json']);
});
// Compile selected real renderer callbacks without mounting the media/audio UI.
// Dependencies remain explicit; deferred promises reproduce edits during IPC.
function rendererHarness(mode = 'edit') {
    const source = typescript_1.default.createSourceFile('App.tsx', (0, node_fs_1.readFileSync)('src/renderer/App.tsx', 'utf8'), typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    const names = ['setProject', 'setIsDirty', 'performSave', 'onSave', 'updateCurrentSlideMarkerStrokes', 'clearCurrentSlideDrawings', 'handleConfirmSave', 'onImportBubbleTemplate', 'updateSection', 'onRefreshApp', 'applyHistory', 'onImportMedia', 'applyImportedMedia'];
    const declarations = new Map();
    const visit = (node) => {
        if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isIdentifier(node.name) && names.includes(node.name.text)) {
            declarations.set(node.name.text, `const ${node.getText(source)};`);
        }
        typescript_1.default.forEachChild(node, visit);
    };
    visit(source);
    let current = { folderPath: 'A', data: { ...fixture(), slides: [{ id: 's1' }] }, lastSavedAt: 'old' };
    let dirty = true;
    let resolve = () => { };
    let reject = () => { };
    let calls = 0;
    let closes = 0;
    let error = null;
    let recoveryWrites = 0;
    let notifySave;
    const saveStarted = new Promise(resolve => { notifySave = resolve; });
    const projectRef = { current };
    const presentationRef = { current: (0, presentationSession_1.reducePresentationSession)((0, presentationSession_1.createPresentationSession)('test-session'), { type: 'project', projectId: 'test-project', slideId: 's1', sectionId: null }) };
    const dirtyRef = { current: dirty };
    const history = new projectHistory_1.ProjectHistory();
    history.reset(current.data, false);
    let completeImport;
    const ctx = {
        historyRef: { current: history }, gestureRef: { current: undefined }, textEditRef: { current: undefined },
        applyHistory() { },
        project: current, projectRef, dirtyRef, operationRef: { current: false },
        presentation: { ref: presentationRef }, selection: { ref: presentationRef }, applyPresentationDrawing: presentationSession_1.applyPresentationDrawing,
        activeTargetToken: (0, presentationSession_1.presentationToken)(presentationRef.current, (0, presentationSession_1.resolvePresentationTarget)(current.data, presentationRef.current)),
        appMode: mode, currentSlide: current.data.slides[0], currentIndex: 0,
        selectedSectionType: 'story', selectedSection: null,
        pendingAction: 'close', setPendingAction() { }, setShowConfirmModal() { },
        executePendingAction: () => { closes++; },
        ensureEditMode: (value) => value === 'edit',
        useCallback: (fn) => fn,
        renderProject: (value) => { current = value; },
        renderDirty: (value) => { dirty = value; },
        updateSectionInProjectData: sectionMutations_1.updateSectionInProjectData,
        setContextMenu() { }, setPendingSectionDeleteId() { },
        setCurrentIndex() { }, setPreviousIndex() { }, setActiveOverlayId() { }, setSelectedStoryRefId() { },
        setSelectedSlideIds() { }, setSelectedSectionId() { }, setExpandedSectionId() { }, setSelectedACardId() { }, setSelectedBadgeSpriteId() { },
        selectedSectionId: null, applyMediaImportToProjectData: mediaImport_1.applyMediaImportToProjectData,
        persistLiveSessionSnapshot: () => { recoveryWrites++; },
        LIVE_SESSION_AUTO_RESTORE_KEY: 'restore', isDirty: true,
        setIsSaveInProgress() { }, setShowSaveChoiceModal() { }, setDrawClearSignal() { },
        setError: (value) => { error = value; }, showToast() { },
        window: {
            localStorage: { setItem() { } },
            api: { importBubbleTemplate: async () => ({ success: true, relativePath: 'assets/bubbles/example.png' }) },
            appApi: {
                importMedia: () => new Promise(resolve => { completeImport = resolve; }),
                saveProject: () => { calls++; notifySave(); return new Promise((yes, no) => { resolve = yes; reject = no; }); },
            },
        },
    };
    node_vm_1.default.createContext(ctx);
    const js = typescript_1.default.transpileModule([...declarations.values()].join('\n') + `\nglobalThis.callbacks = { ${names.join(',')} };`, { compilerOptions: { target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInContext(js, ctx);
    return {
        ...ctx.callbacks,
        saveStarted,
        finishImport: () => completeImport({ importedAssets: [{ id: 'asset', originalName: 'test.png', filename: 'test.png', mediaType: 'image', relativePath: 'assets/test.png' }], createdSlides: [{ id: 'imported', assetId: 'asset' }] }),
        edit: () => { ctx.callbacks.setProject({ ...current, data: { ...current.data, newer: true } }); ctx.callbacks.setIsDirty(true); },
        resolve: (folderPath = 'A') => resolve({ folderPath, lastSavedAt: 'saved' }),
        cancel: () => resolve(null), fail: () => reject(new Error('Disk full: free space and retry')),
        selectBreak: () => {
            ctx.callbacks.setProject({ ...current, data: { ...current.data, sections: [{ id: 'break', type: 'break', markerStrokes: [{ id: 'old' }] }] } });
            ctx.selectedSectionType = 'break';
            ctx.selectedSection = current.data.sections[0];
            presentationRef.current = (0, presentationSession_1.reducePresentationSession)(presentationRef.current, { type: 'select', changes: { sectionId: 'break' } });
            ctx.activeTargetToken = (0, presentationSession_1.presentationToken)(presentationRef.current, (0, presentationSession_1.resolvePresentationTarget)(current.data, presentationRef.current));
        },
        state: () => ({ current, dirty, calls, closes, error, recoveryWrites }),
    };
}
(0, node_test_1.default)('save completion preserves newer edits and does not authorize close', async () => {
    const ui = rendererHarness();
    const saving = ui.handleConfirmSave();
    ui.edit();
    ui.resolve();
    await saving;
    strict_1.default.equal(ui.state().current.data.newer, true);
    strict_1.default.equal(ui.state().dirty, true);
    strict_1.default.equal(ui.state().closes, 0);
});
(0, node_test_1.default)('Teach-mode close saves permitted persistent changes', async () => {
    const ui = rendererHarness('teach');
    const saving = ui.handleConfirmSave();
    strict_1.default.equal(ui.state().calls, 1);
    ui.resolve();
    await saving;
    strict_1.default.equal(ui.state().dirty, false);
    strict_1.default.equal(ui.state().closes, 1);
});
(0, node_test_1.default)('save failure keeps memory and dirty state and reports the error', async () => {
    const ui = rendererHarness();
    const before = ui.state().current;
    const saving = ui.performSave('save');
    ui.fail();
    strict_1.default.equal(await saving, false);
    strict_1.default.equal(ui.state().current, before);
    strict_1.default.equal(ui.state().dirty, true);
    strict_1.default.match(ui.state().error, /Disk full/);
});
(0, node_test_1.default)('overlapping saves cannot race their disk writes', async () => {
    const ui = rendererHarness();
    const saving = ui.performSave('save');
    const duplicate = ui.performSave('save');
    strict_1.default.equal(ui.state().calls, 1);
    ui.resolve();
    await saving;
    await duplicate;
});
(0, node_test_1.default)('Save As moves the identity but retains edits made during the write', async () => {
    const ui = rendererHarness();
    const saving = ui.performSave('saveAs');
    ui.edit();
    ui.resolve('B');
    await saving;
    strict_1.default.equal(ui.state().current.folderPath, 'B');
    strict_1.default.equal(ui.state().current.data.newer, true);
    strict_1.default.equal(ui.state().dirty, true);
});
(0, node_test_1.default)('persistent marker addition and clear both dirty a saved project', async () => {
    const ui = rendererHarness();
    const firstSave = ui.performSave('save');
    ui.resolve();
    await firstSave;
    ui.updateCurrentSlideMarkerStrokes([{ id: 'marker', points: [1, 2] }]);
    strict_1.default.equal(ui.state().dirty, true);
    const secondSave = ui.performSave('save');
    ui.resolve();
    await secondSave;
    ui.clearCurrentSlideDrawings();
    strict_1.default.equal(ui.state().dirty, true);
    strict_1.default.equal(ui.state().current.data.slides[0].markerStrokes.length, 0);
});
(0, node_test_1.default)('clearing only transient drawing leaves the saved project clean', async () => {
    const ui = rendererHarness();
    const saving = ui.performSave('save');
    ui.resolve();
    await saving;
    ui.clearCurrentSlideDrawings();
    strict_1.default.equal(ui.state().dirty, false);
});
(0, node_test_1.default)('Save As cancellation preserves project identity and unsaved changes', async () => {
    const ui = rendererHarness();
    const before = ui.state().current;
    const saving = ui.performSave('saveAs');
    ui.cancel();
    strict_1.default.equal(await saving, false);
    strict_1.default.equal(ui.state().current, before);
    strict_1.default.equal(ui.state().dirty, true);
    const retry = ui.performSave('save');
    ui.resolve();
    strict_1.default.equal(await retry, true);
});
(0, node_test_1.default)('New creates a usable project and never persists the activation token', async (t) => {
    const root = await sandbox(t);
    const api = mainHarness();
    api.select(root);
    const candidate = await api.call('project:create');
    strict_1.default.equal(await api.call('project:activate', candidate.activationToken), null);
    await api.call('project:save', candidate.data, 'save', root);
    const data = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.equal(data.version, 4);
    strict_1.default.equal(data.activationToken, undefined);
    strict_1.default.deepEqual((await node_fs_1.promises.readdir(root)).sort(), ['assets', 'project.json']);
});
(0, node_test_1.default)('failed New publication leaves no valid project or owned staging files', async (t) => {
    const root = await sandbox(t);
    const api = mainHarness();
    api.select(root);
    const originalLink = node_fs_1.promises.link;
    node_fs_1.promises.link = async () => { throw new Error('publication denied'); };
    try {
        await strict_1.default.rejects(api.call('project:create'), /publication denied/);
    }
    finally {
        node_fs_1.promises.link = originalLink;
    }
    strict_1.default.deepEqual(await node_fs_1.promises.readdir(root), []);
});
(0, node_test_1.default)('a project.json created during New is never replaced or deleted', async (t) => {
    const root = await sandbox(t);
    const api = mainHarness();
    api.select(root);
    const originalLink = node_fs_1.promises.link;
    node_fs_1.promises.link = async (from, to) => {
        await node_fs_1.promises.writeFile(to, 'concurrent user file');
        await originalLink(from, to);
    };
    try {
        await strict_1.default.rejects(api.call('project:create'), /EEXIST/);
    }
    finally {
        node_fs_1.promises.link = originalLink;
    }
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), 'concurrent user file');
    strict_1.default.deepEqual(await node_fs_1.promises.readdir(root), ['project.json']);
});
(0, node_test_1.default)('structurally invalid or unnormalizable candidates cannot replace the active project', async (t) => {
    const root = await sandbox(t);
    const bad = node_path_1.default.join(root, 'bad');
    await node_fs_1.promises.mkdir(bad);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(root);
    for (const broken of [null, [], {}, { ...fixture(), sections: [null] }]) {
        await node_fs_1.promises.writeFile(node_path_1.default.join(bad, 'project.json'), JSON.stringify(broken));
        await strict_1.default.rejects(api.call('project:open-path', bad));
        await api.call('project:save', active.data, 'save', root);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(bad, 'project.json'), 'utf8'), JSON.stringify(broken));
    }
});
(0, node_test_1.default)('Save rejects a renderer document belonging to a different folder', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(root);
    await strict_1.default.rejects(api.call('project:save', active.data, 'save', 'wrong-folder'), /changed/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), JSON.stringify(fixture()));
});
(0, node_test_1.default)('failed Save As does not publish copied stale JSON or redirect the original identity', async (t) => {
    const root = await sandbox(t);
    const target = node_path_1.default.join(root, 'copy');
    const source = node_path_1.default.join(root, 'source');
    await node_fs_1.promises.mkdir(target);
    await node_fs_1.promises.mkdir(source);
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(source);
    api.select(target);
    const originalLink = node_fs_1.promises.link;
    node_fs_1.promises.link = async () => { throw new Error('publication denied'); };
    try {
        await strict_1.default.rejects(api.call('project:save', active.data, 'saveAs', source), /publication denied/);
    }
    finally {
        node_fs_1.promises.link = originalLink;
    }
    strict_1.default.deepEqual(await node_fs_1.promises.readdir(target), []);
    await api.call('project:save', active.data, 'save', source);
});
(0, node_test_1.default)('main process rejects overlapping writes and identity commits while saving', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(root);
    const candidate = await api.call('project:open-path', root);
    const originalRename = node_fs_1.promises.rename;
    let release;
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    node_fs_1.promises.rename = async (from, to) => { started(); await wait; await originalRename(from, to); };
    const saving = api.call('project:save', active.data, 'save', root);
    try {
        await ready;
        strict_1.default.match(await api.call('project:activate', candidate.activationToken), /saving/i);
        await strict_1.default.rejects(api.call('project:save', active.data, 'save', root), /saving/i);
    }
    finally {
        release();
        await saving;
        node_fs_1.promises.rename = originalRename;
    }
});
(0, node_test_1.default)('bubble import autosave keeps edits made while it is writing', async () => {
    const ui = rendererHarness();
    const importing = ui.onImportBubbleTemplate();
    await ui.saveStarted;
    strict_1.default.equal(ui.state().calls, 1);
    ui.edit();
    ui.resolve();
    await importing;
    strict_1.default.equal(ui.state().dirty, true);
    strict_1.default.equal(ui.state().current.data.newer, true);
    strict_1.default.equal(ui.state().current.data.bubbleDefinitions.length, 1);
});
(0, node_test_1.default)('break marker addition and clear participate in dirty state', async () => {
    const ui = rendererHarness();
    ui.selectBreak();
    const saving = ui.performSave('save');
    ui.resolve();
    await saving;
    ui.updateSection('break', { markerStrokes: [{ id: 'new' }] });
    strict_1.default.equal(ui.state().dirty, true);
    const savingAgain = ui.performSave('save');
    ui.resolve();
    await savingAgain;
    ui.clearCurrentSlideDrawings();
    strict_1.default.equal(ui.state().dirty, true);
    strict_1.default.equal(ui.state().current.data.sections[0].markerStrokes.length, 0);
});
(0, node_test_1.default)('refresh cannot change recovery state while a save is pending', async () => {
    const ui = rendererHarness();
    const saving = ui.performSave('save');
    await ui.onRefreshApp();
    ui.resolve();
    await saving;
    strict_1.default.equal(ui.state().recoveryWrites, 0);
});
(0, node_test_1.default)('undo and redo cross the savepoint without changing the Save As folder', async () => {
    const ui = rendererHarness();
    const saving = ui.performSave('save');
    ui.resolve();
    await saving;
    ui.edit();
    const copying = ui.performSave('saveAs');
    ui.resolve('B');
    await copying;
    ui.applyHistory('undo');
    strict_1.default.equal(ui.state().current.folderPath, 'B');
    strict_1.default.equal(ui.state().current.data.newer, undefined);
    strict_1.default.equal(ui.state().dirty, true);
    ui.applyHistory('redo');
    strict_1.default.equal(ui.state().current.data.newer, true);
    strict_1.default.equal(ui.state().dirty, false);
});
(0, node_test_1.default)('undo while saving leaves the written revision as the redo savepoint', async () => {
    const ui = rendererHarness();
    ui.edit();
    const saving = ui.performSave('save');
    ui.applyHistory('undo');
    ui.resolve();
    await saving;
    strict_1.default.equal(ui.state().current.data.newer, undefined);
    strict_1.default.equal(ui.state().dirty, true);
    ui.applyHistory('redo');
    strict_1.default.equal(ui.state().dirty, false);
});
(0, node_test_1.default)('pending media import preserves newer edits and blocks Save As until completion', async () => {
    const ui = rendererHarness();
    const importing = ui.onImportMedia();
    ui.edit();
    const copying = ui.performSave('saveAs');
    const callsBeforeImportFinished = ui.state().calls;
    ui.finishImport();
    await importing;
    if (callsBeforeImportFinished)
        ui.resolve('B');
    await copying;
    strict_1.default.equal(callsBeforeImportFinished, 0);
    strict_1.default.equal(ui.state().current.data.newer, true);
    strict_1.default.equal(ui.state().current.folderPath, 'A');
    strict_1.default.equal(ui.state().current.data.slides.at(-1).id, 'imported');
});
(0, node_test_1.default)('legacy project opens read-only and preserves markers and unknown fields when explicitly saved', async (t) => {
    const root = await sandbox(t);
    const marker = { id: 'm', color: '#fff', size: 12, opacity: 1, rainbow: false, points: [{ x: 0, y: 0, t: 1 }, { x: 1, y: 1, t: 2 }] };
    const legacy = { ...fixture(), customLessonMetadata: { keep: true },
        slides: [{ id: 'slide', assetId: 'asset', transition: 'fade', markerStrokes: [marker] }],
        assets: [{ id: 'asset', mediaType: 'image', relativePath: 'assets/legacy.png' }],
        sections: [{ id: 'section', name: 'Break', type: 'break', markerStrokes: [marker] }],
    };
    const bytes = JSON.stringify(legacy);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), bytes);
    const api = mainHarness();
    const active = await api.open(root);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), bytes);
    strict_1.default.deepEqual(await node_fs_1.promises.readdir(root), ['project.json']);
    await api.call('project:save', active.data, 'save', root);
    const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.slides[0].markerStrokes, [marker]);
    strict_1.default.deepEqual(saved.sections[0].markerStrokes, [marker]);
    strict_1.default.deepEqual(saved.customLessonMetadata, { keep: true });
    strict_1.default.equal(saved.assets[0].relativePath, 'assets/legacy.png');
});
for (const failedOperation of ['writeFile', 'sync']) {
    (0, node_test_1.default)(`Save ${failedOperation} failure preserves source JSON, identity, and retry`, async (t) => {
        const root = await sandbox(t);
        const originalBytes = JSON.stringify(fixture());
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), originalBytes);
        const api = mainHarness();
        const active = await api.open(root);
        const originalOpen = node_fs_1.promises.open;
        node_fs_1.promises.open = async (...args) => {
            const file = await originalOpen(...args);
            if (node_path_1.default.dirname(String(args[0])) === root && node_path_1.default.basename(String(args[0])).startsWith('.project-')) {
                const originalWrite = file.writeFile.bind(file);
                if (failedOperation === 'writeFile') {
                    file.writeFile = async () => {
                        await originalWrite('partial staging bytes', 'utf8');
                        throw new Error('injected staging write failure');
                    };
                }
                else {
                    file.sync = async () => { throw new Error('injected staging sync failure'); };
                }
            }
            return file;
        };
        try {
            await strict_1.default.rejects(api.call('project:save', { ...active.data, failedRevision: true }, 'save', root), /injected staging/);
        }
        finally {
            node_fs_1.promises.open = originalOpen;
        }
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), originalBytes);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(root), ['project.json']);
        await api.call('project:save', { ...active.data, successfulRetry: true }, 'save', root);
        const retried = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
        strict_1.default.equal(retried.successfulRetry, true);
        strict_1.default.equal(retried.failedRevision, undefined);
    });
}
(0, node_test_1.default)('Save As copies nested asset bytes and makes subsequent Save target the copy', async (t) => {
    const root = await sandbox(t);
    const source = node_path_1.default.join(root, 'source');
    const target = node_path_1.default.join(root, 'copy');
    await node_fs_1.promises.mkdir(node_path_1.default.join(source, 'assets', 'nested'), { recursive: true });
    await node_fs_1.promises.mkdir(target);
    const originalBytes = JSON.stringify(fixture());
    const mediaBytes = Buffer.from([0, 255, 1, 128, 10, 13, 0, 42]);
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), originalBytes);
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'assets', 'nested', 'sample.bin'), mediaBytes);
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'assets', 'notes.txt'), 'nested asset companion');
    const api = mainHarness();
    const active = await api.open(source);
    api.select(target);
    const response = await api.call('project:save', { ...active.data, copiedRevision: true }, 'saveAs', source);
    strict_1.default.equal(response.folderPath, target);
    strict_1.default.deepEqual(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'assets', 'nested', 'sample.bin')), mediaBytes);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'assets', 'notes.txt'), 'utf8'), 'nested asset companion');
    strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'project.json'), 'utf8')).copiedRevision, true);
    await api.call('project:save', { ...active.data, nextRevision: true }, 'save', target);
    strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'project.json'), 'utf8')).nextRevision, true);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8'), originalBytes);
    strict_1.default.deepEqual(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'assets', 'nested', 'sample.bin')), mediaBytes);
    await strict_1.default.rejects(api.call('project:save', active.data, 'save', source), /changed/i);
});
(0, node_test_1.default)('Save As copy failure preserves source bytes and identity without publishing target JSON', async (t) => {
    const root = await sandbox(t);
    const source = node_path_1.default.join(root, 'source');
    const target = node_path_1.default.join(root, 'copy');
    const sourceAssets = node_path_1.default.join(source, 'assets');
    await node_fs_1.promises.mkdir(node_path_1.default.join(sourceAssets, 'nested'), { recursive: true });
    await node_fs_1.promises.mkdir(target);
    const originalBytes = JSON.stringify(fixture());
    const assetBytes = Buffer.from([7, 0, 255, 99]);
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), originalBytes);
    await node_fs_1.promises.writeFile(node_path_1.default.join(sourceAssets, 'nested', 'sample.bin'), assetBytes);
    const api = mainHarness();
    const active = await api.open(source);
    api.select(target);
    const originalCopy = node_fs_1.promises.cp;
    node_fs_1.promises.cp = async (...args) => {
        await originalCopy(...args);
        if (String(args[0]) === sourceAssets)
            throw new Error('injected copy failure after asset copy');
    };
    try {
        await strict_1.default.rejects(api.call('project:save', { ...active.data, failedCopy: true }, 'saveAs', source), /injected copy failure/);
    }
    finally {
        node_fs_1.promises.cp = originalCopy;
    }
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8'), originalBytes);
    strict_1.default.deepEqual(await node_fs_1.promises.readFile(node_path_1.default.join(sourceAssets, 'nested', 'sample.bin')), assetBytes);
    await strict_1.default.rejects(node_fs_1.promises.access(node_path_1.default.join(target, 'project.json')), { code: 'ENOENT' });
    await api.call('project:save', { ...active.data, originalStillActive: true }, 'save', source);
    strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8')).originalStillActive, true);
    await strict_1.default.rejects(node_fs_1.promises.access(node_path_1.default.join(target, 'project.json')), { code: 'ENOENT' });
});
for (const channel of ['project:create', 'project:open']) {
    (0, node_test_1.default)(`${channel} cancellation preserves original identity and source bytes`, async (t) => {
        const root = await sandbox(t);
        const originalBytes = JSON.stringify(fixture());
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), originalBytes);
        const api = mainHarness();
        const active = await api.open(root);
        api.select(null);
        strict_1.default.equal(await api.call(channel), null);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), originalBytes);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(root), ['project.json']);
        await api.call('project:save', { ...active.data, savedAfterCancellation: true }, 'save', root);
        strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8')).savedAfterCancellation, true);
    });
}
// Legacy authored syntax must survive runtime compatibility normalization.
const legacyRef = (id) => ({ id, type: 'bCardRef', bCardId: 'card', position: { x: 100, y: 120 }, extraLegacyField: 'keep' });
const legacyCards = () => ({
    aCardLibrary: { board: { id: 'board', name: 'Board', stageMode: 'full', background: { offsetX: 0, offsetY: 0, scale: 1, blur: 0 }, bCardInstances: [] } },
    bCardLibrary: { card: { id: 'card', name: 'Card', front: { text: 'Question' }, back: { text: 'Answer' } } },
});
const jsonValue = (value) => JSON.parse(JSON.stringify(value));
for (const hostType of ['sections', 'slides']) {
    (0, node_test_1.default)(`untouched legacy ${hostType} refs retain authored syntax after unrelated edits and repeated saves`, async (t) => {
        const root = await sandbox(t);
        const refs = [legacyRef('old'), { id: 'board-ref', type: 'aCardRef', aCardId: 'board', custom: 'keep' }];
        const raw = { ...fixture(), ...legacyCards(), [hostType]: [{ id: 'host', name: 'Before', storyReferences: refs }] };
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
        const api = mainHarness();
        const active = await api.open(root);
        strict_1.default.equal(active.data[hostType][0].bCardInstances[0].bCardId, 'card');
        active.data[hostType][0].name = 'Edited host name';
        for (let i = 0; i < 2; i++) {
            await api.call('project:save', active.data, 'save', root);
            const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
            strict_1.default.deepEqual(saved[hostType][0].storyReferences, refs);
            strict_1.default.equal(Object.prototype.hasOwnProperty.call(saved[hostType][0], 'bCardInstances'), false);
            strict_1.default.equal(saved[hostType][0].name, 'Edited host name');
        }
        const reopened = await api.open(root);
        strict_1.default.deepEqual(jsonValue(reopened.data[hostType][0].bCardInstances), jsonValue(active.data[hostType][0].bCardInstances));
    });
}
for (const sequence of ['activationSequence', 'languageSequence', 'gamesSequence']) {
    (0, node_test_1.default)(`legacy ${sequence} refs survive host text edits and Save As`, async (t) => {
        const root = await sandbox(t);
        const copy = await sandbox(t);
        const items = [legacyRef('before'), { id: 'prompt', type: 'promptCard', body: 'Before', custom: 'keep' }, legacyRef('after')];
        const raw = { ...fixture(), ...legacyCards(), boostPack: { [sequence]: items } };
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
        const api = mainHarness();
        const active = await api.open(root);
        strict_1.default.equal(active.data.boostPack[sequence].length, 1);
        strict_1.default.equal(active.data.boostPack[sequence][0].bCardInstances.length, 2);
        active.data.boostPack[sequence][0].body = 'Edited prompt';
        api.select(copy);
        await api.call('project:save', active.data, 'saveAs', root);
        await api.call('project:save', active.data, 'save', copy);
        const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(copy, 'project.json'), 'utf8'));
        strict_1.default.deepEqual(saved.boostPack[sequence], [items[0], { ...items[1], body: 'Edited prompt' }, items[2]]);
        strict_1.default.deepEqual(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8')), raw);
        const reopened = await api.open(copy);
        strict_1.default.deepEqual(jsonValue(reopened.data.boostPack[sequence]), jsonValue(active.data.boostPack[sequence]));
    });
}
(0, node_test_1.default)('legacy-only booster does not persist its synthetic runtime prompt', async (t) => {
    const root = await sandbox(t);
    const sequence = [legacyRef('one'), legacyRef('two')];
    const raw = { ...fixture(), ...legacyCards(), boostPack: { activationSequence: sequence } };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    strict_1.default.equal(active.data.boostPack.activationSequence[0].type, 'promptCard');
    await api.call('project:save', active.data, 'save', root);
    const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.boostPack.activationSequence, sequence);
});
(0, node_test_1.default)('current A/B card edits, placements, additions and deletions save normally', async (t) => {
    const root = await sandbox(t);
    const instance = { id: 'placed', bCardId: 'card', position: { x: 30, y: 40 }, size: { width: 270, height: 390 }, zIndex: 1, displayMode: 'overlay' };
    const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', bCardInstances: [instance] }] };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    active.data.bCardLibrary.card.front.text = 'Edited content';
    active.data.aCardLibrary.board.name = 'Edited board';
    active.data.sections[0].bCardInstances[0].position.x = 75;
    active.data.sections[0].bCardInstances.push({ ...instance, id: 'new' });
    await api.call('project:save', active.data, 'save', root);
    let saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.sections[0].bCardInstances, jsonValue(active.data.sections[0].bCardInstances));
    strict_1.default.equal(saved.bCardLibrary.card.front.text, 'Edited content');
    strict_1.default.equal(saved.aCardLibrary.board.name, 'Edited board');
    active.data.sections[0].bCardInstances = [];
    await api.call('project:save', active.data, 'save', root);
    saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.sections[0].bCardInstances, []);
});
(0, node_test_1.default)('opening an unactivated candidate cannot replace the active legacy persistence baseline', async (t) => {
    const root = await sandbox(t);
    const other = node_path_1.default.join(root, 'other');
    await node_fs_1.promises.mkdir(other);
    const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [legacyRef('old')] }] };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    await node_fs_1.promises.writeFile(node_path_1.default.join(other, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    const active = await api.open(root);
    await api.call('project:open-path', other);
    await api.call('project:save', active.data, 'save', root);
    const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.sections[0].storyReferences, raw.sections[0].storyReferences);
});
(0, node_test_1.default)('legacy trailing booster cards keep their runtime host when another host is appended', async (t) => {
    const root = await sandbox(t);
    const raw = { ...fixture(), ...legacyCards(), boostPack: { activationSequence: [{ id: 'host', type: 'promptCard', body: 'First' }, legacyRef('tail')] } };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    active.data.boostPack.activationSequence.push({ id: 'new', type: 'promptCard', body: 'Second', bCardInstances: [] });
    await api.call('project:save', active.data, 'save', root);
    const reopened = await api.open(root);
    strict_1.default.deepEqual(jsonValue(reopened.data.boostPack.activationSequence), jsonValue(active.data.boostPack.activationSequence));
});
(0, node_test_1.default)('legacy baseline survives failed Save As and is replaced only on activation', async (t) => {
    const root = await sandbox(t);
    const copy = await sandbox(t);
    const other = await sandbox(t);
    const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [legacyRef('old')] }] };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    await node_fs_1.promises.writeFile(node_path_1.default.join(other, 'project.json'), JSON.stringify({ ...fixture(), sections: [{ id: 'host', name: 'New project' }] }));
    const api = mainHarness();
    const active = await api.open(root);
    api.select(copy);
    const originalLink = node_fs_1.promises.link;
    node_fs_1.promises.link = async () => { throw new Error('injected failure'); };
    try {
        await strict_1.default.rejects(api.call('project:save', active.data, 'saveAs', root), /injected failure/);
    }
    finally {
        node_fs_1.promises.link = originalLink;
    }
    await api.call('project:save', active.data, 'save', root);
    strict_1.default.deepEqual(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8')).sections[0].storyReferences, raw.sections[0].storyReferences);
    const next = await api.open(other);
    await api.call('project:save', next.data, 'save', other);
    const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(other, 'project.json'), 'utf8'));
    strict_1.default.equal(saved.sections[0].storyReferences, undefined);
    strict_1.default.equal(saved.sections[0].bCardInstances, undefined);
});
(0, node_test_1.default)('editing a legacy card definition preserves its untouched placements; explicit placement edits persist', async (t) => {
    const root = await sandbox(t);
    const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [legacyRef('old')] }] };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    active.data.bCardLibrary.card.front.text = 'Changed question';
    await api.call('project:save', active.data, 'save', root);
    let saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.sections[0].storyReferences, raw.sections[0].storyReferences);
    strict_1.default.equal(saved.bCardLibrary.card.front.text, 'Changed question');
    active.data.sections[0].bCardInstances[0].position.x = 60;
    await api.call('project:save', active.data, 'save', root);
    const reopened = await api.open(root);
    strict_1.default.equal(reopened.data.sections[0].bCardInstances.length, 1);
    strict_1.default.equal(reopened.data.sections[0].bCardInstances[0].position.x, 60);
    active.data.sections[0].bCardInstances = [];
    await api.call('project:save', active.data, 'save', root);
    saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.sections[0].bCardInstances, []);
    strict_1.default.deepEqual(saved.sections[0].storyReferences, []);
});
(0, node_test_1.default)('legacy references without IDs retain their authored syntax on an unrelated save', async (t) => {
    const root = await sandbox(t);
    const { id, ...ref } = legacyRef('unused');
    const raw = { ...fixture(), ...legacyCards(), sections: [{ id: 'host', storyReferences: [ref] }], boostPack: { activationSequence: [ref] } };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    await api.call('project:save', active.data, 'save', root);
    const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'));
    strict_1.default.deepEqual(saved.sections[0].storyReferences, [ref]);
    strict_1.default.deepEqual(saved.boostPack.activationSequence, [ref]);
    strict_1.default.equal(saved.sections[0].bCardInstances, undefined);
});
(0, node_test_1.default)('current-format booster placements and ACard board contents accept edits', async (t) => {
    const root = await sandbox(t);
    const instance = { id: 'placed', bCardId: 'card', position: { x: 30, y: 40 }, size: { width: 270, height: 390 }, zIndex: 1, displayMode: 'overlay' };
    const raw = { ...fixture(), ...legacyCards(), boostPack: { activationSequence: [{ id: 'prompt', type: 'promptCard', body: 'Prompt', bCardInstances: [instance] }] } };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    active.data.boostPack.activationSequence[0].bCardInstances[0].size.width = 400;
    active.data.aCardLibrary.board.bCardInstances.push({ ...instance, id: 'board-instance' });
    await api.call('project:save', active.data, 'save', root);
    const reopened = await api.open(root);
    strict_1.default.equal(reopened.data.boostPack.activationSequence[0].bCardInstances[0].size.width, 400);
    strict_1.default.deepEqual(jsonValue(reopened.data.aCardLibrary.board.bCardInstances), jsonValue(active.data.aCardLibrary.board.bCardInstances));
});
const v2PersistenceFixture = () => ({
    engine: 'card-v2', version: 1,
    cards: { card: { id: 'card', label: 'Vocabulary', tags: ['episode-7'], style: { preset: 'classroom' }, faces: [{ id: 'image', label: 'Image', layout: 'image-only', imageAssetId: 'picture' }, { id: 'word', label: 'Word', layout: 'text', text: '猫 · gatto' }] } },
    sets: { set: { id: 'set', label: 'Words', tags: ['vocabulary'], entries: [{ id: 'entry', cardId: 'card' }] } },
    activities: { activity: { id: 'activity', type: 'recall-reveal', label: 'Recall', setId: 'set', frame: { width: 960, height: 720 }, allowCycling: true, allowDirectFace: true, circularCycling: false, instances: [{ id: 'instance', cardId: 'card', geometry: { x: 20, y: 30, width: 300, height: 240 }, initialFaceId: 'image', revealFaceId: 'word', initiallyConcealed: false }] } },
    placements: { placement: { id: 'placement', activityId: 'activity', label: 'Activation' } },
});
(0, node_test_1.default)('Card V2 authored module and explicit booster references survive save/reopen beside legacy cards', async (t) => {
    const root = await sandbox(t);
    const cardsV2 = v2PersistenceFixture();
    const ref = { id: 'v2-item', type: 'cardActivityRef', engine: 'card-v2', placementId: 'placement' };
    const raw = { ...fixture(), ...legacyCards(), cardsV2, boostPack: { activationSequence: [ref] } };
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(raw));
    const api = mainHarness();
    const active = await api.open(root);
    strict_1.default.deepEqual(jsonValue(active.data.boostPack.activationSequence[0]), ref);
    await api.call('project:save', active.data, 'save', root);
    const reopened = await api.open(root);
    strict_1.default.deepEqual(jsonValue(reopened.data.cardsV2), cardsV2);
    strict_1.default.deepEqual(jsonValue(reopened.data.aCardLibrary), raw.aCardLibrary);
});
for (const invalid of [{ ...v2PersistenceFixture(), version: 99 }, { ...v2PersistenceFixture(), engine: 'unknown' }]) {
    (0, node_test_1.default)(`unknown Card V2 discriminator fails safely (${invalid.engine}/${invalid.version})`, async (t) => {
        const root = await sandbox(t);
        const raw = JSON.stringify({ ...fixture(), cardsV2: invalid });
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), raw);
        const api = mainHarness();
        await strict_1.default.rejects(api.open(root), /card|version|engine/i);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), raw);
    });
}
(0, node_test_1.default)('invalid V2 saves are rejected without replacing disk data', async (t) => {
    const root = await sandbox(t);
    const raw = JSON.stringify(fixture());
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), raw);
    const api = mainHarness();
    const active = await api.open(root);
    await strict_1.default.rejects(api.call('project:save', { ...active.data, cardsV2: { ...v2PersistenceFixture(), version: 99 } }, 'save', root), /card|version/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), raw);
});
(0, node_test_1.default)('legacy open and unrelated save do not create Card V2 data', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify({ ...fixture(), ...legacyCards() }));
    const api = mainHarness();
    const active = await api.open(root);
    strict_1.default.equal('cardsV2' in active.data, false);
    await api.call('project:save', active.data, 'save', root);
    strict_1.default.equal('cardsV2' in JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8')), false);
});
(0, node_test_1.default)('media registry and imports reject non-Control senders', async () => {
    const api = mainHarness();
    for (const channel of ['media-registry:lease', 'media-registry:register', 'media-registry:resolve'])
        strict_1.default.throws(() => api.untrusted(channel, {}), /Control window required/);
    await strict_1.default.rejects(api.untrusted('project:import-dropped-media', []), /Control window required/);
});
(0, node_test_1.default)('IPC media lease retires only after successful Save As and indexes unsaved imported assets', async (t) => {
    const root = await sandbox(t), source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'target');
    await node_fs_1.promises.mkdir(source);
    await node_fs_1.promises.mkdir(target);
    await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness(), active = await api.open(source);
    const lease = await api.call('media-registry:lease', source);
    const input = node_path_1.default.join(root, 'new.png');
    await node_fs_1.promises.writeFile(input, 'new bytes');
    const imported = await api.call('project:import-dropped-media', [input]);
    const asset = imported.importedAssets[0];
    strict_1.default.equal((await api.call('media-registry:register', { leaseId: lease.id, expectedFolder: source, revision: 0, assets: [asset], legacyPaths: [] })).ok, true);
    strict_1.default.equal((await api.call('media-registry:resolve', { leaseId: lease.id, revision: 0, assetId: asset.id })).ok, true);
    api.select(null);
    strict_1.default.equal(await api.call('project:save', { ...active.data, assets: [asset] }, 'saveAs', source), null);
    strict_1.default.equal((await api.call('media-registry:lease', source)).id, lease.id);
    api.select(target);
    await api.call('project:save', { ...active.data, assets: [asset] }, 'saveAs', source);
    strict_1.default.equal(await api.call('media-registry:lease', source), null);
    strict_1.default.notEqual((await api.call('media-registry:lease', target)).id, lease.id);
    strict_1.default.equal((await api.call('media-registry:resolve', { leaseId: lease.id, revision: 0, assetId: asset.id })).code, 'stale-project');
});
(0, node_test_1.default)('additive audio import result preserves copy failure diagnostics', async (t) => {
    const root = await sandbox(t);
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify(fixture()));
    const api = mainHarness();
    await api.open(root);
    api.select(node_path_1.default.join(root, 'missing.mp3'));
    const result = await api.call('project:import-audio-result');
    strict_1.default.equal(result.importedAssets.length, 0);
    strict_1.default.equal(result.failures.length, 1);
    strict_1.default.equal(result.failures[0].name, 'missing.mp3');
});
for (const version of [2, 3])
    (0, node_test_1.default)(`legacy v${version} open preserves source JSON bytes and unregistered media`, async (t) => {
        const root = await sandbox(t);
        await node_fs_1.promises.mkdir(node_path_1.default.join(root, 'assets'));
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'assets', 'legacy.png'), 'image');
        const data = { ...fixture(), version, sections: [{ id: 'story', name: 'Story', background: 'media://assets/legacy.png' }], unknownExtension: { keep: 'opaque' } };
        const original = JSON.stringify(data, null, 2) + '\n';
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), original);
        const api = mainHarness(), opened = await api.open(root);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'project.json'), 'utf8'), original);
        strict_1.default.equal(opened.data.assets.length, 0);
        strict_1.default.equal(opened.data.sections[0].background, 'media://assets/legacy.png');
        strict_1.default.equal(opened.data.unknownExtension.keep, 'opaque');
    });
