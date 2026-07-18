import {
  DEFAULT_AUDIO_SETTINGS,
  muteAllAudioSettings,
  normalizeAudioSettings,
  type AudioBusName,
  type AudioSettingsV1,
  type SavedAudioDevice,
} from "../../shared/audioSettings";
import {
  AudioRouteCoordinator,
  type AudioOutputRoute,
  type RouteHandle,
} from "../../shared/audioLifecycle";
import {
  deriveAudioWarnings,
  type AudioWarning,
} from "../../shared/audioDiagnostics";
import type { AudioRouteCategory } from "../../shared/audioRoutingPlan";

export type AudioEngineState =
  | "stopped"
  | "starting"
  | "active"
  | "muted"
  | "warning"
  | "error"
  | "reconnecting";

export type AudioMeterReading = {
  peak: number;
  rms: number;
  flowing: boolean;
};

export type AudioDeviceState = SavedAudioDevice & {
  kind: "audioinput" | "audiooutput";
  groupId: string;
  connected: boolean;
  active: boolean;
  flowing: boolean;
  sampleRate: number | null;
  channelCount: number | null;
};

export type AudioDiagnostics = {
  activeStreamCount: number;
  activeMicrophoneStreams: number;
  activeMixStreams: number;
  activeMonitorStreams: number;
  activeCallbackCount: number;
  activeListenerCount: number;
  underruns: number;
  overruns: number;
  droppedBuffers: number;
  lastStreamError: string | null;
  lastReconnectAttempt: string | null;
  sampleRate: number | null;
  bufferSize: number | null;
  generation: number;
};

export type AudioSnapshot = {
  engineState: AudioEngineState;
  generation: number;
  settings: AudioSettingsV1;
  devices: { inputs: AudioDeviceState[]; outputs: AudioDeviceState[] };
  meters: Record<AudioBusName, AudioMeterReading>;
  warnings: AudioWarning[];
  diagnostics: AudioDiagnostics;
};

type AudioSettingsApi = {
  getAudioSettings(): Promise<AudioSettingsV1>;
  saveAudioSettings(settings: AudioSettingsV1): Promise<AudioSettingsV1>;
};

type ActiveBufferNode = {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  routeCategory: AudioRouteCategory;
};

type AttachedMediaNode = {
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  routeCategory: AudioRouteCategory;
};

type AudioGraph = {
  mediaBus: GainNode;
  microphoneBus: GainNode;
  mediaGain: GainNode;
  microphoneGain: GainNode;
  masterBus: GainNode;
  masterGain: GainNode;
  monitorMix: GainNode;
  microphoneMonitorGain: GainNode;
  monitorGain: GainNode;
  mixGain: GainNode;
  monitorDestination: MediaStreamAudioDestinationNode;
  mixDestination: MediaStreamAudioDestinationNode;
  analysers: Record<AudioBusName, AnalyserNode>;
};

const SILENT_METER: AudioMeterReading = { peak: 0, rms: 0, flowing: false };

function emptyMeters(): Record<AudioBusName, AudioMeterReading> {
  return {
    microphone: { ...SILENT_METER },
    media: { ...SILENT_METER },
    master: { ...SILENT_METER },
    monitor: { ...SILENT_METER },
    mix: { ...SILENT_METER },
  };
}

function createDiagnostics(): AudioDiagnostics {
  return {
    activeStreamCount: 0,
    activeMicrophoneStreams: 0,
    activeMixStreams: 0,
    activeMonitorStreams: 0,
    activeCallbackCount: 0,
    activeListenerCount: 0,
    underruns: 0,
    overruns: 0,
    droppedBuffers: 0,
    lastStreamError: null,
    lastReconnectAttempt: null,
    sampleRate: null,
    bufferSize: null,
    generation: 0,
  };
}

function readMeter(analyser: AnalyserNode, samples: Float32Array): AudioMeterReading {
  analyser.getFloatTimeDomainData(samples);
  let squareSum = 0;
  let peak = 0;
  for (const sample of samples) {
    const absolute = Math.abs(sample);
    peak = Math.max(peak, absolute);
    squareSum += sample * sample;
  }
  const rms = Math.sqrt(squareSum / samples.length);
  return { peak, rms, flowing: peak > 0.0005 || rms > 0.0002 };
}

export class AudioController {
  private context: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private settingsApi: AudioSettingsApi | null = null;
  private initializePromise: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private coordinator = new AudioRouteCoordinator();
  private generation = 0;
  private meterFrame: number | null = null;
  private deviceListenerAttached = false;
  private microphoneStream: MediaStream | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private routePhysicalKeys: Record<AudioOutputRoute, string | null> = {
    monitor: null,
    mix: null,
  };
  private testNodes = new Set<AudioScheduledSourceNode>();

