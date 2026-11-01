# Mini-Game Break — Phase 4

## Implemented behavior
Start Game → Spin Wheel → automatic landing and question/event reveal → teacher Complete or Skip → Next Activity. Finish/reset confirmations and session/occurrence/visit/revision guards remain in place. No automatic completion or reward dispatch was added. Classic Breaks and other game placeholders retain their existing paths.

The runtime selects an eligible segment once, using the existing quota and selection logic. Optional versioned `WheelSpin` metadata records identity, segment, epoch start, duration, and start/end rotation. A retained rotation pose makes consecutive spins continuous. Old v2 snapshots/actions without timing remain compatible with the former manual Show flow. No additional gameplay phases or IPC channels were introduced.

## Animation and synchronization
`wheelAnimation.ts` integrates a velocity profile with acceleration (18%), cruise (to 52%), and cubic deceleration. Each window samples the same elapsed epoch time. The end angle points the authoritative segment center exactly at the fixed pointer. The renderer updates one SVG group transform through requestAnimationFrame; React updates on landing rather than each frame. Late/reloaded Present seeks directly into this curve. There are no animation-frame snapshot messages.

Teach schedules the existing guarded Show transition after the deadline; Present never dispatches gameplay. Navigation/unmount/reset cancel local animation, audio scheduling and reveal timers. Scope/revision checks reject stale callbacks. The reveal effect also tracks dispatch availability so activation pause/resume cannot discard the only reveal attempt permanently. Used outcomes, played turns and quotas remain independent of segment count and pool size.

Reduced motion displays the final pose without rotating, while retaining a clear Spinning status until the authoritative deadline. Spins initiated with reduced motion use 240 ms; ordinary spins use 4.8 seconds. Preference changes are observed live. Reduced-motion views wait with a timer rather than rendering redundant frames. Browser throttling may delay a callback, but the next sample seeks to the correct current time.

## Visuals, Cards and audio
The shared editor/live SVG gained a rim, subtle shadow, richer segment colors, fixed pointer, center medallion and selected-segment outline. Full labels appear through 24 segments; denser wheels use spaced question/event symbols and the result panel provides the selected activity label. A brief accessible reveal fade reuses the existing layout and Card renderer. Logical scene aspect ratio continues to control layout; a narrow Present window letterboxes an authored landscape scene.

Teachers can intentionally select any face of the current question Card. Session validation checks that the face belongs to that Card. Only the currently selected resolved face enters the public plan; other faces and private event instructions stay out. Existing Card face transitions are reused, with no duplicated Card content or renderer.

Optional Wheel sounds default off. Synthesized start, tick, slowdown, landing and reveal cues use AudioController's existing media bus, volume/mute and monitor/mix routing. No audio assets or dependencies were added. Teach alone produces cues; late/reloaded Present never replays audio. Tick scheduling is rate limited; historical spins resume silently. Sound failure cannot block gameplay. Existing mixer settings control volume; the checkbox mutes wheel cues independently.

## Phase 4 file changes
- `src/shared/lesson/wheelAnimation.ts`: pure metadata validation, exact landing and reconstruction.
- `src/shared/lesson/wheelRuntime.ts`: optional spin/pose/face state and guarded timed transitions.
- `src/shared/lesson/wheelPresentation.ts`: additive whitelisted public timing/pose and selected-face projection.
- `src/shared/lesson/session.ts`: validate intentional face changes against the current Card.
- `src/renderer/lesson/useWheelMotion.ts`: shared imperative SVG motion and cleanup.
- `src/renderer/lesson/useWheelSounds.ts`: optional Teach-owned synthesized cue lifecycle.
- `src/renderer/lesson/WheelGraphic.tsx`, `WheelScene.tsx`, `WheelTeachControls.tsx`, `wheelRuntime.css`: shared wheel styling, spin/reveal flow and face/sound controls.
- `src/renderer/audio/AudioController.ts`: reusable media-bus cue API.
- `src/shared/wheelAnimation.test.ts`, `spinningWheelRuntime.test.ts`, `tsconfig.test.json`: animation, recovery, transition and privacy coverage.
- `scripts/spinning-wheel-animation-smoke.cjs`: native timed/reload/landing/navigation/reset/face/privacy/performance checks.
- `scripts/spinning-wheel-runtime-smoke.cjs`: adapt the Phase 3 smoke to Spin Wheel and automatic reveal.
- `docs/superpowers/specs/2026-10-25-animated-wheel-design.md`, `docs/superpowers/plans/2026-10-25-animated-wheel-plan.md`, this report.

Prior Phase 1–3 changes were already uncommitted and have been retained. No commit or push.

## Validation
- `npm test`: **693 tests passed**, zero failures.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build:renderer`: passed; existing large-chunk advisory remains.
- `npm run build:main`: passed.
- `node scripts/spinning-wheel-animation-smoke.cjs`: passed; in-flight connection/reload, exact landing, no frame messages, explicit Card face privacy, reduced motion, navigation during spin, reset before landing, stale timer cancellation, all sequence modes, progress, Classic and fallback coverage.
- `node scripts/spinning-wheel-runtime-smoke.cjs`: passed.
- `node scripts/spinning-wheel-editor-smoke.cjs`: passed; pool/session/segments, Card reuse, retained drafts, save/load, narrow editor and compatibility.
- `git diff --check`: passed (line-ending notices only).
- Independent review found and verified the activation-pause retry fix; final review reported no further actionable findings.

Native checks reported no renderer page errors. Generated tracked test artifacts were restored after verification. Native screenshots are under `output/playwright/spinning-wheel-animation/` (spinning, question, event, portrait, complete, and Teach). An in-flight 30-frame sample measured median 16.7 ms and maximum 16.8 ms on this machine; this is a smoke measurement, not a performance guarantee.

## Remaining limitations and Phase 5
- Runtime progress remains transient, matching Phase 3. Authored configuration persists; reopening the application does not restore an interrupted live lesson session from disk.
- Teach must be running to issue the automatic Show action. Returning to the occurrence resumes/retries the reveal; Present is intentionally passive.
- Epoch timing assumes Teach and Present share the same host clock, as the current Electron architecture does. Remote-device support would need clock-offset handling.
- Sound cues are generated tones and require the existing audio engine/output permissions; final sound design can replace cue implementations without changing gameplay.
- Large wheels deliberately reduce text density; the selected activity remains readable in the result panel. Hardware and background-window throttling can reduce animation frame rates.
- Reuse successful authoritative activity-result intents for any future reward integration, with transaction identity/idempotency added at that boundary. This phase introduces no coins, stars, crowns, transactions or additional game types.
- Future work can provide configurable durations/theme/audio mapping through the registry while keeping the serialized visual intent and projection whitelist. Stop at Phase 4.
