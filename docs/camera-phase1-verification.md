# Presenter camera — Phase 1

Implemented on `codex/presenter-camera-phase1`, 12 October 2026. Existing uncommitted work was preserved. No Phase 2 work was started.

## Files

Created:

- `src/shared/cameraProtocol.ts`: bounded, whitelisted camera settings/status and bridge types.
- `src/shared/cameraSession.ts`: serialized acquisition, cancellation and track-release ownership.
- `src/shared/camera.test.ts`: lifecycle and IPC authorization tests.
- `src/main/cameraBroadcast.ts`: private permission confirmation, transient state and authenticated IPC relay.
- `src/renderer/camera/CameraLayer.tsx`: Presenter-only capture, device enumeration, lifecycle/error handling and draw loop.
- `src/renderer/camera/CameraEffects.ts`: original WebGL2 shader and graphics resource cleanup.
- `src/renderer/camera/CameraControls.tsx`: shared current/legacy Teach controls.
- `src/renderer/camera/camera.css`: camera placement and compact controls.
- `scripts/camera-smoke.cjs`: repeatable synthetic-device Electron acceptance.
- `docs/superpowers/plans/2026-10-12-presenter-camera.md`, this report and `docs/camera-phase1-evidence/`: plan, results, logs and screenshots.

Modified:

- `src/main/presentWindow.ts`: installs camera relay and stops camera on Control reset/Presenter close or crash.
- `src/main/preload.ts`, `src/main/presentPreload.ts`, `src/renderer/vite-env.d.ts`: separate typed role-specific camera bridges.
- `src/renderer/present.tsx`: isolated story stacking context plus sibling camera layer.
- `src/renderer/lesson/LessonTeachControls.tsx`, `src/renderer/TeachLiveControls.tsx`: Camera section in current and legacy Teach.
- `src/shared/presentationSnapshot.test.ts`: adapts the existing test harness to the wrapper and sibling relay.
- `tsconfig.test.json`: includes camera tests.

## Pipeline

Teach sends camera intent through the existing Electron main/preload infrastructure using a separate camera channel. Main verifies the sending window and top frame, strips extra fields, and holds session-only settings. The first enable asks for camera consent in Control; Presenter then calls `getUserMedia` with `audio: false`, preferred 1280×720 and 30 FPS. Ideal constraints allow device-supported alternatives. Control never acquires webcam video.

One CameraSession owns the stream. Device changes release the previous stream before acquiring another. Unabortable permission requests are serialized; a stream arriving after disable is immediately released. Device choices come from Presenter enumeration, with names available where permissions/device support allow.

A muted video element supplies frames to a transparent WebGL2 canvas, capped at approximately 30 draws/second. The original shader computes a green matte from chroma distance, softens its edge, reduces green spill, then applies brightness/contrast and mirror. Premultiplied alpha reveals the existing story. No lesson rasterization, external broadcasting engine or microphone acquisition was added.

The story retains its DOM/SVG/video surfaces and is isolated in its own stacking context. Camera placement lives outside lesson zoom/pan/drawing transforms. Full Screen covers the viewport without stretching (edges may crop); corners contain the image within a 34%-width area. Hidden retains capture and skips GPU draws. Off releases tracks and GPU resources. Position/effect changes do not reacquire the camera. Failures hide only the camera and report privately to Teach.

No dependencies were introduced. The shader is original code; no third-party shader or license bundle was copied. Lesson schemas, database, game data and audio routing code were not changed by this implementation.

## Verification actually performed

| Check | Result |
| --- | --- |
| `npm test` | 433 passed, 0 failed; includes existing audio ownership/routing and lesson tests plus camera lifecycle/IPC checks |
| `npm run check:games` | 33 passed, 0 failed |
| `npm run build:renderer` | Passed; Vite reports the existing large-bundle warning |
| `npm run build:main` | Passed |
| `npx tsc --noEmit -p tsconfig.json` | Passed |
| `node scripts/camera-smoke.cjs` | 11 synthetic-device acceptance groups passed; no page errors |
| Existing `scripts/reconstruction-smoke.cjs` | 9 groups passed: story composition, cards, rewards, navigation, drawing, video/overlays, save/reopen |
| Desktop/narrow screenshots | Inspected; compact controls, aligned sliders/toggles and no camera-section horizontal overflow |
| `git diff --check` | Passed; Git reports CRLF normalization notices in existing files |

