# Phase 6C Episode and Derived Media Integration Plan

> **For agentic workers:** Use superpowers:executing-plans task by task only after the Phase 6B gate passes and Phase 6C is explicitly started. This is a design plan, not authorization to implement. Do not commit, push, change branches, introduce module hosting, progression, or portable packages.

**Goal:** Add an explicitly converted episode format, reusable derived images, and a manual adventure-scoped catalog while preserving existing scene and legacy readers and all original media bytes.

**Architecture:** Retain one Control document and ProjectHistory. Introduce a flattened episode discriminant over shared scene fields, a separate derived-image collection, and manual catalog records. Main keeps persistence, conversion backups, source hashes, leases, and disposable rendered PNG access; the renderer shares one transform implementation across every preview and presentation.

**Tech Stack:** Existing TypeScript, React, Electron, Canvas 2D, Node filesystem/crypto and node:test; no new image dependency required.

## Decisions and constraints

The current LessonProject has fixed `format: 'story-studio-scene'; version: 1`, and commands return LessonProject. LessonApp types its file/current/history to that type and invokes parseLessonProject at activation, save and import. Its projection finds media types directly in physical assets. Adding optional transforms to that type would let old readers silently ignore required behavior. Use a different discriminator and factor common structure; do not fake the scene discriminator to reuse its parser.

```ts
interface SceneDocumentFields {
  id: string; title: string; createdAt: string; updatedAt: string;
  assets: AssetItem[]; mediaBins: MediaBin[];
  scenes: Record<string, LessonScene>;
  sequences: Record<SequenceKind, SceneEntry[]>;
  sections?: LessonSection[];
  cards: Record<string, CardDefinition>; library: string[]; cardSets: CardSet[];
}
interface LessonProject extends SceneDocumentFields {
  format: 'story-studio-scene'; version: 1;
}
interface EpisodeProject extends SceneDocumentFields {
  format: 'story-studio-episode'; version: 1;
  adventure: { id: string; version: string };
  requiredCapabilities: ('derived-images-v1' | 'manual-catalog-v1')[];
  derivedImages: DerivedImage[];
  catalog: { entities: ContentEntity[]; collections: ContentCollection[] };
}
type SceneDocument = LessonProject | EpisodeProject;
```

The existing id is the episode identity; do not introduce a second episodeId that could disagree. Adventure identity is entered explicitly during conversion. Story/Activation ordering remains unchanged. Activity/module capabilities, Challenge/Mastery occurrences and portable package manifests remain later-phase work. Unsupported required capabilities always refuse activation. Catalog collections carry adventureId and entityIds; entity identity is the tuple adventureId/id. Names and tags are never identities.

Flattening minimizes loss-prone unwrap/re-wrap code and lets structural scene commands preserve the envelope with object spread. Nesting a scene document would require adapters across every mutation and risks maintaining a second scene authority. Read-only helpers accept SceneDocumentFields. Updating commands use generic T extends SceneDocument and preserve T; constructors explicitly choose scene or episode. No `as LessonProject` escape casts.

## File responsibility map

| Files | Responsibility |
| --- | --- |
| src/shared/lesson/model.ts | Shared scene fields and scene document union, generalized state; unchanged scene discriminator |
| src/shared/episode/model.ts, validation.ts, commands.ts | Episode-specific records, parser, validated manual catalog/derived commands |
| src/shared/lesson/validation.ts | Extract common scene-body validation with explicit image-reference predicate; scene parser stays strict |
| src/shared/lesson/commands.ts, sections.ts, session.ts, mediaImport.ts | Preserve generic document subtype through existing operations |
| src/shared/content/mediaRegistry.ts, mediaDependencies.ts | Derived indexes and source edges; catalog dependency edges without physical duplication |
| src/shared/content/imageTransforms.ts | Pure transform validation, crop/rotation geometry and deterministic pixel adjustment rules |
| src/renderer/episode/renderDerivedImage.ts, useDerivedMedia.ts | Single Canvas renderer and revision/lease-fenced prefetch cache |
| src/main/derivedMediaService.ts, mediaRegistryService.ts, main.ts, preload.ts | Source digest and bounded ephemeral PNG grants under current manifest/lease |
| src/shared/episodeProtocol.ts, src/renderer/vite-env.d.ts | Narrow typed Control APIs; no generic filesystem bridge |
| src/main/lessonPersistence.ts | Explicit scene/episode format dispatch and exact active-format save fencing |
| src/main/episodeConversion.ts | Preflight, private backup/hashes, empty-target staging, atomic conversion publication |
| src/renderer/lesson/LessonApp.tsx | One union document/history, episode editor panels and conversion flow |
| src/renderer/episode/DerivedImageEditor.tsx, CatalogPanel.tsx | Manual transform editing and catalog authoring |
| src/shared/lesson/projection.ts | Unified image type lookup; same prefetched resolution in Edit/Teach/Present |
| src/shared/episode*.test.ts, imageTransforms.test.ts, derivedMediaService.test.ts | Top-level test files included in tsconfig.test.json |
| scripts/phase6c-episode-smoke.cjs, docs/phase6c-report.md | Native evidence and explicit limitations |

