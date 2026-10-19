"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DerivedMediaService = void 0;
const node_fs_1 = require("node:fs");
const node_crypto_1 = require("node:crypto");
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
/** Bounded runtime cache only. It never writes authored files or metadata. */
class DerivedMediaService {
    registry;
    imageSize;
    grants = new Map();
    bytes = 0;
    constructor(registry, imageSize) {
        this.registry = registry;
        this.imageSize = imageSize;
    }
    assertCurrent(request) {
        if (!request || !this.registry.isCurrent(request.leaseId, request.revision))
            throw new Error('Derived media request is stale.');
    }
    prune() {
        for (const [id, grant] of this.grants)
            if (!this.registry.isCurrent(grant.request.leaseId, grant.request.revision)) {
                this.bytes -= grant.png.byteLength;
                this.grants.delete(id);
            }
    }
    async getSource(request) {
        this.assertCurrent(request);
        this.prune();
        const resolved = await this.registry.resolve({ leaseId: request.leaseId, revision: request.revision, assetId: request.sourceAssetId, expectedType: 'image' });
        if (!resolved.ok)
            throw new Error(`Derived source unavailable: ${resolved.code}`);
        const file = await this.registry.resolveUrl(resolved.url);
        if (!file)
            throw new Error('Derived source is stale or unsafe.');
        const hash = (0, node_crypto_1.createHash)('sha256');
        for await (const chunk of (0, node_fs_1.createReadStream)(file))
            hash.update(chunk);
        this.assertCurrent(request);
        return { url: resolved.url, digest: hash.digest('hex') };
    }
    async publish(request) {
        this.assertCurrent(request);
        this.prune();
        if (typeof request.key !== 'string' || !request.key || request.key.length > 8192 || typeof request.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(request.sourceDigest))
            throw new Error('Invalid derived cache identity.');
        const png = request.png;
        if (!(png instanceof Uint8Array) || png.byteLength > MAX_IMAGE_BYTES || png.byteLength < 33 || PNG_SIGNATURE.some((byte, i) => png[i] !== byte))
            throw new Error('Invalid or oversized derived PNG.');
        const header = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
        if (header.readUInt32BE(8) !== 13 || header.toString('ascii', 12, 16) !== 'IHDR')
            throw new Error('Invalid derived PNG header.');
        const width = header.readUInt32BE(16), height = header.readUInt32BE(20);
        if (!width || !height || width > 4096 || height > 4096 || width * height > 8 * 1024 * 1024)
            throw new Error('Derived PNG dimensions exceed limits.');
        const size = this.imageSize(png);
        if (size.width !== width || size.height !== height || !Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1 || size.width > 4096 || size.height > 4096 || size.width * size.height > 8 * 1024 * 1024)
            throw new Error('Derived PNG dimensions exceed limits.');
        const source = await this.getSource(request);
        if (source.digest !== request.sourceDigest)
            throw new Error('Derived source changed; render again.');
        this.assertCurrent(request);
        const cacheKey = JSON.stringify([request.leaseId, request.revision, request.sourceAssetId, request.sourceDigest, request.key, (0, node_crypto_1.createHash)('sha256').update(png).digest('hex')]);
        for (const [grant, item] of this.grants)
            if (item.cacheKey === cacheKey)
                return { url: `media://scoped-derived/${request.leaseId}/${grant}` };
        // Refuse instead of evicting a grant that a published presentation still uses.
        if (this.bytes + png.byteLength > MAX_CACHE_BYTES)
            throw new Error('Derived image cache is full. Reopen the project to clear it.');
        const grant = (0, node_crypto_1.randomUUID)(), copy = new Uint8Array(png);
        this.grants.set(grant, { request: { leaseId: request.leaseId, revision: request.revision, sourceAssetId: request.sourceAssetId }, png: copy, cacheKey });
        this.bytes += copy.byteLength;
        return { url: `media://scoped-derived/${request.leaseId}/${grant}` };
    }
    async read(url) {
        this.prune();
        try {
            const parsed = new URL(url), parts = parsed.pathname.split('/');
            if (parsed.protocol !== 'media:' || parsed.hostname !== 'scoped-derived' || parts.length !== 3)
                return null;
            const grant = this.grants.get(parts[2]);
            if (!grant || grant.request.leaseId !== parts[1] || !this.registry.isCurrent(grant.request.leaseId, grant.request.revision))
                return null;
            return new Uint8Array(grant.png);
        }
        catch {
            return null;
        }
    }
}
exports.DerivedMediaService = DerivedMediaService;
