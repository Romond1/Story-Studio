"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectPortableProjection = void 0;
exports.isSafePackagePath = isSafePackagePath;
exports.parsePackageManifest = parsePackageManifest;
exports.projectAuthoredEpisode = projectAuthoredEpisode;
exports.validatePortableEpisode = validatePortableEpisode;
exports.validatePackageClosure = validatePackageClosure;
const validation_1 = require("../definitions/validation");
const validation_2 = require("../episode/validation");
const mediaRegistry_1 = require("../content/mediaRegistry");
const checks_1 = require("../modules/checks");
const model_1 = require("./model");
/** Canonical package paths deliberately exclude URL encodings and platform aliases. */
function isSafePackagePath(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 500 && !/[\\%\x00-\x1f\x7f:?#<>"|*]/.test(value) && !value.startsWith('/') && value.split('/').every(segment => !!segment && segment !== '.' && segment !== '..' && !/[. ]$/.test(segment) && !/^(con|conin\$|conout\$|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(segment));
}
const packagePath = (v, p) => { if (!isSafePackagePath(v))
    (0, checks_1.fail)(p); };
const hash = (v, p) => { if (typeof v !== 'string' || !/^[0-9a-f]{64}$/.test(v))
    (0, checks_1.fail)(p); };
const version = (v, p) => { if (v !== 1)
    (0, checks_1.fail)(p); };
const definitionRef = { adventureId: checks_1.identity, version: checks_1.identity, bundledPath: packagePath, sha256: hash };
function parsePackageManifest(value) {
    (0, checks_1.shape)({ format: (0, checks_1.one)(['story-studio-package']), version, episodeId: checks_1.identity, adventure: (0, checks_1.shape)({ id: checks_1.identity, version: checks_1.identity }), requiredCapabilities: (0, checks_1.arr)((0, checks_1.one)(model_1.PACKAGE_CAPABILITIES)), files: (0, checks_1.arr)((0, checks_1.shape)({ path: packagePath, bytes: (0, checks_1.num)(0, model_1.PACKAGE_LIMITS.maxFileBytes, true), sha256: hash }), 2, model_1.PACKAGE_LIMITS.maxFiles), definitions: (0, checks_1.arr)((0, checks_1.shape)({ kind: (0, checks_1.one)(['adventure']), ...definitionRef }), 1, 1), adventureDependencies: (0, checks_1.arr)((0, checks_1.shape)(definitionRef), 1, 1) }, { materializedBuiltins: (0, checks_1.arr)((0, checks_1.shape)({ ref: (0, checks_1.one)(model_1.BOSS_BUILTIN_REFS), moduleVersion: version, assetId: checks_1.identity, sha256: hash }), 0, 7) })(value, 'package manifest');
    const m = JSON.parse(JSON.stringify(value));
    (0, checks_1.unique)((m.materializedBuiltins ?? []).map(ref => ref.ref), 'materialized builtin refs');
    (0, checks_1.unique)((m.materializedBuiltins ?? []).map(ref => ref.assetId), 'materialized builtin assets');
    (0, checks_1.unique)(m.requiredCapabilities, 'package capabilities');
    (0, checks_1.unique)(m.files.map(file => file.path.normalize('NFC').toLowerCase()), 'package file paths');
    if (m.files.some(file => file.path === 'manifest.json') || m.files.reduce((sum, file) => sum + file.bytes, 0) > model_1.PACKAGE_LIMITS.maxTotalBytes)
        (0, checks_1.fail)('package file budget');
    if (m.files.some(file => ['project.json', model_1.ADVENTURE_DEFINITION_PATH].includes(file.path) && file.bytes > model_1.PACKAGE_LIMITS.maxJsonBytes))
        (0, checks_1.fail)('package JSON budget');
    if (!m.files.some(file => file.path === 'project.json'))
        (0, checks_1.fail)('project.json');
    const d = m.definitions[0], a = m.adventureDependencies[0], file = m.files.find(file => file.path === model_1.ADVENTURE_DEFINITION_PATH);
    if (!file || d.bundledPath !== model_1.ADVENTURE_DEFINITION_PATH || a.bundledPath !== model_1.ADVENTURE_DEFINITION_PATH || d.adventureId !== m.adventure.id || a.adventureId !== m.adventure.id || d.version !== m.adventure.version || a.version !== m.adventure.version || d.sha256 !== file.sha256 || a.sha256 !== file.sha256)
        (0, checks_1.fail)('adventure snapshot reference');
    return m;
}
/** Reject unknown input fields first, then construct an exact authored-field projection. */
function projectAuthoredEpisode(value) {
    const p = (0, validation_2.parseEpisodeProject)(value);
    return (0, validation_2.parseEpisodeProject)({ format: 'story-studio-episode', version: 1, id: p.id, title: p.title, createdAt: p.createdAt, updatedAt: p.updatedAt,
        assets: p.assets, mediaBins: p.mediaBins, scenes: p.scenes, sequences: p.sequences, ...(p.sections ? { sections: p.sections } : {}), cards: p.cards, library: p.library, cardSets: p.cardSets,
        adventure: p.adventure, requiredCapabilities: p.requiredCapabilities, derivedImages: p.derivedImages, catalog: p.catalog,
        ...(p.activities ? { activities: p.activities } : {}), ...(p.occurrences ? { occurrences: p.occurrences } : {}), ...(p.adventureDefinition ? { adventureDefinition: p.adventureDefinition } : {}) });
}
exports.projectPortableProjection = projectAuthoredEpisode;
function validatePortableEpisode(value) {
    const p = projectAuthoredEpisode(value);
    if (!p.adventureDefinition)
        throw new Error('Portable episode requires an explicit adventure definition snapshot');
    const registry = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data: p }), report = registry.dependencies();
    if (registry.diagnostics().length)
        throw new Error(`Portable media registry: ${registry.diagnostics()[0].kind}`);
    if (!report.complete || report.issues.length)
        throw new Error(`Portable dependency unresolved: ${report.issues[0]?.kind ?? 'unknown'} ${report.issues[0]?.field ?? ''}`);
    (0, checks_1.unique)(p.assets.map(asset => asset.relativePath.normalize('NFC').toLowerCase()), 'portable asset paths');
    for (const asset of p.assets)
        if (!isSafePackagePath(asset.relativePath) || !asset.relativePath.startsWith('assets/'))
            (0, checks_1.fail)('portable asset path');
    return p;
}
function canonical(value) { if (Array.isArray(value))
    return `[${value.map(canonical).join(',')}]`; if (value && typeof value === 'object')
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`; return JSON.stringify(value); }
function validatePackageClosure(episode, manifest, definition) {
    const p = validatePortableEpisode(episode), m = parsePackageManifest(manifest), d = (0, validation_1.parseAdventureDefinition)(definition);
    if (m.episodeId !== p.id || m.adventure.id !== p.adventure.id || m.adventure.version !== p.adventure.version)
        (0, checks_1.fail)('package episode identity');
    if (canonical(d) !== canonical(p.adventureDefinition))
        (0, checks_1.fail)('package adventure definition agreement');
    if (canonical([...m.requiredCapabilities].sort()) !== canonical([...p.requiredCapabilities].sort()))
        (0, checks_1.fail)('package capability agreement');
    for (const builtin of m.materializedBuiltins ?? []) {
        const asset = p.assets.find(asset => asset.id === builtin.assetId);
        if (!asset || asset.mediaType !== 'image' || m.files.find(file => file.path === asset.relativePath)?.sha256 !== builtin.sha256)
            (0, checks_1.fail)('materialized builtin asset digest');
    }
    const expected = ['project.json', model_1.ADVENTURE_DEFINITION_PATH, ...p.assets.map(asset => asset.relativePath)];
    if (expected.length !== m.files.length || expected.some(path => !m.files.some(file => file.path === path)))
        (0, checks_1.fail)('package complete file closure');
    for (const asset of p.assets)
        if (m.files.find(file => file.path === asset.relativePath)?.bytes !== asset.sizeBytes)
            (0, checks_1.fail)('package asset byte metadata');
}
