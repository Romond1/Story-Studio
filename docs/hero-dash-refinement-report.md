# Hero Dash refinement — 17 October 2026

Both passes extend the existing Story Studio implementation. No separate game app, Presenter renderer, camera service, translation service or communication channel was introduced.

## Pass A — teaching workflow

- Replaced the opaque cream question panel with a centered, contained image over a subtle darkened race scene. Portrait, landscape and square images retain their complete aspect ratio. There is no empty caption slot. Entry and dismissal use a 320 ms fade/scale transition.
- The question's size adapts to the actual game viewport, live corner webcam and caption rectangles. Without those overlays it can use 86% of viewport width and 76% of height; it reduces its centered size when necessary to keep image content clear of the camera/subtitles. Resizing and camera/caption changes recalculate the fit. Image loading is asynchronous; failures hide the image and report to Control.
- Added a direct **Drop images here / Browse files** area and selected thumbnail grid. Native files from Explorer/other folders import directly, with filename labels, double-click to show, and removal from the current review.
- **Imported Images** and **Episode Images** are separate sources. Imported files are copied into Story Studio's app-owned review library; the current episode's media pool is unchanged. PNG, JPG/JPEG, WebP, GIF and BMP use the existing importer. Unsupported files report a reason, and drops prevent window navigation.
- A thumbnail can be shown immediately without preparing a question card. Correct/Excellent/Bonus awards dismiss it and move the racer. **Pin image** keeps it open while movement continues. Incorrect leaves position unchanged. Prepared text, private notes, per-card rewards, ordering and removal remain available in a collapsed editor.
- **Save review collection / Load review collection** persist reusable reviews independently of the episode. Saving a review captures any referenced episode images into the review library, so the collection can be used with another episode. Images are deduplicated by content when captured from episodes. Imported originals can be deleted after import.
- Racer selection and award controls remain visible while scrolling the library. Start, pause/resume, undo, reset, restart, names, points, manual position override and history remain available.

Pass A was tested before Pass B began. Its native gate passed actual-file multi-image drag/drop, Browse, image aspect ratios/centering, spontaneous questions, pinning, private-note exclusion, unchanged episode assets, narrow layouts, and application restart after deleting the original imported files.

## Pass B — race presentation

- Default track: **20 numbered spaces plus the finish**. New track lengths range from 10–30. Previously saved 6/8/10-checkpoint configurations still parse and run.
- Checkpoint numbers are painted on ground tiles in both lanes. Repetitive overhead gates were removed; only start and finish gates remain.
- Geometry/materials are reused. Center stripes are instanced. Trees, mountains and fence posts use bounded counts spread over the route; color zones provide progression without multiplying the entire environment.
- Camera modes: **Follow Red, Follow Blue, Side View, Race Overview, Orbit Camera**. Transitions ease over roughly 600 ms. Overview frames the racers' current span using the viewport's field of view. The dedicated drag/arrow-key orbit pad limits vertical rotation and does not share the image drop area.
- The active-race HUD is compact, with names, positions, points, active-racer styling and a leading/tied indicator. The larger title remains for the ready screen.
- Improved blocky placeholder faces, eased running limbs, small answer jumps, bonus sparkles and the existing visual-arrival finish celebration. A separate racer factory makes later models replaceable without changing progression.
- Inspected Blocky World's character sources and model directory. It has procedural Yuki/Mia code, but no ready GLB assets. Kept the lighter generic red/blue placeholders for today's lesson; Blocky World was not changed.

## Verification

- Renderer TypeScript check: passed.
- Renderer and main-process builds: passed. Vite's bundle-size warnings remain.
- Shared test suite: **594 passed**, zero failures.
- Focused Hero Dash progression/layout/library tests: **13 passed**, including asynchronous-save state preservation, final-card removal, legacy/new track lengths, finish bounds, pinning, centered camera-safe layout and independent persistent storage.
- Existing-game checks: **62 passed**, zero failures.
- Native Electron/Playwright workflow: passed in actual Control and Present windows. It covers file drop paths, Browse, thumbnail selection, image aspect ratios, pin/unpin awards, private prepared notes, unchanged episode asset records, app restart/deleted originals, five camera modes, orbit input, manual override/undo, 30-space progression, resizing and a published subtitle alongside a simulated live webcam.
- Focused code review found two state bugs (save completion restoring old state and removal leaving a stale question cursor). Both were fixed and regression-tested.

Run the current native workflow with `npm run test:hero-dash`. The old `scripts/hero-dash-smoke.cjs` entry forwards to it. Screenshots and results are in `docs/hero-dash-refinement-evidence/`.

## Lesson workflow

1. In Story Studio, choose **Mastery → Launch Hero Dash** and **Start race**.
2. Drop images into the library, or use **Browse files**. Choose **Episode Images** to use current episode media.
3. Select the red or blue racer, click a thumbnail, and choose **Show Question**. Double-clicking a thumbnail shows it immediately.
4. Ask verbally, then choose **Correct +1**, **Excellent +2**, **Bonus +3**, or **Incorrect / retry**. Use **Pin image** when it should stay visible during movement.
5. Choose **Save review collection** to reuse the review with another lesson on this computer. Prepared questions and race settings are optional.

## Remaining limits

- Review collections and imported files are stored under the current Story Studio user-data folder's `hero-dash` directory. There is no separate review-package export/import UI yet. Existing portable episode export does not bundle the independent review library for another computer; keep a backup of that folder.
- Importing captures files durably immediately; collection configuration is saved when **Save review collection** is clicked. **Save to episode / Save lesson** remains available for episode configuration.
- Removing a thumbnail detaches it from the current review; shared stored files are retained so other saved collections are not broken.
- Webcam layering was tested with Electron's simulated camera. A caption was published through the existing subtitle API. Actual microphone transcription/translation and a physical-camera session were not tested.
- Older-laptop performance has not been benchmarked. Rendering remains capped at 30 FPS, with capped pixel ratio, no shadows/post processing, shared geometry and lightweight effects.
- Final character assets and any elaborate bonus mechanics remain outside this refinement. No production deployment, release packaging, push or unrelated refactor was performed.
