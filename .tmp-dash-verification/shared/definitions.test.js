"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const validation_1 = require("./definitions/validation");
const commands_1 = require("./episode/commands");
const commands_2 = require("./lesson/commands");
const validation_2 = require("./episode/validation");
const definition = () => ({ id: 'adventure', version: '1', name: 'World', description: 'Story', rewards: [{ id: 'gem', name: 'Same name', kind: 'collectible' }], relics: [{ id: 'relic', name: 'Same name', stages: [{ id: 'one', name: 'One', requiredProgress: 1 }, { id: 'two', name: 'Two', requiredProgress: 3 }] }] });
(0, node_test_1.default)('adventure definitions are authored, strictly versioned, and reject nested private state', () => {
    strict_1.default.deepEqual((0, validation_1.parseAdventureDefinition)(definition()), definition());
    for (const bad of [{ ...definition(), studentProgress: {} }, { ...definition(), rewards: [{ ...definition().rewards[0], balance: 2 }] }, { ...definition(), relics: [{ ...definition().relics[0], progress: 1 }] }])
        strict_1.default.throws(() => (0, validation_1.parseAdventureDefinition)(bad));
    strict_1.default.throws(() => (0, validation_1.parseAdventureDefinition)({ ...definition(), rewards: [definition().rewards[0], definition().rewards[0]] }));
    strict_1.default.throws(() => (0, validation_1.parseAdventureDefinition)({ ...definition(), relics: [{ ...definition().relics[0], stages: [{ id: 'one', name: 'One', requiredProgress: 3 }, { id: 'two', name: 'Two', requiredProgress: 2 }] }] }));
});
(0, node_test_1.default)('definition command preserves immutable episode and validates adventure identity/capability/media', () => {
    const before = (0, commands_1.createEpisodeFromScene)((0, commands_2.createLesson)('Episode'), { id: 'adventure', version: '1' });
    const next = (0, commands_1.putAdventureDefinition)(before, definition());
    strict_1.default.equal(before.adventureDefinition, undefined);
    strict_1.default.ok(next.requiredCapabilities.includes('adventure-definitions-v1'));
    strict_1.default.throws(() => (0, commands_1.putAdventureDefinition)(before, { ...definition(), id: 'different' }));
    strict_1.default.throws(() => (0, commands_1.putAdventureDefinition)(before, { ...definition(), version: '2' }));
    strict_1.default.throws(() => (0, validation_2.parseEpisodeProject)({ ...next, requiredCapabilities: [] }));
    strict_1.default.throws(() => (0, commands_1.putAdventureDefinition)(before, { ...definition(), rewards: [{ id: 'gem', name: 'Gem', kind: 'badge', iconAssetId: 'missing' }] }));
});
(0, node_test_1.default)('clearing optional definition images removes the authored property', () => {
    const parsed = (0, validation_1.parseAdventureDefinition)({ ...definition(), rewards: [{ ...definition().rewards[0], iconAssetId: undefined }], relics: [{ ...definition().relics[0], imageAssetId: undefined, stages: [{ ...definition().relics[0].stages[0], imageAssetId: undefined }] }] });
    strict_1.default.ok(!Object.hasOwnProperty.call(parsed.rewards[0], 'iconAssetId'));
    strict_1.default.ok(!Object.hasOwnProperty.call(parsed.relics[0], 'imageAssetId'));
});
