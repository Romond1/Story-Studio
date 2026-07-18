# Audio Engine and Interface Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair Story Studio's mix output and duplicate-playback behavior, add a diagnosable two-level audio interface, and preserve all existing episode JSON files.

**Architecture:** Introduce one renderer-owned `AudioController` that owns the Web Audio graph, microphone, transactional output routes, meters, diagnostics, and subscriptions. Preserve the existing `audioManager`, `audioRouting`, and `micInput` exports as adapters, store versioned audio preferences in Electron user data rather than episode projects, and render both audio interfaces from one `useSyncExternalStore` snapshot.

**Tech Stack:** Electron 34, React 18, TypeScript 5.7, Web Audio API, MediaDevices API, Node test runner, Vite, electron-builder.

---

## Execution Safety

The checkout already contains unrelated uncommitted Movement work in `src/main/main.ts`, `src/renderer/App.tsx`, `src/shared/types.ts`, `tsconfig.test.json`, `assets/`, `src/renderer/movement/`, and `src/shared/movement*`. Do not reset, discard, reformat, or overwrite those changes. Inspect the current diff before every `App.tsx`, `main.ts`, `types.ts`, or `tsconfig.test.json` edit, make narrow patches, and stage only the task's explicit paths.

Use the current checkout rather than a clean worktree because the audio integration must compile against the user's in-progress Movement changes. The design-only commit is `95f427f`.

## File Map

- Create `src/shared/audioSettings.ts`: versioned app-level audio preferences and normalization.
- Create `src/shared/audioSettings.test.ts`: legacy, malformed, and round-trip settings tests.
- Create `src/shared/audioLifecycle.ts`: pure transactional route and generation coordinator.
- Create `src/shared/audioLifecycle.test.ts`: replacement, rollback, restart, and duplicate-count tests.
- Modify `src/shared/audioRoutingPlan.ts`: explicit broadcast and monitor routing rules.
- Modify `src/shared/audioRoutingPlan.test.ts`: microphone broadcast and optional-monitor tests.
- Modify `src/shared/types.ts`: export the app-settings envelope without changing `ProjectData` audio schema.
- Modify `src/main/main.ts`: merge-safe atomic settings persistence and audio IPC.
- Modify `src/main/preload.ts`: expose typed audio settings IPC.
- Modify `src/renderer/vite-env.d.ts`: type the new preload API.
- Create `src/renderer/audio/AudioController.ts`: single owner of context, buses, sinks, microphone, meters, diagnostics, and lifecycle.
- Delete `src/renderer/audio/AudioEngine.ts`: unused direct `HTMLAudioElement` playback path that bypasses the central graph.
- Modify `src/renderer/audio/AudioManager.ts`: compatibility adapter for existing media playback calls.
- Modify `src/renderer/audio/AudioRouting.ts`: compatibility adapter for device enumeration/selection.
- Modify `src/renderer/audio/MicrophoneInput.ts`: compatibility adapter for microphone enablement.
- Create `src/renderer/audio/useAudioController.ts`: React subscription hook and settings persistence bootstrap.
- Create `src/renderer/audio/AudioMeter.tsx`: reusable accessible peak/RMS meter.
- Create `src/renderer/audio/AudioStatus.tsx`: consistent state dot, badge, and warning summary.
- Create `src/renderer/audio/AudioSettingsWorkspace.tsx`: full modal workspace.
- Create `src/renderer/audio/CompactAudioPanel.tsx`: configurable stage panel.
- Create `src/renderer/audio/audio.css`: toolbar, modal, mixer, meter, warning, and compact-panel styles.
- Modify `src/renderer/App.tsx`: toolbar entry, modal mounting, compact-panel replacement, and removal of local audio state.
- Modify `src/renderer/main.tsx`: import audio styles.
- Modify `tsconfig.test.json`: compile the new shared tests.
- Modify `package.json`: add complete shared-test and release-check scripts.
- Create `docs/AUDIO-TROUBLESHOOTING.md`: headphones, VB-Cable, Zoom, restart, and diagnostics checklist.
- Create `docs/manual-audio-release-checklist.md`: five-episode and hardware acceptance matrix.

### Task 1: Versioned Audio Settings Without Episode Schema Changes

**Files:**
- Create: `src/shared/audioSettings.ts`
- Create: `src/shared/audioSettings.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Write failing normalization tests**

```ts
// src/shared/audioSettings.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AUDIO_SETTINGS,
  normalizeAudioSettings,
} from "./audioSettings";

test("missing audio settings use safe defaults without project migration", () => {
  assert.deepEqual(normalizeAudioSettings(undefined), DEFAULT_AUDIO_SETTINGS);
  assert.equal(normalizeAudioSettings(undefined).microphoneMonitorEnabled, false);
});

