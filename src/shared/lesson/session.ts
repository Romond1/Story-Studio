import { clone, makeId, sceneAt, type LessonProject, type LessonSession, type LessonLocation, type CardLiveState, type SceneLiveState, type LessonScene } from './model';
import type { Rect } from './model';
import type { MarkerStroke } from '../types';
import { fitBox } from './commands';

const locationKey = (location: LessonLocation) => JSON.stringify([location.sequence, location.entryId]);
function defaults(scene?: LessonScene): SceneLiveState {
  return { sceneId: scene?.id ?? '', cards: {}, drawings: [], viewport: clone(scene?.viewport ?? { zoom: 1, pan: { x: 0, y: 0 } }), drawingUndo: [], drawingRedo: [] };
}
function cacheCurrent(project: LessonProject, session: LessonSession) {
  const scenes = { ...session.scenes }, scene = sceneAt(project, session.cursor);
  if (scene && session.cursor) scenes[locationKey(session.cursor)] = clone({ sceneId: scene.id, cards: session.cards, drawings: session.drawings, viewport: session.viewport, drawingUndo: session.drawingUndo ?? [], drawingRedo: session.drawingRedo ?? [] });
  return scenes;
}

export function createSession(): LessonSession {
  return { id: makeId(), revision: 0, visit: 0, cursor: null, storyReturn: null, cards: {}, drawings: [], viewport: { zoom: 1, pan: { x: 0, y: 0 } } };
}
/** Reset just the current occurrence to the scene's authored defaults. */
export function resetScene(project: LessonProject, session: LessonSession): LessonSession {
  const scene = sceneAt(project, session.cursor);
  if (!scene || !session.cursor) return session;
  const next = { ...session, ...defaults(scene), revision: session.revision + 1, visit: session.visit + 1 };
  return { ...next, scenes: cacheCurrent(project, next) };
}
export function moveLiveCard(project: LessonProject, session: LessonSession, objectId: string, box: Rect): LessonSession {
  const scene = sceneAt(project, session.cursor), object = scene?.objects.find(item => item.id === objectId);
  if (!scene || object?.kind !== 'card' || !project.cards[object.cardId] || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) return session;
  const state = session.cards[objectId] ?? { faceId: object.initialFaceId, concealed: object.initiallyConcealed };
  return { ...session, revision: session.revision + 1, cards: { ...session.cards, [objectId]: { ...state, box: fitBox(box, scene.frame) } } };
}
export function setLiveDrawings(session: LessonSession, drawings: MarkerStroke[]): LessonSession {
  if (!session.cursor || JSON.stringify(drawings) === JSON.stringify(session.drawings)) return session;
  return { ...session, revision: session.revision + 1, drawings: clone(drawings), drawingUndo: [...(session.drawingUndo ?? []), clone(session.drawings)].slice(-100), drawingRedo: [] };
}
export function undoLiveDrawing(session: LessonSession): LessonSession {
  const undo = session.drawingUndo ?? [];
  if (!session.cursor || !undo.length) return session;
  return { ...session, revision: session.revision + 1, drawings: clone(undo[undo.length - 1]), drawingUndo: undo.slice(0, -1), drawingRedo: [...(session.drawingRedo ?? []), clone(session.drawings)] };
}
export function redoLiveDrawing(session: LessonSession): LessonSession {
  const redo = session.drawingRedo ?? [];
  if (!session.cursor || !redo.length) return session;
  return { ...session, revision: session.revision + 1, drawings: clone(redo[redo.length - 1]), drawingUndo: [...(session.drawingUndo ?? []), clone(session.drawings)], drawingRedo: redo.slice(0, -1) };
}
export function navigate(project: LessonProject, session: LessonSession, location: LessonLocation | null): LessonSession {
  const scene = sceneAt(project, location);
  const cursor = scene ? location : null;
  // Every entry route (Teach, timeline, and Show in Present) uses this contract.
  // Capturing the checkpoint only in Start Activation misses direct navigation.
  const storyReturn = cursor?.sequence === 'activation' && session.cursor?.sequence === 'story'
    ? { ...session.cursor } : cursor?.sequence === 'story' ? null : session.storyReturn;
  const scenes = cacheCurrent(project, session);
  const saved = cursor && scenes[locationKey(cursor)];
  const state = saved && saved.sceneId === scene?.id ? clone(saved) : defaults(scene);
  return reconcileSession(project, { ...session, ...state, scenes, revision: session.revision + 1, visit: session.visit + 1, cursor, storyReturn });
}
export function stepScene(project: LessonProject, session: LessonSession, direction: -1 | 1): LessonSession {
  if (!session.cursor) {
    const entry = project.sequences.story[0]; return entry ? navigate(project, session, { sequence: 'story', entryId: entry.id }) : session;
  }
  const entries = project.sequences[session.cursor.sequence], index = entries.findIndex(entry => entry.id === session.cursor!.entryId);
  const target = entries[index + direction];
  return target ? navigate(project, session, { sequence: session.cursor.sequence, entryId: target.id }) : session;
}
export function startActivation(project: LessonProject, session: LessonSession): LessonSession {
  const first = project.sequences.activation[0]; if (!first || session.cursor?.sequence === 'activation') return session;
  return navigate(project, { ...session, storyReturn: session.cursor?.sequence === 'story' ? session.cursor : null }, { sequence: 'activation', entryId: first.id });
}
export function exitActivation(project: LessonProject, session: LessonSession): LessonSession {
  if (session.cursor?.sequence !== 'activation' && !session.storyReturn) return session;
  const first = project.sequences.story[0];
  const target = sceneAt(project, session.storyReturn) ? session.storyReturn : first ? { sequence: 'story' as const, entryId: first.id } : null;
  return navigate(project, { ...session, storyReturn: null }, target);
}
export function reconcileSession(project: LessonProject, session: LessonSession): LessonSession {
  const scenes: Record<string, SceneLiveState> = {};
  for (const sequence of ['story', 'activation'] as const) for (const entry of project.sequences[sequence]) {
    const key = locationKey({ sequence, entryId: entry.id }), saved = session.scenes?.[key], scene = project.scenes[entry.sceneId];
    if (saved && scene && saved.sceneId === scene.id) scenes[key] = { ...saved, cards: reconcileCards(project, scene, saved.cards) };
  }
  const scene = sceneAt(project, session.cursor);
  const next = { ...session, scenes, storyReturn: sceneAt(project, session.storyReturn) ? session.storyReturn : null,
    ...(scene ? { cards: reconcileCards(project, scene, session.cards) } : session.cursor ? { ...defaults(), cursor: null } : {}) };
  return JSON.stringify(next) === JSON.stringify(session) ? session : { ...next, revision: session.revision + 1 };
}
function reconcileCards(project: LessonProject, scene: LessonScene, existing: Record<string, CardLiveState>) {
  const cards: Record<string, CardLiveState> = {};
  for (const object of scene.objects) {
    if (object.kind !== 'card' || !existing[object.id]) continue;
    const card = project.cards[object.cardId]; if (!card?.faces.length) continue;
    const state = existing[object.id];
    const initial = card.faces.some(face => face.id === object.initialFaceId) ? object.initialFaceId : card.faces[0].id;
    cards[object.id] = { ...state, faceId: card.faces.some(face => face.id === state.faceId) ? state.faceId : initial };
  }
  return cards;
}
export type CardAction = 'next' | 'previous' | 'conceal' | 'reveal' | 'interact' | 'reset';
export function cardAction(project: LessonProject, session: LessonSession, objectId: string, action: CardAction | { faceId: string }): LessonSession {
  const scene = sceneAt(project, session.cursor), object = scene?.objects.find(item => item.id === objectId);
  if (!object || object.kind !== 'card') return session;
  const card = project.cards[object.cardId]; if (!card) return session;
  const initial = { faceId: object.initialFaceId, concealed: object.initiallyConcealed };
  let state = { ...(session.cards[object.id] ?? initial) };
  if (action === 'interact') action = object.interaction === 'cycle' ? 'next' : object.interaction === 'reveal' ? state.concealed ? 'reveal' : 'conceal' : 'interact';
  if (action === 'interact') return session;
  if (action === 'reset') state = initial;
  else if (action === 'conceal' || action === 'reveal') state.concealed = action === 'conceal';
  else if (typeof action === 'object') { if (!card.faces.some(face => face.id === action.faceId)) return session; state.faceId = action.faceId; state.concealed = false; }
  else {
    const index = Math.max(0, card.faces.findIndex(face => face.id === state.faceId));
    state.faceId = card.faces[(index + (action === 'next' ? 1 : -1) + card.faces.length) % card.faces.length].id; state.concealed = false;
  }
  return { ...session, revision: session.revision + 1, cards: { ...session.cards, [object.id]: state } };
}
