# Phase 6F shared progression

Status: COMPLETE — full regression and native progression/Activation acceptance passed.

The private `userData/progression/progression-v1.json` repository stores accepted receipts and their effects atomically. Existing application roster IDs remain the student identity authority. Runs capture participants and adventure definitions; module results require an authenticated, running transport. Teacher decisions grant rewards separately. Core inventory reads expose only the current run's captured participants and adventure, without profile names or history.

Control provides pending approvals/rejections, reward requests tied to recorded completion, manual adjustments with reasons, manual relic progress, episode completion, and history. Mastery can read approved inventory through the module bridge. Lesson packages do not contain this repository.

## Explicit legacy mapping procedure

Legacy lesson scores and relic counters remain unchanged and are never imported automatically. Before entering a historical balance:

1. Open the legacy lesson only for inspection and identify its source student record by its stable source identifier. Do not infer identity from matching display names.
2. Select the existing application roster student whose identity the teacher has verified. If no identity can be verified, leave the record unmapped.
3. Open an episode in the intended adventure and define the appropriate reward/relic if necessary. Save the definitions.
4. In Rewards and progress, choose that exact student, reward or relic. Apply an explicit teacher adjustment with a reason that records the legacy lesson/source record identifier and the teacher's mapping decision.
5. Inspect the recorded adjustment and inventory. Repeating an uncertain in-flight action retries its command identity; an additional intentional adjustment is a separate action.

This is a manual mapping procedure, not an automatic migration or a score conversion rule. Educational scores are never synthesized. Phase 7 will add the dedicated profile/class and migration mapping interface after Phase 6 passes its integration gate.

## Verification

The full application regression passed 543 tests, with zero failures/skips (`.tmp-phase6f-tests.log`). All 50 game checks pass (`.tmp-phase6f-games.log`). Renderer/main typechecks and production builds pass. The actual hosted hook test confirms it does not acknowledge a result or count it as accepted until Core persistence succeeds, and reports disk failure without claiming acceptance. Eight native progression groups passed on the first run with no renderer errors: actual Challenge completion for two existing roster IDs; pending teacher approval without automatic grants; captured-participant approval after selection changes; read-only Mastery inventory; relic and episode-completion persistence; exact event/decision replay after process restart without a revision or grant change; same-name cross-adventure isolation; and package privacy. Supplemental Activation native verification passed authoring, durable start, pause/resume/next, fresh-run reset and exactly one captured completion for two students without inventory grants. Evidence: `docs/phase6f-evidence/native/results.json`, `mastery-inventory.png`, and `docs/phase6f-evidence/activation/results.json` / `completed.png`. All writes used synthetic identities and disposable profiles.

Independent review drove three fixes: bounded, strict receipt/state reconstruction; preservation of already-observed results when exiting a running module; and a previous-valid-snapshot recovery backup alongside the atomic primary store. Corrupt primary data is rejected rather than silently replaced by that backup. Scope is checked again immediately before publication. Existing persistence test harnesses gained an isolated `app.getPath` mock; their assertions remain intact.

