# Timeline UX reconstruction — implementation and acceptance

Implemented on `story-studio-rebuild` on 2026-10-09. Recovery branch: `codex/timeline-ux-checkpoint-2026-10-09` at `1bfb10f`.

## What was missing from 1bfb10f

The old pass had a flat sequence of scene tiles with Section labels, a separate Section-control row and membership dropdown. It lacked visual Section drop containers, entire-Section drag, marquee/multi-object authoring, a compact pool, unmodified canvas-wheel zoom, and intermediate drawing publication. Existing passing tests did not prove any of those new requirements.

## Implemented behavior

- Real bordered Section containers own their visible scenes. Drag image/video media from the Pool directly into the desired Section, including empty or collapsed Sections. Drag scene selections between containers; drag a Section handle to move all its children together. Ungrouped targets remain available. Run-specific drop boundaries preserve earlier Ungrouped runs in existing lessons.
- A single compact timeline toolbar replaces the stacked section controls and membership dropdown. Scene and Section actions, including rename, Break insertion, keyboard reorder and Activation reuse, are in contextual/overflow menus. Default timeline height is 280px with adjustable bounds; scene previews receive more space.
- Edit canvas and timeline support marquee and Shift/Ctrl selection. Scoped Select All, Copy, Cut, Paste, Duplicate, Delete, Undo/Redo and keyboard navigation work without taking over text fields. Canvas groups move/nudge atomically; copied Cards remain independent. Timeline copies keep lesson order regardless of selection click order. Cross-phase scene Cut/Paste preserves linked identity and consumes the cut.
- Media Pool thumbnails appear immediately below search. Import remains visible; filters, folder import and bins are optional. The asset grid uses remaining panel space. Bin creation uses an inline form compatible with Electron.
- Normal wheel zooms under the pointer on Edit/Teach canvas, without Alt/Ctrl. Middle-button drag pans with every tool. Timeline wheel scrolls horizontally, Alt+wheel zooms, and middle drag pans.
- Teach pen/highlighter/eraser previews reach Present while the pointer is still down. A completed stroke is one history entry. Escape, focus loss, navigation and tool changes cancel transient ink; save excludes it.

The shared Scene/Card architecture, stable entries, ProjectHistory and Control-owned Present snapshot pathway are retained. No original Episodes, Language Game or Final Boss implementation was changed.

## Visual evidence

| Surface | Before | After |
| --- | --- | --- |
| Timeline | [Before](timeline-ux-evidence/before-timeline.png) | [After](timeline-ux-evidence/after-timeline.png) |
| Media Pool | [Before](timeline-ux-evidence/before-media-pool.png) | [After](timeline-ux-evidence/after-media-pool.png) |
| Workspace | [Before](timeline-ux-evidence/before-workspace.png) | [After](timeline-ux-evidence/after-workspace.png) |

The user's primary flow is captured as [media inside Section 2](timeline-ux-evidence/media-in-section2.png), followed by [Section 2 moved before Section 1](timeline-ux-evidence/section2-moved-before-section1.png). Additional evidence: [marquee during drag](timeline-ux-evidence/marquee-during-drag.png), [Present during a stroke before mouse-up](timeline-ux-evidence/present-during-stroke.png), [narrow window](timeline-ux-evidence/after-narrow.png), [compact window](timeline-ux-evidence/after-compact.png).

## New acceptance, not just regression counts

`scripts/timeline-ux-smoke.cjs` launches actual Electron Control and Present windows. It uses real mouse down/move/up drag gestures from Media Pool elements to Section targets; only native folder selection is substituted. Saved project membership/order is checked in addition to rendered containment. Its baseline probe failed against the previous build for the four absent interactions recorded in [before-missing-behaviors.json](timeline-ux-evidence/before-missing-behaviors.json).

The new [acceptance log](timeline-ux-evidence/acceptance.log) and [structured results](timeline-ux-evidence/results.json) demonstrate:

