# Final independent Phase 7 code and requirement review

Assessment: **no remaining blocking code defect identified in the reviewed scope**. Final twenty-step native and legacy acceptance was still running when this review was written; this document does not replace those results. No application source, production profile, or production lesson was changed during this review.

The review used the approved `docs/superpowers/plans/2026-10-13-phase7-students.md`, phase reports, implementation source and focused test evidence. It applies the requesting-code-review skill's independent-review criteria to the delegated work; no external PR or commit was created.

## Covered requirements

| Area | Concrete implementation and evidence |
| --- | --- |
| Permanent identity | Existing settings remain the authority. Main-generated profile IDs and original creation times survive rename, archive/restore and restart. Equal names stay distinct. Profile operations do not rewrite progression. |
| Safe persistence | Settings mutations share a serialized queue with audio, use bounded reads/output, validate identities/references and publish through fsynced temporary files with a previous-valid backup. Malformed JSON and duplicate IDs fail closed without replacement. |
| Explicit legacy mapping | Source plus source-student ID maps to an explicitly chosen permanent identity, or creates a new identity. Existing mappings cannot silently retarget. No name matching or automatic score/inventory transfer occurs. Empty canonical settings do not auto-import localStorage; canonical read failure leaves legacy fallback read-only. |
| Classes | Enrollment uses existing IDs, supports multiple classes, retains archived membership and preserves progression. Invalid or duplicate member IDs reject. Active class persists; archiving it clears selection without choosing a substitute. Guests are session-only. |
| Hero Board | Student/class filters intersect by ID; adventure/episode history is filtered independently of lifetime balances. Archived history remains visible. Captured and accepted definitions label rewards; missing labels use stable IDs. Positive authored badge rewards alone appear as achievements. No session score becomes a permanent reward automatically. |
| Teach integration | Collapsible roster, in-place student details, permanent and guest selection, class loading, current-adventure summaries and Core-backed group adjustment controls are integrated. Game runs keep captured participants rather than consulting later selection. |
| Group retries | Per-student command IDs and exact target/definition/amount/reason are captured before IPC. Root-owned intent storage and shared in-flight locking survive branch/mode remounts. Partial errors remain explicit; successful recipients are not resent. The latest 7D native gate verified a lost acknowledgement after an actual commit, remount and retry without another grant. |
| Passive Present privacy | Control-authenticated settings/profile APIs are absent from the passive API. Snapshot parsing reconstructs only nicknames/anonymous labels, preset avatars and optional numeric summaries. Student IDs, full profile names, mappings, reasons and histories are excluded. Scores match captured session/adventure; balances match the adventure. Eight-entry cap and a reserved top/bottom band protect scene layout. |
| Adventure independence | Core balances use student/adventure identity, not display names. Tests use matching reward/relic IDs and names in separate adventures with independent totals. Generic hosted templates omit legacy-specific authored text. |
| Portable/private separation | Strict authored projection excludes profile/class/progression domains; registered asset copying avoids private sibling files. Import validates exact manifest inventory and rejects private schema extensions/unlisted files. Phase 6 media leases, conversion, package validation and durable receipt authority remain in place. |

## Fresh focused checks

Ran the nine profile safety, import preview, classes, settings concurrency, legacy roster safety, Hero Board, group reward, roster projection and multi-adventure integration suites against the current compiled test output: **30/30 passed**. The preceding fresh compilation and independent package/progression review passed another selected 23 checks, with the three new multi-adventure tests independently rerun. These overlapping counts are not additive regression totals.

The production audit evidence in this directory confirms all six JSON SHA-256 values match Phase 6G and remain unchanged during read-only loading; all 1,116 registered files exist. Media content was not hashed. Existing unresolved legacy dependency diagnostics were preserved, not repaired.

## Explicit limits and remaining gate work

- An unfinished manual group batch has an in-memory retry handle. Process restart loses that handle; automatic batch replay/crash recovery is not claimed. Core receipts remain durable. This accepted limit is distinct from the corrected ordinary-remount issue.
- Corrupt settings fail closed and keep recovery evidence; there is no automatic backup restoration or repair UI.
- The legacy bulk roster IPC facade remains for compatibility. Current application mutations use scoped profile operations; stale external callers of the old facade could still overwrite metadata they explicitly submit.
- The safe projection does not guarantee anonymity when a teacher intentionally chooses a real name as a nickname. Likewise, authored media can contain personal information; package privacy guarantees exclude application-private stores, not the contents of teacher-authored media.
- Final 7F native workflow, legacy compatibility and final aggregate verification results must be recorded by their owners before declaring the overall gate complete. This review makes no claim that a still-running gate passed.

## Subsequent final gate confirmation

The root owner subsequently verified 576 application tests, 50 game checks, fresh renderer/main builds, the exact 20-step native workflow, four legacy groups and six media-return groups. All passed; no application change followed the reviewed source. The consolidated report records the final evidence and remaining limits.
