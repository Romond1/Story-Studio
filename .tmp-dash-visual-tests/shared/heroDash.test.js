"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const heroDash_1 = require("./heroDash");
const presentationSnapshot_1 = require("./presentationSnapshot");
const validation_1 = require("./modules/validation");
const media_1 = require("./modules/media");
const heroDashQuestionLayout_1 = require("./heroDashQuestionLayout");
const heroDashPreparation_1 = require("./heroDashPreparation");
(0, node_test_1.default)('only teacher awards advance racers; pause blocks awards, finish clamps, undo restores', () => {
    let s = (0, heroDash_1.createDash)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints: 6 });
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
    strict_1.default.equal((0, heroDash_1.parseDashConfig)((0, heroDash_1.defaultDashConfig)()).checkpoints, 20);
    for (const image of ['blob:temporary', 'file:///secret', 'https://tracking.test/image'])
        strict_1.default.throws(() => (0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), cards: [{ id: 'q', image, text: '', note: '', reward: 1 }] }));
    strict_1.default.throws(() => (0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints: 9 }));
});
(0, node_test_1.default)('episode activity save/reopen keeps image associations; package remap visits the question media', () => {
    const config = { ...(0, heroDash_1.defaultDashConfig)(), cards: [{ id: 'q', image: 'asset:photo', text: '', note: 'Teacher answer', reward: 2 }] };
    const activity = (0, validation_1.parseEpisodeActivity)(JSON.parse(JSON.stringify({ id: 'race', moduleType: 'hero-dash', moduleVersion: 1, configVersion: 1, config })));
    strict_1.default.equal(activity.moduleType, 'hero-dash');
    strict_1.default.equal((0, media_1.collectModuleAssets)(activity)[0].assetId, 'photo');
    const remapped = (0, media_1.remapModuleAssets)(activity, () => 'asset:copied-photo');
    strict_1.default.equal((0, media_1.collectModuleAssets)(remapped)[0].assetId, 'copied-photo');
});
(0, node_test_1.default)('snapshot relay strips teacher notes and rejects temporary image URLs', () => {
    const view = (0, heroDash_1.dashProjection)((0, heroDash_1.createDash)(), () => undefined);
    const snapshot = { sessionId: 'session', revision: 1, target: { kind: 'game', occurrenceId: 'race', instanceId: 'run', gameId: 'hero-dash', dash: { ...view, note: 'SECRET', history: [{ answer: 'SECRET' }] } } };
    const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)(snapshot);
    strict_1.default.ok(parsed);
    strict_1.default.ok(!JSON.stringify(parsed).includes('SECRET'));
    strict_1.default.equal((0, presentationSnapshot_1.parsePresentSnapshot)({ ...snapshot, target: { ...snapshot.target, dash: { ...view, question: { image: 'blob:temporary', text: '' } } } }), null);
});
(0, node_test_1.default)('medium and long formats use the same finish rules and explicit teacher bonus', () => {
    for (const checkpoints of [8, 10, 20, 30]) {
        let s = (0, heroDash_1.createDash)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints });
        s = (0, heroDash_1.dashAction)(s, { type: 'start' });
        s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 3 });
        strict_1.default.equal(s.positions[0], 3);
        strict_1.default.equal(s.positions[1], 0);
        while (s.status === 'playing')
            s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 3 });
        strict_1.default.equal(s.positions[0], checkpoints + 1);
    }
});
(0, node_test_1.default)('manual position override is explicit, bounded, works while paused and supports undo', () => {
    let s = (0, heroDash_1.dashAction)((0, heroDash_1.createDash)(), { type: 'start' });
    s = (0, heroDash_1.dashAction)(s, { type: 'pause' });
    s = (0, heroDash_1.dashAction)(s, { type: 'set-position', position: 4 });
    strict_1.default.equal(s.positions[0], 4);
    strict_1.default.equal(s.scores[0], 0);
    strict_1.default.equal(s.status, 'paused');
    s = (0, heroDash_1.dashAction)(s, { type: 'undo' });
    strict_1.default.equal(s.positions[0], 0);
    strict_1.default.equal((0, heroDash_1.dashAction)(s, { type: 'set-position', position: 100 }), s);
});
(0, node_test_1.default)('spontaneous imported image and pinned questions need no prepared card', () => {
    let s = (0, heroDash_1.createDash)();
    s = (0, heroDash_1.dashAction)(s, { type: 'start' });
    s = (0, heroDash_1.dashAction)(s, { type: 'image', image: 'dash:review-image' });
    s = (0, heroDash_1.dashAction)(s, { type: 'show' });
    strict_1.default.equal(s.config.cards.length, 0);
    strict_1.default.equal((0, heroDash_1.dashProjection)(s, () => undefined).question?.image, 'media://hero-dash/review-image');
    s = (0, heroDash_1.dashAction)(s, { type: 'pin' });
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 1 });
    strict_1.default.equal(s.questionVisible, true);
    strict_1.default.equal(s.positions[0], 1);
    s = (0, heroDash_1.dashAction)(s, { type: 'hide' });
    strict_1.default.equal(s.questionVisible, false);
});
(0, node_test_1.default)('review defaults to twenty spaces, supports ten to thirty and preserves legacy tracks', () => {
    strict_1.default.equal((0, heroDash_1.defaultDashConfig)().checkpoints, 20);
    for (const checkpoints of [6, 8, 10, 20, 30])
        strict_1.default.equal((0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints }).checkpoints, checkpoints);
    for (const checkpoints of [9, 31, 20.5])
        strict_1.default.throws(() => (0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints }));
    let s = (0, heroDash_1.createDash)();
    s = (0, heroDash_1.dashAction)(s, { type: 'camera', camera: 'side' });
    strict_1.default.equal(s.camera, 'side');
    s = (0, heroDash_1.dashAction)(s, { type: 'orbit', yaw: 1.2, pitch: .6 });
    strict_1.default.equal(s.camera, 'orbit');
    strict_1.default.equal((0, heroDash_1.dashProjection)(s, () => undefined).orbitYaw, 1.2);
});
(0, node_test_1.default)('completing an asynchronous save preserves newer moves and never replaces another race', () => {
    const initial = (0, heroDash_1.createDash)(), expected = initial.config, saved = { ...expected, title: 'Saved' };
    const advanced = (0, heroDash_1.dashAction)((0, heroDash_1.dashAction)(initial, { type: 'start' }), { type: 'move', amount: 2 });
    strict_1.default.equal((0, heroDash_1.mergeSavedDashConfig)(advanced, expected, saved).positions[0], 2);
    const other = (0, heroDash_1.createDash)();
    strict_1.default.equal((0, heroDash_1.mergeSavedDashConfig)(other, expected, saved), other);
});
(0, node_test_1.default)('removing the last selected prepared card clamps the cursor and hides its image', () => {
    let s = (0, heroDash_1.createDash)({ ...(0, heroDash_1.defaultDashConfig)(), cards: [{ id: 'a', image: 'asset:one', text: '', note: '', reward: 1 }, { id: 'b', image: 'asset:two', text: '', note: '', reward: 1 }] });
    s = { ...s, questionIndex: 1, questionVisible: true };
    s = (0, heroDash_1.removeDashCard)(s, 'b');
    strict_1.default.equal(s.questionIndex, 0);
    strict_1.default.equal(s.questionVisible, false);
    s = (0, heroDash_1.removeDashCard)(s, 'a');
    strict_1.default.equal(s.questionIndex, 0);
});
(0, node_test_1.default)('centered question containment avoids a corner webcam without cropping any aspect ratio', () => {
    const view = { left: 0, top: 0, width: 1000, height: 600 }, camera = { left: 650, top: 400, width: 330, height: 180 };
    for (const image of [{ width: 1200, height: 400 }, { width: 300, height: 700 }, { width: 500, height: 500 }]) {
        const fit = (0, heroDashQuestionLayout_1.fitDashQuestion)(view, image, [camera]);
        strict_1.default.ok(Math.abs(fit.width / fit.height - image.width / image.height) < .02);
        strict_1.default.ok(500 + fit.width / 2 <= 650 || 300 + fit.height / 2 <= 400);
    }
    strict_1.default.equal((0, heroDashQuestionLayout_1.fitDashQuestion)(view, { width: 1200, height: 400 }, []).width, 860);
});
(0, node_test_1.default)('Ctrl toggles, Shift ranges and batch preparation keep source ordering and existing cards', () => {
    const refs = ['dash:a', 'dash:b', 'dash:c', 'dash:d'];
    let selection = (0, heroDashPreparation_1.selectDashImages)(refs, [], undefined, 'dash:b', false, false);
    selection = (0, heroDashPreparation_1.selectDashImages)(refs, selection.refs, selection.anchor, 'dash:d', false, true);
    strict_1.default.deepEqual(selection.refs, ['dash:b', 'dash:c', 'dash:d']);
    selection = (0, heroDashPreparation_1.selectDashImages)(refs, selection.refs, selection.anchor, 'dash:c', true, false);
    strict_1.default.deepEqual(selection.refs, ['dash:b', 'dash:d']);
    let id = 0;
    const config = (0, heroDashPreparation_1.prepareDashImages)((0, heroDash_1.defaultDashConfig)(), selection.refs, () => String(++id));
    strict_1.default.deepEqual(config.cards.map(c => c.image), ['dash:b', 'dash:d']);
    strict_1.default.equal((0, heroDashPreparation_1.prepareDashImages)(config, ['dash:a'], () => String(++id)).cards.length, 3);
});
(0, node_test_1.default)('zoom is bounded; teacher advances levels without losing points and undo restores finish', () => {
    let s = (0, heroDash_1.createDash)({ ...(0, heroDash_1.defaultDashConfig)(), checkpoints: 10, courses: ['forest', 'mountains', 'coast'] });
    s = (0, heroDash_1.dashAction)(s, { type: 'zoom', zoom: 99 });
    strict_1.default.equal(s.zoom, 1.8);
    strict_1.default.equal((0, heroDash_1.dashAction)(s, { type: 'next-level' }), s);
    s = (0, heroDash_1.dashAction)(s, { type: 'start' });
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 10 });
    s = (0, heroDash_1.dashAction)(s, { type: 'move', amount: 1 });
    const score = s.scores[0];
    s = (0, heroDash_1.dashAction)(s, { type: 'next-level' });
    strict_1.default.equal(s.level, 1);
    strict_1.default.equal(s.status, 'ready');
    strict_1.default.equal(s.positions[0], 0);
    strict_1.default.equal(s.scores[0], score);
    strict_1.default.equal((0, heroDash_1.dashProjection)(s, () => undefined).course, 'mountains');
    s = (0, heroDash_1.dashAction)(s, { type: 'undo' });
    strict_1.default.equal(s.level, 0);
    strict_1.default.equal(s.status, 'finished');
    strict_1.default.equal((0, heroDash_1.parseDashConfig)({ ...(0, heroDash_1.defaultDashConfig)(), courses: undefined }).courses, undefined);
});
