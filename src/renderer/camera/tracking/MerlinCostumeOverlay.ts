import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { FacePose } from '../../../shared/faceTracking';
import type { TrackingSettings } from '../../../shared/faceTrackingProtocol';

interface ChainBoneState {
  bone: T.Bone;
  restQuat: T.Quaternion;
  restPos: T.Vector3;
  angleRoll: number;
  velRoll: number;
  anglePitch: number;
  velPitch: number;
  angleYaw: number;
  velYaw: number;
  gravityWeight: number;
  inertiaWeight: number;
  stiffness: number;
  damping: number;
}

// Level-1 root bones (Beard_C_1, Beard_L_1, Beard_R_1, Hair_L_1, Hair_R_1) have zero gravity/inertia weight
// so hair and beard roots stay 100% locked to the temples, cheeks, and chin!
// Only mid and lower segments (levels 2, 3, 4) bend with gravity and inertia.
const SPRING_CHAINS: { name: string; gravityWeight: number; inertiaWeight: number; stiffness: number; damping: number }[] = [
  { name: 'Beard_C_1', gravityWeight: 0.0, inertiaWeight: 0.0, stiffness: 80, damping: 14.0 },
  { name: 'Beard_C_2', gravityWeight: 0.28, inertiaWeight: 0.38, stiffness: 46, damping: 8.0 },
  { name: 'Beard_C_3', gravityWeight: 0.34, inertiaWeight: 0.50, stiffness: 38, damping: 7.2 },
  { name: 'Beard_C_4', gravityWeight: 0.28, inertiaWeight: 0.60, stiffness: 32, damping: 6.5 },
  { name: 'Beard_L_1', gravityWeight: 0.0, inertiaWeight: 0.0, stiffness: 80, damping: 14.0 },
  { name: 'Beard_L_2', gravityWeight: 0.30, inertiaWeight: 0.42, stiffness: 44, damping: 7.8 },
  { name: 'Beard_L_3', gravityWeight: 0.32, inertiaWeight: 0.55, stiffness: 34, damping: 6.8 },
  { name: 'Beard_R_1', gravityWeight: 0.0, inertiaWeight: 0.0, stiffness: 80, damping: 14.0 },
  { name: 'Beard_R_2', gravityWeight: 0.30, inertiaWeight: 0.42, stiffness: 44, damping: 7.8 },
  { name: 'Beard_R_3', gravityWeight: 0.32, inertiaWeight: 0.55, stiffness: 34, damping: 6.8 },
  { name: 'Hair_L_1', gravityWeight: 0.0, inertiaWeight: 0.0, stiffness: 80, damping: 14.0 },
  { name: 'Hair_L_2', gravityWeight: 0.28, inertiaWeight: 0.40, stiffness: 46, damping: 8.0 },
  { name: 'Hair_L_3', gravityWeight: 0.32, inertiaWeight: 0.52, stiffness: 36, damping: 7.0 },
  { name: 'Hair_R_1', gravityWeight: 0.0, inertiaWeight: 0.0, stiffness: 80, damping: 14.0 },
  { name: 'Hair_R_2', gravityWeight: 0.28, inertiaWeight: 0.40, stiffness: 46, damping: 8.0 },
  { name: 'Hair_R_3', gravityWeight: 0.32, inertiaWeight: 0.52, stiffness: 36, damping: 7.0 },
];

// Calibrated transform from Blender glTF model meters -> MediaPipe canonical head centimeters
// Anchored to unoccluded nose tip (lm 1), nose bridge (lm 6/168), and temples (lm 127/356)
const MODEL_SCALE_CM = new T.Vector3(108.0, 102.0, 92.0);
const MODEL_OFFSET_CM = new T.Vector3(-0.08, -1.15, -2.50);
const NOSE_TIP_MODEL_M = new T.Vector3(0.0, -0.008, 0.082);
const TEMPLE_MID_MODEL_M = new T.Vector3(0.0, 0.025, 0.015);
const VFOV_DEG = 60.0;

/**
 * Isolated 3D Merlin identity overlay session (Phase 1 — Checkpoint C.1).
 * Uses MediaPipe's 4x4 metric facialTransformationMatrixes + matched 60 deg PerspectiveCamera
 * + cranial residual lock so the costume rotates around the true 3D cranial center and stays
 * locked to the temples, upper lip, and chin across extreme yaw, pitch, and roll.
 */