  private buffers = new Map<string, AudioBuffer>();
  private activeNodes = new Map<string, ActiveBufferNode>();
  private mediaElementNodes = new Map<HTMLMediaElement, AttachedMediaNode>();
  private pauseTimes = new Map<string, number>();
  private startTimes = new Map<string, number>();
  private playRequestsPendingBuffer = new Set<string>();
  private playClipInFlight = new Set<string>();
  private sectionMusicUrl: string | null = null;
  private readonly fadeSeconds = 0.12;

  private snapshot: AudioSnapshot = {
    engineState: "stopped",
    generation: 0,
    settings: normalizeAudioSettings(DEFAULT_AUDIO_SETTINGS),
    devices: { inputs: [], outputs: [] },
    meters: emptyMeters(),
    warnings: [],
    diagnostics: createDiagnostics(),
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.refreshDiagnostics();
    return () => {
      this.listeners.delete(listener);
      this.refreshDiagnostics();
    };
  };

  getSnapshot = (): AudioSnapshot => this.snapshot;

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private updateSnapshot(updates: Partial<AudioSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...updates };
    this.refreshWarnings(false);
    this.emit();
  }

  private updateDiagnostics(updates: Partial<AudioDiagnostics>, emit = true): void {
    this.snapshot = {
      ...this.snapshot,
      diagnostics: { ...this.snapshot.diagnostics, ...updates },
    };
    this.refreshWarnings(false);
    if (emit) this.emit();
  }

  private refreshDiagnostics(emit = true): void {
    const activeMicrophoneStreams = this.microphoneStream ? 1 : 0;
    const activeMixStreams = this.coordinator.get("mix") ? 1 : 0;
    const activeMonitorStreams = this.coordinator.get("monitor") ? 1 : 0;
    this.updateDiagnostics({
      activeMicrophoneStreams,
      activeMixStreams,
      activeMonitorStreams,
      activeStreamCount: activeMicrophoneStreams + activeMixStreams + activeMonitorStreams,
      activeCallbackCount: this.meterFrame === null ? 0 : 1,
      activeListenerCount: this.deviceListenerAttached ? 1 : 0,
      sampleRate: this.context?.sampleRate ?? null,
      bufferSize: this.graph?.analysers.master.fftSize ?? null,
      generation: this.generation,
    }, emit);
  }

  private selectedMissingDevices(): string[] {
    const missing: string[] = [];
    const { devices, settings } = this.snapshot;
    const hasDevice = (list: AudioDeviceState[], id: string) =>
      id === "default" || list.some((device) => device.deviceId === id);
    if (!hasDevice(devices.inputs, settings.devices.microphone.deviceId)) {
      missing.push(settings.devices.microphone.label);
    }
    if (!hasDevice(devices.outputs, settings.devices.monitor.deviceId)) {
      missing.push(settings.devices.monitor.label);
    }
    if (!hasDevice(devices.outputs, settings.devices.mix.deviceId)) {
      missing.push(settings.devices.mix.label);
    }
    return missing;
  }

  private refreshWarnings(emit = true): void {
    const { diagnostics, meters } = this.snapshot;
    const warnings = deriveAudioWarnings({
      selectedDevicesMissing: this.selectedMissingDevices(),
      masterFlowing: meters.master.flowing,
      mixFlowing: meters.mix.flowing,
      monitorFlowing: meters.monitor.flowing,
      masterPeak: meters.master.peak,
      activeMicrophoneStreams: diagnostics.activeMicrophoneStreams,
      activeMixStreams: diagnostics.activeMixStreams,
      activeMonitorStreams: diagnostics.activeMonitorStreams,
      activeCallbackCount: diagnostics.activeCallbackCount,
      activeListenerCount: diagnostics.activeListenerCount,
      mixPhysicalKey: this.routePhysicalKeys.mix,
      monitorPhysicalKey: this.routePhysicalKeys.monitor,
      lastStreamError: diagnostics.lastStreamError,
      underruns: diagnostics.underruns,
      sampleRateMismatch: false,
      channelMismatch: false,
      restartRequired: this.snapshot.engineState === "error",
    });
    const engineState: AudioEngineState = this.snapshot.engineState === "reconnecting"
      ? "reconnecting"
      : warnings.some((warning) => warning.severity === "error")
        ? "error"
        : warnings.length > 0
          ? "warning"
          : this.snapshot.settings.muted.master
            ? "muted"
            : this.graph
              ? "active"
              : "stopped";
    this.snapshot = { ...this.snapshot, warnings, engineState };
    if (emit) this.emit();
  }

  private createGraph(context: AudioContext): AudioGraph {
    const mediaBus = context.createGain();
    const microphoneBus = context.createGain();
    const mediaGain = context.createGain();
    const microphoneGain = context.createGain();
    const masterBus = context.createGain();
    const masterGain = context.createGain();
    const monitorMix = context.createGain();
    const microphoneMonitorGain = context.createGain();
    const monitorGain = context.createGain();
    const mixGain = context.createGain();
    const monitorDestination = context.createMediaStreamDestination();
    const mixDestination = context.createMediaStreamDestination();
    const analysers = {
      microphone: context.createAnalyser(),
      media: context.createAnalyser(),
      master: context.createAnalyser(),
      monitor: context.createAnalyser(),
      mix: context.createAnalyser(),
    };

    mediaBus.connect(mediaGain);
    mediaGain.connect(masterBus);
    mediaGain.connect(monitorMix);
    microphoneBus.connect(microphoneGain);
    microphoneGain.connect(masterBus);
    microphoneGain.connect(microphoneMonitorGain);
    microphoneMonitorGain.connect(monitorMix);
    masterBus.connect(masterGain);
    masterGain.connect(mixGain);
    mixGain.connect(mixDestination);
    monitorMix.connect(monitorGain);
    monitorGain.connect(monitorDestination);

    microphoneGain.connect(analysers.microphone);
    mediaGain.connect(analysers.media);
    masterGain.connect(analysers.master);
    monitorGain.connect(analysers.monitor);
    mixGain.connect(analysers.mix);
    Object.values(analysers).forEach((analyser) => {
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.65;
    });

    return {
      mediaBus,
      microphoneBus,
      mediaGain,
      microphoneGain,
      masterBus,
      masterGain,
      monitorMix,
      microphoneMonitorGain,
      monitorGain,
      mixGain,
      monitorDestination,
      mixDestination,
      analysers,
    };
  }

  private ensureGraph(): AudioGraph {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ latencyHint: "interactive" });
    }
    if (!this.graph) {
      this.graph = this.createGraph(this.context);
      this.applySettingsToGraph();
      this.startMeterLoop();
    }
    return this.graph;
  }

  private applyGain(node: GainNode, volume: number, muted: boolean): void {
    if (!this.context) return;
    node.gain.cancelScheduledValues(this.context.currentTime);
    node.gain.setValueAtTime(muted ? 0 : Math.max(0, Math.min(1, volume)), this.context.currentTime);
  }

  private applySettingsToGraph(): void {
    if (!this.graph) return;
    const { volumes, muted, monitoringEnabled, microphoneMonitorEnabled } = this.snapshot.settings;
    this.applyGain(this.graph.microphoneGain, volumes.microphone, muted.microphone);
    this.applyGain(this.graph.mediaGain, volumes.media, muted.media);
    this.applyGain(this.graph.masterGain, volumes.master, muted.master);
    this.applyGain(this.graph.monitorGain, volumes.monitor, muted.monitor || !monitoringEnabled);
    this.applyGain(this.graph.mixGain, volumes.mix, muted.mix);
    this.applyGain(this.graph.microphoneMonitorGain, 1, !microphoneMonitorEnabled);
  }

  initializeFromAppSettings(api: AudioSettingsApi): Promise<void> {
    if (this.initializePromise) return this.initializePromise;
    this.settingsApi = api;
    this.initializePromise = api.getAudioSettings()
      .then((settings) => this.initialize(settings))
      .catch((error) => {
        this.recordError("Could not load audio settings", error);
        return this.initialize(DEFAULT_AUDIO_SETTINGS);
      });
    return this.initializePromise;
  }

  async initialize(settings: AudioSettingsV1 = DEFAULT_AUDIO_SETTINGS): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      settings: normalizeAudioSettings(settings),
      engineState: "starting",
      generation: this.generation,
    };
    this.ensureGraph();
    this.attachDeviceListener();
    await this.refreshDevices();
    await this.restoreRoutes();
    this.startMeterLoop();
    this.refreshDiagnostics(false);
    this.refreshWarnings();
  }

  private attachDeviceListener(): void {
    if (this.deviceListenerAttached || !navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
    this.deviceListenerAttached = true;
  }

  private detachDeviceListener(): void {
    if (!this.deviceListenerAttached || !navigator.mediaDevices) return;
    navigator.mediaDevices.removeEventListener("devicechange", this.handleDeviceChange);
    this.deviceListenerAttached = false;
  }

  private handleDeviceChange = (): void => {
    void this.refreshDevices().then(() => this.refreshWarnings());
  };

  async listDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: devices.filter((device) => device.kind === "audioinput"),
      outputs: devices.filter((device) => device.kind === "audiooutput"),
    };
  }

  async refreshDevices(): Promise<void> {
    try {
      const { inputs, outputs } = await this.listDevices();
      const toState = (device: MediaDeviceInfo): AudioDeviceState => ({
        deviceId: device.deviceId,
        label: device.label || `${device.kind === "audioinput" ? "Microphone" : "Output"} ${device.deviceId.slice(0, 6)}`,
        kind: device.kind as "audioinput" | "audiooutput",
        groupId: device.groupId || device.deviceId,
        connected: true,
        active: device.kind === "audioinput"
          ? this.snapshot.settings.devices.microphone.deviceId === device.deviceId && Boolean(this.microphoneStream)
          : (this.snapshot.settings.devices.monitor.deviceId === device.deviceId && Boolean(this.coordinator.get("monitor")))
            || (this.snapshot.settings.devices.mix.deviceId === device.deviceId && Boolean(this.coordinator.get("mix"))),
        flowing: false,
        sampleRate: null,
        channelCount: null,
      });
      this.updateSnapshot({
        devices: { inputs: inputs.map(toState), outputs: outputs.map(toState) },
      });
    } catch (error) {
      this.recordError("Could not enumerate audio devices", error);
    }
  }

  private findDevice(route: "microphone" | AudioOutputRoute, deviceId: string): AudioDeviceState | undefined {
    const list = route === "microphone" ? this.snapshot.devices.inputs : this.snapshot.devices.outputs;
    return list.find((device) => device.deviceId === deviceId);
  }

  private physicalKey(route: AudioOutputRoute, deviceId: string): string {
    const device = this.findDevice(route, deviceId);
    return device?.groupId || device?.deviceId || deviceId;
  }

  private async createSink(route: AudioOutputRoute, deviceId: string): Promise<RouteHandle> {
    const graph = this.ensureGraph();
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = route === "mix" ? graph.mixDestination.stream : graph.monitorDestination.stream;
    const sink = audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> };
    await sink.setSinkId(deviceId === "default" ? "" : deviceId);
    await audio.play();
    let disposed = false;
    return {
      id: `${route}:${deviceId}:${this.generation}`,
      active: !audio.paused,
      disposeCalls: 0,
      dispose() {
        if (disposed) return;
        disposed = true;
        this.disposeCalls += 1;
        audio.pause();
        audio.srcObject = null;
      },
    };
  }

  async selectOutput(route: AudioOutputRoute, device: SavedAudioDevice): Promise<void> {
    this.ensureGraph();
    this.updateSnapshot({ engineState: "reconnecting" });
    try {
      await this.coordinator.replace(route, () => this.createSink(route, device.deviceId));
      const physicalKey = this.physicalKey(route, device.deviceId);
      const otherRoute: AudioOutputRoute = route === "mix" ? "monitor" : "mix";
      if (this.routePhysicalKeys[otherRoute] === physicalKey) {
        this.coordinator.remove(otherRoute);
        this.routePhysicalKeys[otherRoute] = null;
      }
      this.routePhysicalKeys[route] = physicalKey;
      const settings = normalizeAudioSettings({
        ...this.snapshot.settings,
        devices: { ...this.snapshot.settings.devices, [route]: device },
      });
      this.snapshot = { ...this.snapshot, settings };
      await this.persistSettings();
      this.updateDiagnostics({ lastStreamError: null });
      await this.refreshDevices();
    } catch (error) {
      this.recordError(`Failed to start ${route} output`, error);
      throw error;
    } finally {
      this.refreshDiagnostics(false);
      this.refreshWarnings();
    }
  }

  async setDevice(deviceId: string): Promise<void> {
    const device = this.findDevice("mix", deviceId);
    await this.selectOutput("mix", {
      deviceId,
      label: device?.label || (deviceId === "default" ? "System Default Output" : deviceId),
    });
  }

  async setMonitorDevice(deviceId: string): Promise<void> {
    const device = this.findDevice("monitor", deviceId);
    await this.selectOutput("monitor", {
      deviceId,
      label: device?.label || (deviceId === "default" ? "System Default Output" : deviceId),
    });
  }

  private async restoreRoutes(): Promise<void> {
    const { devices } = this.snapshot.settings;
    const operations: Promise<unknown>[] = [];
    const canUse = (route: "microphone" | AudioOutputRoute, id: string) =>
      id === "default" || Boolean(this.findDevice(route, id));
    if (canUse("monitor", devices.monitor.deviceId)) {
      operations.push(this.selectOutput("monitor", devices.monitor).catch(() => undefined));
    }
    if (canUse("mix", devices.mix.deviceId)) {
      operations.push(this.selectOutput("mix", devices.mix).catch(() => undefined));
    }
    if (canUse("microphone", devices.microphone.deviceId)) {
      operations.push(this.enableMic(devices.microphone.deviceId === "default" ? undefined : devices.microphone.deviceId).catch(() => undefined));
    }
    await Promise.all(operations);
  }

  async enableMic(deviceId?: string): Promise<void> {
    const requestedId = deviceId || "default";
    let candidateStream: MediaStream | null = null;
    let candidateSource: MediaStreamAudioSourceNode | null = null;
    try {
      candidateStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const track = candidateStream.getAudioTracks()[0];
      if (!track || track.readyState !== "live") throw new Error("Microphone track did not become live");
      const graph = this.ensureGraph();
      candidateSource = this.getContext().createMediaStreamSource(candidateStream);
      candidateSource.connect(graph.microphoneBus);

      const previousStream = this.microphoneStream;
      const previousSource = this.microphoneSource;
      this.microphoneStream = candidateStream;
      this.microphoneSource = candidateSource;
      previousSource?.disconnect();
      previousStream?.getTracks().forEach((previousTrack) => previousTrack.stop());

      const device = this.findDevice("microphone", requestedId);
      const settings = normalizeAudioSettings({
        ...this.snapshot.settings,
        devices: {
          ...this.snapshot.settings.devices,
          microphone: {
            deviceId: requestedId,
            label: device?.label || (requestedId === "default" ? "System Default Microphone" : requestedId),
          },
        },
      });
      this.snapshot = { ...this.snapshot, settings };
      await this.persistSettings();
      await this.refreshDevices();
      this.updateDiagnostics({ lastStreamError: null });
    } catch (error) {
      candidateSource?.disconnect();
      candidateStream?.getTracks().forEach((track) => track.stop());
      this.recordError("Failed to start microphone", error);
      throw error;
    } finally {
      this.refreshDiagnostics();
    }
  }

  disableMic(): void {
    this.microphoneSource?.disconnect();
    this.microphoneSource = null;
    this.microphoneStream?.getTracks().forEach((track) => track.stop());
    this.microphoneStream = null;
    this.refreshDiagnostics();
  }

  isMicEnabled(): boolean {
    return Boolean(this.microphoneStream);
  }

  setBusVolume(bus: AudioBusName, volume: number): void {
    const settings = normalizeAudioSettings({
      ...this.snapshot.settings,
      volumes: { ...this.snapshot.settings.volumes, [bus]: volume },
    });
    this.snapshot = { ...this.snapshot, settings };
    this.applySettingsToGraph();
    void this.persistSettings();
    this.refreshWarnings();
  }

  setBusMuted(bus: AudioBusName, muted: boolean): void {
    const settings = normalizeAudioSettings({
      ...this.snapshot.settings,
      muted: { ...this.snapshot.settings.muted, [bus]: muted },
    });
    this.snapshot = { ...this.snapshot, settings };
    this.applySettingsToGraph();
    void this.persistSettings();
    this.refreshWarnings();
  }

  setMonitoringEnabled(enabled: boolean): void {
    this.snapshot = {
      ...this.snapshot,
      settings: normalizeAudioSettings({ ...this.snapshot.settings, monitoringEnabled: enabled }),
    };
    this.applySettingsToGraph();
    void this.persistSettings();
    this.refreshWarnings();
  }

  setMicrophoneMonitorEnabled(enabled: boolean): void {
    this.snapshot = {
      ...this.snapshot,
      settings: normalizeAudioSettings({ ...this.snapshot.settings, microphoneMonitorEnabled: enabled }),
    };
    this.applySettingsToGraph();
    void this.persistSettings();
    this.refreshWarnings();
  }

  setStageControls(stageControls: AudioSettingsV1["stageControls"]): void {
    this.snapshot = {
      ...this.snapshot,
      settings: normalizeAudioSettings({ ...this.snapshot.settings, stageControls }),
    };
    void this.persistSettings();
    this.refreshWarnings();
  }

  private async persistSettings(): Promise<void> {
    if (!this.settingsApi) return;
    const requestedSettings = this.snapshot.settings;
    const operation = this.persistQueue.then(async () => {
      try {
        const saved = await this.settingsApi!.saveAudioSettings(requestedSettings);
        if (this.snapshot.settings === requestedSettings) {
          this.snapshot = { ...this.snapshot, settings: normalizeAudioSettings(saved) };
        }
      } catch (error) {
        this.recordError("Could not save audio settings", error);
      }
    });
    this.persistQueue = operation.catch(() => undefined);
    await operation;
  }

  private startMeterLoop(): void {
    if (this.meterFrame !== null || !this.graph) return;
    const samples = new Float32Array(this.graph.analysers.master.fftSize);
    const tick = () => {
      if (!this.graph) {
        this.meterFrame = null;
        return;
      }
      const meters: Record<AudioBusName, AudioMeterReading> = {
        microphone: readMeter(this.graph.analysers.microphone, samples),
        media: readMeter(this.graph.analysers.media, samples),
        master: readMeter(this.graph.analysers.master, samples),
        monitor: readMeter(this.graph.analysers.monitor, samples),
        mix: readMeter(this.graph.analysers.mix, samples),
      };
      if (!this.coordinator.get("monitor")) meters.monitor = { ...meters.monitor, flowing: false };
      if (!this.coordinator.get("mix")) meters.mix = { ...meters.mix, flowing: false };
      this.snapshot = { ...this.snapshot, meters };
      this.refreshDiagnostics(false);
      this.refreshWarnings();
      this.meterFrame = requestAnimationFrame(tick);
    };
    this.meterFrame = requestAnimationFrame(tick);
    this.refreshDiagnostics();
  }

  private stopMeterLoop(): void {
    if (this.meterFrame !== null) cancelAnimationFrame(this.meterFrame);
    this.meterFrame = null;
    this.snapshot = { ...this.snapshot, meters: emptyMeters() };
  }

  private recordError(label: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[audio] ${label}`, error);
    this.updateDiagnostics({ lastStreamError: `${label}: ${detail}` }, false);
    this.updateSnapshot({ engineState: "error" });
  }

  async reconnectMissingDevices(): Promise<void> {
    this.updateDiagnostics({ lastReconnectAttempt: new Date().toISOString() }, false);
    await this.refreshDevices();
    await this.restoreRoutes();
    this.refreshWarnings();
  }

  private startOscillator(
    target: AudioNode,
    frequency: number,
    durationSeconds: number,
    volume: number,
    startOffset = 0,
  ): void {
    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + startOffset;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSeconds);
    oscillator.connect(gain);
    gain.connect(target);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.testNodes.delete(oscillator);
      this.refreshDiagnostics();
    };
    this.testNodes.add(oscillator);
    oscillator.start(start);
    oscillator.stop(start + durationSeconds + 0.02);
  }

  sendTestTone(route: AudioOutputRoute): void {
    const graph = this.ensureGraph();
    this.startOscillator(route === "mix" ? graph.masterBus : graph.monitorMix, 440, 0.8, 0.18);
  }

  testMicrophone(): void {
    if (!this.microphoneStream) {
      void this.enableMic(
        this.snapshot.settings.devices.microphone.deviceId === "default"
          ? undefined
          : this.snapshot.settings.devices.microphone.deviceId,
      );
    }
  }

  playGeneratedChime(volume = 0.35): void {
    const graph = this.ensureGraph();
    const chimeVolume = Math.max(0, Math.min(1, volume)) * 0.22;
    [659.25, 783.99, 987.77].forEach((frequency, index) => {
      this.startOscillator(graph.mediaBus, frequency, 0.22, chimeVolume, index * 0.055);
    });
  }

  copyDiagnosticsText(): string {
    const { diagnostics, devices, meters, warnings, engineState, settings } = this.snapshot;
    const lines = [
      "Story Studio Audio Diagnostics",
      `Captured: ${new Date().toISOString()}`,
      `Engine state: ${engineState}`,
      `Generation: ${diagnostics.generation}`,
      `Active streams: ${diagnostics.activeStreamCount} (microphone ${diagnostics.activeMicrophoneStreams}, monitor ${diagnostics.activeMonitorStreams}, mix ${diagnostics.activeMixStreams})`,
      `Active callbacks: ${diagnostics.activeCallbackCount}`,
      `Active listeners: ${diagnostics.activeListenerCount}`,
      `Audio context sample rate: ${diagnostics.sampleRate ?? "unknown"}`,
      `Analyser buffer size: ${diagnostics.bufferSize ?? "unknown"}`,
      `Last stream error: ${diagnostics.lastStreamError ?? "none"}`,
      `Last reconnect attempt: ${diagnostics.lastReconnectAttempt ?? "none"}`,
      `Selected microphone: ${settings.devices.microphone.label} (${settings.devices.microphone.deviceId})`,
      `Selected monitor: ${settings.devices.monitor.label} (${settings.devices.monitor.deviceId})`,
      `Selected mix: ${settings.devices.mix.label} (${settings.devices.mix.deviceId})`,
      ...Object.entries(meters).map(([name, meter]) => `${name} peak=${meter.peak.toFixed(4)} rms=${meter.rms.toFixed(4)} flowing=${meter.flowing}`),
      `Input devices: ${devices.inputs.map((device) => `${device.label} [${device.deviceId}]`).join("; ") || "none"}`,
      `Output devices: ${devices.outputs.map((device) => `${device.label} [${device.deviceId}]`).join("; ") || "none"}`,
      `Warnings: ${warnings.map((warning) => `${warning.label}: ${warning.detail}`).join(" | ") || "none"}`,
    ];
    return lines.join("\n");
  }

  async restart(): Promise<void> {
    const settings = this.snapshot.settings;
    this.generation += 1;
    this.updateSnapshot({ engineState: "reconnecting", generation: this.generation });
    this.stopAllPlayback();
    this.testNodes.forEach((node) => {
      try { node.stop(); } catch { /* already stopped */ }
      node.disconnect();
    });
    this.testNodes.clear();
    this.disableMic();
    this.stopMeterLoop();
    this.detachDeviceListener();
    this.coordinator.restart();
    this.routePhysicalKeys = { monitor: null, mix: null };
    this.disconnectGraph();
    this.graph = null;
    this.buffers.clear();
    this.playRequestsPendingBuffer.clear();
    this.playClipInFlight.clear();
    this.ensureGraph();
    this.mediaElementNodes.forEach((node) => {
      try { node.gainNode.disconnect(); } catch { /* already disconnected */ }
      node.gainNode.connect(this.graph!.mediaBus);
    });
    this.attachDeviceListener();
    this.snapshot = { ...this.snapshot, settings, diagnostics: createDiagnostics() };
    await this.refreshDevices();
    await this.restoreRoutes();
    this.refreshDiagnostics(false);
    this.refreshWarnings();
  }

  private disconnectGraph(): void {
    if (!this.graph) return;
    Object.values(this.graph).forEach((node) => {
      if (node && typeof (node as AudioNode).disconnect === "function") {
        try { (node as AudioNode).disconnect(); } catch { /* already disconnected */ }
      }
    });
    Object.values(this.graph.analysers).forEach((analyser) => analyser.disconnect());
    this.mediaElementNodes.forEach((node) => {
      try { node.gainNode.disconnect(); } catch { /* already disconnected */ }
    });
  }

  stopAll(): void {
    this.stopAllPlayback();
    this.snapshot = {
      ...this.snapshot,
      settings: muteAllAudioSettings(this.snapshot.settings),
    };
    this.applySettingsToGraph();
    void this.persistSettings();
    this.refreshDiagnostics(false);
    this.updateSnapshot({ engineState: "stopped" });
  }

  private stopAllPlayback(): void {
    Array.from(this.activeNodes.keys()).forEach((url) => this.stopClip(url));
    this.sectionMusicUrl = null;
  }

  getContext(): AudioContext {
    this.ensureGraph();
    return this.context!;
  }

  getRouteBus(category: AudioRouteCategory): GainNode {
    const graph = this.ensureGraph();
    return category === "mic" ? graph.microphoneBus : graph.mediaBus;
  }

  getMonitorGain(): GainNode {
    return this.ensureGraph().monitorGain;
  }

  getCableGain(): GainNode {
    return this.ensureGraph().mixGain;
  }

  async preload(url: string): Promise<void> {
    if (this.buffers.has(url)) return;
    try {
      const response = await fetch(url);
      const decoded = await this.getContext().decodeAudioData(await response.arrayBuffer());
      this.buffers.set(url, decoded);
      this.emit();
    } catch (error) {
      this.recordError(`Failed to preload ${url}`, error);
    }
  }

  getCurrentTime(url: string): number {
    if (this.isPlaying(url)) return this.getContext().currentTime - (this.startTimes.get(url) || 0);
    return this.pauseTimes.get(url) || 0;
  }

  getDuration(url: string): number {
    return this.buffers.get(url)?.duration || 0;
  }

  seek(url: string, time: number): void {
    const wasPlaying = this.isPlaying(url);
    if (wasPlaying) this.pauseClip(url);
    this.pauseTimes.set(url, Math.max(0, time));
    this.emit();
  }

  isPlaying(url: string): boolean {
    return this.activeNodes.has(url);
  }

  private cleanupNode(url: string): void {
    const node = this.activeNodes.get(url);
    if (!node) return;
    node.source.onended = null;
    try { node.source.stop(); } catch { /* already stopped */ }
    node.source.disconnect();
    node.gainNode.disconnect();
    this.activeNodes.delete(url);
  }

  playClip(
    url: string,
    volume = 1,
    loop = false,
    fadeOptions?: { fadeEnabled: boolean },
    routeCategory: AudioRouteCategory = "unclassified",
  ): void {
    if (this.playClipInFlight.has(url)) return;
    const existing = this.activeNodes.get(url);
    if (existing) {
      existing.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.getContext().currentTime);
      return;
    }
    const buffer = this.buffers.get(url);
    if (!buffer) {
      if (this.playRequestsPendingBuffer.has(url)) return;
      this.playRequestsPendingBuffer.add(url);
      void this.preload(url).then(() => {
        this.playRequestsPendingBuffer.delete(url);
        if (this.buffers.has(url)) this.playClip(url, volume, loop, fadeOptions, routeCategory);
      });
      return;
    }

    this.playClipInFlight.add(url);
    try {
      const context = this.getContext();
      if (context.state === "suspended") void context.resume();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      const gainNode = context.createGain();
      const targetVolume = Math.max(0, Math.min(1, volume));
      gainNode.gain.value = fadeOptions?.fadeEnabled ? 0 : targetVolume;
      source.connect(gainNode);
      gainNode.connect(this.ensureGraph().mediaBus);
      const offset = this.pauseTimes.get(url) || 0;
      source.start(0, offset);
      if (fadeOptions?.fadeEnabled) {
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(targetVolume, context.currentTime + this.fadeSeconds);
      }
      this.startTimes.set(url, context.currentTime - offset);
      this.activeNodes.set(url, { source, gainNode, routeCategory });
      source.onended = () => {
        if (this.activeNodes.get(url)?.source !== source) return;
        source.disconnect();
        gainNode.disconnect();
        this.activeNodes.delete(url);
        this.pauseTimes.set(url, 0);
        this.emit();
      };
      this.emit();
    } finally {
      this.playClipInFlight.delete(url);
    }
  }

  pauseClip(url: string): void {
    if (!this.activeNodes.has(url)) return;
    this.pauseTimes.set(url, this.getContext().currentTime - (this.startTimes.get(url) || 0));
    this.cleanupNode(url);
    this.emit();
  }

  stopClip(url: string, fadeOptions?: { fadeEnabled: boolean }): void {
    const node = this.activeNodes.get(url);
    if (node && fadeOptions?.fadeEnabled) {
      const context = this.getContext();
      node.gainNode.gain.cancelScheduledValues(context.currentTime);
      node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, context.currentTime);
      node.gainNode.gain.linearRampToValueAtTime(0, context.currentTime + this.fadeSeconds);
      node.source.stop(context.currentTime + this.fadeSeconds);
      window.setTimeout(() => this.cleanupNode(url), this.fadeSeconds * 1000 + 20);
    } else {
      this.cleanupNode(url);
    }
    this.pauseTimes.set(url, 0);
    this.emit();
  }

  setVolume(url: string, volume: number): void {
    const node = this.activeNodes.get(url);
    if (!node) return;
    const context = this.getContext();
    node.gainNode.gain.cancelScheduledValues(context.currentTime);
    node.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), context.currentTime);
  }

  attachMediaElement(
    element: HTMLMediaElement,
    volume = 1,
    routeCategory: AudioRouteCategory = "unclassified",
  ): void {
    let node = this.mediaElementNodes.get(element);
    if (!node) {
      const source = this.getContext().createMediaElementSource(element);
      const gainNode = this.getContext().createGain();
      source.connect(gainNode);
      node = { source, gainNode, routeCategory };
      this.mediaElementNodes.set(element, node);
    }
    node.routeCategory = routeCategory;
    try { node.gainNode.disconnect(); } catch { /* already disconnected */ }
    node.gainNode.connect(this.ensureGraph().mediaBus);
    node.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.getContext().currentTime);
    if (this.getContext().state === "suspended") void this.getContext().resume();
  }

  setMediaElementVolume(element: HTMLMediaElement, volume: number): void {
    const node = this.mediaElementNodes.get(element);
    if (!node) return;
    node.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.getContext().currentTime);
  }

  detachMediaElement(element: HTMLMediaElement): void {
    const node = this.mediaElementNodes.get(element);
    if (!node) return;
    try { node.gainNode.disconnect(); } catch { /* already disconnected */ }
    node.gainNode.gain.setValueAtTime(0, this.getContext().currentTime);
  }

  playSectionMusic(url: string, volume = 1, fadeEnabled = false): void {
    if (this.sectionMusicUrl && this.sectionMusicUrl !== url) this.stopClip(this.sectionMusicUrl, { fadeEnabled });
    this.sectionMusicUrl = url;
    this.playClip(url, volume, true, { fadeEnabled }, "section-bgm");
  }

  stopSectionMusic(url?: string, fadeEnabled = false): void {
    const target = url ?? this.sectionMusicUrl;
    if (!target) return;
    this.stopClip(target, { fadeEnabled });
    if (target === this.sectionMusicUrl) this.sectionMusicUrl = null;
  }

  stopSlideAudio(): void {
    Array.from(this.activeNodes.keys()).forEach((url) => {
      if (url !== this.sectionMusicUrl) this.stopClip(url);
    });
  }
}

export const audioController = new AudioController();
