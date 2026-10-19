import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto, randomUUID } from 'node:crypto';
import ts from 'typescript';

/** Real main-process IPC and files; only Electron's UI boundary is substituted. */
function mainHarness() {
  const privateId = randomUUID();
  const handlers = new Map<string, (...args: any[]) => any>();
  let selection: string | null = null;
  const control = { mainFrame: {} };
  const electron = {
    app: { requestSingleInstanceLock: () => true, whenReady: () => ({ then() {} }), on() {}, getPath: () => path.join(os.tmpdir(), `story-lesson-harness-${privateId}`) },
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
    if (filename.endsWith(`${path.sep}main.ts`)) source += '\nmainWindow = { webContents: __control } as unknown as BrowserWindow;';
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
    vm.runInNewContext(js, {
      module, exports: module.exports, __dirname: path.dirname(filename), console, process, crypto: webcrypto, __control: control,
      require: (id: string) => id === 'electron' ? electron : id.startsWith('.') ? load(path.resolve(path.dirname(filename), `${id}.ts`)) : nativeRequire(id),
    }, { filename });
    return module.exports;
  }
  load(path.resolve('src/main/main.ts'));
  const call = async (name: string, ...args: any[]) => {
    assert.ok(handlers.has(name), `The ${name} IPC handler must be installed`);
    return handlers.get(name)!({ sender: control, senderFrame: control.mainFrame }, ...args);
  };
  return {
    call,
    select: (folder: string | null) => { selection = folder; },
    open: async (folder: string, format: 'lesson' | 'project' = 'lesson') => {
      const candidate = await call(`${format}:open-path`, folder);
      assert.equal(await call(`${format}:activate`, candidate.activationToken), null);
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
async function sandbox(t: { after(fn: () => Promise<void>): void }) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'story-lesson-persistence-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  return folder;
}
async function write(folder: string, data: unknown) { await fs.writeFile(path.join(folder, 'project.json'), JSON.stringify(data)); }
async function read(folder: string) { return JSON.parse(await fs.readFile(path.join(folder, 'project.json'), 'utf8')); }

test('new lesson handlers save/reopen the authored scene format without legacy normalization', async t => {
  const folder = await sandbox(t); await write(folder, fixture());
  const api = mainHarness(), active = await api.open(folder);
  const edited = { ...active.data, title: 'Updated title' };
  await api.call('lesson:save', edited, 'save', folder);
  const reopened = await api.open(folder);
  assert.equal(reopened.data.title, 'Updated title');
  assert.deepEqual(JSON.parse(JSON.stringify(reopened.data.scenes)), fixture().scenes);
  assert.equal('slides' in reopened.data, false);
  assert.equal('boostPack' in reopened.data, false);
});

test('create uses the new format only in an empty folder and cancelled creation preserves active folder', async t => {
  const folder = await sandbox(t), occupied = await sandbox(t); const api = mainHarness();
  await fs.writeFile(path.join(occupied, 'keep.txt'), 'original');
  api.select(occupied); await assert.rejects(api.call('lesson:create'), /empty/i);
  assert.equal(await fs.readFile(path.join(occupied, 'keep.txt'), 'utf8'), 'original');
  api.select(folder); const created = await api.call('lesson:create');
  assert.equal(created.data.format, 'story-studio-scene');
  assert.equal(await api.call('lesson:activate', created.activationToken), null);
  api.select(null); assert.equal(await api.call('lesson:create'), null);
  await api.call('lesson:save', { ...created.data, title: 'Kept active' }, 'save', folder);
  assert.equal((await read(folder)).title, 'Kept active');
});

test('both format boundaries reject cross-format opens/saves and leave source bytes intact', async t => {
  const oldFolder = await sandbox(t), newFolder = await sandbox(t);
  await write(oldFolder, legacy()); await write(newFolder, fixture());
  const original = await fs.readFile(path.join(oldFolder, 'project.json'), 'utf8');
  const api = mainHarness(); const old = await api.open(oldFolder, 'project');
  await assert.rejects(api.call('lesson:open-path', oldFolder), /legacy|format/i);
  await assert.rejects(api.call('lesson:save', fixture(), 'save', oldFolder), /format|legacy|lesson/i);
  const lesson = await api.open(newFolder);
  await assert.rejects(api.call('project:open-path', newFolder), /format|legacy|lesson/i);
  await assert.rejects(api.call('project:save', old.data, 'save', newFolder), /format|legacy|lesson/i);
  await assert.rejects(api.call('lesson:save', lesson.data, 'save', oldFolder), /changed|folder/i);
  assert.equal(await fs.readFile(path.join(oldFolder, 'project.json'), 'utf8'), original);
});

test('save refuses on-disk format replacement after opening and preserves replacement bytes', async t => {
  const folder = await sandbox(t); await write(folder, fixture());
  const api = mainHarness(), active = await api.open(folder);
  await write(folder, legacy()); const replaced = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
  await assert.rejects(api.call('lesson:save', active.data, 'save', folder), /format|legacy/i);
  assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), replaced);
});