test("saved stable device ids and stage controls survive normalization", () => {
  const settings = normalizeAudioSettings({
    version: 1,
    devices: {
      microphone: { deviceId: "mic-1", label: "Teacher Mic" },
      monitor: { deviceId: "headphones-1", label: "Headphones" },
      mix: { deviceId: "cable-1", label: "CABLE Input" },
    },
    volumes: { microphone: 0.8, media: 0.7, master: 0.9, monitor: 0.6, mix: 1 },
    muted: { microphone: false, media: false, master: false, monitor: false, mix: false },
    monitoringEnabled: true,
    microphoneMonitorEnabled: false,
    stageControls: ["microphone-volume", "microphone-mute", "master-meter"],
  });
  assert.equal(settings.devices.mix.deviceId, "cable-1");
  assert.deepEqual(settings.stageControls, ["microphone-volume", "microphone-mute", "master-meter"]);
});

test("malformed values clamp and unknown controls are removed", () => {
  const settings = normalizeAudioSettings({
    version: 99,
    volumes: { microphone: 8, media: -2, master: Number.NaN },
    stageControls: ["microphone-mute", "not-a-control", "microphone-mute"],
  });
  assert.equal(settings.volumes.microphone, 1);
  assert.equal(settings.volumes.media, 0);
  assert.equal(settings.volumes.master, 1);
  assert.deepEqual(settings.stageControls, ["microphone-mute"]);
});
```

- [ ] **Step 2: Add the test files to the test compiler and verify RED**

Add these entries to `tsconfig.test.json`:

```json
"src/shared/audioSettings.ts",
"src/shared/audioSettings.test.ts"
```

Run: `npx tsc -p tsconfig.test.json`

Expected: FAIL because `src/shared/audioSettings.ts` does not exist.

- [ ] **Step 3: Implement the settings model**

```ts
// src/shared/audioSettings.ts
export const AUDIO_STAGE_CONTROLS = [
  "microphone-volume", "microphone-mute", "media-volume", "media-mute",
  "master-volume", "master-mute", "monitor-volume", "monitor-mute",
  "mix-volume", "mix-mute", "microphone-meter", "media-meter",
  "master-meter", "monitor-meter", "mix-meter", "stop-all",
  "test-microphone", "reconnect-devices",
] as const;

export type AudioStageControl = (typeof AUDIO_STAGE_CONTROLS)[number];
export type AudioBusName = "microphone" | "media" | "master" | "monitor" | "mix";
export type SavedAudioDevice = { deviceId: string; label: string };
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
    "microphone-volume", "microphone-mute", "monitor-volume", "monitor-mute",
    "microphone-meter", "master-meter", "stop-all",
  ],
};

const clamp = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export function normalizeAudioSettings(value: unknown): AudioSettingsV1 {
  const raw = value && typeof value === "object" ? value as Partial<AudioSettingsV1> : {};
  const devices = raw.devices && typeof raw.devices === "object" ? raw.devices : {} as AudioSettingsV1["devices"];
  const volumes = raw.volumes && typeof raw.volumes === "object" ? raw.volumes : {} as AudioSettingsV1["volumes"];
  const muted = raw.muted && typeof raw.muted === "object" ? raw.muted : {} as AudioSettingsV1["muted"];
  const normalizeDevice = (key: "microphone" | "monitor" | "mix") => ({
    deviceId: typeof devices[key]?.deviceId === "string" && devices[key].deviceId ? devices[key].deviceId : DEFAULT_AUDIO_SETTINGS.devices[key].deviceId,
    label: typeof devices[key]?.label === "string" && devices[key].label ? devices[key].label : DEFAULT_AUDIO_SETTINGS.devices[key].label,
  });
  const stageControls = Array.from(new Set(Array.isArray(raw.stageControls) ? raw.stageControls : DEFAULT_AUDIO_SETTINGS.stageControls))
    .filter((item): item is AudioStageControl => AUDIO_STAGE_CONTROLS.includes(item as AudioStageControl));
  return {
    version: 1,
    devices: { microphone: normalizeDevice("microphone"), monitor: normalizeDevice("monitor"), mix: normalizeDevice("mix") },
    volumes: {
      microphone: clamp(volumes.microphone, 1), media: clamp(volumes.media, 1), master: clamp(volumes.master, 1),
      monitor: clamp(volumes.monitor, 1), mix: clamp(volumes.mix, 1),
    },
    muted: {
      microphone: Boolean(muted.microphone), media: Boolean(muted.media), master: Boolean(muted.master),
      monitor: Boolean(muted.monitor), mix: Boolean(muted.mix),
    },
    monitoringEnabled: raw.monitoringEnabled !== false,
    microphoneMonitorEnabled: raw.microphoneMonitorEnabled === true,
    stageControls,
  };
}
```

Add to `src/shared/types.ts` without adding fields to `ProjectData`:

```ts
import type { AudioSettingsV1 } from "./audioSettings";

