// Test the real overlay math and hierarchy. Only GLB loading and the GPU boundary
// are replaced; real-asset/worker acceptance lives in face-tracking-smoke.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const T = require('three');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
}).outputText, filename);

function fixture() {
  const root = new T.Group(), head = new T.Bone(), jaw = new T.Bone();
  head.name = 'Head_Root'; jaw.name = 'Jaw'; jaw.position.set(0, -.038, .035);
  root.add(head); head.add(jaw);
  for (const [name, x] of [['Hair_L_1', -.068], ['Hair_R_1', .068], ['Beard_L_1', -.056]]) {
    const first = new T.Bone(), second = new T.Bone(); first.name = name;
    first.position.set(x, .075, .022); second.name = name.replace('_1', '_2'); second.position.y = -.09;
    (name.startsWith('Beard') ? jaw : head).add(first); first.add(second);
  }
  root.add(new T.Mesh(new T.BoxGeometry(.1, .2, .1), new T.MeshStandardMaterial()));
  return root;
}
function overlay() {
  class Renderer {
    constructor({ canvas }) { this.canvas = canvas; }
    setClearColor() {} clear() {} dispose() {}
    setSize(w, h) { this.canvas.width = w; this.canvas.height = h; }
    render(scene) { scene.updateMatrixWorld(true); }
  }
  const filename = path.resolve('src/renderer/camera/tracking/MerlinCostumeOverlay.ts');
  const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = module.require.bind(module);
  module.require = name => name === 'three' ? { ...T, WebGLRenderer: Renderer }
    : name.includes('GLTFLoader') ? { GLTFLoader: class { load(_url, done) { done({ scene: fixture() }); } } } : original(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText, filename);
  global.document = { baseURI: 'http://localhost/' };
  return new module.exports.MerlinCostumeOverlay({ width: 1, height: 1, dataset: {} });
}
const rigid = {
  enabled: true, hairRoots: false, pitchCompensation: false, residualRegistration: false,
  springMotion: false, jawMotion: false, costume: true, occlusion: true,
  axes: true, referencePoints: true, attachmentOrigins: true, occluderWireframe: true,
};
const settings = diagnostics => ({ enabled: true, merlin: true, markers: false, hat: false, merlinDiagnostics: diagnostics });
function pose(pitch = 0, yaw = 0, distance = 60) {
  return { timestamp: 100, matrix: new T.Matrix4().compose(new T.Vector3(2, 3, -distance),
    new T.Quaternion().setFromEuler(new T.Euler(pitch, yaw, .1, 'YXZ')), new T.Vector3(1, 1, 1)).toArray(),
    nose: { x: .5, y: .5, z: 0 }, chin: { x: .5, y: .7, z: 0 },
    leftTemple: { x: .35, y: .4, z: 0 }, rightTemple: { x: .65, y: .4, z: 0 },
    upperLip: { x: .5, y: .55, z: 0 }, lowerLip: { x: .5, y: .7, z: 0 } };
}
test('rigid diagnostic mode preserves the supplied head pose and all rest bones across yaw/pitch/distance', () => {
  const view = overlay();
  for (const [i, [pitch, yaw, distance]] of [[0, .6, 35], [-.5, -1, 60], [.4, 1, 120]].entries()) {
    const input = pose(pitch, yaw, distance);
    view.updateAndRender(input, settings(rigid), false, 1280, 720, 100 + i * 80);
    assert.ok(view.headAnchor.position.distanceTo(new T.Vector3(2, 3, -distance)) < 1e-9);
    const expectedRotation = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().fromArray(input.matrix));
    assert.ok(view.headAnchor.quaternion.angleTo(expectedRotation) < 1e-7, 'head orientation must match the supplied canonical pose');
    for (const chain of view.chains) {
      assert.ok(chain.bone.position.distanceTo(chain.restPos) < 1e-9, chain.bone.name);
      assert.ok(chain.bone.quaternion.angleTo(chain.restQuat) < 1e-7);
    }
    assert.ok(view.jawBone.position.distanceTo(view.jawRestPos) < 1e-9);
  }
  view.dispose();
});
test('diagnostics can isolate costume, depth occlusion, and guides independently', () => {
  const view = overlay();
  view.updateAndRender(pose(), settings({ ...rigid, costume: false, occlusion: false }), false, 1280, 720, 100);
  assert.equal(view.costumeRoot.visible, false);
  assert.equal(view.occlusionGroup.visible, false);
  view.updateAndRender(pose(), settings(rigid), false, 1280, 720, 180);
  assert.equal(view.costumeRoot.visible, true);
  assert.equal(view.occlusionGroup.visible, true);
  view.dispose();
});
test('mirror reflects in camera space without reversing the projection winding', () => {
  const view = overlay();
  for (const mirror of [false, true, false]) {
    view.updateAndRender(pose(.3, .6), settings(rigid), mirror, 1280, 720, 100);
    assert.ok(view.camera.projectionMatrix.elements[0] > 0);
    const actual = new T.Vector3().setFromMatrixPosition(view.headAnchor.matrixWorld);
    assert.ok(actual.distanceTo(new T.Vector3(mirror ? -2 : 2, 3, -60)) < 1e-9);
    const local = new T.Vector3(4, -2, 7);
    const expected = local.clone().applyMatrix4(new T.Matrix4().fromArray(pose(.3, .6).matrix));
    if (mirror) expected.x *= -1;
    const projected = local.clone().applyMatrix4(view.headAnchor.matrixWorld).project(view.camera);
    assert.ok(projected.distanceTo(expected.project(view.camera)) < 1e-9, 'mirror must reflect rotated points around the camera axis, not the model pivot');
  }
  view.dispose();
});
test('comparison changes and loss reset dynamic state; compensation code remains available', () => {
  const view = overlay();
  const compensated = { ...rigid, hairRoots: true, pitchCompensation: true, residualRegistration: true, springMotion: true, jawMotion: true };
  view.updateAndRender(pose(-.5, .7), settings(compensated), false, 1280, 720, 100);
  assert.ok(view.chains.some(c => c.bone.position.distanceTo(c.restPos) > .01));
  view.updateAndRender(pose(-.5, .7), settings(rigid), false, 1280, 720, 180);
  for (const c of view.chains) assert.equal(c.velRoll, 0);
  view.chains[0].velYaw = 5; view.smoothedJawOpen = .8;
  view.updateAndRender(null, settings(rigid), false, 1280, 720, 250);
  assert.equal(view.chains[0].velYaw, 0);
  assert.equal(view.smoothedJawOpen, 0);
  assert.equal(view.canvas.width, 1);
  view.dispose();
});

test('lower-face depth proxy hides rear beard at the mouth while preserving front mustache and beard', () => {
  const view = overlay();
  const hiddenByHead = point => {
    const world = point.clone().applyMatrix4(view.modelOffsetGroup.matrixWorld);
    const ray = new T.Raycaster(new T.Vector3(), world.clone().normalize(), 0, world.length() - 1e-4);
    return ray.intersectObject(view.occlusionGroup, true).length > 0;
  };
  for (const mirror of [false, true]) {
    for (const degrees of [0, -30, 30, -60, 60]) {
      view.updateAndRender(pose(0, degrees * Math.PI / 180), settings(rigid), mirror, 1280, 720, 100);
      const farSide = Math.sign(degrees);
      assert.ok(hiddenByHead(new T.Vector3(farSide * .025, -.060, .045)), `mouth coverage at ${degrees}°, mirror=${mirror}`);
      assert.equal(hiddenByHead(new T.Vector3(0, -.030, .105)), false, `front mustache at ${degrees}°, mirror=${mirror}`);
      assert.equal(hiddenByHead(new T.Vector3(0, -.120, .110)), false, `front beard below chin at ${degrees}°, mirror=${mirror}`);
    }
  }
  view.dispose();
});
