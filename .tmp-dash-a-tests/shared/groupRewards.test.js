"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const groupRewards_1 = require("./students/groupRewards");
const definition = { id: 'world', version: '1', name: 'World', description: '', rewards: [{ id: 'coin', name: 'Coin', kind: 'currency' }], relics: [] };
const roster = ['a', 'b', 'archived'].map(id => ({ id, name: id, archived: id === 'archived', createdAt: '', updatedAt: '' }));
(0, node_test_1.default)('partial lost ACK retries exact captured recipients and IDs without double mint', async () => {
    let serial = 0;
    const participants = ['a', 'b', 'a', 'guest:x', 'archived', 'missing'];
    const plan = (0, groupRewards_1.captureGroupReward)({ participants, roster, definition, folder: 'folder', rewardId: 'coin', delta: 2, reason: 'Team effort' }, () => `id-${++serial}`);
    participants.splice(0, participants.length, 'other');
    const originalName = definition.name;
    definition.name = 'Changed';
    const minted = new Map();
    const calls = [];
    let lose = true;
    const send = async (input) => { calls.push(structuredClone(input)); if (!minted.has(input.commandId))
        minted.set(input.commandId, input.delta); if (input.studentId === 'b' && lose) {
        lose = false;
        throw Error('Lost acknowledgement');
    } return { accepted: true, revision: 1 }; };
    const first = await (0, groupRewards_1.applyGroupReward)(plan, send);
    strict_1.default.equal(first.applied.length, 1);
    strict_1.default.equal(first.remaining.length, 1);
    const second = await (0, groupRewards_1.applyGroupReward)(first, send);
    strict_1.default.equal(second.applied.length, 2);
    strict_1.default.equal(second.remaining.length, 0);
    strict_1.default.equal(minted.size, 2);
    strict_1.default.deepEqual(calls[1], calls[2]);
    strict_1.default.equal(calls[0].adventureDefinition.name, originalName);
    definition.name = originalName;
});
(0, node_test_1.default)('negative changes retain failed archived target rather than replacing with selection', async () => {
    const plan = (0, groupRewards_1.captureGroupReward)({ participants: ['a', 'b'], roster, definition, folder: 'folder', rewardId: 'coin', delta: -1, reason: 'Correction' }, () => Math.random().toString());
    const result = await (0, groupRewards_1.applyGroupReward)(plan, async (input) => ({ accepted: input.studentId === 'a', revision: 2, reason: 'Student archived' }));
    strict_1.default.deepEqual(result.applied.map(row => row.studentId), ['a']);
    strict_1.default.deepEqual(result.remaining.map(row => row.studentId), ['b']);
    strict_1.default.equal(result.remaining[0].input.delta, -1);
    strict_1.default.match(result.remaining[0].error ?? '', /archived/);
});
(0, node_test_1.default)('invalid and empty group intents reject before any command allocation', () => {
    const input = { participants: ['guest:x'], roster, definition, folder: 'folder', rewardId: 'coin', delta: 1, reason: 'Reason' };
    strict_1.default.throws(() => (0, groupRewards_1.captureGroupReward)(input, () => { throw Error('allocated'); }), /permanent/);
    strict_1.default.throws(() => (0, groupRewards_1.captureGroupReward)({ ...input, participants: ['a'], delta: 0 }, () => ''), /amount/);
    strict_1.default.throws(() => (0, groupRewards_1.captureGroupReward)({ ...input, participants: ['a'], reason: ' ' }, () => ''), /reason/);
});
(0, node_test_1.default)('root store retains lost ACK intent across remount and locks concurrent retry', async () => {
    const store = new Map(), key = 'scope';
    const plan = (0, groupRewards_1.captureGroupReward)({ participants: ['a'], roster, definition, folder: 'folder', rewardId: 'coin', delta: 1, reason: 'Reward' }, () => 'stable-id');
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    let calls = 0;
    const first = (0, groupRewards_1.applyStoredGroupReward)(store, key, plan, async () => { calls++; await barrier; throw Error('Lost ACK'); });
    strict_1.default.equal(store.get(key), plan);
    strict_1.default.equal((0, groupRewards_1.groupRewardInFlight)(store, key), true);
    await (0, groupRewards_1.applyStoredGroupReward)(store, key, store.get(key), async () => { calls++; return { accepted: true, revision: 1 }; });
    strict_1.default.equal(calls, 1);
    release();
    await first;
    strict_1.default.equal((0, groupRewards_1.groupRewardInFlight)(store, key), false);
    const remountedPlan = store.get(key);
    strict_1.default.equal(remountedPlan.remaining[0].input.commandId, 'stable-id');
    await (0, groupRewards_1.applyStoredGroupReward)(store, key, remountedPlan, async (input) => { strict_1.default.equal(input.commandId, 'stable-id'); return { accepted: true, revision: 1, duplicate: true }; });
    strict_1.default.equal(store.get(key)?.remaining.length, 0);
    strict_1.default.equal(store.get(key)?.applied.length, 1);
});