## Task 1: Format and reference boundary

- [ ] Add parser tests before implementation: current scene fixture passes unchanged; episode envelope refuses scene and legacy readers; unknown episode version/capability refuses without activation; duplicate physical/derived IDs refuse; derived source must be a physical image; audio/video sources and chains/cycles refuse.
- [ ] Define DerivedImage and ImageTransformV1 exactly as the Phase 6A contract. Check finite normalized crop, positive width/height, x+width and y+height <=1; supported quarter turns only; brightness/contrast/saturation within 0..2; fit cover/contain; aspectRatio finite positive bounded to 0.01..100; focal coordinates 0..1. Reject malformed transforms instead of silently clamping authored values.
- [ ] Extract body validation using an injected `hasAsset(id, expectedType)` predicate. `parseLessonProject` checks its own discriminator first and sees physical assets only. `parseEpisodeProject` validates physical and derived records first, then validates scene/card image references through unified IDs. Audio stays physical-only.
- [ ] Test JSON serialization before/after parsing, supported old sections migration, and preserved unused physical assets/bins. Add tests to tsconfig.test.json and run `npx tsc -p tsconfig.test.json`, then `node --test dist-test/shared/episodeValidation.test.js`.

## Task 2: One authored authority and persistent envelope

- [ ] Add command tests that edit scene titles, add cards, import assets, undo/redo and change sections on an episode while keeping adventure, catalog, derived records and discriminator intact.
- [ ] Generalize mutators with subtype-preserving signatures, for example `putScene<T extends SceneDocument>(project: T, scene: LessonScene): T`; return `{ ...project, scenes: { ...project.scenes, [scene.id]: scene } }`. Read-only session/projection helpers accept shared fields. Make envelope-specific commands return a new EpisodeProject and pass through existing apply/history once.
- [ ] Change LessonApp current/latest/history/file state to the union, with one parseSceneDocument dispatcher choosing explicit versioned parsers. New scene creation remains scene-only until the user chooses conversion or explicit New Episode.
- [ ] Extend persistence detection to episode explicitly; save must match active format and id AND on-disk format and id. Successful Save As retires media lease; cancellation/copy/publication failure leaves source and lease unchanged. Test scene/episode cross-save refusal and repeated episode save/reopen.
- [ ] Run existing lesson command, lifecycle and persistence tests plus new episode persistence tests. No old fixture should acquire episode fields on open/save.

## Task 3: Shared derived image evaluation

Use this order: crop source coordinates; horizontal flip in cropped coordinates; clockwise quarter-turn rotation; brightness, contrast, saturation; fit/focal presentation. Rotation swaps width and height at 90/270 degrees. Fit/aspect/focal determine final output framing so previews and projected images cannot disagree.

- [ ] Create tiny deterministic RGBA fixtures (four differently colored corners, alpha, non-square source). Tests assert crop bounds, flip-before-rotation placement, rotated dimensions, neutral adjustment identity, alpha preservation, cover focal crop and contain transparent padding.
- [ ] Define pure validated layout plus byte-level color operations in imageTransforms.ts. Use Canvas only for decode/draw/encode; apply color math in the shared pixel function rather than browser-dependent CSS filters. Document sRGB channel math and rounding; contrast midpoint is 0.5, saturation uses fixed luma weights, output channels clamp to 0..255.
- [ ] Implement one async renderer that loads the registered physical source URL, draws crop/flip/rotation, applies shared color math and output fit, and encodes PNG. Limit decoded source area to 16 megapixels, output edge to 4096, output area to 8 megapixels and encoded PNG to 8 MiB. Exceeding limits yields a structured error rather than a lower-quality silent fallback.
- [ ] Key cache by source SHA-256, canonical transform version/configuration and presentation settings, never display name or source URL. Main computes digest only for registered physical source under current lease; derive and publish requests carry lease+manifest revision+source ID+digest. Verify all before and after asynchronous work; stale work cannot publish.
- [ ] Prefer a bounded ephemeral main PNG cache and `media://` grant over inline data URLs. Validate PNG signature, decoded dimensions via Electron nativeImage, byte limit and total cache budget (64 MiB); hash uploaded bytes; reject sender/frame other than Control. Scoped grant lifetime follows manifest/lease retirement. Keep bytes outside authored project folders and JSON. Existing passive image URL validators remain unchanged.
- [ ] Compare alternative explicitly: strict image/png data URLs could avoid upload IPC, but require widening scene/card validators and aggregate snapshot budgets, send repeated large payloads, and risk accepting authored embedded data. Blob URLs do not provide a reliable cross-renderer lifetime. Do not enable either fallback silently.
- [ ] Test grants unavailable after Save As, re-registration, source mismatch or request race. Add native test rendering the same transformed fixture in Edit, Teach and Present and compare pixels/crops. Never start async work inside projectScene.

