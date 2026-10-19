# Merlin hat and robe integration

Argon's standalone `merlin_hat.glb` and `merlin_robe.glb` are integrated on `codex/merlin-wardrobe`, based on the accepted lower-face adjustment at `1e00410`.

## Asset inspection and preservation

Both exports were read directly from `Z:\BLENDER\NEW 10.26\merlin_costume`. Their glTF metadata, mesh bounds, material modes, bones and helper origins agree with the handoff. Textures and buffers are embedded; there are no external resource URIs. The hat has an origin at the existing head root and a sweatband helper at `(0,.078,.004)` m. The robe's neck/root helper is `(0,-.135,-.008)` m. The multi-angle ensemble inspection sheet was inspected before integration.

The two files were copied byte-for-byte into `public/face-tracking/` (4,855,352 and 6,083,248 bytes). Asset SHA-256 values are recorded in `merlin-wardrobe-evidence/asset-integrity.json`. Current and rollback identity GLBs also match their originals. No Blender files, generators, existing assets, head tracking, or occluder shapes were edited.

## Behavior

- **Hat:** mounted directly under the same model alignment as the identity. No second origin offset, duplicate tilt, or new bone animation. Selecting the 3D hat suppresses the temporary purple 2D hat; switching it off restores the temporary hat if its checkbox remains selected.
- **Robe:** a separate neck-pivot group shares the displayed head translation and existing metric/model calibration. The authored neck offset is subtracted exactly once before rotation so it is not doubled. It does not inherit full head rotation: yaw is attenuated to 25%, pitch and roll to 15% and capped at ±8 degrees, with quaternion damping over 180 ms. This is a face-only approximation of worn clothing, not shoulder/body tracking.
- **Materials:** retain Argon's opaque PBR cloth, lining, leather and bronze. Identity hair's alpha cutout and polygon-offset overrides are not applied to wardrobe assets.
- **Lifetime:** assets load independently and only after selection, then remain cached until the tracking overlay is disposed. One optional failure cannot disable other pieces, the identity or camera. Loading after tracking loss keeps the result hidden; loading after disposal releases the result. Reset/disposal uses the existing tracking lifecycle.
- **Diagnostics:** Costume geometry hides all selected components. Head axes, proxy wireframe and reference guides continue to work without an identity asset. The existing scalp prototype stays at its previous default visibility.

No additional dependencies, webcam streams, WebGL renderers or inference workers were added. Assets are included through the existing Vite public-file and Electron dist packaging paths. Settings remain opt-in and session-only.

## Use

Restart Story Studio or run `npm run dev`. Open a lesson, choose **Teach**, open **Present**, turn on the camera and enable **Face Tracking**. Select:

1. **Show 3D Merlin costume · experimental** for the existing hair/beard.
2. **Show Merlin 3D hat**.
3. **Show Merlin 3D robe · experimental**.

Each component can also be used separately. The robe note in Control explains that shoulders and arms are not tracked. Tracking loss hides all three parts; tracking/camera off disposes them through the normal lifecycle. If an asset fails to load, turn tracking off/on to recreate the session and retry.

## Verification

| Check | Result |
|---|---|
| `npm test` | 615 passed, zero failures; includes optional wardrobe settings/validation |
| `node --test scripts/merlin-tracking.test.cjs` | 8 passed; includes standalone loading, opaque materials, neck pivot and shared registration, damped orientation, independent failures, late loads and disposal |
| `npx tsc --noEmit` | Passed |
| Renderer and main builds | Passed; renderer retains Vite's chunk-size advisory |
| Real-worker/GLB face smoke | 10 acceptance groups passed, zero page errors; separate GPU pixel assertions for hat-only and robe-only, temporary-hat suppression, ensemble, mirror and teardown |
| Core Edit/Teach/Control/Present workflow smoke | 4 groups passed, zero page errors |
| Independent review | No actionable integration defects found |
| Asset hashes | Both new exports are exact copies; existing identity/current rollback unchanged |

Synthetic screenshots of isolated pieces, the ensemble, mirroring and 480 px Control layout were inspected. The mirror capture waits for fresh tracking after shader warmup rather than capturing the intentional tracking-loss hide state. Evidence and command logs are in `docs/merlin-wardrobe-evidence/`.

These tests do not establish physical webcam fit. Check hat height/brim clearance, neckline/shoulder width, beard/collar clearance during turns and nods, different camera distances, and tracking recovery. Face-only robe positioning cannot follow independent shoulder or arm movement. No claim is made that the mannequin/reference fit transfers exactly to the teacher.

## Main files

- `src/renderer/camera/tracking/MerlinWardrobe.ts`: independent loading, placement, visibility and lifetime.
- `MerlinCostumeOverlay.ts`: shared scene integration and independent identity loading.
- `FaceTrackingControls.tsx`, `faceTrackingProtocol.ts`: separate opt-in controls and validated settings.
- `drawTracking.ts`: temporary hat precedence.
- `MerlinTrackingDiagnostics.ts`: allow reference diagnostics without the identity loaded.
- `scripts/merlin-tracking.test.cjs`, `scripts/face-tracking-smoke.cjs`, `src/shared/faceTracking.test.ts`: regressions and real-asset acceptance.
- `scripts/merlin-workflow-smoke.cjs`: configurable evidence directory so later checks preserve phase 1 evidence.

The prior state remains at `1e00410`. The original full-workspace backup and recovery instructions remain available in `merlin-phase1-report.md`. No branch has been pushed or merged.
