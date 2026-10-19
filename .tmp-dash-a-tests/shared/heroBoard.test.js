"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const heroBoard_1 = require("./students/heroBoard");
const reducer_1 = require("./progression/reducer");
const snapshot = { version: 1, legacyMappings: [], activeClassId: null, classes: [{ id: 'class', name: 'Same', studentIds: ['a'], archived: false, createdAt: '', updatedAt: '' }], studentRoster: [{ id: 'a', name: 'Same', archived: true, createdAt: '', updatedAt: '' }, { id: 'b', name: 'Same', archived: false, createdAt: '', updatedAt: '' }] };
const def = (id) => ({ id, version: '1', name: 'Same', description: '', rewards: [{ id: 'badge', name: 'Star', kind: 'badge' }, { id: 'coin', name: 'Star', kind: 'currency' }], relics: [{ id: 'relic', name: 'Relic', stages: [{ id: 'one', name: 'First', requiredProgress: 2 }, { id: 'two', name: 'Second', requiredProgress: 5 }] }] });
function state() { const s = (0, reducer_1.createProgressionState)(); s.students = [{ studentId: 'a', adventureId: 'world-a', inventory: { badge: 1, coin: 9 }, relics: { relic: 3 }, completedEpisodes: ['episode-a'] }, { studentId: 'a', adventureId: 'world-b', inventory: { badge: 2 }, relics: {}, completedEpisodes: [] }, { studentId: 'b', adventureId: 'world-a', inventory: { badge: 0 }, relics: {}, completedEpisodes: [] }]; s.history = [{ id: 'h', recordedAt: '2026-10-13T00:00:00Z', kind: 'score-reported', adventureId: 'world-a', episodeId: 'episode-a', studentIds: ['a', 'b'], scores: [{ studentId: 'a', score: 100 }, { studentId: 'b', score: 999 }] }]; s.receipts = ['world-a', 'world-b'].map(id => ({ key: id, canonical: JSON.stringify({ type: 'adjust-reward', adventureDefinition: def(id) }), result: { accepted: true, revision: 1 } })); return s; }
(0, node_test_1.default)('same-named adventures and rewards remain separate; only awarded badges are achievements', () => { const s = state(), before = JSON.stringify(s); const view = (0, heroBoard_1.selectHeroBoard)(snapshot, s); strict_1.default.equal(view.progress.length, 3); strict_1.default.equal(view.progress[0].achievements.length, 1); strict_1.default.equal(view.progress[1].achievements[0].quantity, 2); strict_1.default.equal(view.progress[2].achievements.length, 0); strict_1.default.deepEqual(view.progress[0].relics[0].unlockedStageIds, ['one']); strict_1.default.equal(view.progress[0].scope, 'adventure-lifetime'); strict_1.default.equal(JSON.stringify(s), before); });
(0, node_test_1.default)('class and student filters intersect without hiding archived history', () => { const view = (0, heroBoard_1.selectHeroBoard)(snapshot, state(), { classId: 'class' }); strict_1.default.deepEqual(view.profiles.map(p => p.id), ['a']); strict_1.default.equal(view.profiles[0].archived, true); strict_1.default.deepEqual(view.history[0].studentIds, ['a']); strict_1.default.deepEqual(view.history[0].scores, [{ studentId: 'a', score: 100 }]); strict_1.default.equal((0, heroBoard_1.selectHeroBoard)(snapshot, state(), { classId: 'class', studentId: 'b' }).progress.length, 0); });
(0, node_test_1.default)('episode filtering uses matching adventure history or completion while balances stay lifetime', () => { const view = (0, heroBoard_1.selectHeroBoard)(snapshot, state(), { episodeId: 'episode-a' }); strict_1.default.deepEqual(view.progress.map(p => [p.studentId, p.adventureId]), [['a', 'world-a'], ['b', 'world-a']]); strict_1.default.equal(view.progress[0].inventory.find(r => r.rewardId === 'coin')?.quantity, 9); strict_1.default.equal((0, heroBoard_1.selectHeroBoard)(snapshot, state(), { adventureId: 'world-b', episodeId: 'episode-a' }).progress.length, 0); });
(0, node_test_1.default)('receipt definitions use accepted chronological snapshots, current definition explicitly overrides', () => { const s = state(), latest = def('world-a'); latest.name = 'Updated'; s.receipts.push({ key: 'latest', canonical: JSON.stringify({ type: 'advance-relic', adventureDefinition: latest }), result: { accepted: true, revision: 2 } }); strict_1.default.equal((0, heroBoard_1.selectHeroBoard)(snapshot, s).progress[0].adventureName, 'Updated'); latest.name = 'Current'; strict_1.default.equal((0, heroBoard_1.selectHeroBoard)(snapshot, s, {}, latest).progress[0].adventureName, 'Current'); });
(0, node_test_1.default)('captured definitions label historical balances; missing definitions expose IDs without invented badges', () => {
    const s = state();
    s.receipts = [];
    s.runs = [{ moduleType: 'activation-cards', lastSequence: 1, context: { sessionId: 'session', runId: 'run', instanceId: 'instance', occurrenceId: 'occurrence', episodeId: 'episode-a', adventureId: 'world-a', participantIds: ['a'] }, adventureDefinition: def('world-a') }];
    const view = (0, heroBoard_1.selectHeroBoard)(snapshot, s);
    strict_1.default.equal(view.progress[0].achievements.length, 1);
    strict_1.default.equal(view.progress[1].adventureName, 'world-b');
    strict_1.default.equal(view.progress[1].inventory[0].name, 'badge');
    strict_1.default.equal(view.progress[1].achievements.length, 0);
    view.progress[0].relics[0].stages[0].name = 'changed';
    view.profiles[0].name = 'changed';
    strict_1.default.equal(s.runs[0].adventureDefinition?.relics[0].stages[0].name, 'First');
    strict_1.default.equal(snapshot.studentRoster[0].name, 'Same');
});
(0, node_test_1.default)('participation includes captured and completed students without inventing balances or achievements', () => {
    const s = (0, reducer_1.createProgressionState)();
    s.runs = [{ moduleType: 'activation-cards', lastSequence: 1, context: { sessionId: 's', runId: 'r', instanceId: 'i', occurrenceId: 'o', episodeId: 'episode-a', adventureId: 'world-a', participantIds: ['a', 'guest:visitor'] } }];
    s.history = [{ id: 'h', recordedAt: '2026-10-13T00:00:00Z', kind: 'activity-completed', adventureId: 'world-b', episodeId: 'episode-b', studentIds: ['a', 'b'] }];
    const view = (0, heroBoard_1.selectHeroBoard)(snapshot, s, { classId: 'class' });
    strict_1.default.deepEqual(view.participation, [{ studentId: 'a', adventureId: 'world-a', episodeIds: ['episode-a'] }, { studentId: 'a', adventureId: 'world-b', episodeIds: ['episode-b'] }]);
    strict_1.default.deepEqual(view.progress, []);
    strict_1.default.deepEqual((0, heroBoard_1.selectHeroBoard)(snapshot, s, { classId: 'class', episodeId: 'episode-b', adventureId: 'world-b' }).participation, [{ studentId: 'a', adventureId: 'world-b', episodeIds: ['episode-b'] }]);
    strict_1.default.deepEqual((0, heroBoard_1.selectHeroBoard)(snapshot, s, { classId: 'class', studentId: 'b' }).participation, []);
});