## Task 4: Derived authoring and manual catalog

- [ ] Add dependency tests: derived background/card/object points to one derived record and one physical source; unused derived definitions remain listed; catalog asset links accept physical or derived IDs; no double-counting authored placement edges.
- [ ] Extend the disposable registry to return unified resolution metadata without synthesizing AssetItem records for derived PNGs. Retain physical assets()/bins semantics; use a separate typed unified list for image pickers.
- [ ] Add DerivedImageEditor actions: create from selected physical image; name/configure crop/flip/rotation/adjustments/fit/aspect/focal; preview draft; Apply commits one immutable history command; Cancel discards draft. Source stays immutable. Editor preview uses the same evaluator as teaching. Invalid inputs show field-specific errors and disable Apply.
- [ ] Add manual entities and collections UI: create/edit entity name, kind, tags, asset links; create/edit collection name and entity membership; filter by kind/tag/collection; assign entity from selected physical/derived image. Every record carries explicit adventureId; duplicate names allowed. Record manual tag provenance. No classifier, inferred tags or automation.
- [ ] Tests cover entity identity across same-name records, invalid collection references, adventure mismatch, delete/reassign checks for referenced catalog records, undo/redo, and source-byte immutability. No physical media delete is added.

## Task 5: Explicit backed-up conversion

- [ ] Start with supported scene-v1 conversion. Legacy conversion requires field-by-field mapping evidence; unknown/unsupported Card V2, reward, movement or game payloads are blockers, never silently omitted. Expose preflight report before offering an executable conversion. Do not claim general legacy conversion from a scene-only path.
- [ ] New conversion command receives expected active lease/revision, user-selected adventure identity and empty target. Capture immutable source document and folder, block overlapping imports/writes, and hash every source file under realpath containment. Do not follow symlink escapes or copy grant/cache/session values.
- [ ] Before conversion publication, copy original source folder byte-for-byte to a private userData migration-backups UUID folder and save a SHA-256 manifest. Validate backup hashes. Preserve the source on every failure. Backup failures abort conversion.
- [ ] Build target from an explicit supported authored-field projection into episode format. Preserve scene/card/asset IDs and paths; no catalog inference. Initialize empty derived/catalog records. Stage bytes in the empty target with no valid project.json until validation and copy checks pass; atomically publish the validated envelope. Return a prepared candidate and conversion report; activation remains the existing explicit acknowledgement.
- [ ] Re-read target using episode parser; compare source media hashes and authored scene/card/sequence semantics. Conversion tests inject copy, hash, backup, publication and activation failures. Assert source JSON and file hashes unchanged and old lease remains active until activation.
- [ ] UI presents exact target and backup paths, supported conversion coverage and blockers. Existing source remains reopenable. Conversion backup is private and never embedded in authored episode or later portable output.

## Task 6: Gate and evidence

- [ ] Run complete `npm test`, main/renderer typechecks and production build using repository scripts; inspect new regressions instead of changing baseline assertions.
- [ ] Native Electron proof: create scene fixture, convert to empty episode target, create nontrivial crop+flip+rotation+color derivative, bind it in background/image/card, manually create catalog entity/collection, undo/redo, save/reopen, Save As, compare all three presentation modes, then open original scene and verify unchanged hashes.
- [ ] Capture clean-profile reopen and stale-grant rejection. Record exact output/source/backup SHA-256 results, screenshots, console errors, executed commands and remaining unsupported legacy conversion features in phase6c-report.md.
- [ ] Re-audit that no generated PNG/grant URL, student roster, teaching session, score, reward state or game checkpoint was introduced into the new authored envelope. Keep all existing formats available and refuse unsupported versions/capabilities.

## Acceptance boundary

A completed 6C gate requires reusable physical-source transforms and manual catalog editing in actual UI, save/reopen with stable IDs, shared Edit/Teach/Present output, and verified non-destructive conversion. Parser-only models or a preview-only transform panel are insufficient. This plan does not enable 6D modules, 6E packaging or 6F progression and does not imply those scopes are implemented.
