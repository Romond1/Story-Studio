# Media Pool usability — implementation and QA

## Behavior

- Visual media uses `VID - Title` and `PIC - Title` in accessible labels, and an uppercase badge plus a two-line title on the card. Both scene and legacy Media Pools share this presentation.
- Existing imports get a derived filename title without a migration write. Recognizable resolution, codec, frame-rate and export metadata is removed; date/time suffixes are removed; meaningful words and chapter/year numbers remain. Previously imported duplicates are retained for compatibility. New imports compare original filenames (case-insensitive, including extension) and offer Keep existing / Use incoming, with an apply-to-all checkbox for each bulk import. Differently named files remain separate. Incoming replacements preserve IDs, display titles, bins and authored references; previous bytes remain for Undo.
- Rename stores only the optional `AssetItem.displayTitle`. Original filenames, UUID storage names, paths, reference metadata and scene references stay intact. Rename uses each editor's existing project history.
- A normal click or keyboard activation selects and previews visual media. Modifier clicks retain selection behavior; dragging retains the existing ID payload. Double-click never inserts. Add to Sequence is explicit and uses the existing insertion command.
- Right-click an image or video for exactly two actions: Remove from Media Pool and Add to Sequence. Both target that individual asset. Removal stores optional pool-membership metadata, so existing scenes, registry entries, source bytes and portable packages remain valid. It supports undo/redo and save/reload. The menu supports arrow keys, Enter, Escape, outside click and focus return; it stays within narrow window bounds.
- The native dialog confines focus and fits the viewport. Close, Escape and backdrop click dismiss it and restore focus. Images retain their aspect ratio. Videos use one local muted looping preview element with native play/pause and seek controls. Closing pauses it, removes its source and releases media resources. Development StrictMode setup restores the released source on that same element.
- The enlarged, borderless preview sits at the top of the window aligned with its Media Pool, covering the header area instead of the central canvas. It follows pool/window resizing and remains within viewport edges. Media runs to the preview edges, with an overlaid X and the title/actions underneath.
- Legacy capture-phase shortcuts ignore an open dialog, protecting authored Cards and history behind the preview. Native video controls retain keyboard behavior.

## Changed files

| Files | Purpose |
| --- | --- |
| `src/shared/mediaDisplayName.ts`, `src/shared/types.ts` | Derived naming and immutable custom-title edits |
| `src/shared/lesson/validation.ts`, `src/shared/episode/validation.ts` | Validate optional titles and allow them through episode/package persistence |
| `src/renderer/MediaPoolThumbnail.tsx`, `src/renderer/MediaAssetPreview.tsx`, `src/renderer/mediaPoolPreview.css` | Shared compact cards, accessible preview, rename form and responsive styling |
| `src/renderer/MediaPoolContextMenu.tsx`, `src/shared/mediaPool.ts`, `src/shared/mediaPoolActions.test.ts` | Single-asset right-click actions and undoable pool removal that preserves media registrations |
| `src/renderer/lesson/LessonMediaPool.tsx`, `src/renderer/MediaPool.tsx` | Integrate display names, preview, selection and rename into both pools |
| `src/renderer/App.tsx`, `src/shared/keyboardShortcuts.ts` | Wire legacy explicit insertion and exclude dialog interactions from capture shortcuts |
| `src/shared/mediaDisplayName.test.ts`, `src/shared/keyboardShortcuts.test.ts`, `tsconfig.test.json` | Naming, immutable rename, validation/history and keyboard ownership tests |
| `src/shared/lessonPersistence.test.ts`, `src/shared/episodePackageService.test.ts` | Actual save/reopen and portable image/video export/import with exact metadata and source bytes |
| `scripts/media-pool-usability-smoke.cjs` | Native Electron regression checks and screenshot/layout evidence |
| `docs/superpowers/specs/2026-10-22-media-pool-usability-design.md`, `docs/superpowers/plans/2026-10-22-media-pool-usability.md` | Scope and implementation notes |

The Edit preview audio changes already present in `SceneSurface.tsx` and `lessonProjection.test.ts` came from the preceding task and are preserved separately.

## Verification

