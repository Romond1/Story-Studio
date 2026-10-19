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
const derivedMediaService_1 = require("../main/derivedMediaService");
const png = new Uint8Array(33);
png.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1]);
(0, node_test_1.default)('derived grants fence source digest and retire with manifest without changing original', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'derived-media-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'a.png'), 'source bytes');
        const registry = new mediaRegistryService_1.MediaRegistryService(), lease = registry.activate(root);
        registry.register({ leaseId: lease.id, revision: 1, expectedFolder: root, assets: [{ id: 'a', relativePath: 'a.png', mediaType: 'image' }], legacyPaths: [] });
        const service = new derivedMediaService_1.DerivedMediaService(registry, () => ({ width: 1, height: 1 }));
        const request = { leaseId: lease.id, revision: 1, sourceAssetId: 'a' };
        const source = await service.getSource(request);
        strict_1.default.match(source.digest, /^[a-f0-9]{64}$/);
        const granted = await service.publish({ ...request, sourceDigest: source.digest, key: 'transform', png });
        strict_1.default.deepEqual(await service.read(granted.url), png);
        strict_1.default.equal(await node_fs_1.promises.readFile(node_path_1.default.join(root, 'a.png'), 'utf8'), 'source bytes');
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'a.png'), 'changed');
        await strict_1.default.rejects(service.publish({ ...request, sourceDigest: source.digest, key: 'transform', png }), /changed/);
        registry.register({ leaseId: lease.id, revision: 2, expectedFolder: root, assets: [], legacyPaths: [] });
        strict_1.default.equal(await service.read(granted.url), null);
        await strict_1.default.rejects(service.getSource(request), /stale/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('derived PNG validation enforces signature, byte and decoded image limits', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'derived-limits-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'a.png'), 'x');
        const registry = new mediaRegistryService_1.MediaRegistryService(), lease = registry.activate(root);
        registry.register({ leaseId: lease.id, revision: 0, expectedFolder: root, assets: [{ id: 'a', relativePath: 'a.png', mediaType: 'image' }], legacyPaths: [] });
        const service = new derivedMediaService_1.DerivedMediaService(registry, () => ({ width: 4097, height: 1 }));
        const request = { leaseId: lease.id, revision: 0, sourceAssetId: 'a' }, source = await service.getSource(request);
        await strict_1.default.rejects(service.publish({ ...request, sourceDigest: source.digest, key: 'x', png: new Uint8Array([1]) }), /PNG/);
        await strict_1.default.rejects(service.publish({ ...request, sourceDigest: source.digest, key: 'x', png: new Uint8Array(8 * 1024 * 1024 + 1) }), /PNG/);
        await strict_1.default.rejects(service.publish({ ...request, sourceDigest: source.digest, key: 'x', png }), /dimensions/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('derived cache reuses identical content and refuses growth beyond its total budget', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'derived-budget-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'a.png'), 'x');
        const registry = new mediaRegistryService_1.MediaRegistryService(), lease = registry.activate(root);
        registry.register({ leaseId: lease.id, revision: 0, expectedFolder: root, assets: [{ id: 'a', relativePath: 'a.png', mediaType: 'image' }], legacyPaths: [] });
        const service = new derivedMediaService_1.DerivedMediaService(registry, () => ({ width: 1, height: 1 }));
        const request = { leaseId: lease.id, revision: 0, sourceAssetId: 'a' }, source = await service.getSource(request);
        const large = new Uint8Array(8 * 1024 * 1024);
        large.set(png);
        const first = await service.publish({ ...request, sourceDigest: source.digest, key: '0', png: large });
        strict_1.default.deepEqual(await service.publish({ ...request, sourceDigest: source.digest, key: '0', png: large }), first);
        for (let index = 1; index < 8; index++)
            await service.publish({ ...request, sourceDigest: source.digest, key: String(index), png: large });
        await strict_1.default.rejects(service.publish({ ...request, sourceDigest: source.digest, key: 'overflow', png: large }), /cache is full/);
        registry.activate(root);
        strict_1.default.equal(await service.read(first.url), null);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('derived generations reclaim superseded edits while retaining current presentation pixels', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'derived-generations-'));
    try {
        await node_fs_1.promises.writeFile(node_path_1.default.join(root, 'a.png'), 'x');
        const registry = new mediaRegistryService_1.MediaRegistryService(), lease = registry.activate(root);
        registry.register({ leaseId: lease.id, revision: 0, expectedFolder: root, assets: [{ id: 'a', relativePath: 'a.png', mediaType: 'image' }], legacyPaths: [] });
        const service = new derivedMediaService_1.DerivedMediaService(registry, () => ({ width: 1, height: 1 }));
        const base = { leaseId: lease.id, revision: 0, sourceAssetId: 'a' }, source = await service.getSource(base);
        const large = new Uint8Array(8 * 1024 * 1024);
        large.set(png);
        let current, obsolete, priorGeneration;
        for (let index = 0; index < 12; index++) {
            const { generation } = service.begin({ ...base, keepUrls: current ? [current] : [] });
            if (priorGeneration !== undefined)
                await strict_1.default.rejects(service.publish({ ...base, generation: priorGeneration, sourceDigest: source.digest, key: 'late', png }), /stale/);
            if (current)
                strict_1.default.ok(await service.read(current));
            if (obsolete)
                strict_1.default.equal(await service.read(obsolete), null);
            const next = await service.publish({ ...base, generation, sourceDigest: source.digest, key: String(index), png: large });
            if (current)
                strict_1.default.ok(await service.read(current));
            obsolete = current;
            current = next.url;
            priorGeneration = generation;
        }
        service.begin({ ...base, keepUrls: [] });
        strict_1.default.equal(await service.read(current), null);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
