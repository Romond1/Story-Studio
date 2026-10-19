export interface MerlinDiagnostics {
  enabled: boolean;
  hairRoots: boolean;
  pitchCompensation: boolean;
  residualRegistration: boolean;
  springMotion: boolean;
  jawMotion: boolean;
  costume: boolean;
  occlusion: boolean;
  axes: boolean;
  referencePoints: boolean;
  attachmentOrigins: boolean;
  occluderWireframe: boolean;
}
export function createMerlinDiagnostics(mode: 'rigid' | 'compensated'): MerlinDiagnostics {
  const compensated = mode === 'compensated';
  return {
    enabled: true, hairRoots: compensated, pitchCompensation: compensated,
    residualRegistration: compensated, springMotion: compensated, jawMotion: compensated,
    costume: true, occlusion: true, axes: true, referencePoints: true,
    attachmentOrigins: true, occluderWireframe: true,
  };
}
/** Ordinary teaching keeps the existing compensation behavior until webcam comparison. */
export function merlinOptions(settings: TrackingSettings): MerlinDiagnostics {
  return settings.merlinDiagnostics?.enabled ? settings.merlinDiagnostics : {
    ...createMerlinDiagnostics('compensated'), enabled: false,
    axes: false, referencePoints: false, attachmentOrigins: false, occluderWireframe: false,
  };
}
export interface TrackingSettings {
  enabled: boolean; markers: boolean; hat: boolean; merlin?: boolean; merlinEyebrows?: boolean;
  merlinHat?: boolean; merlinRobe?: boolean;
  merlinDiagnostics?: MerlinDiagnostics;
}
export const TRACKING_DEFAULTS: TrackingSettings = { enabled: false, markers: true, hat: true };
export interface TrackingStatus {
  state: 'off' | 'initializing' | 'tracking' | 'face-lost' | 'error';
  message?: string;
}
export function parseTrackingSettings(value: unknown): TrackingSettings | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as TrackingSettings;
  if (typeof v.enabled !== 'boolean' || typeof v.markers !== 'boolean' || typeof v.hat !== 'boolean') return null;
  if (v.merlin !== undefined && typeof v.merlin !== 'boolean') return null;
  if (v.merlinEyebrows !== undefined && typeof v.merlinEyebrows !== 'boolean') return null;
  if (v.merlinHat !== undefined && typeof v.merlinHat !== 'boolean') return null;
  if (v.merlinRobe !== undefined && typeof v.merlinRobe !== 'boolean') return null;
  let merlinDiagnostics: MerlinDiagnostics | undefined;
  if (v.merlinDiagnostics !== undefined) {
    if (!v.merlinDiagnostics || typeof v.merlinDiagnostics !== 'object') return null;
    merlinDiagnostics = createMerlinDiagnostics('rigid');
    for (const key of Object.keys(merlinDiagnostics) as (keyof MerlinDiagnostics)[]) {
      if (typeof v.merlinDiagnostics[key] !== 'boolean') return null;
      merlinDiagnostics[key] = v.merlinDiagnostics[key];
    }
  }
  return {
    enabled: v.enabled, markers: v.markers, hat: v.hat,
    ...(v.merlin !== undefined ? { merlin: v.merlin } : {}),
    ...(v.merlinEyebrows !== undefined ? { merlinEyebrows: v.merlinEyebrows } : {}),
    ...(v.merlinHat !== undefined ? { merlinHat: v.merlinHat } : {}),
    ...(v.merlinRobe !== undefined ? { merlinRobe: v.merlinRobe } : {}),
    ...(merlinDiagnostics ? { merlinDiagnostics } : {}),
  };
}
export function parseTrackingStatus(value: unknown): TrackingStatus | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as TrackingStatus;
  if (!['off', 'initializing', 'tracking', 'face-lost', 'error'].includes(v.state)
    || (v.message !== undefined && typeof v.message !== 'string')) return null;
  return { state: v.state, message: v.message?.slice(0, 512) };
}
