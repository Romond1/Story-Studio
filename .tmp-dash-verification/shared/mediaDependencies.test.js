"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaRegistry_1 = require("./content/mediaRegistry");
(0, node_test_1.default)('legacy authored media fields use exact typed matching including unused definitions', () => {
    const data = { version: 4, createdAt: '', updatedAt: '', assets: [{ id: 'img', relativePath: 'assets/a.png', filename: 'a', originalName: 'a', mediaType: 'image', sizeBytes: 1, importedAt: '' }], slides: [{ id: 'slide', assetId: 'img', sectionId: 's', transition: 'none', name: 'prose assets/a.png', dialogue: [{ url: 'media:///assets/a.png?q=1', volume: 1 }], audioCues: [{ id: 'cue', kind: 'sfx', label: '', timeSec: 0, targetAssetId: 'img', targetUrl: 'assets/a.png' }], overlays: [{ id: 'bubble', type: 'speechBubble', customImageSrc: 'assets/a.png', text: '', x: 0, y: 0, width: 1, height: 1 }] }], sections: [{ id: 's', name: 'S', background: 'url("media://assets/a.png")', bgm: [{ url: 'assets/a.png', volume: 1 }] }], aCardLibrary: { a: { id: 'a', background: { imageId: 'img' }, bCardInstances: [] } }, bCardLibrary: { b: { id: 'b', front: { imageId: 'img' }, back: { imageId: 'img' }, audioRefId: 'img' } }, bubbleDefinitions: [{ templateName: 'b', imageSrc: 'assets/a.png' }], badgeImageAssetId: 'img', badgeConfig: { background: { assetId: 'img' }, tabBackground: { assetId: 'img' }, badgeSparkAssetIds: { gold: 'img' }, badgeSprites: [{ id: 'sprite', assetId: 'img' }] }, relicSystem: { mainImageAssetId: 'img', stageImageAssetIds: { stage1: 'img' } }, movement: { events: [{ id: 'move', gifRelativePath: 'assets/a.png' }], jingleRelativePath: 'assets/a.png' } };
    const report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).dependencies();
    strict_1.default.equal(report.uses.length, 21);
    strict_1.default.equal(report.complete, true);
    strict_1.default.equal(report.issues.length, 0);
});
(0, node_test_1.default)('Card V2 unplaced faces and content links are enumerated once', () => {
    const data = { version: 4, createdAt: '', updatedAt: '', assets: [{ id: 'image', relativePath: 'assets/image.png', mediaType: 'image' }], slides: [], sections: [], cardsV2: { engine: 'card-v2', version: 1, cards: { unplaced: { id: 'unplaced', label: 'Card', tags: [], style: { preset: 'classroom' }, faces: [{ id: 'face', label: 'Face', layout: 'image-only', imageAssetId: 'image' }] } }, sets: { set: { id: 'set', entries: [{ id: 'entry', cardId: 'missing' }] } }, activities: { activity: { id: 'activity', setId: 'missing', instances: [{ id: 'instance', cardId: 'unplaced', initialFaceId: 'missing' }] } }, placements: { placement: { id: 'placement', activityId: 'missing' } } }, boostPack: { activationSequence: [{ id: 'a', type: 'slideRef', slideId: 'missing' }, { id: 'b', type: 'aCardRef', aCardId: 'missing' }, { id: 'c', type: 'cardActivityRef', placementId: 'missing' }], languageSequence: [], gamesSequence: [] } };
    const report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).dependencies();
    strict_1.default.deepEqual(report.uses.map(use => use.field), ['/cardsV2/cards/unplaced/faces/0/imageAssetId']);
    strict_1.default.equal(report.issues.filter(issue => issue.kind === 'missing-id').length, 7);
    strict_1.default.equal(report.complete, false);
});
(0, node_test_1.default)('explicit builtins are complete but path-only files remain unregistered', () => {
    const data = { version: 4, createdAt: '', updatedAt: '', assets: [], slides: [], sections: [], movement: { jingleRelativePath: 'assets/jingle.mp3', events: [{ id: 'run', gifRelativePath: 'assets/run.gif' }] } };
    let report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).dependencies();
    strict_1.default.equal(report.complete, true);
    strict_1.default.equal(report.issues.length, 2);
    strict_1.default.ok(report.issues.every(issue => issue.kind === 'builtin'));
    data.movement.events[0].gifRelativePath = 'assets/bubbles/custom.png';
    report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).dependencies();
    strict_1.default.equal(report.complete, false);
    strict_1.default.equal(data.assets.length, 0);
});
(0, node_test_1.default)('unknown extensions, missing links and unresolved local/external media are explicit', () => {
    const data = { version: 4, createdAt: '', updatedAt: '', assets: [], slides: [{ id: 's', assetId: 'missing', dialogue: [{ url: 'assets/bubbles/custom.png' }, { url: 'https://example.com/a' }, { url: 'data:image/png;base64,a' }] }], sections: [], module: { image: 'assets/hidden.png' } };
    const before = JSON.stringify(data), report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).dependencies();
    for (const kind of ['missing-id', 'unregistered-local', 'external-url', 'embedded-data', 'unknown-content'])
        strict_1.default.ok(report.issues.some(issue => issue.kind === kind), kind);
    strict_1.default.equal(report.complete, false);
    strict_1.default.equal(JSON.stringify(data), before);
});
(0, node_test_1.default)('unknown nested authored extension payloads cannot silently claim complete coverage', () => {
    const data = { version: 4, createdAt: '', updatedAt: '', assets: [], slides: [{ id: 'slide', extension: { image: 'assets/a.png' }, bgm: { url: '', plugin: { src: 'assets/hidden.mp3' } } }], sections: [], badgeConfig: { background: { extension: { image: 'assets/hidden.png' } } }, movement: { events: [{ id: 'move', module: { src: 'assets/hidden.gif' } }] } };
    const report = (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).dependencies();
    strict_1.default.equal(report.complete, false);
    strict_1.default.ok(report.issues.some(issue => issue.field === '/slides/0/extension' && issue.kind === 'unknown-content'));
    for (const field of ['/slides/0/bgm/plugin', '/badgeConfig/background/extension', '/movement/events/0/module'])
        strict_1.default.ok(report.issues.some(issue => issue.field === field), field);
});
