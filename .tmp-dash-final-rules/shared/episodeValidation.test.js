"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodeFixture = episodeFixture;
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const commands_1 = require("./lesson/commands");
const validation_1 = require("./lesson/validation");
const commands_2 = require("./episode/commands");
const validation_2 = require("./episode/validation");
const mediaRegistry_1 = require("./content/mediaRegistry");
function episodeFixture() {
    const scene = (0, commands_1.createLesson)('Source');
    scene.assets = [{ id: 'physical', filename: 'source.png', originalName: 'source.png', relativePath: 'assets/source.png', mediaType: 'image', sizeBytes: 16, importedAt: '' }];
    return (0, commands_2.createEpisodeFromScene)(scene, { id: 'adventure', version: '1' });
}
(0, node_test_1.default)('episode discriminator never enters scene reader; strict capabilities and media identities', () => {
    const episode = episodeFixture(), before = JSON.stringify(episode);
    strict_1.default.throws(() => (0, validation_1.parseLessonProject)(episode), /format/);
    strict_1.default.equal((0, validation_1.parseSceneDocument)(episode).format, 'story-studio-episode');
    strict_1.default.equal(JSON.stringify(episode), before);
    for (const patch of [{ version: 2 }, { requiredCapabilities: ['unknown'] }, { derivedImages: [{ id: 'physical', kind: 'derived-image', sourceAssetId: 'physical', transform: { version: 1 }, presentation: { fit: 'contain' } }] }])
        strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...episode, ...patch }));
});
(0, node_test_1.default)('derived references accept physical images only and unify background/card/image lookup', () => {
    const episode = (0, commands_2.putDerivedImage)(episodeFixture(), { id: 'derived', kind: 'derived-image', sourceAssetId: 'physical', transform: { version: 1, rotation: 90 }, presentation: { fit: 'contain' } });
    const scene = (0, commands_1.createScene)('Derived', 'derived');
    const withScene = (0, commands_1.insertScene)(episode, 'story', scene).project;
    strict_1.default.equal((0, validation_2.parseEpisodeProject)(withScene).scenes[scene.id].background.assetId, 'derived');
    const registry = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data: withScene });
    strict_1.default.deepEqual(registry.images().map(item => item.id), ['physical', 'derived']);
    strict_1.default.equal(registry.list().length, 1);
    strict_1.default.equal(registry.usages('physical').length, 1);
    strict_1.default.equal(registry.usages('derived').length, 1);
    for (const source of ['missing', 'derived'])
        strict_1.default.throws(() => (0, commands_2.putDerivedImage)(episode, { ...episode.derivedImages[0], sourceAssetId: source }));
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...episode, assets: episode.assets.map(a => ({ ...a, mediaType: 'audio' })) }));
});
(0, node_test_1.default)('catalog identity is scoped, duplicate display names are valid and unknown fields refuse', () => {
    let episode = (0, commands_2.putCatalogEntity)(episodeFixture(), { id: 'one', adventureId: 'adventure', kind: 'character', name: 'Same', tags: [], assetIds: ['physical'] });
    episode = (0, commands_2.putCatalogEntity)(episode, { id: 'two', adventureId: 'adventure', kind: 'location', name: 'Same', tags: [], assetIds: [] });
    strict_1.default.equal(episode.catalog.entities.length, 2);
    strict_1.default.throws(() => (0, commands_2.putCatalogEntity)(episode, { ...episode.catalog.entities[0], adventureId: 'other' }));
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...episode, session: { students: ['private'] } }), /field/);
    const other = (0, commands_2.createEpisodeFromScene)((0, commands_1.createLesson)('Other'), { id: 'other', version: '1' });
    const sameName = (0, commands_2.putCatalogEntity)(other, { id: 'one', adventureId: 'other', kind: 'character', name: 'Same', tags: [], assetIds: [] });
    strict_1.default.equal(sameName.catalog.entities[0].name, episode.catalog.entities[0].name);
    strict_1.default.throws(() => (0, commands_2.putCatalogEntity)(episode, sameName.catalog.entities[0]), /adventure/);
});
(0, node_test_1.default)('episode nested unknown payloads cannot become hidden runtime or unsupported content', () => {
    const scene = (0, commands_1.createScene)('Scene');
    const episode = (0, commands_1.insertScene)(episodeFixture(), 'story', scene).project;
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...episode, scenes: { [scene.id]: { ...scene, studentProgress: { a: 10 } } } }), /field/);
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...episode, assets: episode.assets.map(asset => ({ ...asset, derivedTransform: { rotation: 45 } })) }), /field/);
});
