# Safe Edit History Implementation Plan

**Goal:** Safe persistent-edit undo/redo and usable drawing controls, backed by
focused save regression tests.

**Architecture:** Immutable project history in a small shared module, connected
to the existing App project setter and save/open boundaries. Drawing controls
stay in the existing toolbar area using normal layout.

**Tech stack:** TypeScript, React, Electron, node:test; no added dependencies.

- [x] Append filesystem cancellation, write/sync failure and nested asset-copy
  tests in `src/shared/projectPersistence.test.ts`; run `npm test`.
- [x] Add `src/shared/projectHistory.test.ts` for record/undo/redo, savepoints,
  save races, grouping, bounded history, reset and shortcut filtering. Register
  it in `tsconfig.test.json`. Run and confirm failures before implementation.
- [x] Implement `ProjectHistory<T>` in `src/shared/projectHistory.ts` with
  `reset`, `record`, `undo`, `redo`, `markSaved`, and `isDirty`.
- [x] Integrate history into `src/renderer/App.tsx`: setters record revisions;
  load resets; save calls `markSaved(snapshot.data)` without inserting timestamp
  history; undo/redo preserve folder and lastSavedAt. Group gestures/text edits,
  skip editable targets for shortcuts, and reconcile removed selections.
- [x] Reproduce delayed import plus edit in the renderer callback harness;
  protect identity operations during imports and merge results into latest data.
- [x] Move draw controls into a normal-flow toolbar row in App/styles. Verify
  active drawing cannot intercept controls with a focused browser layout test.
- [x] Run `npm test`, renderer/main builds, baseline-aware renderer typecheck,
  diff review, and five production episode hash comparisons. Remove only generated
  test artifacts, and report the short remaining manual acceptance checklist.

Keep existing Phase 0 edits in this checkout. Do not package, commit user changes,
refactor audio, or begin Core/Control/Present work.
