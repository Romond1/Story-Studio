import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneTransitionCore, transitionTiming } from './sceneTransition';
import type { PresentTarget } from './presentationSnapshot';
const target = (id: string): PresentTarget => ({ kind: 'image', occurrenceId: id, src: `media://${id}.png`, scene: { frame: { width: 800, height: 600 }, overlays: [], viewport: { zoom: 2, pan: { x: -100, y: -50 } }, markerStrokes: [] } });
const settings = { kind: 'crossfade' as const, durationMs: 1000, direction: 'left' as const };
test('one Core event per occurrence change; frozen outgoing media excludes annotations', () => {
  const core = new SceneTransitionCore();
  assert.equal(core.observe('a', target('a'), settings, 100, 'first'), null);
  const event = core.observe('b', target('b'), settings, 200, 'ab')!;
  assert.equal(event.id, 'ab'); assert.equal(event.startedAt, 200);
  assert.equal(event.from.scene?.markerStrokes, undefined);
  assert.equal(core.observe('b', target('b'), settings, 500, 'ignored'), event);
  assert.equal(event.from.scene?.viewport?.pan.x, -100);
});
test('rapid navigation rejects earlier completion and late rendering settles', () => {
  const core = new SceneTransitionCore(); core.observe('a', target('a'), settings, 0, 'a');
  core.observe('b', target('b'), settings, 100, 'ab');
  const latest = core.observe('c', target('c'), settings, 200, 'bc')!;
  assert.equal(core.complete('ab'), false); assert.equal(core.event, latest);
  assert.deepEqual(transitionTiming(latest, 700), { elapsedMs: 500, remainingMs: 500, settled: false });
  assert.equal(transitionTiming(latest, 1201).settled, true);
  assert.equal(core.complete('bc'), true);
});
test('none and unsupported media cut; fade-black includes incoming delay', () => {
  const core = new SceneTransitionCore(); core.observe('a', target('a'), settings, 0, 'a');
  assert.equal(core.observe('b', target('b'), { ...settings, kind: 'none' }, 100, 'ab'), null);
  const event = core.observe('c', target('c'), { ...settings, kind: 'fade-black' }, 200, 'bc')!;
  assert.equal(transitionTiming(event, 1300).remainingMs, 100);
  assert.equal(core.observe('video', { kind: 'unsupported', occurrenceId: 'video' }, settings, 400, 'video'), null);
  assert.equal(core.observe('a2', target('a'), settings, 500, 'va'), null);
});

test('new command epoch for same projected occurrence does not replay or restart timing', () => {
  const core = new SceneTransitionCore();
  core.observe('a:1', target('a'), settings, 0, 'first');
  assert.equal(core.observe('a:2', target('a'), settings, 100, 'unrelated'), null);
  const event = core.observe('b:3', target('b'), settings, 200, 'ab');
  assert.equal(core.observe('b:4', target('b'), settings, 800, 'overlay'), event);
  assert.equal(core.event?.startedAt, 200);
});
import { parsePresentSnapshot } from './presentationSnapshot';
test('transition wire projection strips private data and rejects wrong destinations or executable media', () => {
  const core = new SceneTransitionCore(); core.observe('a', target('a'), settings, 0, 'a');
  const event = core.observe('b', target('b'), settings, 100, 'ab')!;
  const snapshot = { sessionId: 'lesson', revision: 1, target: target('b'), transition: { ...event, teacherNotes: 'private', from: { ...event.from, activity: { teacher: 'private' } } } };
  const parsed = parsePresentSnapshot(snapshot)!;
  assert.equal((parsed.transition as any).teacherNotes, undefined);
  assert.equal((parsed.transition!.from as any).activity, undefined);
  assert.equal(parsePresentSnapshot({ ...snapshot, transition: { ...event, toOccurrenceId: 'old' } }), null);
  assert.equal(parsePresentSnapshot({ ...snapshot, transition: { ...event, from: { ...event.from, src: 'https://external.invalid/video.mp4' } } }), null);
});