export interface StoryStudioSettings {
  version: 1;
  studentRoster: StudentRosterEntry[];
  audio: AudioSettingsV1;
}
```

- [ ] **Step 4: Verify GREEN**

Run: `npx tsc -p tsconfig.test.json && node --test dist-test/shared/audioSettings.test.js`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit only settings files**

```powershell
git add src/shared/audioSettings.ts src/shared/audioSettings.test.ts src/shared/types.ts tsconfig.test.json
git commit -m "feat: add versioned audio settings"
```

### Task 2: Merge-Safe Electron Settings Persistence

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/vite-env.d.ts`

- [ ] **Step 1: Refactor the existing settings reader to normalize one envelope**

In `src/main/main.ts`, import `StoryStudioSettings`, `AudioSettingsV1`, `normalizeAudioSettings`, and retain `normalizeStudentRosterSettings`. Replace roster-only file reads/writes with:

```ts
async function readStoryStudioSettings(): Promise<StoryStudioSettings> {
  try {
    const raw = JSON.parse(await fs.readFile(settingsPath(), "utf8"));
    return {
      version: 1,
      studentRoster: normalizeStudentRosterSettings(raw).studentRoster,
      audio: normalizeAudioSettings(raw?.audio),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") console.warn("[settings] Read failed:", error);
    return { version: 1, studentRoster: [], audio: normalizeAudioSettings(undefined) };
  }
}

async function writeStoryStudioSettings(settings: StoryStudioSettings): Promise<StoryStudioSettings> {
  const normalized: StoryStudioSettings = {
    version: 1,
    studentRoster: normalizeStudentRosterSettings({ version: 1, studentRoster: settings.studentRoster }).studentRoster,
    audio: normalizeAudioSettings(settings.audio),
  };
  const targetPath = settingsPath();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(`${targetPath}.tmp`, JSON.stringify(normalized, null, 2), "utf8");
  await fs.rename(`${targetPath}.tmp`, targetPath);
  return normalized;
}
```

- [ ] **Step 2: Make roster and audio saves preserve each other**

```ts
ipcMain.handle("settings:get-student-roster", async (): Promise<StudentRosterSettings> => {
  const settings = await readStoryStudioSettings();
  return { version: 1, studentRoster: settings.studentRoster };
});

ipcMain.handle("settings:save-student-roster", async (_, roster: StudentRosterSettings): Promise<StudentRosterSettings> => {
  const current = await readStoryStudioSettings();
  const saved = await writeStoryStudioSettings({ ...current, studentRoster: normalizeStudentRosterSettings(roster).studentRoster });
  return { version: 1, studentRoster: saved.studentRoster };
});

ipcMain.handle("settings:get-audio", async (): Promise<AudioSettingsV1> => {
  return (await readStoryStudioSettings()).audio;
});

ipcMain.handle("settings:save-audio", async (_, audio: AudioSettingsV1): Promise<AudioSettingsV1> => {
  const current = await readStoryStudioSettings();
  return (await writeStoryStudioSettings({ ...current, audio: normalizeAudioSettings(audio) })).audio;
});
```

- [ ] **Step 3: Expose typed IPC through preload**

Add to `src/main/preload.ts` and mirror the signatures in `src/renderer/vite-env.d.ts`:

```ts
getAudioSettings: (): Promise<AudioSettingsV1> => ipcRenderer.invoke("settings:get-audio"),
saveAudioSettings: (settings: AudioSettingsV1): Promise<AudioSettingsV1> => ipcRenderer.invoke("settings:save-audio", settings),
```

- [ ] **Step 4: Compile both processes**

Run: `npm run build:main && npm run build:renderer`

Expected: both commands exit 0.

- [ ] **Step 5: Commit the persistence slice**

```powershell
git add src/main/main.ts src/main/preload.ts src/renderer/vite-env.d.ts
git commit -m "feat: persist audio settings outside episodes"
```

### Task 3: Pure Routing and Transactional Lifecycle Models

