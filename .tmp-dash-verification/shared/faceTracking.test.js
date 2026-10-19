"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const faceTracking_1 = require("./faceTracking");
const faceTrackingProtocol_1 = require("./faceTrackingProtocol");
function observation(timestamp = 100) {
    const landmarks = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
    landmarks[1] = { x: .5, y: .5, z: -.08 };
    landmarks[10] = { x: .5, y: .3, z: 0 };
    landmarks[152] = { x: .5, y: .7, z: 0 };
    landmarks[234] = { x: .3, y: .5, z: 0 };
    landmarks[454] = { x: .7, y: .5, z: 0 };
    return { timestamp, landmarks, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
}
(0, node_test_1.default)('tracking gates inference to one in flight and bounded cadence', () => {
    const gate = new faceTracking_1.FrameGate();
    strict_1.default.equal(gate.begin(100), true);
    strict_1.default.equal(gate.begin(200), false);
    strict_1.default.equal(gate.finish(100, 210), true);
    strict_1.default.equal(gate.begin(211), true);
    strict_1.default.equal(gate.finish(100, 220), false, 'wrong frame cannot release current work');
    strict_1.default.equal(gate.begin(230), false);
    strict_1.default.equal(gate.finish(211, 240), true);
    strict_1.default.equal(gate.begin(250), false, 'cadence stays bounded');
    strict_1.default.equal(gate.begin(300), true);
    strict_1.default.equal(gate.finish(300, 900), false, 'stale results are discarded');
    strict_1.default.equal(gate.begin(901), true, 'stale work does not block fresh capture');
});
(0, node_test_1.default)('tracking clears on no face, rejects malformed data and expires frozen results', () => {
    const filter = new faceTracking_1.FacePoseFilter();
    strict_1.default.ok(filter.update(observation(), 110));
    strict_1.default.ok(filter.current(300));
    strict_1.default.equal(filter.current(500), null);
    strict_1.default.ok(filter.update(observation(600), 610));
    strict_1.default.equal(filter.update(null, 650), null);
    strict_1.default.equal(filter.current(660), null);
    const bad = observation(700);
    bad.landmarks[1].x = NaN;
    strict_1.default.equal(filter.update(bad, 710), null);
});
(0, node_test_1.default)('hat remains above forehead and follows translation and tilt in source pixels', () => {
    const filter = new faceTracking_1.FacePoseFilter();
    const pose = filter.update(observation(), 100);
    const hat = (0, faceTracking_1.buildHatGeometry)(pose, 1000, 1000);
    strict_1.default.ok(hat.tip.y < pose.forehead.y * 1000);
    strict_1.default.ok(hat.brim.every(p => p.y < 400), 'hat stays away from eyes and mouth');
    const tilted = observation(200);
    tilted.landmarks = tilted.landmarks.map(p => ({ x: .5 - (p.y - .5) + .1, y: .5 + (p.x - .5), z: p.z }));
    const rotatedPose = new faceTracking_1.FacePoseFilter().update(tilted, 200);
    const rotated = (0, faceTracking_1.buildHatGeometry)(rotatedPose, 1000, 1000);
    strict_1.default.ok(rotated.tip.x > rotatedPose.forehead.x * 1000, '90 degree tilt rotates the hat');
});
(0, node_test_1.default)('tracking smooths successive observations but resets after loss', () => {
    const filter = new faceTracking_1.FacePoseFilter();
    filter.update(observation(), 100);
    const moved = observation(180);
    moved.landmarks[1].x = .7;
    const next = filter.update(moved, 180);
    strict_1.default.ok(next.nose.x > .5 && next.nose.x < .7);
    filter.update(null, 200);
    strict_1.default.equal(filter.update(moved, 210).nose.x, .7);
});
(0, node_test_1.default)('tracking protocol rejects invalid booleans and strips private payloads', () => {
    strict_1.default.equal((0, faceTrackingProtocol_1.parseTrackingSettings)({ enabled: 1, markers: true, hat: true }), null);
    strict_1.default.deepEqual((0, faceTrackingProtocol_1.parseTrackingSettings)({ enabled: true, markers: false, hat: true, secret: 'private' }), { enabled: true, markers: false, hat: true });
    strict_1.default.equal((0, faceTrackingProtocol_1.parseTrackingStatus)({ state: 'teacher-notes' }), null);
    strict_1.default.deepEqual((0, faceTrackingProtocol_1.parseTrackingStatus)({ state: 'tracking', landmarks: ['private'] }), { state: 'tracking', message: undefined });
});
