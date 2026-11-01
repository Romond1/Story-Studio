/** Serializable visual intent; selection and gameplay remain in wheelRuntime. Epoch milliseconds allow late windows to seek. */
export interface WheelSpin { version: 1; id: string; segmentId: string; startedAt: number; durationMs: number; fromDegrees: number; toDegrees: number }
export type WheelMotionPhase = 'accelerating' | 'cruising' | 'decelerating' | 'landed';
export function createWheelSpin(id: string, segmentId: string, index: number, count: number, fromDegrees: number, startedAt: number, durationMs: number): WheelSpin {
  const target = (360 - (index + .5) * 360 / count) % 360;
  const delta = (target - fromDegrees % 360 + 360) % 360;
  return { version: 1, id, segmentId, startedAt, durationMs, fromDegrees, toDegrees: fromDegrees + 1800 + delta };
}
export function parseWheelSpin(value: unknown): WheelSpin | null {
 const v = value as WheelSpin | undefined;
 if (!v || v.version !== 1 || typeof v.id !== 'string' || !v.id || v.id.length > 1000 || typeof v.segmentId !== 'string' || !v.segmentId || v.segmentId.length > 200
  || !Number.isSafeInteger(v.startedAt) || v.startedAt < 0 || !Number.isFinite(v.durationMs) || v.durationMs < 100 || v.durationMs > 15000
  || !Number.isFinite(v.fromDegrees) || v.fromDegrees < 0 || !Number.isFinite(v.toDegrees) || v.toDegrees < v.fromDegrees + 1800 || v.toDegrees > v.fromDegrees + 2160 || v.toDegrees > 1e9) return null;
 return { version: 1, id: v.id, segmentId: v.segmentId, startedAt: v.startedAt, durationMs: v.durationMs, fromDegrees: v.fromDegrees, toDegrees: v.toDegrees };
}
/** Integrated velocity: linear acceleration, steady cruise, cubic deceleration. No frame-rate dependence. */
export function sampleWheelSpin(spin: WheelSpin, now: number, reducedMotion = false) {
 const t = Math.max(0, Math.min(1, (now - spin.startedAt) / spin.durationMs)), a = .18, b = .52;
 const distance = t < a ? .5 * t * t / a : t < b ? .5 * a + t - a : .5 * a + b - a + (1-b) / 4 * (1 - Math.pow(1 - (t-b)/(1-b),4));
 const phase: WheelMotionPhase = t >= 1 ? 'landed' : t < a ? 'accelerating' : t < b ? 'cruising' : 'decelerating';
 return { degrees: reducedMotion || t >= 1 ? spin.toDegrees : spin.fromDegrees + (spin.toDegrees-spin.fromDegrees)*distance/.55, phase, progress:t };
}