**Files:**
- Modify: `src/shared/audioRoutingPlan.ts`
- Modify: `src/shared/audioRoutingPlan.test.ts`
- Create: `src/shared/audioLifecycle.ts`
- Create: `src/shared/audioLifecycle.test.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Replace the obsolete microphone cable-only assertion with the approved matrix**

```ts
test("broadcast contains mic and media while monitor mic is opt-in", () => {
  assert.deepEqual(getAudioRouteTargets("dialogue", false), ["broadcast", "monitor"]);
  assert.deepEqual(getAudioRouteTargets("mic", false), ["broadcast"]);
  assert.deepEqual(getAudioRouteTargets("mic", true), ["broadcast", "monitor"]);
});
```

Run: `npx tsc -p tsconfig.test.json && node --test dist-test/shared/audioRoutingPlan.test.js`

Expected: FAIL because the current target names and signature are cable/monitor without the monitor-mic flag.

- [ ] **Step 2: Implement the explicit route function**

```ts
export type AudioRouteTarget = "broadcast" | "monitor";

export function getAudioRouteTargets(category: AudioRouteCategory, microphoneMonitorEnabled = false): AudioRouteTarget[] {
  if (category === "mic") return microphoneMonitorEnabled ? ["broadcast", "monitor"] : ["broadcast"];
  return ["broadcast", "monitor"];
}
```

- [ ] **Step 3: Write lifecycle tests before the coordinator**

```ts
// src/shared/audioLifecycle.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AudioRouteCoordinator, type RouteHandle } from "./audioLifecycle";

const handle = (id: string, active = true): RouteHandle => ({ id, active, disposeCalls: 0, dispose() { this.disposeCalls += 1; } });

test("successful replacement disposes the old route once", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  const nextRoute = handle("next");
  coordinator.seed("mix", oldRoute);
  await coordinator.replace("mix", async () => nextRoute);
  assert.equal(coordinator.get("mix"), nextRoute);
  assert.equal(oldRoute.disposeCalls, 1);
});

test("failed replacement retains the old route", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  coordinator.seed("mix", oldRoute);
  await assert.rejects(coordinator.replace("mix", async () => { throw new Error("sink failed"); }));
  assert.equal(coordinator.get("mix"), oldRoute);
  assert.equal(oldRoute.disposeCalls, 0);
});

test("restart invalidates stale replacements and disposes every live route once", async () => {
  const coordinator = new AudioRouteCoordinator();
  const oldRoute = handle("old");
  const staleRoute = handle("stale");
  coordinator.seed("mix", oldRoute);
  const pending = coordinator.replace("mix", async () => staleRoute);
  coordinator.restart();
  await pending;
  assert.equal(coordinator.get("mix"), undefined);
  assert.equal(oldRoute.disposeCalls, 1);
  assert.equal(staleRoute.disposeCalls, 1);
});
```

- [ ] **Step 4: Implement the coordinator**

```ts
// src/shared/audioLifecycle.ts
export type AudioOutputRoute = "monitor" | "mix";
export interface RouteHandle { id: string; active: boolean; disposeCalls: number; dispose(): void; }

