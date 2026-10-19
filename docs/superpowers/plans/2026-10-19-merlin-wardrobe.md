# Merlin wardrobe integration

Baseline: clean commit `1e00410`; development branch `codex/merlin-wardrobe`. Original workspace snapshot remains available as documented in the phase 1 report. Argon's original files on Z: remain untouched.

Design: independent opt-in hat/robe toggles using the existing Three.js scene, camera and face tracker. Hat loads under the existing model alignment node with zero added offset. Robe uses a separate camera-space neck pivot, existing metric calibration and restrained/damped head-derived orientation; it is explicitly an approximation without shoulder tracking. Its authored neck offset must not be applied twice. Preserve original opaque PBR materials, identity geometry, lower-face depth proxy and tracking fixes. Optional-asset failures must not break camera/identity/other wardrobe pieces.

Alternative considered: attach everything rigidly under the head. Rejected because torso would rotate with the nose. New body tracking is outside scope and would add inference/runtime cost. The face-only approximation is small and reversible.

- [x] Inspect GLB metadata, embedded textures, origins, bounds and inspection sheet; copy the two exports unchanged into public/face-tracking.
- [x] Add failing tests for optional settings, wardrobe transforms, independent visibility/loading, failed/late loads, reset/disposal and temporary-hat suppression.
- [x] Implement a focused wardrobe helper using the existing loader and scene; gate identity loading independently and retain existing compensation behavior.
- [x] Add teacher-facing hat/robe toggles and concise face-only robe note. Extend existing diagnostic visibility handling.
- [x] Run unit tests, types, renderer/main builds, real-worker wardrobe pixel acceptance and core Edit/Teach/Present smoke. Inspect desktop/narrow screenshots and synthetic ensemble.
- [x] Verify copied and original identity asset hashes; document limitations and use instructions; commit separately from the prior working baseline.
