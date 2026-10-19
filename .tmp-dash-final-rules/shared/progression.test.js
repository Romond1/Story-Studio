"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const reducer_1 = require("./progression/reducer");
const validation_1 = require("./progression/validation");
const context = { sessionId: 's', runId: 'run', instanceId: 'i', occurrenceId: 'o', episodeId: 'episode', adventureId: 'world', participantIds: ['student', 'guest:visitor'] };
const definition = { id: 'world', version: '1', name: 'World', description: '', rewards: [{ id: 'gem', name: 'Gem', kind: 'collectible' }], relics: [{ id: 'key', name: 'Key', stages: [{ id: 'one', name: 'One', requiredProgress: 1 }] }] };
const authority = { roster: [{ id: 'student', name: 'Student', archived: false, createdAt: '', updatedAt: '' }], activeRun: { context, moduleType: 'language-snake', state: 'running' } };
const registered = () => (0, reducer_1.applyProgressionCommand)((0, reducer_1.createProgressionState)(), { type: 'register-run', commandId: 'register', run: { context, moduleType: 'language-snake', adventureDefinition: definition, rewardBindings: { 'hero-crown': 'gem' } } }, authority).state;
const reward = { type: 'record-event', event: { version: 1, eventId: 'reward', context, sequence: 1, type: 'reward-requested', payload: { requests: [{ participantId: 'student', rewardId: 'hero-crown', quantity: 1 }, { participantId: 'guest:visitor', rewardId: 'hero-crown', quantity: 1 }] } } };
(0, node_test_1.default)('durable event replay survives serialization without duplicate request and rejects collision', () => {
    const before = registered(), once = (0, reducer_1.applyProgressionCommand)(before, reward, authority);
    strict_1.default.equal(once.result.accepted, true);
    strict_1.default.equal(before.requests.length, 0);
    const restored = (0, validation_1.parseProgressionState)(JSON.parse(JSON.stringify(once.state)));
    const replay = (0, reducer_1.applyProgressionCommand)(restored, reward, { roster: [] });
    strict_1.default.equal(replay.result.duplicate, true);
    strict_1.default.equal(replay.state.revision, once.state.revision);
    const collision = { ...reward, event: { ...reward.event, type: 'reward-requested', payload: { requests: [{ participantId: 'student', rewardId: 'hero-crown', quantity: 2 }] } } };
    strict_1.default.equal((0, reducer_1.findProgressionReplay)(restored, collision)?.accepted, false);
});
(0, node_test_1.default)('teacher decisions grant exactly once, guests never grant, snapshots retain identity', () => {
    let state = (0, reducer_1.applyProgressionCommand)(registered(), reward, authority).state;
    const command = { type: 'decide-reward', commandId: 'approve', requestId: state.requests[0].id, decision: 'approve' };
    state = (0, reducer_1.applyProgressionCommand)(state, command, authority).state;
    strict_1.default.equal(state.students[0].inventory.gem, 1);
    strict_1.default.equal((0, reducer_1.applyProgressionCommand)(state, { ...command, commandId: 'another' }, authority).result.accepted, false);
    strict_1.default.equal((0, reducer_1.applyProgressionCommand)(state, command, authority).result.duplicate, true);
    strict_1.default.equal((0, reducer_1.applyProgressionCommand)(state, { ...command, commandId: 'guest', requestId: state.requests[1].id }, authority).result.accepted, false);
    strict_1.default.deepEqual((0, reducer_1.getRunInventory)(state, context)[0], { participantId: 'student', rewards: [{ rewardId: 'gem', quantity: 1 }] });
});
(0, node_test_1.default)('stale, paused, unknown student and corrupt durable state fail closed', () => {
    strict_1.default.equal((0, reducer_1.applyProgressionCommand)((0, reducer_1.createProgressionState)(), { type: 'register-run', commandId: 'bad', run: { context: { ...context, participantIds: ['missing'] }, moduleType: 'language-snake' } }, authority).result.accepted, false);
    strict_1.default.equal((0, reducer_1.applyProgressionCommand)(registered(), reward, { ...authority, activeRun: { ...authority.activeRun, state: 'paused' } }).result.accepted, false);
    strict_1.default.throws(() => (0, validation_1.parseProgressionState)({ ...registered(), inventory: {} }));
    strict_1.default.throws(() => (0, validation_1.parseProgressionState)({ ...registered(), revision: NaN }));
});
(0, node_test_1.default)('teacher request uses captured completion, manual progress isolates adventures', () => {
    const completion = { type: 'record-event', event: { version: 1, eventId: 'done', context, sequence: 1, type: 'activity-completed', payload: { participantIds: ['student'], outcome: 'completed' } } };
    let state = (0, reducer_1.applyProgressionCommand)(registered(), completion, authority).state;
    const key = state.history[0].id;
    state = (0, reducer_1.applyProgressionCommand)(state, { type: 'request-reward', commandId: 'request', eventKey: key, rewardId: 'gem', quantity: 2 }, authority).state;
    strict_1.default.deepEqual(state.requests.map(r => r.studentId), ['student']);
    state = (0, reducer_1.applyProgressionCommand)(state, { type: 'advance-relic', commandId: 'relic', studentId: 'student', adventureDefinition: definition, relicId: 'key', progress: 3, reason: 'Teacher decision' }, authority).state;
    state = (0, reducer_1.applyProgressionCommand)(state, { type: 'adjust-reward', commandId: 'other-world', studentId: 'student', adventureDefinition: { ...definition, id: 'other' }, rewardId: 'gem', delta: 2, reason: 'Manual' }, authority).state;
    strict_1.default.equal(state.students.find(s => s.adventureId === 'world')?.relics.key, 3);
    strict_1.default.equal(state.students.find(s => s.adventureId === 'other')?.inventory.gem, 2);
});
(0, node_test_1.default)('prototype-named reward identities use only own authored dictionary values', () => {
    const d = { ...definition, rewards: [{ id: 'toString', name: 'Reward', kind: 'collectible' }] };
    const result = (0, reducer_1.applyProgressionCommand)((0, reducer_1.createProgressionState)(), { type: 'adjust-reward', commandId: 'prototype-test', studentId: 'student', adventureDefinition: d, rewardId: 'toString', delta: 1, reason: 'Explicit' }, authority);
    strict_1.default.equal(result.result.accepted, true);
    strict_1.default.equal(result.state.students[0].inventory.toString, 1);
});
(0, node_test_1.default)('durable store rejects receipt identity mismatch and balances without receipts', () => {
    const stored = registered();
    strict_1.default.throws(() => (0, validation_1.parseProgressionState)({ ...stored, receipts: stored.receipts.map(receipt => ({ ...receipt, key: 'forged' })) }));
    strict_1.default.throws(() => (0, validation_1.parseProgressionState)({ ...stored, students: [{ studentId: 'student', adventureId: 'world', inventory: { gem: 99 }, relics: {}, completedEpisodes: [] }] }));
});
(0, node_test_1.default)('unknown reward stays actionable, archived approvals fail and captured definition is immutable', () => {
    const noBinding = (0, reducer_1.applyProgressionCommand)((0, reducer_1.createProgressionState)(), { type: 'register-run', commandId: 'register-no-binding', run: { context, moduleType: 'language-snake', adventureDefinition: definition } }, authority).state;
    const event = { type: 'record-event', event: { version: 1, eventId: 'unknown', context, sequence: 1, type: 'reward-requested', payload: { requests: [{ participantId: 'student', rewardId: 'unmapped', quantity: 1 }] } } };
    let state = (0, reducer_1.applyProgressionCommand)(noBinding, event, authority).state;
    strict_1.default.match(state.requests[0].blockedReason, /Choose/);
    const decision = { type: 'decide-reward', commandId: 'select', requestId: state.requests[0].id, decision: 'approve', rewardId: 'gem' };
    strict_1.default.equal((0, reducer_1.applyProgressionCommand)(state, decision, { ...authority, roster: authority.roster.map(s => ({ ...s, archived: true })) }).result.accepted, false);
    state = (0, reducer_1.applyProgressionCommand)(state, decision, authority).state;
    strict_1.default.equal(state.students[0].inventory.gem, 1);
    strict_1.default.equal(state.history.at(-1)?.delta, 1);
});
