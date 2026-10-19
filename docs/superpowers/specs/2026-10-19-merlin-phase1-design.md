# Merlin tracking phase 1

Preserve MediaPipe 0.10.32, Three.js 0.180.0, the current GLB, all rollback assets, and existing teaching workflows. This phase establishes rigid tracking and diagnostic comparison; it does not fit a new head occluder or redesign costumes.

## Design

Decode the column-major, right-handed MediaPipe similarity transform. Validate its affine row, positive uniform scale, and orthogonal rotation; remove input scale (matching the previous attachment's unit-scale policy). Interpolate centimetre translation and normalized quaternion rotation separately, using the existing 45 ms exponential time constant and observation timestamps. Recompose a rigid matrix. Preserve expiry, duplicate-frame rejection, and landmark smoothing.

Align the virtual camera to the pinned MediaPipe release's 63 degree vertical FOV. Mirror the head in camera space using a parent transform rather than a negative camera projection, so Three.js can account for reflected winding. Keep the existing empirical model alignment clearly identified as unvalidated physical calibration.

A developer-only Control panel, opened by Ctrl+Alt+Shift+M in Teach, sends strictly parsed diagnostic settings through the existing camera settings IPC. Present contains visual guides only, never diagnostic controls. Nothing is persisted into lessons. Rigid and Compensated presets retain the compensation code and independently control root corrections, pitch compensation, residual registration, springs, jaw, costume visibility, and depth occlusion. Guides show head/model axes, canonical reference points, observed 2D landmarks, bone origins, and the existing occluder wireframe. Rigid mode disables every positional/deformation compensation, including jaw animation.

Use small focused math and diagnostic helpers. No new dependencies. Reset dynamic state on tracking loss or comparison-mode changes and dispose owned Three.js resources on teardown.

## Validation

First reproduce large-yaw and mixed-axis nonrigidity in tests. Cover translation, time subdivision, quaternion shortest paths, scale removal, invalid matrices, loss/reacquisition, projection and mirror conventions. Exercise renderer toggles and reset behavior with a fake graphics boundary, and actual GLB loading and Control/Present behavior in Electron with the real worker and synthetic webcam. Fix the old smoke test to select its 2D overlay explicitly. Run the complete existing unit suite, renderer/main builds and workflow smoke checks. Physical yaw/pitch, glasses, natural movement, distances, and true model fit remain webcam acceptance work.

## Recovery

Full workspace backup: `D:\AI\Backups\Story-Studio\20261019-merlin-phase1-214018`. It includes ignored files and Git metadata. `manifest.json` verifies all 3,229 tracked and nonignored untracked files. `RECOVERY.md` explains non-destructive recovery into a fresh directory. Development branch: `codex/merlin-tracking-phase1`, with a pre-implementation WIP snapshot commit.
