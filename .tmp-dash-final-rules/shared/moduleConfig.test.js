"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mediaRegistry_1 = require("./content/mediaRegistry");
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const templates_1 = require("./modules/templates");
const validation_1 = require("./modules/validation");
const media_1 = require("./modules/media");
const commands_1 = require("./episode/commands");
const commands_2 = require("./lesson/commands");
const validation_2 = require("./episode/validation");
(0, node_test_1.default)('strict module authored schemas reject runtime and names without falling back', () => {
    for (const type of ['language-snake', 'final-boss-hero', 'activation-cards']) {
        const config = (0, templates_1.createModuleTemplate)(type);
        strict_1.default.deepEqual((0, validation_1.parseModuleConfig)(type, config), config);
        strict_1.default.throws(() => (0, validation_1.parseModuleConfig)(type, { ...config, session: { scores: 1 } }));
    }
    const snake = (0, templates_1.createModuleTemplate)('language-snake');
    strict_1.default.throws(() => (0, validation_1.parseModuleConfig)('language-snake', { ...snake, setup: { ...snake.setup, playerNames: ['Private'] } }));
    strict_1.default.throws(() => (0, validation_1.parseModuleConfig)('language-snake', { ...snake, backgroundImage: 'story-media://scope/file.png' }));
    const boss = (0, templates_1.createModuleTemplate)('final-boss-hero');
    strict_1.default.throws(() => (0, validation_1.parseModuleConfig)('final-boss-hero', { ...boss, cardLibrary: [] }));
});
(0, node_test_1.default)('typed media enumeration and remapping preserve nonmedia text and original', () => {
    const config = (0, templates_1.createModuleTemplate)('final-boss-hero');
    config.cardLibrary[0].image = 'asset:picture';
    config.cardLibrary[0].description = 'asset:not-media';
    const activity = { id: 'boss', moduleType: 'final-boss-hero', moduleVersion: 1, configVersion: 1, config };
    const before = JSON.stringify(activity);
    const refs = (0, media_1.collectModuleAssets)(activity);
    strict_1.default.ok(refs.some(ref => ref.assetId === 'picture'));
    strict_1.default.ok(!refs.some(ref => ref.assetId === 'not-media'));
    const mapped = (0, media_1.remapModuleAssets)(activity, ref => ref === 'asset:picture' ? 'asset:replacement' : ref);
    strict_1.default.equal(mapped.config.cardLibrary[0].image, 'asset:replacement');
    strict_1.default.equal(JSON.stringify(activity), before);
});
(0, node_test_1.default)('episode activities preserve order and require capability and valid references', () => {
    const original = (0, commands_1.createEpisodeFromScene)((0, commands_2.createLesson)('Episode'), { id: 'adventure', version: '1' });
    let p = (0, commands_1.putEpisodeActivity)(original, { id: 'snake', moduleType: 'language-snake', moduleVersion: 1, configVersion: 1, config: (0, templates_1.createModuleTemplate)('language-snake') });
    p = (0, commands_1.putActivityOccurrence)(p, { id: 'first', activityId: 'snake', section: 'challenge' });
    p = (0, commands_1.putActivityOccurrence)(p, { id: 'second', activityId: 'snake', section: 'challenge' });
    strict_1.default.deepEqual(p.occurrences?.map(x => x.id), ['first', 'second']);
    strict_1.default.equal(original.activities, undefined);
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...p, requiredCapabilities: [] }));
    strict_1.default.throws(() => (0, commands_1.putActivityOccurrence)(p, { id: 'bad', activityId: 'missing', section: 'mastery' }));
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...p, activities: [...p.activities, p.activities[0]] }));
});
(0, node_test_1.default)('Final Boss preserves all optional authoring fields and enumerates every media-bearing field', () => {
    const config = (0, templates_1.createModuleTemplate)('final-boss-hero'), e = config.encounter, c = config.cardLibrary[0];
    Object.assign(c, { description: 'Detail', frontImage: 'asset:front', backImage: 'asset:back', frontText: 'Prompt', backText: 'Answer', textColor: '#ffcc00', fontSize: 24, textAlign: 'center', cardWidth: 240, cardHeight: 320, miniGames: ['boardDash'], boardDashQuestion: 'Question' });
    e.hero.portrait = 'asset:hero';
    e.hero.video = 'asset:heroVideo';
    e.villain.portrait = 'asset:villain';
    e.villain.video = 'asset:villainVideo';
    e.introSetup.heroes = [{ id: 'hero-option', name: 'Hero', portrait: 'asset:option', video: 'asset:optionVideo', subtitle: 'Story' }];
    e.background = 'asset:background';
    e.gameBackgrounds = { memoryReveal: 'asset:memory', matchPairs: 'asset:pairs', laneBattle: 'asset:lane', openBox: 'asset:box', boardDash: 'asset:board' };
    e.cutscenes = [{ id: 'cut', name: 'Movie', mediaSource: 'asset:movie', mediaType: 'video', description: 'Movie description', tags: ['tag'] }];
    e.rewards = [{ id: 'reward', name: 'Gem', description: 'Reward', value: 2, icon: 'asset:icon', category: 'item', applicableGames: ['boardDash'], effectType: 'custom', effectValue: 3 }];
    e.powerUps = [{ id: 'power', name: 'Power', description: 'Power', charges: 2, energyCost: 1, icon: '⭐', category: 'magic', applicableGames: ['matchPairs'], effectType: 'heal', effectValue: 5 }];
    e.actionItems = [{ id: 'action', text: 'Jump', emoji: '⭐', category: 'movement' }];
    strict_1.default.deepEqual((0, validation_1.parseModuleConfig)('final-boss-hero', config), config);
    const refs = (0, media_1.collectModuleAssets)({ id: 'boss', moduleType: 'final-boss-hero', moduleVersion: 1, configVersion: 1, config });
    strict_1.default.equal(refs.filter(r => r.assetId).length, 16);
    strict_1.default.ok(!refs.some(r => r.ref === '⭐'));
    for (const bad of ['https://remote/image.png', 'data:image/png;base64,x', 'assets/local.png', 'builtin:final-boss-hero/unknown.png'])
        strict_1.default.throws(() => (0, validation_1.parseModuleConfig)('final-boss-hero', { ...config, encounter: { ...e, background: bad } }));
});
(0, node_test_1.default)('module dependencies cover unplaced activities and flag unknown authored config', () => {
    const episode = (0, commands_1.createEpisodeFromScene)((0, commands_2.createLesson)('Dependencies'), { id: 'a', version: '1' });
    episode.assets.push({ id: 'background', filename: 'bg.png', originalName: 'bg.png', relativePath: 'assets/bg.png', mediaType: 'image', sizeBytes: 1, importedAt: '' });
    const config = (0, templates_1.createModuleTemplate)('language-snake');
    config.backgroundImage = 'asset:background';
    config.questionText = 'asset:not-media';
    const project = (0, commands_1.putEpisodeActivity)(episode, { id: 'unused', moduleType: 'language-snake', moduleVersion: 1, configVersion: 1, config });
    const report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data: project }).dependencies();
    strict_1.default.equal(report.complete, true);
    strict_1.default.ok(report.uses.some(use => use.ownerType === 'module' && use.assetId === 'background'));
    strict_1.default.ok(!report.uses.some(use => use.assetId === 'not-media'));
    project.activities[0].config.futureMedia = { image: 'asset:hidden' };
    strict_1.default.equal((0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data: project }).dependencies().complete, false);
});
(0, node_test_1.default)('activity reward bindings require declared source keys and exact adventure reward identities', () => {
    const original = (0, commands_1.createEpisodeFromScene)((0, commands_2.createLesson)('Bindings'), { id: 'a', version: '1' });
    const p = { ...original, requiredCapabilities: [...original.requiredCapabilities, 'adventure-definitions-v1'], adventureDefinition: { id: 'a', version: '1', name: 'A', description: '', rewards: [{ id: 'gem', name: 'Crown', kind: 'badge' }], relics: [] } };
    const activity = { id: 'snake', moduleType: 'language-snake', moduleVersion: 1, configVersion: 1, config: (0, templates_1.createModuleTemplate)('language-snake'), rewardBindings: { 'hero-crown': 'gem' } };
    strict_1.default.equal((0, commands_1.putEpisodeActivity)(p, activity).activities?.[0].rewardBindings?.['hero-crown'], 'gem');
    strict_1.default.throws(() => (0, commands_1.putEpisodeActivity)(p, { ...activity, rewardBindings: { unknown: 'gem' } }));
    strict_1.default.throws(() => (0, commands_1.putEpisodeActivity)(p, { ...activity, rewardBindings: { 'hero-crown': 'Crown' } }));
    strict_1.default.throws(() => (0, commands_1.putEpisodeActivity)(original, activity));
});
