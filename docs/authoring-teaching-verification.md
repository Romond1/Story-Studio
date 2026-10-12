# Authoring and teaching usability verification

Implemented locally on `story-studio-rebuild`. The corrected specification is in `docs/superpowers/specs/2026-10-08-authoring-teaching-design.md`.

## Completed

- **P1 — Teaching session state.** Stable sequence/entry identity isolates each occurrence, including linked scene reuse. Faces, concealment, temporary Card positions, drawing history and viewport survive navigation. Reset Scene restores authored defaults; New teaching session starts fresh. Temporary state never enters the project save.
- **P2 — Sections and Breaks.** Stable named Sections support creation, inline rename, membership changes, ordering, collapse/expand and Teach navigation. Ungrouped scenes remain supported. Breaks are ordinary editable scenes with a review text/bubble template and a distinct timeline appearance. Existing section labels migrate without changing sequence order. Duplicating a Break retains its type and applicable section.
- **P3 — Workspace.** Media Pool, Inspector and timeline have draggable/keyboard-operable splitters, bounds and double-click/Home reset. Sizes persist in local storage. The retained uniform logical-frame transform letterboxes the canvas; panel resizing never changes authored objects. Inspector headings, nested groups and surfaces are clearer.
- **P4 — Pointer controls.** Middle-button drag pans Edit, Teach and timeline, including when any drawing tool is active. Empty left-drag never pans. Alt+wheel zooms under the pointer; existing zoom/pan controls remain. Short Card clicks interact; drags do not also flip. Live Card movement publishes through the existing session/projection authority and matches Present throughout the drag. Bubbles and text do not move in Teach. Cancellation and focus loss roll back an unfinished gesture. Context menus offer Edit actions or Teach navigation/tool actions.
- **P5 — Drawing.** Pen, highlighter, whole-stroke eraser, size/color, undo/redo and confirmed clear use the retained renderer and logical coordinates. Teach drawing history is session-only and occurrence-local. The eraser respects line segments between sampled points. Authored ink is not erased by temporary teaching actions.
- **P6 — Card reuse.** Ctrl+C/Ctrl+V outside text fields, Copy to Scene, Move to Scene and body-drag to timeline use independent editable Card content. Move is explicit; pointer transfer always copies. Destination selection and normal edit undo are preserved. Resize gestures cannot trigger a cross-scene copy. Card Library and explicit linked Library reuse remain available.

Mouse side buttons and browser-navigation commands are guarded only while a lesson is open; horizontal overscroll navigation is disabled. Ordinary text editing, consumed control keys, application navigation and menu/dialog keyboard handling are preserved. The implementation uses the Electron version already installed, without upgrading dependencies.

Scene audio remains scene-owned. Section-level music/settings and a cross-project template library are deferred; no old Break engine or separate Card runtime was introduced. Language Game and Final Boss remain unimplemented.

## Verification performed

### Follow-up verification — 2026-10-09

The implementation was already committed at `1bfb10f` when the follow-up request arrived. A fresh run confirmed all 406 unit tests, the renderer and main builds, the renderer TypeScript check, all 10 Electron usability groups and all 9 Electron regression groups pass. A separate read-only review found no actionable defects in the corrected mouse handlers. No additional application source changes were needed. Desktop, compact and Present screenshots were inspected again.

The usability screenshots and `results.json` were refreshed. The new disposable lesson is `D:\Temp\story-usability-5SDzjD\Disposable-lesson`; the reusable checked-in demo remains in `docs/usability-demo`. Fresh regression evidence is in `output/playwright/usability-regression-2026-10-09`. A recovery branch, `codex/usability-checkpoint-2026-10-09`, preserves the implementation commit. Physical wheel-tilt/driver behavior remains a manual acceptance item.

### Full-pass results

