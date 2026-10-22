# Edit video range controls and workspace resizing

The selected video scene has Play, Pause, Stop and two trim handles in the timeline header, between the scene actions and zoom. The blue container is aligned to zoom, uses its original compact height, and requests 750px width (1.5 times the initial 500px), shrinking to available space or wrapping on narrow windows. It operates the existing canvas decoder; the Media Pool preview is unchanged.

Optional `background.videoTrim` stores non-destructive start/end times on a scene. Old scenes retain full-video defaults. Playback and seeks stay within the range; Stop returns to its start, and Play at the end restarts it. Each handle gesture is one undo step. Background replacement clears the old trim. Lesson validation, media dependency inspection, scene projection, portable packages and Teach/Present playback all understand the range. Actual source bytes and media IDs are unchanged.

The Media Pool divider's maximum saved width increased from 420px to 800px. Layout caps the visible width to leave 240px of canvas, and preferences stay in local storage. Dragging, keyboard resizing and double-click reset remain available.

Verification:

- 627 Node tests passed, including new scene trim validation/projection/history tests and portable image/video round-trip coverage.
- Renderer and main builds passed; renderer TypeScript checks passed.
- `node scripts/scene-video-trim-smoke.cjs` passed six native workflow groups: actual handle dragging/grouped undo, existing-decoder play/pause/stop and seek bounds, scene switching/save/reload/source hashes, sidebar expansion past 600px and reset, original-height wide controls, keyboard/narrow layouts, and actual Present playback within the saved range.
- Snapshot acceptance was observed during native testing. An unresolved-source publication race was corrected: media intent is included only when the projected scene has a resolved video background. Final checks recorded zero rejected snapshots and zero page errors.
- Screenshots inspected at 1920px, 1440px, 700px and 390px. Evidence and native results are under `output/playwright/scene-video-trim/`.

No physical video trimming, transcoding, committing or pushing is performed. Native range input step is 0.01 seconds; actual frame timing follows the source video's frame rate. Linked occurrences of the same scene share its trim, like other scene settings.
