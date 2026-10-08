# Unified Scene Reconstruction Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Work in the user-selected `story-studio-rebuild` checkout; file ownership is divided explicitly.

**Goal:** Create, author, save, reopen and teach Story and Activation using one scene model and renderer.

**Architecture:** A discriminated LessonProject replaces legacy hosts for new lessons. One Control session projects student-safe scene plans; the same visual components serve every surface. Legacy and new documents remain separated at the application/file boundary.

**Tech Stack:** Existing Electron, React, TypeScript, Node tests, Vite and Web Audio/WebRTC.

- [x] R0: Verify remote recovery references; audit actual state ownership; record architectural decision before coding.
- [ ] R1: Add `src/shared/lesson/*` types, validation, immutable scene/object commands and stable live session. Test add/remove/copy/reuse, geometry, face reset, history, return identity and round-trip rejection of legacy formats.
- [ ] R2: Add `src/shared/lesson/projection.ts` and `src/renderer/lesson/SceneSurface.tsx`. Reuse deterministic V2 face plans, logical frame and passive bubble/drawing primitives. Add the new target to the existing relay parser and Present entry point; exercise actual renderer composition.
- [ ] R3: Add new-format atomic persistence behind dedicated IPC and preload methods. Require empty folders and format guards; reuse asset importer. Test disk round-trip, save refusal over legacy data, malformed input and Save As.
- [ ] R4–R6: Add shared sequence timeline/pool/Inspector and direct object commands, optional library reuse, authored frame/background/audio/transition, new project lifecycle and history. Route normal startup to new application; retain explicit legacy mode.
- [ ] R7: Integrate one live session, navigation return, card controls, drawing/viewport, rewards, existing mixer/settings and Present-owned video execution. Verify scene transition stops audio and Present deletion reflects history.
- [ ] R8: Run synthetic vertical GUI proof in Electron, capture Edit/Teach/Present including video+cards, save/reopen and Activation return. Run `npm test`, `npm run build:renderer`, `npm run build:main`, and typecheck new entry boundaries. Write exact evidence and manual device checks in `docs/reconstruction-verification.md`.

## Contract and ownership

Root owns domain commands/session and application controller. Infrastructure worker owns main-process persistence and preload integration. Rendering worker owns pure projection/shared SceneSurface/Present integration. Authoring worker owns reusable workspace view components. All new-format state uses `src/shared/lesson/model.ts`; coordinate interface changes before implementation. Tests use synthetic projects only. Commit checkpoints by explicitly staging relevant files; do not reset other workers' edits.

## Test cases driving implementation

```ts
// Each scene is projected from current authoring plus live state, never a cached module.
assert.equal(projectScene(deletedProject, sceneId, live).objects.length, 0);
// Return uses entry identity even after sequence reorder.
assert.equal(exitActivation(reorderedProject, activationSession).cursor?.entryId, originalStoryEntry.id);
// Copies retain source asset identity and independent card content.
assert.equal(copy.background.assetId, original.background.assetId);
assert.notEqual(copyCard.cardId, originalCard.cardId);
// Persistence never treats a legacy document as a new-format project.
assert.throws(() => parseLessonProject({version: 4, slides: [], assets: []}));
```

Implementation exports may use more precise names; tests call the final exported contracts. Every renderer check compares actual DOM/SVG object identity, face text, geometry and absence of authoring controls in Present, beyond domain-only assertions.
