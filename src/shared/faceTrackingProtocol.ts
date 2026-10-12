export interface TrackingSettings { enabled: boolean; markers: boolean; hat: boolean }
export const TRACKING_DEFAULTS: TrackingSettings = { enabled: false, markers: true, hat: true };
export interface TrackingStatus {
  state: 'off' | 'initializing' | 'tracking' | 'face-lost' | 'error';
  message?: string;
}
export function parseTrackingSettings(value: unknown): TrackingSettings | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as TrackingSettings;
  if (typeof v.enabled !== 'boolean' || typeof v.markers !== 'boolean' || typeof v.hat !== 'boolean') return null;
  return { enabled: v.enabled, markers: v.markers, hat: v.hat };
}
export function parseTrackingStatus(value: unknown): TrackingStatus | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as TrackingStatus;
  if (!['off', 'initializing', 'tracking', 'face-lost', 'error'].includes(v.state)
    || (v.message !== undefined && typeof v.message !== 'string')) return null;
  return { state: v.state, message: v.message?.slice(0, 512) };
}
