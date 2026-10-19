"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEditSelection = createEditSelection;
exports.selectEdit = selectEdit;
exports.editSessionView = editSessionView;
exports.showEditInPresent = showEditInPresent;
exports.runNavigationAudio = runNavigationAudio;
const presentationSession_1 = require("./presentationSession");
function createEditSelection(data) {
    return { mode: 'story', sectionId: data?.sections[0]?.id ?? null, storySlideId: data?.slides.find(s => s.sectionId === data.sections[0]?.id)?.id ?? null,
        boostTab: 'activation', boostItemId: null, boardId: null, revision: 0 };
}
function selectEdit(previous, changes) {
    return Object.entries(changes).some(([key, value]) => previous[key] !== value) ? { ...previous, ...changes, revision: previous.revision + 1 } : previous;
}
/** Reuse the pure resolver; this adapter is never committed to Core. */
function editSessionView(edit, live) {
    return { ...(0, presentationSession_1.createPresentationSession)(`edit:${live.sessionId}`), ...edit, projectId: live.projectId, targetRevision: edit.revision };
}
function showEditInPresent(edit, live) {
    const { revision, ...changes } = edit;
    // Return-from-booster checkpoint remains Core's behavior, then explicitly select
    // the requested object so that checkpoint restoration cannot override the handoff.
    const mode = (0, presentationSession_1.reducePresentationSession)(live, { type: 'select', changes: { mode: edit.mode } });
    return (0, presentationSession_1.reducePresentationSession)(mode, { type: 'select', changes });
}
function runNavigationAudio(mode, sectionChanged, audio) {
    if (mode !== 'teach')
        return;
    audio.stopSlideAudio();
    if (sectionChanged)
        audio.stopSectionMusic();
}
