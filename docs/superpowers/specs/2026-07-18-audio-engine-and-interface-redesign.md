# Story Studio Audio Engine and Interface Redesign

**Date:** 2026-07-18

**Status:** Approved for implementation

## Objective

Repair Story Studio's audio routing for the Monday release, eliminate doubled or wavy playback paths, and add a two-level audio interface without breaking the user's five existing episode projects.

Success means that Zoom receives one mix containing the teacher microphone and lesson audio, headphones play lesson audio without the teacher microphone by default, output failures are diagnosable, and existing `project.json` files remain valid and do not require audio-schema migration.

## Current-State Findings

The current renderer constructs one Web Audio graph in `AudioManager`, routes its mix and monitor destinations through two `HTMLAudioElement` sinks in `AudioRouting`, and manages the microphone separately in `MicrophoneInput`. Device selections and microphone enablement live as React state in `App.tsx` and are not persisted.

The current routing table explicitly sends the microphone to the cable branch only, while media categories reach both cable and monitor. This explains why lesson audio reaches a device selected as Monitor Output while the microphone does not. The separate Mix Output failure cannot be isolated from the UI because sink playback failures are logged or swallowed and the app exposes no stream-flow, callback-count, or output-state diagnostics.

The existing code contains prior protections against duplicate `AudioBufferSourceNode` playback, but it does not provide a single auditable lifecycle for every stream, sink, callback, and listener. It also compares sink identifiers without resolving whether `default` and a concrete device identifier represent the same physical output, leaving a credible path for delayed duplicate playback when both routes reach one device.

The production build and the existing 56 automated tests pass before audio work begins. Those tests do not exercise the live Web Audio graph or physical device routing.

## Chosen Approach

Replace the routing core while preserving existing playback-facing APIs. A central `AudioController` will own the audio context, buses, device routes, settings, diagnostics, meters, and subscriptions. The existing `audioManager`, `audioRouting`, and `micInput` exports will remain available as compatibility adapters during the transition so current episode playback code does not need a broad rewrite.

This approach is preferred over a narrow patch because Monday troubleshooting requires trustworthy state and diagnostics. A native Node audio backend is out of scope because native dependencies and packaging changes create unnecessary release risk.

## Audio Architecture

### Ownership

Only `AudioController` may create or dispose the main `AudioContext`, media streams, sink elements, source nodes, analysers, device listeners, or engine callbacks. UI components issue commands and subscribe to immutable state snapshots; they never create audio routes.

The controller exposes one engine generation identifier. Every asynchronous device or stream operation captures its generation and must discard its result if a restart has advanced the generation. This prevents stale callbacks from reconnecting disposed routes.

### Signal flow

Each lesson source enters a media bus exactly once. The microphone source enters a microphone bus exactly once.

The broadcast master mix receives both buses:

`media source -> media bus -> broadcast master -> mix output`

`microphone source -> microphone bus -> broadcast master -> mix output`

The headphone monitor is an independent audition mix so it can exclude the teacher's voice:

`media bus -> monitor mix -> monitor output`

`microphone bus -> microphone-monitor gain -> monitor mix -> monitor output`

Microphone monitoring defaults to off. Enabling it is an explicit testing action and displays a feedback/self-echo warning. This deliberate independent monitor tap supersedes the initial request for an identical master fan-out because the user cannot teach while hearing their delayed microphone.

Media, microphone, broadcast master, monitor, and each physical output receive dedicated analyser nodes for peak and RMS metering. Analysers observe signals and never add a playback path.

### Output routes

Mix Output and Monitor Output each own exactly one sink element and one source stream. Changing a device is transactional:

1. Resolve the requested stable device identifier.
2. Create a candidate sink bound to the existing destination stream.
3. Apply the new device identifier and start playback.
4. Confirm that the sink is active; when input samples are available, confirm output sample flow within a bounded validation window.
5. Publish the new route state.
6. Pause, detach, and dispose the old sink.

If any step fails, dispose the candidate and retain the previous route. A failed selection must never destroy a working route.

The controller resolves `default` to the current physical device when the platform exposes enough information. If monitor and mix routes target the same physical device, Story Studio warns about possible doubled audio and prevents an accidental second route unless the user explicitly confirms a testing configuration.

