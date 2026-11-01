# Mini-game runtime implementation plan

**Goal:** Run teacher-controlled wheel sessions through the existing snapshot pipeline.
**Architecture:** Pure v2 runtime dispatched by shared adapter, guarded occurrence actions, whitelisted public wheel plan, stateless shared renderer and compact teacher controls.
**Tech stack:** TypeScript, React, node:test, existing Electron relay and CardV2 rendering.

- [x] Add failing state/selection/scope/privacy/restore tests.
- [x] Implement v2 transitions/selection/readiness/restore and shared dispatch; gate actions by scope.
- [x] Add public projection/parser, first-face Card rendering, shared static wheel and teacher controls.
- [x] Separate teacher instructions/student event text; preserve authoring/save/copy behavior.
- [x] Run full tests, builds, typecheck, native recovery/control/layout smoke; review and document. Stop after Phase 3 without commit/push.
