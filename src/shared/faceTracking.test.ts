import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { configureFaceCamera, FACE_GEOMETRY_VFOV } from './facePoseMath';
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
  assert.equal(parseTrackingSettings({ enabled: true, markers: false, hat: true, merlin: 'yes' }), null);
  assert.deepEqual(parseTrackingSettings({ enabled: true, markers: false, hat: true, secret: 'private' }), { enabled: true, markers: false, hat: true });
  assert.deepEqual(parseTrackingSettings({ enabled: true, markers: false, hat: true, merlin: true, merlinEyebrows: false }), { enabled: true, markers: false, hat: true, merlin: true, merlinEyebrows: false });
  assert.equal(parseTrackingStatus({ state: 'teacher-notes' }), null);
  assert.deepEqual(parseTrackingStatus({ state: 'tracking', landmarks: ['private'] }), { state: 'tracking', message: undefined });
});
test('lip landmarks (13 and 14) are smoothed when present for 3D jaw articulation', () => {
  const filter = new FacePoseFilter();
  const obs1 = observation(100);
  obs1.landmarks[13] = { x: .5, y: .58, z: -.04 };
  obs1.landmarks[14] = { x: .5, y: .60, z: -.04 };
  const pose1 = filter.update(obs1, 110)!;
  assert.ok(pose1.upperLip && pose1.lowerLip);
  assert.equal(pose1.lowerLip.y, .60);
  const obs2 = observation(150);
  obs2.landmarks[13] = { x: .5, y: .58, z: -.04 };
  obs2.landmarks[14] = { x: .5, y: .66, z: -.04 };
  const pose2 = filter.update(obs2, 160)!;
  assert.ok(pose2.lowerLip!.y > .60 && pose2.lowerLip!.y < .66);
});

function matrixObservation(timestamp: number, angles: [number, number, number], translation = [0, 0, -50], scale = 1) {
  const obs = observation(timestamp);
  obs.matrix = new Matrix4().compose(new Vector3(...translation),
    new Quaternion().setFromEuler(new Euler(...angles, 'YXZ')), new Vector3(scale, scale, scale)).toArray();
  return obs;
}
function assertRigid(values: number[]) {
  const matrix = new Matrix4().fromArray(values);
  assert.ok(Math.abs(matrix.determinant() - 1) < 1e-9, `rigid determinant: ${matrix.determinant()}`);
  const axes = [0, 1, 2].map(i => new Vector3().setFromMatrixColumn(matrix, i));
  for (const axis of axes) assert.ok(Math.abs(axis.length() - 1) < 1e-9);
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) assert.ok(Math.abs(axes[i].dot(axes[j])) < 1e-9);
}
test('large yaw is smoothed on a rigid rotation with independent centimetre translation', () => {
  const filter = new FacePoseFilter();
  filter.update(matrixObservation(100, [0, 0, 0]), 100);
  const pose = filter.update(matrixObservation(180, [0, Math.PI / 3, 0], [10, -4, -80]), 180)!;
  assertRigid(pose.matrix);
  const alpha = 1 - Math.exp(-80 / 45);
  const position = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(pose.matrix));
  assert.ok(position.distanceTo(new Vector3(10 * alpha, -4 * alpha, -50 - 30 * alpha)) < 1e-9);
  const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 3 * alpha);
  const actual = new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(pose.matrix));
  assert.ok(actual.angleTo(expected) < 1e-7);
});
test('mixed-axis rotation remains orthonormal during consecutive head movements', () => {
  const filter = new FacePoseFilter();
  filter.update(matrixObservation(100, [0, 0, 0]), 100);
  for (const [time, angles] of [[140, [.8, 1, .6]], [220, [-.7, -1.1, .3]], [300, [.4, .9, -.5]]] as const) {
    assertRigid(filter.update(matrixObservation(time, [...angles]), time)!.matrix);
  }
});
test('input uniform scale is removed without changing pose translation or rotation', () => {
  const pose = new FacePoseFilter().update(matrixObservation(100, [.3, .8, .2], [2, 3, -60], 1.3), 100)!;
  assertRigid(pose.matrix);
  const expected = matrixObservation(100, [.3, .8, .2], [2, 3, -60]).matrix;
  pose.matrix.forEach((x, i) => assert.ok(Math.abs(x - expected[i]) < 1e-9));
});
test('rotation follows the shortest quaternion path across signed yaw boundary', () => {
  const filter = new FacePoseFilter();
  filter.update(matrixObservation(100, [0, 179 * Math.PI / 180, 0]), 100);
  const pose = filter.update(matrixObservation(130, [0, -179 * Math.PI / 180, 0]), 130)!;
  assertRigid(pose.matrix);
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(pose.matrix));
  assert.ok(q.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)) < .02);
});
test('smoothing is time-aware and resets after loss without carrying orientation history', () => {
  const whole = new FacePoseFilter(), split = new FacePoseFilter();
  const target: [number, number, number] = [.4, 1, -.2];
  for (const filter of [whole, split]) filter.update(matrixObservation(100, [0, 0, 0]), 100);
  const a = whole.update(matrixObservation(180, target, [6, 2, -70]), 180)!;
  split.update(matrixObservation(140, target, [6, 2, -70]), 140);
  const b = split.update(matrixObservation(180, target, [6, 2, -70]), 180)!;
  a.matrix.forEach((x, i) => assert.ok(Math.abs(x - b.matrix[i]) < 1e-9));
  assert.equal(split.update(matrixObservation(180, [0, 0, 0]), 185), b, 'duplicate result must not advance smoothing');
  split.update(null, 200);
  const fresh = split.update(matrixObservation(220, target), 220)!;
  fresh.matrix.forEach((x, i) => assert.ok(Math.abs(x - matrixObservation(220, target).matrix[i]) < 1e-9));
});
test('malformed, singular, reflected, sheared and nonuniform transforms clear the pose', () => {
  const valid = matrixObservation(100, [0, 0, 0]).matrix;
  for (const mutate of [
    (m: number[]) => { m[3] = .1; },
    (m: number[]) => { m[0] = 0; },
    (m: number[]) => { m[0] = -1; },
    (m: number[]) => { m[4] = .2; },
    (m: number[]) => { m[0] = 1.2; },
  ]) {
    const filter = new FacePoseFilter();
    filter.update(matrixObservation(80, [0, 0, 0]), 80);
    const obs = observation(100); obs.matrix = [...valid]; mutate(obs.matrix);
    assert.equal(filter.update(obs, 100), null);
  }
});