export class MerlinCostumeOverlay {
  private renderer: T.WebGLRenderer | null = null;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(VFOV_DEG, 16 / 9, 1.0, 500.0);
  private headAnchor = new T.Group();
  private modelOffsetGroup = new T.Group();
  private costumeRoot: T.Object3D | null = null;
  private eyebrowsMesh: T.Object3D | null = null;
  private scalpPrototypeMesh: T.Object3D | null = null;
  private diagnosticGroup: T.Group | null = null;
  private showScalpPrototype = false;
  private showScalpDiagnostic = false;
  private jawBone: T.Bone | null = null;
  private jawRestPos = new T.Vector3();
  private jawRestQuat = new T.Quaternion();
  private chains: ChainBoneState[] = [];
  private loading = false;
  private loaded = false;
  private failed = false;
  private disposed = false;

  // Motion, smoothing & confidence-hold state
  private lastTime = 0;
  private prevPosCm = new T.Vector3();
  private prevVelCm = new T.Vector3();
  private prevQuat = new T.Quaternion();
  private prevYaw = 0;
  private prevPitch = 0;
  private prevRoll = 0;
  private hasPrevPose = false;
  private smoothedJawOpen = 0;
  private fpsFrames = 0;
  private fpsWindowStart = performance.now();
  public currentFps = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.setupScene();
  }

  private setupScene() {
    this.scene.add(new T.AmbientLight('#f4f6fa', 1.55));
    const keyLight = new T.DirectionalLight('#fffdf8', 1.65);
    keyLight.position.set(25, 35, 60);
    this.scene.add(keyLight);

    const fillLight = new T.DirectionalLight('#dce6f7', 0.85);
    fillLight.position.set(-30, 10, 45);
    this.scene.add(fillLight);

    const rimLight = new T.DirectionalLight('#eef4ff', 0.65);
    rimLight.position.set(0, 35, -45);
    this.scene.add(rimLight);

    // Configure model-to-canonical-head transform group (in cm)
    this.modelOffsetGroup.position.copy(MODEL_OFFSET_CM);
    this.modelOffsetGroup.scale.copy(MODEL_SCALE_CM);
    this.headAnchor.add(this.modelOffsetGroup);

    // Depth-only 3D cranial + facial occluder inside modelOffsetGroup (in Blender model meter coordinates)
    const occluderMat = new T.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
    });

    // 1. Upper cranium + temple shield: tucked inside the skull dome so it occludes rear hair while leaving
    // the Stage B fitted scalp cap (Y >= 0.088m at front hairline, Y >= 0.072m at temples) completely clear.
    const craniumGeo = new T.SphereGeometry(1, 32, 24);
    craniumGeo.scale(0.068, 0.074, 0.082);
    const craniumOccluder = new T.Mesh(craniumGeo, occluderMat);
    craniumOccluder.position.set(0, 0.008, -0.008);
    craniumOccluder.renderOrder = -10;
    this.modelOffsetGroup.add(craniumOccluder);

    // 2. Forehead / eye-socket / glasses / zygomatic arch depth shield (top at Y = 0.082m, safely below the
    // front hairline at Y = 0.092m!) so off-side hair and inner cheek roots are 100% occluded behind the real face & glasses.
    const midFaceGeo = new T.SphereGeometry(1, 28, 22);
    midFaceGeo.scale(0.073, 0.062, 0.095);
    const midFaceOccluder = new T.Mesh(midFaceGeo, occluderMat);
    midFaceOccluder.position.set(0, 0.020, 0.025);
    midFaceOccluder.renderOrder = -10;
    this.modelOffsetGroup.add(midFaceOccluder);

    // 3. Nose bridge & nasal dorsum depth shield (extends forward to Z = +0.105m at X = ±0.028m)
    // so during 3/4 and profile yaw turns, far-side hair and cheek roots behind the nose/glasses are strictly clipped!
    const noseBridgeGeo = new T.SphereGeometry(1, 20, 16);
    noseBridgeGeo.scale(0.032, 0.042, 0.054);
    const noseBridgeOccluder = new T.Mesh(noseBridgeGeo, occluderMat);
    noseBridgeOccluder.position.set(0, 0.008, 0.052);
    noseBridgeOccluder.renderOrder = -10;
    this.modelOffsetGroup.add(noseBridgeOccluder);

    this.scene.add(this.headAnchor);
  }

  private ensureRenderer(width: number, height: number): T.WebGLRenderer | null {
    if (this.disposed || this.failed) return null;
    if (!this.renderer) {
      try {
        this.renderer = new T.WebGLRenderer({
          canvas: this.canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.setClearColor(0x000000, 0);
      } catch {
        this.failed = true;
        return null;
      }
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.fov = VFOV_DEG;
      this.camera.aspect = width / Math.max(1, height);
      this.camera.near = 1.0;
      this.camera.far = 500.0;
      this.camera.position.set(0, 0, 0);
      this.camera.lookAt(0, 0, -1);
      this.camera.updateProjectionMatrix();
    }
    return this.renderer;
  }

  private ensureModelLoaded() {
    if (this.loaded || this.loading || this.failed || this.disposed) return;
    this.loading = true;
    const loader = new GLTFLoader();
    const url = new URL('face-tracking/merlin_identity.glb', document.baseURI).href;
    loader.load(
      url,
      gltf => {
        if (this.disposed) return;
        const root = gltf.scene;
        this.costumeRoot = root;
        this.chains = [];

        root.traverse(obj => {
          if (obj.name === 'Merlin_Eyebrows') {
            this.eyebrowsMesh = obj;
          }
          if (obj.name === 'Merlin_ScalpPrototype') {
            this.scalpPrototypeMesh = obj;
            // Stage A active by default in production: keep Stage B scalp prototype hidden unless explicitly toggled
            obj.visible = this.showScalpPrototype;
          }
          const mesh = obj as T.Mesh;
          if (mesh.isMesh) {
            mesh.frustumCulled = false;
            const isScalpMesh = mesh.name.startsWith('Merlin_ScalpPrototype') || obj.parent?.name === 'Merlin_ScalpPrototype';
            const isCore = !isScalpMesh && (mesh.name.endsWith('_1') || (mesh.material as T.Material)?.name?.includes('Core'));
            mesh.renderOrder = isScalpMesh ? 2 : isCore ? 1 : 2;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              const std = m as T.MeshStandardMaterial;
              if (std) {
                const matIsCore = std.name?.includes('Core');
                const matIsScalpCap = std.name?.includes('ScalpCap');
                std.side = T.DoubleSide;
                std.transparent = true;
                // Core Hair Mat uses firm alpha cutout (0.42); Fitted Scalp Cap uses soft hairline cutout (0.18);
                // Outer Strand Mat uses 0.24 so feathered tips stay soft while main locks write clean depth!
                std.alphaTest = matIsCore ? 0.42 : matIsScalpCap ? 0.18 : 0.24;
                std.depthWrite = true;
                std.depthTest = true;
                std.roughness = Math.max(0.52, std.roughness ?? 0.65);
                // Subtle polygonOffset on outer strands prevents coplanar z-fighting during downward pitch
                if (!matIsCore) {
                  std.polygonOffset = true;
                  std.polygonOffsetFactor = -0.5;
                  std.polygonOffsetUnits = -1.0;
                }
                std.needsUpdate = true;
              }
            }
          }
          const bone = obj as T.Bone;
          if (bone.isBone) {
            if (bone.name === 'Jaw') {
              this.jawBone = bone;
              this.jawRestPos.copy(bone.position);
              this.jawRestQuat.copy(bone.quaternion);
            }
            const spec = SPRING_CHAINS.find(s => s.name === bone.name);
            if (spec) {
              this.chains.push({
                bone,
                restQuat: bone.quaternion.clone(),
                restPos: bone.position.clone(),
                angleRoll: 0,
                velRoll: 0,
                anglePitch: 0,
                velPitch: 0,
                angleYaw: 0,
                velYaw: 0,
                gravityWeight: spec.gravityWeight,
                inertiaWeight: spec.inertiaWeight,
                stiffness: spec.stiffness,
                damping: spec.damping,
              });
            }
          }
        });

        this.modelOffsetGroup.add(root);
        this.loaded = true;
        this.loading = false;
      },
      undefined,
      () => {
        this.loading = false;
        this.failed = true;
      }
    );
  }

  /**
   * Toggle the Stage B fitted scalp prototype mesh (`Merlin_ScalpPrototype`).
   * Disabled (`false`) by default in live Story Studio production until approved.
   */
  public setScalpPrototypeVisible(visible: boolean) {
    this.showScalpPrototype = visible;
    if (this.scalpPrototypeMesh) {
      this.scalpPrototypeMesh.visible = visible;
    }
  }

  /**
   * Temporary scalp-fitting diagnostic mode:
   * Renders the tracked anatomical neurocranium wireframe, the natural forehead hairline contour,
   * the center-part sagittal crown arch, and the left/right temple hair-root attachment curves over the webcam feed.
   */
  public setScalpDiagnosticMode(enabled: boolean) {
    this.showScalpDiagnostic = enabled;
    if (enabled && !this.diagnosticGroup) {
      const group = new T.Group();
      group.name = 'Merlin_ScalpDiagnosticGroup';

      // 1. Tracked anatomical neurocranium surface wireframe (in glTF Y-up, +Z forward meters)
      const skullGeo = new T.SphereGeometry(1, 24, 18);
      skullGeo.scale(0.0815, 0.098, 0.095);
      const skullWireMat = new T.MeshBasicMaterial({
        color: 0x00e5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        depthTest: false,
      });
      const skullMesh = new T.Mesh(skullGeo, skullWireMat);
      skullMesh.position.set(0, 0.044, -0.014);
      skullMesh.renderOrder = 20;
      group.add(skullMesh);

      // 2. Fitted Scalp Cap hairline & sagittal crown curves (matching build_merlin_scalp_prototype)
      const capPts: T.Vector3[] = [];
      const rx = 0.0815;
      const ry = 0.098;
      const rz = 0.095;
      const cy = 0.044;
      const cz = -0.014;
      // Front forehead hairline curve (recessed -22 deg at center, sweeping forward at temple corners)
      const hairlinePts: T.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const su = (i / 32 - 0.5) * 2.0;
        const absSu = Math.abs(su);
        const beta = su * ((64.0 * Math.PI) / 180.0);
        const alphaDeg = -22.0 - 22.0 * Math.pow(absSu, 1.45);
        const alpha = (alphaDeg * Math.PI) / 180.0;
        let x = rx * Math.sin(beta);
        let yBlender = 0.014 + 0.095 * Math.cos(beta) * Math.sin(alpha);
        let zBlender = 0.044 + 0.098 * Math.cos(beta) * Math.cos(alpha);
        if (absSu > 0.55) {
          const blendT = Math.pow((absSu - 0.55) / 0.45, 1.35);
          const sgn = su >= 0 ? 1.0 : -1.0;
          const xCurtain = sgn * 0.065;
          const yCurtain = -0.060;
          const zCurtain = 0.058;
          x = (1.0 - 0.65 * blendT) * x + 0.65 * blendT * xCurtain;
          yBlender = (1.0 - 0.55 * blendT) * yBlender + 0.55 * blendT * yCurtain;
          zBlender = (1.0 - 0.50 * blendT) * zBlender + 0.50 * blendT * zCurtain;
        }
        hairlinePts.push(new T.Vector3(x, zBlender, -yBlender));
      }
      const hairlineGeo = new T.BufferGeometry().setFromPoints(hairlinePts);
      const hairlineLine = new T.Line(
        hairlineGeo,
        new T.LineBasicMaterial({ color: 0x00ff66, linewidth: 2, depthTest: false })
      );
      hairlineLine.renderOrder = 25;
      group.add(hairlineLine);

      // 3. Center sagittal part & crown profile arch (front hairline -> crown apex -> rear occiput)
      for (let i = 0; i <= 28; i++) {
        const vf = i / 28;
        const alpha = ((-22.0 + 108.0 * vf) * Math.PI) / 180.0;
        capPts.push(new T.Vector3(0, cy + ry * Math.cos(alpha), cz - rz * Math.sin(alpha)));
      }
      const crownLine = new T.Line(
        new T.BufferGeometry().setFromPoints(capPts),
        new T.LineBasicMaterial({ color: 0xffd600, linewidth: 2, depthTest: false })
      );
      crownLine.renderOrder = 25;
      group.add(crownLine);

      // 4. Left & right temple hair-root attachment curves (matching build_merlin_hair roots)
      for (const sideSgn of [-1, 1]) {
        const rootPts: T.Vector3[] = [];
        for (let i = 0; i <= 16; i++) {
          const t = i / 16;
          const yBlender = -0.062 + 0.114 * t;
          const xRoot = sideSgn * (0.050 + 0.022 * Math.sin(Math.PI * (0.12 + 0.78 * t)));
          const zBlender = 0.086 - 0.016 * Math.pow(t, 1.4);
          // Convert Blender (x, y_back, z_up) -> glTF (x, z_up, -y_back)
          rootPts.push(new T.Vector3(xRoot, zBlender, -yBlender));
        }
        const rootLine = new T.Line(
          new T.BufferGeometry().setFromPoints(rootPts),
          new T.LineBasicMaterial({ color: 0xff4081, linewidth: 2, depthTest: false })
        );
        rootLine.renderOrder = 26;
        group.add(rootLine);
      }

      this.diagnosticGroup = group;
      this.modelOffsetGroup.add(group);
    }
    if (this.diagnosticGroup) {
      this.diagnosticGroup.visible = enabled;
    }
  }

  public clear() {
    if (this.renderer) {
      this.renderer.clear();
    }
    if (this.canvas.width !== 1 || this.canvas.height !== 1) {
      this.canvas.width = 1;
      this.canvas.height = 1;
    }
    this.hasPrevPose = false;
  }

  public updateAndRender(
    pose: FacePose | null,
    settings: TrackingSettings,
    mirror: boolean,
    width: number,
    height: number,
    now: number
  ) {
    if (!pose || !settings.enabled || !settings.merlin) {
      this.clear();
      return;
    }

    this.ensureModelLoaded();
    const renderer = this.ensureRenderer(width, height);
    if (!renderer || !this.loaded || !this.costumeRoot) {
      return;
    }

    if (this.eyebrowsMesh) {
      this.eyebrowsMesh.visible = !!settings.merlinEyebrows;
    }
    if (this.scalpPrototypeMesh) {
      this.scalpPrototypeMesh.visible = this.showScalpPrototype;
    }

    this.fpsFrames++;
    if (now - this.fpsWindowStart >= 1000) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / (now - this.fpsWindowStart));
      this.fpsFrames = 0;
      this.fpsWindowStart = now;
      this.canvas.dataset.merlinFps = String(this.currentFps);
    }

    const dt = this.lastTime > 0 ? Math.min(0.05, Math.max(0.004, (now - this.lastTime) / 1000)) : 1 / 30;
    this.lastTime = now;

    // 1. Extract rigid 3D head pose from MediaPipe's 4x4 facialTransformationMatrixes (column-major, in cm)
    const rawMat = new T.Matrix4().fromArray(pose.matrix);
    const posCm = new T.Vector3();
    const rotQuat = new T.Quaternion();
    const matScale = new T.Vector3();
    rawMat.decompose(posCm, rotQuat, matScale);

    // Guard against degenerate depth or sudden tracking spikes
    if (!Number.isFinite(posCm.z) || posCm.z > -10 || posCm.z < -200) {
      return;
    }

    // Extract head Euler angles (YXZ order: Yaw around Y, Pitch around X, Roll around Z)
    const euler = new T.Euler().setFromQuaternion(rotQuat, 'YXZ');
    const yaw = euler.y;
    const pitch = euler.x;
    const roll = euler.z;

    // 2. Apply cranial screen-space residual lock (Method C) using unoccluded nose tip (landmark 1)
    // and temples (127/356) so the costume has sub-pixel registration regardless of individual facial proportions!
    const fPx = (height / 2.0) / Math.tan((VFOV_DEG * Math.PI) / 360.0);
    // When looking downward (pitch < 0 in OpenGL/MediaPipe), the nose tip projects further down than the upper lip;
    // shift the predicted nose anchor upward in model Y (+Y) so errPxY > 0 and the model shifts downward, keeping the mustache below the nose tip!
    const pitchDownCompY = Math.max(0, -pitch) * 0.045;
    const pNoseModel = new T.Vector3(
      NOSE_TIP_MODEL_M.x,
      NOSE_TIP_MODEL_M.y + pitchDownCompY,
      NOSE_TIP_MODEL_M.z
    );
    const pNoseCanon = pNoseModel.multiply(MODEL_SCALE_CM).add(MODEL_OFFSET_CM);
    const xcNose = pNoseCanon.applyQuaternion(rotQuat).add(posCm);

    if (xcNose.z < -5) {
      const predNoseX = (xcNose.x / -xcNose.z) * fPx + width * 0.5;
      const predNoseY = height * 0.5 - (xcNose.y / -xcNose.z) * fPx;
      const obsNoseX = pose.nose.x * width;
      const obsNoseY = pose.nose.y * height;

      let errPxX = obsNoseX - predNoseX;
      let errPxY = obsNoseY - predNoseY;

      if (pose.leftTemple && pose.rightTemple) {
        const pTmCanon = TEMPLE_MID_MODEL_M.clone().multiply(MODEL_SCALE_CM).add(MODEL_OFFSET_CM);
        const xcTm = pTmCanon.applyQuaternion(rotQuat).add(posCm);
        const predTmX = (xcTm.x / -xcTm.z) * fPx + width * 0.5;
        const predTmY = height * 0.5 - (xcTm.y / -xcTm.z) * fPx;
        const obsTmX = 0.5 * (pose.leftTemple.x + pose.rightTemple.x) * width;
        const obsTmY = 0.5 * (pose.leftTemple.y + pose.rightTemple.y) * height;
        errPxX = 0.72 * errPxX + 0.28 * (obsTmX - predTmX);
        errPxY = 0.72 * errPxY + 0.28 * (obsTmY - predTmY);
      }

      // Clamp residual correction to prevent any jump if a single landmark glitches
      const maxCorrPx = width * 0.08;
      errPxX = Math.max(-maxCorrPx, Math.min(maxCorrPx, errPxX));
      errPxY = Math.max(-maxCorrPx, Math.min(maxCorrPx, errPxY));

      posCm.x += (errPxX / fPx) * -xcNose.z;
      posCm.y -= (errPxY / fPx) * -xcNose.z;
    }

    // Smoothly damp sudden orientation jumps (SLERP) when tracking is near extreme profile/pitch limits
    if (this.hasPrevPose) {
      const angleStep = this.prevQuat.angleTo(rotQuat);
      if (angleStep > 0.45) {
        rotQuat.slerpQuaternions(this.prevQuat, rotQuat, 0.35);
        posCm.lerpVectors(this.prevPosCm, posCm, 0.45);
      }
    }

    // Mirror support: flip camera projection X when mirror is enabled so lighting and handedness stay clean
    this.camera.projectionMatrix.elements[0] =
      (mirror ? -1 : 1) * (1 / (Math.tan((VFOV_DEG * Math.PI) / 360.0) * this.camera.aspect));
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

    this.headAnchor.position.copy(posCm);
    this.headAnchor.quaternion.copy(rotQuat);
    this.headAnchor.scale.set(1, 1, 1);

    // Compute head linear and angular velocities (in cm/s and rad/s) for secondary motion
    const velCm = this.hasPrevPose
      ? new T.Vector3().subVectors(posCm, this.prevPosCm).divideScalar(dt)
      : new T.Vector3();
    const accelCm = this.hasPrevPose
      ? new T.Vector3().subVectors(velCm, this.prevVelCm).divideScalar(dt)
      : new T.Vector3();
    const yawVel = this.hasPrevPose ? (yaw - this.prevYaw) / dt : 0;
    const pitchVel = this.hasPrevPose ? (pitch - this.prevPitch) / dt : 0;
    const rollVel = this.hasPrevPose ? (roll - this.prevRoll) / dt : 0;

    this.prevPosCm.copy(posCm);
    this.prevVelCm.copy(velCm);
    this.prevQuat.copy(rotQuat);
    this.prevYaw = yaw;
    this.prevPitch = pitch;
    this.prevRoll = roll;
    this.hasPrevPose = true;

    // 3. Separate Jaw Articulation from Rigid Head Pose
    if (this.jawBone) {
      let targetJawOpen = 0;
      if (pose.upperLip && pose.lowerLip) {
        const lipDx = (pose.lowerLip.x - pose.upperLip.x) * width;
        const lipDy = (pose.lowerLip.y - pose.upperLip.y) * height;
        const lipGapPx = Math.hypot(lipDx, lipDy);
        const refFaceHeightPx = Math.max(24, (14.0 / -posCm.z) * fPx);
        targetJawOpen = Math.max(0, Math.min(1, (lipGapPx / refFaceHeightPx - 0.025) / 0.11));
      }
      this.smoothedJawOpen += (targetJawOpen - this.smoothedJawOpen) * (1 - Math.exp(-dt * 18));

      this.jawBone.position.set(
        this.jawRestPos.x,
        this.jawRestPos.y - this.smoothedJawOpen * 0.020,
        this.jawRestPos.z - this.smoothedJawOpen * 0.004
      );
      const jawDeltaQ = new T.Quaternion().setFromEuler(new T.Euler(this.smoothedJawOpen * 0.16, 0, 0, 'XYZ'));
      this.jawBone.quaternion.copy(this.jawRestQuat).multiply(jawDeltaQ);
    }

    // 4. Update Spring-Bone Chains for Lower Beard & Hair + Temple Ear-Plane Z-Anchor & Chest Settling
    const clampAngle = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
    const normLatVel = clampAngle(velCm.x / 45.0, 0.45);
    const normVertVel = clampAngle(velCm.y / 45.0, 0.35);
    const normLatAccel = clampAngle(accelCm.x / 350.0, 0.25);

    // Reset all bone positions to rest before computing world-to-local offsets
    for (const c of this.chains) {
      c.bone.position.copy(c.restPos);
    }
    this.costumeRoot.updateMatrixWorld(true);
    const modelGroupWorldInv = this.modelOffsetGroup.matrixWorld.clone().invert();

    // Retract temple hair roots (Hair_L_1, Hair_R_1) to the true anatomical ear/temple plane in modelOffsetGroup space
    // (+X right, +Y up, +Z forward) and tuck the far-side temple/cheek root behind the cranium/mid-face/nose occluders during yaw turns!
    const rightVecCam = new T.Vector3(1, 0, 0).applyQuaternion(rotQuat);
    // Downward pitch angle in radians (in OpenGL/MediaPipe camera space, looking DOWN is pitch < 0)
    const downPitchRad = Math.max(0, -pitch);

    for (const c of this.chains) {
      if (
        (c.bone.name === 'Hair_L_1' ||
          c.bone.name === 'Hair_R_1' ||
          c.bone.name === 'Beard_L_1' ||
          c.bone.name === 'Beard_R_1') &&
        c.bone.parent
      ) {
        const isLeft = c.bone.name.includes('_L_');
        const isHair = c.bone.name.startsWith('Hair_');
        const sideSign = isLeft ? -1 : 1;
        const farRaw = isLeft ? Math.max(0, rightVecCam.z) : Math.max(0, -rightVecCam.z);
        const farTuck = Math.min(1.0, Math.max(0, farRaw - 0.05) * 2.4);
        const dxModel = isHair ? -sideSign * farTuck * 0.074 : -sideSign * farTuck * 0.042;
        const dzModel = isHair ? -0.018 - farTuck * 0.095 : -farTuck * 0.068;

        const parentMatInModel = new T.Matrix4().multiplyMatrices(modelGroupWorldInv, c.bone.parent.matrixWorld);
        const parentRotInModel = new T.Matrix4().extractRotation(parentMatInModel);
        const modelToParentRot = parentRotInModel.invert();
        const deltaParent = new T.Vector3(dxModel, 0, dzModel).applyMatrix4(modelToParentRot);
        c.bone.position.copy(c.restPos).add(deltaParent);
      }
    }

    this.costumeRoot.updateMatrixWorld(true);

    for (const c of this.chains) {
      if (c.gravityWeight === 0 && c.inertiaWeight === 0) {
        c.bone.quaternion.copy(c.restQuat);
        continue;
      }

      const isBeard = c.bone.name.startsWith('Beard_');
      const isHair = c.bone.name.startsWith('Hair_');
      const segIdx = c.bone.name.endsWith('_4') ? 3 : c.bone.name.endsWith('_3') ? 2 : 1;

      const targetRoll = clampAngle(
        -roll * c.gravityWeight - (normLatVel * 0.42 + rollVel * 0.055 + normLatAccel * 0.25) * c.inertiaWeight,
        0.36
      );

      // Lightweight chest-collision & downward-pitch settling constraint:
      // When tilting the head downward (pitch < 0), lower beard segments counter-rotate forward (+X in head frame)
      // and drape slightly outward (+Z in model space) so the beard settles smoothly against the chest/shirt
      // without folding into the throat or bunching into dark overlapping shadow bands!
      let chestDrapePitch = 0;
      if (isBeard && downPitchRad > 0.05) {
        chestDrapePitch = downPitchRad * (0.22 + 0.14 * segIdx);
      } else if (isHair && downPitchRad > 0.08) {
        chestDrapePitch = downPitchRad * (0.14 * segIdx);
      }

      const rawTargetPitch =
        -pitch * (c.gravityWeight * 0.72) +
        chestDrapePitch -
        (pitchVel * 0.045 - normVertVel * 0.22) * c.inertiaWeight;

      // Asymmetric pitch clamp: prevent backward folding into throat (-0.14 rad max inward),
      // while allowing up to +0.34 rad forward chest drape during deep downward nods!
      const targetPitch = Math.max(-0.14, Math.min(0.34, rawTargetPitch));

      const targetYaw = clampAngle(
        -(yawVel * 0.065 + normLatVel * 0.28) * c.inertiaWeight,
        0.32
      );

      const forceRoll = (targetRoll - c.angleRoll) * c.stiffness - c.velRoll * c.damping;
      c.velRoll += forceRoll * dt;
      c.angleRoll = clampAngle(c.angleRoll + c.velRoll * dt, 0.38);

      const forcePitch = (targetPitch - c.anglePitch) * c.stiffness - c.velPitch * c.damping;
      c.velPitch += forcePitch * dt;
      c.anglePitch = Math.max(-0.15, Math.min(0.36, c.anglePitch + c.velPitch * dt));

      const forceYaw = (targetYaw - c.angleYaw) * c.stiffness - c.velYaw * c.damping;
      c.velYaw += forceYaw * dt;
      c.angleYaw = clampAngle(c.angleYaw + c.velYaw * dt, 0.34);

      const parentObj = c.bone.parent;
      if (parentObj) {
        parentObj.updateMatrixWorld(true);
        const parentInHeadMat = new T.Matrix4().multiplyMatrices(modelGroupWorldInv, parentObj.matrixWorld);
        const parentInHeadQuat = new T.Quaternion().setFromRotationMatrix(parentInHeadMat);
        const parentInHeadQuatInv = parentInHeadQuat.clone().invert();
        const deltaHeadQuat = new T.Quaternion().setFromEuler(
          new T.Euler(c.anglePitch, c.angleYaw, c.angleRoll, 'YXZ')
        );
        c.bone.quaternion
          .copy(parentInHeadQuatInv)
          .multiply(deltaHeadQuat)
          .multiply(parentInHeadQuat)
          .multiply(c.restQuat);

        // Apply subtle forward chest-collision push (+Z in model space) on lower beard segments during downward pitch
        // so segments glide smoothly over the chest instead of compressing vertically into dark self-occluding bands.
        if (isBeard && downPitchRad > 0.08) {
          const parentRotInModel = new T.Matrix4().extractRotation(parentInHeadMat).invert();
          const chestPushZ = Math.min(0.018, (downPitchRad - 0.08) * 0.022 * segIdx);
          const chestSpreadX =
            c.bone.name.includes('_L_') ? -chestPushZ * 0.25 : c.bone.name.includes('_R_') ? chestPushZ * 0.25 : 0;
          const pushDelta = new T.Vector3(chestSpreadX, 0, chestPushZ).applyMatrix4(parentRotInModel);
          c.bone.position.copy(c.restPos).add(pushDelta);
        }
      }
    }

    renderer.render(this.scene, this.camera);
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
