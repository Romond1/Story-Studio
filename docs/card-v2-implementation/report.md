# Card V2 implementation: C0 stop report

Date: 2026-10-07 (Asia/Tokyo).

Implementation stopped at the user's explicit stop condition B: "Legacy save cannot preserve untouched old card data safely."

## Reproduced preservation failure

The existing loader supports old `bCardRef` records, but converts them on load. A subsequent unrelated Save persists that conversion. The reproduction uses the real main-process IPC handlers through the existing persistence-test harness, with Electron stubbed. It opens and saves only disposable temporary JSON copies.

Input: a section `storyReferences` contains a `bCardRef` with ID `old-placement`, position `{x:100,y:120}`, and size `{width:270,height:390}`. After Open followed immediately by Save, `storyReferences` is empty and the card is in `bCardInstances`, at percentage position `{x:18.359375,y:43.75}` with added zIndex/displayMode fields. This is an existing compatibility conversion, not corruption introduced by V2. It conflicts with the mission's prohibition on automatic conversion and changes to untouched legacy card blocks.

Code path: `normalizeProjectData` calls `normalizeStoryReferences`, `normalizeLegacyStoryBCardRefs`, and `mergeBCardInstances` in `src/main/main.ts`. `normalizeStoryReferences` retains only ACard references; `legacyBCardRefToInstance` converts old geometry. `saveProject` writes the normalized document through `writeProjectAtomic`. Boost legacy BCard references are also converted by `normalizeBoostSequence` (source inspection; the executable reproduction covers section references).

Evidence: [legacy-load-audit.json](legacy-load-audit.json). Reproduce from the repository root with `node docs/card-v2-implementation/audit-legacy.cjs`. The script requires the six local episode paths and leaves disposable copies in the OS temporary directory for inspection. It never saves the production sources.

## Six-episode baseline

All six known production documents successfully opened through the real main-process handler. Temporary copies of all six were saved and reopened as JSON. Populated legacy card libraries, placements, story references, and ACard sequence references matched their input values. None gained a cardsV2 module. All six production-source SHA-256 hashes remained unchanged. This is a data/IPC check, not a live classroom or visual-rendering test.

| Episode | ACard definitions | BCard definitions | Populated card block changes on temporary-copy Save |
| --- | ---: | ---: | ---: |
| 1 | 4 | 31 | 0 |
| 2 | 1 | 10 | 0 |
| 3 | 1 | 27 | 0 |
| 4 | 1 | 24 | 0 |
| 5 | 1 | 22 | 0 |
| 6 | 1 | 23 | 0 |

Existing research records 136 board placements, 160 booster placements, 15 section placements, and three ACard references across these episodes. The six selected episodes do not contain the old bCardRef representation used by the stop-condition reproduction. Thus the general compatibility failure is not evidence of damage to these six episodes.

## Architecture and implementation status

The existing legacy route is identifiable through `src/renderer/acards`, `CardSystemProvider`, and the Control-owned `CardRuntime` / `useCardRuntime`; Present receives projections. No compatibility-boundary refactor was made because the persistence prerequisite failed.

V2 domain/schema, cards/faces/sets/placements/activities/tags/geometry: not implemented.

V2 authoring, creation/duplication, face editing, resizing, text fitting and templates: not implemented.

V2 runtime, Recall & Reveal, commands, reset and reuse: not implemented.

V2 Present projection, animation, geometry and recovery: not implemented.

No application source, project schema, or production episode file was edited by this task. Existing uncommitted application work was preserved. Only this audit script, evidence JSON, and report were added under `docs/card-v2-implementation`.

## Verification

Test TypeScript compilation passed:

```powershell
npx tsc -p tsconfig.test.json --outDir D:/Temp/story-card-v2-implementation-baseline
$env:NODE_PATH = 'D:\AI\GitHub\Story-Studio\node_modules'
node --test D:/Temp/story-card-v2-implementation-baseline/shared/cardRuntime.test.js D:/Temp/story-card-v2-implementation-baseline/shared/presentationSession.test.js D:/Temp/story-card-v2-implementation-baseline/shared/presentationSnapshot.test.js D:/Temp/story-card-v2-implementation-baseline/shared/projectPersistence.test.js
```

79 tests passed, zero failed: 7 card runtime, 23 presentation session, 12 presentation snapshot, 37 project persistence. The logged `[Present] Card content failed` is the existing expected error-path diagnostic. The added audit also passed its source-integrity and conversion-reproduction assertions. This is not a new V2 test suite. Full application typecheck, renderer/main build, packaging, and live UI checks were not run after the stop condition.

## Manual checklist

1. Use a disposable copy of an Episode 1–6 project; check existing cards in Teach and Present.
2. Inspect the before/after legacy-reference example in the evidence JSON.
3. Do not attempt the Episode 7 V2 workflow yet: no V2 authoring or runtime was installed.

## Required prerequisite and deferred work

Before resuming C0–C4, separate untouched legacy authored data from normalized runtime compatibility views so an unrelated Save preserves the original card representation. Add round-trip coverage for old story and boost bCardRef records, as well as current A/B libraries and placements. This is a prerequisite recommendation, not an implemented migration or a change to the user's scope.

All V2 implementation is deferred under stop condition B. Story overlays, C5/C6, games, migration tools, and the other explicitly excluded features remain unimplemented. No further work was attempted after confirming the stop condition.
