"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const episodeConversion_1 = require("../main/episodeConversion");
const commands_1 = require("./lesson/commands");
const writeAtomic = async (folder, data) => { await node_fs_1.promises.writeFile(node_path_1.default.join(folder, 'project.json'), JSON.stringify(data), { flag: 'wx' }); return 'saved'; };
(0, node_test_1.default)('conversion preserves source and backup hashes, publishes episode only to empty target', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'episode-convert-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'target'), backupRoot = node_path_1.default.join(root, 'private');
        await node_fs_1.promises.mkdir(source);
        await node_fs_1.promises.mkdir(target);
        const data = (0, commands_1.createLesson)('Original');
        const original = JSON.stringify(data, null, 2);
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), original);
        await node_fs_1.promises.mkdir(node_path_1.default.join(source, 'assets'));
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'assets', 'unused.png'), 'preserve unused');
        const result = await (0, episodeConversion_1.convertSceneToEpisode)({ source, target, backupRoot, data, adventure: { id: 'adventure', version: '1' }, writeAtomic });
        strict_1.default.equal(result.data.format, 'story-studio-episode');
        strict_1.default.equal(result.data.id, data.id);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8'), original);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(result.backupPath, 'source', 'project.json'), 'utf8'), original);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'assets', 'unused.png'), 'utf8'), 'preserve unused');
        strict_1.default.match(await node_fs_1.promises.readFile(result.migrationReport, 'utf8'), /sha256/);
        await strict_1.default.rejects((0, episodeConversion_1.convertSceneToEpisode)({ source, target, backupRoot, data, adventure: { id: 'adventure', version: '1' }, writeAtomic }), /empty/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('conversion failure never changes source or publishes a fallback episode', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'episode-fail-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'target');
        await node_fs_1.promises.mkdir(source);
        await node_fs_1.promises.mkdir(target);
        const data = (0, commands_1.createLesson)();
        const original = JSON.stringify(data);
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), original);
        await strict_1.default.rejects((0, episodeConversion_1.convertSceneToEpisode)({ source, target, backupRoot: node_path_1.default.join(root, 'private'), data, adventure: { id: 'adventure', version: '1' }, writeAtomic: async () => { throw Error('injected publication failure'); } }), /injected/);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8'), original);
        await strict_1.default.rejects(node_fs_1.promises.stat(node_path_1.default.join(target, 'project.json')), /ENOENT/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
const node_fs_2 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const node_module_1 = require("node:module");
const typescript_1 = __importDefault(require("typescript"));
function ipcHarness(privateRoot) {
    const handlers = new Map(), control = { mainFrame: {} };
    let selection = null;
    const electron = { app: { requestSingleInstanceLock: () => true, whenReady: () => ({ then() { } }), on() { }, getPath: () => privateRoot }, BrowserWindow: function () { }, dialog: { showOpenDialog: async () => ({ canceled: !selection, filePaths: selection ? [selection] : [] }) }, ipcMain: { handle: (name, fn) => handlers.set(name, fn), on: (name, fn) => handlers.set(name, (_, ...args) => { const event = { returnValue: undefined }; fn(event, ...args); return event.returnValue; }) }, protocol: { registerSchemesAsPrivileged() { } } };
    const cache = new Map();
    const load = (filename) => { if (cache.has(filename))
        return cache.get(filename); const module = { exports: {} }; cache.set(filename, module.exports); const nativeRequire = (0, node_module_1.createRequire)(filename); let source = (0, node_fs_2.readFileSync)(filename, 'utf8'); if (filename.endsWith(`${node_path_1.default.sep}main.ts`))
        source += '\nmainWindow={webContents:__control} as unknown as BrowserWindow;'; const js = typescript_1.default.transpileModule(source, { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; node_vm_1.default.runInNewContext(js, { module, exports: module.exports, __dirname: node_path_1.default.dirname(filename), console, process, Buffer, crypto: globalThis.crypto, __control: control, require: (id) => id === 'electron' ? electron : id.startsWith('.') ? load(node_path_1.default.resolve(node_path_1.default.dirname(filename), `${id}.ts`)) : nativeRequire(id) }, { filename }); return module.exports; };
    load(node_path_1.default.resolve('src/main/main.ts'));
    return { call: (name, ...args) => handlers.get(name)({ sender: control, senderFrame: control.mainFrame }, ...args), untrusted: (name, ...args) => handlers.get(name)({ sender: {}, senderFrame: {} }, ...args), select: (folder) => { selection = folder; } };
}
(0, node_test_1.default)('real IPC converts explicitly, saves/reopens episode and refuses cross-format overwrite', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'episode-ipc-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'target');
        await node_fs_1.promises.mkdir(source);
        await node_fs_1.promises.mkdir(target);
        const data = (0, commands_1.createLesson)('Convert');
        const original = JSON.stringify(data);
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), original);
        const api = ipcHarness(node_path_1.default.join(root, 'private'));
        const initial = await api.call('lesson:open-path', source);
        strict_1.default.equal(await api.call('lesson:activate', initial.activationToken), null);
        api.select(null);
        strict_1.default.equal(await api.call('lesson:convert', data, { id: 'adventure', version: '1' }, source), null);
        api.select(target);
        const result = await api.call('lesson:convert', data, { id: 'adventure', version: '1' }, source);
        strict_1.default.equal(result.data.format, 'story-studio-episode');
        // Conversion is prepared, never activated implicitly.
        await api.call('lesson:save', data, 'save', source);
        strict_1.default.equal(await api.call('lesson:activate', result.activationToken), null);
        await api.call('lesson:save', { ...result.data, title: 'Episode edit' }, 'save', target);
        const reopened = await api.call('lesson:open-path', target);
        strict_1.default.equal(reopened.data.title, 'Episode edit');
        strict_1.default.equal(reopened.data.format, 'story-studio-episode');
        await strict_1.default.rejects(api.call('lesson:save', data, 'save', target), /format/);
        strict_1.default.equal(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8')).format, 'story-studio-scene');
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(result.backupPath, 'source', 'project.json'), 'utf8'), original);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('episode conversion, package, progression and derived IPC require the Control main frame', () => { const api = ipcHarness('unused'); for (const channel of ['lesson:convert', 'lesson:export-package', 'lesson:import-package', 'derived-media:source', 'derived-media:publish', ...['getSnapshot', 'registerRun', 'recordEvent', 'lifecycle', 'completeActivation', 'decideReward', 'requestReward', 'adjustReward', 'advanceRelic', 'completeEpisode', 'getRunInventory'].map(method => `progression:${method}`)])
    strict_1.default.throws(() => api.untrusted(channel, {}), /Control window required/); });
(0, node_test_1.default)('ordinary scene and legacy Open reject immutable package folders', async () => { const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-open-')); try {
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'project.json'), JSON.stringify((0, commands_1.createLesson)()));
    await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'manifest.json'), 'malformed still immutable');
    const api = ipcHarness(node_path_1.default.join(root, 'private'));
    for (const channel of ['lesson:open-path', 'project:open-path'])
        await strict_1.default.rejects(api.call(channel, root), /Import portable episode/);
}
finally {
    await node_fs_1.promises.rm(root, { recursive: true, force: true });
} });
(0, node_test_1.default)('Mastery preparation upgrades the active lesson in place without a picker and preserves its media', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'episode-inline-'));
    try {
        const source = node_path_1.default.join(root, 'source');
        await node_fs_1.promises.mkdir(source);
        await node_fs_1.promises.mkdir(node_path_1.default.join(source, 'assets'));
        const data = (0, commands_1.createLesson)('Same folder');
        const original = JSON.stringify(data);
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), original);
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'assets', 'keep.txt'), 'unchanged');
        const api = ipcHarness(node_path_1.default.join(root, 'private'));
        const initial = await api.call('lesson:open-path', source);
        await api.call('lesson:activate', initial.activationToken);
        const result = await api.call('lesson:prepare-games', { ...data, title: 'Unsaved title' }, source);
        strict_1.default.equal(result.folderPath, source);
        strict_1.default.equal(result.data.format, 'story-studio-episode');
        strict_1.default.equal(result.data.title, 'Unsaved title');
        strict_1.default.equal(result.data.id, data.id);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'assets', 'keep.txt'), 'utf8'), 'unchanged');
        const backups = await node_fs_1.promises.readdir(node_path_1.default.join(root, 'private', 'migration-backups'));
        strict_1.default.equal(backups.length, 1);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'private', 'migration-backups', backups[0], 'project.json'), 'utf8'), original);
        await api.call('lesson:activate', result.activationToken);
        await api.call('lesson:save', result.data, 'save', source);
        strict_1.default.equal((await api.call('lesson:open-path', source)).data.format, 'story-studio-episode');
        strict_1.default.throws(() => api.untrusted('lesson:prepare-games', data, source), /Control window/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