- `npm test`: **406 passed, 0 failed**. The test command now executes nested scene tests that were previously compiled but skipped by the top-level glob.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build:renderer`: passed, with the existing large-chunk advisory.
- `npm run build:main`: passed.
- `scripts/reconstruction-smoke.cjs`: **9 Electron regression groups passed**, exercising native Control/Present windows, media import, Cards/Bubbles, independent Edit/Live cursors, video ownership, rewards, undo/redo, 4:3 composition and authored save/reopen.
- `scripts/usability-smoke.cjs`: **10 Electron usability groups passed**, covering Sections, two image objects in a Break, all splitters, correct aspect/geometry, Edit/Teach/timeline panning, drawing tools, click/drag distinction, boundary clamping, focus cancellation, retained state, right-click menus, clipboard/transfer/move undo, shortcut isolation, side-button event guards and fresh save/reopen behavior.
- Separate code reviews found and resolved section-boundary reorder, Break identity duplication, section-cap consistency, draft/Present boundary mismatch, resize-to-copy confusion, consumed keyboard shortcuts and focus-loss cancellation.
- Desktop, narrow and compact screenshots were inspected. At narrow widths, toolbar overflow scrolls horizontally; compact layouts stack panels.

The Electron harness replaces only native folder-selection dialogs. Interaction checks operate on actual renderer windows and Present output. Synthetic side-button events prove the application guard, not a particular hardware driver's behavior.

Evidence: [test log](usability-evidence/tests.log), [usability run](usability-evidence/results.json), [regression run](usability-evidence/regression/smoke-results.json), [desktop Edit](usability-evidence/desktop-edit.png), [narrow Edit](usability-evidence/narrow-edit.png), [compact Edit](usability-evidence/compact-edit.png), [editable Break](usability-evidence/break-edit.png), [Present](usability-evidence/present.png).

## Disposable demonstration

Open the folder **`docs/usability-demo`** using Open project. It contains two populated Sections, an extra empty Section, an ungrouped scene, a Break with text/bubble/two image objects, multiple Cards and an Activation destination with independent copied content. The live-state demonstrations are intentionally not persisted in its `project.json`.

To rerun after the test compilation and both builds, set `STORY_STUDIO_PLAYWRIGHT` to an available Playwright package directory and run `node scripts/usability-smoke.cjs`. The fixture uses FFmpeg for two simple image assets and creates a new temporary lesson each time. `STORY_STUDIO_EVIDENCE` optionally redirects the earlier reconstruction harness's output.

## Short manual acceptance checklist

1. Open the demo folder. Add/rename a Section, move a scene into/out of it, reorder, collapse and expand. Add a Break and edit its ordinary objects.
2. Resize each panel and double-click its splitter to reset. Check the scene proportions and Card geometry; reopen the app to confirm preferred dimensions persist.
3. In Edit and Teach, middle-drag the canvas. Repeat with Pen, Highlighter and Eraser active, and on the timeline. Check Alt+wheel zoom and ordinary left-click/drag behavior.
4. In Teach, flip/conceal a Card, move it, draw, pan and zoom. Navigate away/back and confirm retention. Watch Present mirror the movement without flipping. Try Reset Scene and New teaching session.
5. In Edit, right-click a Card and copy/move it to another scene. Try Ctrl+C/Ctrl+V and body-drag onto a timeline tile. Undo. Confirm source content remains independent and text-field clipboard operations stay native.
6. On the teaching machine, exercise physical side buttons and wheel tilt, including the actual mouse-driver profile. Verify ordinary application navigation and text editing. Recheck microphone/virtual audio routing in the real conferencing setup.

## Limits and recovery

- Present remains a passive student surface; direct dragging in Present is not implemented. Control owns live interaction.
- The eraser removes whole strokes. Edit drawing uses ordinary authored undo/redo; Teach has separate drawing history.
- Hardware/driver macros that emit indistinguishable ordinary keyboard shortcuts (for example Alt+Left) cannot be selectively identified as wheel tilt. Those ordinary shortcuts remain untouched to preserve intentional navigation. BrowserBack/BrowserForward commands, side-button events and horizontal overscroll are guarded.
- No packaged installer, physical audio/driver acceptance or extended classroom soak test was performed. Automated GUI evidence does not replace those checks.
- Original Episodes 1–6 were not opened or modified. Legacy-mode files and earlier recovery references remain intact.
- Pre-pass recovery tag: **`authoring-teaching-checkpoint-2026-10-08`**, at **`650689e`**. The implementation stays on **`story-studio-rebuild`**; no remote push or merge was performed.
