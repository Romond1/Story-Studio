# Phase 2 face tracking implementation

Phase 1 checkpoint: `4e6d702`, remote branch `codex/presenter-camera-phase1`, local tag `phase1-camera-verified-2026-10-12`. Remaining generated-file changes are untouched.

Use pinned tasks-vision 0.10.32 in a classic worker with local WASM/model resources. CPU/WASM inference avoids sharing the camera compositor's GPU context. Transfer at most one reduced (640px maximum dimension) frame, approximately every 80ms. Drop stale results, terminate hung workers, and never acquire media in tracking code.

Draw a separate transparent canvas above the keyed camera. Both canvases have the same source dimensions, object-fit/object-position and enclosing preset crop. Mirror the overlay at draw time, while inference uses unmirrored raw input. Three small debug points and a basic projected cone/brim use face position and 3D landmark axes. The model's face transformation matrix is retained for later accessories. No Three.js is required for this placeholder.

- [x] Test frame gating, staleness, geometry, smoothing and protocol validation.
- [x] Package pinned model/WASM and notices, with hashes and offline build verification.
- [x] Implement worker/session/overlay with independent failure and cleanup.
- [x] Extend validated camera IPC with tracking settings and private status, and add compact controls.
- [x] Run real-model fixture acceptance in Electron, synthetic camera regression, lesson/game tests, builds and type check.
- [x] Record evidence and manual physical-face checklist; stop before Phase 3.
