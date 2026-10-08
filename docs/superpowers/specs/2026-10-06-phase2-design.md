# Phase 2 teaching runtime design

The supplied Phase 2 brief is the acceptance specification. Work remains in the
existing checkout because its uncommitted Phase 1 implementation is the dependency;
a fresh worktree would omit that foundation. Preserve all pre-existing changes.

## Authority

Retain one Control-hosted Core session. Main validates student-safe projections
and transports revisions; Present renders them without project access. Extend
Core with occurrence-scoped runtime state before migrating each effectful family.
Do not mount App or its providers in Present. That would introduce duplicate
media, timers and rewards. A wholesale Main migration is unnecessary for parity
and would increase risk to the existing editing and persistence boundaries.

## Geometry and compatibility

Existing stage composition fits images inside the available stage and stores
normalized marker points, while line widths, text sizes and pan use CSS pixels.
Use an explicit logical stage size and a uniform contain transform for projection.
The Control stage establishes the logical frame; Present fits that same frame,
including letterboxing on differing aspect ratios. Do not silently reinterpret
existing authored marker coordinates or migrate project files. Viewport intent
must identify its occurrence and use logical coordinates.

## Incremental families

1. Static scene: extract passive image and text rendering, preserve adjustments,
   stage background and layout, and whitelist projection data.
2. Drawing/viewport: authoritative committed strokes and session transient strokes,
   bounded/coalesced updates, stale-target rejection and recovery snapshots.
3. Breaks/cards: passive visuals from resolved authored content and authoritative
   occurrence layout, reveal state and timer anchors. No mount-time randomness.
4. Transitions/overlays: identity and absolute start/duration; late rendering settles.
5. Media: validate an explicit executor handoff with the existing mixer before
   enabling Present playback. Stop if single execution cannot be guaranteed.
6. Movement/rewards: events and authoritative timestamps, no award on rendering.
7. Booster/recovery: exact checkpoint, current-context commands, teacher status.

## Verification

Each family gets focused pure-model/transport tests, renderer/main builds and
typechecking before the next riskier family. Baseline: 169 passing tests and five
existing renderer type errors (DOM event typing, menu typing, audio buffer typing,
route disposal typing). Production lessons are never test fixtures. Keep legacy
teaching available and report incomplete parity explicitly. Manual teaching and
physical audio/conferencing acceptance belong to the owner.
