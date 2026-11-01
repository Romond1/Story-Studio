# Team Play integration plan

**Goal:** A usable group hub with a prepared sequence and two adapters around existing games.

**Architecture:** Keep sharedAdventure persistence and one Presenter publisher. Isolate temporary game runs from group preparation/live scoring. Use a validated scoreboard overlay across existing scene/game targets.

**Tech stack:** Existing React/TypeScript, Electron IPC, Node tests and bundled Playwright. No dependencies or networking.

The existing working tree is the baseline. Execute inline; no commits, pushes or deployment.

- [x] Write failing tests in `src/shared/teamPlay.test.ts` for old saves, registry filtering, content validation, adapter projections, wheel/dash action reuse, score isolation and overlay parsing.
- [x] Add `src/shared/teamPlay/activities.ts` with versioned content, registry metadata and bounded sequence validation; `runtime.ts` with pure adapter launch/projection; `scoreboard.ts` with public projection/parser. Extend optional group sequence and local asset-reference validation.
- [x] Rename user-facing destination/default labels to Team Play without changing internal IDs. Preserve custom old group names and map only the exact old default on display.
- [x] Add `src/renderer/sharedAdventure/TeamPlayLibrary.tsx`: module filter, compatibility, configured entries, explicit questions/images, ordered sequence and launch. Unsupported entries have no launch button.
- [x] Add the transient activity hook and controls, reuse WheelTeachControls with optional manual-scoring mode, and connect its target to LessonApp's single publisher. Guard file switching/root changes and home/reset transitions.
- [x] Add the validated PresentSnapshot scoreboard overlay and passive renderer; verify the activity target remains mounted across overlay/score changes.
- [x] Run focused/full tests, TypeScript, both builds and Electron integration checks; update old smoke names while testing old serialized Shared Adventure data. Capture desktop/narrow evidence and document supported/unsupported adapters and registration steps.
