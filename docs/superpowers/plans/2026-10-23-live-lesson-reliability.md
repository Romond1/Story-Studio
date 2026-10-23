# Live lesson reliability implementation plan

Goal: adjust section/break music in Teach, retain translation/camera setup across modes, align Presenter drawing fade and interaction, configure rewards and make video autoplay predictable.

Design: preserve live controls mounted across Edit/Teach; validated personal preference persistence with saved feedback; scene/project formats retain existing defaults and references. Music volume updates the active gain without stopping/restarting. Teach volume uses per-project/track saved live levels; editor authored levels stay available. Explicit autoplay preference defaults to manual and controls scene navigation. Rewards changes use existing presentation channel. Drawing keeps interactive objects usable and forwards fading metadata to every presentation format.

Tasks:
- [x] Add regression for live gain changes during playing/loading/paused audio; implement owner volume adjustment and Teach sliders.
- [x] Preserve/persist translation and camera configuration with capture cleanup on hidden mode; mode roundtrip/native tests.
- [x] Add explicit video navigation autoplay control and regression coverage.
- [x] Expose reward placement, scale and intensity with validation and actual Present projection tests.
- [x] Fix drawing pointer arbitration and snapshot fade metadata; actual Present fade verification.
- [x] Run focused/full tests, renderer/main builds and serial isolated Electron acceptance; inspect failures; do not commit/push.
