"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectPackageFolder = rejectPackageFolder;
exports.exportEpisodePackage = exportEpisodePackage;
exports.importEpisodePackage = importEpisodePackage;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const validation_1 = require("../shared/package/validation");
const model_1 = require("../shared/package/model");
const mediaImportService_1 = require("./mediaImportService");
const media_1 = require("../shared/modules/media");
const { maxFileBytes: MAX_FILE, maxTotalBytes: MAX_TOTAL, maxJsonBytes: MAX_JSON, maxFiles: MAX_FILES } = model_1.PACKAGE_LIMITS;
const digest = (bytes) => (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
const inside = (root, file) => { const r = node_path_1.default.relative(root, file); return !!r && r !== '..' && !r.startsWith(`..${node_path_1.default.sep}`) && !node_path_1.default.isAbsolute(r); };
function safePath(value) {
    if (typeof value !== 'string' || value.length > 1024 || value.includes('\\') || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..' || /[\x00-\x1f:<>"|?*]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
        throw Error(`Unsafe package path: ${value}`);
    return value;
}
async function fileAt(root, relative) {
    safePath(relative);
    let current = root;
    for (const segment of relative.split('/')) {
        current = node_path_1.default.join(current, segment);
        if ((await node_fs_1.promises.lstat(current)).isSymbolicLink())
            throw Error('Package symbolic links are unsupported.');
    }
    const real = await node_fs_1.promises.realpath(current);
    if (!inside(root, real) || !(await node_fs_1.promises.stat(real)).isFile())
        throw Error('Unsafe package containment.');
    return real;
}
async function jsonAt(root, name) { const file = await fileAt(root, name); if ((await node_fs_1.promises.stat(file)).size > MAX_JSON)
    throw Error('Package JSON size limit exceeded.'); return JSON.parse(await node_fs_1.promises.readFile(file, 'utf8')); }
async function inventory(root) { const result = []; let entries = 0; const walk = async (folder, depth) => { if (depth > 32)
    throw Error('Package directory depth limit exceeded.'); const directory = await node_fs_1.promises.opendir(folder); for await (const entry of directory) {
    if (++entries > MAX_FILES * 2)
        throw Error('Package entry count limit exceeded.');
    const file = node_path_1.default.join(folder, entry.name), st = await node_fs_1.promises.lstat(file);
    if (st.isSymbolicLink() || !inside(root, await node_fs_1.promises.realpath(file)))
        throw Error('Package symbolic link or containment violation.');
    if (st.isDirectory())
        await walk(file, depth + 1);
    else if (st.isFile()) {
        result.push(safePath(node_path_1.default.relative(root, file).replaceAll('\\', '/')));
        if (result.length > MAX_FILES)
            throw Error('Package file count limit exceeded.');
    }
    else
        throw Error('Unsupported package entry.');
} }; await walk(root, 0); return result.sort(); }
async function validateMedia(root, asset) {
    const ext = node_path_1.default.extname(asset.relativePath).toLowerCase();
    if ((0, mediaImportService_1.detectMediaType)(ext) !== asset.mediaType)
        throw Error('Package media type/extension mismatch.');
    const handle = await node_fs_1.promises.open(await fileAt(root, asset.relativePath), 'r');
    const b = Buffer.alloc(64);
    let size = 0;
    try {
        size = (await handle.read(b, 0, b.length, 0)).bytesRead;
    }
    finally {
        await handle.close();
    }
    const text = (start, end) => b.toString('ascii', start, end), starts = (hex) => b.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'));
    const riff = text(0, 4) === 'RIFF', iso = text(4, 8) === 'ftyp';
    const signatures = { '.png': starts('89504e470d0a1a0a'), '.jpg': starts('ffd8ff'), '.jpeg': starts('ffd8ff'), '.gif': ['GIF87a', 'GIF89a'].includes(text(0, 6)), '.webp': riff && text(8, 12) === 'WEBP', '.bmp': text(0, 2) === 'BM', '.mp3': text(0, 3) === 'ID3' || b[0] === 255 && (b[1] & 224) === 224, '.wav': riff && text(8, 12) === 'WAVE', '.ogg': text(0, 4) === 'OggS', '.aac': b[0] === 255 && (b[1] & 246) === 240, '.m4a': iso, '.mp4': iso, '.mov': iso || ['moov', 'mdat', 'wide'].includes(text(4, 8)), '.webm': starts('1a45dfa3'), '.mkv': starts('1a45dfa3'), '.avi': riff && text(8, 12) === 'AVI ' };
    if (size < 4 || !signatures[ext])
        throw Error(`Package media signature does not match ${asset.mediaType}: ${asset.relativePath}`);
}
async function cleanupStage(stage, target) { const absolute = node_path_1.default.resolve(stage), parent = node_path_1.default.dirname(node_path_1.default.resolve(target)); if (node_path_1.default.dirname(absolute) !== parent || !node_path_1.default.basename(absolute).startsWith('.story-package-'))
    throw Error('Unsafe staging cleanup path.'); await node_fs_1.promises.rm(absolute, { recursive: true, force: true }); }
async function copyDigest(source, target, expected) {
    const input = await node_fs_1.promises.open(source, 'r');
    let output;
    try {
        const stat = await input.stat();
        if (!stat.isFile() || stat.size > MAX_FILE)
            throw Error('Package file size limit exceeded.');
        await node_fs_1.promises.mkdir(node_path_1.default.dirname(target), { recursive: true });
        output = await node_fs_1.promises.open(target, 'wx');
        const hash = (0, node_crypto_1.createHash)('sha256'), buffer = Buffer.alloc(128 * 1024);
        let bytes = 0;
        while (true) {
            const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
            if (!bytesRead)
                break;
            bytes += bytesRead;
            if (bytes > MAX_FILE)
                throw Error('Package file size limit exceeded.');
            const chunk = buffer.subarray(0, bytesRead);
            hash.update(chunk);
            await output.writeFile(chunk);
        }
        await output.sync();
        const sha256 = hash.digest('hex');
        if (expected && (bytes !== expected.bytes || sha256 !== expected.sha256))
            throw Error('Package file hash or size mismatch.');
        return { bytes, sha256 };
    }
    finally {
        await input.close();
        await output?.close();
    }
}
async function staging(sourceValue, targetValue) {
    if ((await node_fs_1.promises.lstat(sourceValue)).isSymbolicLink() || (await node_fs_1.promises.lstat(targetValue)).isSymbolicLink())
        throw Error('Package roots cannot be symbolic links.');
    const source = await node_fs_1.promises.realpath(sourceValue), target = await node_fs_1.promises.realpath(targetValue);
    if (source === target || inside(source, target) || inside(target, source))
        throw Error('Package destination must be outside the source.');
    if ((await node_fs_1.promises.readdir(target)).length)
        throw Error('Package destination must be empty.');
    const stage = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_path_1.default.dirname(target), '.story-package-'));
    return { source, target, stage };
}
async function publish(stage, target, assertCurrent) {
    assertCurrent();
    if ((await node_fs_1.promises.readdir(target)).length)
        throw Error('Package destination changed.');
    // rmdir removes only the selected empty directory; rename publishes the fully validated tree.
    await node_fs_1.promises.rmdir(target);
    try {
        assertCurrent();
        await node_fs_1.promises.rename(stage, target);
    }
    catch (error) {
        await node_fs_1.promises.mkdir(target).catch(() => { });
        throw error;
    }
}
async function rejectPackageFolder(folder) {
    try {
        await node_fs_1.promises.lstat(node_path_1.default.join(folder, 'manifest.json'));
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return;
        throw error;
    }
    throw Error('This folder is an immutable package. Use Import portable episode to create an editable copy.');
}
async function exportEpisodePackage(input) {
    input.assertCurrent();
    const { source, target, stage } = await staging(input.source, input.target);
    try {
        let data = (0, validation_1.projectAuthoredEpisode)(input.data);
        const files = [], paths = new Set();
        let total = 0;
        const add = async (relative, from) => { safePath(relative); const key = relative.normalize('NFC').toLowerCase(); if (paths.has(key))
            throw Error('Package path collision.'); paths.add(key); const result = await copyDigest(from, node_path_1.default.join(stage, relative)); total += result.bytes; if (total > MAX_TOTAL || files.length >= MAX_FILES)
            throw Error('Package size/count limit exceeded.'); files.push({ path: relative, ...result }); return result; };
        for (const asset of data.assets) {
            if (!asset.relativePath.startsWith('assets/'))
                throw Error('Portable assets must be inside assets/.');
            await add(asset.relativePath, await fileAt(source, asset.relativePath));
        }
        const remaps = new Map(), ids = new Set([...data.assets.map(a => a.id), ...data.derivedImages.map(a => a.id)]);
        for (const activity of data.activities ?? [])
            for (const use of (0, media_1.collectModuleAssets)(activity))
                if (use.ref.startsWith('builtin:') && !remaps.has(use.ref)) {
                    const match = /^builtin:final-boss-hero\/assets\/board-dash\/(start|finish|move|bonus|back3|roll-again|steal)\.png$/.exec(use.ref);
                    if (!match)
                        throw Error('Unsupported builtin package dependency.');
                    const base = `builtin-${digest(Buffer.from(use.ref)).slice(0, 24)}`;
                    let id = base, index = 0;
                    while (ids.has(id))
                        id = `${base}-${++index}`;
                    ids.add(id);
                    let relative = `assets/${id}.png`;
                    while (paths.has(relative.toLowerCase())) {
                        id = `${base}-${++index}`;
                        if (ids.has(id))
                            continue;
                        ids.add(id);
                        relative = `assets/${id}.png`;
                    }
                    const builtinRoot = await node_fs_1.promises.realpath(input.builtinRoot);
                    const bytes = await add(relative, await fileAt(builtinRoot, `final-boss-hero/assets/board-dash/${match[1]}.png`));
                    data.assets.push({ id, relativePath: relative, filename: node_path_1.default.basename(relative), originalName: `${match[1]}.png`, mediaType: 'image', sizeBytes: bytes.bytes, importedAt: data.createdAt });
                    remaps.set(use.ref, `asset:${id}`);
                }
        if (data.activities)
            data.activities = data.activities.map(a => (0, media_1.remapModuleAssets)(a, ref => remaps.get(ref) ?? ref));
        data = (0, validation_1.validatePortableEpisode)(data);
        const put = async (name, value) => { const bytes = Buffer.from(JSON.stringify(value, null, 2)); if (bytes.length > MAX_JSON)
            throw Error('Package JSON size limit exceeded.'); await node_fs_1.promises.mkdir(node_path_1.default.dirname(node_path_1.default.join(stage, name)), { recursive: true }); await node_fs_1.promises.writeFile(node_path_1.default.join(stage, name), bytes, { flag: 'wx' }); const item = { path: name, bytes: bytes.length, sha256: digest(bytes) }; files.push(item); return item; };
        await put('project.json', data);
        const definition = await put('definitions/adventure.json', data.adventureDefinition);
        const snapshot = { kind: 'adventure', adventureId: data.adventure.id, version: data.adventure.version, bundledPath: definition.path, sha256: definition.sha256 };
        const manifest = (0, validation_1.parsePackageManifest)({ format: 'story-studio-package', version: 1, episodeId: data.id, adventure: data.adventure, requiredCapabilities: data.requiredCapabilities, files, definitions: [snapshot], adventureDependencies: [{ adventureId: snapshot.adventureId, version: snapshot.version, bundledPath: snapshot.bundledPath, sha256: snapshot.sha256 }] });
        (0, validation_1.validatePackageClosure)(data, manifest, data.adventureDefinition);
        await node_fs_1.promises.writeFile(node_path_1.default.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
        await inspect(stage);
        await publish(stage, target, input.assertCurrent);
        return { folderPath: target };
    }
    finally {
        await cleanupStage(stage, target);
    }
}
async function inspect(source) {
    const manifest = (0, validation_1.parsePackageManifest)(await jsonAt(source, 'manifest.json'));
    if (manifest.files.length > MAX_FILES)
        throw Error('Package file count limit exceeded.');
    let total = 0;
    const paths = new Set();
    for (const file of manifest.files) {
        safePath(file.path);
        const key = file.path.normalize('NFC').toLowerCase();
        if (paths.has(key) || file.path === 'manifest.json')
            throw Error('Package path collision.');
        paths.add(key);
        if (file.bytes > MAX_FILE || (total += file.bytes) > MAX_TOTAL)
            throw Error('Package size limit exceeded.');
    }
    const actual = await inventory(source), expected = ['manifest.json', ...manifest.files.map(f => f.path)].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw Error('Package inventory contains missing or unlisted files.');
    // Hash streams without allocating file-sized buffers. Import repeats verification during the actual copy.
    for (const file of manifest.files) {
        const handle = await node_fs_1.promises.open(await fileAt(source, file.path), 'r');
        try {
            const hash = (0, node_crypto_1.createHash)('sha256');
            let size = 0;
            for await (const chunk of handle.createReadStream({ autoClose: false })) {
                size += chunk.length;
                if (size > file.bytes)
                    throw Error('Package file size mismatch.');
                hash.update(chunk);
            }
            if (size !== file.bytes || hash.digest('hex') !== file.sha256)
                throw Error('Package file hash mismatch.');
        }
        finally {
            await handle.close();
        }
    }
    const data = (0, validation_1.validatePortableEpisode)(await jsonAt(source, 'project.json')), definition = await jsonAt(source, 'definitions/adventure.json');
    (0, validation_1.validatePackageClosure)(data, manifest, definition);
    for (const asset of data.assets)
        await validateMedia(source, asset);
    return { manifest, data };
}
async function importEpisodePackage(input) {
    input.assertCurrent();
    const { source, target, stage } = await staging(input.source, input.target);
    try {
        const { manifest } = await inspect(source);
        for (const file of manifest.files)
            await copyDigest(await fileAt(source, file.path), node_path_1.default.join(stage, file.path), file);
        await copyDigest(await fileAt(source, 'manifest.json'), node_path_1.default.join(stage, 'manifest.json'));
        const { data } = await inspect(stage);
        await node_fs_1.promises.unlink(node_path_1.default.join(stage, 'manifest.json'));
        await node_fs_1.promises.unlink(node_path_1.default.join(stage, 'definitions', 'adventure.json'));
        await node_fs_1.promises.rmdir(node_path_1.default.join(stage, 'definitions'));
        await publish(stage, target, input.assertCurrent);
        return { folderPath: target, data, lastSavedAt: data.updatedAt };
    }
    finally {
        await cleanupStage(stage, target);
    }
}