### Restart and shutdown

Restart Audio Engine performs a deterministic teardown before rebuilding:

1. Block new commands and advance the generation.
2. Stop active playback and test signals.
3. Stop microphone and destination tracks.
4. Pause and detach sink elements.
5. Disconnect sources, buses, gains, and analysers.
6. Remove device-change handlers, animation frames, timers, and subscribers owned by the old generation.
7. Close the old audio context.
8. Build one new graph and restore normalized settings.

Stop All Audio stops active lesson playback and test signals and mutes output safely. It does not create or duplicate routes.

## Shared State and Commands

The controller publishes a single state snapshot containing:

- Engine state: stopped, starting, active, muted, warning, error, or reconnecting.
- Available and selected devices, including stable IDs, friendly names, connection state, sample rate, channel count, stream activity, and sample-flow state.
- Microphone, media, master, monitor, and mix volumes and mute states.
- Microphone-monitor enabled state.
- Peak and RMS meter values for microphone, media, master, monitor output, and mix output.
- Active stream, callback, and listener counts.
- Buffer, underrun, overrun, dropped-buffer, reconnect, and last-error diagnostics.
- Active warnings.
- The selected compact stage-panel controls.

Both interfaces use the same command methods for volume, mute, device selection, testing, recovery, and restart. A command updates controller state once, and all subscribers render the resulting snapshot.

## Full Audio Settings Workspace

Add a clearly visible Audio button beside the Edit/Teach control in the application toolbar. The button includes a status dot and optional warning badge and opens a large in-app modal workspace matching Story Studio's existing dark visual language.

The workspace contains:

### Routing

Selectors for Microphone Input, Monitor Output, and Mix/Virtual Output show friendly name, connection state, sample rate, channel count, stream activity, and sample flow. Missing saved devices remain visible and labeled as missing.

### Mixer

Controls include microphone, media/story, master, monitor, and mix-output volume and mute; microphone-monitor enablement; and Stop All Audio. Microphone monitoring is clearly identified as a testing option and defaults off.

### Live meters

Peak and RMS meters are shown for Microphone Input, Story/Media Audio, Master Mix, Monitor Output, and Mix/Virtual Output. Labels explain the failed stage when an upstream meter moves but a downstream meter does not.

### Testing and recovery

Actions include Test Microphone, Send Test Tone to Monitor Output, Send Test Tone to Mix/Virtual Output, Restart Audio Engine, Stop All Audio, Reconnect Missing Devices, and Copy Audio Diagnostics to Clipboard.

### Diagnostics

A collapsible readable diagnostics section labels device IDs and names, sample rates, channels, buffer sizes, meter values, active counts, underruns, overruns, dropped buffers, last stream error, last reconnect attempt, and engine state. Raw objects are not dumped directly into the interface.

### Warnings

Prominent warnings cover missing devices, initialization failures, master activity with silent output, duplicate streams or callbacks, feedback risk, clipping, underruns, sample-rate or channel mismatch, and restart-required state.

### Stage Panel Controls

The full workspace allows the user to choose which eligible controls appear in the compact stage sidebar. Eligible controls are:

- Microphone volume and mute.
- Media/story volume and mute.
- Master volume and mute.
- Monitor volume and mute.
- Mix-output volume and mute.
- Microphone, media, master, monitor-output, and mix-output meters.
- Stop All Audio.
- Test Microphone.
- Reconnect Missing Devices.

Audio status and Open Audio Settings are mandatory so the compact panel cannot become unusable. Device selectors, detailed diagnostics, routing configuration, and engine restart remain exclusive to the full workspace.

## Compact Stage-Sidebar Panel

Remove the current full Audio Routing section and its Mix Output Device, Monitor Device, and Microphone Input selectors from the story sidebar.

Replace it with a compact operational panel assembled from the user's selected controls. It always shows compact engine status and Open Audio Settings. Its controls are direct views of controller state and invoke controller commands; it has no independent settings, event handlers, streams, or callbacks.

