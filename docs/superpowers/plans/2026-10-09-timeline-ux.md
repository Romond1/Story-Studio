# Timeline UX Implementation Plan

> Use superpowers:subagent-driven-development for isolated implementation and review, with new interaction acceptance.

**Goal:** Replace label-based timeline with direct manipulation Section containers and complete group editing, compact pool and streamed drawing.

**Architecture:** Extend existing pure commands and SceneSurface; keep sequence identity and session projection. No new scene runtime.

**Tech Stack:** React, TypeScript, Electron, node:test and existing Playwright Electron runtime.

- [x] Capture baseline screenshots and checkpoint current implementation.
- [x] Section work: add tested atomic reorder/insert commands in shared/lesson/sections.ts; reconstruct LessonTimeline.tsx and dedicated CSS with container drops, group scene selection and compact action menus. New tests must fail against the old model/UI.
- [x] Canvas work: extend SceneSurface and LessonApp with marquee/multi-object operations, scoped standard shortcuts, unmodified wheel zoom and transient drawing projection. Test group operations, cancellation and intermediate Present output.
- [x] Pool work: condense LessonMediaPool controls and remove its asset-grid height cap; preserve filters, bins, import and selection in optional controls.
- [x] New Electron acceptance: scripts/timeline-ux-smoke.cjs builds a disposable fixture and drives actual native drag events and pointer gestures. Save screenshots under docs/timeline-ux-evidence and assert saved sequence membership/order rather than trusting appearance alone.
- [x] Review source, inspect screenshots, fix defects, run relevant regression checks, document actual results and limitations.
- [x] Commit only this phase's source/tests/evidence/report on story-studio-rebuild and report the new hash plus manual acceptance checklist.
