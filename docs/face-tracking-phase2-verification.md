# Phase 2 — live face tracking

Implemented 12 October 2026 on `codex/presenter-camera-phase1`. Phase 1 remains recoverable at pushed commit `4e6d702ee9e57f3f9319000204c39761cb969df8` and local tag `phase1-camera-verified-2026-10-12`. Pre-existing generated-file changes and temporary logs were preserved. No Phase 3 implementation, merge or push was performed.

## Files created and modified

Created:

- `src/shared/faceTrackingProtocol.ts`: validated tracking intent and private status.
- `src/shared/faceTracking.ts`: frame admission, stale-result expiry, pose smoothing and head-attached hat geometry.
- `src/shared/faceTracking.test.ts`: scheduling, loss, malformed data, smoothing, geometry and protocol tests.
- `src/renderer/camera/tracking/face.worker.ts`: one-face MediaPipe inference and transferable bitmap disposal.
- `src/renderer/camera/tracking/FaceTrackingSession.ts`: worker ownership, bounded frame transfer, timeouts and independent recovery.
- `src/renderer/camera/tracking/drawTracking.ts`: post-key hat/marker rendering and backing-store cleanup.
- `src/renderer/camera/tracking/FaceTrackingControls.tsx`: private tracking toggle, marker/hat toggles and status.
- `scripts/prepare-face-tracking.mjs`: offline resource preparation and classic-worker bundling.
- `scripts/face-tracking-smoke.cjs`: real-model Electron acceptance with a moving portrait fixture.
- `public/face-tracking/{face_landmarker.task,manifest.json,LICENSE.txt,NOTICE.txt}`: pinned model and provenance/notices.
- `docs/superpowers/plans/2026-10-12-face-tracking.md`, this report, and `docs/face-tracking-phase2-evidence/`.

Modified:

- `package.json`, `package-lock.json`: exact runtime version; prepare resources before renderer development/build.
- `.gitignore`: generated worker/WASM and task scratch files.
- `src/shared/cameraProtocol.ts`: independent tracking settings and operator status without changing lesson schemas.
- `src/main/cameraBroadcast.ts`, `src/main/presentPreload.ts`: sender-checked tracking status relay; no landmarks forwarded to Control.
- `src/renderer/camera/CameraLayer.tsx`: supplies the existing video to tracking and owns a sibling overlay canvas.
- `src/renderer/camera/CameraControls.tsx`, `src/renderer/camera/camera.css`: mounts the compact Face Tracking section and matching overlay placement.
- `src/shared/camera.test.ts`, `tsconfig.test.json`: tracking IPC authorization tests and test inclusion.
- `scripts/camera-smoke.cjs`: identifies the original Camera section explicitly and permits a separate evidence directory.

The lesson engine, database, game source/data, story Presenter shell and audio routing were not modified.

## Dependencies and assets

One new npm dependency: **`@mediapipe/tasks-vision` exactly `0.10.32`**, Apache-2.0. No Three.js, native process, tracking service or new webcam capture was added.

The local model is Google's Face Landmarker float16 **version 1**, 3,758,596 bytes. Source and SHA-256 are in `public/face-tracking/manifest.json`; preparation rejects a different model hash or runtime version. SIMD and non-SIMD WASM loaders/binaries are copied from the locked npm package into generated `public/face-tracking/wasm/`. Together with the worker/model/notices, the built feature resources occupy approximately 26.4 MB (decimal, uncompressed). Vite includes them under `dist/renderer/face-tracking/`, which is covered by the existing Electron packaging file list.

All application runtime resources load locally. No CDN, model download, telemetry or frame upload is needed at runtime. The classic worker is built before **both** `npm run dev:renderer` and `npm run build:renderer`; this avoids MediaPipe's `importScripts` loader being placed in a module worker. Restart the dev command after editing worker source to regenerate that bundle.

The integration follows Google's [Face Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js), which documents worker use for synchronous inference, one-face smoothing and transformation matrices. The [official model overview](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models) links the bundle and model cards. Source URLs and upstream runtime notices are shipped beside the model.

## Tracking and composition

Presenter remains the single webcam owner. Tracking receives reduced `ImageBitmap` frames from its existing muted video element, before chroma/color/mirror processing. The maximum inference dimension is 640 pixels. A gate admits frames at most once every 80 ms (12.5 Hz) and permits only one pending bitmap/inference request. It creates no waiting frame queue.

MediaPipe runs VIDEO mode with one face and CPU/XNNPACK inference inside a dedicated worker. This keeps synchronous inference off the Presenter thread and avoids adding a competing GPU inference delegate. The model returns 478 landmarks and a 4×4 facial transformation matrix. Five landmarks locate the nose, forehead, chin and sides of the head; light time-based smoothing reduces jitter. The matrix is retained in the local result for future accessories. The temporary cone/brim uses the projected 3D landmark axes for position, scale, roll and changes in apparent yaw/pitch.

