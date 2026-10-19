"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const cardRuntime_1 = require("./cardRuntime");
const instances = [{ id: 'one', bCardId: 'card', position: { x: 50, y: 50 }, size: { width: 100, height: 100 }, zIndex: 1 }];
(0, node_test_1.test)('occurrence layouts initialize once and never mutate authored instances', () => {
    const core = new cardRuntime_1.CardRuntime();
    core.activate('slide-a');
    const first = core.ensure('ref-a', instances, 1000);
    core.move('slide-a', 'ref-a', 'one', { position: { x: 20, y: 30 } });
    strict_1.default.equal(instances[0].position.x, 50);
    strict_1.default.equal(core.ensure('ref-a', instances, 9000).instances[0].position.x, 20);
    strict_1.default.equal(core.ensure('ref-a', instances, 9000).startedAt, first.startedAt);
    strict_1.default.equal(core.ensure('ref-b', instances, 9000).instances[0].position.x, 50);
    core.activate('slide-b');
    core.ensure('ref-a', instances, 9000);
    strict_1.default.equal(core.move('slide-a', 'ref-a', 'one', { position: { x: 90, y: 90 } }), false);
    core.activate('slide-a');
    strict_1.default.equal(core.ensure('ref-a', instances, 9000).instances[0].position.x, 20);
});
(0, node_test_1.test)('shuffle consumes randomness only on authoritative command, snapshots and mounts are stable', () => {
    let draws = 0;
    const core = new cardRuntime_1.CardRuntime();
    core.activate('a');
    core.ensure('ref', instances, 1000);
    core.shuffle('a', 'ref', { width: 1280, height: 720 }, () => { draws++; return .2; });
    const saved = JSON.stringify(core.ensure('ref', instances, 2000));
    strict_1.default.equal(draws, 2);
    strict_1.default.equal(JSON.stringify(core.ensure('ref', instances, 3000)), saved);
    strict_1.default.equal(instances[0].position.x, 50);
});
(0, node_test_1.test)('authoritative timer anchor survives serialization and expires without restart', () => {
    const anchor = JSON.parse(JSON.stringify({ isRunning: true, startTime: 1000, accumulated: 0 }));
    strict_1.default.equal((0, cardRuntime_1.timerSeconds)(anchor, 5000, 'countdown', 5), 1);
    strict_1.default.equal((0, cardRuntime_1.timerSeconds)(anchor, 9000, 'countdown', 5), 0);
    strict_1.default.equal((0, cardRuntime_1.timerSeconds)({ ...anchor, isRunning: false, accumulated: 2500 }, 9000, 'countup', 5), 2);
});
const activityScene_1 = require("./activityScene");
(0, node_test_1.test)('projection strips private metadata and unused card and image libraries', () => {
    const scene = (0, activityScene_1.parseActivityScene)({ boards: [{ key: 'ref', startedAt: 1000, states: {}, card: { id: 'board', name: 'teacher name', notes: 'private', stageMode: 'full', background: {}, bCardInstances: instances } }], cards: { card: { id: 'card', name: 'private', audioRefId: 'private', front: { text: 'front', imageId: 'used', notes: 'private' }, back: {} }, unused: { front: {}, back: {} } }, images: { used: 'media://used.png', unused: 'media://unused.png' } });
    strict_1.default.ok(scene);
    strict_1.default.deepEqual(Object.keys(scene.cards), ['card']);
    strict_1.default.deepEqual(Object.keys(scene.images), ['used']);
    strict_1.default.equal(JSON.stringify(scene).includes('private'), false);
    strict_1.default.equal(JSON.stringify(scene).includes('teacher name'), false);
});
(0, node_test_1.test)('leave and return rejects delayed commands from previous activation while retaining occurrence state', () => {
    const core = new cardRuntime_1.CardRuntime();
    core.activate('a', 'epoch-1');
    core.ensure('ref', instances, 1000);
    core.move('epoch-1', 'ref', 'one', { position: { x: 20, y: 30 } });
    core.activate('b', 'epoch-2');
    core.activate('a', 'epoch-3');
    strict_1.default.equal(core.move('epoch-1', 'ref', 'one', { position: { x: 90, y: 90 } }), false);
    strict_1.default.equal(core.get('ref').instances[0].position.x, 20);
});
(0, node_test_1.test)('authored changes reconcile changed instances and prune removed reveal state', () => {
    const core = new cardRuntime_1.CardRuntime();
    core.activate('a');
    core.ensure('ref', instances, 1000);
    core.setState('a', 'ref', 'one', { isFlipped: true, isCovered: false, isBlurred: false, isZoomed: false });
    const edited = [{ ...instances[0], size: { width: 300, height: 300 } }];
    strict_1.default.equal(core.ensure('ref', edited, 2000).instances[0].size.width, 300);
    strict_1.default.deepEqual(core.ensure('ref', [], 3000).states, {});
});
(0, node_test_1.test)('invalid shuffle frame and missing card commands reject without mutating runtime', () => {
    const core = new cardRuntime_1.CardRuntime();
    core.activate('a');
    core.ensure('ref', instances, 1000);
    const before = JSON.stringify(core.get('ref'));
    strict_1.default.equal(core.shuffle('a', 'ref', { width: 0, height: 720 }), false);
    strict_1.default.equal(core.shuffle('a', 'ref', { width: 1280, height: NaN }), false);
    strict_1.default.equal(core.move('a', 'ref', 'missing', { position: { x: 20, y: 30 } }), false);
    strict_1.default.equal(JSON.stringify(core.get('ref')), before);
});
