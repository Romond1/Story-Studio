# Phase 6C — Derived assets and content catalog

Status: COMPLETE — automated, native and read-only compatibility gates passed.

## Implemented

- A distinct `story-studio-episode` version 1 format with strict capabilities, authored-field validation, adventure identity, physical-source derived images, and manual catalog entities/collections. Scene-v1 and legacy readers remain separate.
- Subtype-preserving scene/card commands, clipboard operations and one Control history for episode editing.
- Deterministic crop, horizontal flip, quarter-turn rotation, brightness, contrast, saturation, and cover/contain framing. The same pixel evaluator supplies preview, Edit, Teach and Present; originals are never changed.
- Physical-source hashing and bounded ephemeral PNG grants, with Control authentication and project/revision fences. PNGs and grants are not serialized in lessons.
- Explicit scene-to-episode copy conversion, verified private backup of original files and unsaved authored revision, source manifests and migration report. Conversion does not implicitly activate its result.
- Teacher controls for derivative authoring, manual identities/tags, associated media and filtering. Episode content and Media Pool share a scrollable sidebar.

## Verification so far

- Full automated suite: 487 passing, zero failing/skipped (`.tmp-phase6c-tests.log`). The lifecycle VM harness was updated to provide the actual new document parser; existing behavioral assertions remain.
- Shared targeted checks: 32 passing (`.tmp-phase6c-shared-tests.log`).
- Renderer and main production builds passed. Renderer still reports the existing chunk-size advisory.
- Native acceptance passed all six groups with no renderer errors (`docs/phase6c-evidence/native/results.json`). Real clicks verified conversion/private backup, two distinct same-source crops, Edit/Teach/Present and reopen pixels, manual entity/collection filtering, unsupported-capability rejection, and duplicate-name isolation between adventures. A discovered content/timeline overlap was fixed by placing the content editor in the scrollable sidebar.
- Review identified accumulation of obsolete derived PNG variants in the cache. Generation-fenced reclamation now retains the current display while replacing it and rejects canceled work. Its regression test covers twelve successive large edits.
- All 33 existing game checks and main/renderer typechecks passed. The post-6C read-only audit opened all six production episodes, found 1,116 registered assets, and verified unchanged project JSON hashes (`docs/phase6c-evidence/audit.json`).

## Changed areas

`src/shared/episode/`, `src/shared/content/imageTransforms.ts`, scene model/validation/commands/clipboard/projection, media registry/dependency indexing, `src/main/episodeConversion.ts`, `src/main/derivedMediaService.ts`, lesson persistence and narrow preload APIs, `src/renderer/episode/`, LessonApp/SceneInspector and workspace layout. Targeted tests cover schema isolation, transformations, catalog commands, conversion/source integrity and ephemeral media security. Native test: `scripts/phase6c-episode-smoke.cjs`.

## Compatibility and limits

Production lessons have not been written. Both 6B and post-6C read-only six-episode audits are retained. Conversion currently supports validated scene-v1 documents only; general legacy conversion is not claimed. Unknown fields/capabilities refuse conversion instead of being dropped. Derived video/audio and transformation chains are unsupported. Sources are limited to 16 megapixels, outputs to 4096 pixels per edge / 8 megapixels / 8 MiB PNG, with a 64 MiB runtime cache. Exceeding limits reports an error.

Portable packaging and shared hosted-game authoring belong to later phases and are not implemented by this work. Native red and blue crops decode to 160×180 pixels with center RGBA values [253,0,0,255] and [0,0,254,255]. Saved JSON contains neither scoped physical nor derived runtime grants. Screenshots are retained in the native evidence directory. The original scene fixture remains reopenable with unchanged source hashes, demonstrating rollback by reopening the preserved original.
