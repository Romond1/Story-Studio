"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureGroupReward = captureGroupReward;
exports.applyGroupReward = applyGroupReward;
function captureGroupReward(input, uuid) {
    if (!Number.isInteger(input.delta) || !input.delta || Math.abs(input.delta) > 1000)
        throw Error('Enter a nonzero whole amount between -1000 and 1000.');
    if (!input.reason.trim())
        throw Error('A teacher reason is required.');
    if (!input.definition.rewards.some(reward => reward.id === input.rewardId))
        throw Error('Choose an authored reward.');
    const targets = [...new Set(input.participants)].flatMap(id => { const profile = input.roster.find(row => row.id === id && !row.archived && !id.startsWith('guest:')); return profile ? [profile] : []; });
    if (!targets.length)
        throw Error('Select an active permanent student.');
    return { applied: [], remaining: targets.map(profile => ({ studentId: profile.id, name: profile.name, input: { commandId: uuid(), expectedFolder: input.folder, studentId: profile.id, adventureDefinition: structuredClone(input.definition), rewardId: input.rewardId, delta: input.delta, reason: input.reason.trim() } })) };
}
async function applyGroupReward(plan, send) {
    const applied = [...plan.applied], remaining = [];
    for (const target of plan.remaining) {
        try {
            const result = await send(structuredClone(target.input));
            if (!result.accepted)
                throw Error(result.reason ?? 'Core rejected adjustment');
            applied.push({ ...target, error: undefined });
        }
        catch (error) {
            remaining.push({ ...target, error: String(error) });
        }
    }
    return { applied, remaining };
}
