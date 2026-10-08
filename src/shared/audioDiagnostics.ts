import type { AudioSettingsV1 } from './audioSettings';

// Source meters are after source gain/mute. The monitor excludes the microphone
// unless explicitly enabled, and does not follow the broadcast master gain.
export function expectedAudioOutputFlow(settings: AudioSettingsV1, source: {
  microphoneFlowing: boolean; mediaFlowing: boolean; masterFlowing: boolean;
}): { monitorExpected: boolean; mixExpected: boolean } {
  return {
    monitorExpected: settings.monitoringEnabled && !settings.muted.monitor && settings.volumes.monitor > 0
      && (source.mediaFlowing || (settings.microphoneMonitorEnabled && source.microphoneFlowing)),
    mixExpected: !settings.muted.mix && settings.volumes.mix > 0 && source.masterFlowing,
  };
}

export type AudioWarning = {
  id: string;
  severity: "warning" | "error";
  label: string;
  detail: string;
};

export type AudioEngineState = "stopped" | "starting" | "active" | "muted" | "warning" | "error" | "reconnecting";

export function deriveAudioEngineState(input: {
  reconnecting: boolean;
  hasGraph: boolean;
  masterMuted: boolean;
  warnings: AudioWarning[];
}): AudioEngineState {
  if (input.reconnecting) return "reconnecting";
  if (input.warnings.some((warning) => warning.severity === "error")) return "error";
  if (input.warnings.length > 0) return "warning";
  if (input.masterMuted) return "muted";
  return input.hasGraph ? "active" : "stopped";
}

export type AudioHealthState = {
  selectedDevicesMissing: string[];
  masterFlowing: boolean;
  mixFlowing: boolean;
  monitorFlowing: boolean;
  monitorExpected: boolean;
  mixExpected: boolean;
  masterPeak: number;
  activeMicrophoneStreams: number;
  activeMixStreams: number;
  activeMonitorStreams: number;
  activeCallbackCount: number;
  activeListenerCount: number;
  mixPhysicalKey: string | null;
  monitorPhysicalKey: string | null;
  lastStreamError: string | null;
  underruns: number;
  sampleRateMismatch: boolean;
  channelMismatch: boolean;
  restartRequired: boolean;
};

export function deriveAudioWarnings(state: AudioHealthState): AudioWarning[] {
  const warnings: AudioWarning[] = [];
  const add = (
    id: string,
    severity: AudioWarning["severity"],
    label: string,
    detail: string,
  ) => warnings.push({ id, severity, label, detail });

  if (state.selectedDevicesMissing.length > 0) {
    add(
      "missing-device",
      "error",
      "Saved audio device is missing",
      `Reconnect or replace: ${state.selectedDevicesMissing.join(", ")}.`,
    );
  }
  // Signal detection is informational, not engine health. Independent analyser
  // windows and gains can cross the silence threshold at different times; neither
  // silence nor an upstream meter proves that a physical output has failed.
  if (state.activeMicrophoneStreams > 1) {
    add("duplicate-microphone-stream", "error", "Multiple microphone streams are active", "Restart the audio engine before teaching.");
  }
  if (state.activeMixStreams > 1) {
    add("duplicate-mix-stream", "error", "Multiple Mix Output streams are active", "Restart the audio engine to prevent doubled audio.");
  }
  if (state.activeMonitorStreams > 1) {
    add("duplicate-monitor-stream", "error", "Multiple Monitor Output streams are active", "Restart the audio engine to prevent doubled audio.");
  }
  if (state.activeCallbackCount > 1) {
    add("duplicate-callback", "error", "Duplicate audio callbacks are active", "Restart the audio engine to dispose stale callbacks.");
  }
  if (state.activeListenerCount > 1) {
    add("duplicate-listener", "error", "Duplicate device listeners are active", "Restart the audio engine to dispose stale listeners.");
  }
  if (
    state.mixPhysicalKey
    && state.monitorPhysicalKey
    && state.mixPhysicalKey === state.monitorPhysicalKey
  ) {
    add(
      "same-physical-output",
      "warning",
      "Monitor and Mix resolve to the same output",
      "Choose separate devices to avoid delayed or doubled lesson audio.",
    );
  }
  if (state.masterPeak >= 0.98) {
    add("clipping", "warning", "Master mix is clipping", "Lower microphone, media, or master volume.");
  }
  if (state.underruns > 0) {
    add("buffer-underrun", "warning", "Audio buffer underruns detected", "Restart the engine or increase the operating-system audio buffer.");
  }
  if (state.sampleRateMismatch) {
    add("sample-rate-mismatch", "warning", "Sample-rate mismatch", "Align the microphone, VB-Cable, and output sample rates.");
  }
  if (state.channelMismatch) {
    add("channel-mismatch", "warning", "Channel-count mismatch", "Use compatible mono/stereo settings across the selected devices.");
  }
  if (state.lastStreamError) {
    add("stream-error", "error", "Audio stream failed", state.lastStreamError);
  }
  if (state.restartRequired) {
    add("restart-required", "error", "Audio engine requires restart", "Use Restart Audio Engine before starting the lesson.");
  }

  return warnings;
}
