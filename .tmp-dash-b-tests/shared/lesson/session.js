"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.resetScene = resetScene;
exports.moveLiveCard = moveLiveCard;
exports.setLiveDrawings = setLiveDrawings;
exports.undoLiveDrawing = undoLiveDrawing;
exports.redoLiveDrawing = redoLiveDrawing;
exports.navigate = navigate;
exports.stepScene = stepScene;
exports.startActivation = startActivation;
exports.exitActivation = exitActivation;
exports.reconcileSession = reconcileSession;
exports.cardAction = cardAction;
const model_1 = require("./model");
const commands_1 = require("./commands");
const locationKey = (location) => JSON.stringify([location.sequence, location.entryId]);
function defaults(scene) {
    return { sceneId: scene?.id ?? '', cards: {}, drawings: [], viewport: (0, model_1.clone)(scene?.viewport ?? { zoom: 1, pan: { x: 0, y: 0 } }), drawingUndo: [], drawingRedo: [] };
}
function cacheCurrent(project, session) {
    const scenes = { ...session.scenes }, scene = (0, model_1.sceneAt)(project, session.cursor);
    if (scene && session.cursor)
        scenes[locationKey(session.cursor)] = (0, model_1.clone)({ sceneId: scene.id, cards: session.cards, drawings: session.drawings, viewport: session.viewport, drawingUndo: session.drawingUndo ?? [], drawingRedo: session.drawingRedo ?? [] });
    return scenes;
}
function createSession() {
    return { id: (0, model_1.makeId)(), revision: 0, visit: 0, cursor: null, storyReturn: null, cards: {}, drawings: [], viewport: { zoom: 1, pan: { x: 0, y: 0 } } };
}
/** Reset just the current occurrence to the scene's authored defaults. */
function resetScene(project, session) {
    const scene = (0, model_1.sceneAt)(project, session.cursor);
    if (!scene || !session.cursor)
        return session;
    const next = { ...session, ...defaults(scene), revision: session.revision + 1, visit: session.visit + 1 };
    return { ...next, scenes: cacheCurrent(project, next) };
}
function moveLiveCard(project, session, objectId, box) {
    const scene = (0, model_1.sceneAt)(project, session.cursor), object = scene?.objects.find(item => item.id === objectId);
    if (!scene || object?.kind !== 'card' || !project.cards[object.cardId] || ![box.x, box.y, box.width, box.height].every(Number.isFinite))
        return session;
    const state = session.cards[objectId] ?? { faceId: object.initialFaceId, concealed: object.initiallyConcealed };
    return { ...session, revision: session.revision + 1, cards: { ...session.cards, [objectId]: { ...state, box: (0, commands_1.fitBox)(box, scene.frame) } } };
}
function setLiveDrawings(session, drawings) {
    if (!session.cursor || JSON.stringify(drawings) === JSON.stringify(session.drawings))
        return session;
    return { ...session, revision: session.revision + 1, drawings: (0, model_1.clone)(drawings), drawingUndo: [...(session.drawingUndo ?? []), (0, model_1.clone)(session.drawings)].slice(-100), drawingRedo: [] };
}
function undoLiveDrawing(session) {
    const undo = session.drawingUndo ?? [];
    if (!session.cursor || !undo.length)
        return session;
    return { ...session, revision: session.revision + 1, drawings: (0, model_1.clone)(undo[undo.length - 1]), drawingUndo: undo.slice(0, -1), drawingRedo: [...(session.drawingRedo ?? []), (0, model_1.clone)(session.drawings)] };
}
function redoLiveDrawing(session) {
    const redo = session.drawingRedo ?? [];
    if (!session.cursor || !redo.length)
        return session;
    return { ...session, revision: session.revision + 1, drawings: (0, model_1.clone)(redo[redo.length - 1]), drawingUndo: [...(session.drawingUndo ?? []), (0, model_1.clone)(session.drawings)], drawingRedo: redo.slice(0, -1) };
}
function navigate(project, session, location) {
    const scene = (0, model_1.sceneAt)(project, location);
    const cursor = scene ? location : null;
    // Every entry route (Teach, timeline, and Show in Present) uses this contract.
    // Capturing the checkpoint only in Start Activation misses direct navigation.
    const storyReturn = cursor?.sequence === 'activation' && session.cursor?.sequence === 'story'
        ? { ...session.cursor } : cursor?.sequence === 'story' ? null : session.storyReturn;
    const scenes = cacheCurrent(project, session);
    const saved = cursor && scenes[locationKey(cursor)];
    const state = saved && saved.sceneId === scene?.id ? (0, model_1.clone)(saved) : defaults(scene);
    return reconcileSession(project, { ...session, ...state, scenes, revision: session.revision + 1, visit: session.visit + 1, cursor, storyReturn });
}
function stepScene(project, session, direction) {
    if (!session.cursor) {
        const entry = project.sequences.story[0];
        return entry ? navigate(project, session, { sequence: 'story', entryId: entry.id }) : session;
    }
    const entries = project.sequences[session.cursor.sequence], index = entries.findIndex(entry => entry.id === session.cursor.entryId);
    const target = entries[index + direction];
    return target ? navigate(project, session, { sequence: session.cursor.sequence, entryId: target.id }) : session;
}
function startActivation(project, session) {
    const first = project.sequences.activation[0];
    if (!first || session.cursor?.sequence === 'activation')
        return session;
    return navigate(project, { ...session, storyReturn: session.cursor?.sequence === 'story' ? session.cursor : null }, { sequence: 'activation', entryId: first.id });
}
function exitActivation(project, session) {
    if (session.cursor?.sequence !== 'activation' && !session.storyReturn)
        return session;
    const first = project.sequences.story[0];
    const target = (0, model_1.sceneAt)(project, session.storyReturn) ? session.storyReturn : first ? { sequence: 'story', entryId: first.id } : null;
    return navigate(project, { ...session, storyReturn: null }, target);
}
function reconcileSession(project, session) {
    const scenes = {};
    for (const sequence of ['story', 'activation'])
        for (const entry of project.sequences[sequence]) {
            const key = locationKey({ sequence, entryId: entry.id }), saved = session.scenes?.[key], scene = project.scenes[entry.sceneId];
            if (saved && scene && saved.sceneId === scene.id)
                scenes[key] = { ...saved, cards: reconcileCards(project, scene, saved.cards) };
        }
    const scene = (0, model_1.sceneAt)(project, session.cursor);
    const next = { ...session, scenes, storyReturn: (0, model_1.sceneAt)(project, session.storyReturn) ? session.storyReturn : null,
        ...(scene ? { cards: reconcileCards(project, scene, session.cards) } : session.cursor ? { ...defaults(), cursor: null } : {}) };
    return JSON.stringify(next) === JSON.stringify(session) ? session : { ...next, revision: session.revision + 1 };
}
function reconcileCards(project, scene, existing) {
    const cards = {};
    for (const object of scene.objects) {
        if (object.kind !== 'card' || !existing[object.id])
            continue;
        const card = project.cards[object.cardId];
        if (!card?.faces.length)
            continue;
        const state = existing[object.id];
        const initial = card.faces.some(face => face.id === object.initialFaceId) ? object.initialFaceId : card.faces[0].id;
        cards[object.id] = { ...state, faceId: card.faces.some(face => face.id === state.faceId) ? state.faceId : initial };
    }
    return cards;
}
function cardAction(project, session, objectId, action) {
    const scene = (0, model_1.sceneAt)(project, session.cursor), object = scene?.objects.find(item => item.id === objectId);
    if (!object || object.kind !== 'card')
        return session;
    const card = project.cards[object.cardId];
    if (!card)
        return session;
    const initial = { faceId: object.initialFaceId, concealed: object.initiallyConcealed };
    let state = { ...(session.cards[object.id] ?? initial) };
    if (action === 'interact')
        action = object.interaction === 'cycle' ? 'next' : object.interaction === 'reveal' ? state.concealed ? 'reveal' : 'conceal' : 'interact';
    if (action === 'interact')
        return session;
    if (action === 'reset')
        state = initial;
    else if (action === 'conceal' || action === 'reveal')
        state.concealed = action === 'conceal';
    else if (typeof action === 'object') {
        if (!card.faces.some(face => face.id === action.faceId))
            return session;
        state.faceId = action.faceId;
        state.concealed = false;
    }
    else {
        const index = Math.max(0, card.faces.findIndex(face => face.id === state.faceId));
        state.faceId = card.faces[(index + (action === 'next' ? 1 : -1) + card.faces.length) % card.faces.length].id;
        state.concealed = false;
    }
    return { ...session, revision: session.revision + 1, cards: { ...session.cards, [object.id]: state } };
}
