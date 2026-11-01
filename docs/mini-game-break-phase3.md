# Mini-game Teach & Present runtime — Phase 3

## Result

Phase-2 version-2 Spinning Wheel configurations now run from Teach and display in Present through the existing scene snapshot pipeline. No spinning animation, particles, automatic rewards, extra game types or new communication channel was added. Existing uncommitted Phase 1–2 work remains intact.

Phase 2 deliberately deferred v2 execution because the original runtime ignored its quotas and session length. This phase replaces that deferral with a v2 adapter inside the shared runtime dispatch; it does not change the authoring format or discard retained drafts. The old version-1 runtime contract remains supported.

## Controls and display

The Teach panel offers state-appropriate Start Game, Reveal Activity or Select Activity, Show Question or Show Event, Complete Activity, Next Activity, Skip Activity, Reset Game and Finish Game controls. Teacher-selected mode has a picker containing only eligible configured segments. Reset and early finish use inline confirmation; the existing Reset scene toolbar also confirms before clearing an active wheel. Double-clicks/repeated activation and stale state are guarded. Continue lesson uses existing scene navigation after completion and is disabled at the sequence end.

Teach and Present render the same public plan: title, all configured wheel segments, selected segment, current activity, progress/skipped count and completion message. Questions use the existing CardV2 renderer with the referenced Card's first face. Events use a distinct static panel with their public label and optional student message. Legacy `config.instructions` remains teacher-only. The editor now labels that field Teacher instructions and offers a separate Student message field. No authoring text was deleted or repurposed as public content.

The shared wheel graphic rotates immediately to the selected segment under a fixed pointer. It has no animation, local outcome selection or timers. It is reused by the Edit preview. LogicalSceneFrame and the existing Present composition retain aspect ratio, roster/camera/caption placement and portrait-window letterboxing. Existing manual reward controls/overlays are retained, without connecting game completion to reward execution.

## State machine and selection

| Phase | Accepted normal action | Result |
| --- | --- | --- |
| Ready | Start Game | Selecting, when configuration/content is ready |
| Selecting | Reveal/Select Activity | Activity Revealed, with authoritative activity and segment IDs |
| Activity Revealed | Show Question/Event | Activity Active |
| Activity Revealed or Active | Skip Activity | Consume this turn and matching quota; Activity Complete or Session Complete |
| Activity Active | Complete Activity | Consume turn; Activity Complete or Session Complete |
| Activity Complete | Next Activity | Selecting, clearing the current result |
| Any running phase | Confirm finish | Session Complete without consuming an unfinished activity |
| Any initialized phase | Confirm reset | Ready, clearing progress and incrementing revision |

Alternating starts with a question and validates compatible quotas. Randomized selection samples eligible configured segments while respecting remaining question/event slots. Teacher-selected mode permits only an eligible assigned segment. Used activity IDs are excluded, including every segment associated with a used activity. Additional segments therefore influence selection chances without increasing session length or allowing the same activity to repeat. Skip is explicitly explained as using a turn and its quota; it does not silently add replacement turns.

Random entropy is generated once by a Teach click handler and carried in the command. Pure transitions produce and store the final segment/activity association. Present receives that result and never generates randomness. Completion can emit an inert typed activity-result intent through the shared contract; the session helper applies state only and does not dispatch rewards/effects.

## Synchronization, privacy and recovery

Runtime remains on LessonSession and the existing cache keyed by sequence/occurrence ID. Commands carry expected runtime revision, configuration fingerprint, session ID, occurrence ID and visit. Invalid transitions, duplicate commands, previous-visit commands, previous-session commands and old reset revisions cannot advance the session. Configuration changes invalidate stale state. Continue lesson also checks the captured completed-game revision before navigating.

No IPC API changed. LessonApp publishes the projected ScenePlan through PresentSnapshot/PresentSnapshotRelay. Existing relay ordering rejects stale snapshots; late connection, reload and close/reopen request the retained current snapshot. Navigating away caches the occurrence, re-entering restores it, and linked occurrences sharing a scene keep independent sessions.

The public wheel schema whitelists title/labels, phase/revision, counts, segment association and the current visible first-face Card plan or event message. It excludes the full configuration, runtime fingerprint, teacher instructions, inactive Cards and hidden answers. Before Show Question, no question Card plan is sent. Base review-board objects are omitted from live mini-game plans, including unknown/malformed fallback plans, so an underlying answer Card cannot leak. Classic Break plans are unchanged; choose Classic explicitly to show a review board. Editor projection has an explicit authoring flag so Card face editing still retains its scene objects. Current Card image sources participate in the existing media readiness checks.

## Files changed in this phase

New:

