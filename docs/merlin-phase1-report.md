# Merlin tracking repair — phase 1

Implemented on `codex/merlin-tracking-phase1`. This phase corrects the rigid-pose mathematics and adds developer diagnostics. It does **not** establish physical webcam fit, repair the occluder surface, or redesign the costume.

## Preservation and recovery

Before editing, a full ordinary-file copy of the workspace, including `.git`, dependencies, ignored build outputs/caches and both GLBs, was made at:

`D:\AI\Backups\Story-Studio\20261019-merlin-phase1-214018\workspace`

Robocopy copied 38,032 files (about 4.66 GiB) with zero failures. The backup's `manifest.json` verifies SHA-256 for every tracked and nonignored untracked file: 3,229 files. Directory junction traversal was disabled; dependencies/caches are copied but not included in that hash manifest. `RECOVERY.md` is beside the backup.

For complete recovery, copy the backup into a **new empty directory**, preserving the live checkout:

```powershell
robocopy 'D:\AI\Backups\Story-Studio\20261019-merlin-phase1-214018\workspace' 'D:\AI\Recovered\Story-Studio-before-Merlin' /E /COPY:DAT /DCOPY:DAT /XJ /R:1 /W:1
```

Exit codes below 8 indicate successful copying. The copied Git metadata retains the original `phase-6-rebuild-integration` branch, index and uncommitted state. Do not mirror this backup over the active checkout.

There is also a local pre-implementation WIP snapshot commit, `ba241a3`, on the development branch. It intentionally includes the pre-existing unrelated work and relevant previously untracked assets. A separate checkout of that commit provides the source baseline:

```powershell
git worktree add --detach 'D:\AI\Recovered\Story-Studio-source-baseline' ba241a3
```

That source checkout does not contain ignored dependencies/build caches; use the full backup when those are needed. No branch was pushed or merged.

## Changes and rationale

- `FacePoseFilter` now decomposes incoming similarity transforms, interpolates centimetre translation independently, SLERPs normalized quaternions, and recomposes with unit scale. The 45 ms exponential time constant uses observation timestamps. Landmarks retain their existing smoothing, duplicate handling and 350 ms expiry.
- Input checks reject singular/reflected matrices, non-affine rows, significant shear and nonuniform scale. Float32 numerical noise is tolerated. Incoming **uniform** scale is intentionally removed, consistent with the previous renderer's policy of ignoring decomposed head scale. The pre-existing *model* alignment scale `(108,102,92)` and offset `(-0.08,-1.15,-2.50)` remain unchanged and explicitly empirical.
- Removed the renderer's second, frame-dependent orientation smoothing. The renderer consumes the already-smoothed rigid pose.
- The virtual camera now uses 63 degrees, matching the default environment in the exact MediaPipe 0.10.32 source. Mirroring is a camera-space parent reflection, allowing Three.js to account for winding instead of hiding reflection in a negative projection coefficient.
- Preserved all compensation code. Developer options independently gate root retraction (hair and side beard), pitch compensation, residual registration, springs, jaw animation, costume, and occlusion. The rigid preset disables all five motion/registration corrections. Mode changes and tracking loss reset jaw/spring state.
- Added diagnostic axes/pivots, canonical anatomical reference dots, observed landmark rings with readable labels, bone-origin dots, and a wireframe of the **existing** occluders. Wireframe visibility is independent of whether the depth proxy is active. Guides do not write depth and draw after transparent costume materials.
- Added explicit GPU-resource disposal and asynchronous-load teardown handling. Existing scalp prototype remains off by default. The three depth-proxy ellipsoids and existing material settings remain intact.
- Diagnostic settings use the existing role-checked camera IPC and strict boolean parsing. They are runtime settings, not lesson content. No dependency or asset changes were made.

The legacy pitch corrections retain their original sign/amplitude. In the canonical right-handed frame, positive X rotation moves a forward (+Z) point toward negative Y. The old comments equating negative pitch with a downward nod were not evidence of physical calibration and have been corrected. No replacement angle correction was introduced.

## Opening and comparing

1. Run `npm run dev` from the checkout, open a lesson, choose **Teach**, and open **Present**.
2. Turn on the camera and **Enable face tracking**. Keep Control focused and press **Ctrl+Alt+Shift+M**.
3. In **Merlin developer diagnostics**, click **Rigid preset**. It enables the existing GLB and guides while disabling root corrections, pitch compensation, screen-space registration, springs and jaw animation. The temporary 2D hat/ordinary markers are suppressed while diagnostics are active.
4. For a clear registration check, turn off **Costume geometry**. The white canonical pivot, orange model/bone origins, axes, reference points and green proxy wireframe remain available. Turn off **Occluder wireframe** to reduce clutter. **Depth occlusion** separately controls whether the proxy hides costume pixels.
5. Re-enable the costume and compare frontal, approximately ±30/±60 degree yaw, up/down pitch, speech, small movements and different distances. Switch **Rigid preset** / **Compensated preset** at the same position. Both use the corrected smoothing and camera; this comparison isolates legacy compensation, not old versus new smoothing.
6. Enable one correction at a time in rigid mode. **Pitch compensation** changes the legacy nose offset and chest-settling terms; its nose offset has no effect while **Screen-space registration** is off. **Spring-bone motion** must be on to observe the spring-driven chest-settling terms. **Jaw animation** is separate so speech can be isolated from rigid attachment.
7. Repeat with the normal camera **Mirror** toggle in both states. Axes: X red, Y green, Z blue. Solid coloured dots are canonical references; rings are observed landmarks. Temple labels use landmark indices, avoiding ambiguous anatomical left/right names after mirroring.
8. Click **Close diagnostics** or press the shortcut again to remove diagnostic settings and restore ordinary tracking display. The costume visibility setting remains enabled if selected during comparison. The panel is absent by default; there are never diagnostic controls in Present.