Changes from either interface appear in the other on the next shared-state update. Restarting or reconnecting refreshes both interfaces from the rebuilt controller snapshot.

## Persistence and Backward Compatibility

Audio preferences are application settings, not episode data. Store them in a separate versioned settings file under Electron's user-data directory through preload-safe IPC.

Persist:

- Stable microphone, monitor, and mix-output device identifiers.
- Last known friendly names for missing-device display.
- Microphone, media, monitor, master, and output volumes.
- Appropriate mute states.
- Monitoring enabled state and microphone-monitor state.
- Selected compact stage-panel controls.

On launch, unavailable saved devices remain selected-but-missing in state. Story Studio must not silently choose an unrelated device. It may offer a clearly named fallback, but applying it requires an explicit user action. Reconnect Missing Devices retries the saved stable identifiers.

Existing episode `project.json` files need no new fields and no migration. Opening an episode does not rewrite it. Saving continues to preserve existing and unknown fields according to current project normalization behavior, while audio settings remain outside the project. Legacy dialogue, effects, slide music, section music, and video-audio defaults remain unchanged.

The five existing episodes are acceptance fixtures. If an episode contains a genuinely broken media reference, the repair may update that episode only after the user explicitly chooses to save a content correction; the audio-system upgrade itself must not require such edits.

## Diagnostics and Failure Handling

Every device or engine operation records a readable phase, timestamp, target device, result, and normalized error. The UI distinguishes initialization failure, playback rejection, missing device, active-but-silent stream, and upstream silence.

Warnings are derived from measurable controller state. In particular:

- Microphone moving and master silent indicates mixer insertion failure.
- Master moving and mix output silent indicates route or sink failure.
- Master and mix output moving while Zoom receives nothing indicates configuration outside Story Studio.
- More than one stream, callback, or listener for a singleton route indicates a lifecycle defect.
- Monitor and mix resolving to the same physical device indicates doubling risk.

Copy Audio Diagnostics produces a labeled text report without episode content or sensitive microphone samples.

## Verification Strategy

### Automated regression tests

Add deterministic tests around pure routing, settings, lifecycle, diagnostics, and UI-state models. Test doubles for Web Audio and media devices verify:

- Legacy episode data without audio settings loads unchanged.
- Existing media categories retain their playback defaults.
- Microphone and media enter the broadcast mix exactly once.
- Monitoring includes media and excludes microphone by default.
- Microphone monitoring adds and removes the microphone exactly once.
- Repeated playback commands, switching, reconnecting, and restarting do not duplicate streams, callbacks, or listeners.
- Failed transactional replacement retains the old working route.
- Old and malformed audio-settings versions normalize safely.
- Full and compact controls remain synchronized.
- Compact-control selections persist.

All existing shared tests, renderer compilation, main-process compilation, and packaging checks must remain green.

### Manual hardware matrix

Before the Monday release, verify on the target Windows machine:

1. Headphones as Monitor Output: lesson audio is audible and microphone is inaudible.
2. Headphones as Mix Output for testing: microphone and lesson audio are both audible.
3. VB-Cable as Mix Output and headphones as Monitor Output: Zoom receives microphone plus lesson audio; headphones receive lesson audio only.
4. Repeated device switching and engine restarts create no doubled, delayed, or wavy sound.
5. Each meter identifies the stage where an intentionally muted or disconnected signal stops.
6. Each of the five existing episodes opens and plays without editing its JSON.
7. The packaged Windows application launches and restores settings after restart.

Zoom should select VB-Cable's receiving endpoint as its microphone. Story Studio should select VB-Cable's sending endpoint as Mix/Virtual Output. Zoom microphone processing and Windows exclusive-mode behavior are external variables and belong in the troubleshooting checklist.

## Scope Boundaries

This work does not introduce an external audio program, redesign unrelated Story Studio UI, modify episode schemas for app-level audio configuration, or add a native audio dependency. It does not promise to diagnose Zoom or driver failures beyond proving that samples leave Story Studio's mix output.

## Release Gate

The Monday build is not ready unless the production build succeeds, automated regression tests pass, the hardware matrix passes on the user's headphones and VB-Cable setup, and all five episode projects open without required JSON edits.
