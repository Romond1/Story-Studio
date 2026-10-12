# Phase 6B Unified Media Registry Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task only after the user explicitly starts Phase 6B. Steps use checkbox syntax for tracking. Do not automatically begin 6C, commit, merge, push, or modify protected branches.

**Goal:** Give both existing lesson formats one shared asset lookup, dependency-reporting and scoped-resolution boundary while preserving every existing ID, imported file, bin and authored reference.

**Architecture:** Keep each document's existing `assets`/`mediaBins` as its only writable registry. Build a disposable shared view and typed reference graph over those arrays, register imports through current document/history transactions, and use main-process project leases for safe resolution. Keep legacy compatibility adapters; introduce no new persisted format or content migration in 6B.

**Tech Stack:** Existing TypeScript, React, Electron IPC, Node `node:test`, filesystem APIs and repository Electron smoke harnesses. No new plugin loader, database or external dependency is needed.

---

## Scope and prerequisites

Read [the audit](../../phase6a-architecture-audit.md) and [contracts](../../phase6a-contracts.md) first. Proposed files below do not exist in the 6A baseline unless marked Modify/Extend. Interfaces in the contracts document are specifications, not executable patches. Production implementation belongs to the separately authorized 6B turn.

Keep Card V2/A/B behavior, scene transforms, game stores, reward state and both file formats unchanged. No derived assets, semantic catalog UI, adventure pack conversion, game authoring integration, permanent progress, packaging or automatic asset deletion in 6B. Games remain explicitly disconnected consumers until 6D; do not claim all modules integrated at the 6B gate.

Inspect the then-current working tree and rebase this plan against any intervening changes without overwriting user work. Baseline in the audit is `16ae31d`. Baseline commands passed 440 app tests and 33 game checks; test counts may legitimately grow. Do not turn a baseline count into an exact-count assertion.

## File responsibility map

| Action / file | Concrete responsibility |
| --- | --- |
| Create `src/shared/content/mediaRegistry.ts` | `createMediaRegistry`, immutable ID/path indexes, duplicate diagnostics, typed registry view. Reuse `AssetItem`/`MediaBin`; never create a second writable collection. |
| Create `src/shared/content/mediaDependencies.ts` | Common edge/issue types, scene and legacy walkers, field-specific path/URL compatibility matching, separate definition edges from placements. |
| Create `src/shared/content/mediaResolution.ts` | Pure parsing/canonicalization and structured resolution errors; exact aliases, no arbitrary substring matching. |
| Create `src/main/mediaRegistryService.ts` | Active project lease, validated manifest/grants, realpath containment, scoped URL resolution and retirement. Main owns only an access index, not authored state. |
| Create `src/renderer/useMediaRegistry.ts` | Memoized immutable registry view and prefetched resolved lookup for current document/lease/revision. Retire results on switch; expose diagnostics. |
| Modify `src/main/main.ts` | Wire service into prepare/activate/Save As and media protocol; use shared import service for audio and register new bubble assets through compatible return fields. Preserve existing locks/atomic writer. |
| Modify `src/main/lessonPersistence.ts` | Pass active lease lifecycle through host interface on activation/Save As without changing scene JSON. |
| Modify `src/main/mediaImportService.ts` | Share copying/metadata for all new file imports; optional explicit destination policy for legacy bubble path naming; preserve current partial failures and directory bins. |
| Modify `src/main/preload.ts`, `src/renderer/vite-env.d.ts` | Expose typed Control-only lease/manifest/resolution commands and compatible import results; no filesystem object or generic IPC escape hatch. |
| Modify `src/shared/mediaPool.ts`, `src/shared/lesson/mediaImport.ts`, `src/shared/mediaImport.ts` | Registration guards and shared dependency APIs; retain format-specific scene/slide creation. Preserve existing exported helpers as adapters where used. |
| Modify `src/renderer/MediaPool.tsx`, `src/renderer/lesson/LessonMediaPool.tsx` | Consume registry list/bins/definition dependencies. Label usage consistently; unresolved dependency warnings must not masquerade as zero usage. |
| Modify `src/renderer/App.tsx`, `src/renderer/lesson/LessonApp.tsx` | Construct one registry view per revision, route lookup/import/resolve through it, pass resolvers to existing projections. Keep saved/current/history snapshots and latest-revision guards. |
| Modify `src/renderer/lesson/SceneInspector.tsx`, `src/renderer/cardsV2/CardV2Editor.tsx` | Use registry-filtered media options supplied by parent; maintain existing ID-valued authoring fields. |
| Modify `src/renderer/mediaUrls.ts`, `src/renderer/useRewardPresentation.ts`, `src/renderer/movement/builtinMedia.ts` | Central compatibility URL handling and resolver injection at project-media seams; retain explicit bundled-media mapping and presentation-only cache scope. |
| Modify `src/shared/lesson/projection.ts` | Keep synchronous injected resolver seam; remove duplicated fallback building at callers and route remaining fallback through shared canonicalization. Preserve render-plan shape. |
| Extend `src/shared/types.ts` | Only additive runtime/import-response interfaces as needed. `ProjectData`, `AssetItem` and scene v1 serialized requirements remain unchanged. |
| Preserve `src/main/legacyCardPersistence.ts`, `src/shared/lesson/model.ts`, `src/shared/cardsV2.ts` | No schema conversion, normalization rewrite or Card V2 extension for this phase. Guard with regression tests. |
| Create `src/shared/mediaRegistry.test.ts`, `src/shared/mediaDependencies.test.ts`, `src/shared/mediaResolution.test.ts` | Tests at the existing `npm test` glob depth; pure registry/graph/resolver cases and main-service harness. |
| Extend `src/shared/projectPersistence.test.ts`, `src/shared/lessonPersistence.test.ts`, `src/shared/lessonLifecycle.test.ts`, `src/shared/lessonProjection.test.ts`, `src/shared/mediaPool.test.ts` | Real persistence, async import/revision race, projection and existing helper behavior. |
| Modify `tsconfig.test.json` | Explicitly include the three new test files; imported implementation files then compile transitively. |
| Create `scripts/phase6b-media-registry-smoke.cjs` | Isolated native Electron vertical proof using temp fixtures/profile; report source hashes and screenshot/console evidence. |
| Create `docs/phase6b-report.md`, `docs/phase6b-evidence/` | Changed files, executed checks, native evidence, retained compatibility exceptions, limitations and risks. |

