# Phase 2 local video-audio bridge probe

An isolated Electron probe used the installed Electron 34.5.8 / Chromium 132 and
the application's existing `media://` privileges and range-response behavior.
It ran under both a file origin and a local HTTP development origin. It did not
open production lessons, capture a microphone or play through physical outputs.
Both AudioContexts used a verified `sinkId: { type: 'none' }`; the probe also used
Chromium's disabled-audio-output switch as a secondary safeguard.

## Result

A single Present-side video decoder feeding a MediaStream destination and a local
WebRTC peer pair produced one receiving audio track. Source and receiver RMS were
approximately 0.08845 and 0.08836. Five synthetic pulses crossed the bridge in each
run; measured delay was approximately 69–103 ms across runs. Forced sender renderer
crash notified the receiver and detached its graph in 10–15 ms; the analyser was
zero at the subsequent 300 ms check.

These are synthetic, local graph measurements, not a physical-device latency or
conferencing acceptance result. The added audio delay needs a real lip-sync check.

## Required decoder activation

Chromium received packets but produced no decoded Web Audio samples when the remote
stream was attached only to `createMediaStreamSource`. Keeping a muted audio
element with the same `srcObject` and calling `play()` activated decoding. This
element must stay muted; the existing mixer is the only audible output path.

## Production design constraints

- One live video element in Present; Control preview paused and muted.
- Present source adapter connects only to a MediaStream destination, never its
  audible destination. Present creates no AudioController or microphone capture.
- One Control AudioController receives the stream through its existing media bus.
- Main authenticates signaling and scopes it to the current renderer generation.
- Playback waits for bridge and receiver readiness. No local audible fallback.
- Close/crash/reload silences the receiver immediately and pauses Core intent;
  reopening restores paused media without disturbing microphone/music routing.

The ignored local `.superpowers/phase2-media-probe` directory contains the runnable
probe, generated synthetic WebM, detailed report and raw results. This feasibility
checkpoint preceded production integration. The final production Electron fixture
also passed single-track sample delivery, transport/trim/gain behavior, reload and
crash retirement, paused recovery, and fallback handoff; physical-device acceptance
remains outstanding. See [the final report](phase2-report.md).
