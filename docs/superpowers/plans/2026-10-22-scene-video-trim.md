# Scene video trim toolbar

Keep the toolbar inside LessonTimeline's existing header: scene/section/menu actions, then selected-video playback and range controls, then timeline zoom. It appears only in Edit for a selected video scene. Native image/video pool previews are unchanged.

User refinements: group the controls in a subtly blue container next to zoom; keep its original height and increase only its desired width from 500px to 750px, extending left. Expand the Media Pool resize limit from 420px to 800px while preserving usable canvas space.

Store optional `background.videoTrim` per scene using the existing `VideoTrimSettings` contract. Reuse normalization/clamping helpers. Preserve old projects, source files and asset identity. Extend lesson/episode validation and scene projection; send saved trim through the existing presentation media engine. Reset a scene's trim if its background asset changes.

Use the single existing canvas decoder for Play, Pause, Stop and local trim enforcement. Do not create another video. Stop returns to trim-in; playback restarts at trim-in when already at trim-out. Bounds clamp seeking and stop at trim-out. Clean up listeners and active animation work when the decoder/trim changes or Edit ends.

Use two accessible native range handles over one track with highlighted retained interval, a passive playhead and readable start/end/retained duration. Keep handles apart by at least a small positive interval. Group pointer/keyboard handle edits into one history revision per gesture. Wrap controls within the header at narrow widths.

Implement and verify in this order:
1. Add failing tests for scene trim edits, validation, projection, source/reference preservation, history and portable package roundtrip.
2. Implement persisted trim helpers and validation.
3. Connect the existing canvas video to a compact trim toolbar and enforce bounds during Edit playback; wire saved bounds to presentation playback.
4. Verify real Electron play/pause/stop, two-handle dragging, undo/redo, save/reload, scene switching, no extra decoder, and header placement at desktop/narrow widths. Verify Present obeys the saved range. Run relevant/full tests and builds. Leave changes uncommitted.
