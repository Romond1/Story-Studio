"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const commands_1 = require("./lesson/commands");
const validation_1 = require("./lesson/validation");
const projectHistory_1 = require("./projectHistory");
const mediaImport_1 = require("./lesson/mediaImport");
const protocol_1 = require("./modules/protocol");
/** Exercise the actual root callbacks across async IPC, without a second implementation. */
function harness() {
    const project = (0, commands_1.createLesson)(), history = new projectHistory_1.ProjectHistory();
    history.reset(project);
    const source = typescript_1.default.createSourceFile('LessonApp.tsx', (0, node_fs_1.readFileSync)('src/renderer/lesson/LessonApp.tsx', 'utf8'), typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    const declarations = [];
    const names = new Set(['run', 'save', 'saveEpisode', 'handleHostedEditor', 'importMedia', 'exportPackage', 'importPackage']);
    const visit = (node) => {
        if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isIdentifier(node.name) && names.has(node.name.text))
            declarations.push(`const ${node.getText(source)};`);
        if (typescript_1.default.isFunctionDeclaration(node) && node.name && names.has(node.name.text))
            declarations.push(node.getText(source));
        typescript_1.default.forEachChild(node, visit);
    };
    visit(source);
    const state = { project, file: { folderPath: 'source', data: project }, error: '', notice: '', busy: false };
    const latest = { current: project }, operationRef = { current: false };
    const context = {
        project, file: state.file, latest, history: { current: history }, busy: false, operationRef, operation: operationRef, activeBinId: '',
        parseLessonProject: validation_1.parseLessonProject, parseSceneDocument: validation_1.parseSceneDocument, mergeLessonMediaImport: mediaImport_1.mergeLessonMediaImport, hosted: { isActive: false }, window: { lessonApi: {}, appApi: {} },
        setBusy: (value) => { state.busy = value; },
        setError: (value) => { state.error = value; },
        setNotice: (value) => { state.notice = value; },
        setFile: (value) => { state.file = value; },
        setProject: (value) => { state.project = value; },
    };
    node_vm_1.default.createContext(context);
    const js = typescript_1.default.transpileModule(`${declarations.join('\n')}\nglobalThis.callbacks={run,save,handleHostedEditor,importMedia,exportPackage,importPackage};`, { compilerOptions: { target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInContext(js, context);
    return { context, state, latest, history, callbacks: context.callbacks, operationRef };
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
(0, node_test_1.default)('missing media remains listed in an editor response accepted by the strict protocol', async () => {
    const h = harness();
    h.context.editorMedia = { current: { project: h.latest.current, pending: false, resolve: () => undefined, registry: { list: () => [{ id: 'missing', originalName: 'Missing picture', mediaType: 'image' }], images: () => [] } } };
    const result = await h.callbacks.handleHostedEditor('media-list', () => true);
    strict_1.default.equal(result.assets[0].id, 'missing');
    strict_1.default.ok((0, protocol_1.parseHostToModuleMessage)({ channel: 'story-studio-module', version: 1, moduleType: 'final-boss-hero', moduleVersion: 1, hostGeneration: 1, requestId: 'list', context: { sessionId: 's', runId: 'r', instanceId: 'i', occurrenceId: 'o', episodeId: 'e', adventureId: 'a', participantIds: [] }, type: 'editor-response', ...result }));
});
(0, node_test_1.default)('hosted editor save reports cancellation and failures without a misleading success', async () => {
    const h = harness();
    h.context.window.lessonApi.saveProject = async () => null;
    strict_1.default.equal((await h.callbacks.handleHostedEditor('episode-save', () => true)).cancelled, true);
    h.context.window.lessonApi.saveProject = async () => { throw Error('disk unavailable'); };
    await strict_1.default.rejects(h.callbacks.handleHostedEditor('episode-save', () => true), /disk unavailable/);
    strict_1.default.equal(h.state.busy, false);
});
(0, node_test_1.default)('hosted import cancellation, stale run and busy operations cannot register media', async () => {
    const h = harness();
    h.context.window.appApi.importMedia = async () => null;
    strict_1.default.equal((await h.callbacks.handleHostedEditor('media-import', () => true)).cancelled, true);
    await strict_1.default.rejects(h.callbacks.handleHostedEditor('media-import', () => false), /no longer active/);
    h.operationRef.current = true;
    await strict_1.default.rejects(h.callbacks.handleHostedEditor('media-import', () => true), /busy/);
    strict_1.default.equal(h.history.isDirty, false);
});
(0, node_test_1.default)('portable export waits for hosted edits and does not mark the editable lesson saved', async () => {
    const h = harness(), pending = deferred();
    let exported;
    const episode = { ...h.state.project, format: 'story-studio-episode' };
    h.latest.current = episode;
    h.history.record(episode);
    h.context.hosted = { isActive: true, flush: () => pending.promise };
    h.context.window.lessonApi.exportPackage = async (data, folder) => { strict_1.default.equal(folder, 'source'); exported = data; return { folderPath: 'package' }; };
    const exporting = h.callbacks.exportPackage();
    strict_1.default.equal(exported, undefined);
    const accepted = { ...episode, title: 'Accepted before export' };
    h.latest.current = accepted;
    pending.resolve();
    await exporting;
    strict_1.default.equal(exported, accepted);
    strict_1.default.equal(h.history.isDirty, true);
    strict_1.default.equal(h.state.file.folderPath, 'source');
});
(0, node_test_1.default)('cancelled or rejected package import preserves the active project and history', async () => {
    const h = harness(), original = h.state.project;
    h.context.window.lessonApi.importPackage = async () => null;
    await h.callbacks.importPackage();
    strict_1.default.equal(h.state.project, original);
    h.context.window.lessonApi.importPackage = async () => { throw Error('Package hash mismatch'); };
    await h.callbacks.importPackage();
    strict_1.default.equal(h.state.project, original);
    strict_1.default.match(h.state.error, /hash mismatch/);
    strict_1.default.equal(h.history.isDirty, false);
    strict_1.default.equal(h.state.file.folderPath, 'source');
});
(0, node_test_1.default)('lesson Save waits for hosted configuration acknowledgment and writes the accepted revision', async () => {
    const h = harness(), pending = deferred();
    let written;
    h.context.hosted = { isActive: true, flush: () => pending.promise };
    h.context.window.lessonApi.saveProject = async (data) => { written = data; return { folderPath: 'source', lastSavedAt: 'today' }; };
    const saving = h.callbacks.save('save');
    strict_1.default.equal(written, undefined);
    const accepted = { ...h.state.project, title: 'Accepted hosted edit' };
    h.latest.current = accepted;
    h.history.record(accepted);
    pending.resolve();
    await saving;
    strict_1.default.equal(written, accepted);
    strict_1.default.equal(h.history.isDirty, false);
});
(0, node_test_1.default)('unacknowledged hosted settings prevent a misleading successful lesson Save', async () => {
    const h = harness();
    let writes = 0;
    h.context.hosted = { isActive: true, flush: async () => { throw Error('configuration acknowledgment timed out'); } };
    h.context.window.lessonApi.saveProject = async () => { writes++; };
    await h.callbacks.save('save');
    strict_1.default.equal(writes, 0);
    strict_1.default.match(h.state.error, /acknowledgment/);
});
(0, node_test_1.default)('lesson save completion marks the written revision and retains newer edits and dirty status', async () => {
    const h = harness(), pending = deferred();
    const written = h.state.project;
    h.context.window.lessonApi.saveProject = () => pending.promise;
    const saving = h.callbacks.save('saveAs');
    const newer = { ...written, title: 'Newer changes' };
    h.latest.current = newer;
    h.history.record(newer);
    h.state.project = newer;
    pending.resolve({ folderPath: 'copy', lastSavedAt: '2026-10-08' });
    await saving;
    strict_1.default.equal(h.state.project, newer);
    strict_1.default.equal(h.state.file.folderPath, 'copy');
    strict_1.default.equal(h.history.isDirty, true);
    strict_1.default.equal(h.history.undo(), written);
    strict_1.default.equal(h.history.isDirty, false);
});
(0, node_test_1.default)('lesson Save As cancellation and failed save keep the current file and dirty revision', async () => {
    const h = harness(), changed = { ...h.state.project, title: 'Changed' };
    h.history.record(changed);
    h.context.window.lessonApi.saveProject = async () => null;
    await h.callbacks.save('saveAs');
    strict_1.default.equal(h.state.file.folderPath, 'source');
    strict_1.default.equal(h.history.isDirty, true);
    h.context.window.lessonApi.saveProject = async () => { throw Error('disk unavailable'); };
    await h.callbacks.save('save');
    strict_1.default.match(h.state.error, /disk unavailable/);
    strict_1.default.equal(h.history.isDirty, true);
    strict_1.default.equal(h.state.busy, false);
});
(0, node_test_1.default)('lesson folder import preserves actual imported bin identities and edits made during file copy', async () => {
    const h = harness(), pending = deferred();
    h.context.window.appApi.importMediaFolder = () => pending.promise;
    const importing = h.callbacks.importMedia('folder');
    h.latest.current = { ...h.state.project, title: 'Edited while importing' };
    const asset = { id: 'image', mediaType: 'image', filename: 'image.png', originalName: 'image.png', relativePath: 'assets/image.png', binId: 'bin', sizeBytes: 2, importedAt: '2026-10-08' };
    pending.resolve({ importedAssets: [asset], importedBins: [{ id: 'bin', name: 'Lesson media' }], createdSlides: [], failures: [] });
    await importing;
    strict_1.default.equal(h.state.project.title, 'Edited while importing');
    strict_1.default.equal(h.state.project.mediaBins[0].id, 'bin');
    strict_1.default.equal((0, validation_1.parseLessonProject)(h.state.project).assets[0].binId, 'bin');
});
(0, node_test_1.default)('lesson operations serialize immediately before React can publish a busy render', async () => {
    const h = harness(), pending = deferred();
    let saves = 0;
    h.context.window.lessonApi.saveProject = () => { saves++; return pending.promise; };
    const first = h.callbacks.save('save'), second = h.callbacks.save('save');
    pending.resolve({ folderPath: 'source', lastSavedAt: '2026-10-08' });
    await Promise.all([first, second]);
    strict_1.default.equal(saves, 1);
});
(0, node_test_1.default)('image-dialog import captures the active bin before its asynchronous picker returns', async () => {
    const h = harness(), pending = deferred();
    h.context.activeBinId = 'chosen';
    h.latest.current = { ...h.state.project, mediaBins: [{ id: 'chosen', name: 'Chosen' }, { id: 'other', name: 'Other' }] };
    h.context.window.appApi.importMedia = () => pending.promise;
    const importing = h.callbacks.importMedia('files');
    h.context.activeBinId = 'other';
    pending.resolve({ importedAssets: [{ id: 'image', mediaType: 'image', filename: 'image.png', originalName: 'image.png', relativePath: 'assets/image.png', sizeBytes: 2, importedAt: '2026-10-09' }], createdSlides: [] });
    await importing;
    strict_1.default.equal(h.state.error, '');
    strict_1.default.equal(h.state.project.assets[0].binId, 'chosen');
});
