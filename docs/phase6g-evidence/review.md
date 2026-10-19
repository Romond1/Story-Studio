# Phase 6G independent filesystem and boundary review

Performed 2026-10-13 JST against the shared working tree, without activating, saving, migrating, or modifying production lessons. No commits or branch changes.

## Production read-only audit

Ran `STORY_STUDIO_EVIDENCE=docs/phase6g-evidence node scripts/phase6b-audit.mjs`. The real main-process legacy loader was used with Electron's window boundary mocked. All six documented production projects opened read-only. Their JSON SHA-256 values match their before/after values and both the 6B and 6C audit baselines.

| Episode | Registered files present | Missing | Matches 6B and 6C JSON |
| --- | ---: | ---: | --- |
| 1 | 169 | 0 | Yes |
| 2 | 339 | 0 | Yes |
| 3 | 216 | 0 | Yes |
| 4 | 174 | 0 | Yes |
| 5 | 118 | 0 | Yes |
| 6 | 100 | 0 | Yes |

The total is 1,116 registered files. The audit checks their existence and lexical registered-path containment; it does **not** hash production media contents or claim that legacy dependency coverage is complete. Existing unregistered-local and unknown-content diagnostics remain visible in `audit.json`. The report does not include production student identities.

The first audit invocation failed before production reads because the reused test harness had acquired `os` and `randomUUID` dependencies. The audit script now injects those existing dependencies. No application source was changed for this review.

## Isolated rollback and failure verification

Ran the current test compiler and these focused suites:

```text
npx tsc -p tsconfig.test.json
node --test dist-test/shared/episodePersistence.test.js dist-test/shared/episodePackageService.test.js dist-test/shared/progressionRepository.test.js
```

All 16 tests passed. They use generated fixtures and disposable temporary directories. Coverage includes exact private conversion backups and source preservation, injected conversion failure without publishing a fallback, safe episode save/reopen with format guards, authenticated IPC, immutable package Open rejection, tampered/unlisted/unsafe/colliding/oversized packages, interrupted staging cleanup, junction escape rejection, exact builtin-byte materialization, wrong-media signature rejection, durable replay after restart, failed writes and expired scopes preserving previous state, and retention of a valid private recovery backup without silently replacing a corrupt primary.

## Core and private-data boundaries inspected

- Episode, adventure and participant identities are distinct. Progression rows use student ID plus adventure ID; captured runs retain immutable context and definitions. The inspected services contain no production-adventure-specific IDs or names.
- Module-specific behavior remains behind declared module types and media adapters. The package service's seven Final Boss builtin paths are an explicit bundled-module allowlist, not adventure-specific content or arbitrary filesystem paths.
- Export uses `projectAuthoredEpisode` and strict package closure validation, then copies only declared physical assets plus generated project and definition JSON. It does not recursively copy the workspace or private backups.
- Inline adventure definitions remain the editable authority. Package definition files must match them; import removes package manifest and duplicate definition files before preparing an editable candidate.
- Progression state, receipts and recovery backup live in the application user-data directory, outside lesson folders. They are absent from the authored projection. Module inventory reads expose only captured participants' adventure-scoped reward quantities, without profile names, history or write authority.
- Conversion archives original source bytes privately. Unsupported legacy conversion is rejected rather than silently discarding legacy student progress or opaque content. The six production legacy lessons were not converted.

No additional application-source defect was identified in this review scope. Media signature validation identifies supported file/container types; it is not a full decoder-integrity or malware scan. Builtin provenance is retained in the original package manifest; after import, the materialized files are ordinary authored assets. Native rendering, game execution and full release gates are reported separately by the coordinating task.

Evidence: `audit.json`, `hash-comparison.json`, and the focused command results above.
