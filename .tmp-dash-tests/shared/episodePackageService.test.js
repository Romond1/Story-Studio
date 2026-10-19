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
const commands_1 = require("./lesson/commands");
const templates_1 = require("./modules/templates");
const episodePackageService_1 = require("../main/episodePackageService");
const fixture = () => ({ ...(0, commands_1.createLesson)('Portable'), format: 'story-studio-episode', version: 1, adventure: { id: 'adventure', version: '1' }, requiredCapabilities: ['derived-images-v1', 'manual-catalog-v1', 'adventure-definitions-v1'], derivedImages: [], catalog: { entities: [] }, adventureDefinition: { id: 'adventure', version: '1', name: 'Adventure', description: '', rewards: [], relics: [] } });
(0, node_test_1.default)('package export excludes private files and import creates an editable verified copy', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-roundtrip-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'package'), destination = node_path_1.default.join(root, 'editable');
        for (const p of [source, target, destination])
            await node_fs_1.promises.mkdir(p);
        const data = fixture();
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'project.json'), JSON.stringify(data));
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'student-progress.json'), 'PRIVATE');
        await (0, episodePackageService_1.exportEpisodePackage)({ source, target, data, builtinRoot: root, assertCurrent: () => { } });
        strict_1.default.deepEqual((await node_fs_1.promises.readdir(target)).sort(), ['definitions', 'manifest.json', 'project.json']);
        await strict_1.default.rejects((0, episodePackageService_1.rejectPackageFolder)(target), /Import/);
        const imported = await (0, episodePackageService_1.importEpisodePackage)({ source: target, target: destination, assertCurrent: () => { } });
        strict_1.default.equal(imported.data.id, data.id);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(destination), ['project.json']);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'student-progress.json'), 'utf8'), 'PRIVATE');
        await node_fs_1.promises.writeFile(node_path_1.default.join(target, 'project.json'), '{}');
        const bad = node_path_1.default.join(root, 'bad');
        await node_fs_1.promises.mkdir(bad);
        await strict_1.default.rejects((0, episodePackageService_1.importEpisodePackage)({ source: target, target: bad, assertCurrent: () => { } }), /hash|digest/i);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(bad), []);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('all authored unused bytes and exact builtin files survive portable remapping', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-media-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'package');
        await node_fs_1.promises.mkdir(source);
        await node_fs_1.promises.mkdir(target);
        await node_fs_1.promises.mkdir(node_path_1.default.join(source, 'assets'));
        const content = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00');
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'assets', 'unused.mp3'), content);
        const data = { ...fixture(), requiredCapabilities: [...fixture().requiredCapabilities, 'bundled-modules-v1'], assets: [{ id: 'unused', relativePath: 'assets/unused.mp3', filename: 'unused.mp3', originalName: 'unused.mp3', mediaType: 'audio', sizeBytes: content.length, importedAt: new Date().toISOString() }], activities: [{ id: 'boss', moduleType: 'final-boss-hero', moduleVersion: 1, configVersion: 1, config: (0, templates_1.createModuleTemplate)('final-boss-hero') }], occurrences: [] };
        const before = JSON.stringify(data);
        await (0, episodePackageService_1.exportEpisodePackage)({ source, target, data, builtinRoot: node_path_1.default.resolve('games'), assertCurrent: () => { } });
        strict_1.default.equal(JSON.stringify(data), before);
        const saved = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'project.json'), 'utf8'));
        strict_1.default.equal(saved.assets.length, 3);
        strict_1.default.ok(saved.activities[0].config.cardLibrary.every((c) => c.image.startsWith('asset:')));
        for (const asset of saved.assets.filter((a) => a.id !== 'unused'))
            strict_1.default.deepEqual(await node_fs_1.promises.readFile(node_path_1.default.join(target, asset.relativePath)), await node_fs_1.promises.readFile(node_path_1.default.join('games/final-boss-hero/assets/board-dash', asset.originalName)));
        strict_1.default.deepEqual(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'assets/unused.mp3')), content);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('wrong image bytes block publication even with matching declared size', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-image-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'package');
        await node_fs_1.promises.mkdir(source);
        await node_fs_1.promises.mkdir(target);
        await node_fs_1.promises.mkdir(node_path_1.default.join(source, 'assets'));
        await node_fs_1.promises.writeFile(node_path_1.default.join(source, 'assets', 'x.png'), 'not an image');
        const data = { ...fixture(), assets: [{ id: 'x', relativePath: 'assets/x.png', filename: 'x.png', originalName: 'x.png', mediaType: 'image', sizeBytes: 12, importedAt: new Date().toISOString() }] };
        await strict_1.default.rejects((0, episodePackageService_1.exportEpisodePackage)({ source, target, data, builtinRoot: root, assertCurrent: () => { } }), /media.*type|signature/i);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(target), []);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('junction escapes and publication interruption leave the selected target empty', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-junction-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'package'), outside = node_path_1.default.join(root, 'outside');
        for (const p of [source, target, outside])
            await node_fs_1.promises.mkdir(p);
        await node_fs_1.promises.writeFile(node_path_1.default.join(outside, 'x.png'), 'outside');
        await node_fs_1.promises.symlink(outside, node_path_1.default.join(source, 'assets'), 'junction');
        const data = { ...fixture(), assets: [{ id: 'x', relativePath: 'assets/x.png', filename: 'x.png', originalName: 'x.png', mediaType: 'image', sizeBytes: 7, importedAt: new Date().toISOString() }] };
        await strict_1.default.rejects((0, episodePackageService_1.exportEpisodePackage)({ source, target, data, builtinRoot: root, assertCurrent: () => { } }), /symbolic/);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(target), []);
        let checks = 0;
        await strict_1.default.rejects((0, episodePackageService_1.exportEpisodePackage)({ source, target, data: fixture(), builtinRoot: root, assertCurrent: () => { if (++checks > 1)
                throw Error('interrupted'); } }), /interrupted/);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(target), []);
        strict_1.default.equal((await node_fs_1.promises.readdir(root)).some(n => n.startsWith('.story-package-')), false);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('unlisted files, stale export and unsafe manifests never publish', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-reject-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'package'), destination = node_path_1.default.join(root, 'editable');
        for (const p of [source, target, destination])
            await node_fs_1.promises.mkdir(p);
        await strict_1.default.rejects((0, episodePackageService_1.exportEpisodePackage)({ source, target, data: fixture(), builtinRoot: root, assertCurrent: () => { throw Error('stale lease'); } }), /stale/);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(target), []);
        await (0, episodePackageService_1.exportEpisodePackage)({ source, target, data: fixture(), builtinRoot: root, assertCurrent: () => { } });
        await node_fs_1.promises.writeFile(node_path_1.default.join(target, 'private.json'), '{}');
        await strict_1.default.rejects((0, episodePackageService_1.importEpisodePackage)({ source: target, target: destination, assertCurrent: () => { } }), /unlisted|inventory/i);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(destination), []);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('unsafe, colliding, unsupported and oversized manifests fail before editable publication', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'package-manifest-'));
    try {
        const source = node_path_1.default.join(root, 'source'), target = node_path_1.default.join(root, 'package'), destination = node_path_1.default.join(root, 'editable');
        for (const p of [source, target, destination])
            await node_fs_1.promises.mkdir(p);
        await (0, episodePackageService_1.exportEpisodePackage)({ source, target, data: fixture(), builtinRoot: root, assertCurrent: () => { } });
        const manifest = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(target, 'manifest.json'), 'utf8'));
        const mutations = [(m) => { m.files[0].path = '../project.json'; }, (m) => { m.files.push({ ...m.files[0], path: 'PROJECT.JSON' }); }, (m) => { m.requiredCapabilities.push('unknown-capability'); }, (m) => { m.files[0].bytes = Number.MAX_SAFE_INTEGER; }, (m) => { m.files[0].path = 'assets/NUL.png'; }];
        for (const mutate of mutations) {
            const changed = structuredClone(manifest);
            mutate(changed);
            await node_fs_1.promises.writeFile(node_path_1.default.join(target, 'manifest.json'), JSON.stringify(changed));
            await strict_1.default.rejects((0, episodePackageService_1.importEpisodePackage)({ source: target, target: destination, assertCurrent: () => { } }));
            strict_1.default.deepEqual(await node_fs_1.promises.readdir(destination), []);
        }
        await node_fs_1.promises.writeFile(node_path_1.default.join(target, 'manifest.json'), JSON.stringify(manifest));
        await node_fs_1.promises.mkdir(node_path_1.default.join(target, 'empty'));
        let folder = node_path_1.default.join(target, 'empty');
        for (let i = 0; i < 33; i++) {
            folder = node_path_1.default.join(folder, 'd');
            await node_fs_1.promises.mkdir(folder);
        }
        await strict_1.default.rejects((0, episodePackageService_1.importEpisodePackage)({ source: target, target: destination, assertCurrent: () => { } }), /depth/);
        strict_1.default.deepEqual(await node_fs_1.promises.readdir(destination), []);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
