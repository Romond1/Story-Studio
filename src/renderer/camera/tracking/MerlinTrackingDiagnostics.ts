import * as T from 'three';
import type { MerlinDiagnostics } from '../../../shared/faceTrackingProtocol';

// Canonical reference vertices, in cm, from MediaPipe v0.10.32:
// tasks/cc/vision/face_geometry/data/canonical_face_model.obj (indices 1,152,127,356).
// These are reference anatomy, not a fitted or landmark-derived head surface.
export const CANONICAL_REFERENCES = [
  { name: 'nose', color: 0xff6e9a, position: [0, -1.126865, 7.475604] },
  { name: 'chin', color: 0xffdb5c, position: [0, -9.403378, 4.264492] },
  { name: 'left temple', color: 0x57efff, position: [-7.743095, 2.364999, -2.005167] },
  { name: 'right temple', color: 0x57efff, position: [7.743095, 2.364999, -2.005167] },
] as const;

function visibleMaterial(color: number) {
  return new T.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true });
}
function dot(parent: T.Object3D, color: number, radius: number) {
  const mesh = new T.Mesh(new T.SphereGeometry(radius, 10, 8), visibleMaterial(color));
  mesh.renderOrder = 100;
  parent.add(mesh);
  return mesh;
}

/** Developer guides only. Never replaces or changes the actual depth occluder. */
export class MerlinTrackingDiagnostics {
  private headGuides = new T.Group();
  private references = new T.Group();
  private modelGuides = new T.Group();
  private wireframes = new T.Group();
  private origins = new T.Group();
  private originDots = new Map<T.Object3D, T.Mesh>();

  constructor(scene: T.Scene, head: T.Group, model: T.Group, occlusion: T.Group) {
    head.add(this.headGuides, this.references);
    model.add(this.modelGuides, this.wireframes);
    scene.add(this.origins);
    const headAxes = new T.AxesHelper(5), modelAxes = new T.AxesHelper(.035);
    this.headGuides.add(headAxes); this.modelGuides.add(modelAxes);
    for (const helper of [headAxes, modelAxes]) {
      const material = helper.material as T.LineBasicMaterial;
      material.depthTest = false; material.depthWrite = false; material.transparent = true; helper.renderOrder = 100;
    }
    dot(this.headGuides, 0xffffff, .28).name = 'Canonical head pivot';
    dot(this.modelGuides, 0xffa500, .0025).name = 'Costume model origin';
    for (const ref of CANONICAL_REFERENCES) {
      const marker = dot(this.references, ref.color, .25);
      marker.name = `Canonical ${ref.name}`;
      marker.position.set(ref.position[0], ref.position[1], ref.position[2]);
    }
    for (const child of occlusion.children) {
      const mesh = child as T.Mesh;
      const line = new T.LineSegments(new T.WireframeGeometry(mesh.geometry),
        new T.LineBasicMaterial({ color: 0x00ff88, depthTest: false, depthWrite: false, transparent: true, opacity: .22 }));
      line.position.copy(mesh.position); line.quaternion.copy(mesh.quaternion); line.scale.copy(mesh.scale);
      line.renderOrder = 95; this.wireframes.add(line);
    }
  }

  update(options: MerlinDiagnostics, costume: T.Object3D) {
    this.headGuides.visible = this.modelGuides.visible = options.enabled && options.axes;
    this.references.visible = options.enabled && options.referencePoints;
    this.wireframes.visible = options.enabled && options.occluderWireframe;
    this.origins.visible = options.enabled && options.attachmentOrigins;
    if (this.origins.visible) {
      costume.updateWorldMatrix(true, true);
      costume.traverse(obj => {
        if (!['Head_Root', 'Jaw', 'Hair_L_1', 'Hair_R_1', 'Beard_C_1', 'Beard_L_1', 'Beard_R_1', 'Mustache_L', 'Mustache_R'].includes(obj.name)) return;
        let marker = this.originDots.get(obj);
        if (!marker) { marker = dot(this.origins, 0xffa500, .18); marker.name = `${obj.name} origin`; this.originDots.set(obj, marker); }
        obj.getWorldPosition(marker.position);
      });
    }
  }

  dispose() {
    for (const group of [this.headGuides, this.references, this.modelGuides, this.wireframes, this.origins]) {
      group.removeFromParent();
      group.traverse(obj => {
        const mesh = obj as T.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mat.dispose();
      });
    }
    this.originDots.clear();
  }
}