The existing `Window.appApi` and `Window.lessonApi` declarations are in `src/renderer/vite-env.d.ts`; extend these rather than creating parallel declarations.

## Task 1 — Immutable registry and dependency tests

- [ ] Add tests before implementation to the three proposed top-level test files and include them in `tsconfig.test.json`.
- [ ] Run `npm test`; new imports/tests should fail until the implementation exists. Confirm failures concern the missing registry behavior, not an unrelated environment problem.
- [ ] Implement the contracts' `createMediaRegistry(ProjectDocument)`, graph types and exact canonicalization. Freeze or return defensive views; never mutate the input arrays/objects.
- [ ] Run the targeted compiled tests after `npx tsc -p tsconfig.test.json`:

```powershell
node --test dist-test/shared/mediaRegistry.test.js dist-test/shared/mediaDependencies.test.js dist-test/shared/mediaResolution.test.js
```

Required fixtures/assertions:

| Fixture | Expected |
| --- | --- |
| Same image ID in a Story background and Activation card face | Two distinct authored field edges, one physical record; same lookup identity. |
| Card face exists only in an unplaced definition | One dependency edge even though scene placement count is zero. |
| One scene linked into two entries | One set of definition edges; two placements available separately, no duplicate dependency inflation. |
| Same display name, different IDs and bytes | Two distinct records. Never merge by name. |
| Duplicate asset ID or two records for the same path | Diagnostic; ambiguous lookup refused; no rewrite of the source. |
| Nested bins, optional legacy bins, invalid cycle | Valid hierarchy preserved; missing/cyclic edges diagnosed without infinite traversal. |
| Unknown field containing apparent media | Source retained; graph marked incomplete when unknown content could own dependencies. No silent pruning. |
| Mutation attempt / serialization before and after registry creation | Document and IDs unchanged. |

Use deterministic IDs in fixtures. A representative assertion against the specified interface is:

```ts
const registry = createMediaRegistry({ format: 'scene', data: fixture });
assert.equal(registry.get('character-image')?.id, 'character-image');
assert.deepEqual(registry.usages('character-image').map(use => use.field).sort(), [
  '/cards/recall/faces/0/imageAssetId',
  '/scenes/story/background/assetId',
]);
assert.equal(JSON.stringify(fixture), originalJson);
```

Fixture `recall` deliberately has no scene placement in the library-only variant. Preserve all definitions independently of their reachability from a current presentation cursor.

## Task 2 — Legacy reference coverage and compatibility façade

- [ ] Add table-driven tests for every field family in the audit: slide/scene media, AudioClip, AudioCue both target forms, section background CSS/music, bubble paths, A/B cards, Card V2, reward slots, relic slots and movement paths.
- [ ] Implement per-format walkers in `mediaDependencies.ts`. Decode only known path/URL fields; normalized exact match is required. Keep built-in movement mapping explicit.
- [ ] Route `mediaUsage` through shared definitions or retain it as a compatibility wrapper with documented changed UI semantics. Move the scene pool's authored-dependency logic out of the React file. Update tests/UI labels together.
- [ ] Run new dependency tests plus `dist-test/shared/mediaPool.test.js`, `dist-test/shared/mediaImport.test.js` and `dist-test/shared/lesson/mediaImport.test.js`.

