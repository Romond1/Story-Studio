# Phase 2 video playback repair — 2026-10-06

Manual testing found choppy Control video, delayed/distorted audio and a stage/header
layout shift. The user subsequently confirmed that the uneven black bars are gone
and Control and Present look similar. The multi-second delay reduced to about
200–300 ms during the repair; physical-output lip sync is not yet signed off.

## Causes and changes

- Control previously sought a separate paused file video every 200 ms: roughly
  3–5 displayed frames per second. Present now sends its decoded video track over
  the existing local peer connection. Control displays a muted, video-only stream
  with no independent file timeline or mixer attachment. Audio enters the existing
  mixer once.
- Default peer adaptation initially downscaled and visibly compressed the preview.
  It now preserves source resolution with high initial bitrate and a 12 Mbps ceiling.
  The actual Episode 4 clip measured **1280×720 at 24 fps**, with no repeated seeks
  or bandwidth quality limitation. This is an encoded preview, not a lossless copy.
- Audio previously negotiated a 32 kbps mono speech profile. It now requests stereo
  Opus at 192 kbps, 10 ms packets and minimum local jitter buffering. The source
  context uses 48 kHz. Microphone and output-route settings were not changed.
- Video transport controls expanded the app beyond its window (about 1764 pixels
  inside a 1200-pixel window). Grid columns now fit, the top menu has stable height
  and horizontal overflow, and transport sits over the Control stage. Switching to
  video cannot resize the stage. Present video positioning no longer has inline
  baseline spacing. Aspect-ratio letterboxing is retained without stretching/cropping.
- Both teaching renderers disable background throttling. Replay waits for seeked/
  can-play rather than a first-load-only event. Play after completion creates a
  fresh capture at trim-in; normal-teaching fallback restores the last position paused.

## Verification

**241 tests pass**, plus full TypeScript, renderer build and main build. New tests
cover track ordering/retirement, stereo and preview-quality negotiation, background
configuration and Play after completion.

Actual Electron checks cover full-resolution 24 fps preview using a read-only clip
from `D:\AI\SET OUT\TWIN STAR\EPISODE 4\test SS`, no repeated seeks, stable layout,
matching paused-frame pixels, playback while hidden, volume/mute, trim, seek/replay,
reload/crash/reopen and legacy handoff. The fixture cannot save into that lesson.
Trim editing remains available using the authoritative duration. Drawing, zoom,
pan, clear and reload regression checks also pass. Episodes 1–5 still match the
saved production-file hashes.

Source/receiver envelope correlation measured about **80 ms** audio transfer into
the mixer on the real clip. This excludes physical-device and conferencing latency;
the remaining audible delay needs a listening check on the teaching setup.

Local evidence is in `.superpowers/qa-video-regressions.cjs`,
`.superpowers/video-real-hd-final.json` and
`.superpowers/phase2-media-probe/production-run.cjs`.

The implementation follows [media-element capture](https://www.w3.org/TR/mediacapture-fromelement/),
[Opus RTP configuration](https://www.rfc-editor.org/rfc/rfc7587.html),
Chromium's [local startup bitrate support](https://webrtc.googlesource.com/src/%2B/ab4f8e1fde2b021fa6200d3e2f7d2d27a239b713/call/rtp_bitrate_configurator.cc),
and [Electron background-window behavior](https://www.electronjs.org/docs/latest/api/browser-window).

Restart Story Studio once before final acceptance so main-process window settings
apply, then reopen Present and test the same clips. No production migration or
Phase 3 work was performed.
