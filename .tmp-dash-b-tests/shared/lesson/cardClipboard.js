"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyCardSnapshot = copyCardSnapshot;
exports.pasteCard = pasteCard;
exports.copyCardToScene = copyCardToScene;
exports.moveCardToScene = moveCardToScene;
const model_1 = require("./model");
const commands_1 = require("./commands");
const limits_1 = require("./limits");
function copyCardSnapshot(project, sceneId, objectId) {
    const object = project.scenes[sceneId]?.objects.find(o => o.id === objectId);
    return object?.kind === 'card' && project.cards[object.cardId] ? (0, model_1.clone)({ card: project.cards[object.cardId], object }) : null;
}
function pasteCard(project, destination, snapshot) {
    const scene = (0, model_1.sceneAt)(project, destination);
    if (!scene)
        throw new Error('Destination scene no longer exists.');
    if (Object.keys(project.cards).length >= limits_1.LESSON_LIMITS.cards)
        throw new Error('This lesson has reached its Card limit.');
    const card = (0, commands_1.independentCard)(snapshot.card), objectId = (0, model_1.makeId)();
    const faceIndex = Math.max(0, snapshot.card.faces.findIndex(f => f.id === snapshot.object.initialFaceId));
    const object = { ...(0, model_1.clone)(snapshot.object), id: objectId, cardId: card.id, initialFaceId: card.faces[faceIndex].id };
    return { project: (0, commands_1.addObject)({ ...project, cards: { ...project.cards, [card.id]: card } }, scene.id, object), objectId, selection: { ...destination, objectId } };
}
function copyCardToScene(project, sourceSceneId, objectId, destination) {
    const snapshot = copyCardSnapshot(project, sourceSceneId, objectId);
    if (!snapshot)
        throw new Error('Source Card no longer exists.');
    return pasteCard(project, destination, snapshot);
}
function moveCardToScene(project, sourceSceneId, objectId, destination) {
    if ((0, model_1.sceneAt)(project, destination)?.id === sourceSceneId)
        return { project, objectId, selection: { ...destination, objectId } };
    const copied = copyCardToScene(project, sourceSceneId, objectId, destination);
    return { ...copied, project: (0, commands_1.removeObject)(copied.project, sourceSceneId, objectId) };
}
