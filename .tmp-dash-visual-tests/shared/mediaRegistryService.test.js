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
(0, node_test_1.default)('legacy compatibility rejects traversal before URL normalization can erase it', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-legacy-traversal-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'secret.png'), 'inside-root-but-not-requested');
        const service = new mediaRegistryService_1.MediaRegistryService();
        service.activate(root);
        strict_1.default.equal(await service.resolveLegacyUrl('media:///assets/../secret.png'), null);
        strict_1.default.equal(await service.resolveLegacyUrl('media:///assets/%2e%2e/secret.png'), null);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('realpath containment rejects junction escape and rechecks grants after filesystem change', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-realpath-'));
    try {
        const project = node_path_1.default.join(root, 'project'), outside = node_path_1.default.join(root, 'outside');
        await node_fs_1.promises.mkdir(project);
        await node_fs_1.promises.mkdir(outside);
        await node_fs_1.promises.writeFile(node_path_1.default.join(outside, 'a.png'), 'outside');
        await node_fs_1.promises.symlink(outside, node_path_1.default.join(project, 'escape'), 'junction');
        const service = new mediaRegistryService_1.MediaRegistryService(), lease = service.activate(project);
        service.register({ leaseId: lease.id, expectedFolder: project, revision: 0, assets: [{ id: 'a', relativePath: 'escape/a.png', mediaType: 'image' }, { id: 'missing', relativePath: 'missing.png', mediaType: 'audio' }], legacyPaths: [] });
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 0, assetId: 'a' }), { ok: false, code: 'unsafe-path' });
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 0, assetId: 'missing' }), { ok: false, code: 'missing' });
        strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 0, assetId: 'missing', expectedType: 'video' }), { ok: false, code: 'wrong-type' });
        await node_fs_1.promises.mkdir(node_path_1.default.join(project, 'assets'));
        await node_fs_1.promises.writeFile(node_path_1.default.join(project, 'assets/a.png'), 'inside');
        service.register({ leaseId: lease.id, expectedFolder: project, revision: 1, assets: [{ id: 'a', relativePath: 'assets/a.png', mediaType: 'image' }], legacyPaths: [] });
        const granted = await service.resolve({ leaseId: lease.id, revision: 1, assetId: 'a' });
        strict_1.default.equal(granted.ok, true);
        await node_fs_1.promises.rename(node_path_1.default.join(project, 'assets'), node_path_1.default.join(project, 'old-assets'));
        await node_fs_1.promises.symlink(outside, node_path_1.default.join(project, 'assets'), 'junction');
        if (granted.ok)
            strict_1.default.equal(await service.resolveUrl(granted.url), null);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('resolution in flight cannot issue grants for a retired manifest', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-race-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'a.png'), 'x');
        const service = new mediaRegistryService_1.MediaRegistryService(), lease = service.activate(root);
        service.register({ leaseId: lease.id, expectedFolder: root, revision: 0, assets: [{ id: 'a', relativePath: 'a.png', mediaType: 'image' }], legacyPaths: [] });
        const pending = service.resolve({ leaseId: lease.id, revision: 0, assetId: 'a' });
        service.register({ leaseId: lease.id, expectedFolder: root, revision: 1, assets: [], legacyPaths: [] });
        strict_1.default.deepEqual(await pending, { ok: false, code: 'stale-project' });
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('lease reports manifest revision for renderer reload and rejects Windows path aliases', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-reload-'));
    try {
        const service = new mediaRegistryService_1.MediaRegistryService(), lease = service.activate(root);
        service.register({ leaseId: lease.id, expectedFolder: root, revision: 75, assets: [{ id: 'dot', relativePath: 'assets./a.png', mediaType: 'image' }, { id: 'space', relativePath: 'assets /a.png', mediaType: 'image' }], legacyPaths: [] });
        strict_1.default.equal(service.getLease(root)?.revision, 75);
        for (const assetId of ['dot', 'space'])
            strict_1.default.deepEqual(await service.resolve({ leaseId: lease.id, revision: 75, assetId }), { ok: false, code: 'unsafe-path' });
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('legacy URL compatibility checks realpath and retains both URL spellings and queries', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'media-legacy-'));
    try {
        const project = node_path_1.default.join(root, 'project'), outside = node_path_1.default.join(root, 'outside');
        await node_fs_1.promises.mkdir(project);
        await node_fs_1.promises.mkdir(outside);
        await node_fs_1.promises.mkdir(node_path_1.default.join(project, 'assets'));
        await node_fs_1.promises.writeFile(node_path_1.default.join(project, 'assets', 'a b.png'), 'safe');
        await node_fs_1.promises.writeFile(node_path_1.default.join(outside, 'secret.png'), 'private');
        await node_fs_1.promises.symlink(outside, node_path_1.default.join(project, 'assets', 'escape'), 'junction');
        const service = new mediaRegistryService_1.MediaRegistryService();
        service.activate(project);
        for (const url of ['media://assets/a%20b.png?render=1', 'media:///assets/a%20b.png'])
            strict_1.default.equal(await service.resolveLegacyUrl(url), node_path_1.default.join(project, 'assets', 'a b.png'));
        strict_1.default.equal(await service.resolveLegacyUrl('media://assets/escape/secret.png'), null);
        strict_1.default.equal(await service.resolveLegacyUrl('media://assets/%2e%2e%2foutside/secret.png'), null);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
