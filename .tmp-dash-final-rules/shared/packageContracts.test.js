"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const validation_1 = require("./package/validation");
const commands_1 = require("./episode/commands");
const commands_2 = require("./lesson/commands");
const media_1 = require("./modules/media");
const commands_3 = require("./episode/commands");
const templates_1 = require("./modules/templates");
const episode = () => (0, commands_1.putAdventureDefinition)((0, commands_1.createEpisodeFromScene)((0, commands_2.createLesson)('Portable'), { id: 'a', version: '1' }), { id: 'a', version: '1', name: 'Adventure', description: '', rewards: [], relics: [] });
const hash = '0'.repeat(64);
const manifest = (id) => ({ format: 'story-studio-package', version: 1, episodeId: id, adventure: { id: 'a', version: '1' }, requiredCapabilities: episode().requiredCapabilities, files: [{ path: 'project.json', bytes: 1, sha256: hash }, { path: 'definitions/adventure.json', bytes: 1, sha256: hash }], definitions: [{ kind: 'adventure', adventureId: 'a', version: '1', bundledPath: 'definitions/adventure.json', sha256: hash }], adventureDependencies: [{ adventureId: 'a', version: '1', bundledPath: 'definitions/adventure.json', sha256: hash }] });
(0, node_test_1.default)('portable projection preserves all authored content and rejects private extensions', () => {
    const p = episode(), projected = (0, validation_1.projectPortableProjection)(p);
    strict_1.default.deepEqual(projected, p);
    strict_1.default.notEqual(projected, p);
    strict_1.default.throws(() => (0, validation_1.projectPortableProjection)({ ...p, studentRoster: [{ name: 'Private' }] }));
    strict_1.default.throws(() => (0, validation_1.validatePortableEpisode)({ ...p, adventureDefinition: undefined }));
    const boss = (0, commands_1.putEpisodeActivity)(p, { id: 'boss', moduleType: 'final-boss-hero', moduleVersion: 1, configVersion: 1, config: (0, templates_1.createModuleTemplate)('final-boss-hero') });
    strict_1.default.throws(() => (0, validation_1.validatePortableEpisode)(boss), /builtin/i);
});
(0, node_test_1.default)('manifest rejects unsafe/colliding paths, unknown capabilities and malformed hashes', () => {
    const p = episode(), m = manifest(p.id);
    strict_1.default.deepEqual((0, validation_1.parsePackageManifest)(m), m);
    for (const path of ['../secret', '/absolute', 'C:/secret', 'assets\\bad.png', 'assets/%2e%2e/secret', 'assets/CON.png', 'assets/file.', 'assets/a|b.png', 'assets/a<b.png', 'assets/CONIN$.png'])
        strict_1.default.throws(() => (0, validation_1.parsePackageManifest)({ ...m, files: [...m.files, { path, bytes: 1, sha256: hash }] }));
    strict_1.default.throws(() => (0, validation_1.parsePackageManifest)({ ...m, files: [...m.files, { path: 'PROJECT.JSON', bytes: 1, sha256: hash }] }));
    strict_1.default.throws(() => (0, validation_1.parsePackageManifest)({ ...m, requiredCapabilities: ['unknown'] }));
    strict_1.default.throws(() => (0, validation_1.parsePackageManifest)({ ...m, files: [{ path: 'project.json', bytes: 1, sha256: 'bad' }] }));
});
(0, node_test_1.default)('closure requires exact definition identity and files, including unused authored assets', () => {
    const p = episode(), m = manifest(p.id);
    (0, validation_1.validatePackageClosure)(p, m, p.adventureDefinition);
    strict_1.default.throws(() => (0, validation_1.validatePackageClosure)(p, m, { ...p.adventureDefinition, name: 'Tampered' }));
    p.assets.push({ id: 'unused', relativePath: 'assets/unused.png', filename: 'unused.png', originalName: 'unused.png', mediaType: 'image', sizeBytes: 1, importedAt: '' });
    strict_1.default.throws(() => (0, validation_1.validatePackageClosure)(p, m, p.adventureDefinition));
    const complete = { ...m, files: [...m.files, { path: 'assets/unused.png', bytes: 1, sha256: hash }] };
    (0, validation_1.validatePackageClosure)(p, complete, p.adventureDefinition);
    strict_1.default.throws(() => (0, validation_1.validatePackageClosure)(p, { ...complete, files: [...complete.files, { path: 'assets/private.json', bytes: 1, sha256: hash }] }, p.adventureDefinition));
});
(0, node_test_1.default)('portable closure preserves all modules, derived originals, definitions and unplaced authored media', () => {
    let p = episode();
    p = (0, commands_2.insertScene)(p, 'activation', (0, commands_2.createScene)()).project;
    const sceneId = Object.keys(p.scenes)[0];
    p.assets.push({ id: 'source', relativePath: 'assets/source.png', filename: 'source.png', originalName: 'source.png', mediaType: 'image', sizeBytes: 1, importedAt: '' });
    p = (0, commands_3.putDerivedImage)(p, { id: 'derived', kind: 'derived-image', sourceAssetId: 'source', transform: { version: 1, flipX: true }, presentation: { fit: 'contain' } });
    p = (0, commands_1.putAdventureDefinition)(p, { ...p.adventureDefinition, rewards: [{ id: 'reward', name: 'Same', kind: 'badge', iconAssetId: 'derived' }], relics: [{ id: 'relic', name: 'Same', imageAssetId: 'source', stages: [{ id: 'stage', name: 'Stage', requiredProgress: 2, imageAssetId: 'derived' }] }] });
    p = (0, commands_1.putEpisodeActivity)(p, { id: 'activation', moduleType: 'activation-cards', moduleVersion: 1, configVersion: 1, config: { sceneIds: [sceneId] } });
    p = (0, commands_3.putActivityOccurrence)(p, { id: 'activation-occurrence', activityId: 'activation', section: 'activation' });
    p = (0, commands_1.putEpisodeActivity)(p, { id: 'snake', moduleType: 'language-snake', moduleVersion: 1, configVersion: 1, config: { ...(0, templates_1.createModuleTemplate)('language-snake'), backgroundImage: 'asset:derived' } });
    const boss = (0, media_1.remapModuleAssets)({ id: 'boss', moduleType: 'final-boss-hero', moduleVersion: 1, configVersion: 1, config: (0, templates_1.createModuleTemplate)('final-boss-hero') }, () => 'asset:source');
    p = (0, commands_1.putEpisodeActivity)(p, boss);
    const before = JSON.stringify(p);
    strict_1.default.deepEqual((0, validation_1.validatePortableEpisode)(p), p);
    strict_1.default.equal(JSON.stringify(p), before);
    const m = { ...manifest(p.id), requiredCapabilities: p.requiredCapabilities, files: [...manifest(p.id).files, { path: 'assets/source.png', bytes: 1, sha256: hash }] };
    (0, validation_1.validatePackageClosure)(p, m, p.adventureDefinition);
    strict_1.default.throws(() => (0, validation_1.validatePortableEpisode)({ ...p, assets: [] }));
    strict_1.default.throws(() => (0, validation_1.validatePortableEpisode)({ ...p, assets: p.assets.map(asset => ({ ...asset, mediaType: 'audio' })) }));
});
(0, node_test_1.default)('materialized builtin provenance pins known module version and exact asset file digest', () => {
    const p = episode();
    p.assets.push({ id: 'builtin-start', relativePath: 'assets/start.png', filename: 'start.png', originalName: 'start.png', mediaType: 'image', sizeBytes: 1, importedAt: '' });
    const m = { ...manifest(p.id), files: [...manifest(p.id).files, { path: 'assets/start.png', bytes: 1, sha256: hash }], materializedBuiltins: [{ ref: 'builtin:final-boss-hero/assets/board-dash/start.png', moduleVersion: 1, assetId: 'builtin-start', sha256: hash }] };
    (0, validation_1.validatePackageClosure)(p, m, p.adventureDefinition);
    strict_1.default.throws(() => (0, validation_1.parsePackageManifest)({ ...m, materializedBuiltins: [{ ...m.materializedBuiltins[0], ref: 'builtin:final-boss-hero/unknown.png' }] }));
    strict_1.default.throws(() => (0, validation_1.validatePackageClosure)(p, { ...m, materializedBuiltins: [{ ...m.materializedBuiltins[0], sha256: '1'.repeat(64) }] }, p.adventureDefinition));
    strict_1.default.throws(() => (0, validation_1.parsePackageManifest)({ ...m, materializedBuiltins: [m.materializedBuiltins[0], m.materializedBuiltins[0]] }));
});
