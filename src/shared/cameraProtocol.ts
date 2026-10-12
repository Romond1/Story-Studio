export type CameraPreset = 'full' | 'lower-left' | 'lower-right' | 'hidden';
export interface CameraSettings {
  enabled: boolean; deviceId: string; preset: CameraPreset; chromaKey: boolean;
  tolerance: number; softness: number; brightness: number; contrast: number; mirror: boolean;
}
export const CAMERA_DEFAULTS: CameraSettings = {
  enabled: false, deviceId: '', preset: 'lower-right', chromaKey: false,
  tolerance: 0.28, softness: 0.12, brightness: 0, contrast: 1, mirror: true,
};
export interface CameraStatus {
  state: 'off' | 'starting' | 'live' | 'error';
  message?: string;
  devices: { deviceId: string; label: string }[];
}
export interface CameraState { settings: CameraSettings; status: CameraStatus }
export interface CameraControlApi {
  get(): Promise<CameraState>;
  set(settings: CameraSettings): Promise<CameraState>;
  subscribe(listener: (state: CameraState) => void): () => void;
}
export interface CameraPresenterApi {
  get(): Promise<CameraSettings>;
  subscribe(listener: (settings: CameraSettings) => void): () => void;
  report(status: CameraStatus): void;
}
export function parseCameraSettings(value: unknown): CameraSettings | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as CameraSettings;
  if (typeof v.enabled !== 'boolean' || typeof v.chromaKey !== 'boolean' || typeof v.mirror !== 'boolean'
    || typeof v.deviceId !== 'string' || v.deviceId.length > 1024
    || !['full', 'lower-left', 'lower-right', 'hidden'].includes(v.preset)) return null;
  for (const [key, min, max] of [['tolerance', 0, 1], ['softness', 0.001, 0.5], ['brightness', -1, 1], ['contrast', 0, 2]] as const) {
    if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < min || v[key] > max) return null;
  }
  return { enabled: v.enabled, deviceId: v.deviceId, preset: v.preset, chromaKey: v.chromaKey,
    tolerance: v.tolerance, softness: v.softness, brightness: v.brightness, contrast: v.contrast, mirror: v.mirror };
}
export function parseCameraStatus(value: unknown): CameraStatus | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as CameraStatus;
  if (!['off', 'starting', 'live', 'error'].includes(v.state) || !Array.isArray(v.devices) || v.devices.length > 64
    || (v.message !== undefined && typeof v.message !== 'string')) return null;
  if (!v.devices.every(d => d && typeof d.deviceId === 'string' && d.deviceId.length <= 1024 && typeof d.label === 'string')) return null;
  return { state: v.state, message: v.message?.slice(0, 512), devices: v.devices.map(d => ({ deviceId: d.deviceId, label: d.label.slice(0, 256) })) };
}
