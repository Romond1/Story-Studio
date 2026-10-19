# Phase 6G adventure independence and final integration

Status: COMPLETE — the single-episode native demonstration, final regression gates, compatibility checks, and production read-only audit passed.

## Implementation

Content-specific compatibility defaults now live in explicitly versioned legacy adventure content. Existing legacy IDs, media paths, movement labels and standalone Snake sample questions remain available through that compatibility layer. Generic episode templates and hosted modules receive authored definitions and do not infer an adventure from a character, reward or relic display name.

## Single-episode native proof

`scripts/phase6g-integration-smoke.cjs` passed all eleven acceptance groups on the frozen final build, with no Control or Present renderer errors. The same synthetic episode was used throughout:

1. A physical gold character image, an 80-pixel derived crop, Activation Card V2, authored Snake questions, Boss card art, catalog metadata, module configurations and adventure reward/relic definitions were exported together.
2. The original source directory was renamed out of its expected path. A fresh application profile imported the package with networking offline; authored definitions and character pixels matched the exported episode.
3. Adventure rendered the physical character. Activation rendered its crop in Control and Present and completed for two existing synthetic roster identities. Snake rendered the same crop, retained the authored questions and completed through actual gameplay.
4. A teacher requested a reward against that captured completion. No grant occurred before approval. Changing the current participant selection did not reassign the pending result; approval granted one reward to each captured student.
5. Mastery displayed the character crop on the Boss card and read the approved inventory through the restricted module bridge. The module received no private progression API. Teacher relic progress and episode completion persisted separately from authored content.
6. After process restart, replaying the exact accepted native events and teacher decisions left the complete progression snapshot, revision and grant counts unchanged.
7. A second adventure reused the asset ID, character display name, reward IDs and relic IDs with cyan physical artwork. Control and Present rendered cyan pixels, rejected the old gold grant and retained separate inventories for the same student.
8. A subsequent portable export excluded roster identities, private adjustment reasons, receipts, decisions, inventory and progression history.

Evidence: `docs/phase6g-evidence/native/results.json`, `mastery-inventory.png`, and `second-adventure-cyan.png`. The result file includes synthetic event/replay evidence; it contains no production student data.

## Final verification

- Full application regression: **546 passed**, zero failures/skips; game checks: **50 passed**. Renderer/main typechecks and production builds passed.
- Integrated native gate: **11 passed**.
- Legacy native Media Pool, Card V2 editor/Present, actual dialogue audio and reward presentation: **4 passed** (`docs/phase6g-evidence/legacy/results.json`).
- Video-return native compatibility: **6 passed**, retaining video position across selection, launch, restart, edit launch, selection return and relaunch (`docs/phase6g-evidence/media-return/results.json`).
- Independent isolated conversion/package/progression persistence verification: **16 passed**, including exact source backups, failed publication/rollback, durable replay and retained recovery backup. See `docs/phase6g-evidence/review.md`.
- The read-only audit opened all six documented production episodes and found all **1,116 registered files**, with zero missing registered files. Every production project JSON hash remained unchanged and matched the 6B and 6C baselines. See `audit.json` and `hash-comparison.json` in the same evidence directory.

The production audit checks registered file existence and project JSON hashes; it does not hash every production media file or claim complete legacy dependency coverage. The vertical demonstration used disposable synthetic episodes and profiles, not a production migration. Package checks recognize supported signatures rather than fully decoding every possible media container. Legacy migration remains explicit; private progression remains outside portable lessons. No implementation commit, push, merge, branch change or production write was performed. The existing development watcher was not stopped.

Phase 6B–6G acceptance is complete. Phase 7 can build on the existing roster and progression service.