Camera acceptance uses Chromium's fake-device flags and an FFmpeg-generated green/red Y4M video. It tests actual Electron IPC, actual getUserMedia capture of that synthetic device, actual WebGL2 output through screenshot pixels, scene navigation, mirroring, brightness/contrast, four presets, zoom isolation, one capture across adjustments, ended tracks after off, missing device, simulated OS denial/disconnection, real WebGL context loss/restore, and reset on Presenter close. Native consent-dialog responses are substituted in the test. Physical webcam, real OS permission prompts, audible hardware output, meeting applications, sustained performance and installer packaging were **not** tested.

Evidence: `docs/camera-phase1-evidence/results.json`, screenshots, build/test logs, and `lesson-regression/`.

To repeat synthetic acceptance, run the builds and unit suite first, then `node scripts/camera-smoke.cjs`. It requires FFmpeg on PATH and Playwright from `STORY_STUDIO_PLAYWRIGHT` or the existing bundled Codex runtime. These are test tools, not added application dependencies.

## Manual physical-camera checklist

1. Run `npm run dev`, open Adventure/Discovery and a lesson, then choose Teach. In Camera, select **Turn camera on**, allow access, and check that Presenter shows the physical webcam. Choose a different camera if available.
2. With a reasonably evenly lit green screen, enable **Green-screen chroma key**. Adjust tolerance and softness until the story is visible through the background; inspect hair/edges. Adjust brightness, contrast and mirror while moving.
3. Switch Full Screen → Lower Left → Lower Right → Hidden. Confirm aspect ratio, correct corners and unchanged effects. Hidden keeps the camera active. Switch back without a capture restart.
4. Navigate scenes, draw, zoom/pan, reveal cards and play a lesson video. Confirm the camera stays independent and existing microphone/music/video audio behaves as before, with no duplicate sound.
5. Turn camera off and check the hardware camera light goes out. Re-enable; then close Presenter and check it releases again. Deny OS permission or disconnect the camera and confirm only Teach shows the error while the lesson continues. Retry by turning off/on.
6. Share only the Presenter window in the chosen meeting app. Verify the remote view contains the story/camera but no Camera controls, device names or errors. Check real sound routing and motion quality with a second participant/device.

## Limitations and Phase 2 handoff

- Settings last for the current app session; no saved camera profiles. Presenter close/crash or Control reload turns the camera off.
- Green key only; no background segmentation, custom key-color picker, sophisticated hair matte or automatic lighting correction. Large tolerance values can remove foreground colors.
- WebGL2 is required for the camera overlay. If unavailable/lost, the camera fails privately and the lesson continues; no CPU fallback. Context restoration supports off/on retry.
- Full Screen can crop the source edges to fill the output. Corners preserve the full camera image. There is no camera preview in Control.
- Real-device exclusivity with meeting apps and sustained combined-load performance still require manual validation. Existing embedded-game operator UI was outside this phase and is not made student-safe by the camera layer.
- Phase 2 should attach MediaPipe Face Landmarker to this same Presenter-owned video/stream, add bounded inference scheduling and a temporary tracked object, and apply matching mirror/placement transforms. Do not open a second webcam or alter microphone ownership. No tracking dependencies, models, costume artwork or translation code were added.

Phase 1 implementation and automated validation are complete. The user subsequently confirmed that the physical-camera feature works and requested a GitHub checkpoint on `codex/presenter-camera-phase1` before Phase 2. That checkpoint includes the existing UI/game source, assets and documentation on which this implementation was built. Phase 2 remains unstarted.
