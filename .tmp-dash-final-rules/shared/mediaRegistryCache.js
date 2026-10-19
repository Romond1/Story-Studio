"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaRegistryCache = void 0;
let revision = 0;
/** Asynchronous access cache, never an authored store. A retired load cannot publish. */
class MediaRegistryCache {
    constructor(api) {
        this.api = api;
        this.generation = 0;
    }
    retire() { ++this.generation; }
    async refresh(folder, assets, legacyPaths) {
        const generation = ++this.generation;
        const current = () => generation === this.generation;
        const lease = await this.api.getLease(folder);
        if (!current())
            return null;
        if (!lease)
            return { leaseId: '', revision: -1, byId: new Map(), byPath: new Map(), diagnostics: [{ code: 'stale-project' }] };
        revision = Math.max(revision, lease.revision ?? -1) + 1;
        const request = { leaseId: lease.id, expectedFolder: folder, revision, assets, legacyPaths };
        const registered = await this.api.register(request);
        if (!current())
            return null;
        const byId = new Map(), byPath = new Map();
        const diagnostics = [...registered.diagnostics];
        if (registered.ok) {
            // Bounded batches avoid flooding main for large production lessons.
            const references = [...assets.map(asset => ({ assetId: asset.id, path: asset.relativePath })), ...legacyPaths.map(path => ({ assetId: undefined, path }))];
            for (let start = 0; start < references.length; start += 32) {
                await Promise.all(references.slice(start, start + 32).map(async (ref) => {
                    const resolved = await this.api.resolve({ leaseId: lease.id, revision: request.revision, ...(ref.assetId ? { assetId: ref.assetId } : { legacyPath: ref.path }) });
                    if (resolved.ok) {
                        if (ref.assetId)
                            byId.set(ref.assetId, resolved.url);
                        byPath.set(ref.path, resolved.url);
                    }
                    else
                        diagnostics.push({ code: resolved.code, assetId: ref.assetId, path: ref.path });
                }));
                if (!current())
                    return null;
            }
        }
        return current() ? { leaseId: lease.id, revision: request.revision, byId, byPath, diagnostics } : null;
    }
}
exports.MediaRegistryCache = MediaRegistryCache;
