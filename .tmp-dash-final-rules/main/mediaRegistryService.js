"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaRegistryService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const mediaResolution_1 = require("../shared/content/mediaResolution");
const inside = (root, file) => { const rel = node_path_1.default.relative(root, file); return !!rel && rel !== '..' && !rel.startsWith(`..${node_path_1.default.sep}`) && !node_path_1.default.isAbsolute(rel); };
function safePath(value) {
    return typeof value === 'string' && !!value && !/[\\\x00-\x1f:?#]/.test(value) && !value.startsWith('/') && value.split('/').every(segment => !!segment && segment !== '.' && segment !== '..' && !/[. ]$/.test(segment));
}
/** Runtime access index only. Authored records remain owned by Control's immutable document. */
class MediaRegistryService {
    constructor() {
        this.active = null;
    }
    activate(folder) { this.active = { id: (0, node_crypto_1.randomUUID)(), folder, root: (0, node_fs_1.realpathSync)(folder), revision: -1, entries: new Map(), legacy: new Set(), grants: new Map() }; return { id: this.active.id }; }
    isCurrent(leaseId, revision) { return !!this.active && this.active.id === leaseId && this.active.revision === revision; }
    getLease(folder) { return this.active?.folder === folder ? { id: this.active.id, revision: this.active.revision } : null; }
    register(request) {
        const active = this.active;
        const diagnostics = [];
        if (!active || !request || request.leaseId !== active.id || request.expectedFolder !== active.folder || !Number.isSafeInteger(request.revision) || request.revision <= active.revision)
            return { ok: false, diagnostics: [{ code: 'stale-project' }] };
        if (!Array.isArray(request.assets) || !Array.isArray(request.legacyPaths) || request.assets.length > 100000 || request.legacyPaths.length > 100000)
            return { ok: false, diagnostics: [{ code: 'unregistered' }] };
        const entries = new Map();
        const paths = new Map();
        for (const asset of request.assets) {
            if (!asset || typeof asset.id !== 'string' || !asset.id || !['image', 'audio', 'video'].includes(asset.mediaType))
                return { ok: false, diagnostics: [{ code: 'unregistered' }] };
            const error = entries.has(asset.id) ? 'ambiguous' : safePath(asset.relativePath) ? undefined : 'unsafe-path';
            entries.set(asset.id, { relativePath: asset.relativePath, mediaType: asset.mediaType, error });
            if (error)
                diagnostics.push({ code: error, assetId: asset.id });
            if (safePath(asset.relativePath))
                paths.set(asset.relativePath, [...(paths.get(asset.relativePath) ?? []), asset.id]);
        }
        for (const [relativePath, ids] of paths)
            if (ids.length > 1)
                for (const id of ids) {
                    entries.get(id).error = 'ambiguous';
                    diagnostics.push({ code: 'ambiguous', assetId: id, path: relativePath });
                }
        const legacy = new Set();
        for (const value of request.legacyPaths) {
            if (safePath(value))
                legacy.add(value);
            else
                diagnostics.push({ code: 'unsafe-path', path: typeof value === 'string' ? value : undefined });
        }
        active.entries = entries;
        active.legacy = legacy;
        active.revision = request.revision;
        active.grants.clear();
        return { ok: true, diagnostics };
    }
    async checkedPath(root, relativePath) {
        if (!safePath(relativePath))
            return null;
        const candidate = node_path_1.default.resolve(root, relativePath);
        if (!inside(root, candidate))
            return null;
        const real = await node_fs_1.promises.realpath(candidate);
        if (!inside(root, real))
            return null;
        return (await node_fs_1.promises.stat(real)).isFile() ? real : null;
    }
    async resolve(request) {
        const active = this.active;
        if (!active || !request || request.leaseId !== active.id || request.revision !== active.revision)
            return { ok: false, code: 'stale-project' };
        let relativePath;
        let mediaType;
        if (typeof request.assetId === 'string') {
            const entry = active.entries.get(request.assetId);
            if (!entry)
                return { ok: false, code: 'unregistered' };
            if (entry.error)
                return { ok: false, code: entry.error };
            if (request.expectedType && request.expectedType !== entry.mediaType)
                return { ok: false, code: 'wrong-type' };
            relativePath = entry.relativePath;
            mediaType = entry.mediaType;
        }
        else if (typeof request.legacyPath === 'string' && active.legacy.has(request.legacyPath))
            relativePath = request.legacyPath;
        else
            return { ok: false, code: 'unregistered' };
        try {
            const file = await this.checkedPath(active.root, relativePath);
            if (this.active !== active || active.revision !== request.revision)
                return { ok: false, code: 'stale-project' };
            if (!file)
                return { ok: false, code: 'unsafe-path' };
            const grant = (0, node_crypto_1.randomUUID)();
            active.grants.set(grant, relativePath);
            return { ok: true, url: `media://scoped/${active.id}/${grant}`, assetId: request.assetId, mediaType };
        }
        catch {
            return { ok: false, code: this.active !== active || active.revision !== request.revision ? 'stale-project' : 'missing' };
        }
    }
    /** Compatibility URLs use the same pinned root and filesystem containment checks. */
    async resolveLegacyUrl(url) {
        const active = this.active;
        if (!active)
            return null;
        try {
            if (!url.startsWith('media://') || url.startsWith('media://scoped/'))
                return null;
            const relativePath = (0, mediaResolution_1.canonicalMediaPath)(url);
            if (!relativePath)
                return null;
            const result = await this.checkedPath(active.root, relativePath);
            return this.active === active ? result : null;
        }
        catch {
            return null;
        }
    }
    async resolveUrl(url) {
        try {
            const parsed = new URL(url);
            const parts = parsed.pathname.split('/');
            const active = this.active;
            if (parsed.protocol !== 'media:' || parsed.hostname !== 'scoped' || !active || parts.length !== 3 || parts[1] !== active.id)
                return null;
            const relativePath = active.grants.get(parts[2]);
            if (!relativePath)
                return null;
            const revision = active.revision;
            const result = await this.checkedPath(active.root, relativePath);
            return this.active === active && active.revision === revision ? result : null;
        }
        catch {
            return null;
        }
    }
}
exports.MediaRegistryService = MediaRegistryService;
