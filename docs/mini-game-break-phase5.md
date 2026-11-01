# Mini-Game Break — Phase 5: Game feel, rewards and magical surprises

## Delivered visual direction
The wheel is an enchanted observatory instrument: gilded layered rim and studs, six enamel jewel gradients, a dimensional cyan compass hub, glowing jewel pointer, selected-segment gold outline, and a pedestal/shadow. Pointer deflection follows segment crossings using the same sampled authoritative spin. The scene uses an indigo/plum sky, sparse slow ambient motes, restrained gold framing, a serif title and an existing-score indicator. Edit and live modes continue using the same SVG wheel.

Questions retain the existing Card renderer and intentional face controls inside an ornate challenge panel with scroll rods and a brief unfurl. No competing editor, duplicated questions or hidden faces were introduced. Events have 850 ms of suspense before their public message, then teacher-controlled continuation. Reduced motion bypasses suspense and uses static emblems. Teacher-only notes remain private.

## Reusable effects
`shared/gameEffects.ts` defines a whitelisted version-1 cue with deterministic identity, kind, epoch start, bounded duration/intensity, sound flag and public caption. `renderer/gameEffects/GameEffects.tsx` renders one current cue on Canvas. The engine has no scoring or advancement callbacks.

| Effect | Distinct behavior |
|---|---|
| Coin Shower | Original metallic coin sprites launch upward, tumble, flatten as they rotate, fall and bounce. Decorative only; no coin balance exists. |
| Star Explosion | Stars burst radially, then converge toward the existing reward-total indicator. |
| Magic Portal | Counter-rotating segmented rings, expanding glow, crystal and orbiting sparks. |
| Treasure Chest | A shaking oak/gold chest opens its separate lid, releasing rays and treasure sparks. |
| Friendly Magic | An original floating teal sprite bobs into view, smiles and offers encouragement. |
| Crown Reveal | A gold crown scales into view with a soft overshoot and stars. |

The first three priorities are Coin Shower, Star Explosion and Magic Surprise; the latter has portal/chest/sprite treatments. Crown Reveal reuses the same bounded infrastructure. Jackpot, full-scene transformation and additional game types were not added.

Each cue can set duration (600–8,000 ms), intensity (0–1.5) and optional sound through the API; the teacher UI uses sensible defaults. At most one cue is active. Replay makes a new visual identity and preserves parameters, while skip clears it. Particle count is capped at 72 (44 coins at default intensity); sprite canvases are generated once per cue and reused per frame. Canvas pixel density is capped at 1.5. Frames update outside React. Reduced motion draws a fully opaque static emblem and waits on a deadline timer. Animation frames, timers, media listeners and sound groups have cleanup paths. Expired effects hide and clear without restarting after reconnect.

## Teacher controls and rewards
Existing Start, Spin, Complete, Skip Activity, Next, Finish and Reset behavior is preserved. The new context-sensitive Rewards & magic section appears only for a selected active/completed activity. It offers:

- Existing student/Class recipient selection; yellow, blue, pink star or crown; amount 1–10.
- Award reward, Skip reward and Confirm outcome. One award decision per selected turn.
- An animation selector, Play, Replay and Skip animation.
- Celebrate answer and Encourage another try; these never score.
- The existing Wheel sounds toggle also controls game-effect sounds.

The existing general class-reward controls remain available in a disclosure panel; Classic retains its original controls. Event authoring gains only a Surprise style selector (portal/chest/friendly magic), stored in the existing activity config. Teacher instructions and optional student messages retain their established editors.

`awardLessonReward` now accepts a bounded amount with a backward-compatible default of one, using the existing per-variant counters and event-acceptance ledger. The wheel's stable selected-turn identity supplies its award event ID. Session/occurrence/visit/revision guards reject stale or duplicate commands; an outcome decision blocks a second award even if the recipient or amount changes. A new game/reset can intentionally award on a new turn while preserving earlier session totals and the acceptance ledger. The wheel uses its own celebration instead of stacking duplicate generic award popups. No second reward economy or automatic reward transaction was introduced.

Awarding and visual triggers are separate. Reloading/reconnecting Present, replaying effects, encouragement, decorative coins and repeated Confirm commands do not score. The authoritative session records decisions and totals; effects never complete an activity. The teacher always advances.

## Teach/Present behavior
Effect cues and the selected recipient's resolved name/total use additive fields in the existing wheel public plan and snapshot relay. Full runtime, roster, award ledger, teacher instructions and hidden Card faces do not cross that whitelist. Old snapshots without effect fields remain supported. Both windows sample the same cue time/seed; no frames cross IPC. Mid-effect reload seeks to current progress. Navigation away removes the renderer and cancels local work; returning uses the retained occurrence state, displaying only a still-live cue. Reset and Next clear cues. Audio is produced in Teach alone, preventing duplicate output from Present.

Optional generated sound groups distinguish coin jingles, star/victory collection, crown, portal, chest and friendly mystery cues. Existing wheel start/ticks/slowdown/landing/reveal remain in use. These quiet, bounded oscillator groups route through the existing media/monitor/master mixer paths, support cancellation, and never gate gameplay. No audio assets were downloaded.

