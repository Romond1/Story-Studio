# Beginning and UI polish — 2026-10-09

Implemented the Beginning launcher using all seven supplied images, a shared restrained indigo/cyan/violet theme, compact Media Pool controls, clearer inspector sections and destination-aware imports. No lesson format or timeline architecture changes.

## Acceptance

- [x] Normal startup shows Beginning, with four large primary cards and three smaller support cards.
- [x] Story and Activation open directly into a blank editable scene on fresh launch, without a second welcome screen or folder picker. An already-loaded lesson stays available through Beginning, including unsaved edits and selected bin.
- [x] Game and Mastery open separate coming-soon screens, per the user's explicit choice. Users also has a placeholder.
- [x] Settings opens the existing audio/device settings, including keyboard dismissal. Legacy uses the existing explicit legacy URL, with a discard prompt for unsaved rebuilt lessons.
- [x] Shared dark surface, border, text, accent and radius tokens style rebuilt teacher chrome. Cyan focus/selection and subtle violet edges are restrained; authored scenes and student Present retain their content styling.
- [x] Media Pool has compact search, Filters and Bin controls, a persistent import destination, readable thumbnails and separately collapsible bin controls.
- [x] File picker, folder picker, native OS-file drop and canvas image-dialog imports use the active destination. Imported folder roots become children of that bin; descendants retain their structure. General imports stay at root. Reset filters keeps the destination.
- [x] Import destination is captured before asynchronous selection/copy; removed destinations fall back to General. New/open project resets bin selection.
- [x] Inspector metadata is quieter, creation actions have more emphasis, sections have clear borders/headers, and Canvas size is collapsed by default.
- [x] Existing editing, Activation, Teach, Present video/reward/drawing, save/reopen and timeline workflows pass regression checks.

## Evidence

- `npm test`: 422 tests passed, zero failures.
- `npm run build:renderer`, `npm run build:main`, `npx tsc --noEmit`: passed. Vite retains its large main-chunk advisory; no bundling refactor was attempted.
- `scripts/beginning-polish-smoke.cjs`: 13 real Electron acceptance groups passed, no renderer errors. Uses temporary lessons and substitutes only native file picker results; drop uses Chromium's native file drag protocol.
- `scripts/reconstruction-smoke.cjs`: 9 groups passed, including real Present composition and video.
- `scripts/usability-smoke.cjs`: 10 groups passed, including splitters, pointer editing, teaching controls, copy/move and persistence.
- `scripts/timeline-ux-smoke.cjs`: 12 groups passed, including section/media drag, multi-selection, keyboard commands, drawing and persistence.
- Screenshots and machine-readable reports: `docs/beginning-polish-evidence/`. Desktop launcher/workspace, mobile launcher and narrow workspace inspected. Launcher audit reports no horizontal overflow, clipped cards, missing alt attributes or text below 11px. The skill's shared visual-lint runtime was unavailable, so these checks run in the Electron acceptance script.
- Independent code review found two issues; both fixed and verified: Story tab navigation from an empty Activation launch, and image-dialog imports ignoring the selected bin.

## Interpretation and limits

- Launcher mode selection starts a temporary draft with one blank scene in the selected phase. Authoring and imports work immediately; the first Save asks for a permanent folder and copies imported assets. Canceling Save retains the draft. Existing loaded lessons are preserved when returning through Beginning.
- Settings means the existing audio/device settings; this pass does not add unrelated preferences.
- No Game or Mastery mechanics were added. Legacy remains the older workspace; the theme pass targets the rebuilt teacher UI.
- Existing unrelated documentation and screenshot edits were preserved. No installer, commit, push or deployment was made.

## Manual check

1. Start Story Studio. Try all seven launcher cards, then use Back to Beginning.
2. Choose Story or Activation, confirm that a blank editable scene opens immediately. Add a Card before opening or saving a project.
3. Open Bin, create one, then import files, import a folder and drop files into the pool. Check the destination label and saved bin contents.
4. Select General, import another file, and confirm it is not assigned to the previous bin.
5. Edit a scene, return to Beginning, then re-enter Story. Confirm your unsaved work remains.
6. Open Present, navigate Story/Activation, interact with cards, and save/reopen the lesson.

## Changed components

`Beginning.tsx`, `studioTheme.css`, renderer `main.tsx`, `LessonApp.tsx`, `LessonMediaPool.tsx`, `SceneInspector.tsx`, shared `lesson/mediaImport.ts`, draft persistence/preload/API types, related tests/test configuration, four Electron smoke scripts, and this pass's planning/evidence documents. Supplied PNGs are bundled directly without alteration.


## Home navigation refinement

The editor's Story Studio name is now a keyboard-accessible link to the chooser; the separate Beginning button is removed. Legacy has a Story Studio home button in both Edit and Teach headers, integrated with its existing Save/Discard/Cancel flow. The chooser now has one centered Story Studio heading and no introductory slogans or footer copy.

Renderer build and TypeScript check passed. The Electron acceptance script verifies the new brand-link navigation, preservation of rebuilt unsaved edits, Legacy return, and Legacy dirty-state Cancel/Discard behavior. Updated screenshots are in beginning-polish-evidence.
