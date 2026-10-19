"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAdventureDefinition = parseAdventureDefinition;
exports.collectDefinitionAssets = collectDefinitionAssets;
const checks_1 = require("../modules/checks");
const optionalImage = (value, path) => { if (value !== undefined)
    (0, checks_1.identity)(value, path); };
const label = (value, path) => { (0, checks_1.str)(value, path); if (typeof value !== 'string' || !value.trim() || value.length > 500)
    (0, checks_1.fail)(path); };
function parseAdventureDefinition(value) {
    (0, checks_1.shape)({ id: checks_1.identity, version: checks_1.identity, name: label, description: checks_1.str, rewards: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: label, kind: (0, checks_1.one)(['collectible', 'currency', 'badge']) }, { iconAssetId: optionalImage })), relics: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: label, stages: (0, checks_1.arr)((0, checks_1.shape)({ id: checks_1.identity, name: label, requiredProgress: (0, checks_1.num)(1, 1000000000, true) }, { imageAssetId: optionalImage }), 1, 1000) }, { imageAssetId: optionalImage })) })(value, 'adventureDefinition');
    const definition = JSON.parse(JSON.stringify(value));
    (0, checks_1.unique)(definition.rewards.map(item => item.id), 'reward identity');
    (0, checks_1.unique)(definition.relics.map(item => item.id), 'relic identity');
    for (const relic of definition.relics) {
        (0, checks_1.unique)(relic.stages.map(stage => stage.id), 'relic stage identity');
        if (relic.stages.some((stage, i) => i > 0 && stage.requiredProgress <= relic.stages[i - 1].requiredProgress))
            (0, checks_1.fail)('relic stage thresholds');
    }
    return definition;
}
function collectDefinitionAssets(definition) {
    const refs = [];
    definition.rewards.forEach((reward, i) => { if (reward.iconAssetId)
        refs.push({ ownerType: 'reward', ownerId: reward.id, assetId: reward.iconAssetId, field: `/adventureDefinition/rewards/${i}/iconAssetId` }); });
    definition.relics.forEach((relic, i) => { if (relic.imageAssetId)
        refs.push({ ownerType: 'relic', ownerId: relic.id, assetId: relic.imageAssetId, field: `/adventureDefinition/relics/${i}/imageAssetId` }); relic.stages.forEach((stage, j) => { if (stage.imageAssetId)
        refs.push({ ownerType: 'relic', ownerId: relic.id, assetId: stage.imageAssetId, field: `/adventureDefinition/relics/${i}/stages/${j}/imageAssetId` }); }); });
    return refs;
}