1. Compact pool thumbnails and optional working filters.
2. Actual image and video drags into Section 2.
3. Entire Section 2 before Section 1, preserving child IDs/order, with undo/redo.
4. Scene drag between Sections and insertion into an empty Section.
5. Collapsed Section media insertion and dragging scenes to Ungrouped.
6. Timeline marquee/modifier selection, group duplicate/delete/undo and wheel behavior.
7. Reverse-order selection still copying scenes in lesson order (test reproduced the bug before its fix).
8. Story-to-Activation cut preserving shared scene identity and preventing repeated cut paste.
9. Canvas marquee, group drag/nudge/copy/paste/cut/duplicate/delete and undo/redo.
10. Unmodified Edit/Teach wheel zoom, middle pan, transformed marquee and native text editing.
11. Present ink before mouse-up, intermediate erasing, one-step drawing undo, and real Escape cancellation of pen/highlighter/eraser.
12. Save/reopen retaining Section membership/order while excluding transient teaching ink.

No renderer errors were recorded. Separately, all 418 unit tests passed, including 12 new helper tests. Renderer/main builds and application TypeScript checks passed. Both existing Electron suites also passed after updating selectors for relocated controls: [9 reconstruction groups](timeline-ux-evidence/regression.log) and [10 usability groups](timeline-ux-evidence/usability-regression.log). Those are regression protection, not the proof of the new UX.

## Actual application source changes

- `src/renderer/lesson/LessonTimeline.tsx`
- `src/renderer/lesson/timelineContainers.css` (new)
- `src/shared/lesson/sections.ts`
- `src/renderer/lesson/LessonMediaPool.tsx`
- `src/renderer/lesson/compactMediaPool.css` (new)
- `src/renderer/lesson/WorkspaceLayout.tsx`
- `src/renderer/lesson/SceneSurface.tsx`
- `src/renderer/lesson/LessonApp.tsx`
- `src/renderer/lesson/SceneMenus.tsx`
- `src/shared/lesson/objectSelection.ts` (new)
- `src/shared/lesson/objectClipboard.ts` (new)

Tests/configuration: new `scripts/timeline-ux-smoke.cjs`, `src/shared/lesson/sectionContainers.test.ts`, `src/shared/lessonObjectSelection.test.ts`; updated `scripts/reconstruction-smoke.cjs`, `scripts/usability-smoke.cjs`, and `tsconfig.test.json`.

## Manual acceptance

Open `docs/timeline-ux-demo` with **Open project**.

1. Drop an image/video into a Section, then drag its dotted header handle before another Section. Confirm every child moves together. Undo/redo and save/reopen.
2. Drag scenes between Sections and Ungrouped; collapse a Section and drop media into it. Try an empty Section.
3. Marquee-select on canvas and timeline. Move the canvas group, duplicate/copy/paste/delete, and undo. Repeat at a different canvas zoom. Confirm shortcuts inside a text field still edit text.
4. Wheel the canvas without modifiers; middle-drag with each drawing tool. On timeline, wheel scrolls and Alt+wheel zooms.
5. In Teach, open Present and draw slowly while holding the button. Watch ink appear before release. Press Escape during a stroke or erase; verify cancellation. Commit a stroke and undo it once.

## Scope and limitations

No stated requirement in the latest request is marked complete on unit tests alone or blocked. The older separately named Timeline specification was not available in this chat; this implementation follows the concrete requirements in the corrective request and the recorded design.

Present remains a passive student window. The eraser still removes whole strokes. Narrow timelines scroll horizontally; compact windows stack panels vertically. Physical mouse-driver macros and classroom audio-device acceptance remain manual checks. The build retains the existing large-bundle advisory. No installer or remote push was produced.

To rerun: compile tests and build renderer/main, set `STORY_STUDIO_PLAYWRIGHT` to a Playwright package directory, then run `node scripts/timeline-ux-smoke.cjs`. FFmpeg supplies the disposable sample media.
