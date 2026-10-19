# Phase 7E student and adventure independence

Status: COMPLETE. Three integrated service tests and four native acceptance groups passed.

## Integrated verification

`src/shared/studentAdventureIntegration.test.ts` uses actual StudentService, StudentSettingsRepository, ProgressionService and ProgressionRepository with disposable temporary files. No application authority or persistence feature was added.

Three tests passed after compiling the shared test configuration. Two same-named profiles retain distinct generated identities across two same-named classes and multiple enrollment. Three episodes span two adventure identities whose reward/relic IDs and display names deliberately match. Core reward adjustments, relic progress and episode completion remain adventure-scoped; HeroBoard filters preserve the correct lifetime totals and episode history. Profile rename, nickname/avatar editing, archive/restore and repository restart retain enrollment IDs, creation timestamps and the complete progression snapshot. An observed module completion follows the service transport authorization path; exact replay after restart changes neither revision nor effects, while a changed-payload identity collision is rejected.

Evidence: `.tmp-phase7e-integration-tests.log` (3 passed). These are service integration tests, not a claim of real game interaction; native proof is tracked separately.

## Existing independence evidence

[Phase 6G report](phase6g-report.md) records the completed 11-group native gate: authored content used by all three modules, source-directory removal, clean-profile offline package import, actual gameplay, approval scoped to captured students, restart/replay without duplicate effects, a second adventure reusing IDs/display names with separate media and inventory, and portable exports excluding private student data. Detailed evidence is `phase6g-evidence/native/results.json`.

[Phase 7C report](phase7c-report.md) records five native groups covering three episodes, two adventures, three profiles, two actual Snake completions, stable-ID filters, archived history and a teacher adjustment without changing the other adventure. Its evidence is `phase7c-evidence/native/results.json`.

No production files were written by these tests. The independent fresh production read-only audit is recorded separately in `phase7f-evidence/audit.json`; its owner reports the six baseline JSON hashes unchanged and all 1116 registered files present.

## Native acceptance

The final 7E native gate passed four groups with no renderer errors. The same two permanent profiles and class were used across A1, A2 and B1. Identical reward/relic identifiers and names retained distinct A totals (2 rewards / 3 relic progress) and B totals (7 / 9), including actual passive Present projections. B started empty. Profile archive/restore left the complete progression snapshot unchanged. Reopening A2 and a full Electron restart preserved profile/class IDs, balances and exact per-adventure episode completions. Evidence: 

- docs/phase7e-evidence/native/results.json

An initial test harness omitted the explicit Open Present step and timed out. Correcting that test action required no application change; the complete rerun passed.
