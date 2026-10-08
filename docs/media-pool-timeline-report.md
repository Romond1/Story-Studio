# Media Pool and object-based timeline — implementation report

Date: 2026-10-08. Stop condition D is resolved. M1–M8 are implemented; M9 automated checks are complete, with human parity acceptance pending. The legacy navigator remains available. No production episode files were edited.

## Edit and Live authority

`useEditSelection` holds Control-local selector fields. The existing `PresentationSession` remains the sole live authority. A pure adapter lets the Edit canvas use the existing target resolver without committing a session or mounting a second presentation engine. Authored mutations still use the same project and history commands, addressed to the Edit selection. The cursor, zoom and collapse state are not serialized into lesson content.

Show in Present explicitly commits the selected target through the existing session reducer. Opening Present or switching modes does not copy the Edit cursor into Live. Live projection, card runtime, media identity and video transport remain attached to the live target in both modes. Invalidated editor selections are reconciled after document changes.

## Audio

Edit navigation does not issue broadcast audio-stop commands. Editor audio previews use local media elements, and Edit video inspection does not attach a duplicate player to the broadcast mixer. Live transport continues independently. Audio removal and volume shortcuts were also audited: editing hidden targets does not stop or change live channels. Actual Teach target changes and explicit Show in Present retain intentional live stop behavior.

## Media Pool and timeline

- One project asset collection; optional bin metadata organizes it. Existing copying, UUID storage, relative paths and display naming are reused by native file/folder import and Explorer drops. Nested folders become bins. Unsupported or failed files are reported alongside successful imports.
- Pool search, type/usage filters, bin organization, multi-selection and image/video previews. Audio assets can be attached to authored dialogue, SFX or BGM fields. Pool import alone does not place slides; unused assets remain available.
- Horizontal structural timeline with section and break boundaries, exact insertion slots, deterministic multi-asset placement, within-section reorder, section commands and existing history. Explorer-to-timeline imports and places through the same importer.
- Separate Edit and LIVE markers, section collapse, global density zoom, pointer anchoring, wheel and middle-button pan. High zoom uses passive existing scene primitives; no authored geometry changes or playback engine is created.
- Content added through the Lesson area uses an ordinary Lesson section because slide section ownership is required. No nullable/root ownership schema was introduced.

Cross-section moves are deferred: the existing move helper is section-scoped, and safe reference/break/Card V2 ownership changes need a separate audit. Generic new slide duplication was not invented; existing break duplication and inspector capabilities remain. Usage is a derived authored-reference count, not a new dependency database. Teach navigation remains on its existing component. The legacy layout is retained until the capability checklist is accepted.

## Verification completed

- `npm test`: **304 passed, 0 failed**, including targeted independent Slide 15 / Live Slide 12 selection, section browsing, no browse audio stops, explicit handoff, selected-target authoring/history, mode switching and save/reopen without cursor persistence.
- `npx tsc --noEmit`, `npm run build:renderer`, `npm run build:main`: passed. `git diff --check`: passed (line-ending notices only).
- `scripts/edit-live-browser-test.mjs`: mounted application selection, authored save target, explicit presentation, audio spies and live video identity/playing continuity passed.
- `scripts/media-pool-browser-test.mjs`: folder/bin/filter, multi-drop exact placement, undo/redo, audio attachment, both Explorer routes, reorder, section/break/Lesson creation, collapse, single row, zoom anchoring, middle pan, passive preview and save checks passed.
- `scripts/card-v2-independent-browser-test.mjs`: Card V2 authoring/presentation/persistence workflow passed. Existing legacy persistence regression tests remain passing.
- `scripts/episode-readonly-open-check.mjs`: Episodes 1–6 opened using the actual main loader; before/after hashes match. No saves or production mutations were performed.

Browser tests use a native IPC fixture; they do not prove physical OS drag/drop or audio-device routing. Evidence and screenshots are in `docs/media-pool-evidence/`. An installer/package release was not built.

## Manual acceptance checklist

