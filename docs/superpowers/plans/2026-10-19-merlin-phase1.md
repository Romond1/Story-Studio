# Merlin Tracking Phase 1 Implementation Plan

**Goal:** Rigid pose smoothing and isolated developer diagnostics, preserving assets and application workflows.

**Architecture:** Keep the existing worker, pose filter, and shared head hierarchy. Put matrix validation/smoothing and camera convention in a focused helper, and visualization in a separate diagnostic class. Extend existing camera settings with an optional validated diagnostic payload.

**Tech Stack:** TypeScript, React, Three.js, MediaPipe, Node test runner, Electron/Playwright.

- [ ] Preserve full workspace and verify source/asset hashes; create dedicated branch and local WIP snapshot.
- [ ] Add mathematical regression tests in `src/shared/faceTracking.test.ts`; run them against old filtering and observe determinant/scale failures.
- [ ] Add `src/shared/facePoseMath.ts`; use Matrix4 decomposition, Vector3 lerp, normalized Quaternion slerp, unit-scale recomposition; wire into `FacePoseFilter`.
- [ ] Add malformed-transform, shortest-path, time-aware, translation, and projection tests. Keep source-frame coordinates unmirrored in filtering.
- [ ] Add strict optional diagnostic settings and presets in `faceTrackingProtocol.ts`; verify compatibility with legacy camera payloads.
- [ ] Add renderer comparison tests in `scripts/merlin-tracking.test.cjs`; preserve corrections but gate them, reset springs/jaw on mode changes and loss, and verify rigid roots remain at rest.
- [ ] Add developer Control UI and Three.js diagnostic helpers. Label canonical versus observed points, head/model pivots, and attachment roots. Keep diagnostic controls out of Present.
- [ ] Match pinned virtual FOV, test camera-space mirroring and metric projection, retain current asset calibration without claiming physical fit.
- [ ] Repair explicit 2D canvas selection in `face-tracking-smoke.cjs`; extend acceptance to real GLB and developer presets, screenshot desktop/narrow Control and Present.
- [ ] Run `npm test`, `node --test scripts/merlin-tracking.test.cjs`, `npx tsc --noEmit`, both builds, face/camera smoke tests, and Edit/Teach/Present workflow checks. Inspect results and screenshots.
- [ ] Verify GLB hashes unchanged, review the scoped diff, document recovery and webcam comparison instructions, commit phase changes separately from the WIP snapshot.

Execution is inline in the authorized session. No asset redesign or occlusion rewrite is part of this plan.
