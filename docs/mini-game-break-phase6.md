# Mini-Game Break Phase 6: Magic Hat and Mystery Cards

Implemented October 25, 2026. No commit or push. Stops after Phase 6.

## Simpler setup and testing

Open a Break in Edit, choose Test game, Start Game, then Spin Wheel, Draw from Hat, or choose a numbered card. Question labels work as spoken questions when there is no other question content. Quick question entry creates a playable prompt in one step. Empty questions remain saved drafts and are omitted from runtime rounds. Requested session length and question/event quotas are clamped to ready content; incompatible alternating counts fall back to randomized order. The pool and authored limits are never rewritten. Empty games explicitly offer Start sample game; the sample is ephemeral, including in Teach, and never enters the saved document.

New games default to all ready activities. Custom length, quotas, and sequence are under Round options. Card and media editors remain available. Classic Breaks and unsupported configurations keep their existing paths. Switching to a game for the first time seeds its pool from the current game; returning to an already authored game restores its independent saved configuration.

## Games

Magic Hat uses original SVG artwork: dimensional plum hat, metallic band and jewel, pedestal, stars and light. Three clock-seekable variations provide bounce/squash, starlight/levitation and portal-style motion. The editor offers a varied or fixed reveal style. Teacher controls reuse Start, Draw from Hat, Reveal (with automatic reveal enabled by default), Complete, Skip, Next, reset, finish, rewards and effect replay.

Mystery Cards uses original ornate teal/plum/gold backs and symbol fronts, numbered positions, highlights, shuffle motion, flip/enlargement and used seals. Configure 3–5 visible cards and automatic or manual shuffle. Eligible remaining activities may produce fewer cards near the end or when sequence quotas narrow the pool. Teach supports direct stage clicks, keyboard selection, and numbered control buttons; Present is passive. The selected outcome's full content appears in the shared activity panel.

Both games reuse existing event surprises, optional mixer-owned game sounds, question/Card/media renderer and reward ledger. Visual effects never score. No external artwork or new asset dependencies were added.

## Runtime and privacy

All three registered games use the existing version 2 configuration, scoped revision guards, session quotas and snapshot relay. Mystery deals are private runtime segment-ID arrays fixed before a click. Selection resolves the chosen index in that deal; entropy supplied at selection cannot remap it. Deals deduplicate activities, respect quota/sequence eligibility and exclude consumed outcomes. Manual shuffle preserves authored ordering until explicitly shuffled.

Public snapshots contain safe slot status and bounded visual timing, not private deals, teacher instructions or unopened Card faces. Hat and card pool labels are generic before reveal. Reveal variants derive from stable selection identity, so reward/effect commands and reload cannot change the chosen animation. Present seeks the authoritative epoch and does not select or award. Navigation/reset cancels stale timers and scoped actions remain idempotent. Reduced motion uses short reveals and static final artwork.

Prepared rounds also filter legacy sequence metadata, avoiding invalid references when unfinished activities are excluded. Missing Card/media references are removed only from the prepared runtime copy, with prompt/label fallback where available. Export/import and media dependency ownership remain shared infrastructure.

## Files changed in this phase

Shared model/runtime:
- `src/shared/lesson/spinningWheel.ts`
- `src/shared/lesson/miniGameBreak.ts`
- `src/shared/lesson/miniGameRuntime.ts`
- `src/shared/lesson/miniGameSetup.ts` (new)
- `src/shared/lesson/gameStage.ts` (new)
- `src/shared/lesson/wheelRuntime.ts`
- `src/shared/lesson/wheelPresentation.ts`
- `src/shared/lesson/session.ts`

Renderer:
- `src/renderer/lesson/MagicHatStage.tsx`, `magicHatStage.css` (new)
- `src/renderer/lesson/MysteryCardsStage.tsx`, `mysteryCardsStage.css` (new)
- `src/renderer/lesson/miniGameCommands.ts` (new)
- `src/renderer/lesson/MiniGameBreakEditor.tsx`, `miniGameEditor.css`
- `src/renderer/lesson/WheelTeachControls.tsx`, `WheelPractice.tsx`
- `src/renderer/lesson/WheelScene.tsx`, `wheelRuntime.css`
- `src/renderer/lesson/SpinningWheelPreview.tsx`
- `src/renderer/lesson/SceneSurface.tsx`, `LessonApp.tsx`

Validation and documentation:
- `src/shared/miniGameSetup.test.ts`, `miniGameVarietyRuntime.test.ts` (new)
- `src/shared/spinningWheelRuntime.test.ts` (updated intentional missing-content behavior)
- `tsconfig.test.json`
- `scripts/mini-game-variety-smoke.cjs` (new)
- `scripts/spinning-wheel-game-feel-smoke.cjs`, `spinning-wheel-animation-smoke.cjs`, `spinning-wheel-runtime-smoke.cjs` (updated sound label and playable missing-content expectation)
- This report and Phase 6 design/implementation documents under `docs/superpowers/`.

Pre-existing uncommitted Phase 1–5 changes were preserved.

## Validation

- Full automated suite: 717 passing, zero failures.
- Final focused setup/deal/persistence tests: 11 passing after stable reveal-variant correction.
- TypeScript: `npx tsc --noEmit -p tsconfig.json` passed.
- Renderer and main production builds passed. Renderer retains the existing large-chunk advisory.
- Native Electron variety check: label-only question plus unfinished draft, empty sample, both editors and isolated practice, manual reveal, direct/numbered selection, normal-motion Present reload during reveal, active reload mapping, reduced motion, reward replay safety, privacy, unchanged authored file.
- Native existing wheel/game-feel regression validates effects, timed selection, rewards, reload/navigation/reset and Classic review.
- Screenshots in `output/playwright/mini-game-variety/` inspected for legibility and clipping.

## Architectural notes and limits

Internal shared names still use Wheel (configuration settings reader, presentation and controls) to avoid an unnecessary migration of the established runtime. They now deliberately support all three registered games. Legacy version 1 configurations remain portable; Test game upgrades them in a sandbox and editing explicitly upgrades when saved. Custom round options retain previous requests even if current ready content is smaller; runtime explains the playable count.

Card fronts use a mystery emblem while the actual question/event renders alongside them. Hat reveals use a jewel rather than custom art for every outcome. A future polish pass could add outcome-specific reveal objects and dedicated hat/card sound palettes; no additional phase is implemented here.
