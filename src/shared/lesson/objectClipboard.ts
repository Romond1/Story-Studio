import { clone, makeId, type LessonProject, type SceneObject } from './model';
import { addObject, independentCard } from './commands';
import { translateBoxes } from './objectSelection';
import { LESSON_LIMITS } from './limits';
export interface ObjectClipboard { objects: SceneObject[]; cards: LessonProject['cards']; projectId: string }
export function copyObjects(project: LessonProject, sceneId: string, ids: string[]): ObjectClipboard {
  const objects = project.scenes[sceneId]?.objects.filter(o => ids.includes(o.id)) ?? [];
  const cards = Object.fromEntries(objects.flatMap(o => o.kind === 'card' ? [[o.cardId, project.cards[o.cardId]]] : []));
  return clone({ objects, cards, projectId: project.id });
}
export function pasteObjects(project: LessonProject, sceneId: string, copied: ObjectClipboard): { project: LessonProject; objectIds: string[] } {
  const scene = project.scenes[sceneId]; if (!scene || copied.projectId !== project.id) return { project, objectIds: [] };
  const cardCount = copied.objects.filter(o => o.kind === 'card').length;
  if (Object.keys(project.cards).length + cardCount > LESSON_LIMITS.cards) throw new Error('This lesson has reached its Card limit.');
  if (scene.objects.length + copied.objects.length > LESSON_LIMITS.objectsPerScene) throw new Error('This scene has reached its object limit.');
  const boxes = translateBoxes(copied.objects, 32, 32, scene.frame);
  let next = project; const objectIds: string[] = [];
  for (const original of copied.objects) {
    const item = { ...clone(original), id: makeId(), box: boxes.find(o => o.id === original.id)!.box };
    if (item.kind === 'card' && original.kind === 'card') {
      const source = copied.cards[original.cardId], card = independentCard(source);
      item.cardId = card.id; item.initialFaceId = card.faces[Math.max(0, source.faces.findIndex(f => f.id === original.initialFaceId))].id;
      next = { ...next, cards: { ...next.cards, [card.id]: card } };
    }
    next = addObject(next, sceneId, item); objectIds.push(item.id);
  }
  return { project: next, objectIds };
}
