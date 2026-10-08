"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMediaType = detectMediaType;
exports.importProjectMedia = importProjectMedia;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const mediaPool_1 = require("../shared/mediaPool");
function detectMediaType(ext) {
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext.toLowerCase()))
        return 'image';
    if (['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext.toLowerCase()))
        return 'video';
    if (['.mp3', '.wav', '.ogg', '.aac', '.m4a'].includes(ext.toLowerCase()))
        return 'audio';
    return null;
}
/** One importer for native pickers, Pool and Explorer. Files always receive UUID storage names. */
async function importProjectMedia(folder, sources, sectionId) {
    const result = { importedAssets: [], createdSlides: [], importedBins: [], failures: [] };
    const visit = async (source, parentId) => {
        const name = node_path_1.default.basename(source);
        try {
            const stat = await node_fs_1.promises.lstat(source);
            if (stat.isSymbolicLink()) {
                result.failures.push({ name, reason: 'Symbolic links are not imported.' });
                return;
            }
            if (stat.isDirectory()) {
                const id = (0, node_crypto_1.randomUUID)();
                result.importedBins.push({ id, name, ...(parentId ? { parentId } : {}) });
                const children = (await node_fs_1.promises.readdir(source)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                for (const child of children)
                    await visit(node_path_1.default.join(source, child), id);
                return;
            }
            const ext = node_path_1.default.extname(source).toLowerCase();
            const mediaType = detectMediaType(ext);
            if (!stat.isFile() || !mediaType) {
                result.failures.push({ name, reason: 'Unsupported media type.' });
                return;
            }
            const id = (0, node_crypto_1.randomUUID)();
            const filename = `${id}${ext}`;
            await node_fs_1.promises.copyFile(source, node_path_1.default.join(folder, 'assets', filename));
            const asset = { id, filename, relativePath: `assets/${filename}`, originalName: name, mediaType, sizeBytes: stat.size, importedAt: new Date().toISOString(), ...(parentId ? { binId: parentId } : {}) };
            result.importedAssets.push(asset);
            if (mediaType !== 'audio')
                result.createdSlides.push((0, mediaPool_1.createMediaSlide)(asset, sectionId, node_crypto_1.randomUUID));
        }
        catch (error) {
            result.failures.push({ name, reason: error instanceof Error ? error.message : 'Import failed.' });
        }
    };
    await node_fs_1.promises.mkdir(node_path_1.default.join(folder, 'assets'), { recursive: true });
    for (const source of sources)
        await visit(source);
    return result;
}