- `npm test`: 624 tests passed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build:renderer` and `npm run build:main`: passed. Vite retains its existing large-bundle advisory.
- `node scripts/media-pool-usability-smoke.cjs`: eleven native workflow groups passed against the production renderer, including the right-click menu and persisted removal.
- The same native smoke script passed against Vite on port 5174 with React StrictMode enabled, using an isolated Electron profile.
- Desktop (1440px), narrow (700px), and mobile-width (390px) screenshots were inspected. Dialog bounds, horizontal overflow, button bounds and image alt attributes passed the script's layout audit. Long titles were clamped so preview actions remain visible.
- Native coverage includes old imported projects, keyboard opening/focus return, unchanged current scene, double-click and backdrop dismissal, rename/undo/redo/search/save/reload, muted video playback and seek, resource cleanup/reopen, modifier multiselection, drag IDs and actual drop into a sequence, deliberate insertion, folder import with duplicate filenames, type filtering, portrait media, long titles, Edit/Teach separation, and legacy preview/insertion/Card shortcut protection.

Evidence is generated under `output/playwright/media-pool/` and `output/playwright/media-pool-dev/` (ignored build/test artifacts), including `results.json` and screenshots. Tests use disposable projects and an isolated profile; no real lesson files are changed.

## Limits

- Filename cleanup is intentionally conservative and cannot infer a better description from an opaque camera/export filename. Rename supplies the user-authored title; custom titles are limited to 200 characters.
- Very long preview headings show three lines; the complete name is available on hover and in Rename. Thumbnail titles show two lines.
- Preview codecs remain those supported by Electron. Failed/missing sources show a preview-unavailable message. Autoplay can fall back to native controls when policy blocks it.
- Audio keeps its existing selection/attachment workflow. Enlarged previews target images and videos.
- No changes are committed or pushed.


## Follow-up: density and timeline labels

- `MediaPoolZoom.tsx` provides a compact 40–180% slider and Alt + wheel zoom in both pools. The preference is saved locally, outside project history. Cards use a fixed width multiplied by zoom so both axes and text scale together; the grid reflows rather than stretching cards vertically. Viewport width caps cards in narrow panels.
- Removed the selected-media footer insertion button and preview insertion button. Drag-and-drop and the two-action context menu remain available. A normal thumbnail click still opens its preview.
- Compact Media Pool and Episode Content headers recover vertical space.
- `lessonTimeline.ts` derives clean names for imported scene titles without changing custom titles or source metadata. Timeline captions use two lines, tooltips expose complete titles, and the footer shows the selected scene name independently of timeline zoom.
- Reserved toolbar and caption space prevents image/video selection from changing desktop thumbnail geometry.

Validation: 628 unit tests passed; renderer/main builds and renderer TypeScript checks passed. `scripts/timeline-pool-density-smoke.cjs` verifies desktop selection geometry at 80/100/125%, readable titles, proportional width/height/text zoom, Alt-wheel versus ordinary scrolling, removed buttons, context insertion, actual drag/drop and narrow maximum zoom. The existing `scripts/media-pool-usability-smoke.cjs` passes all 11 workflow groups after updating insertion to the context menu. Screenshots: `output/playwright/timeline-pool-density/`.

Very long names remain limited to two lines on cards; the full selected name is available in the timeline footer and tooltip. The smallest panels cap thumbnail width to available space.


## Hover previews

Video thumbnails scrub horizontally with mouse movement, using their existing paused, muted decoder. Moving left/right selects a frame; a stationary pointer does not play the clip. Seek requests coalesce while the decoder is busy. Images enlarge to about 250% of the thumbnail size after a short hover delay, preserve their aspect ratio and stay within the viewport. Card titles use a smaller 10px base font and continue to scale with pool zoom. The enlargement cannot intercept clicks or dragging and disappears on leaving, pressing a key, clicking, scrolling or resizing. Touch users retain the click preview. Click previews retain keyboard/focus handling with a transparent backdrop.

The density smoke test also checks image enlargement and dismissal, forward video scrubbing, stationary paused frames, and transparent click-preview backdrop.

Click-open video previews start unmuted at full player volume for checking dialogue; native volume/mute controls remain available. Hover scrubbing remains paused and silent. Closing the click preview pauses and releases its source.

Timeline video thumbnails now support the same silent positional mouse scrubbing as the pool. Timeline scrubbing reuses the existing thumbnail decoder, respects saved trim bounds, and leaves selection/main playback unchanged. Image and video cards show PIC/VID badges, including derived image backgrounds and compact zoom. Density smoke tests cover badges, forward/backward seeks and stationary paused frames within trim bounds.
