import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovementPresentation, expireMovementPresentation, movementRemaining, MovementExecutionGuard, parseMovementPresentation } from './movementPresentation';
import { DEFAULT_MOVEMENT_EVENTS } from './movement';
import { parsePresentSnapshot } from './presentationSnapshot';

test('movement freezes config and absolute lifetime; reload catches up and expires', () => {
 const config = { ...DEFAULT_MOVEMENT_EVENTS[0] };
 const event = createMovementPresentation('one', config, 1000, { width: 1000, height: 700 });
 config.name = 'changed';
 assert.equal(event.event.name, 'Touch Color');
 assert.equal(event.expiresAt, 4000);
 assert.equal(movementRemaining(event, 2500), 1500);
 assert.equal(movementRemaining(event, 5000), 0);
});
test('execution claim is recorded before side effects and resets only for a new session', () => {
 const guard = new MovementExecutionGuard(); let calls = 0;
 const run = (id: string) => { if (guard.claim('session', id)) { calls++; run(id); } };
 run('one'); run('one'); run('two'); assert.equal(calls, 2);
 assert.equal(guard.claim('next-session', 'one'), true);
});
test('movement parser whitelists visuals and bundled keys; rejects unsafe values', () => {
 const event = createMovementPresentation('one', DEFAULT_MOVEMENT_EVENTS[0], 1000, { width: 1000, height: 700 });
 assert.deepEqual(parseMovementPresentation({ ...event, teacher: 'secret' }), event);
 assert.equal(parseMovementPresentation({ ...event, expiresAt: Infinity }), null);
 assert.equal(parseMovementPresentation({ ...event, event: { ...event.event, gifRelativePath: 'https://tracker.test/a.gif' } }), null);
 const snapshot = parsePresentSnapshot({ sessionId: 's', revision: 1, target: { kind: 'empty', occurrenceId: 'e' }, movement: event });
 assert.deepEqual(snapshot?.movement, event);
});

test('old expiry cannot clear retrigger; early timers cannot clear the current event', () => {
 const a = createMovementPresentation('a', DEFAULT_MOVEMENT_EVENTS[0], 1000, { width: 1000, height: 700 });
 const b = createMovementPresentation('b', DEFAULT_MOVEMENT_EVENTS[0], 1500, a.frame);
 assert.equal(expireMovementPresentation(b, a.id, 4500), b);
 assert.equal(expireMovementPresentation(b, b.id, 4499), b);
 assert.equal(expireMovementPresentation(b, b.id, 4500), null);
});

test('safe legacy Windows paths and filename punctuation remain valid movement media', () => {
 const event = createMovementPresentation('legacy', { ...DEFAULT_MOVEMENT_EVENTS[0], gifRelativePath: 'assets\\my #1?.gif' }, 1, { width: 800, height: 600 });
 assert.equal(event.event.gifRelativePath, 'assets/my #1?.gif');
 assert.equal(parseMovementPresentation({ ...event, event: { ...event.event, gifRelativePath: '../private.gif' } }), null);
});
test('movement render URLs are scoped runtime fields, never authored paths', () => {
 const event=createMovementPresentation('render',DEFAULT_MOVEMENT_EVENTS[0],1,{width:800,height:600});
 const rendered={...event,gifSrc:'media://scoped/lease/grant'};
 assert.equal(parseMovementPresentation(rendered)?.gifSrc,rendered.gifSrc);
 assert.equal(parseMovementPresentation({...event,gifSrc:'https://tracker.test/a.gif'}),null);
 assert.equal(parseMovementPresentation({...event,gifSrc:'media://assets/raw.gif'}),null);
 assert.equal(parseMovementPresentation({...event,gifSrc:''})?.gifSrc,'');
 assert.equal(event.event.gifRelativePath,DEFAULT_MOVEMENT_EVENTS[0].gifRelativePath);
});