## Asset research and licensing
See [research and provenance](mini-game-break-phase5-assets.md). Kenney adventure UI and particle packs, OpenGameArt's CC0 chest, Poly Haven, King's Booster Wheel and Prodigy's educational fantasy presentation were researched. All newly shipped visuals are original SVG/Canvas/CSS; existing Story Studio star/crown geometry is reused. No commercial artwork, fonts, audio files, dependencies or runtime downloads were added. Third-party reference licenses and attribution requirements are recorded in that companion report.

## Phase 5 files changed

| Area | Files |
|---|---|
| Pure effects and tests | `src/shared/gameEffects.ts`, `src/shared/gameEffects.test.ts`, `src/shared/wheelGameFeel.test.ts`, `tsconfig.test.json` |
| Authoritative decisions and existing rewards | `src/shared/lesson/wheelRuntime.ts`, `session.ts`, `rewards.ts` |
| Public projection | `src/shared/lesson/wheelPresentation.ts`, `projection.ts` |
| Shared fantasy visuals | `src/renderer/lesson/WheelGraphic.tsx`, `WheelScene.tsx`, `wheelRuntime.css`, `useWheelMotion.ts` |
| Reusable Canvas renderer | `src/renderer/gameEffects/GameEffects.tsx`, `gameEffects.css` |
| Teacher/editor controls | `src/renderer/lesson/WheelFeedbackControls.tsx`, `WheelTeachControls.tsx`, `LessonTeachControls.tsx`, `MiniGameBreakEditor.tsx` |
| Sound | `src/renderer/audio/AudioController.ts`, `src/renderer/lesson/useWheelSounds.ts` |
| Native verification | `scripts/spinning-wheel-game-feel-smoke.cjs` |
| Documentation | This report, `mini-game-break-phase5-assets.md`, `docs/superpowers/specs/2026-10-25-magical-wheel-design.md`, `docs/superpowers/plans/2026-10-25-magical-wheel-plan.md` |

Earlier Phase 1–4 uncommitted changes were preserved. Generated tracked test artifacts were restored after verification. No commit or push.

## Validation and visual evidence
- `npm test`: **700 passed**, zero failed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build:renderer`: passed, existing bundle-size advisory remains.
- `npm run build:main`: passed.
- Native `spinning-wheel-game-feel-smoke.cjs`: passed all six effects, normal event suspense, recipient/amount integration, rapid double clicks, award exactly once, replay without scoring, encouragement, confirmation/skip, Present reload during an effect, expiry/Canvas removal, visible reduced-motion emblem, wheel reconnection/navigation/reset, all sequence modes, quotas, Classic and authored-data immutability. No page errors.
- Native `spinning-wheel-animation-smoke.cjs`, `spinning-wheel-runtime-smoke.cjs`, `spinning-wheel-editor-smoke.cjs`: passed, including existing save/reload, pool/segments/session separation, retained drafts, missing/future fallbacks and narrow views.
- New pure tests cover effect whitelisting/validation and deterministic sampling, bounded batch rewards, duplicate/stale award commands, once-per-turn decisions, navigation/JSON restoration, replay parameter retention, invalid recipients/amounts, replacement rather than queues, and reset cancellation.
- Independent review found a reduced-motion opacity defect; it was fixed and a native pixel assertion now verifies >1,000 opaque pixels in the static emblem. Final independent review found no further actionable issues.
- Native frame samples: Coin Shower 45 frames, median **16.7 ms**, maximum **16.8 ms**; wheel 30 frames, median **16.7 ms**, maximum **16.8 ms** on this machine. This is a smoke measurement, not a hardware guarantee.

Inspected screenshots under `output/playwright/spinning-wheel-game-feel/`: `coins-effect.png`, `star-explosion.png`, `portal-effect.png`, `chest-effect.png`, `sprite-effect.png`, `crown-effect.png`, `event-suspense.png`, `event-present.png`, `reduced-motion-portal.png`, `question-present.png`, `question-teach.png`, `portrait-present.png`, `complete-present.png`, and `spinning-present.png`. They show materially richer game framing, distinct effects focused around the wheel, readable challenges, a persistent score indicator and aspect-ratio-preserving portrait behavior. Visual quality was assessed from those rendered images, not inferred from tests.

## Remaining limitations
- The art is stylized 2D vector/Canvas, including the chest; there is no imported 3D scene. Audio uses synthesized tones rather than a professionally recorded sound pack. Classroom listening on the intended speakers remains useful.
- Scores and live game progress remain session-scoped, as in the existing reward system. Save/export contains authored configuration, not live scores or an interrupted session. Application-restart recovery and persistent reward-economy transactions are outside this phase.
- Epoch timing assumes the current shared-host Electron architecture. Remote hosts would need clock-offset handling.
- A narrow Present window letterboxes an authored landscape scene. Extremely dense wheels reduce labels to spaced symbols; the selected activity remains readable in the result panel.
- Resource safety was checked through bounded counts, lifecycle review and native expiry/cancellation/removal checks; no long-duration heap soak or low-end classroom-device benchmark was performed.
- Phase 5 stops here. No new game type, full reward economy, jackpot, scene transformation, commit or push.
