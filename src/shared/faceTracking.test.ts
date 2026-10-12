import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameGate, FacePoseFilter, buildHatGeometry, type FaceObservation } from './faceTracking';
import { parseTrackingSettings, parseTrackingStatus } from './faceTrackingProtocol';

function observation(timestamp = 100): FaceObservation {
  const landmarks = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
  landmarks[1] = { x: .5, y: .5, z: -.08 };
  landmarks[10] = { x: .5, y: .3, z: 0 };
  landmarks[152] = { x: .5, y: .7, z: 0 };
  landmarks[234] = { x: .3, y: .5, z: 0 };
  landmarks[454] = { x: .7, y: .5, z: 0 };
  return { timestamp, landmarks, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
}
test('tracking gates inference to one in flight and bounded cadence', () => {
  const gate = new FrameGate();
  assert.equal(gate.begin(100), true);
  assert.equal(gate.begin(200), false);
  assert.equal(gate.finish(100, 210), true);
  assert.equal(gate.begin(211), true);
  assert.equal(gate.finish(100, 220), false, 'wrong frame cannot release current work');
  assert.equal(gate.begin(230), false);
  assert.equal(gate.finish(211, 240), true);
  assert.equal(gate.begin(250), false, 'cadence stays bounded');
  assert.equal(gate.begin(300), true);
  assert.equal(gate.finish(300, 900), false, 'stale results are discarded');
  assert.equal(gate.begin(901), true, 'stale work does not block fresh capture');
});
test('tracking clears on no face, rejects malformed data and expires frozen results', () => {
  const filter = new FacePoseFilter();
  assert.ok(filter.update(observation(), 110));
  assert.ok(filter.current(300));
  assert.equal(filter.current(500), null);
  assert.ok(filter.update(observation(600), 610));
  assert.equal(filter.update(null, 650), null);
  assert.equal(filter.current(660), null);
  const bad = observation(700); bad.landmarks[1].x = NaN;
  assert.equal(filter.update(bad, 710), null);
});
test('hat remains above forehead and follows translation and tilt in source pixels', () => {
  const filter = new FacePoseFilter();
  const pose = filter.update(observation(), 100)!;
  const hat = buildHatGeometry(pose, 1000, 1000);
  assert.ok(hat.tip.y < pose.forehead.y * 1000);
  assert.ok(hat.brim.every(p => p.y < 400), 'hat stays away from eyes and mouth');
  const tilted = observation(200);
  tilted.landmarks = tilted.landmarks.map(p => ({ x: .5 - (p.y - .5) + .1, y: .5 + (p.x - .5), z: p.z }));
  const rotatedPose = new FacePoseFilter().update(tilted, 200)!;
  const rotated = buildHatGeometry(rotatedPose, 1000, 1000);
  assert.ok(rotated.tip.x > rotatedPose.forehead.x * 1000, '90 degree tilt rotates the hat');
});
test('tracking smooths successive observations but resets after loss', () => {
  const filter = new FacePoseFilter();
  filter.update(observation(), 100);
  const moved = observation(180); moved.landmarks[1].x = .7;
  const next = filter.update(moved, 180)!;
  assert.ok(next.nose.x > .5 && next.nose.x < .7);
  filter.update(null, 200);
  assert.equal(filter.update(moved, 210)!.nose.x, .7);
});
test('tracking protocol rejects invalid booleans and strips private payloads', () => {
  assert.equal(parseTrackingSettings({ enabled: 1, markers: true, hat: true }), null);
  assert.deepEqual(parseTrackingSettings({ enabled: true, markers: false, hat: true, secret: 'private' }), { enabled: true, markers: false, hat: true });
  assert.equal(parseTrackingStatus({ state: 'teacher-notes' }), null);
  assert.deepEqual(parseTrackingStatus({ state: 'tracking', landmarks: ['private'] }), { state: 'tracking', message: undefined });
});
