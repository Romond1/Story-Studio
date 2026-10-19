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
/** Real main-process IPC and files; only Electron's UI boundary is substituted. */
function mainHarness() {
    const privateId = (0, node_crypto_1.randomUUID)();
    const handlers = new Map();
    let selection = null;
    const control = { mainFrame: {} };
    const electron = {
        app: { requestSingleInstanceLock: () => true, whenReady: () => ({ then() { } }), on() { }, getPath: () => node_path_1.default.join(node_os_1.default.tmpdir(), `story-lesson-harness-${privateId}`) },
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
            module, exports: module.exports, __dirname: node_path_1.default.dirname(filename), console, process, crypto: node_crypto_1.webcrypto, __control: control,
            require: (id) => id === 'electron' ? electron : id.startsWith('.') ? load(node_path_1.default.resolve(node_path_1.default.dirname(filename), `${id}.ts`)) : nativeRequire(id),
        }, { filename });
        return module.exports;
    }
    load(node_path_1.default.resolve('src/main/main.ts'));
    const call = async (name, ...args) => {
        strict_1.default.ok(handlers.has(name), `The ${name} IPC handler must be installed`);
        return handlers.get(name)({ sender: control, senderFrame: control.mainFrame }, ...args);
    };
    return {
        call,
        select: (folder) => { selection = folder; },
        open: async (folder, format = 'lesson') => {
            const candidate = await call(`${format}:open-path`, folder);
            strict_1.default.equal(await call(`${format}:activate`, candidate.activationToken), null);
            return candidate;
        },
    };
}
const fixture = () => ({
    format: 'story-studio-scene', version: 1, id: 'lesson-one', title: 'Synthetic lesson',
    createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z',
    assets: [], mediaBins: [], cards: {}, library: [], cardSets: [],
    sequences: { story: [{ id: 'story-entry', sceneId: 'scene', section: 'Story' }], activation: [] },
    scenes: { scene: {
            id: 'scene', title: 'Image scene', frame: { width: 960, height: 720 },
            background: { color: '#123456' }, objects: [{ id: 'bubble', kind: 'bubble', box: { x: 20, y: 30, width: 320, height: 120 }, visible: true, text: 'A question', fontSize: 32, color: '#ffffff', align: 'center' }],
            drawings: [], audio: [], transition: { kind: 'fade', durationMs: 300 }, viewport: { zoom: 1, pan: { x: 0, y: 0 } }, notes: '',
        } },
});
const legacy = () => ({ version: 4, createdAt: '2020-01-01', updatedAt: '2020-01-01', slides: [], assets: [], sections: [] });
async function sandbox(t) {
    const folder = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'story-lesson-persistence-'));
    t.after(() => node_fs_1.promises.rm(folder, { recursive: true, force: true }));
    return folder;
}
async function write(folder, data) { await node_fs_1.promises.writeFile(node_path_1.default.join(folder, 'project.json'), JSON.stringify(data)); }
async function read(folder) { return JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8')); }
(0, node_test_1.default)('new lesson handlers save/reopen the authored scene format without legacy normalization', async (t) => {
    const folder = await sandbox(t);
    await write(folder, fixture());
    const api = mainHarness(), active = await api.open(folder);
    const edited = { ...active.data, title: 'Updated title' };
    await api.call('lesson:save', edited, 'save', folder);
    const reopened = await api.open(folder);
    strict_1.default.equal(reopened.data.title, 'Updated title');
    strict_1.default.deepEqual(JSON.parse(JSON.stringify(reopened.data.scenes)), fixture().scenes);
    strict_1.default.equal('slides' in reopened.data, false);
    strict_1.default.equal('boostPack' in reopened.data, false);
});
(0, node_test_1.default)('create uses the new format only in an empty folder and cancelled creation preserves active folder', async (t) => {
    const folder = await sandbox(t), occupied = await sandbox(t);
    const api = mainHarness();
    await node_fs_1.promises.writeFile(node_path_1.default.join(occupied, 'keep.txt'), 'original');
    api.select(occupied);
    await strict_1.default.rejects(api.call('lesson:create'), /empty/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(occupied, 'keep.txt'), 'utf8'), 'original');
    api.select(folder);
    const created = await api.call('lesson:create');
    strict_1.default.equal(created.data.format, 'story-studio-scene');
    strict_1.default.equal(await api.call('lesson:activate', created.activationToken), null);
    api.select(null);
    strict_1.default.equal(await api.call('lesson:create'), null);
    await api.call('lesson:save', { ...created.data, title: 'Kept active' }, 'save', folder);
    strict_1.default.equal((await read(folder)).title, 'Kept active');
});
(0, node_test_1.default)('both format boundaries reject cross-format opens/saves and leave source bytes intact', async (t) => {
    const oldFolder = await sandbox(t), newFolder = await sandbox(t);
    await write(oldFolder, legacy());
    await write(newFolder, fixture());
    const original = await node_fs_1.promises.readFile(node_path_1.default.join(oldFolder, 'project.json'), 'utf8');
    const api = mainHarness();
    const old = await api.open(oldFolder, 'project');
    await strict_1.default.rejects(api.call('lesson:open-path', oldFolder), /legacy|format/i);
    await strict_1.default.rejects(api.call('lesson:save', fixture(), 'save', oldFolder), /format|legacy|lesson/i);
    const lesson = await api.open(newFolder);
    await strict_1.default.rejects(api.call('project:open-path', newFolder), /format|legacy|lesson/i);
    await strict_1.default.rejects(api.call('project:save', old.data, 'save', newFolder), /format|legacy|lesson/i);
    await strict_1.default.rejects(api.call('lesson:save', lesson.data, 'save', oldFolder), /changed|folder/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(oldFolder, 'project.json'), 'utf8'), original);
});
(0, node_test_1.default)('save refuses on-disk format replacement after opening and preserves replacement bytes', async (t) => {
    const folder = await sandbox(t);
    await write(folder, fixture());
    const api = mainHarness(), active = await api.open(folder);
    await write(folder, legacy());
    const replaced = await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8');
    await strict_1.default.rejects(api.call('lesson:save', active.data, 'save', folder), /format|legacy/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8'), replaced);
});
(0, node_test_1.default)('assets import into a new lesson pool and Save As copies files without mutating the source', async (t) => {
    const folder = await sandbox(t), target = await sandbox(t), input = await sandbox(t);
    await write(folder, fixture());
    const before = await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8');
    const source = node_path_1.default.join(input, 'image.png');
    await node_fs_1.promises.writeFile(source, Buffer.from([1, 2, 3, 4]));
    const api = mainHarness(), active = await api.open(folder);
    const imported = await api.call('project:import-dropped-media', [source]);
    strict_1.default.equal(imported.importedAssets.length, 1);
    strict_1.default.equal(imported.createdSlides.length, 0);
    const data = { ...active.data, assets: imported.importedAssets };
    api.select(target);
    const response = await api.call('lesson:save', data, 'saveAs', folder);
    strict_1.default.equal(response.folderPath, target);
    const reopened = await api.open(target);
    strict_1.default.equal(reopened.data.assets[0].id, imported.importedAssets[0].id);
    strict_1.default.deepEqual(await node_fs_1.promises.readFile(node_path_1.default.join(target, reopened.data.assets[0].relativePath)), Buffer.from([1, 2, 3, 4]));
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8'), before);
    await strict_1.default.rejects(api.call('lesson:save', data, 'save', folder), /changed/i);
});
(0, node_test_1.default)('opening a candidate does not redirect active saves and opposite-format candidates expire old tokens', async (t) => {
    const a = await sandbox(t), b = await sandbox(t), old = await sandbox(t);
    await write(a, fixture());
    await write(b, { ...fixture(), id: 'lesson-two' });
    await write(old, legacy());
    const api = mainHarness(), active = await api.open(a);
    const candidate = await api.call('lesson:open-path', b);
    await api.call('lesson:save', { ...active.data, title: 'Still A' }, 'save', a);
    strict_1.default.equal((await read(a)).title, 'Still A');
    strict_1.default.equal((await read(b)).title, 'Synthetic lesson');
    await api.call('project:open-path', old);
    strict_1.default.match(await api.call('lesson:activate', candidate.activationToken), /expired/i);
});
(0, node_test_1.default)('failed atomic publication preserves prior lesson bytes, clears staging files and permits retry', async (t) => {
    const folder = await sandbox(t);
    await write(folder, fixture());
    const original = await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8');
    const api = mainHarness(), active = await api.open(folder);
    const rename = node_fs_1.promises.rename;
    node_fs_1.promises.rename = async () => { throw new Error('Injected publication failure'); };
    try {
        await strict_1.default.rejects(api.call('lesson:save', { ...active.data, title: 'Failed edit' }, 'save', folder), /publication failure/);
    }
    finally {
        node_fs_1.promises.rename = rename;
    }
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8'), original);
    strict_1.default.deepEqual(await node_fs_1.promises.readdir(folder), ['project.json']);
    await api.call('lesson:save', { ...active.data, title: 'Retry edit' }, 'save', folder);
    strict_1.default.equal((await read(folder)).title, 'Retry edit');
});
(0, node_test_1.default)('new lesson imports share save and project-switch exclusion with the legacy infrastructure', async (t) => {
    const folder = await sandbox(t), input = await sandbox(t);
    await write(folder, fixture());
    const source = node_path_1.default.join(input, 'image.png');
    await node_fs_1.promises.writeFile(source, 'image');
    const api = mainHarness(), active = await api.open(folder);
    const candidate = await api.call('lesson:open-path', folder);
    const copyFile = node_fs_1.promises.copyFile;
    let release, notify;
    const gate = new Promise(resolve => { release = resolve; });
    const copying = new Promise(resolve => { notify = resolve; });
    node_fs_1.promises.copyFile = async (...args) => { notify(); await gate; return copyFile(...args); };
    const importing = api.call('project:import-dropped-media', [source]);
    try {
        await copying;
        await strict_1.default.rejects(api.call('lesson:save', active.data, 'save', folder), /importing/i);
        strict_1.default.match(await api.call('lesson:activate', candidate.activationToken), /importing/i);
    }
    finally {
        release();
        await importing;
        node_fs_1.promises.copyFile = copyFile;
    }
    await api.call('lesson:save', active.data, 'save', folder);
});
(0, node_test_1.default)('invalid revisions and mismatched lesson identities cannot overwrite a valid lesson', async (t) => {
    const folder = await sandbox(t);
    await write(folder, fixture());
    const before = await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8');
    const api = mainHarness(), active = await api.open(folder);
    await strict_1.default.rejects(api.call('lesson:save', { ...active.data, version: 99 }, 'save', folder));
    await strict_1.default.rejects(api.call('lesson:save', { ...active.data, id: 'different-lesson' }, 'save', folder), /identity/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8'), before);
});
(0, node_test_1.default)('legacy save also refuses replacement by the new on-disk format', async (t) => {
    const folder = await sandbox(t);
    await write(folder, legacy());
    const api = mainHarness(), active = await api.open(folder, 'project');
    await write(folder, fixture());
    const before = await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8');
    await strict_1.default.rejects(api.call('project:save', active.data, 'save', folder), /format/i);
    strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(folder, 'project.json'), 'utf8'), before);
});