Camera rendering retains its existing approximately 30 FPS draw loop. Rendering uses the latest valid pose, rejects results older than 350 ms, and clears immediately on an explicit no-face result at the next render. There is no floating retained hat after loss. Hidden pauses inference admission and drawing; returning resumes with fresh results.

The accessory canvas has the **same intrinsic source dimensions, CSS bounds, object-fit and object-position** as the camera canvas. Coordinates are normalized to the raw camera frame, then expanded to source pixels. The overlay mirrors once at paint time, matching the shader's camera mirror. Full Screen uses the same cover crop; corners use the same contain fit and bottom anchor. Both stay outside story zoom/pan transforms.

The accessory is a separate layer **after** chroma keying. Its pixels remain visible over transparent green-screen areas and are never removed by the camera matte. Small markers sit on the nose/forehead/chin; the hat is lifted above the forehead and does not deliberately obscure eyes or mouth.

Tracking off terminates the worker and releases the full-resolution overlay buffer while leaving the camera stream live. Camera off, capture error, device replacement or window teardown disposes tracking too. Worker/model/bitmap failures and initialization/inference timeouts hide the accessory and report only to Teach. Toggle tracking off/on to restart without restarting the camera or lesson.

## Automated verification

| Check | Actual result |
| --- | --- |
| `npm test` | 438 passed, 0 failed, including existing audio/lesson coverage and camera/tracking IPC/lifecycle tests |
| `npm run check:games` | 33 passed, 0 failed |
| `npm run build:renderer` | Passed, including local asset validation and classic-worker bundling; existing Vite large-chunk warning remains |
| `npm run build:main` | Passed |
| `npx tsc --noEmit -p tsconfig.json` | Passed |
| `scripts/camera-smoke.cjs` | All 11 Phase 1 synthetic-camera groups passed |
| `scripts/reconstruction-smoke.cjs` | All 9 existing lesson groups passed, including drawing, navigation, cards, rewards, video, save/reopen |
| `scripts/face-tracking-smoke.cjs`, built file:// renderer | All 8 real-model fixture groups passed |
| Same face test against Vite development server | All 8 groups passed |
| Desktop/narrow screenshots and `git diff --check` | Reviewed/passed; no horizontal overflow in Face Tracking section |

The face test uses an upstream MediaPipe public portrait converted into a moving/tilting green-backed synthetic webcam video. It checks real model output and marker pixels, mirror/crop/preset alignment, independent visibility toggles, actual no-face inference and recovery, simulated worker failure/restart, one webcam, one worker and one frame in flight, bounded inference resolution/cadence, hidden pause, and worker/buffer/track cleanup. Application external HTTP(S) requests are blocked; the development run allows only its own loopback server. The test has no production test hook: worker/camera instrumentation is injected only by the test harness.

The final built-renderer sample measured **29.3 ms median / 58.9 ms p95** from frame admission to worker result, across 38 fixture results (maximum 159.0 ms). Development measured 30.7 / 59.2 ms. These are short-run observations on this machine, not guaranteed physical-camera latency or a combined meeting-load benchmark. Camera draw timestamps are retained in results for inspection.

Evidence is in `docs/face-tracking-phase2-evidence/`: root and `development/results.json`, tracking screenshots, `camera-regression/`, `lesson-regression/`, and logs. The source fixture is fetched only by the test script (or supplied through `STORY_STUDIO_FACE_FIXTURE`), not bundled into the app. Fixture snapshots are not evidence of physical face tracking.

## Physical-webcam checklist

1. Start `npm run dev`, open a lesson, choose Teach and turn the camera on. Enable **Face Tracking**; wait for **Tracking face**. Confirm three small markers and the purple temporary hat.
2. Move left/right and up/down, approach/recede, tilt your head, look left/right and nod. Check that the hat follows and leaves eyes/mouth visible. Leave room above your head for the accessory.
3. Toggle mirror, then Full Screen, Lower Left and Lower Right. Confirm markers remain on the same facial points and the hat follows the camera crop. Test Hidden and return.
4. Enable chroma key and adjust tolerance/softness/brightness/contrast. The camera should still key correctly and the hat should remain visible beyond the original silhouette.
5. Hide markers and hat separately. Move out of view: the hat should disappear. Return and confirm recovery. Turn tracking off: the camera must remain live. Turn camera off: the camera light should go out and tracking stop.
6. Draw, zoom/pan, navigate scenes and play lesson video/audio while tracking. Check normal responsiveness and unchanged audio. If desired, share only Presenter and inspect the remote output on another device.

## Limits and recommended next step

Physical-webcam tracking, real yaw/pitch under occlusion, prolonged load, audible hardware output, meeting capture and an installed ASAR/installer were not tested. Built file:// and Vite renderer paths were tested. Low light, extreme angles, fast movement or another face entering may cause loss/jitter. The weak-perspective placeholder is not a fitted 3D costume and has no hair/face occlusion mesh; edges crop at the camera frame, so headroom matters. Settings remain session-only.

Recommended next step: run the physical checklist on the actual teaching setup and assess tracking lag, stability and hat fit before commissioning Merlin assets or authorizing another phase. Phase 3 remains unstarted.
