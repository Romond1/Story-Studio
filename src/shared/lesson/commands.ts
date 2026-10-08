import type { CardDefinition } from '../cardsV2';
import { clone, makeId, type LessonProject, type LessonScene, type Rect, type SceneObject, type SequenceKind } from './model';
import { LESSON_LIMITS } from './limits';

function assertObjectCapacity(scene: LessonScene, adding: number) {
  if (scene.objects.length + adding > LESSON_LIMITS.objectsPerScene) throw new Error(`This scene can contain at most ${LESSON_LIMITS.objectsPerScene} objects. Add the content to another scene.`);
}
function assertCardCapacity(project: LessonProject, adding: number) {
  if (Object.keys(project.cards).length + adding > LESSON_LIMITS.cards) throw new Error(`This lesson can contain at most ${LESSON_LIMITS.cards} Cards. Reuse a linked Card or start another lesson.`);
}

export function createLesson(title = 'Untitled lesson'): LessonProject {
  const now = new Date().toISOString();
  return { format: 'story-studio-scene', version: 1, id: makeId(), title, createdAt: now, updatedAt: now,
    assets: [], mediaBins: [], cards: {}, library: [], cardSets: [], scenes: {}, sequences: { story: [], activation: [] } };
}
export function createScene(title = 'New scene', assetId?: string): LessonScene {
  return { id: makeId(), title, frame: { width: 1280, height: 720 }, background: { color: '#172332', ...(assetId ? { assetId } : {}) },
    objects: [], drawings: [], audio: [], transition: { kind: 'none', durationMs: 400 }, viewport: { zoom: 1, pan: { x: 0, y: 0 } }, notes: '' };
}
export function putScene(project: LessonProject, scene: LessonScene): LessonProject {
  if (!project.scenes[scene.id]) return project;
  return { ...project, scenes: { ...project.scenes, [scene.id]: scene } };
}
export function insertScene(project: LessonProject, sequence: SequenceKind, scene = createScene(), beforeEntryId?: string): { project: LessonProject; entryId: string } {
  if (project.sequences[sequence].length >= LESSON_LIMITS.entriesPerSequence) throw new Error(`${sequence === 'story' ? 'Story' : 'Activation'} can contain at most ${LESSON_LIMITS.entriesPerSequence} scene entries. Remove an entry before adding another.`);
  if (!project.scenes[scene.id] && Object.keys(project.scenes).length >= LESSON_LIMITS.scenes) throw new Error(`This lesson can contain at most ${LESSON_LIMITS.scenes} scenes. Reuse a linked scene or start another lesson.`);
  assertObjectCapacity(scene, 0);
  const before = project.sequences[sequence].find(item => item.id === beforeEntryId);
  const entry = { id: makeId(), sceneId: scene.id, section: before?.section ?? '', ...(before?.sectionId ? { sectionId: before.sectionId } : {}) };
  const entries = [...project.sequences[sequence]];
  const index = beforeEntryId ? entries.findIndex(item => item.id === beforeEntryId) : -1;
  entries.splice(index < 0 ? entries.length : index, 0, entry);
  return { project: { ...project, scenes: { ...project.scenes, [scene.id]: scene }, sequences: { ...project.sequences, [sequence]: entries } }, entryId: entry.id };
}
export function removeEntry(project: LessonProject, sequence: SequenceKind, entryId: string): LessonProject {
  const entries = project.sequences[sequence].filter(item => item.id !== entryId);
  return entries.length === project.sequences[sequence].length ? project : { ...project, sequences: { ...project.sequences, [sequence]: entries } };
}
export function reorderEntry(project: LessonProject, sequence: SequenceKind, entryId: string, beforeEntryId?: string): LessonProject {
  if (entryId === beforeEntryId) return project;
  const entry = project.sequences[sequence].find(item => item.id === entryId);
  if (!entry) return project;
  const entries = project.sequences[sequence].filter(item => item.id !== entryId);
  const index = beforeEntryId ? entries.findIndex(item => item.id === beforeEntryId) : -1;
  const destination = index >= 0 ? entries[index] : entries[entries.length - 1];
  entries.splice(index < 0 ? entries.length : index, 0, { ...entry, sectionId: destination?.sectionId, section: destination?.section ?? '' });
  return { ...project, sequences: { ...project.sequences, [sequence]: entries } };
}
export function fitBox(box: Rect, frame: LessonScene['frame']): Rect {
  const width = Math.max(24, Math.min(frame.width, box.width));
  const height = Math.max(24, Math.min(frame.height, box.height));
  return { width, height, x: Math.max(0, Math.min(frame.width - width, box.x)), y: Math.max(0, Math.min(frame.height - height, box.y)) };
}
export function putObject(project: LessonProject, sceneId: string, object: SceneObject): LessonProject {
  const scene = project.scenes[sceneId];
  if (!scene || !scene.objects.some(item => item.id === object.id)) return project;
  return putScene(project, { ...scene, objects: scene.objects.map(item => item.id === object.id ? { ...object, box: fitBox(object.box, scene.frame) } : item) });
}
export function addObject(project: LessonProject, sceneId: string, object: SceneObject): LessonProject {
  const scene = project.scenes[sceneId];
  if (!scene || scene.objects.some(item => item.id === object.id)) return project;
  assertObjectCapacity(scene, 1);
  return putScene(project, { ...scene, objects: [...scene.objects, { ...object, box: fitBox(object.box, scene.frame) }] });
}
export function removeObject(project: LessonProject, sceneId: string, objectId: string): LessonProject {
  const scene = project.scenes[sceneId];
  if (!scene || !scene.objects.some(item => item.id === objectId)) return project;
  return putScene(project, { ...scene, objects: scene.objects.filter(item => item.id !== objectId) });
}
export function layerObject(project: LessonProject, sceneId: string, objectId: string, direction: 'up' | 'down'): LessonProject {
  const scene = project.scenes[sceneId]; if (!scene) return project;
  const objects = [...scene.objects], index = objects.findIndex(item => item.id === objectId);
  const next = index + (direction === 'up' ? 1 : -1);
  if (index < 0 || next < 0 || next >= objects.length) return project;
  [objects[index], objects[next]] = [objects[next], objects[index]];
  return putScene(project, { ...scene, objects });
}
export function createCard(): CardDefinition {
  return { id: makeId(), label: 'New card', tags: [], style: { preset: 'classroom', fit: 'auto' }, faces: [
    { id: makeId(), label: 'Prompt', layout: 'text', text: 'Type a question' },
    { id: makeId(), label: 'Answer', layout: 'text', text: 'Type an answer' },
  ] };
}
export function independentCard(card: CardDefinition): CardDefinition {
  return { ...clone(card), id: makeId(), faces: card.faces.map(face => ({ ...clone(face), id: makeId() })) };
}
export function putCard(project: LessonProject, card: CardDefinition): LessonProject {
  if (!project.cards[card.id] || !card.faces.length) return project;
  const scenes = Object.fromEntries(Object.entries(project.scenes).map(([id, scene]) => [id, { ...scene, objects: scene.objects.map(object =>
    object.kind === 'card' && object.cardId === card.id && !card.faces.some(face => face.id === object.initialFaceId)
      ? { ...object, initialFaceId: card.faces[0].id } : object) }]));
  return { ...project, cards: { ...project.cards, [card.id]: card }, scenes };
}
export function addCard(project: LessonProject, sceneId: string, sourceId?: string, linked = false): { project: LessonProject; objectId: string } {
  const scene = project.scenes[sceneId];
  if (!scene) throw new Error('Scene no longer exists.');
  assertObjectCapacity(scene, 1);
  const source = sourceId ? project.cards[sourceId] : undefined;
  if (sourceId && !source) throw new Error('Card no longer exists.');
  assertCardCapacity(project, source && linked ? 0 : 1);
  const card = source ? linked ? source : independentCard(source) : createCard();
  const object: SceneObject = { kind: 'card', id: makeId(), cardId: card.id, initialFaceId: card.faces[0].id,
    initiallyConcealed: false, interaction: 'cycle', visible: true, box: { x: 80, y: 90, width: 360, height: 230 } };
  return { project: addObject({ ...project, cards: { ...project.cards, [card.id]: card } }, sceneId, object), objectId: object.id };
}

