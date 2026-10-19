"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const rewardRuntime_1 = require("./rewardRuntime");
const sparkRewards_1 = require("./sparkRewards");
const relics_1 = require("./relics");
const students = () => [(0, sparkRewards_1.normalizeSparkStudent)({ id: 'a', name: 'Ada' }, () => 'a')];
const relics = (progress = 9) => ({ ...(0, relics_1.normalizeRelicSystem)(undefined), studentProgress: {
        a: { progress, active: true }, b: { progress: 4, active: false },
    } });
(0, node_test_1.default)('distinct rapid Spark results accumulate while retries never mutate again', () => {
    const core = new rewardRuntime_1.RewardResultCore('lesson');
    const first = core.applySpark('lesson', 'one', students(), 'a', 'gold');
    strict_1.default.equal(first.accepted, true);
    strict_1.default.equal(first.student?.yellowSparks, 1);
    const second = core.applySpark('lesson', 'two', first.students, 'a', 'gold');
    strict_1.default.equal(second.student?.yellowSparks, 2);
    const retry = core.applySpark('lesson', 'one', second.students, 'a', 'gold');
    strict_1.default.equal(retry.accepted, false);
    strict_1.default.equal(retry.students, second.students);
    // Visual expiry/undo do not retire result IDs. A retry cannot award again.
    strict_1.default.equal(core.applySpark('lesson', 'one', students(), 'a', 'crown').accepted, false);
});
(0, node_test_1.default)('invalid or stale Spark commands do not consume the result ID', () => {
    const core = new rewardRuntime_1.RewardResultCore('new');
    const original = students();
    strict_1.default.equal(core.applySpark('old', 'id', original, 'a', 'gold').accepted, false);
    strict_1.default.equal(core.applySpark('new', 'id', original, 'missing', 'gold').accepted, false);
    strict_1.default.equal(core.applySpark('new', 'id', original, 'a', 'bad').accepted, false);
    const accepted = core.applySpark('new', 'id', original, 'a', 'crown');
    strict_1.default.equal(accepted.accepted, true);
    strict_1.default.equal(accepted.student?.crowns, 1);
    strict_1.default.equal(accepted.student?.stars, 1);
    strict_1.default.equal(original[0].stars, 0);
    strict_1.default.equal(new rewardRuntime_1.RewardResultCore('next').applySpark('next', 'id', original, 'a', 'gold').accepted, true);
});
(0, node_test_1.default)('Relic mutation and stage classification use the latest accepted progress', () => {
    const core = new rewardRuntime_1.RewardResultCore('s');
    const first = core.applyRelic('s', 'one', relics(), ['a'], 'increase');
    strict_1.default.equal(first.kind, 'progress');
    strict_1.default.equal(first.system.studentProgress.a.progress, 10);
    const second = core.applyRelic('s', 'two', first.system, ['a'], 'increase');
    strict_1.default.equal(second.kind, 'stage');
    strict_1.default.equal(second.system.studentProgress.a.progress, 11);
    const retry = core.applyRelic('s', 'two', second.system, ['a'], 'increase');
    strict_1.default.equal(retry.accepted, false);
    strict_1.default.equal(retry.kind, null);
    strict_1.default.equal(retry.system, second.system);
    strict_1.default.equal(second.system.showOnStage, true);
});
(0, node_test_1.default)('Relic stage and completion boundaries preserve distinct clamped commands', () => {
    for (const [progress, expected] of [[0, 'stage'], [10, 'stage'], [20, 'stage'], [29, 'complete'], [30, 'progress']]) {
        const core = new rewardRuntime_1.RewardResultCore('s');
        const next = core.applyRelic('s', 'one', relics(progress), ['a', 'a'], 'increase');
        strict_1.default.equal(next.accepted, true);
        strict_1.default.equal(next.kind, expected);
        strict_1.default.equal(next.system.studentProgress.a.progress, Math.min(30, progress + 1));
        strict_1.default.equal(core.applyRelic('s', 'two', next.system, ['a'], 'complete').accepted, true);
    }
});
(0, node_test_1.default)('Relic targets and scope are checked before consuming IDs; inactive pupils stay unchanged', () => {
    const core = new rewardRuntime_1.RewardResultCore('s');
    const original = relics();
    for (const ids of [[], ['missing'], ['b']])
        strict_1.default.equal(core.applyRelic('s', 'id', original, ids, 'increase').accepted, false);
    strict_1.default.equal(core.applyRelic('old', 'id', original, ['a'], 'increase').accepted, false);
    strict_1.default.equal(core.applyRelic('s', 'id', original, ['a'], 'bad').accepted, false);
    const next = core.applyRelic('s', 'id', original, ['a', 'b', 'missing'], 'reset');
    strict_1.default.equal(next.accepted, true);
    strict_1.default.equal(next.system.studentProgress.a.progress, 0);
    strict_1.default.equal(next.system.studentProgress.b, original.studentProgress.b);
    strict_1.default.equal(original.studentProgress.a.progress, 9);
});