export class AudioRouteCoordinator {
  private generation = 0;
  private routes = new Map<AudioOutputRoute, RouteHandle>();
  get(route: AudioOutputRoute) { return this.routes.get(route); }
  seed(route: AudioOutputRoute, handle: RouteHandle) { this.routes.set(route, handle); }
  async replace(route: AudioOutputRoute, create: () => Promise<RouteHandle>) {
    const generation = this.generation;
    const previous = this.routes.get(route);
    const candidate = await create();
    if (generation !== this.generation) { candidate.dispose(); return; }
    if (!candidate.active) { candidate.dispose(); throw new Error(`${route} route did not become active`); }
    this.routes.set(route, candidate);
    previous?.dispose();
  }
  restart() {
    this.generation += 1;
    this.routes.forEach((route) => route.dispose());
    this.routes.clear();
  }
  getGeneration() { return this.generation; }
  getActiveRouteCount() { return this.routes.size; }
}
```

Add both lifecycle files to `tsconfig.test.json`.

- [ ] **Step 5: Verify routing and lifecycle GREEN**

Run: `npx tsc -p tsconfig.test.json && node --test dist-test/shared/audioRoutingPlan.test.js dist-test/shared/audioLifecycle.test.js`

Expected: all routing and lifecycle tests pass.

- [ ] **Step 6: Commit the routing foundation**

```powershell
git add src/shared/audioRoutingPlan.ts src/shared/audioRoutingPlan.test.ts src/shared/audioLifecycle.ts src/shared/audioLifecycle.test.ts tsconfig.test.json
git commit -m "fix: define single audio routing lifecycle"
```

### Task 4: Central Audio Controller and Compatibility Adapters

**Files:**
- Create: `src/renderer/audio/AudioController.ts`
- Delete: `src/renderer/audio/AudioEngine.ts`
- Modify: `src/renderer/audio/AudioManager.ts`
- Modify: `src/renderer/audio/AudioRouting.ts`
- Modify: `src/renderer/audio/MicrophoneInput.ts`

- [ ] **Step 1: Define the controller snapshot and warning contract**

Create exported types in `AudioController.ts`:

```ts
export type AudioEngineState = "stopped" | "starting" | "active" | "muted" | "warning" | "error" | "reconnecting";
export type AudioMeterReading = { peak: number; rms: number; flowing: boolean };
export type AudioDeviceState = SavedAudioDevice & {
  kind: "audioinput" | "audiooutput"; connected: boolean; active: boolean; flowing: boolean;
  sampleRate: number | null; channelCount: number | null;
};
export type AudioWarning = { id: string; severity: "warning" | "error"; label: string; detail: string };
export type AudioSnapshot = {
  engineState: AudioEngineState; generation: number; settings: AudioSettingsV1;
  devices: { inputs: AudioDeviceState[]; outputs: AudioDeviceState[] };
  meters: Record<AudioBusName, AudioMeterReading>;
  warnings: AudioWarning[];
  diagnostics: {
    activeStreamCount: number; activeCallbackCount: number; activeListenerCount: number;
    underruns: number; overruns: number; droppedBuffers: number; lastStreamError: string | null;
    lastReconnectAttempt: string | null; sampleRate: number | null; bufferSize: number | null;
  };
};
```

- [ ] **Step 2: Build one graph with separate broadcast and monitor mixes**

The constructor must be side-effect free. `initialize(settings)` creates exactly these connections:

```ts
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
```

Set `microphoneMonitorGain.gain.value` to `0` unless `microphoneMonitorEnabled` is true. Do not connect any source, bus, or output twice.

- [ ] **Step 3: Implement transactional sink creation**

```ts
private async createSink(route: "monitor" | "mix", deviceId: string): Promise<RouteHandle> {
  const audio = new Audio();
  audio.autoplay = true;
  audio.srcObject = route === "mix" ? this.mixDestination.stream : this.monitorDestination.stream;
  await audio.setSinkId(deviceId === "default" ? "" : deviceId);
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
```

`selectOutput(route, device)` must call `AudioRouteCoordinator.replace`, publish reconnecting state during the operation, preserve the previous route on error, and update persisted settings only after success.

- [ ] **Step 4: Add microphone replacement and mute/volume commands**

`selectMicrophone` obtains a candidate stream with `{ deviceId: { exact } }`, creates its source, validates that the track is live, then stops/disconnects the old microphone. `setVolume`, `setMuted`, `setMonitoringEnabled`, and `setMicrophoneMonitorEnabled` update the corresponding gain values and publish one new snapshot.

Use this gain rule everywhere:

```ts
private applyGain(node: GainNode, volume: number, muted: boolean) {
  node.gain.cancelScheduledValues(this.context.currentTime);
  node.gain.setValueAtTime(muted ? 0 : Math.max(0, Math.min(1, volume)), this.context.currentTime);
}
```

- [ ] **Step 5: Preserve playback APIs**

Move existing buffer, pause, seek, fade, section-music, and media-element behavior behind controller methods with their current signatures. Change only the final destination from category route buses to `mediaBus`; microphone uses `microphoneBus`.

`AudioManager.ts` becomes a thin export adapter:

```ts
import { audioController } from "./AudioController";
export const audioManager = audioController;
export type { SoundHandle } from "./AudioController";
```

`AudioRouting.ts` delegates `listDevices`, `setDevice`, and `setMonitorDevice` to the controller. `MicrophoneInput.ts` delegates `enableMic`, `disableMic`, and `isEnabled` to the controller. Keep method names so `App.tsx` and existing players compile throughout the transition.

Delete the unused `AudioEngine.ts` after `rg -n "AudioEngine|audioEngine" src` confirms that no production file imports it. This removes a direct `new Audio()` path that could otherwise bypass routing and diagnostics.

- [ ] **Step 6: Implement deterministic restart and disposal**

`restart()` must advance generation, stop playback, stop microphone tracks, cancel the meter animation frame, remove `devicechange`, dispose both sinks through the coordinator, disconnect every node, close the context, rebuild once, restore settings, and assert singleton counts in the published diagnostics.

- [ ] **Step 7: Compile and inspect the graph**

Run: `npm run build:renderer`

Expected: exit 0 with no missing legacy audio methods.

Run: `rg -n "new AudioContext|createMediaStreamDestination|addEventListener\(.*devicechange" src/renderer/audio`

Expected: creation occurs only in `AudioController.ts`; adapters contain no graph ownership.

- [ ] **Step 8: Commit the controller slice**

```powershell
git add src/renderer/audio/AudioController.ts src/renderer/audio/AudioEngine.ts src/renderer/audio/AudioManager.ts src/renderer/audio/AudioRouting.ts src/renderer/audio/MicrophoneInput.ts
git commit -m "fix: centralize audio graph and output replacement"
```

### Task 5: Meters, Warnings, Diagnostics, and Recovery Commands

**Files:**
- Modify: `src/renderer/audio/AudioController.ts`
- Create: `src/renderer/audio/AudioMeter.tsx`
- Create: `src/renderer/audio/AudioStatus.tsx`

- [ ] **Step 1: Add analyser sampling without playback connections**

Create one analyser per microphone, media, master, monitor, and mix stage. Connect each analyser as an observation branch and sample into a reusable `Float32Array`. Compute peak and RMS:

```ts
function readMeter(analyser: AnalyserNode, samples: Float32Array): AudioMeterReading {
  analyser.getFloatTimeDomainData(samples);
  let squareSum = 0;
  let peak = 0;
  for (const sample of samples) { const absolute = Math.abs(sample); peak = Math.max(peak, absolute); squareSum += sample * sample; }
  const rms = Math.sqrt(squareSum / samples.length);
  return { peak, rms, flowing: peak > 0.0005 || rms > 0.0002 };
}
```

Use one animation-frame loop per engine generation and expose `activeCallbackCount` as exactly one while running.

- [ ] **Step 2: Derive warnings from measured state**

Add warning derivation for missing selected devices, initialization errors, master-flowing/mix-silent, duplicate stream/callback/listener counts, same resolved physical output, clipping above `0.98`, underruns, mismatches, and restart-required state. Every warning contains a plain-language label and next action.

- [ ] **Step 3: Implement test and recovery commands**

Implement `testMicrophone`, `sendTestTone("monitor" | "mix")`, `playGeneratedChime()`, `reconnectMissingDevices`, `stopAll`, `restart`, and `copyDiagnosticsText`. Test oscillators must connect to exactly one target bus, stop on a timer, disconnect on end, and be registered for restart cleanup. `playGeneratedChime()` connects only to the media bus so Movement's fallback sound follows the same master, monitor, meters, and output routes.

- [ ] **Step 4: Implement reusable status and meter components**

`AudioMeter.tsx` renders peak and RMS bars with numeric dB labels and `aria-label`. `AudioStatus.tsx` maps engine states to one non-animated status dot, allowing only subtle warning/error pulse styling.

- [ ] **Step 5: Compile and commit**

Run: `npm run build:renderer`

Expected: exit 0.

```powershell
git add src/renderer/audio/AudioController.ts src/renderer/audio/AudioMeter.tsx src/renderer/audio/AudioStatus.tsx
git commit -m "feat: add audio meters diagnostics and recovery"
```

### Task 6: React Subscription and Full Audio Workspace

**Files:**
- Create: `src/renderer/audio/useAudioController.ts`
- Create: `src/renderer/audio/AudioSettingsWorkspace.tsx`
- Create: `src/renderer/audio/audio.css`
- Modify: `src/renderer/main.tsx`

- [ ] **Step 1: Add one React subscription hook**

```ts
// src/renderer/audio/useAudioController.ts
import { useEffect, useSyncExternalStore } from "react";
import { audioController } from "./AudioController";

export function useAudioController() {
  const snapshot = useSyncExternalStore(audioController.subscribe, audioController.getSnapshot, audioController.getSnapshot);
  useEffect(() => { void audioController.initializeFromAppSettings(window.appApi); }, []);
  return { snapshot, controller: audioController };
}
```

Make `initializeFromAppSettings` idempotent so React Strict Mode cannot create a second engine.

- [ ] **Step 2: Build the modal workspace from the approved sections**

`AudioSettingsWorkspace` accepts `open` and `onClose`, returns `null` when closed, closes on Escape/backdrop, traps focus inside the modal, and renders Routing, Mixer, Live Meters, Testing and Recovery, Warnings, collapsible Diagnostics, and Stage Panel Controls. Testing and Recovery includes a **Copy Audio Diagnostics** button that calls `copyDiagnosticsText()` and writes the labeled report with `navigator.clipboard.writeText`.

Each control calls a controller command; no component holds a duplicate value state. Device options show label, missing/connected state, sample rate, channel count, active state, and flow state.

- [ ] **Step 3: Add configurable stage-control toggles**

Render every `AUDIO_STAGE_CONTROLS` entry with a checkbox. Toggle commands update `settings.stageControls` and call debounced `window.appApi.saveAudioSettings`. Status and Open Audio Settings are not in the configurable list.

- [ ] **Step 4: Style the workspace natively**

Use `.audio-settings-backdrop`, `.audio-settings-workspace`, `.audio-settings-grid`, `.audio-routing-card`, `.audio-meter`, `.audio-warning`, and `.audio-diagnostics` classes in `audio.css`. Match existing dark backgrounds, orange headings, six-pixel controls, and restrained status animation. At widths below 900px, collapse the grid to one column.

Import the stylesheet in `src/renderer/main.tsx`:

```ts
import "./audio/audio.css";
```

- [ ] **Step 5: Compile and commit**

Run: `npm run build:renderer`

Expected: exit 0.

```powershell
git add src/renderer/audio/useAudioController.ts src/renderer/audio/AudioSettingsWorkspace.tsx src/renderer/audio/audio.css src/renderer/main.tsx
git commit -m "feat: add full audio settings workspace"
```

### Task 7: Configurable Compact Stage Panel and App Integration

**Files:**
- Create: `src/renderer/audio/CompactAudioPanel.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Implement the compact panel as a pure state view**

`CompactAudioPanel` uses `useAudioController`, always renders `AudioStatus` and Open Audio Settings, then maps `snapshot.settings.stageControls` to microphone/media/master/monitor/mix sliders, mute buttons, meters, Stop All, Test Microphone, or Reconnect Missing Devices. Use stable control keys and no independent audio state.

- [ ] **Step 2: Add the toolbar Audio button beside Edit/Teach**

Add only modal visibility state to `App.tsx`:

```ts
const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
```

Render the button immediately before the Edit/Teach button:

```tsx
<button className="audio-toolbar-button" onClick={() => setAudioSettingsOpen(true)}>
  <span aria-hidden="true">♪</span><span>Audio</span><AudioStatus compact />
</button>
```

Mount `<AudioSettingsWorkspace open={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} />` at app-shell level, outside the story stage and sidebars.

- [ ] **Step 3: Replace the old Audio Routing block**

Delete local state `routingCollapsed`, `audioInputDevices`, `audioOutputDevices`, `selectedAudioOutput`, `selectedMonitorOutput`, `selectedAudioInput`, and `micEnabled`; delete their enumeration effect and handlers. Remove the old Mix Output Device, Monitor Device, Microphone Input selectors, and its Stop All button. Render:

```tsx
<CompactAudioPanel onOpenSettings={() => setAudioSettingsOpen(true)} />
```

Keep unrelated story, section-music, Movement, badges, boards, and relic markup unchanged.

The current uncommitted Movement feature contains a fallback `new AudioContext()` chime in `playMovementJingle`. Replace only that fallback oscillator block with `audioController.playGeneratedChime()` so it cannot bypass the central audio graph. Preserve Movement configuration, imported jingle playback, timing, visuals, and hotkeys.

- [ ] **Step 4: Verify there is one UI state source**

Run: `rg -n "selectedAudioOutput|selectedMonitorOutput|selectedAudioInput|micEnabled|Audio Routing" src/renderer/App.tsx`

Expected: no matches.

Run: `npm run build:renderer`

Expected: exit 0.

- [ ] **Step 5: Commit only integration files**

```powershell
git add src/renderer/audio/CompactAudioPanel.tsx src/renderer/App.tsx
git commit -m "feat: integrate configurable audio controls"
```

### Task 8: Regression Scripts and Backward-Compatibility Fixtures

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.test.json`
- Create: `src/shared/audioCompatibility.test.ts`

- [ ] **Step 1: Add a legacy project regression fixture in code**

Write a test that constructs a minimal historical `ProjectData` containing image/video slides, dialogue, SFX, slide BGM, and section BGM but no audio-settings field. Pass it through the existing project normalization helpers and assert that the serialized input is unchanged by audio-settings normalization and legacy video audio remains enabled at volume 1.

- [ ] **Step 2: Add complete test scripts**

```json
"test": "npx tsc -p tsconfig.test.json && node --test dist-test/shared/*.test.js",
"check:audio": "npm test && npm run build:renderer && npm run build:main",
"check:release": "npm run check:audio"
```

- [ ] **Step 3: Run the full automated gate**

Run: `npm run check:release`

Expected: all Node tests pass and both TypeScript/Vite builds exit 0.

- [ ] **Step 4: Commit tests and scripts**

```powershell
git add package.json package-lock.json tsconfig.test.json src/shared/audioCompatibility.test.ts
git commit -m "test: protect legacy episodes and audio release"
```

### Task 9: Troubleshooting Documentation and Hardware Acceptance

**Files:**
- Create: `docs/AUDIO-TROUBLESHOOTING.md`
- Create: `docs/manual-audio-release-checklist.md`

- [ ] **Step 1: Document the exact normal lesson setup**

The troubleshooting guide must state:

```text
Story Studio Microphone Input: teacher microphone
Story Studio Monitor Output: headphones
Story Studio Mix/Virtual Output: CABLE Input (VB-Audio Virtual Cable)
Zoom Microphone: CABLE Output (VB-Audio Virtual Cable)
Microphone Monitoring: Off
```

Explain meter diagnosis: microphone moving/master silent is mixer failure; master moving/mix silent is Story Studio output failure; mix moving/Zoom silent is Windows/VB-Cable/Zoom configuration.

- [ ] **Step 2: Add the Monday manual matrix**

Create checkboxes for headphones-monitor media-only, headphones-as-mix test, VB-Cable plus Zoom, 10 repeated route switches, 5 repeated engine restarts, mute synchronization, stage-control persistence, missing-device recovery, and packaged-app relaunch.

List each of the five episode paths or names when supplied by the user and record pass/fail without modifying their source JSON.

- [ ] **Step 3: Run packaged build**

Run: `npm run build`

Expected: renderer build, main build, and electron-builder exit 0 and produce a Windows artifact in `release/`.

- [ ] **Step 4: Perform the hardware matrix**

Launch the packaged build and complete every checkbox in `docs/manual-audio-release-checklist.md`. Copy diagnostics after the VB-Cable/Zoom test and confirm active mix and monitor stream counts are each exactly one and callback/listener counts do not grow after restarts.

Expected: all checks pass. If a hardware check fails, stop release work, capture diagnostics and exact reproduction steps, and return to systematic debugging before changing code.

- [ ] **Step 5: Commit the runbook and recorded results**

```powershell
git add docs/AUDIO-TROUBLESHOOTING.md docs/manual-audio-release-checklist.md
git commit -m "docs: add audio routing release runbook"
```

### Task 10: Final Regression and Compatibility Audit

**Files:**
- Review: all files listed in this plan
- Review: the user's five episode `project.json` files

- [ ] **Step 1: Re-read the approved design and map every requirement**

Run: `rg -n "^##|^###" docs/superpowers/specs/2026-07-18-audio-engine-and-interface-redesign.md`

Expected: every design section maps to Tasks 1-9 with no omitted control, warning, persistence rule, or test.

- [ ] **Step 2: Verify episode files were not changed**

Discover the episode files under the user's AI workspace, confirm the five intended episode paths with the user, record SHA-256 hashes, open and exercise each episode, close without saving, then hash the same confirmed files again.

```powershell
$episodeCandidates = Get-ChildItem -LiteralPath 'D:\AI' -Recurse -File -Filter 'project.json' | Select-Object -ExpandProperty FullName
$episodeCandidates
$confirmedEpisodeFiles = 1..5 | ForEach-Object { Read-Host "Paste confirmed episode $_ project.json path" }
$beforeHashes = $confirmedEpisodeFiles | ForEach-Object { Get-FileHash -Algorithm SHA256 -LiteralPath $_ }
$beforeHashes | Format-Table Path,Hash
```

After exercising the episodes without saving, run:

```powershell
$afterHashes = $confirmedEpisodeFiles | ForEach-Object { Get-FileHash -Algorithm SHA256 -LiteralPath $_ }
Compare-Object ($beforeHashes | Select-Object Path,Hash) ($afterHashes | Select-Object Path,Hash)
```

Expected: exactly five files are hashed and `Compare-Object` prints no differences.

- [ ] **Step 3: Run fresh final verification**

Run: `npm run check:release`

Expected: all tests pass, renderer build exits 0, and main build exits 0.

Run: `npm run build`

Expected: electron-builder exits 0 and refreshes the Windows artifact.

- [ ] **Step 4: Inspect ownership and duplicate paths**

Run: `rg -n "new AudioContext|createMediaStreamDestination|new Audio\(" src/renderer`

Expected: the production routing graph and sink elements are owned only by `AudioController.ts`; any deliberate one-shot fallback sound is documented and does not bypass the controller.

- [ ] **Step 5: Inspect the final diff without disturbing user work**

Run: `git status --short && git diff --check && git log --oneline -12`

Expected: no whitespace errors; unrelated Movement changes remain present and uncommitted unless the user separately committed them; audio commits contain only intended files.

- [ ] **Step 6: Report the release evidence**

Report the toolbar location, full-workspace component, selected compact controls, shared-state mechanism, settings file behavior, removed sidebar controls, automated counts, packaged artifact, five episode hash results, and exact headphones/VB-Cable/Zoom test outcome. Do not claim the audio defect fixed until the physical hardware matrix passes.
