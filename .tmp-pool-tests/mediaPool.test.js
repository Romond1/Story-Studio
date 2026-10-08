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
const mediaImportService_1 = require("../main/mediaImportService");
const mediaPool_1 = require("./mediaPool");
const data = { version: 4, createdAt: '', updatedAt: '', assets: [], slides: [], sections: [{ id: 'one', name: 'One' }] };
(0, node_test_1.default)('folder import preserves nested bins, UUID files, types and reports unsupported entries without lesson sections', async (t) => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'story-pool-'));
    t.after(() => node_fs_1.promises.rm(root, { recursive: true, force: true }));
    const source = node_path_1.default.join(root, 'Episode');
    await node_fs_1.promises.mkdir(node_path_1.default.join(source, 'Part'), { recursive: true });
    for (const name of ['same.PNG', 'Part/same.PNG', 'Part/scene.mp4', 'Part/music.mp3', 'notes.txt'])
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, name), 'fixture');
    const result = await (0, mediaImportService_1.importProjectMedia)(node_path_1.default.join(root, 'project'), [source], 'one');
    strict_1.default.equal(result.importedAssets.length, 4);
    strict_1.default.equal(result.createdSlides.length, 3);
    strict_1.default.equal(result.importedBins?.length, 2);
    strict_1.default.equal(result.failures?.length, 1);
    for (const asset of result.importedAssets) {
        strict_1.default.match(asset.relativePath, /^assets\/[a-f0-9-]+\.(png|mp4|mp3)$/);
        strict_1.default.ok(asset.binId);
        await node_fs_1.promises.access(node_path_1.default.join(root, 'project', asset.relativePath));
    }
    const pool = (0, mediaPool_1.registerPoolImport)(data, result);
    strict_1.default.equal(pool.sections.length, 1);
    strict_1.default.equal(pool.slides.length, 0);
    const saved = JSON.parse(JSON.stringify(pool));
    strict_1.default.equal(saved.mediaBins.length, 2);
    strict_1.default.equal(saved.assets.length, 4);
});
(0, node_test_1.default)('pool insertion is deterministic, creates wrappers, counts usage and retains assets on removal', () => {
    const assets = ['a', 'b'].map(id => ({ id, relativePath: `assets/${id}.png`, filename: `${id}.png`, originalName: `${id}.png`, mediaType: 'image', sizeBytes: 1, importedAt: '' }));
    const pool = (0, mediaPool_1.registerPoolImport)(data, { importedAssets: assets, createdSlides: [] });
    let nextId = 0;
    const first = (0, mediaPool_1.insertPoolAssets)(pool, ['b', 'a'], 'one', null, () => `slide${++nextId}`);
    strict_1.default.deepEqual(first.slides.map(s => s.assetId), ['b', 'a']);
    const second = (0, mediaPool_1.insertPoolAssets)(first, ['a'], 'one', first.slides[1].id, () => `slide${++nextId}`);
    strict_1.default.deepEqual(second.slides.map(s => s.assetId), ['b', 'a', 'a']);
    strict_1.default.equal((0, mediaPool_1.mediaUsage)(second, 'a'), 2);
    const removed = { ...second, slides: second.slides.filter(s => s.assetId !== 'a') };
    strict_1.default.equal((0, mediaPool_1.mediaUsage)(removed, 'a'), 0);
    strict_1.default.equal(removed.assets.length, 2);
    strict_1.default.throws(() => (0, mediaPool_1.insertPoolAssets)(pool, ['a'], 'missing', null, () => ''), /section/i);
});
