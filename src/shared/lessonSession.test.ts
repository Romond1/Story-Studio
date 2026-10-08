import test from 'node:test';
import assert from 'node:assert/strict';
import { addCard, copyScene, createLesson, insertScene, putCard, putObject, reorderEntry } from './lesson/commands';
import { cardAction, createSession, exitActivation, navigate, reconcileSession } from './lesson/session';
import { sceneAt } from './lesson/model';
import { parseLessonProject } from './lesson/validation';

test('selecting Story while already teaching Story preserves the scene visit and runtime', () => {
  const first = insertScene(createLesson(), 'story'), second = insertScene(first.project, 'story');
  const added = addCard(second.project, second.project.sequences.story[1].sceneId);
  const live = cardAction(added.project, navigate(added.project, createSession(), { sequence: 'story', entryId: second.entryId }), added.objectId, 'next');
  assert.equal(exitActivation(added.project, live), live);
});

test('showing Activation directly from Edit records the current stable Story return location', () => {
  const first = insertScene(createLesson(), 'story'), second = insertScene(first.project, 'story');
  const activation = insertScene(second.project, 'activation');
  let session = navigate(activation.project, createSession(), { sequence: 'story', entryId: second.entryId });
  session = navigate(activation.project, session, { sequence: 'activation', entryId: activation.entryId });
  assert.deepEqual(session.storyReturn, { sequence: 'story', entryId: second.entryId });
  const reordered = reorderEntry(activation.project, 'story', second.entryId, first.entryId);
  assert.equal(exitActivation(reordered, session).cursor!.entryId, second.entryId);
});

test('direct Story navigation clears a prior Activation checkpoint before another entry', () => {
  const story = insertScene(createLesson(), 'story'), activation = insertScene(story.project, 'activation');
  const storyLocation = { sequence: 'story' as const, entryId: story.entryId };
  const session = { ...navigate(activation.project, createSession(), { sequence: 'activation', entryId: activation.entryId }), storyReturn: storyLocation };
  assert.equal(navigate(activation.project, session, storyLocation).storyReturn, null);
});

test('removing a face repairs every linked placement and live face state without mutating source revisions', () => {
  const initial = insertScene(createLesson(), 'story');
  const sourceScene = initial.project.sequences.story[0].sceneId;
  const added = addCard(initial.project, sourceScene), placement = added.project.scenes[sourceScene].objects[0];
  assert.ok(placement.kind === 'card');
  const linked = copyScene(added.project, sourceScene, 'activation', true);
  const original = linked.project.cards[placement.cardId];
  const session = navigate(linked.project, createSession(), { sequence: 'activation', entryId: linked.entryId });
  const changed = putCard(linked.project, { ...original, faces: original.faces.slice(1) });
  const active = cardAction(linked.project, session, placement.id, { faceId: original.faces[0].id });
  const reconciled = reconcileSession(changed, active);
  assert.equal(reconciled.cards[placement.id].faceId, original.faces[1].id);
  assert.equal((sceneAt(changed, session.cursor)!.objects[0] as typeof placement).initialFaceId, original.faces[1].id);
  assert.equal(original.faces.length, 2);
  assert.equal(parseLessonProject(changed).cards[original.id].faces.length, 1);
});

test('click-to-reveal cards toggle actual initial/live concealment while explicit Reveal remains one-way', () => {
  for (const initiallyConcealed of [false, true]) {
    const inserted = insertScene(createLesson(), 'activation'), sceneId = inserted.project.sequences.activation[0].sceneId;
    const added = addCard(inserted.project, sceneId), object = added.project.scenes[sceneId].objects[0];
    assert.ok(object.kind === 'card');
    const project = putObject(added.project, sceneId, { ...object, interaction: 'reveal', initiallyConcealed });
    let live = navigate(project, createSession(), { sequence: 'activation', entryId: inserted.entryId });
    live = cardAction(project, live, object.id, 'interact'); assert.equal(live.cards[object.id].concealed, !initiallyConcealed);
    live = cardAction(project, live, object.id, 'interact'); assert.equal(live.cards[object.id].concealed, initiallyConcealed);
    live = cardAction(project, live, object.id, 'reveal'); live = cardAction(project, live, object.id, 'reveal');
    assert.equal(live.cards[object.id].concealed, false); assert.equal(live.cards[object.id].faceId, object.initialFaceId);
    const manual = putObject(project, sceneId, { ...object, interaction: 'manual' });
    assert.equal(cardAction(manual, live, object.id, 'interact'), live);
  }
});
