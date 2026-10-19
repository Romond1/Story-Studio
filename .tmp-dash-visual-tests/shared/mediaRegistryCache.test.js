"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaRegistryCache_1 = require("./mediaRegistryCache");
const asset = { id: 'one', filename: 'one.png', originalName: 'one.png', relativePath: 'assets/one.png', importedAt: '', sizeBytes: 1, mediaType: 'image' };
(0, node_test_1.default)('cache returns only current grants and ignores resolution finishing after project switch', async () => {
    let finish;
    const delayed = new Promise(resolve => { finish = resolve; });
    const api = {
        getLease: async (folder) => ({ id: folder }), register: async () => ({ ok: true, diagnostics: [] }),
        resolve: async (request) => { if (request.leaseId === 'old')
            await delayed; return { ok: true, url: `media://scoped/${request.leaseId}/grant` }; },
    };
    const cache = new mediaRegistryCache_1.MediaRegistryCache(api);
    const old = cache.refresh('old', [asset], []);
    await new Promise(resolve => setImmediate(resolve));
    const current = await cache.refresh('new', [asset], []);
    finish();
    strict_1.default.equal(await old, null);
    strict_1.default.equal(current?.byId.get('one'), 'media://scoped/new/grant');
    strict_1.default.equal(current?.byPath.get('assets/one.png'), 'media://scoped/new/grant');
});
(0, node_test_1.default)('cache revisions increase and resolution failures are explicit', async () => {
    const requests = [];
    const cache = new mediaRegistryCache_1.MediaRegistryCache({ getLease: async () => ({ id: 'lease' }), register: async (request) => { requests.push(request); return { ok: true, diagnostics: [] }; }, resolve: async () => ({ ok: false, code: 'missing' }) });
    strict_1.default.equal((await cache.refresh('folder', [asset], []))?.diagnostics[0].code, 'missing');
    const result = await cache.refresh('folder', [asset], []);
    strict_1.default.ok(requests[1].revision > requests[0].revision);
    strict_1.default.equal(result?.byId.size, 0);
});
(0, node_test_1.default)('cache resumes revisions after a renderer reload', async () => {
    let registered = 0;
    const cache = new mediaRegistryCache_1.MediaRegistryCache({ getLease: async () => ({ id: 'lease', revision: 9000 }), register: async (request) => { registered = request.revision; return { ok: true, diagnostics: [] }; }, resolve: async () => ({ ok: false, code: 'missing' }) });
    await cache.refresh('folder', [], []);
    strict_1.default.ok(registered > 9000);
});
