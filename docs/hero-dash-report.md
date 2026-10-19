# Hero Dash implementation — 17 October 2026

Implemented in `D:\AI\GitHub\Story-Studio`, the existing application. The requested `D:\AI\SET OUT\GAMES\Hero Dash` directory was empty; no separate game application was created.

## Phase 1

Implemented two lanes, red/blue modular low-poly runners, a fantasy forest track with six numbered checkpoints and a separate finish, gates, flags, stones, hurdles and decorations. Logical spaces animate continuously with running limbs, hurdle jumps and dust. The elevated chase camera follows either racer and smoothly frames both when close. Control owns names, logical positions, scores, active racer, question cursor, status and a bounded action history. Reset and undo work without changing saved questions.

Validation: pure progression tests cover ready/paused guards, awards, finish bounds, reset, undo and nonpunitive incorrect answers. The renderer type-checks and builds. Native screenshots verify the rendered track. Older hardware has not been benchmarked; the scene caps rendering at 30 FPS, caps pixel ratio at 1.5, and uses no shadows, physics, post processing or external character downloads.

## Phase 2

Hero Dash launches from the existing Mastery library. A dedicated teacher panel runs in Control. Present mounts only the student race surface inside the existing presentation shell. The existing snapshot relay carries a whitelisted projection; private notes, the question library and editing controls never enter it. This activity uses Control authority directly rather than mounting a writable iframe module.

Controls include start, pause/resume, racer selection, camera A/B/both, +1/+2, incorrect/retry, show/hide image, previous/next question, undo and reset. Question text is optional and can be hidden. Per-card reward and private answer notes are editable. Question display freezes visual movement; awarding hides the image and resumes movement. Images fit a reserved area beside the default lower-right webcam and above the subtitle area.

Local multi-file imports reuse Story Studio's media importer and durable episode asset storage. Episode images and imported images can be browsed as thumbnails, added as question cards, selected, reordered and removed. Save race & questions uses the existing episode save. New race and Load saved race operate on reusable `hero-dash` episode activities.

Validation: native Electron/Playwright smoke tests use actual Control and Present windows with disposable episodes. They cover launch, synchronized awards, pause/undo, question media, private-note exclusion, copied local image files, save, relaunch, reopen from disk, portable export and import into a different folder, working imported image URLs, and narrow layouts. A simulated camera stream remains visible and translation controls remain mounted. An intentionally broken question image reports an error in Control; hiding it restores readiness. The focused code review found a readiness issue, which was fixed and rechecked.

Remaining limits: cross-lesson/computer transfer uses the existing **Export portable episode / Import portable episode** workflow. It carries the episode and its assets; there is no separate race-only package merger or global activity catalog. Runtime positions and scores reset on reopening. No temporary blob URLs are persisted. Actual microphone translation, subtitle transcription and a physical webcam session have not been exercised; their existing implementations were preserved. Alternate webcam placements can overlap the question card; the card is laid out for the default lower-right placement. No permanent student rewards are automatically granted.

## Phase 3

After the core and integration smoke checks passed, added short/medium/long configurations with 6/8/10 checkpoints through the same renderer, a teacher +3 bonus, and bounded manual position override with undo. Typed future bonus events cover speed boost, shortcut, double movement, catch-up, obstacle challenge and teamwork gate; these are extension placeholders and do not secretly affect outcomes. Running, jumps, dust, progress indicators and confetti remain lightweight. Celebration waits for the runner's visual arrival at the finish.

Validation: medium/long finish rules and paused manual override are covered by tests. Native smoke covers both longer formats, +3, finish arrival/celebration, override and undo. No deployment blockers remain for using the locally built MVP. Elaborate assets and fully implemented future bonuses remain outside today's MVP.

## Verification and evidence

- Renderer TypeScript check: passed.
- `npm run build:renderer`: passed (Vite reports bundle-size warnings).
- `npm run build:main`: passed.
- `npm test`: 588 passed, zero failures, including seven Hero Dash tests.
- `npm run check:games`: 62 passed, zero failures.
- `node scripts/hero-dash-smoke.cjs`: passed with native Control/Present, portable media, failure recovery and layout checks.
- Focused diff whitespace check: passed.

Evidence: `docs/hero-dash-evidence/results.json`, `present-race.png`, `present-question-camera.png`, `present-finish.png`, `control-desktop.png`, `control-narrow.png`, and `present-narrow.png`. The webcam in screenshots is the test camera stream.

## Use for the lesson

Start Story Studio normally, open a lesson, enter **Mastery**, and choose **Launch Hero Dash**. Start the race from Control. Use **Import Images** or the Story Studio media pool to add question cards; show an image, ask verbally, then award movement. Use **Save race & questions** to keep configuration, cards and media associations. Use portable episode export/import to reuse it in another folder or computer.

All changes remain local. No production deployment, release packaging, push or unrelated refactor was performed; existing working-tree edits were preserved.

Optional cleanup of generated temporary test folders was blocked by automatic policy review with no specific reason supplied; these folders remain in place. This does not affect the application or the test results.
