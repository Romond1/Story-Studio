"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const presentationSession_1 = require("./presentationSession");
const editSelection_1 = require("./editSelection");
const projectHistory_1 = require("./projectHistory");
const data = { version: 4, createdAt: '', updatedAt: '', assets: [], sections: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }], slides: [
        { id: '12', assetId: 'a', sectionId: 'one', transition: 'none' }, { id: '15', assetId: 'b', sectionId: 'two', transition: 'none' }
    ] };
const live = (0, presentationSession_1.reducePresentationSession)((0, presentationSession_1.createPresentationSession)('live'), { type: 'project', projectId: 'p', slideId: '12', sectionId: 'one' });
(0, node_test_1.default)('Slide 15 and another section in Edit leave Live on Slide 12', () => {
    const edit = (0, editSelection_1.selectEdit)((0, editSelection_1.createEditSelection)(data), { storySlideId: '15', sectionId: 'two' });
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, (0, editSelection_1.editSessionView)(edit, live)).contentId, '15');
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, live).contentId, '12');
    strict_1.default.equal(live.sectionId, 'one');
});
(0, node_test_1.default)('only explicit Show in Present hands selectors to Core, including leaving a booster', () => {
    const edit = (0, editSelection_1.selectEdit)((0, editSelection_1.createEditSelection)(data), { storySlideId: '15', sectionId: 'two' });
    const boost = (0, presentationSession_1.reducePresentationSession)(live, { type: 'select', changes: { mode: 'boost', boostItemId: 'activity' } });
    const shown = (0, editSelection_1.showEditInPresent)(edit, boost);
    strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, shown).contentId, '15');
    strict_1.default.equal(shown.sessionId, live.sessionId);
    strict_1.default.ok(shown.targetRevision > boost.targetRevision);
});
(0, node_test_1.default)('Edit browsing never invokes live audio stops; live navigation still does', () => {
    const calls = [];
    const audio = { stopSlideAudio: () => calls.push('slide'), stopSectionMusic: () => calls.push('section') };
    (0, editSelection_1.runNavigationAudio)('edit', true, audio);
    strict_1.default.deepEqual(calls, []);
    (0, editSelection_1.runNavigationAudio)('teach', false, audio);
    (0, editSelection_1.runNavigationAudio)('teach', true, audio);
    strict_1.default.deepEqual(calls, ['slide', 'slide', 'section']);
});
(0, node_test_1.default)('authored edits target Edit, survive history/serialization, and serialize no cursor', () => {
    const edit = (0, editSelection_1.selectEdit)((0, editSelection_1.createEditSelection)(data), { storySlideId: '15', sectionId: 'two' });
    const view = (0, editSelection_1.editSessionView)(edit, live);
    const target = (0, presentationSession_1.resolvePresentationTarget)(data, view);
    const history = new projectHistory_1.ProjectHistory();
    history.reset(data);
    const changed = (0, presentationSession_1.applyPresentationDrawing)(data, view, (0, presentationSession_1.presentationToken)(view, target), [{ id: 'ink', color: '#000', size: 2, opacity: 1, rainbow: false, points: [] }]);
    history.record(changed);
    const reopened = JSON.parse(JSON.stringify(changed));
    strict_1.default.equal(reopened.slides[0].markerStrokes, undefined);
    strict_1.default.equal(reopened.slides[1].markerStrokes?.[0].id, 'ink');
    strict_1.default.equal('editSelection' in reopened, false);
    strict_1.default.equal(history.undo(), data);
    strict_1.default.equal(history.redo(), changed);
});
(0, node_test_1.default)('mode switches resolve independent valid cursors without copying selection', () => {
    const edit = (0, editSelection_1.selectEdit)((0, editSelection_1.createEditSelection)(data), { storySlideId: '15', sectionId: 'two' });
    for (const mode of ['edit', 'teach', 'edit']) {
        strict_1.default.equal((0, presentationSession_1.resolvePresentationTarget)(data, mode === 'edit' ? (0, editSelection_1.editSessionView)(edit, live) : live).contentId, mode === 'edit' ? '15' : '12');
    }
});
