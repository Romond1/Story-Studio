# Independent Edit cursor and Media Pool implementation plan

Goal: unblock stop condition D, then resume M1–M9 from the supplied mission.

Architecture: keep ProjectData as the only document and PresentationSession as the only live authority. Store selector fields locally in Control; adapt them to the existing pure target resolver. Compose live scenes from live targets using existing passive renderers. Route editor preview audio separately from the broadcast controller.

- [x] Add selector routing tests for independent slide/section navigation, explicit presentation, authored drawing, history/serialization and mode switching.
- [x] Add `editSelection.ts` and `useEditSelection.ts`; route App editing to the local cursor. Explicit Show in Present commits selectors through Core. Reset only on project replacement and reconcile deleted editor targets.
- [x] Keep media identity, scene/card runtimes and projection attached to the live session in both modes. Factor common activity composition; isolate preview video/audio from broadcast routes. Test selection/audio isolation and run existing tests/typechecks/builds.
- [x] M1: extend the existing import service for folder enumeration, bins and clear failures; preserve copying, IDs and naming.
- [x] M2: add a persistent-in-workspace Media Pool using ProjectData assets plus bin metadata, search/type/usage filters and selection.
- [x] M3–M4: replace only modern Edit navigation with one horizontal structural timeline, separate edit/live markers, collapse, wheel pan, middle pan and pointer-centered global zoom.
- [x] M5–M7: connect precise drop slots, deterministic multi-selection and Explorer imports to the same service and project mutation/history path. Reuse section/break/reorder/delete commands; defer cross-section moves if their existing semantics are unsafe.
- [x] M8: progressive density and passive scene previews using existing primitives. No new presentation engine or child tracks.
- [x] M9: audit parity, retain legacy navigation, run regression checks and provide pending human acceptance checklist. Stop and report any further hard stop instead of bypassing it.

Validation: targeted Node tests, existing `npm test`, renderer typecheck, renderer/main builds, browser smoke checks where supported. Production episode files must not be modified. Existing work in this checkout is required context, so implementation remains here; do not commit unrelated in-progress work.

Implementation and automated checks complete. Human parity approval remains pending; see docs/media-pool-timeline-report.md.
