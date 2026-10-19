"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertSceneToEpisode = convertSceneToEpisode;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const validation_1 = require("../shared/lesson/validation");
const validation_2 = require("../shared/episode/validation");
const mediaRegistry_1 = require("../shared/content/mediaRegistry");
const sha256 = (bytes) => (0, node_crypto_1.createHash)('sha256').update(bytes).digest('hex');
const contained = (root, file) => { const rel = node_path_1.default.relative(root, file); return rel !== '' && rel !== '..' && !rel.startsWith(`..${node_path_1.default.sep}`) && !node_path_1.default.isAbsolute(rel); };
async function inventory(root) {
    const files = [];
    const walk = async (folder) => {
        for (const name of (await node_fs_1.promises.readdir(folder)).sort()) {
            const file = node_path_1.default.join(folder, name), stat = await node_fs_1.promises.lstat(file);
            if (stat.isSymbolicLink())
                throw Error('Conversion does not follow symbolic links.');
            if (!contained(root, await node_fs_1.promises.realpath(file)))
                throw Error('Unsafe conversion source path.');
            if (stat.isDirectory())
                await walk(file);
            else if (stat.isFile()) {
                const bytes = await node_fs_1.promises.readFile(file);
                files.push({ path: node_path_1.default.relative(root, file).replaceAll('\\', '/'), bytes: bytes.byteLength, sha256: sha256(bytes) });
            }
            else
                throw Error('Unsupported conversion source file.');
        }
    };
    await walk(root);
    return files;
}
async function copyVerified(source, target, files, includeProject = true) {
    for (const entry of files) {
        if (!includeProject && entry.path === 'project.json')
            continue;
        const bytes = await node_fs_1.promises.readFile(node_path_1.default.join(source, entry.path));
        if (sha256(bytes) !== entry.sha256)
            throw Error('Source changed during conversion.');
        const output = node_path_1.default.join(target, entry.path);
        await node_fs_1.promises.mkdir(node_path_1.default.dirname(output), { recursive: true });
        await node_fs_1.promises.writeFile(output, bytes, { flag: 'wx' });
        if (sha256(await node_fs_1.promises.readFile(output)) !== entry.sha256)
            throw Error('Conversion copy verification failed.');
    }
}
async function convertSceneToEpisode(input) {
    const source = await node_fs_1.promises.realpath(input.source), target = await node_fs_1.promises.realpath(input.target);
    if (source === target || contained(source, target) || contained(target, source))
        throw Error('Choose an empty conversion folder outside the source project.');
    if ((await node_fs_1.promises.readdir(target)).length)
        throw Error('Conversion target must be empty.');
    const scene = (0, validation_1.parseLessonProject)(input.data);
    const onDisk = (0, validation_1.parseLessonProject)(JSON.parse(await node_fs_1.promises.readFile(node_path_1.default.join(source, 'project.json'), 'utf8')));
    if (scene.id !== onDisk.id)
        throw Error('Source project identity changed.');
    const report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data: scene }).dependencies();
    if (report.issues.some(issue => issue.kind === 'unknown-content'))
        throw Error('Unknown authored content blocks conversion.');
    // Explicit field allowlist: session and extension objects are never spread into the envelope.
    const data = (0, validation_2.parseEpisodeProject)({ format: 'story-studio-episode', version: 1, id: scene.id, title: scene.title, createdAt: scene.createdAt, updatedAt: scene.updatedAt,
        assets: scene.assets, mediaBins: scene.mediaBins, scenes: scene.scenes, sequences: scene.sequences, sections: scene.sections, cards: scene.cards, library: scene.library, cardSets: scene.cardSets,
        adventure: input.adventure, requiredCapabilities: ['derived-images-v1', 'manual-catalog-v1'], derivedImages: [], catalog: { entities: [] } });
    const files = await inventory(source);
    for (const asset of scene.assets)
        if (!files.some(file => file.path === asset.relativePath))
            throw Error(`Missing source media: ${asset.relativePath}`);
    const backupPath = node_path_1.default.join(input.backupRoot, (0, node_crypto_1.randomUUID)());
    await node_fs_1.promises.mkdir(backupPath, { recursive: true });
    await copyVerified(source, node_path_1.default.join(backupPath, 'source'), files);
    await node_fs_1.promises.writeFile(node_path_1.default.join(backupPath, 'source-manifest.json'), JSON.stringify({ version: 1, source, files }, null, 2), { flag: 'wx' });
    await node_fs_1.promises.writeFile(node_path_1.default.join(backupPath, 'authored-snapshot.json'), JSON.stringify(scene, null, 2), { flag: 'wx' });
    await copyVerified(source, target, files, false);
    if (JSON.stringify(await inventory(source)) !== JSON.stringify(files))
        throw Error('Source changed during conversion.');
    const migrationReport = node_path_1.default.join(backupPath, 'conversion-report.json');
    await node_fs_1.promises.writeFile(migrationReport, JSON.stringify({ version: 1, source, target, backupPath, sourceFormat: scene.format, targetFormat: data.format, files }, null, 2), { flag: 'wx' });
    const lastSavedAt = await input.writeAtomic(target, data, true);
    return { folderPath: target, data, lastSavedAt, backupPath, migrationReport };
}
