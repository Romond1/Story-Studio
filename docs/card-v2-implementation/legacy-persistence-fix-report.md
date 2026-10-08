# Legacy card persistence prerequisite — verified

Date: 2026-10-08 (Asia/Tokyo).

Stop Condition B is resolved for untouched legacy card data. Opening and saving no longer publishes the runtime conversion of old bCardRef records into bCardInstances. Card V2 C1–C4 has not resumed.

## Change

`src/main/legacyCardPersistence.ts` introduces a main-process persistence boundary. It privately captures the original authored JSON and the normalized load baseline. The renderer still receives the existing normalized compatibility view, so rendering and teaching use the same runtime format as before. Before Save or Save As, the boundary restores unchanged card blocks from the original authored representation, including absent fields and legacy metadata.

`src/main/main.ts` associates the boundary with the pending project candidate and installs it only when that candidate is activated. Incidental loads during media import and unactivated candidates cannot replace the active baseline. Save As retains the baseline; failed saves do not advance it. Keeping the original load baseline also supports repeated saves and returning edits to their original state. Boundary bookkeeping is never sent to the renderer or saved in project.json.

Story slides and sections preserve the coupled storyReferences/bCardInstances block when unchanged. Booster sequences preserve their old reference entries and attachment order when unchanged, including sequences that need a synthetic prompt only at runtime. Unrelated prompt text edits are merged into the original host record without converting the references.

Intentional edits still persist: current-format card definitions, ACard board contents, placements, additions and deletions are saved normally. Deliberately editing a legacy placement block persists that edited block in the existing normalized format. Changing booster layout so trailing references would attach to a different host also persists that affected layout as displayed. Exact old-syntax preservation applies to untouched card blocks, not to an explicit legacy-to-legacy edit serializer. No migration UI or migration tooling was added.

The fix is scoped to card data. Ordinary project normalization and updatedAt behavior remain; the entire saved project file is not promised to be byte-identical.

## Regression coverage

Added 13 real-IPC persistence regressions in `src/shared/projectPersistence.test.ts`:

- Section and slide legacy references survive host-name edits and repeated saves.
- Activation, Language and Games legacy booster references survive prompt edits, Save As, a subsequent Save, and reopening.
- Legacy-only boosters do not publish synthetic runtime prompts.
- Current A/B content, placements, additions and deletions save normally.
- Unactivated project candidates cannot replace the active preservation baseline.
- Appending a booster host does not accidentally move trailing legacy cards to it.
- Failed Save As retains the baseline; activating another project replaces it.
- Editing a legacy card definition preserves untouched placements; deliberate placement edits and deletion still persist.
- References without authored IDs retain their original syntax.
- Current-format booster placement sizing and ACard board placement edits survive reopening.

The initial regressions failed on legacy structure loss before implementation. The trailing-booster test subsequently caught an attachment error in the first implementation; it was corrected before final verification.

## Verification results

- Test TypeScript compilation: passed.
- Main-process build/typecheck (`npm run build:main`): passed.
- Relevant suites: **92 passed, 0 failed** — 50 persistence, 7 card runtime, 23 presentation session, 12 presentation snapshot.
- `[Present] Card content failed` is the existing expected error-path diagnostic.
- No renderer code changed. No live Electron UI, renderer build, or packaged release test is claimed.

Commands, from the repository root:

```powershell
npx tsc -p tsconfig.test.json --outDir D:/Temp/story-card-legacy-fix-tests
$env:NODE_PATH = 'D:\AI\GitHub\Story-Studio\node_modules'
node --test D:/Temp/story-card-legacy-fix-tests/shared/cardRuntime.test.js D:/Temp/story-card-legacy-fix-tests/shared/presentationSession.test.js D:/Temp/story-card-legacy-fix-tests/shared/presentationSnapshot.test.js D:/Temp/story-card-legacy-fix-tests/shared/projectPersistence.test.js
npm run build:main
node docs/card-v2-implementation/audit-legacy.cjs
```

## Six-episode disposable-copy audit

The audit now asserts preservation rather than expecting the historical failure. It checks additions as well as deletions/changes to card blocks, including empty arrays and absent fields, and checks the normalized runtime card view after reopening. Each production source is read only; all opens and saves use fresh temporary copies.

| Episode | Authored card block changes | Runtime cards after save/reopen | Production source SHA-256 |
| --- | ---: | --- | --- |
| 1 | 0 | Matches | Unchanged |
| 2 | 0 | Matches | Unchanged |
| 3 | 0 | Matches | Unchanged |
| 4 | 0 | Matches | Unchanged |
| 5 | 0 | Matches | Unchanged |
| 6 | 0 | Matches | Unchanged |

All six passed; no V2 module appeared. The original Stop B reproduction also now preserves its bCardRef and does not save a generated bCardInstances field. Evidence, source hashes and disposable-copy paths are in [legacy-preservation-audit.json](legacy-preservation-audit.json). The earlier [legacy-load-audit.json](legacy-load-audit.json) is retained as historical failure evidence.

## Review checklist

1. On a disposable legacy project, open, change a non-card field, Save, and confirm the old card-reference syntax remains.
2. Teach its legacy cards and booster, then reopen the saved copy.
3. On a current-format copy, change card content or placement size and confirm Save/reopen retains the edit.

No production episode was modified. Existing unrelated working-tree changes were preserved. Work stops here; C1–C4 requires the user's next authorization.
