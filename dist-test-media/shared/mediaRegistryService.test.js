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
const mediaRegistryService_1 = require("../main/mediaRegistryService");
(0, node_test_1.default)('scoped grants require current manifest, reject stale revisions and retire on activation', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-lease-'));
    try {
        await node_fs_1.promises.mkdir(node_path_1.default.join(root, 'assets'));
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'assets/a.png'), 'a');
        const service = new mediaRegistryService_1.MediaRegistryService();
        const lease = service.activate(root);
        const asset = { id: 'a', relativePath: 'assets/a.png', mediaType: 'image' };
        strict_1.default.equal(service.register({ leaseId: lease.id, expectedFolder: root, revision: 1, assets: [asset], legacyPaths: [] }).ok, true);
        const result = await service.resolve({ leaseId: lease.id, revision: 1, assetId: 'a' });
        strict_1.default.equal(result.ok, true);
        if (!result.ok)
            return;
        strict_1.default.equal(await service.resolveUrl(result.url), node_path_1.default.join(root, 'assets/a.png'));
        strict_1.default.equal(service.register({ leaseId: lease.id, expectedFolder: root, revision: 1, assets: [], legacyPaths: [] }).ok, false);
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 1, assetId: 'other' }), { ok: false, code: 'unregistered' });
        service.activate(root);
        strict_1.default.equal(await service.resolveUrl(result.url), null);
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 1, assetId: 'a' }), { ok: false, code: 'stale-project' });
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('manifest refuses duplicates and unsafe paths, allows explicit legacy files only', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-lease-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'old.png'), 'x');
        const service = new mediaRegistryService_1.MediaRegistryService();
        const lease = service.activate(root);
        const registration = service.register({ leaseId: lease.id, expectedFolder: root, revision: 0, assets: [{ id: 'dup', relativePath: 'old.png', mediaType: 'image' }, { id: 'dup', relativePath: 'old.png', mediaType: 'image' }, { id: 'escape', relativePath: '../outside.png', mediaType: 'image' }], legacyPaths: ['old.png'] });
        strict_1.default.equal(registration.diagnostics.some(d => d.code === 'ambiguous'), true);
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 0, assetId: 'dup' }), { ok: false, code: 'ambiguous' });
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 0, assetId: 'escape' }), { ok: false, code: 'unsafe-path' });
        strict_1.default.equal((await service.resolve({ leaseId: lease.id, revision: 0, legacyPath: 'old.png' })).ok, true);
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 0, legacyPath: 'other.png' }), { ok: false, code: 'unregistered' });
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
