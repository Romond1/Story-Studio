"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const heroDash_1 = require("./heroDash");
(0, node_test_1.default)('only teacher awards advance racers; pause blocks awards, finish clamps, undo restores', () => {
    let s = (0, heroDash_1.createDash)();
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 2 });
    strict_1.default.equal(s.positions[0], 0);
    s = (0, heroDash_1.dashAction)(s, { type: 'start' });
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 2 });
    strict_1.default.deepEqual(s.positions, [2, 0]);
    s = (0, heroDash_1.dashAction)(s, { type: 'pause' });
    strict_1.default.equal((0, heroDash_1.dashAction)(s, { type: 'move', amount: 2 }).positions[0], 2);
    s = (0, heroDash_1.dashAction)(s, { type: 'resume' });
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 3 });
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 3 });
    strict_1.default.equal(s.positions[0], 7);
    strict_1.default.equal(s.status, 'finished');
    s = (0, heroDash_1.dashAction)(s, { type: 'undo' });
    strict_1.default.equal(s.positions[0], 5);
    strict_1.default.equal(s.status, 'playing');
    s = (0, heroDash_1.dashAction)(s, { type: 'reset' });
    strict_1.default.deepEqual(s.positions, [0, 0]);
    strict_1.default.equal(s.status, 'ready');
});
(0, node_test_1.default)('question projection omits private notes and unselected cards; resolving hides question', () => {
    const config = { ...(0, heroDash_1.defaultDashConfig)(), cards: [{ id: 'q', image: 'asset:photo', text: 'Describe it', note: 'PRIVATE ANSWER', reward: 2 }] };
    let s = (0, heroDash_1.createDash)(config);
    s = (0, heroDash_1.dashAction)(s, { type: 'start' });
    s = (0, heroDash_1.dashAction)(s, { type: 'show' });
    const view = (0, heroDash_1.dashProjection)(s, id => 'media://' + id);
    strict_1.default.equal(view.question?.image, 'media://photo');
    strict_1.default.ok(!JSON.stringify(view).includes('PRIVATE'));
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 2 });
    strict_1.default.equal(s.questionVisible, false);
    strict_1.default.equal(s.positions[0], 2);
    s = (0, heroDash_1.dashAction)(s, { type: 'incorrect' });
    strict_1.default.equal(s.positions[0], 2);
    strict_1.default.equal(s.feedback, 'Try again — take your time');
});
(0, node_test_1.default)('saved configuration accepts asset references and rejects unsafe media and invalid rewards', () => {
    strict_1.default.equal((0, heroDash_1.parseDashConfig)((0, heroDash_1.defaultDashConfig)()).checkpoints, 6);
    for (const image of ['blob:temporary', 'file:///secret', 'https://tracking.test/image'])
        strict_1.default.throws(() => (0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), cards: [{ id: 'q', image, text: '', note: '', reward: 1 }] }));
    strict_1.default.throws(() => (0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints: 9 }));
});