Test both `media://assets/name.png` and `media:///assets/name.png`, percent-encoded spaces/Unicode, render query parameters, Windows separators in legacy paths, unrelated prose containing a filename, external/data URLs, empty optional references, missing IDs, and name collisions. Do not accept double-decoded traversal. A path-only `assets/bubbles/custom.png` is reported as unregistered and remains readable through compatibility; merely opening it must not add an `AssetItem` or write the file.

## Task 3 — Main-process scoped resolution

- [ ] Add service harness tests for lease issuance/retirement, authenticated manifest replacement, lookup by ID/type and safe paths before changing IPC.
- [ ] Implement `mediaRegistryService.ts` and narrow preload types. Populate its access index from a validated current manifest submitted by Control; revision-gate updates. This must work for newly imported unsaved assets as well as records loaded from disk.
- [ ] Wire main activation and successful Save As to retire prior grants; failed/cancelled Save As retains the old lease. Extend the lesson host interface accordingly. Do not change authored JSON.
- [ ] Add scoped `media://` handling without removing legacy URL handling. Validate physical realpath against the pinned project root. Preserve streaming/range behavior for video and audio.
- [ ] Exercise the real main handlers through existing persistence harness patterns; run targeted resolver, persistence and media tests.

Required checks: forged/wrong sender rejected; stale manifest revision cannot replace newer grants; project A→B with identical relative paths cannot resolve an A lease against B; async results after retirement ignored; missing file returns structured failure; lexical/encoded traversal and symlink/junction escape rejected; cancellation does not redirect active folder; granting a raw path not in the validated registry is refused. Platform-dependent symlink creation failures must be explicit skips with an alternative realpath containment test, not silent passes.

## Task 4 — Import registration without a second store

- [ ] Add tests for importing files/folders/audio/bubble PNGs into both formats, preserving nested bins and expected destination during picker latency.
- [ ] Use `importProjectMedia` for the audio path; retain its `AssetItem[]` facade for existing callers. Add a shared lower-level copy policy if bubble compatibility needs `assets/bubbles/<name>` rather than UUID paths. Existing bubble import returns its path plus a new asset record for the current Control command to register once.
- [ ] Validate batch IDs/bins and expected active lease before one immutable registration/history transaction. Keep partial-copy failure details; do not generate duplicate registration on retries.
- [ ] Ensure import completion composes with the latest allowed authored revision and refreshes grants before newly imported media is rendered. Failed registration must report copied-but-unregistered files; no automatic deletion of user content.
- [ ] Run `npm test`. Preserve the existing no-save/no-switch-during-import guard and no orphan overwrite tests.

No hash-based byte deduplication in this step. New asset identities remain UUIDs. Do not relocate existing bubble/audio files or silently register all old path references during open.

## Task 5 — Connect existing teaching surfaces

- [ ] Implement `useMediaRegistry` and a resolved immutable lookup cache keyed by lease+document revision. Do not call async resolution from React render/projection or issue a second full document store.
- [ ] Connect LessonApp and legacy App at their existing document ownership seams; feed the same lookup to scene/card projections, inspectors and pools. Convert inline project-media resolution in reward/movement helpers via injected compatibility resolver while preserving built-in paths.
- [ ] Keep legacy direct path resolution explicit and diagnosed. Do not broadly refactor the large legacy App or replace its A/B/Card V2 rendering during this task.
- [ ] Extend renderer-boundary tests: Edit/Teach/Present use the same image, hidden card faces remain stripped, resolver failures show actionable state, switching project retires old images/audio, cards and bins retain selection/IDs.
- [ ] Run `npm test`, `npm run check:games`, `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.main.json`. Confirm commands match current repository compiler configuration before executing.

Games remain on their existing bridges in 6B. Provide the registry contract for their future adapters without adding a hidden second game runtime or storing their configs in an ad hoc lesson key.

## Task 6 — Native vertical proof and compatibility gate

