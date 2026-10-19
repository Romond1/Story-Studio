"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeroDashLibrary = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const mediaImportService_1 = require("./mediaImportService");
const heroDash_1 = require("../shared/heroDash");
/** App-owned review collections. Files are never appended to the active episode. */
class HeroDashLibrary {
    constructor(root) {
        this.root = root;
    }
    async read() { try {
        const data = JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(this.root, 'library.json'), 'utf8'));
        if (data.version !== 1 || !Array.isArray(data.images) || !Array.isArray(data.collections))
            throw Error('Invalid review library');
        return data;
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return { version: 1, images: [], collections: [] };
        throw e;
    } }
    async write(data) { await node_fs_1.promises.mkdir(this.root, { recursive: true }); const tmp = node_path_1.default.join(this.root, `library-${(0, node_crypto_1.randomUUID)()}.tmp`); await node_fs_1.promises.writeFile(tmp, JSON.stringify(data)); await node_fs_1.promises.rename(tmp, node_path_1.default.join(this.root, 'library.json')); }
    image(asset) { return { id: asset.id, name: asset.originalName, url: `media://hero-dash/${asset.id}` }; }
    async list() { const data = await this.read(); return { images: data.images.map(a => this.image(a)), collections: data.collections.map(c => ({ id: c.id, title: c.config.title, updatedAt: c.updatedAt })) }; }
    async importImages(paths) {
        if (!Array.isArray(paths) || paths.length > 500 || paths.some(p => typeof p !== 'string' || !node_path_1.default.isAbsolute(p)))
            throw Error('Choose up to 500 image files.');
        const accepted = [], failures = [];
        for (const file of paths) {
            try {
                const stat = await node_fs_1.promises.lstat(file);
                if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 50 * 1024 * 1024 || (0, mediaImportService_1.detectMediaType)(node_path_1.default.extname(file)) !== 'image')
                    throw Error('Use PNG, JPG, WebP, GIF or BMP images under 50 MB.');
                accepted.push(file);
            }
            catch (e) {
                failures.push({ name: node_path_1.default.basename(file), reason: e instanceof Error ? e.message : 'Could not read file' });
            }
        }
        const data = await this.read(), result = await (0, mediaImportService_1.importProjectMedia)(this.root, accepted, 'hero-dash');
        data.images.push(...result.importedAssets);
        await this.write(data);
        return { images: result.importedAssets.map(a => this.image(a)), failures: [...failures, ...(result.failures ?? [])] };
    }
    async saveCollection(id, raw, capture) {
        const config = (0, heroDash_1.parseDashConfig)(raw), data = await this.read(), mapped = new Map();
        const refs = [...config.cards, ...(config.importedImages ?? []).map(ref => mapped.get(ref) ?? ref).filter(ref => ref.startsWith('asset:')).map(image => ({ image }))];
        for (const card of refs) {
            if (card.image.startsWith('dash:'))
                continue;
            if (!mapped.has(card.image)) {
                const { bytes, name } = await capture(card.image);
                if (bytes.byteLength > 50 * 1024 * 1024)
                    throw Error('Review image exceeds 50 MB.');
                const hash = (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
                const ext = (0, mediaImportService_1.detectMediaType)(node_path_1.default.extname(name)) === 'image' ? node_path_1.default.extname(name).toLowerCase() : '.png';
                let asset = data.images.find(a => a.filename === `${hash}${ext}`);
                if (!asset) {
                    const assetId = (0, node_crypto_1.randomUUID)(), filename = `${hash}${ext}`;
                    await node_fs_1.promises.mkdir(node_path_1.default.join(this.root, 'assets'), { recursive: true });
                    await node_fs_1.promises.writeFile(node_path_1.default.join(this.root, 'assets', filename), bytes);
                    asset = { id: assetId, filename, originalName: name, relativePath: `assets/${filename}`, mediaType: 'image', sizeBytes: bytes.byteLength, importedAt: new Date().toISOString() };
                    data.images.push(asset);
                }
                mapped.set(card.image, `dash:${asset.id}`);
            }
            card.image = mapped.get(card.image);
        }
        config.importedImages = [...new Set([...(config.importedImages ?? []).map(ref => mapped.get(ref) ?? ref), ...config.cards.map(c => c.image).filter(ref => ref.startsWith('dash:'))])];
        for (const ref of config.importedImages)
            if (!data.images.some(a => `dash:${a.id}` === ref))
                throw Error('An imported image is missing from the review library.');
        const collectionId = id && data.collections.some(c => c.id === id) ? id : (0, node_crypto_1.randomUUID)();
        data.collections = data.collections.filter(c => c.id !== collectionId);
        data.collections.push({ id: collectionId, config, updatedAt: new Date().toISOString() });
        await this.write(data);
        return { id: collectionId, config };
    }
    async loadCollection(id) { const collection = (await this.read()).collections.find(c => c.id === id); if (!collection)
        throw Error('Review collection not found.'); return (0, heroDash_1.parseDashConfig)(collection.config); }
    async resolveUrl(raw) { try {
        const url = new URL(raw);
        if (url.protocol !== 'media:' || url.hostname !== 'hero-dash' || !/^\/[a-zA-Z0-9-]{1,200}$/.test(url.pathname))
            return null;
        const asset = (await this.read()).images.find(a => a.id === url.pathname.slice(1));
        if (!asset || asset.relativePath !== `assets/${asset.filename}` || node_path_1.default.basename(asset.filename) !== asset.filename)
            return null;
        const target = node_path_1.default.resolve(this.root, asset.relativePath), root = await node_fs_1.promises.realpath(this.root), real = await node_fs_1.promises.realpath(target);
        if (!real.startsWith(root + node_path_1.default.sep))
            return null;
        return real;
    }
    catch {
        return null;
    } }
}
exports.HeroDashLibrary = HeroDashLibrary;