Guides appear in the Presenter image and therefore in a screen share. Use diagnostic comparisons outside a live lesson.

## Verification

| Check | Result |
|---|---|
| `npm test` | **614 passed**, zero failures; includes 14 face-tracking tests |
| Test-first reproduction | Old implementation failed five new cases, including large yaw determinant 0.85955 and mixed-axis determinant 0.69452 |
| `node --test scripts/merlin-tracking.test.cjs` | **4 passed**; rigid head orientation/translation/rest bones across yaw/pitch and 35/60/120 cm, mirror projection of rotated points, visibility isolation, dynamic resets |
| `npx tsc --noEmit` | Passed |
| `npm run build:renderer` | Passed; Vite reports its large-chunk advisory |
| `npm run build:main` | Passed |
| `scripts/face-tracking-smoke.cjs` | **9 acceptance groups passed**, real offline worker + actual current GLB, synthetic webcam, no page errors |
| GPU pixel assertions | Real costume emits pixels with every guide disabled; depth-only proxy emits no visible pixels with costume/guides hidden |
| `scripts/camera-smoke.cjs` | **11 acceptance groups passed**, including capture ownership, keying, mirror, layouts, errors, context loss and teardown |
| `scripts/merlin-workflow-smoke.cjs` | **4 groups passed**: Edit authoring/save, Present composition, Teach navigation, private developer UI and Edit/Teach transitions |
| Existing `scripts/phase7f-workflow-smoke.cjs` | Steps **1–8 passed**, then timed out on hidden `Activity participants` summary. The unmodified preserved baseline fails at the identical step/selector, also with no page errors. This older broad gate is **not** claimed as passing. |
| Asset integrity | Both current and rollback GLB SHA-256 values match the pre-change backup |
| Review | Independent code review found no actionable production issue; its suggested GPU pixel acceptance checks were added and passed |

The shared tests cover rigid determinant/orthonormality, large yaw, mixed axes, independent translation, scale policy, shortest quaternion paths, time subdivision, duplicate/loss behavior, invalid transforms, protocol parsing, and the virtual projection at multiple distances. The worker, single capture, single frame in flight, <=640 px input and <=12.5 Hz inference admission remain in place.

The synthetic portrait moves and rolls in 2D; it does not supply genuine profile views. GPU readback instrumentation and concurrent build/type checks also make that short run unsuitable as a physical-camera performance benchmark. Desktop and 480 px Control screenshots and unmirrored/mirrored guides were inspected. These prove diagnostic operation, not correct anatomical fitting.

Evidence: `docs/merlin-phase1-evidence/` contains screenshots, acceptance JSON, camera/core workflow results, baseline comparison failures and command logs. The initial stale-landmark smoke failure is retained separately; the final smoke waits for a fresh painted observation rather than assuming continuous detection.

## Files changed

- `src/shared/facePoseMath.ts` — new rigid-transform validation, smoothing and camera convention.
- `src/shared/faceTracking.ts` — use rigid smoothing.
- `src/shared/faceTrackingProtocol.ts` — diagnostic presets/options and validated IPC payload.
- `src/shared/faceTracking.test.ts` — mathematical/protocol regressions.
- `src/renderer/camera/tracking/MerlinCostumeOverlay.ts` — comparison gates, camera/mirror integration, state resets and disposal.
- `src/renderer/camera/tracking/MerlinTrackingDiagnostics.ts` — new Three.js guides.
- `src/renderer/camera/tracking/MerlinDiagnosticControls.tsx` — new developer panel.
- `src/renderer/camera/tracking/FaceTrackingControls.tsx` — hidden keyboard entry and panel lifecycle.
- `src/renderer/camera/tracking/drawTracking.ts` — observed references and diagnostic legend.
- `src/renderer/camera/CameraLayer.tsx` — explicit 2D overlay class.
- `src/renderer/camera/camera.css` — scoped diagnostic panel styles.
- `scripts/face-tracking-smoke.cjs` — explicit 2D canvas selection, fresh-observation polling and real GLB/diagnostic/GPU acceptance.
- `scripts/merlin-tracking.test.cjs` — new renderer math/lifecycle regressions with fake loader/GPU boundaries.
- `scripts/merlin-workflow-smoke.cjs` — new focused workflow acceptance.
- Phase design/plan, this report, and phase evidence/logs.

## Remaining webcam acceptance

Check frontal and ±30/±60 degree turns, both pitch directions, natural motion/lag, speech, loss/reacquisition, near/far fit, and mirror/crop modes on the actual teaching camera. Compare canonical dots and observed rings with costume hidden before judging asset fit. Record whether drift exists in rigid mode or appears only after a particular correction is enabled.

The model pivot/offset, anisotropic model calibration, fixed proxy shape, transparency layering, individual head proportions and glasses remain unvalidated. The mustache's existing jaw weights can still deform it when jaw animation is enabled. Those findings are not repaired by this phase. Argon retains responsibility for mesh/weight/material authoring; no hat or robe integration has begun. Occlusion fitting and asset calibration await physical-camera findings.

Pinned technical references:

- [MediaPipe default camera environment, v0.10.32](https://github.com/google-ai-edge/mediapipe/blob/v0.10.32/mediapipe/tasks/cc/vision/face_geometry/face_geometry_from_landmarks_graph.cc)
- [MediaPipe matrix storage convention](https://github.com/google-ai-edge/mediapipe/blob/v0.10.32/mediapipe/framework/formats/matrix_data.proto)
- [Canonical face reference coordinates](https://github.com/google-ai-edge/mediapipe/blob/v0.10.32/mediapipe/tasks/cc/vision/face_geometry/data/canonical_face_model.obj)
