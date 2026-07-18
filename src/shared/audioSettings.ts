export const AUDIO_STAGE_CONTROLS = [
  "microphone-volume",
  "microphone-mute",
  "media-volume",
  "media-mute",
  "master-volume",
  "master-mute",
  "monitor-volume",
  "monitor-mute",
  "mix-volume",
  "mix-mute",
  "microphone-meter",
  "media-meter",
  "master-meter",
  "monitor-meter",
  "mix-meter",
  "stop-all",
  "test-microphone",
  "reconnect-devices",
] as const;

export type AudioStageControl = (typeof AUDIO_STAGE_CONTROLS)[number];
export type AudioBusName = "microphone" | "media" | "master" | "monitor" | "mix";

export type SavedAudioDevice = {
  deviceId: string;
  label: string;
};

export type AudioSettingsV1 = {
  version: 1;
  devices: Record<"microphone" | "monitor" | "mix", SavedAudioDevice>;
  volumes: Record<AudioBusName, number>;
  muted: Record<AudioBusName, boolean>;
  monitoringEnabled: boolean;
  microphoneMonitorEnabled: boolean;
  stageControls: AudioStageControl[];
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsV1 = {
  version: 1,
  devices: {
    microphone: { deviceId: "default", label: "System Default Microphone" },
    monitor: { deviceId: "default", label: "System Default Output" },
    mix: { deviceId: "default", label: "System Default Output" },
  },
  volumes: { microphone: 1, media: 1, master: 1, monitor: 1, mix: 1 },
  muted: { microphone: false, media: false, master: false, monitor: false, mix: false },
  monitoringEnabled: true,
  microphoneMonitorEnabled: false,
  stageControls: [
    "microphone-volume",
    "microphone-mute",
    "monitor-volume",
    "monitor-mute",
    "microphone-meter",
    "master-meter",
    "stop-all",
  ],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function normalizeDevice(value: unknown, fallback: SavedAudioDevice): SavedAudioDevice {
  const device = asRecord(value);
  return {
    deviceId: typeof device.deviceId === "string" && device.deviceId.trim()
      ? device.deviceId
      : fallback.deviceId,
    label: typeof device.label === "string" && device.label.trim()
      ? device.label
      : fallback.label,
  };
}

export function normalizeAudioSettings(value: unknown): AudioSettingsV1 {
  const raw = asRecord(value);
  const devices = asRecord(raw.devices);
  const volumes = asRecord(raw.volumes);
  const muted = asRecord(raw.muted);
  const requestedControls = Array.isArray(raw.stageControls)
    ? raw.stageControls
    : DEFAULT_AUDIO_SETTINGS.stageControls;
  const stageControls = Array.from(new Set<unknown>(requestedControls))
    .filter((item): item is AudioStageControl =>
      typeof item === "string" && AUDIO_STAGE_CONTROLS.includes(item as AudioStageControl));

  return {
    version: 1,
    devices: {
      microphone: normalizeDevice(devices.microphone, DEFAULT_AUDIO_SETTINGS.devices.microphone),
      monitor: normalizeDevice(devices.monitor, DEFAULT_AUDIO_SETTINGS.devices.monitor),
      mix: normalizeDevice(devices.mix, DEFAULT_AUDIO_SETTINGS.devices.mix),
    },
    volumes: {
      microphone: clampVolume(volumes.microphone, DEFAULT_AUDIO_SETTINGS.volumes.microphone),
      media: clampVolume(volumes.media, DEFAULT_AUDIO_SETTINGS.volumes.media),
      master: clampVolume(volumes.master, DEFAULT_AUDIO_SETTINGS.volumes.master),
      monitor: clampVolume(volumes.monitor, DEFAULT_AUDIO_SETTINGS.volumes.monitor),
      mix: clampVolume(volumes.mix, DEFAULT_AUDIO_SETTINGS.volumes.mix),
    },
    muted: {
      microphone: Boolean(muted.microphone),
      media: Boolean(muted.media),
      master: Boolean(muted.master),
      monitor: Boolean(muted.monitor),
      mix: Boolean(muted.mix),
    },
    monitoringEnabled: raw.monitoringEnabled !== false,
    microphoneMonitorEnabled: raw.microphoneMonitorEnabled === true,
    stageControls,
  };
}
