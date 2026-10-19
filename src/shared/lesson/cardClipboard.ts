import type { CardDefinition } from '../cardsV2';
import { clone, makeId, sceneAt, type EditorSelection, type LessonLocation, type LessonProject, type SceneCard } from './model';
import { addObject, independentCard, removeObject } from './commands';
import { LESSON_LIMITS } from './limits';

export interface CardClipboardSnapshot { card: CardDefinition; object: SceneCard }
export function copyCardSnapshot<T extends LessonProject>(project: T, sceneId: string, objectId: string): CardClipboardSnapshot | null {
  const object = project.scenes[sceneId]?.objects.find(o => o.id === objectId);
  return object?.kind === 'card' && project.cards[object.cardId] ? clone({ card: project.cards[object.cardId], object }) : null;
}
export function pasteCard<T extends LessonProject>(project: T, destination: LessonLocation, snapshot: CardClipboardSnapshot): { project: T; objectId: string; selection: EditorSelection } {
  const scene = sceneAt(project, destination);
  if (!scene) throw new Error('Destination scene no longer exists.');
  if (Object.keys(project.cards).length >= LESSON_LIMITS.cards) throw new Error('This lesson has reached its Card limit.');
  const card = independentCard(snapshot.card), objectId = makeId();
  const faceIndex = Math.max(0, snapshot.card.faces.findIndex(f => f.id === snapshot.object.initialFaceId));
  const object = { ...clone(snapshot.object), id: objectId, cardId: card.id, initialFaceId: card.faces[faceIndex].id };
  return { project: addObject({ ...project, cards: { ...project.cards, [card.id]: card } }, scene.id, object), objectId, selection: { ...destination, objectId } };
}
export function copyCardToScene<T extends LessonProject>(project: T, sourceSceneId: string, objectId: string, destination: LessonLocation) {
  const snapshot = copyCardSnapshot(project, sourceSceneId, objectId);
  if (!snapshot) throw new Error('Source Card no longer exists.');
  return pasteCard(project, destination, snapshot);
}
export function moveCardToScene<T extends LessonProject>(project: T, sourceSceneId: string, objectId: string, destination: LessonLocation) {
  if (sceneAt(project, destination)?.id === sourceSceneId) return { project, objectId, selection: { ...destination, objectId } };
  const copied = copyCardToScene(project, sourceSceneId, objectId, destination);
  return { ...copied, project: removeObject(copied.project, sourceSceneId, objectId) };
}
