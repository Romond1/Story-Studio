# Phase 7A persistent profiles

Status: COMPLETE — full regression, focused legacy safety verification and native acceptance passed. Phase 6 acceptance remains complete.

## Intended identity and storage contract

- Extend the existing application roster; preserve every valid existing student ID and creation timestamp.
- Treat names and nicknames as display metadata. Equal names neither merge records nor identify migration targets.
- Archive and restore profiles without deleting their identities, progression receipts, inventory, relic history, or completed episodes.
- Require explicit legacy source plus source-student identity and a chosen existing target, or explicitly import a new identity. Do not infer mappings from names or import historical scores automatically.
- Keep profile data in private application settings and progression in the existing private progression service. Preserve unrelated settings, including audio settings.
- Reject corrupt or ambiguous settings instead of silently treating them as an empty roster. Persist edits atomically with recovery evidence.

## Independent safety tests

The separate `src/shared/studentProfileSafety.test.ts` suite is owned by the independent reviewer. It was written before the new repository/service existed and initially failed compilation on those missing modules.

Verified checks:

1. Reading valid existing settings performs no write; equal display names retain distinct IDs.
2. Profile edits, archive and restoration retain IDs and original creation timestamps, while preserving audio and unrelated settings.
3. Invalid JSON and duplicate student IDs reject both reads and edits without replacing source bytes.
4. Explicit legacy mappings cannot silently retarget an already mapped source identity.
5. Importing a profile with an existing display name creates a distinct identity rather than merging.
6. Oversized updates reject before replacing either settings or their recovery backup.
7. Legacy callbacks use per-profile mutations, retain newer canonical names/archive state, and leave UI/cache untouched when persistence fails.
8. An empty canonical roster never triggers automatic import of a localStorage fallback.

Fresh command results: `npx tsc -p tsconfig.test.json` followed by `node --test dist-test/shared/legacyRosterSafety.test.js dist-test/shared/studentProfileSafety.test.js dist-test/shared/studentImport.test.js` passed all **9 tests**. Renderer typechecking (`npx tsc -p tsconfig.json --noEmit`) also passed. The legacy callback tests first reproduced the stale bulk-write and false-success failures, then passed after the scoped mutation fix.

## Existing compatibility risk being addressed

Review identified that the legacy renderer could submit a cached whole roster after the new profile UI had edited canonical records. Its add/rename/archive actions now call the scoped student API, and update the displayed roster and optional cache only after durable success. Canonical read failure leaves fallback profiles read-only; empty canonical settings no longer cause automatic fallback import. The legacy bulk IPC facade remains for compatibility and preserves omitted IDs/rich fields, but the application's active profile mutations no longer rely on stale bulk updates.

Repository review also identified a size-bound gap; the implementation agent added bounded same-handle reads and an output-size guard before backup or primary writes. The independent oversized-update test passed. Corrupt settings remain errors, not a reason to create an empty roster. Names are not used as merge keys, archive does not remove IDs, and profile services do not write the progression repository.

## Native acceptance and final verification

The full application suite passed 552 tests before the final legacy callback correction. Seven focused legacy checks passed after that correction; the renderer/main typechecks and builds also passed. Seven native acceptance groups then passed on the frozen build with no renderer errors: duplicate-name profiles retained distinct identities; Present exposed neither private student APIs nor names; nickname/avatar edits preserved the other same-name record; archive/restore retained all seeded private progression; explicit legacy mapping and separate creation transferred no balances; duplicate source IDs rejected; and exact profiles/mappings/progression survived process restart. Initial dialog focus and Escape dismissal passed. Screenshots at 1184×720 and 620×720 were inspected, and fields plus Save remained reachable.

Evidence: `docs/phase7a-evidence/native/results.json`, `profiles-1184.png`, and `profiles-620.png`. All writes used disposable profiles and synthetic students. Corrupt-settings behavior is covered by the isolated backend checks above, not by a production corruption test. The prior Phase 6G production read-only audit remains preserved; 7A did not write production lessons or profiles.

