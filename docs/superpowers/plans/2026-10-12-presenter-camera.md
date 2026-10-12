# Presenter camera Phase 1

Goal: one Presenter-owned video-only webcam with independent WebGL2 processing and private Teach controls.

Design follows the three 2026-10-12 research reports and the supplied master instructions. A separate validated camera IPC channel accompanies the existing lesson channel. Main retains only transient camera intent/status. CameraSession serializes acquisition and releases stale requests. CameraEffects owns a transparent WebGL2 canvas; CameraLayer sits outside story transforms and stacking context. Both current and legacy Teach controls share CameraControls. No dependencies, document fields, microphone changes, or Phase 2 work.

- [x] Test protocol validation, serialized acquisition, cancellation and release before implementation.
- [x] Implement shared protocol and camera session; run focused tests.
- [x] Add authorized main/preload camera IPC, private permission confirmation and lifecycle resets.
- [x] Implement GPU green key, softness, spill suppression, brightness, contrast and mirror.
- [x] Mount independent Presenter layer and compact accessible controls in both Teach paths.
- [x] Run unit suite, renderer/main builds, type check and synthetic-camera Electron acceptance where available.
- [x] Document exact results, manual physical-camera/meeting checklist and Phase 2 handoff; stop.

Full Screen uses cover (aspect-preserving edge crop); corners use contain at a third of output width. Hidden retains capture but suspends drawing. Off releases tracks. Capture failure hides the optional layer and reports only to Control. Effects do not restart capture. Settings are session-only and reset to off when Presenter closes or Control reloads.
