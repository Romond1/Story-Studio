"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaRegistry_1 = require("./content/mediaRegistry");
const commands_1 = require("./lesson/commands");
const asset = (id, relativePath = `assets/${id}.png`) => ({ id, relativePath, filename: 'same.png', originalName: 'same.png', mediaType: 'image', sizeBytes: 1, importedAt: '' });
(0, node_test_1.default)('registry snapshots records, preserves unplaced cards and counts authored definitions once', () => {
    const data = (0, commands_1.createLesson)('proof');
    const scene = (0, commands_1.createScene)('story', 'image');
    scene.id = 'story';
    data.scenes.story = scene;
    data.assets = [asset('image'), asset('other')];
    data.sequences.story = [{ id: 'one', sceneId: 'story', section: '' }, { id: 'two', sceneId: 'story', section: '' }];
    data.cards.recall = { id: 'recall', label: 'Recall', tags: [], style: { preset: 'classroom' }, faces: [{ id: 'face', label: 'Face', layout: 'image-only', imageAssetId: 'image' }] };
    const before = JSON.stringify(data), registry = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data });
    strict_1.default.deepEqual(registry.usages('image').map(use => use.field).sort(), ['/cards/recall/faces/0/imageAssetId', '/scenes/story/background/assetId']);
    strict_1.default.equal(registry.list().length, 2);
    strict_1.default.equal(registry.get('image'), registry.list()[0]);
    strict_1.default.equal(JSON.stringify(data), before);
    strict_1.default.ok(Object.isFrozen(registry.list()));
    strict_1.default.ok(Object.isFrozen(registry.get('image')));
    data.assets[0].filename = 'changed';
    strict_1.default.equal(registry.get('image')?.filename, 'same.png');
});
(0, node_test_1.default)('duplicates, path aliases and broken bin ancestry never pick an arbitrary record', () => {
    const data = (0, commands_1.createLesson)('proof');
    data.assets = [asset('dup'), asset('dup'), asset('a', 'assets/shared.png'), asset('b', 'assets/shared.png')];
    data.mediaBins = [{ id: 'a', name: 'A', parentId: 'b' }, { id: 'b', name: 'B', parentId: 'a' }, { id: 'c', name: 'C', parentId: 'missing' }];
    const registry = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data });
    strict_1.default.equal(registry.get('dup'), undefined);
    strict_1.default.equal(registry.resolvePath('media://assets/shared.png').ok, false);
    for (const kind of ['duplicate-id', 'ambiguous-path', 'bin-cycle', 'missing-bin'])
        strict_1.default.ok(registry.diagnostics().some(issue => issue.kind === kind), kind);
});
(0, node_test_1.default)('path resolution is exact and reports type failures without conflating names', () => {
    const data = (0, commands_1.createLesson)('proof');
    data.assets = [asset('image', 'assets/a.png'), asset('other', 'assets/a.png.bak')];
    const registry = (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data });
    strict_1.default.deepEqual(registry.resolvePath('media:///assets/a.png?render=2'), { ok: true, assetId: 'image', mediaType: 'image', url: 'media://assets/a.png' });
    strict_1.default.deepEqual(registry.resolvePath('assets/a.png', 'audio'), { ok: false, code: 'wrong-type', assetId: 'image' });
    strict_1.default.deepEqual(registry.resolvePath('a.png'), { ok: false, code: 'unregistered' });
});
