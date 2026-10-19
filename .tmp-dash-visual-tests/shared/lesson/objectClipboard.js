"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyObjects = copyObjects;
exports.pasteObjects = pasteObjects;
const model_1 = require("./model");
const commands_1 = require("./commands");
const objectSelection_1 = require("./objectSelection");
const limits_1 = require("./limits");
function copyObjects(project, sceneId, ids) {
    const objects = project.scenes[sceneId]?.objects.filter(o => ids.includes(o.id)) ?? [];
    const cards = Object.fromEntries(objects.flatMap(o => o.kind === 'card' ? [[o.cardId, project.cards[o.cardId]]] : []));
    return (0, model_1.clone)({ objects, cards, projectId: project.id });
}
function pasteObjects(project, sceneId, copied) {
    const scene = project.scenes[sceneId];
    if (!scene || copied.projectId !== project.id)
        return { project, objectIds: [] };
    const cardCount = copied.objects.filter(o => o.kind === 'card').length;
    if (Object.keys(project.cards).length + cardCount > limits_1.LESSON_LIMITS.cards)
        throw new Error('This lesson has reached its Card limit.');
    if (scene.objects.length + copied.objects.length > limits_1.LESSON_LIMITS.objectsPerScene)
        throw new Error('This scene has reached its object limit.');
    const boxes = (0, objectSelection_1.translateBoxes)(copied.objects, 32, 32, scene.frame);
    let next = project;
    const objectIds = [];
    for (const original of copied.objects) {
        const item = { ...(0, model_1.clone)(original), id: (0, model_1.makeId)(), box: boxes.find(o => o.id === original.id).box };
        if (item.kind === 'card' && original.kind === 'card') {
            const source = copied.cards[original.cardId], card = (0, commands_1.independentCard)(source);
            item.cardId = card.id;
            item.initialFaceId = card.faces[Math.max(0, source.faces.findIndex(f => f.id === original.initialFaceId))].id;
            next = { ...next, cards: { ...next.cards, [card.id]: card } };
        }
        next = (0, commands_1.addObject)(next, sceneId, item);
        objectIds.push(item.id);
    }
    return { project: next, objectIds };
}
