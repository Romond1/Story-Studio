# Magical Wheel Implementation Plan

**Goal:** Deliver an original fantasy wheel, three reusable effects and safe teacher reward integration.
**Execution:** In-place sequential implementation; preserve Phases 1–4 and do not commit.

- [x] Add failing tests in gameEffects.test.ts and wheelGameFeel.test.ts for deterministic effects, replay and once-only rewards.
- [x] Implement shared/gameEffects.ts and additive runtime/projector cue and outcome fields; extend existing lesson reward primitive for bounded amount.
- [x] Rework shared WheelGraphic and wheelRuntime.css with original fantasy materials and scroll staging.
- [x] Build reusable renderer/gameEffects Canvas layer and original vector emblems, with pure seeded trajectory samples, synchronized seeking and cleanup.
- [x] Integrate contextual reward/effect controls, authored surprise style, audio cues on the existing mixer and phased event reveal.
- [x] Validate tests/types/builds, inspect native Electron screenshots, review correctness independently, fix findings and report limitations.