test('pinned virtual camera uses centimetres, negative Z, and matching 63 degree projection', () => {
  const camera = new PerspectiveCamera();
  configureFaceCamera(camera, 1280, 720);
  assert.equal(FACE_GEOMETRY_VFOV, 63);
  for (const distance of [35, 60, 120]) {
    const point = new Vector3(4, 2, -distance);
    const f = 360 / Math.tan(63 * Math.PI / 360);
    const projected = point.clone().project(camera);
    assert.ok(Math.abs((projected.x + 1) * 640 - (640 + 4 * f / distance)) < 1e-9);
    assert.ok(Math.abs((1 - projected.y) * 360 - (360 - 2 * f / distance)) < 1e-9);
    const mirrored = point.clone().multiply(new Vector3(-1, 1, 1)).project(camera);
    assert.ok(Math.abs(mirrored.x + projected.x) < 1e-9);
    assert.equal(mirrored.y, projected.y);
  }
});

const diagnosticPayload = {
  enabled: true, hairRoots: false, pitchCompensation: false, residualRegistration: false,
  springMotion: false, jawMotion: false, costume: true, occlusion: true,
  axes: true, referencePoints: true, attachmentOrigins: true, occluderWireframe: true,
};
test('diagnostic settings survive IPC parsing and reject malformed toggles', () => {
  const base = { enabled: true, markers: false, hat: false, merlin: true };
  const parsed = parseTrackingSettings({ ...base, merlinDiagnostics: { ...diagnosticPayload, private: 'strip' } }) as any;
  assert.deepEqual(parsed?.merlinDiagnostics, diagnosticPayload);
  for (const patch of [{ costume: 'true' }, { enabled: 1 }, { hairRoots: undefined }]) {
    assert.equal(parseTrackingSettings({ ...base, merlinDiagnostics: { ...diagnosticPayload, ...patch } }), null);
  }
  assert.equal(parseTrackingSettings({ ...base, merlinDiagnostics: null }), null);
});