- `src/shared/lesson/wheelRuntime.ts`: v2 phases, readiness, constrained selection, transitions and restore validation.
- `src/shared/lesson/wheelPresentation.ts`: public projection/parser and first-face Card rendering contract.
- `src/renderer/lesson/WheelTeachControls.tsx`: scoped commands, picker, reset/finish confirmation and completion navigation.
- `src/renderer/lesson/WheelScene.tsx`: shared passive Teach/Present composition.
- `src/renderer/lesson/WheelGraphic.tsx`: shared static segment graphic and selected-segment angle.
- `src/renderer/lesson/wheelRuntime.css`: scoped runtime/control styles.
- `src/shared/spinningWheelRuntime.test.ts`: ten new regression tests.
- `scripts/spinning-wheel-runtime-smoke.cjs`: actual Electron runtime, privacy, recovery and layout checks.
- This report and `docs/superpowers/{specs/2026-10-25-mini-game-runtime-design.md,plans/2026-10-25-mini-game-runtime.md}`.

Extended:

- `src/shared/lesson/miniGameRuntime.ts`: v1/v2 dispatch and inert completion intent.
- `src/shared/lesson/session.ts`: scoped v2 action guard using the existing occurrence session.
- `src/shared/lesson/projection.ts`: public wheel plan, safe live fallbacks, explicit authoring purpose and current Card media sources.
- `src/shared/lesson/miniGameBreak.ts`: registry metadata for the active wheel presentation/control/adapter slots.
- `src/shared/lesson/spinningWheel.ts`: bounded student event-message validation.
- `src/renderer/lesson/LessonApp.tsx`: authoring projection, safe drawing-preview handling and toolbar reset protection.
- `src/renderer/lesson/LessonTeachControls.tsx`, `SceneSurface.tsx`: wheel integration, safe fallback and preserved manual reward/audio paths.
- `src/renderer/lesson/MiniGameBreakEditor.tsx`, `SpinningWheelPreview.tsx`: private/public event fields and shared static graphic.
- `src/shared/spinningWheelEditor.test.ts`: update the legacy-command rejection test name after v2 runtime activation.
- `scripts/spinning-wheel-editor-smoke.cjs`: updated private event-field label.
- `tsconfig.test.json`: include the runtime regression tests.

Main IPC, the Present entry point, the relay, story/package persistence and reward logic were reused without modification.

## Verification

- `npm test`: **688 passed, 0 failed**, including all 678 previous tests and ten new runtime regressions.
- Runtime tests cover explicit transitions, six-turn limits, alternation, randomized quotas, teacher picks, segment/result association, duplicate-segment exclusion, invalid entropy/picks, skips, resets, early finish, JSON restore validation, stale command/scope rejection, linked occurrence isolation, missing content, safe unknown/malformed fallback, Card-editor projection, hidden-answer/private-instruction exclusion, public event text, Card image projection and existing relay late/recovery semantics.
- `npm run build:renderer`: passed; Vite emits its large-chunk advisory.
- `npm run build:main`: passed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `node scripts/spinning-wheel-runtime-smoke.cjs`: passed. Runs every sequence mode in Electron; checks first-face Card rendering, private snapshot exclusion, skip/quota completion, reset cancel/confirm including toolbar cancellation, early finish, late opening, refresh, close/reopen, linked occurrence return, incomplete-content blocking, Classic, portrait layout and unchanged authored JSON.
- `node scripts/spinning-wheel-editor-smoke.cjs`: passed.
- `node scripts/mini-game-break-smoke.cjs`: passed.
- Desktop question, event, completion, Teach and portrait Present screenshots inspected in `output/playwright/spinning-wheel-runtime/`.
- Read-only review identified the synthetic editor-preview interaction with live privacy filtering. An explicit authoring flag and regression fix it; final review found no remaining clear correctness/privacy issues.

## Phase 4 integration points and limitations

- Animate the shared graphic toward the stored `selectedSegmentId`; the outcome must remain authoritative in Teach. The stored runtime revision and segment association support animation identity/replay without rerolling.
- Revealed and Active are separate: selection can animate while content remains withheld until the teacher shows it. Any future automatic animation-completion acknowledgement must remain guarded by session/occurrence/revision.
- Typed result/reward/effect extension points remain inert. Future reward execution needs explicit idempotency keys using session/occurrence/revision and the existing reward controllers. No new reward behavior exists in this phase.
- Functional Teach sessions use Phase-2 v2 wheel configurations. Legacy v1 configurations keep their compatibility runtime/placeholder and can be explicitly upgraded through the existing wheel editor. Magic Hat and Mystery Cards remain Coming Soon.
- Questions display only the first Card face; no answer-reveal feature was added. Event teacher instructions are never automatically published; authors must use Student message for public event text.
- Repeat prevention tracks authored activity IDs. Distinct authored outcomes may intentionally reference the same Card. A skipped activity consumes its turn; changing to replacement-spin semantics would require a separately validated rule.
- Runtime follows existing in-memory teaching-session lifetime. Present refresh/reconnection restores the session; restarting Control/the application starts a new teaching session. No runtime state is written into stories or packages.

No commits or pushes were made. Phase 4 was not started.
