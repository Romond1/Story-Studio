"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const commands_1 = require("./lesson/commands");
const session_1 = require("./lesson/session");
const model_1 = require("./lesson/model");
const validation_1 = require("./lesson/validation");
(0, node_test_1.default)('selecting Story while already teaching Story preserves the scene visit and runtime', () => {
    const first = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), second = (0, commands_1.insertScene)(first.project, 'story');
    const added = (0, commands_1.addCard)(second.project, second.project.sequences.story[1].sceneId);
    const live = (0, session_1.cardAction)(added.project, (0, session_1.navigate)(added.project, (0, session_1.createSession)(), { sequence: 'story', entryId: second.entryId }), added.objectId, 'next');
    strict_1.default.equal((0, session_1.exitActivation)(added.project, live), live);
});
(0, node_test_1.default)('showing Activation directly from Edit records the current stable Story return location', () => {
    const first = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), second = (0, commands_1.insertScene)(first.project, 'story');
    const activation = (0, commands_1.insertScene)(second.project, 'activation');
    let session = (0, session_1.navigate)(activation.project, (0, session_1.createSession)(), { sequence: 'story', entryId: second.entryId });
    session = (0, session_1.navigate)(activation.project, session, { sequence: 'activation', entryId: activation.entryId });
    strict_1.default.deepEqual(session.storyReturn, { sequence: 'story', entryId: second.entryId });
    const reordered = (0, commands_1.reorderEntry)(activation.project, 'story', second.entryId, first.entryId);
    strict_1.default.equal((0, session_1.exitActivation)(reordered, session).cursor.entryId, second.entryId);
});
(0, node_test_1.default)('direct Story navigation clears a prior Activation checkpoint before another entry', () => {
    const story = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story'), activation = (0, commands_1.insertScene)(story.project, 'activation');
    const storyLocation = { sequence: 'story', entryId: story.entryId };
    const session = { ...(0, session_1.navigate)(activation.project, (0, session_1.createSession)(), { sequence: 'activation', entryId: activation.entryId }), storyReturn: storyLocation };
    strict_1.default.equal((0, session_1.navigate)(activation.project, session, storyLocation).storyReturn, null);
});
(0, node_test_1.default)('removing a face repairs every linked placement and live face state without mutating source revisions', () => {
    const initial = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'story');
    const sourceScene = initial.project.sequences.story[0].sceneId;
    const added = (0, commands_1.addCard)(initial.project, sourceScene), placement = added.project.scenes[sourceScene].objects[0];
    strict_1.default.ok(placement.kind === 'card');
    const linked = (0, commands_1.copyScene)(added.project, sourceScene, 'activation', true);
    const original = linked.project.cards[placement.cardId];
    const session = (0, session_1.navigate)(linked.project, (0, session_1.createSession)(), { sequence: 'activation', entryId: linked.entryId });
    const changed = (0, commands_1.putCard)(linked.project, { ...original, faces: original.faces.slice(1) });
    const active = (0, session_1.cardAction)(linked.project, session, placement.id, { faceId: original.faces[0].id });
    const reconciled = (0, session_1.reconcileSession)(changed, active);
    strict_1.default.equal(reconciled.cards[placement.id].faceId, original.faces[1].id);
    strict_1.default.equal((0, model_1.sceneAt)(changed, session.cursor).objects[0].initialFaceId, original.faces[1].id);
    strict_1.default.equal(original.faces.length, 2);
    strict_1.default.equal((0, validation_1.parseLessonProject)(changed).cards[original.id].faces.length, 1);
});
(0, node_test_1.default)('click-to-reveal cards toggle actual initial/live concealment while explicit Reveal remains one-way', () => {
    for (const initiallyConcealed of [false, true]) {
        const inserted = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'activation'), sceneId = inserted.project.sequences.activation[0].sceneId;
        const added = (0, commands_1.addCard)(inserted.project, sceneId), object = added.project.scenes[sceneId].objects[0];
        strict_1.default.ok(object.kind === 'card');
        const project = (0, commands_1.putObject)(added.project, sceneId, { ...object, interaction: 'reveal', initiallyConcealed });
        let live = (0, session_1.navigate)(project, (0, session_1.createSession)(), { sequence: 'activation', entryId: inserted.entryId });
        live = (0, session_1.cardAction)(project, live, object.id, 'interact');
        strict_1.default.equal(live.cards[object.id].concealed, !initiallyConcealed);
        live = (0, session_1.cardAction)(project, live, object.id, 'interact');
        strict_1.default.equal(live.cards[object.id].concealed, initiallyConcealed);
        live = (0, session_1.cardAction)(project, live, object.id, 'reveal');
        live = (0, session_1.cardAction)(project, live, object.id, 'reveal');
        strict_1.default.equal(live.cards[object.id].concealed, false);
        strict_1.default.equal(live.cards[object.id].faceId, object.initialFaceId);
        const manual = (0, commands_1.putObject)(project, sceneId, { ...object, interaction: 'manual' });
        strict_1.default.equal((0, session_1.cardAction)(manual, live, object.id, 'interact'), live);
    }
});
