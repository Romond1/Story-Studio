"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const cardV2Render_1 = require("./cardV2Render");
const cardsV2_1 = require("./cardsV2");
(0, node_test_1.test)('placement appearance does not change the reused card definition', () => {
    const module = (0, cardsV2_1.createCardsV2)();
    let serial = 0;
    const id = () => `local-${++serial}`;
    const card = (0, cardsV2_1.createCard)('text', id);
    module.cards[card.id] = card;
    module.sets.s = { id: 's', label: 'Cards', tags: [], entries: [{ id: 'e', cardId: card.id }] };
    const activity = (0, cardsV2_1.createActivity)(module, 's', id);
    activity.instances[0].style = { preset: 'dark', borderWidth: 4 };
    strict_1.default.equal((0, cardV2Render_1.buildCardV2RenderPlan)(module, activity).cards[0].style.surface, '#202b38');
    strict_1.default.equal(card.style.preset, 'classroom');
});
(0, node_test_1.test)('largest bounded font fits and preserves explicit empty lines', () => {
    const fit = (0, cardV2Render_1.fitCardText)('Hello\n\nWorld', { width: 200, height: 150 }, { minFontSize: 12, maxFontSize: 60 });
    strict_1.default.equal(fit.fontSize, 40);
    strict_1.default.deepEqual(fit.lines.map(l => l.text), ['Hello', '', 'World']);
    strict_1.default.equal(fit.overflow, false);
});
for (const text of ['A long English classroom sentence that wraps safely without losing a single learning word.', 'これは日本語の学習カードです。何度でも練習しましょう。', 'Perché l’acqua è già più fredda? Città, caffè e felicità.']) {
    (0, node_test_1.test)(`deterministic multilingual fit: ${text.slice(0, 15)}`, () => {
        const one = (0, cardV2Render_1.fitCardText)(text, { width: 180, height: 160 }, { minFontSize: 10, maxFontSize: 40 });
        strict_1.default.deepEqual(one, (0, cardV2Render_1.fitCardText)(text, { width: 180, height: 160 }, { minFontSize: 10, maxFontSize: 40 }));
        strict_1.default.equal(one.overflow, false);
        strict_1.default.equal(one.lines.map(l => l.text).join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
        strict_1.default.ok(one.lines.every(l => l.width <= 180));
    });
}
(0, node_test_1.test)('minimum failure and manual override warn without truncating', () => {
    const text = 'Learning content '.repeat(40);
    for (const style of [{ minFontSize: 20, maxFontSize: 40 }, { fit: 'manual', fontSize: 70 }]) {
        const fit = (0, cardV2Render_1.fitCardText)(text, { width: 120, height: 60 }, style);
        strict_1.default.equal(fit.overflow, true);
        strict_1.default.equal(fit.lines.map(l => l.text).join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
        strict_1.default.ok(!fit.lines.some(l => l.text.includes('…')));
    }
});
(0, node_test_1.test)('face plan uses image slot and projection strips metadata, unsafe media and concealed content', () => {
    const card = { id: 'card', label: 'private label', tags: ['private'], style: { preset: 'classroom' }, faces: [
            { id: 'prompt', label: 'private prompt label', layout: 'image-text', text: 'Visible', imageAssetId: 'asset', alt: 'Picture' },
            { id: 'answer', label: 'Answer', layout: 'text', text: 'SECRET ANSWER' }
        ] };
    const face = (0, cardV2Render_1.buildCardV2FacePlan)(card, 'prompt', { x: 20, y: 30, width: 300, height: 240 }, () => 'media://image.png');
    strict_1.default.ok(face.image);
    strict_1.default.ok(face.texts[0].box.y >= face.image.box.y + face.image.box.height);
    const value = { engine: 'card-v2', version: 1, frame: { width: 1280, height: 720 }, cards: [{ ...face, teacherNotes: 'secret' }], definitions: card };
    const clean = (0, cardV2Render_1.parseCardV2RenderPlan)(value);
    strict_1.default.ok(clean);
    strict_1.default.ok(!JSON.stringify(clean).includes('SECRET'));
    strict_1.default.ok(!JSON.stringify(clean).includes('teacherNotes'));
    const concealed = (0, cardV2Render_1.parseCardV2RenderPlan)({ ...value, cards: [{ ...face, concealed: true }] });
    strict_1.default.equal(concealed.cards[0].texts.length, 0);
    strict_1.default.equal(concealed.cards[0].image, undefined);
    const unsafe = (0, cardV2Render_1.parseCardV2RenderPlan)({ ...value, cards: [{ ...face, image: { ...face.image, src: 'https://tracker.test/x' } }] });
    strict_1.default.equal(unsafe.cards[0].image, undefined);
});
(0, node_test_1.test)('authoritative current face and logical geometry survive snapshot reload; concealed assets are absent', () => {
    let serial = 0;
    const id = () => `id-${++serial}`;
    const module = (0, cardsV2_1.createCardsV2)(), card = (0, cardsV2_1.createCard)('picture-recall', id);
    card.faces[0].imageAssetId = 'photo';
    card.faces[1].text = 'answer';
    module.cards[card.id] = card;
    module.sets.set = { id: 'set', label: 'Set', tags: [], entries: [{ id: 'entry', cardId: card.id }, { id: 'entry2', cardId: card.id }] };
    const activity = (0, cardsV2_1.createActivity)(module, 'set', id);
    module.activities[activity.id] = activity;
    module.placements.place = { id: 'place', activityId: activity.id, label: 'Place' };
    const token = { projectId: 'project', sessionId: 'session', occurrenceId: 'occurrence', revision: 0, targetRevision: 0 };
    const authority = new cardsV2_1.CardSessionAuthority(module, token);
    authority.dispatch(token, { type: 'StartActivity', placementId: 'place' });
    authority.dispatch(authority.snapshot().token, { type: 'SetFace', instanceId: activity.instances[0].id, faceId: card.faces[1].id });
    authority.dispatch(authority.snapshot().token, { type: 'SetConcealment', instanceId: activity.instances[1].id, concealed: true });
    const before = JSON.stringify(authority.snapshot());
    const plan = (0, cardV2Render_1.buildCardV2RenderPlan)(module, activity, authority.snapshot(), () => 'media://photo.png');
    strict_1.default.equal(plan.cards[0].faceId, card.faces[1].id);
    strict_1.default.equal(plan.cards[1].faceId, card.faces[0].id);
    strict_1.default.deepEqual(plan.cards[0].box, activity.instances[0].geometry);
    strict_1.default.deepEqual((0, cardV2Render_1.collectCardV2RenderImages)(plan), []);
    strict_1.default.equal(JSON.stringify(authority.snapshot()), before, 'planning never creates or mutates session state');
    strict_1.default.deepEqual((0, cardV2Render_1.parseCardV2RenderPlan)(JSON.parse(JSON.stringify(plan))), plan);
});
(0, node_test_1.test)('projection rejects malformed geometry, duplicate identities and unsupported versions', () => {
    const card = (0, cardsV2_1.createCard)('text', () => 'one');
    const face = (0, cardV2Render_1.buildCardV2FacePlan)(card, card.faces[0].id, { x: 0, y: 0, width: 200, height: 100 });
    const plan = { engine: 'card-v2', version: 1, frame: { width: 400, height: 300 }, cards: [face] };
    strict_1.default.equal((0, cardV2Render_1.parseCardV2RenderPlan)({ ...plan, version: 2 }), null);
    strict_1.default.equal((0, cardV2Render_1.parseCardV2RenderPlan)({ ...plan, cards: [face, face] }), null);
    strict_1.default.equal((0, cardV2Render_1.parseCardV2RenderPlan)({ ...plan, cards: [{ ...face, box: { ...face.box, width: -1 } }] }), null);
});
(0, node_test_1.test)('minimum failure measures only one size; successful fitting uses logarithmically bounded trials', () => {
    const sizes = new Set();
    const measure = (text, size) => { sizes.add(size); return (0, cardV2Render_1.measureCardText)(text, size); };
    const result = (0, cardV2Render_1.fitCardText)('long text '.repeat(1800), { width: 100, height: 100 }, { minFontSize: 8, maxFontSize: 160 }, measure);
    strict_1.default.equal(result.overflow, true);
    strict_1.default.equal(sizes.size, 1);
    sizes.clear();
    const fit = (0, cardV2Render_1.fitCardText)('Hello\n\nWorld', { width: 200, height: 150 }, { minFontSize: 8, maxFontSize: 160 }, measure);
    strict_1.default.equal(fit.fontSize, 40);
    strict_1.default.ok(sizes.size <= 12, `Unexpected ${sizes.size} fitting trials`);
});
(0, node_test_1.test)('wrapping never splits combining kana, emoji modifiers, flags or joined emoji', () => {
    for (const cluster of ['か\u3099', '👍🏽', '🇯🇵', '👨‍👩‍👧‍👦', '✈️']) {
        const fit = (0, cardV2Render_1.fitCardText)(cluster.repeat(3), { width: 10, height: 200 }, { fit: 'manual', fontSize: 10 });
        strict_1.default.deepEqual(fit.lines.map(l => l.text), [cluster, cluster, cluster]);
    }
});
(0, node_test_1.test)('cached fit remains isolated from caller mutation and invalidates for geometry or text changes', () => {
    const box = { width: 200, height: 100 }, first = (0, cardV2Render_1.fitCardText)('Cache test', box);
    const expected = JSON.parse(JSON.stringify(first));
    first.lines[0].text = 'changed';
    strict_1.default.deepEqual((0, cardV2Render_1.fitCardText)('Cache test', box), expected);
    strict_1.default.notDeepEqual((0, cardV2Render_1.fitCardText)('Cache test', { width: 80, height: 50 }), expected);
    strict_1.default.notDeepEqual((0, cardV2Render_1.fitCardText)('Different', box), expected);
});
