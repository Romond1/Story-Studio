# Phase 6E portable packages

Status: COMPLETE — regression and native offline acceptance passed.

## Implementation

- Strict adventure definition snapshots store stable adventure/version, reward definitions, relic stages and registry image references in the authored episode. The editor uses normal history and Save.
- Export explicitly projects authored fields and copies declared physical media, including unused imports. Derived descriptors retain their originals. Modules, all Boss configurations, unplaced cards, catalog metadata and definitions remain included.
- Seven recognized Boss builtin images can be materialized from shipped immutable originals. The export remaps typed references and records version/digest provenance without changing the source episode.
- A versioned manifest records file hashes, sizes, required capabilities and the adventure definition dependency. Import validates schema, exact inventory, dependency closure, hashes, media signatures, path aliases, bounds and containment before staged publication.
- Imported projects are editable copies; immutable source packages reject ordinary Open and Save. Private roster/progression/settings files are excluded by construction.
- Control export waits for pending hosted edits. Failed or cancelled imports retain the active project; successful import resets the ordinary project history and media scope.

## Changed areas

`shared/definitions`, `shared/package`, episode validation/commands and dependency enumeration; `main/episodePackageService.ts` and persistence/preloads; renderer package actions and `AdventureDefinitionEditor`; release file inclusion; shared and native package tests.

## Verification

The full application regression passed 524 tests with zero failures/skips (`.tmp-phase6e-tests.log`). Renderer/main typechecks and production builds passed. A final read-race hardening change was followed by 11 focused persistence/package tests and a fresh main build. Independent review confirmed bounded JSON reads, hashing of the exact parsed bytes, and pinned initial manifest identity through staging. Root lifecycle tests verify pending edit flush, cancellation and rejection. Seven native acceptance groups passed with no renderer errors. Export flushed an actual hosted edit; source project/private files remained byte-identical. Manifest closure included unused imports, derived/catalog definitions, an unplaced Card V2, all five authored Boss configurations, and exact materialized builtin bytes. A fresh offline profile imported and played all three modules while the original source path was absent. Native game edits saved normally. Tampered hashes, unlisted files, missing assets, unsafe paths, unsupported capability, mismatched definition snapshots and ordinary package Open all rejected without changing the active project or publishing output.

Supplemental editor checks passed at 1184×720 and 900×720: definition fields and the Apply action remained reachable in scrollable panes. Evidence is in `docs/phase6e-evidence/native/results.json`, `offline-boss.png`, `editor-results.json`, and `editor-1184.png` / `editor-900.png`. The first native attempt used Reset behind Snake’s result overlay; the corrected gate uses the normal Play Again action. No product change was needed, and transient failure screenshots were removed after final proof.

## Limits and preservation

Packages are folders, not compressed archives. Media checks validate recognized file signatures and declared type, not full codec decoding. Packages require an explicit adventure definition; existing scene/legacy lessons use explicit conversion first. No production lessons or student records are written. Original branch and checkpoint remain preserved; no implementation commit, push or merge.

