# Mini-game Break architecture — Phase 1

## Audit and integration points

The active lesson editor uses `LessonScene` definitions and stable timeline `SceneEntry` occurrences. A Break is an occurrence with `kind: 'break'`, not a separate engine. `lesson/sections.ts::insertBreak` creates a scene with review text; the Inspector edits it through existing immutable scene commands and history. Breaks are top-level timeline containers. Removing an occurrence retains its reusable scene; existing cleanup/session reconciliation removes unreachable live state. No deletion path needed a new persistent entity.

`lesson/commands.ts::duplicateEntry` delegates to `copyScene`: independent copies create new scene/object/Card identities, while linked copies share scene authoring. The extension follows those semantics. Local activity IDs and sequence references are regenerated for independent copies; content references to copied Cards are remapped, while references to other library Cards remain shared.

Scene-v1 files load through `parseLessonProject`; episode files use the same scene-body validator plus strict authored-field validation. Existing JSON save, recovery, Save As and portable-package paths carry scene authoring. Both episode and media-dependency allowlists now recognize `breakExperience`. An actual portable export/import regression covers its preservation.

Edit, Teach preview, timeline thumbnails and Present all use `projectScene` / `SceneSurface` and the existing `LogicalSceneFrame`. `LessonApp` projects the teacher-owned session into `PresentSnapshot`; `parsePresentSnapshot` delegates to `parseScenePlan` before transport/rendering. No second random selection or independent Present engine is introduced. Explicit occurrence context prevents linked ordinary scenes from inheriting a Break placeholder.

Existing questions can use multi-face Card definitions by ID. `lesson/rewards.ts` already keeps teacher scores, sparks and reward visuals in session state, using the existing reward presentation parser and idempotent event handling. This phase copies no question text, stars, crowns, badges, reward definitions or student data. The existing `gameHost.ts` registry hosts full games in Present-owned iframes, including Hero Dash, Language Snake and Final Boss Hero. Its static registration pattern is useful, but its hosting lifecycle is inappropriate for an in-scene Break placeholder. Existing boosters, Card interactions, drawings, audio and reward controls continue unchanged.

Legacy section-based Breaks retain their compatibility models and renderer. Mini-game authoring is introduced in the current scene/episode editor; converting legacy Breaks into this model remains a separate explicit workflow.

## New contracts

- `BreakExperience`: absent or `{ mode: 'classic' }`, or a versioned `MiniGameConfig`.
- `MiniGameActivity`: stable local ID, question/event kind, optional existing Card-definition `contentRef`, bounded JSON configuration.
- `miniGameRegistry`: `spinning-wheel`, `magic-hat`, `mystery-cards`; each declares display metadata, default settings, version/validation, three placeholder surface slots and the common `selection-v1` runtime adapter ID. These are planned registrations, not playable games. Renderer components remain renderer-owned.
- `MiniGameRuntimeAdapter`: initialization and pure action transitions. Runtime state contains version, configuration fingerprint, phase, current activity and used IDs. It is stored on the existing occurrence cache, separate from document data.
- Actions: begin, explicit teacher reveal, complete, end, reset. Duplicate/unknown reveals and reveals outside a running session do nothing. No random values, clocks, browser objects or components enter state.
- Optional `settings.sequence` orders activity IDs. Without it, the teacher/adapter chooses eligible activities. Events and questions can alternate in any configured order; no global event/question ordering is imposed.
- Completion emits an inert activity-result intent. Reward/effect intent types are extension points only, with no dispatch or animations. The session helper currently applies state only; Phase 2 must deliberately route intents to existing controllers.
- `MiniGamePlaceholder`: minimal whitelisted phase/current/used-ID projection. Authored settings and the configuration fingerprint do not cross the Present boundary. Actual question rendering is deferred.

## Compatibility and failure behavior

No format/version migration or rewrite is required for old lessons. Missing authoring data resolves to Classic, and Classic scene plans omit mini-game data entirely. Existing Break rendering stays in place beneath the minimal placeholder.

Configuration is validated independently of rendering. Bounded JSON for unknown types, future versions or invalid configurations remains saved intact, but resolves to an unavailable placeholder and cannot initialize a session. Non-JSON/oversized payloads fail document validation. Missing referenced Cards also make the experience unavailable. Runtime restore checks configuration identity, version, phase and activity membership; stale/invalid state falls back to authored defaults. Reset rechecks occurrence eligibility. Switching to Classic or changing authored configuration invalidates active mini-game state on reconciliation.

The Inspector exposes only Classic/Mini-game and planned game selection. Teach identifies the configured game or unavailable fallback. No activity editor, game interactions, reward behavior, animations or application redesign is included.

## Changed files

New:

- `src/shared/lesson/miniGameBreak.ts` — authoring types, registry, validation, placeholder contract.
- `src/shared/lesson/miniGameRuntime.ts` — shared runtime/intent contracts, initialization, restore, transitions.
- `src/shared/miniGameBreak.test.ts` — ten regression tests.
- `scripts/mini-game-break-smoke.cjs` — real Electron Edit/Teach/Present smoke check.
- This report and `docs/superpowers/{specs/2026-10-25-mini-game-break-design.md,plans/2026-10-25-mini-game-break.md}`.

Modified:

- `src/shared/lesson/{model,validation,commands,session,projection}.ts` — optional model, safe persistence, copy identities, occurrence runtime and projection parsing.
- `src/shared/episode/validation.ts`, `src/shared/content/mediaDependencies.ts` — persistence/package allowlists.
- `src/renderer/lesson/{SceneInspector,SceneSurface,LessonTeachControls,LessonApp,LessonTimeline}.tsx` — minimal authoring/teacher/placeholders and occurrence-aware rendering.
- `tsconfig.test.json` — include the new test in the existing runner.

## Verification

- `npm test`: **668 passed, 0 failed**. Ten new tests cover old documents/Classic projection, persistence and copy identity, invalid/unknown/future configs, deterministic serialization, occurrence isolation/reset, mixed Break/ordinary linked occurrences, configurable sequences and sequence remapping, invalid runtime/IPC input, Card remapping/missing references, actual portable export/import. Existing persistence, rewards, legacy compatibility and Teach/Present protocol tests also pass.
- `npm run build:main`: passed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build:renderer`: passed; Vite reports its existing large-chunk advisory.
- `node scripts/mini-game-break-smoke.cjs`: passed. Checks Classic, authoring/save, Edit/Teach/Present planned recognition, unknown fallback and a 700px window; no renderer page errors. Screenshots: `output/playwright/mini-game-break/{edit,teach,present,narrow}.png`.
- Read-only review identified and verified the fix for linked-occurrence projection; re-review found no remaining definite correctness issues.

## Risks and Phase 2 starting point

Keep Card-definition references as the current question-source contract. If future questions need object placement, catalog entity or activity references, add a versioned reference discriminator rather than overloading `contentRef`. Settings must not silently introduce media paths; extend dependency collection explicitly if future configs reference media.

Choose whether question completion should drive Card face state and how reward intents gain occurrence/session-scoped idempotency keys before enabling rewards. There is intentionally no automatic reward dispatcher or result presentation yet. If future games need repeated activities within one configured sequence, introduce explicit repeat/round policy in a new validated configuration version; this foundation tracks each activity as used once until reset.

Phase 2 should implement one Spinning Wheel vertical slice using the existing shared selection contract: activity authoring with Card references, a renderer-owned settings/control/presentation component mapping, teacher-only selection, then snapshot-based activity reveal. Validate that one game end-to-end before adding Magic Hat or Mystery Cards. Do not create parallel engines.

No commits or pushes were made. Phase 2 was not started.
