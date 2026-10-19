import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';

// Pinned MediaPipe v0.10.32: tasks/cc/vision/face_geometry/
// face_geometry_from_landmarks_graph.cc (default environment).
export const FACE_GEOMETRY_VFOV = 63;
export const POSE_SMOOTHING_MS = 45;

/** MediaPipe packed data and Three.js arrays are column-major. Camera space is
 * right-handed: +X right, +Y up, camera looking down -Z; translation is in cm.
 * MediaPipe supplies a similarity transform, not screen-normalized landmark Z.
 * Ignore its uniform scale, matching the existing unit-scale head attachment.
 */
export function readRigidFaceTransform(values: number[]) {
  if (values.length !== 16 || !values.every(Number.isFinite)
    || [3, 7, 11].some(i => Math.abs(values[i]) > 1e-5) || Math.abs(values[15] - 1) > 1e-5) return null;
  const matrix = new Matrix4().fromArray(values);
  const axes = [0, 1, 2].map(i => new Vector3().setFromMatrixColumn(matrix, i));
  const lengths = axes.map(axis => axis.length());
  if (lengths.some(length => length < 1e-6) || matrix.determinant() <= 0) return null;
  // Allow float32 noise; reject nonuniform scale/shear rather than extracting an
  // ambiguous orientation. The native geometry pipeline promises uniform scale.
  if (lengths.some(length => Math.abs(length / lengths[0] - 1) > 1e-3)) return null;
  axes.forEach((axis, i) => axis.divideScalar(lengths[i]));
  if ([[0, 1], [0, 2], [1, 2]].some(([i, j]) => Math.abs(axes[i].dot(axes[j])) > 1e-3)) return null;
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  rotation.normalize();
  return { position, rotation };
}

export function smoothRigidFaceMatrix(values: number[], previous: number[] | undefined, alpha: number): number[] | null {
  const next = readRigidFaceTransform(values);
  if (!next) return null;
  const old = previous ? readRigidFaceTransform(previous) : null;
  if (old) {
    next.position.lerpVectors(old.position, next.position, alpha);
    next.rotation.copy(old.rotation.slerp(next.rotation, alpha)).normalize();
  }
  return new Matrix4().compose(next.position, next.rotation, new Vector3(1, 1, 1)).toArray();
}

/** Tracker virtual projection, not an estimate of the physical webcam lens. */
export function configureFaceCamera(camera: PerspectiveCamera, width: number, height: number) {
  camera.fov = FACE_GEOMETRY_VFOV;
  camera.aspect = width / Math.max(1, height);
  camera.near = 1;
  camera.far = 500;
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();
  camera.updateProjectionMatrix();
}
