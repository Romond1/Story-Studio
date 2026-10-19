import * as T from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TrackingSettings } from '../../../shared/faceTrackingProtocol';

type Slot = {
  root: T.Object3D | null;
  status: 'off' | 'loading' | 'ready' | 'error';
  show: boolean;
};
const NECK_MODEL_M = new T.Vector3(0, -.135, -.008);

/** Standalone opaque wardrobe; no extra renderer, camera, tracker or spring rig. */
export class MerlinWardrobe {
  readonly hat: Slot = { root: null, status: 'off', show: false };
  readonly robe: Slot = { root: null, status: 'off', show: false };
  readonly robeAnchor = new T.Group();
  private hatMount = new T.Group();
  private robeModel = new T.Group();
  private hasPose = false;
  private disposed = false;

  constructor(headModel: T.Group, mirrorRoot: T.Group,
    private modelScale: T.Vector3, private modelOffset: T.Vector3,
    private loader: Pick<GLTFLoader, 'load'>, private release: (root: T.Object3D) => void,
    private canvas: HTMLCanvasElement) {
    this.hatMount.name = 'Merlin_Hat_Mount'; this.robeAnchor.name = 'Merlin_Robe_Neck_Anchor';
    headModel.add(this.hatMount);
    mirrorRoot.add(this.robeAnchor); this.robeAnchor.add(this.robeModel);
    this.robeModel.scale.copy(modelScale);
    // Mesh vertices already include the neck offset. Rotate about that point
    // by subtracting it exactly once before applying the independent body pose.
    this.robeModel.position.copy(NECK_MODEL_M).multiply(modelScale).negate();
    canvas.dataset.merlinHat = canvas.dataset.merlinRobe = 'off';
  }

  private load(kind: 'hat' | 'robe') {
    const slot = this[kind];
    if (slot.status !== 'off') return;
    slot.status = 'loading'; this.canvas.dataset[kind === 'hat' ? 'merlinHat' : 'merlinRobe'] = 'loading';
    this.loader.load(new URL(`face-tracking/merlin_${kind}.glb`, document.baseURI).href, gltf => {
      if (this.disposed) { this.release(gltf.scene); return; }
      slot.root = gltf.scene;
      // Keep authored opaque PBR/depth settings. Identity hair's alpha cutout
      // overrides must never be applied to the cloth, leather or bronze.
      slot.root.traverse(obj => { if ((obj as T.Mesh).isMesh) (obj as T.Mesh).frustumCulled = false; });
      (kind === 'hat' ? this.hatMount : this.robeModel).add(slot.root);
      slot.root.visible = slot.show;
      slot.status = 'ready'; this.canvas.dataset[kind === 'hat' ? 'merlinHat' : 'merlinRobe'] = 'ready';
    }, undefined, () => {
      if (this.disposed) return;
      slot.status = 'error'; this.canvas.dataset[kind === 'hat' ? 'merlinHat' : 'merlinRobe'] = 'error';
    });
  }

  update(settings: TrackingSettings, showCostume: boolean, headPosition: T.Vector3, headRotation: T.Quaternion, dt: number) {
    for (const kind of ['hat', 'robe'] as const) {
      const selected = !!(kind === 'hat' ? settings.merlinHat : settings.merlinRobe);
      const slot = this[kind]; slot.show = selected && showCostume;
      if (selected) this.load(kind);
      if (slot.root) slot.root.visible = slot.show;
    }
    // Face-only approximation: a neck below the translated head, not a neck
    // swept around by full head rotation. This does not measure real shoulders.
    this.robeAnchor.position.copy(NECK_MODEL_M).multiply(this.modelScale).add(this.modelOffset).add(headPosition);
    const euler = new T.Euler().setFromQuaternion(headRotation, 'YXZ');
    const limit = 8 * Math.PI / 180;
    const target = new T.Quaternion().setFromEuler(new T.Euler(
      T.MathUtils.clamp(euler.x * .15, -limit, limit), euler.y * .25,
      T.MathUtils.clamp(euler.z * .15, -limit, limit), 'YXZ'));
    this.robeAnchor.quaternion.slerp(target, this.hasPose ? 1 - Math.exp(-dt / .18) : 1).normalize();
    this.hasPose = true;
  }

  reset() {
    this.hasPose = false;
    for (const slot of [this.hat, this.robe]) { slot.show = false; if (slot.root) slot.root.visible = false; }
  }

  dispose() {
    this.disposed = true; this.reset();
    for (const slot of [this.hat, this.robe]) { if (slot.root) this.release(slot.root); slot.root = null; }
    this.hatMount.removeFromParent(); this.robeAnchor.removeFromParent();
  }
}