/** An optional Set creates ordinary independent Cards, using the same scene commands. */
export function insertCardSet(project: LessonProject, sceneId: string, setId: string): { project: LessonProject; objectIds: string[] } {
  const scene = project.scenes[sceneId], set = project.cardSets.find(item => item.id === setId);
  if (!scene) throw new Error('Scene no longer exists.');
  if (!set) throw new Error('Card Set no longer exists.');
  if (!set.entries.length) return { project, objectIds: [] };
  assertObjectCapacity(scene, set.entries.length);
  assertCardCapacity(project, set.entries.length);
  for (const entry of set.entries) {
    const source = project.cards[entry.cardId];
    if (!source || !Array.isArray(source.faces) || !source.faces.length) throw new Error('A Card in this Set is no longer available.');
  }

  const count = set.entries.length, { width, height } = scene.frame;
  let grid: { columns: number; rows: number; cellWidth: number; cellHeight: number; margin: number; gap: number; score: number } | undefined;
  // Prefer comfortable gutters. A dense Set can still fit a small authored
  // frame by dropping gutters before shrinking below the minimum object size.
  for (const spacing of [1, 0]) {
    const margin = spacing * Math.min(40, width * .04, height * .04);
    const gap = spacing * Math.min(24, width * .02, height * .02);
    for (let columns = 1; columns <= count; columns++) {
      const rows = Math.ceil(count / columns);
      const cellWidth = (width - 2 * margin - (columns - 1) * gap) / columns;
      const cellHeight = (height - 2 * margin - (rows - 1) * gap) / rows;
      if (cellWidth < 24 || cellHeight < 24) continue;
      const score = Math.abs(Math.log((cellWidth / cellHeight) / (360 / 230))) + (columns * rows - count) / count * .25;
      if (!grid || score < grid.score) grid = { columns, rows, cellWidth, cellHeight, margin, gap, score };
    }
    if (grid) break;
  }
  if (!grid) throw new Error('This Card Set does not fit the scene. Use a larger frame or a smaller Set.');

  const objectIds: string[] = [];
  for (let index = 0; index < count; index++) {
    const added = addCard(project, sceneId, set.entries[index].cardId, false);
    const object = added.project.scenes[sceneId].objects.find(item => item.id === added.objectId)!;
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
export function addText(project: LessonProject, sceneId: string, kind: 'text' | 'bubble'): { project: LessonProject; objectId: string } {
  const object: SceneObject = { kind, id: makeId(), visible: true, text: kind === 'bubble' ? 'What happens next?' : 'Type your text',
    fontSize: 32, color: kind === 'bubble' ? '#182331' : '#ffffff', align: 'center', box: { x: 120, y: 350, width: 360, height: 170 } };
  return { project: addObject(project, sceneId, object), objectId: object.id };
}
export function duplicateObject(project: LessonProject, sceneId: string, objectId: string): { project: LessonProject; objectId: string } {
  const original = project.scenes[sceneId]?.objects.find(item => item.id === objectId);
  if (!original) return { project, objectId };
  assertObjectCapacity(project.scenes[sceneId], 1);
  if (original.kind === 'card') assertCardCapacity(project, 1);
  const object = { ...clone(original), id: makeId(), box: { ...original.box, x: original.box.x + 32, y: original.box.y + 32 } };
  if (object.kind === 'card' && original.kind === 'card') {
    const source = project.cards[original.cardId], card = independentCard(source);
    object.cardId = card.id;
    object.initialFaceId = card.faces[Math.max(0, source.faces.findIndex(face => face.id === original.initialFaceId))].id;
    project = { ...project, cards: { ...project.cards, [card.id]: card } };
  }
  return { project: addObject(project, sceneId, object), objectId: object.id };
}
export function copyScene(project: LessonProject, sceneId: string, destination: SequenceKind, linked: boolean): { project: LessonProject; entryId: string } {
  const source = project.scenes[sceneId];
  if (!source) throw new Error('Scene no longer exists');
  if (linked) return insertScene(project, destination, source);
  assertObjectCapacity(source, 0);
  assertCardCapacity(project, source.objects.filter(object => object.kind === 'card').length);
  const scene = { ...clone(source), id: makeId(), title: `${source.title.slice(0, 495)} copy`, objects: [] as SceneObject[] };
  const added = insertScene(project, destination, scene); project = added.project;
  for (const original of source.objects) {
    let object = { ...clone(original), id: makeId() };
    if (object.kind === 'card' && original.kind === 'card') {
      const definition = project.cards[original.cardId], card = independentCard(definition);
      object = { ...object, cardId: card.id, initialFaceId: card.faces[Math.max(0, definition.faces.findIndex(face => face.id === original.initialFaceId))].id };
      project = { ...project, cards: { ...project.cards, [card.id]: card } };
    }
    project = addObject(project, scene.id, object);
  }
  return { project, entryId: added.entryId };
}
