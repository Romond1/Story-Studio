# Media Pool and object timeline: preflight stop report

Date: 2026-10-08. Status: stopped before implementation under requested stop condition D (timeline browsing changes Present).

## Blocking dependency

The current Edit cursor is not independent of the authoritative live presentation session.

Verified source path:

1. `App.tsx` renders the Edit navigator with `presentationSession` and `presentationTarget`. Its slide callback calls `onSlideWrapperClick`; its section callback calls `selectSection`.
2. An ordinary `onSlideWrapperClick` calls `goToSlideByAbsoluteIndex`, which calls `setSelectedSectionId` and `setCurrentIndex`, and stops shared slide/section audio.
3. `usePresentationSession.ts` implements both setters by reducing the same authoritative session. `setCurrentIndex` selects its `storySlideId`.
4. `App.tsx` resolves `presentationTarget` from that session and passes both to `usePresentProjection` unconditionally.
5. `usePresentProjection.ts` publishes changed projections through `publishPresentSnapshot` without an Edit-mode gate. Therefore a new Edit selection can change an open Present window. Video media intent is separately gated to Teach, which also needs consideration when separating the two workflows.

This is source-level confirmation, not a claim of an exercised Electron reproduction. No application code was changed and no runtime acceptance or regression tests were performed for this report. Existing uncommitted work was preserved.

## Required prerequisite

Separate local authoring selection from the live PresentationSession before wiring the new timeline. Keep Core as the sole live-target authority. Resolve the Edit canvas and inspector from the authoring cursor, and resolve Present, playback, transitions, live cards and live overlays from Core. Edit navigation must not dispatch live selection or shared audio-stop commands. The LIVE marker should read Core independently of the Edit cursor.

Validate this across ordinary clicks, section selection, previous/next, keyboard navigation, mode switches, history restoration and project replacement. Present should retain its target and playback when browsing Edit. Specify and test the behavior when an edit removes the live object. Merely changing navigator labels or suppressing one publish effect would leave shared media/runtime ownership unresolved.

After that prerequisite, resume the requested M1–M9 sequence. Retain legacy navigation until parity testing and explicit removal approval.

## Verified reusable import behavior

- `src/main/main.ts`: `importMediaFiles` is the shared file-copy entry point already used by native import and path-based import. Reuse it for Pool and Explorer routes; extend it for folder traversal rather than adding an importer.
- `detectMediaType` accepts image PNG/JPG/JPEG/GIF/WebP/BMP; video MP4/MOV/WebM/MKV/AVI; audio MP3/WAV/OGG/AAC/M4A, case-insensitively by extension.
- Assets are copied to `assets/<UUID><lowercase extension>`. Each import receives a new UUID; repeated source names do not collide, but are not content-deduplicated. `originalName` retains the source basename. Stored paths are project-relative and slash-normalized.
- Images and videos receive Slide wrappers with separate UUIDs, an asset ID, a section ID and a fade transition. Video defaults enable audio at volume 1. Audio imports create assets without slides.
- The importer currently skips unsupported files and non-files silently. A thrown stat/copy error can follow earlier copies. Consolidation must add clear batch failure reporting and deliberate partial-success or rollback behavior.
- `src/shared/mediaImport.ts`: `applyMediaImportToProjectData` appends assets and slide wrappers, resolves the target section, applies contextual display labels and adds BreakMedia wrappers when importing into a break. It currently couples asset registration to placement; Pool-only registration must be separated without changing the legacy routes.
- `src/shared/mediaReferences.ts`: `decorateImportedAssetsForContext`, `cleanMediaDescription`, `getAssetDisplayLabel` and `withCanonicalAssetDefaults` are reusable naming/display helpers.
- Display cleanup removes the extension, normalizes underscores/hyphens/dots and whitespace, strips trailing copy/export-like noise and uses sentence case. Context decoration removes **all digits** for images/videos, not just a numeric prefix. Audio does not use that all-digit removal.
- Section labels use `<section ordinal>.<asset ordinal>`; break labels use `B<break ordinal>.<asset ordinal>`. These ordinals derive from project sections and existing asset/reference counts, not filesystem folder names. General-context labels have no numeric reference prefix. These are metadata/display conventions; they do not rename source files.

## Other inspected seams

- `ProjectData.assets` already supplies the project-local asset authority. Bins should be additive organizational metadata, not a second asset database.
- `Slide.sectionId` is required. Main normalization creates Section 1 when sections are absent. An implicit Lesson container is the candidate representation for ungrouped content; compatibility has not yet been audited enough to approve it.
- Existing reorder operates within a section, preserves slide IDs and renumbers asset references. Cross-section moves require further review of references, break media and Card V2 ownership.
- Section mutations and break duplication already have shared domain helpers in `sectionMutations.ts`. Existing deletion and reorder commands must remain the entry points or be factored into shared helpers, not copied into timeline-only state.
- `ProjectHistory` records immutable project data and saved identity. UI zoom, collapse and panel state should remain outside that authored data.
- The current navigator uses image assets directly; videos show a type placeholder. No new thumbnail service was implemented or established by this inspection.
- `StaticScene.tsx` already provides passive scene primitives, including logical-frame scaling, image adjustments and overlays. High-detail previews should reuse these only after complete scene composition and runtime isolation are verified.
- `docs/edit-workspace-inventory.md` is the existing comprehensive legacy capability checklist. It explicitly identifies parity and runtime acceptance as unverified. Teach navigation remains separate; nothing has been removed.

## Acceptance after the prerequisite and implementation

- Import a folder tree; verify bins, duplicate names, unsupported-file reporting, search/filter and usage counts.
- Drag single/multiple Pool assets to exact timeline slots; verify Explorer-to-Pool imports only and Explorer-to-Timeline imports plus placement.
- Add sections/breaks, reorder, and exercise supported duplicate/delete operations; undo/redo, save and reopen.
- Check collapse markers, non-wrapping order, pointer-centered zoom, middle pan and metadata at each density.
- Keep Present open on another object while navigating Edit; verify LIVE identity, video and audio remain independent.
- Compare high-detail previews to the existing canvas and compare editing capabilities to the legacy checklist.
- Reopen Episodes 1–6 and run Card V2 persistence checks; confirm Teach layout/navigation and Present output remain correct.

These checks are pending, not passed. The requested Media Pool and replacement timeline have not been implemented because the explicit stop condition was encountered during architectural inspection.

## Follow-up — 2026-10-08

The historical stop above was resolved by the authorized independent Edit cursor prerequisite. Implementation resumed and automated checks passed. See [implementation report](media-pool-timeline-report.md) for current phase status, evidence, deferred cross-section moves and pending manual acceptance.