1. Open a copy of an existing lesson; import a nested folder into Pool. Check hierarchy, duplicate names, unsupported-file reporting, search/type/usage filters and bin moves.
2. Drag an image into Section 1, a video between slides, and several selected assets into one exact slot. Check order and undo/redo.
3. Drag real files/folders from Windows Explorer into Pool (import only), then into Timeline (import and placement). Exercise native file and folder dialogs.
4. Add Section, Break and Lesson content; reorder within a section, collapse/expand, rename/delete and duplicate a break. Cross-section moves are intentionally unavailable.
5. Zoom around the pointer, pan with wheel and middle button, inspect overview and detailed frames, and compare card/bubble/audio indicators with actual authored content.
6. With Present on Slide 12 playing music/dialogue/video, inspect Slide 15 and another section in Edit. Check no live interruption, including local preview controls, audio removal and volume shortcuts. Edit Slide 15 and confirm the saved change belongs to Slide 15.
7. Use Show in Present; verify the selected content appears and intentional live media transition behavior still works. Test the actual Present sharing window and your audio output devices.
8. Switch Edit/Teach repeatedly; verify independent valid targets, then save/reopen and confirm authored changes, bins and unused assets persist.
9. Compare the timeline and inspector against `docs/edit-workspace-inventory.md` and the legacy navigator before approving replacement. Legacy removal is not part of this delivery.

Manual acceptance remains pending; no claim of full desktop playback or legacy parity approval is made.

## Follow-up: Pool drag target repair

Real browser mouse drags reproduced a missed interaction: only the narrow insertion buttons accepted drops; item cards and section surfaces did not. The original synthetic-event test targeted those insertion buttons directly and missed the failure. Section surfaces now share the same drop handler: a slide's left/right half inserts before/after that slide, while headers, empty space and collapsed sections append. The existing highlighted insertion slot shows the destination. Unsupported payloads are ignored. Placement still uses the same document/history commands and does not navigate Live.

The browser regression now performs actual image/video drags into a slot, onto both halves of an item, onto a section header, and onto a collapsed section. It checks exact ordering and undo alongside the existing multi-drop, save and Live-independence checks.

## Follow-up: Frame thumbnails and selected-video controls

At the old default timeline height, frame previews were squeezed to 22px tall (a 39px-wide fitted image). The Edit timeline now reserves a 300px minimum for the toolbar, transport and objects, with an 80px minimum frame preview. Teach sizing is unchanged. Image and paused/muted video frame previews are checked at normal window size without first expanding the timeline.

A control row directly below the lesson timeline toolbar provides Play, Pause, Stop, a seek/playhead slider and elapsed/end time for the selected Edit video. It operates the existing canvas video element; native controls stay synchronized through media events. Stop pauses and returns to trim-in. Selecting an image disables transport. No live session, mixer or authored document command is involved. Selection itself remains paused; press Play to preview.

Browser checks passed for advancing playback/playhead, pause, seek, stop, disabled image transport, passive video frames and unchanged Live target/audio-stop calls. The full 304-test suite, typecheck and renderer/main builds passed. Screenshots include `media-pool-evidence/video-transport.png` and the updated frame view in `desktop.png`.

## Follow-up: Electron-specific blank frames and inline transport

The preceding height fix did not address the blank frames in the desktop screenshot. Running the regression in the installed Electron 34 runtime reproduced the remaining cause: `.timeline-preview` shrink-wrapped to **0px wide** when its frame contained only absolutely positioned descendants. `LogicalSceneFrame` consequently applied a zero scale. The newer standalone Chromium test had stretched this container, hiding the defect. Explicit `width:100%` and stretch alignment now preserve its width in Electron.

The transport is now inside the existing toolbar between lesson actions and zoom, with a flexible seek bar. The separate transport row is removed. Narrow windows can scroll the single toolbar horizontally instead of adding another row.

Verification: `$env:TEST_ELECTRON='1'; node scripts/media-pool-browser-test.mjs` passed in an isolated offscreen Electron window, including loaded image/video frame geometry and transport containment within the toolbar. The original browser workflow passed after the toolbar move; the Edit/Live independence workflow, typecheck and renderer build also passed. Updated desktop and transport screenshots were captured from Electron and visually inspected. Native lessons were not modified.
