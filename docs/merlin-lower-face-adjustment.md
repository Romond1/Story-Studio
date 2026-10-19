# Merlin lower-face occlusion extension

Follow-up to the user's webcam screenshots showing far-side beard across the mouth. The fixed proxy's lower-face coverage was insufficient in a ray-intersection regression; the old geometry failed the frontal mouth case.

Added one shallow depth-only ellipsoid to the existing head proxy in `MerlinCostumeOverlay.ts`. Model-space centre `(0, -0.036, 0.010)` metres, radii `(0.064, 0.043, 0.064)`. Its lower edge extends to Y=-0.079 m and maximum forward extent is Z=0.074 m. It follows the same head hierarchy, shares the depth-only material, and appears automatically in the existing diagnostic wireframe. No asset, pose, compensation or UI changes were made.

Validation: all five renderer tests passed, including new ray checks for mouth coverage at 0/±30/±60 degrees with mirroring on/off, and preservation of selected front mustache and below-chin beard points. TypeScript checking, renderer build, and all nine real-worker/current-GLB synthetic-camera acceptance groups passed. The build retains its existing chunk-size advisory. Synthetic screenshots were inspected; current GLB SHA-256 remains unchanged.

Evidence: `docs/merlin-lower-face-evidence/`. These checks establish coverage and integration, not a physical fit to the user. Recheck the same turns on the webcam; the fixed proxy may still need individual fitting. In diagnostics, compare Depth occlusion on/off and inspect the green lower-face wireframe.

The preceding commit `362a86c` preserves the state before this small adjustment, and the original full-workspace backup remains available as documented in `merlin-phase1-report.md`.
