"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const cards = __importStar(require("./cardsV2"));
(0, node_test_1.test)('Card V2 exposes a validated empty authored module', () => {
    strict_1.default.equal(typeof cards.createCardsV2, 'function');
    strict_1.default.deepEqual(cards.validateCardsV2(cards.createCardsV2()), []);
});
let next = 0;
const id = () => `test-${++next}`;
function fixture() {
    const m = cards.createCardsV2();
    const c = cards.createCard('question-answer-explanation', id);
    m.cards[c.id] = c;
    const s = { id: id(), label: 'Set', tags: ['日本語'], entries: [{ id: id(), cardId: c.id }, { id: id(), cardId: c.id }] };
    m.sets[s.id] = s;
    const a = cards.createActivity(m, s.id, id);
    m.activities[a.id] = a;
    const p = { id: id(), activityId: a.id, label: 'Placement' };
    m.placements[p.id] = p;
    return { m, c, s, a, p };
}
(0, node_test_1.test)('faces retain identity through reorder, referenced deletion blocks, tags round-trip', () => {
    strict_1.default.equal(typeof cards.createCard, 'function');
    const { m, c, a } = fixture();
    const face = c.faces[0].id;
    c.faces.reverse();
    strict_1.default.equal(a.instances[0].initialFaceId, face);
    strict_1.default.equal(cards.removeCardFace(m, c.id, face), false);
    strict_1.default.deepEqual(cards.validateCardsV2(JSON.parse(JSON.stringify(m))), []);
    c.faces = [];
    strict_1.default.ok(cards.validateCardsV2(m).length);
});
(0, node_test_1.test)('validation rejects unknown versions, unsafe style, references and nonfinite geometry', () => {
    strict_1.default.equal(typeof cards.createCard, 'function');
    for (const change of [(m) => m.version = 99, (m) => Object.values(m.cards).forEach((c) => c.style.css = 'position:fixed'), (m) => Object.values(m.activities).forEach((a) => a.instances[0].geometry.x = NaN), (m) => Object.values(m.activities).forEach((a) => a.instances[0].initialFaceId = 'missing')]) {
        const { m } = fixture();
        change(m);
        strict_1.default.ok(cards.validateCardsV2(m).length);
    }
});
(0, node_test_1.test)('duplication remaps definitions/faces/instances while set duplication retains references', () => {
    strict_1.default.equal(typeof cards.duplicateCard, 'function');
    const { m, c, s, p } = fixture();
    const copy = cards.duplicateCard(m, c.id, id);
    strict_1.default.notEqual(copy.id, c.id);
    strict_1.default.notEqual(copy.faces[0].id, c.faces[0].id);
    strict_1.default.equal(cards.duplicateSet(m, s.id, id).entries[0].cardId, c.id);
    const dup = cards.duplicatePlacement(m, p.id, id);
    strict_1.default.notEqual(dup.activity.instances[0].id, m.activities[p.activityId].instances[0].id);
});
(0, node_test_1.test)('authority guards stale tokens, separates faces/concealment, resets authored state and reuse', () => {
    strict_1.default.equal(typeof cards.CardSessionAuthority, 'function');
    const { m, c, a, p } = fixture();
    const token = { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 };
    const authority = new cards.CardSessionAuthority(m, token);
    const run = (command) => authority.dispatch(authority.snapshot()?.token ?? token, command);
    strict_1.default.equal(run({ type: 'StartActivity', placementId: p.id }), true);
    const instance = a.instances[0].id, other = a.instances[1].id;
    strict_1.default.equal(authority.dispatch(token, { type: 'RevealAll' }), false);
    run({ type: 'SetFace', instanceId: instance, faceId: c.faces[2].id });
    strict_1.default.equal(authority.snapshot().instances[other].faceId, c.faces[0].id);
    run({ type: 'NextFace', instanceId: instance });
    strict_1.default.equal(authority.snapshot().instances[instance].faceId, c.faces[2].id);
    run({ type: 'SetConcealment', instanceId: instance, concealed: true });
    strict_1.default.equal(authority.snapshot().instances[instance].faceId, c.faces[2].id);
    run({ type: 'SelectCard', instanceId: instance });
    run({ type: 'RevealSelected' });
    strict_1.default.equal(authority.snapshot().instances[instance].faceId, a.instances[0].revealFaceId);
    run({ type: 'ResetActivity' });
    strict_1.default.equal(authority.snapshot().instances[instance].selected, false);
    strict_1.default.deepEqual(authority.snapshot().instances[instance].geometry, a.instances[0].geometry);
    const second = new cards.CardSessionAuthority(m, { ...token, occurrenceId: 'second' });
    second.dispatch({ ...token, occurrenceId: 'second' }, { type: 'StartActivity', placementId: p.id });
    run({ type: 'RevealAll' });
    strict_1.default.equal(second.snapshot().instances[instance].faceId, c.faces[0].id);
});
(0, node_test_1.test)('malformed inherited references fail safely without throwing', () => {
    const { m, a } = fixture();
    a.instances[0].cardId = 'toString';
    strict_1.default.doesNotThrow(() => cards.validateCardsV2(m));
    strict_1.default.ok(cards.validateCardsV2(m).length);
});
(0, node_test_1.test)('activation rejects stale target and foreign tokens, and preserves occurrence state', () => {
    const { m, p, a, c } = fixture();
    const token = { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 };
    const authority = new cards.CardSessionAuthority(m, token);
    authority.dispatch(token, { type: 'StartActivity', placementId: p.id });
    authority.dispatch(authority.snapshot().token, { type: 'SetFace', instanceId: a.instances[0].id, faceId: c.faces[2].id });
    const old = authority.snapshot().token;
    strict_1.default.equal(authority.activate({ ...old, targetRevision: 2 }), true);
    strict_1.default.equal(authority.dispatch(old, { type: 'ResetActivity' }), false);
    strict_1.default.equal(authority.activate({ ...old, projectId: 'foreign' }), false);
    strict_1.default.equal(authority.activate(old), false);
    strict_1.default.equal(authority.snapshot().instances[a.instances[0].id].faceId, c.faces[2].id);
});
(0, node_test_1.test)('one-face cards, unreferenced deletion, direct-face-all, cycling permissions and snapshots', () => {
    const single = cards.createCard('text', id), m = cards.createCardsV2();
    m.cards[single.id] = single;
    strict_1.default.deepEqual(cards.validateCardsV2(m), []);
    strict_1.default.equal(cards.removeCardFace(m, single.id, single.faces[0].id), false);
    const f = fixture();
    const extra = { ...f.c.faces[0], id: id() };
    f.c.faces.push(extra);
    strict_1.default.equal(cards.removeCardFace(f.m, f.c.id, extra.id), true);
    const token = { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 }, authority = new cards.CardSessionAuthority(f.m, token);
    authority.dispatch(token, { type: 'StartActivity', placementId: f.p.id });
    authority.dispatch(authority.snapshot().token, { type: 'SetFaceAll', faceId: f.c.faces[2].id });
    strict_1.default.ok(Object.values(authority.snapshot().instances).every(s => s.faceId === f.c.faces[2].id));
    authority.snapshot().instances[f.a.instances[0].id].geometry.x = 999;
    strict_1.default.equal(authority.snapshot().instances[f.a.instances[0].id].geometry.x, 40);
    f.a.allowCycling = false;
    f.a.allowDirectFace = false;
    const disabled = new cards.CardSessionAuthority(f.m, token);
    disabled.dispatch(token, { type: 'StartActivity', placementId: f.p.id });
    strict_1.default.equal(disabled.dispatch(disabled.snapshot().token, { type: 'NextFace', instanceId: f.a.instances[0].id }), false);
    strict_1.default.equal(disabled.dispatch(disabled.snapshot().token, { type: 'SetFaceAll', faceId: f.c.faces[2].id }), false);
});
(0, node_test_1.test)('reset face restores authored face without changing concealment', () => {
    const { m, p, a, c } = fixture(), token = { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 };
    const authority = new cards.CardSessionAuthority(m, token);
    strict_1.default.equal(typeof authority.currentToken, 'function');
    authority.dispatch(authority.currentToken(), { type: 'StartActivity', placementId: p.id });
    authority.dispatch(authority.currentToken(), { type: 'SetFace', instanceId: a.instances[0].id, faceId: c.faces[2].id });
    authority.dispatch(authority.currentToken(), { type: 'SetConcealment', instanceId: a.instances[0].id, concealed: true });
    authority.dispatch(authority.currentToken(), { type: 'ResetFace', instanceId: a.instances[0].id });
    strict_1.default.equal(authority.snapshot().instances[a.instances[0].id].faceId, c.faces[0].id);
    strict_1.default.equal(authority.snapshot().instances[a.instances[0].id].concealed, true);
});
(0, node_test_1.test)('another instance shares definition but receives its own identity and geometry', () => {
    strict_1.default.equal(typeof cards.duplicateInstance, 'function');
    const { a } = fixture(), source = a.instances[0], copy = cards.duplicateInstance(source, id);
    strict_1.default.notEqual(copy.id, source.id);
    strict_1.default.equal(copy.cardId, source.cardId);
    copy.geometry.x = 500;
    strict_1.default.equal(source.geometry.x, 40);
});
(0, node_test_1.test)('activity layout respects shape defaults and packs without overlap', () => {
    const m = cards.createCardsV2(), shapes = ['portrait', 'square', 'strip', 'pill', 'landscape'];
    const entries = shapes.map(shape => { const c = cards.createCard('text', id); c.style.shape = shape; m.cards[c.id] = c; return { id: id(), cardId: c.id }; });
    const set = { id: id(), label: 'Mixed shapes', tags: [], entries };
    m.sets[set.id] = set;
    const a = cards.createActivity(m, set.id, id);
    m.activities[a.id] = a;
    strict_1.default.ok(a.instances[0].geometry.height > a.instances[0].geometry.width);
    strict_1.default.equal(a.instances[1].geometry.height, a.instances[1].geometry.width);
    strict_1.default.ok(a.instances[2].geometry.width / a.instances[2].geometry.height >= 3);
    strict_1.default.ok(a.instances[3].geometry.width / a.instances[3].geometry.height >= 2);
    strict_1.default.deepEqual(cards.validateCardsV2(m), []);
    for (let i = 0; i < a.instances.length; i++)
        for (let j = i + 1; j < a.instances.length; j++) {
            const x = a.instances[i].geometry, y = a.instances[j].geometry;
            strict_1.default.ok(x.x + x.width <= y.x || y.x + y.width <= x.x || x.y + x.height <= y.y || y.y + y.height <= x.y);
        }
    const usual = fixture();
    usual.s.entries = Array.from({ length: 8 }, () => ({ id: id(), cardId: usual.c.id }));
    strict_1.default.deepEqual(cards.createActivity(usual.m, usual.s.id, id).frame, { width: 1280, height: 720 });
});
(0, node_test_1.test)('duplicating maximum-length labels remains valid', () => {
    const { m, c, s, p, a } = fixture();
    c.label = s.label = p.label = a.label = 'x'.repeat(200);
    const cc = cards.duplicateCard(m, c.id, id), ss = cards.duplicateSet(m, s.id, id), pp = cards.duplicatePlacement(m, p.id, id);
    m.cards[cc.id] = cc;
    m.sets[ss.id] = ss;
    m.activities[pp.activity.id] = pp.activity;
    m.placements[pp.placement.id] = pp.placement;
    strict_1.default.deepEqual(cards.validateCardsV2(m), []);
    for (const label of [cc.label, ss.label, pp.activity.label, pp.placement.label]) {
        strict_1.default.ok(label.length <= 200);
        strict_1.default.ok(label.endsWith(' copy'));
    }
});
(0, node_test_1.test)('reconcile retains live faces and flags while applying authored geometry and membership', () => {
    const { m, c, a, p } = fixture(), authority = new cards.CardSessionAuthority(m, { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 });
    authority.dispatch(authority.currentToken(), { type: 'StartActivity', placementId: p.id });
    const retained = a.instances[0], removed = a.instances[1];
    authority.dispatch(authority.currentToken(), { type: 'SetFace', instanceId: retained.id, faceId: c.faces[2].id });
    authority.dispatch(authority.currentToken(), { type: 'SelectCard', instanceId: retained.id });
    authority.dispatch(authority.currentToken(), { type: 'SetConcealment', instanceId: retained.id, concealed: true });
    const stale = authority.currentToken();
    const updated = JSON.parse(JSON.stringify(m)), activity = updated.activities[a.id], fresh = cards.duplicateInstance(retained, id);
    fresh.initiallyConcealed = true;
    activity.instances = [fresh, { ...retained, geometry: { x: 30, y: 30, width: 200, height: 200 }, initiallyConcealed: false }];
    authority.reconcile(updated);
    const snapshot = authority.snapshot();
    strict_1.default.deepEqual(snapshot.order, [fresh.id, retained.id]);
    strict_1.default.equal(snapshot.instances[removed.id], undefined);
    strict_1.default.equal(snapshot.instances[retained.id].faceId, c.faces[2].id);
    strict_1.default.equal(snapshot.instances[retained.id].selected, true);
    strict_1.default.equal(snapshot.instances[retained.id].concealed, true);
    strict_1.default.equal(snapshot.instances[retained.id].locked, false);
    strict_1.default.equal(snapshot.instances[retained.id].highlighted, false);
    strict_1.default.deepEqual(snapshot.instances[retained.id].geometry, { x: 30, y: 30, width: 200, height: 200 });
    strict_1.default.equal(snapshot.instances[fresh.id].faceId, fresh.initialFaceId);
    strict_1.default.equal(snapshot.instances[fresh.id].concealed, true);
    strict_1.default.equal(snapshot.instances[fresh.id].selected, false);
    strict_1.default.equal(snapshot.token.revision, stale.revision + 1);
    strict_1.default.equal(authority.dispatch(stale, { type: 'ResetActivity' }), false);
    updated.cards[c.id].faces[2].text = 'external mutation';
    activity.instances[1].geometry.x = 99;
    strict_1.default.equal(authority.snapshot().instances[retained.id].geometry.x, 30);
});
(0, node_test_1.test)('reconcile applies authored layer reordering while preserving live face and flags', () => {
    const { m, c, a, p } = fixture(), authority = new cards.CardSessionAuthority(m, { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 });
    authority.dispatch(authority.currentToken(), { type: 'StartActivity', placementId: p.id });
    const instance = a.instances[0];
    authority.dispatch(authority.currentToken(), { type: 'SetFace', instanceId: instance.id, faceId: c.faces[2].id });
    authority.dispatch(authority.currentToken(), { type: 'SelectCard', instanceId: instance.id });
    authority.dispatch(authority.currentToken(), { type: 'SetConcealment', instanceId: instance.id, concealed: true });
    const before = authority.snapshot().instances[instance.id], updated = JSON.parse(JSON.stringify(m));
    updated.activities[a.id].instances.reverse();
    authority.reconcile(updated);
    strict_1.default.deepEqual(authority.snapshot().order, [a.instances[1].id, instance.id]);
    strict_1.default.deepEqual(authority.snapshot().instances[instance.id], before);
});
(0, node_test_1.test)('reconcile falls back for removed faces, drops missing placements, and rejects invalid modules atomically', () => {
    const { m, c, a, p } = fixture(), authority = new cards.CardSessionAuthority(m, { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 });
    authority.dispatch(authority.currentToken(), { type: 'StartActivity', placementId: p.id });
    const instance = a.instances[0];
    authority.dispatch(authority.currentToken(), { type: 'SetFace', instanceId: instance.id, faceId: c.faces[2].id });
    const updated = JSON.parse(JSON.stringify(m));
    updated.cards[c.id].faces.pop();
    authority.reconcile(updated);
    strict_1.default.equal(authority.snapshot().instances[instance.id].faceId, instance.initialFaceId);
    const snapshot = authority.snapshot(), token = authority.currentToken(), invalid = JSON.parse(JSON.stringify(updated));
    invalid.activities[a.id].instances[0].initialFaceId = 'missing';
    strict_1.default.throws(() => authority.reconcile(invalid));
    strict_1.default.deepEqual(authority.snapshot(), snapshot);
    strict_1.default.deepEqual(authority.currentToken(), token);
    strict_1.default.equal(authority.dispatch(token, { type: 'SetFace', instanceId: instance.id, faceId: c.faces[2].id }), false);
    delete updated.placements[p.id];
    authority.reconcile(updated);
    strict_1.default.equal(authority.snapshot(), null);
    strict_1.default.equal(authority.currentToken().revision, token.revision + 1);
    strict_1.default.equal(authority.dispatch(token, { type: 'RevealAll' }), false);
});
(0, node_test_1.test)('reconcile reinitializes a changed placement activity and updates inactive authority modules', () => {
    const { m, c, a, p } = fixture(), authority = new cards.CardSessionAuthority(m, { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 });
    authority.dispatch(authority.currentToken(), { type: 'StartActivity', placementId: p.id });
    authority.dispatch(authority.currentToken(), { type: 'SetFace', instanceId: a.instances[0].id, faceId: c.faces[2].id });
    const updated = JSON.parse(JSON.stringify(m)), copy = cards.duplicatePlacement(updated, p.id, id);
    updated.activities[copy.activity.id] = copy.activity;
    updated.placements[p.id].activityId = copy.activity.id;
    authority.reconcile(updated);
    strict_1.default.equal(authority.snapshot().activityId, copy.activity.id);
    strict_1.default.equal(authority.snapshot().instances[copy.activity.instances[0].id].faceId, copy.activity.instances[0].initialFaceId);
    const idle = new cards.CardSessionAuthority(cards.createCardsV2(), { sessionId: 's', projectId: 'p', occurrenceId: 'o', targetRevision: 1, revision: 0 }), old = idle.currentToken();
    idle.reconcile(updated);
    strict_1.default.equal(idle.snapshot(), null);
    strict_1.default.equal(idle.dispatch(old, { type: 'StartActivity', placementId: p.id }), false);
    strict_1.default.equal(idle.dispatch(idle.currentToken(), { type: 'StartActivity', placementId: p.id }), true);
});
