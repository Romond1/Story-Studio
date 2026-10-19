# Phase 6B — Unified Media Registry

Status: COMPLETE — required 6B acceptance gate passed before starting 6C.

## Implemented

- Immutable registry view of the existing asset/bin arrays with ID/type lookup, exact path matching, duplicate and hierarchy diagnostics.
- Typed authored dependency enumeration for scenes, audio, cards, Card V2, A/B libraries, boosters, bubbles, rewards, relics, and movement. Unplaced definitions count once; prose is not scanned for substrings.
- Conservative incomplete-coverage diagnostics for unknown content and unregistered compatibility paths.
- Main-process leases, authenticated Control manifest/resolution IPC, revision fencing, realpath-contained scoped grants, project activation/Save As retirement.
- Renderer prefetch cache rejects stale asynchronous results and recovers manifest revisions after renderer reload.
- Scene pool, inspector, timeline, Edit/Teach/Present, and audio use the shared registry/resolver.
- Shared audio import service with additive full partial-failure response; new bubble imports return an asset record alongside the compatible path.
- Import registration rejects identity/path collisions, unsafe paths, missing bins, and bin cycles; copied files are retained on registration failure.

## Unchanged

No serialized legacy/scene-v1 requirements changed. No source production lessons were rewritten. Existing IDs, bins, unused imported assets, Card V2 definitions, and game mechanics remain intact. No derived assets, game config persistence, package exporter, or private student progression is claimed here.

## Changed files

New shared code: `src/shared/content/{mediaRegistry,mediaDependencies,mediaResolution}.ts`, `mediaRegistryProtocol.ts`, `mediaRegistryCache.ts`, `mediaImportValidation.ts` and corresponding tests. Main: `mediaRegistryService.ts`, `main.ts`, `preload.ts`. Renderer: `useMediaRegistry.ts`, scene workspace/pool/timeline/inspector, legacy media pool and rendering seams, API declarations. Import façades and persistence test harnesses were updated; test harness Control senders now exercise authentication. Native scripts: `scripts/phase6b-media-registry-smoke.cjs`, `scripts/phase6b-audit.mjs`.

## Verification

- Baseline: 440/440 tests passed before implementation.
- New incorrect-prose-use and collision tests first failed against old behavior, then passed.
- Final broad 6B app run: 470/470 passed, no skips (tool execution output; the older .tmp-phase6-tests.log predates the harness fix and is not final evidence).
- Game checks: 33/33 passed.
- Main and renderer production builds passed; renderer has existing bundle-size warning.
- Native Electron shared-image proof passed: import/nested bins, story + activation reuse, unplaced card dependency, Save As/reopen stable IDs, real scoped image in Control/Present, stale URL rejected after project switch, explicit missing-file diagnostic, immutable original fixture/source.
- Existing native game/video regression: all six return scenarios passed with paused video position retained.
- Six production episodes opened read-only: 1,116 registered files available; JSON hashes unchanged. Media source bytes were not all hashed by the production audit; synthetic native source bytes were hashed.

## Risks, limitations, remaining work

Legacy scoped consumer integration and compatibility realpath/traversal containment passed targeted tests and native Card V2/editor/Present, actual dialogue playback, and custom reward background checks. Final renderer/main type checks and diff whitespace check passed. Save/Save As native checks assert runtime grants never enter JSON. Unknown and path-only legacy dependencies remain explicitly incomplete; this is not a packaging/deletion oracle. Games are intentionally not registry consumers until 6D. No migration exists in 6B.
