"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLesson = createLesson;
exports.createScene = createScene;
exports.putScene = putScene;
exports.insertScene = insertScene;
exports.removeEntry = removeEntry;
exports.reorderEntry = reorderEntry;
exports.fitBox = fitBox;
exports.putObject = putObject;
exports.addObject = addObject;
exports.removeObject = removeObject;
exports.layerObject = layerObject;
exports.createCard = createCard;
exports.independentCard = independentCard;
exports.putCard = putCard;
exports.addCard = addCard;
exports.insertCardSet = insertCardSet;
exports.addText = addText;
exports.duplicateObject = duplicateObject;
exports.copyScene = copyScene;
exports.duplicateEntry = duplicateEntry;
const model_1 = require("./model");
const limits_1 = require("./limits");
function assertObjectCapacity(scene, adding) {
    if (scene.objects.length + adding > limits_1.LESSON_LIMITS.objectsPerScene)
        throw new Error(`This scene can contain at most ${limits_1.LESSON_LIMITS.objectsPerScene} objects. Add the content to another scene.`);
}
function assertCardCapacity(project, adding) {
    if (Object.keys(project.cards).length + adding > limits_1.LESSON_LIMITS.cards)
        throw new Error(`This lesson can contain at most ${limits_1.LESSON_LIMITS.cards} Cards. Reuse a linked Card or start another lesson.`);
}
function createLesson(title = 'Untitled lesson') {
    const now = new Date().toISOString();
    return { format: 'story-studio-scene', version: 1, id: (0, model_1.makeId)(), title, createdAt: now, updatedAt: now,
        assets: [], mediaBins: [], cards: {}, library: [], cardSets: [], scenes: {}, sequences: { story: [], activation: [] } };
}
function createScene(title = 'New scene', assetId) {
    return { id: (0, model_1.makeId)(), title, frame: { width: 1280, height: 720 }, background: { color: '#172332', ...(assetId ? { assetId } : {}) },
        objects: [], drawings: [], audio: [], transition: { kind: 'none', durationMs: 400 }, viewport: { zoom: 1, pan: { x: 0, y: 0 } }, notes: '' };
}
function putScene(project, scene) {
    if (!project.scenes[scene.id])
        return project;
    return { ...project, scenes: { ...project.scenes, [scene.id]: scene } };
}
function insertScene(project, sequence, scene = createScene(), beforeEntryId) {
    if (project.sequences[sequence].length >= limits_1.LESSON_LIMITS.entriesPerSequence)
        throw new Error(`${sequence === 'story' ? 'Adventure' : 'Discovery'} can contain at most ${limits_1.LESSON_LIMITS.entriesPerSequence} scene entries. Remove an entry before adding another.`);
    if (!project.scenes[scene.id] && Object.keys(project.scenes).length >= limits_1.LESSON_LIMITS.scenes)
        throw new Error(`This lesson can contain at most ${limits_1.LESSON_LIMITS.scenes} scenes. Reuse a linked scene or start another lesson.`);
    assertObjectCapacity(scene, 0);
    const before = project.sequences[sequence].find(item => item.id === beforeEntryId);
    const entry = { id: (0, model_1.makeId)(), sceneId: scene.id, section: before?.section ?? '', ...(before?.sectionId ? { sectionId: before.sectionId } : {}) };
    const entries = [...project.sequences[sequence]];
    const index = beforeEntryId ? entries.findIndex(item => item.id === beforeEntryId) : -1;
    entries.splice(index < 0 ? entries.length : index, 0, entry);
    return { project: { ...project, scenes: { ...project.scenes, [scene.id]: scene }, sequences: { ...project.sequences, [sequence]: entries } }, entryId: entry.id };
}
function removeEntry(project, sequence, entryId) {
    const entries = project.sequences[sequence].filter(item => item.id !== entryId);
    return entries.length === project.sequences[sequence].length ? project : { ...project, sequences: { ...project.sequences, [sequence]: entries } };
}
function reorderEntry(project, sequence, entryId, beforeEntryId) {
    if (entryId === beforeEntryId)
        return project;
    const entry = project.sequences[sequence].find(item => item.id === entryId);
    if (!entry)
        return project;
    const entries = project.sequences[sequence].filter(item => item.id !== entryId);
    const index = beforeEntryId ? entries.findIndex(item => item.id === beforeEntryId) : -1;
    entries.splice(index < 0 ? entries.length : index, 0, entry);
    return { ...project, sequences: { ...project.sequences, [sequence]: entries } };
}
function fitBox(box, frame) {
    const width = Math.max(24, Math.min(frame.width, box.width));
    const height = Math.max(24, Math.min(frame.height, box.height));
    return { width, height, x: Math.max(0, Math.min(frame.width - width, box.x)), y: Math.max(0, Math.min(frame.height - height, box.y)) };
}
function putObject(project, sceneId, object) {
    const scene = project.scenes[sceneId];
    if (!scene || !scene.objects.some(item => item.id === object.id))
        return project;
    return putScene(project, { ...scene, objects: scene.objects.map(item => item.id === object.id ? { ...object, box: fitBox(object.box, scene.frame) } : item) });
}
function addObject(project, sceneId, object) {
    const scene = project.scenes[sceneId];
    if (!scene || scene.objects.some(item => item.id === object.id))
        return project;
    assertObjectCapacity(scene, 1);
    return putScene(project, { ...scene, objects: [...scene.objects, { ...object, box: fitBox(object.box, scene.frame) }] });
}
function removeObject(project, sceneId, objectId) {
    const scene = project.scenes[sceneId];
    if (!scene || !scene.objects.some(item => item.id === objectId))
        return project;
    return putScene(project, { ...scene, objects: scene.objects.filter(item => item.id !== objectId) });
}
function layerObject(project, sceneId, objectId, direction) {
    const scene = project.scenes[sceneId];
    if (!scene)
        return project;
    const objects = [...scene.objects], index = objects.findIndex(item => item.id === objectId);
    const next = index + (direction === 'up' ? 1 : -1);
    if (index < 0 || next < 0 || next >= objects.length)
        return project;
    [objects[index], objects[next]] = [objects[next], objects[index]];
    return putScene(project, { ...scene, objects });
}
function createCard() {
    return { id: (0, model_1.makeId)(), label: 'New card', tags: [], style: { preset: 'classroom', fit: 'auto' }, faces: [
            { id: (0, model_1.makeId)(), label: 'Prompt', layout: 'text', text: 'Type a question' },
            { id: (0, model_1.makeId)(), label: 'Answer', layout: 'text', text: 'Type an answer' },
        ] };
}
function independentCard(card) {
    return { ...(0, model_1.clone)(card), id: (0, model_1.makeId)(), faces: card.faces.map(face => ({ ...(0, model_1.clone)(face), id: (0, model_1.makeId)() })) };
}
function putCard(project, card) {
    if (!project.cards[card.id] || !card.faces.length)
        return project;
    const scenes = Object.fromEntries(Object.entries(project.scenes).map(([id, scene]) => [id, { ...scene, objects: scene.objects.map(object => object.kind === 'card' && object.cardId === card.id && !card.faces.some(face => face.id === object.initialFaceId)
                ? { ...object, initialFaceId: card.faces[0].id } : object) }]));
    return { ...project, cards: { ...project.cards, [card.id]: card }, scenes };
}
function addCard(project, sceneId, sourceId, linked = false) {
    const scene = project.scenes[sceneId];
    if (!scene)
        throw new Error('Scene no longer exists.');
    assertObjectCapacity(scene, 1);
    const source = sourceId ? project.cards[sourceId] : undefined;
    if (sourceId && !source)
        throw new Error('Card no longer exists.');
    assertCardCapacity(project, source && linked ? 0 : 1);
    const card = source ? linked ? source : independentCard(source) : createCard();
    const object = { kind: 'card', id: (0, model_1.makeId)(), cardId: card.id, initialFaceId: card.faces[0].id,
        initiallyConcealed: false, interaction: 'cycle', visible: true, box: { x: 80, y: 90, width: 360, height: 230 } };
    return { project: addObject({ ...project, cards: { ...project.cards, [card.id]: card } }, sceneId, object), objectId: object.id };
}
/** An optional Set creates ordinary independent Cards, using the same scene commands. */
function insertCardSet(project, sceneId, setId) {
    const scene = project.scenes[sceneId], set = project.cardSets.find(item => item.id === setId);
    if (!scene)
        throw new Error('Scene no longer exists.');
    if (!set)
        throw new Error('Card Set no longer exists.');
    if (!set.entries.length)
        return { project, objectIds: [] };
    assertObjectCapacity(scene, set.entries.length);
    assertCardCapacity(project, set.entries.length);
    for (const entry of set.entries) {
        const source = project.cards[entry.cardId];
        if (!source || !Array.isArray(source.faces) || !source.faces.length)
            throw new Error('A Card in this Set is no longer available.');
    }
    const count = set.entries.length, { width, height } = scene.frame;
    let grid;
    // Prefer comfortable gutters. A dense Set can still fit a small authored
    // frame by dropping gutters before shrinking below the minimum object size.
    for (const spacing of [1, 0]) {
        const margin = spacing * Math.min(40, width * .04, height * .04);
        const gap = spacing * Math.min(24, width * .02, height * .02);
        for (let columns = 1; columns <= count; columns++) {
            const rows = Math.ceil(count / columns);
            const cellWidth = (width - 2 * margin - (columns - 1) * gap) / columns;
            const cellHeight = (height - 2 * margin - (rows - 1) * gap) / rows;
            if (cellWidth < 24 || cellHeight < 24)
                continue;
            const score = Math.abs(Math.log((cellWidth / cellHeight) / (360 / 230))) + (columns * rows - count) / count * .25;
            if (!grid || score < grid.score)
                grid = { columns, rows, cellWidth, cellHeight, margin, gap, score };
        }
        if (grid)
            break;
    }
    if (!grid)
        throw new Error('This Card Set does not fit the scene. Use a larger frame or a smaller Set.');
    const objectIds = [];
    for (let index = 0; index < count; index++) {
        const added = addCard(project, sceneId, set.entries[index].cardId, false);
        const object = added.project.scenes[sceneId].objects.find(item => item.id === added.objectId);
        const cardWidth = Math.min(360, grid.cellWidth), cardHeight = Math.min(230, grid.cellHeight);
        const box = fitBox({
            x: grid.margin + index % grid.columns * (grid.cellWidth + grid.gap) + (grid.cellWidth - cardWidth) / 2,
            y: grid.margin + Math.floor(index / grid.columns) * (grid.cellHeight + grid.gap) + (grid.cellHeight - cardHeight) / 2,
            width: cardWidth, height: cardHeight,
        }, scene.frame);
        project = putObject(added.project, sceneId, { ...object, box });
        objectIds.push(added.objectId);
    }
    return { project, objectIds };
}
function addText(project, sceneId, kind) {
    const object = { kind, id: (0, model_1.makeId)(), visible: true, text: kind === 'bubble' ? 'What happens next?' : 'Type your text',
        fontSize: 32, color: kind === 'bubble' ? '#182331' : '#ffffff', align: 'center', box: { x: 120, y: 350, width: 360, height: 170 } };
    return { project: addObject(project, sceneId, object), objectId: object.id };
}
function duplicateObject(project, sceneId, objectId) {
    const original = project.scenes[sceneId]?.objects.find(item => item.id === objectId);
    if (!original)
        return { project, objectId };
    assertObjectCapacity(project.scenes[sceneId], 1);
    if (original.kind === 'card')
        assertCardCapacity(project, 1);
    const object = { ...(0, model_1.clone)(original), id: (0, model_1.makeId)(), box: { ...original.box, x: original.box.x + 32, y: original.box.y + 32 } };
    if (object.kind === 'card' && original.kind === 'card') {
        const source = project.cards[original.cardId], card = independentCard(source);
        object.cardId = card.id;
        object.initialFaceId = card.faces[Math.max(0, source.faces.findIndex(face => face.id === original.initialFaceId))].id;
        project = { ...project, cards: { ...project.cards, [card.id]: card } };
    }
    return { project: addObject(project, sceneId, object), objectId: object.id };
}
function copyScene(project, sceneId, destination, linked) {
    const source = project.scenes[sceneId];
    if (!source)
        throw new Error('Scene no longer exists');
    if (linked)
        return insertScene(project, destination, source);
    assertObjectCapacity(source, 0);
    assertCardCapacity(project, source.objects.filter(object => object.kind === 'card').length);
    const scene = { ...(0, model_1.clone)(source), id: (0, model_1.makeId)(), title: `${source.title.slice(0, 495)} copy`, objects: [] };
    const added = insertScene(project, destination, scene);
    project = added.project;
    for (const original of source.objects) {
        let object = { ...(0, model_1.clone)(original), id: (0, model_1.makeId)() };
        if (object.kind === 'card' && original.kind === 'card') {
            const definition = project.cards[original.cardId], card = independentCard(definition);
            object = { ...object, cardId: card.id, initialFaceId: card.faces[Math.max(0, definition.faces.findIndex(face => face.id === original.initialFaceId))].id };
            project = { ...project, cards: { ...project.cards, [card.id]: card } };
        }
        project = addObject(project, scene.id, object);
    }
    return { project, entryId: added.entryId };
}
/** Duplicate a timeline occurrence, preserving its Break type and same-sequence group. */
function duplicateEntry(project, sourceSequence, sourceEntryId, destination, linked = false) {
    const source = project.sequences[sourceSequence].find(e => e.id === sourceEntryId);
    if (!source)
        throw new Error('Scene entry no longer exists.');
    const added = copyScene(project, source.sceneId, destination, linked);
    const entries = added.project.sequences[destination].filter(e => e.id !== added.entryId);
    const newEntry = added.project.sequences[destination].find(e => e.id === added.entryId);
    const sameSequence = sourceSequence === destination;
    const index = sameSequence ? entries.findIndex(e => e.id === sourceEntryId) + 1 : entries.length;
    entries.splice(index, 0, { ...newEntry, kind: source.kind, section: sameSequence ? source.section : '', ...(sameSequence && source.sectionId ? { sectionId: source.sectionId } : {}) });
    return { ...added, project: { ...added.project, sequences: { ...added.project.sequences, [destination]: entries } } };
}