test('assets import into a new lesson pool and Save As copies files without mutating the source', async t => {
  const folder = await sandbox(t), target = await sandbox(t), input = await sandbox(t);
  await write(folder, fixture()); const before = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
  const source = path.join(input, 'image.png'); await fs.writeFile(source, Buffer.from([1, 2, 3, 4]));
  const api = mainHarness(), active = await api.open(folder);
  const imported = await api.call('project:import-dropped-media', [source]);
  assert.equal(imported.importedAssets.length, 1);
  assert.equal(imported.createdSlides.length, 0);
  const data = { ...active.data, assets: imported.importedAssets };
  api.select(target); const response = await api.call('lesson:save', data, 'saveAs', folder);
  assert.equal(response.folderPath, target);
  const reopened = await api.open(target);
  assert.equal(reopened.data.assets[0].id, imported.importedAssets[0].id);
  assert.deepEqual(await fs.readFile(path.join(target, reopened.data.assets[0].relativePath)), Buffer.from([1, 2, 3, 4]));
  assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), before);
  await assert.rejects(api.call('lesson:save', data, 'save', folder), /changed/i);
});

test('opening a candidate does not redirect active saves and opposite-format candidates expire old tokens', async t => {
  const a = await sandbox(t), b = await sandbox(t), old = await sandbox(t);
  await write(a, fixture()); await write(b, { ...fixture(), id: 'lesson-two' }); await write(old, legacy());
  const api = mainHarness(), active = await api.open(a);
  const candidate = await api.call('lesson:open-path', b);
  await api.call('lesson:save', { ...active.data, title: 'Still A' }, 'save', a);
  assert.equal((await read(a)).title, 'Still A'); assert.equal((await read(b)).title, 'Synthetic lesson');
  await api.call('project:open-path', old);
  assert.match(await api.call('lesson:activate', candidate.activationToken), /expired/i);
});

test('failed atomic publication preserves prior lesson bytes, clears staging files and permits retry', async t => {
  const folder = await sandbox(t); await write(folder, fixture());
  const original = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
  const api = mainHarness(), active = await api.open(folder);
  const rename = fs.rename;
  fs.rename = async () => { throw new Error('Injected publication failure'); };
  try { await assert.rejects(api.call('lesson:save', { ...active.data, title: 'Failed edit' }, 'save', folder), /publication failure/); }
  finally { fs.rename = rename; }
  assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), original);
  assert.deepEqual(await fs.readdir(folder), ['project.json']);
  await api.call('lesson:save', { ...active.data, title: 'Retry edit' }, 'save', folder);
  assert.equal((await read(folder)).title, 'Retry edit');
});

test('new lesson imports share save and project-switch exclusion with the legacy infrastructure', async t => {
  const folder = await sandbox(t), input = await sandbox(t);
  await write(folder, fixture());
  const source = path.join(input, 'image.png'); await fs.writeFile(source, 'image');
  const api = mainHarness(), active = await api.open(folder);
  const candidate = await api.call('lesson:open-path', folder);
  const copyFile = fs.copyFile;
  let release!: () => void, notify!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const copying = new Promise<void>(resolve => { notify = resolve; });
  fs.copyFile = async (...args: Parameters<typeof fs.copyFile>) => { notify(); await gate; return copyFile(...args); };
  const importing = api.call('project:import-dropped-media', [source]);
  try {
    await copying;
    await assert.rejects(api.call('lesson:save', active.data, 'save', folder), /importing/i);
    assert.match(await api.call('lesson:activate', candidate.activationToken), /importing/i);
  } finally { release(); await importing; fs.copyFile = copyFile; }
  await api.call('lesson:save', active.data, 'save', folder);
});

test('invalid revisions and mismatched lesson identities cannot overwrite a valid lesson', async t => {
  const folder = await sandbox(t); await write(folder, fixture());
  const before = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
  const api = mainHarness(), active = await api.open(folder);
  await assert.rejects(api.call('lesson:save', { ...active.data, version: 99 }, 'save', folder));
  await assert.rejects(api.call('lesson:save', { ...active.data, id: 'different-lesson' }, 'save', folder), /identity/i);
  assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), before);
});

test('legacy save also refuses replacement by the new on-disk format', async t => {
  const folder = await sandbox(t); await write(folder, legacy());
  const api = mainHarness(), active = await api.open(folder, 'project');
  await write(folder, fixture()); const before = await fs.readFile(path.join(folder, 'project.json'), 'utf8');
  await assert.rejects(api.call('project:save', active.data, 'save', folder), /format/i);
  assert.equal(await fs.readFile(path.join(folder, 'project.json'), 'utf8'), before);
});
