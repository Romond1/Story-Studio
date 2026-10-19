# Independent Phase 7E review and production preservation

No blocking defect was identified in the reviewed multi-adventure identity, private progression, or authored package boundaries. This review changed only documentation/evidence and ran isolated tests plus the read-only audit.

## Focused evidence

Fresh shared test compilation and 23 tests passed across adventure content, package service/contracts, Hero Board selectors and progression service. The new `studentAdventureIntegration.test.ts` then passed all three tests independently: two same-named permanent profiles/classes across three episodes and two adventures; identical reward/relic identifiers remaining adventure-scoped; profile archive/restore/restart preserving identities and history; and observed completion receipt replay/collision handling after restart. Total focused checks: **26 passed**.

The package projection validates a strict episode schema and explicitly constructs authored fields. It does not read profile settings or the private progression store. Export copies registered authored asset paths rather than recursively copying the project directory. Existing tests confirm private sibling files are excluded, private schema extensions reject, and unlisted package files reject on import. Core progression indexes permanent balances by student and adventure IDs, and module inventory reads return only captured participants' reward quantities for the matching adventure. Names and legacy adventure content are not identity keys.

These are source and isolated-test conclusions, not a claim that arbitrary user-authored media cannot itself contain personal information.

## Six production episodes

Ran `scripts/phase6b-audit.mjs` with `STORY_STUDIO_EVIDENCE=docs/phase7f-evidence`. All six documented production JSON files opened through the real loader without activation, migration or saving. Each SHA-256 stayed unchanged during open and matches the Phase 6G baseline. All **1,116 registered files** were present, with **zero missing** and zero lexical outside-root paths.

Evidence: `audit.json` and `hash-comparison.json` in this directory. The audit hashes project JSON and checks registered-file existence; it does **not** hash media contents. Existing unregistered-local/unknown-content diagnostics remain visible and were not repaired or silently discarded. No production files were written.

## Accepted manual-batch limit

Group adjustments retain pending command IDs across Teach branch/mode remounts via the root-owned map, including an actual committed lost-acknowledgement retry verified by the latest Phase 7D native gate. Process restart discards the unfinished manual batch's in-memory retry handle. The UI does not automatically replay such batches or claim crash recovery; Core event and command receipts themselves remain durable.
