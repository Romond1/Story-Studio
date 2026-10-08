import { makeId, sceneAt, type LessonProject, type LessonSession, type LessonLocation, type CardLiveState } from './model';

export function createSession(): LessonSession {
  return { id: makeId(), revision: 0, visit: 0, cursor: null, storyReturn: null, cards: {}, drawings: [], viewport: { zoom: 1, pan: { x: 0, y: 0 } } };
}
export function navigate(project: LessonProject, session: LessonSession, location: LessonLocation | null): LessonSession {
  const scene = sceneAt(project, location);
  const cursor = scene ? location : null;
  // Every entry route (Teach, timeline, and Show in Present) uses this contract.
  // Capturing the checkpoint only in Start Activation misses direct navigation.
  const storyReturn = cursor?.sequence === 'activation' && session.cursor?.sequence === 'story'
    ? { ...session.cursor } : cursor?.sequence === 'story' ? null : session.storyReturn;
  return { ...session, revision: session.revision + 1, visit: session.visit + 1, cursor, storyReturn, cards: {}, drawings: [], viewport: scene?.viewport ?? { zoom: 1, pan: { x: 0, y: 0 } } };
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
  const scene = sceneAt(project, session.cursor);
  if (!scene) return session.cursor ? navigate(project, session, null) : session;
  const cards: Record<string, CardLiveState> = {};
  for (const object of scene.objects) {
    if (object.kind !== 'card' || !session.cards[object.id]) continue;
    const state = session.cards[object.id];
    cards[object.id] = { ...state, faceId: project.cards[object.cardId].faces.some(face => face.id === state.faceId) ? state.faceId : object.initialFaceId };
  }
  return JSON.stringify(cards) === JSON.stringify(session.cards) ? session : { ...session, cards, revision: session.revision + 1 };
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