- [ ] Implement `scripts/phase6b-media-registry-smoke.cjs` using existing Electron smoke patterns; temporary source lessons, separate userData profile and explicit evidence folder only. Never point native save tests at the six production episodes.
- [ ] Run `npm run build:renderer`, then `npm run build:main`, then `node scripts/phase6b-media-registry-smoke.cjs` with the repository's supported Playwright runtime resolution.
- [ ] Execute the audit's 6B proof: one import, nested bin, Story background and Activation card, unplaced definition, Save As, reopen, distinct same-filename lesson, stale lease rejection. Verify exactly one imported source image and source JSON/media hashes unchanged.
- [ ] Check audio/video through the existing scene owner/media transport, including game→lesson return using `scripts/game-media-smoke.cjs` when its FFmpeg/runtime prerequisites are available. If unavailable, report the exact missing prerequisite and do not claim this gate passed.
- [ ] Run the six-source read-only audit again after `npm test`; all source JSON hashes/asset records remain unchanged. Add synthetic legacy v1/v2/v3 and scene v1/no-section fixtures to persistence tests because the six actual episodes cover only legacy v4.
- [ ] Inspect `git diff --check` and the changed-file list; report results and stop at the 6B boundary. Do not commit or start 6C automatically.

Exit criteria: registry is the shared media lookup/dependency interface for existing Adventure/Activation teaching surfaces; no second persistent registry, no lost bins/IDs/imports; legacy and scene source JSON unchanged on open; native shared-image Save As proof passes; missing/ambiguous references are explicit; stale scope cannot resolve a replacement project's assets; all relevant tests pass or any unmet gate is clearly reported as incomplete.

## Later phases — separate authorization and report for each

| Phase | Bounded implementation | Primary existing seams / proposed additions | Required automated + E2E + compatibility gate |
| --- | --- | --- | --- |
| **6C Derived assets/catalog** | Versioned source-preserving image transforms, adventure/entity/collection IDs, manual tags and filters. New `story-studio-episode` envelope only via explicit conversion copy; no automatic tagging. | Reuse `lesson/model.ts` submodel, `cardV2Render.ts`, `SceneSurface`; add `shared/content/derivedAssets.ts`, `contentCatalog.ts`, `shared/episode/model.ts` and versioned parser/explicit migration service. | Crop/transform math, source immutability, duplicate names across adventures, multiple entity assets, invalid source rejection; same derived crop in Edit/Present; backed-up v1/legacy conversion and reopen original. |
| **6D Modular boosters/games** | Bundled activity type/version/config and lifecycle/ports. Integrate one Card booster, Snake and Final Boss adapters, retain internal mini-game registry. Core owns hosted authored config. | `gameHost.ts`, `PresentGame.tsx`, `presentWindow.ts`, both game bridges, Snake `App.jsx`, Final Boss `battleStore.ts`; add `shared/modules/contracts.ts`, registry and per-game adapters. | Config import/export and asset declaration conformance; stop/restart/close/failure cleanup; no implicit localStorage adoption; edit questions in hosted runtime, save through Core, return to same Story occurrence; standalone JSON saves still open. |
| **6E Unified packaging** | One portable episode folder with manifest, all authored module data, transitive media and pinned adventure definitions. Exclude permanent students/progress and run checkpoints. | `lessonPersistence.ts`, main writer/copy service, module adapters; add `main/episodePackaging.ts`, manifest validation and fixture suite. | Complete closure/digest/path/collision tests; interrupted export leaves originals; missing media and unsupported modules block success; clean-profile offline import renders all four modules; sanitization assertions cover legacy students/badges/relic progress and game sessions. |
| **6F Events/rewards/progression** | Typed completion/score/reward requests; teacher decisions; durable idempotent private progress repository scoped by student/adventure/episode. No full roster CRM. | `lesson/rewards.ts`, `rewardRuntime.ts`, `useRewardPresentation.ts`, global roster settings; add `shared/progression/events.ts`, `main/progressionStore.ts` and transaction tests. | Duplicate/different-payload replay, crash-before-ack, rejected/stale runs, two participants, identity conflict mapping and rollback; teacher approves once across module exit/reopen, package remains student-free. |
| **6G Adventure context/integration** | Load versioned adventure defaults/content snapshots and remove content-specific constants from engine paths with compatibility aliases. Verify Be a Hero and Cyber Hero contexts. | `movement.ts`, `builtinMedia.ts`, `relics.ts`, `sparkRewards.ts`, Final Boss `sampleData.ts`; add adventure manifests/loader and integration fixtures. | Two synthetic/content-authorized adventure fixtures with same-name characters, isolated content/progress, missing-version diagnostics; complete offline full-Phase-6 proof; native Control/Present lifecycle, media/audio, original six-project read-only regression and explicit migration rollback. |

Each phase report must list scope, implementation/changed files, commands and actual results, native E2E evidence, original-format compatibility evidence, remaining risks and unsupported content. Production Be a Hero/Cyber Hero assets or semantics must be supplied/selected explicitly; synthetic fixtures demonstrate architecture without inventing a production content pack. The phase gate is not permission for the next phase.
