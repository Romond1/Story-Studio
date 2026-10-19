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
const episodePackageService_1 = require("../main/episodePackageService");
const fixture = () => ({ ...(0, commands_1.createLesson)('Portable'), format: 'story-studio-episode', version: 1, adventure: { id: 'adventure', version: '1' }, requiredCapabilities: ['derived-images-v1', 'manual-catalog-v1', 'adventure-definitions-v1'], derivedImages: [], catalog: { entities: [] }, adventureDefinition: { id: 'adventure', version: '1', name: 'Adventure', rewards: [], relics: [] } });
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
        await strict_1.default.rejects((0, episodePackageService_1.importEpisodePackage)({ source: target, target: node_path_1.default.join(root, 'bad'), assertCurrent: () => { } }), /hash|digest|empty|exist/i);
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
