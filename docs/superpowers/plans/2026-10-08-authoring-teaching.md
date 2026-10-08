# Authoring and Teaching Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for implementation and review. Preserve the existing reconstruction and the corrected mouse contract.

**Goal:** Complete the six stages in the corrected usability specification.

**Architecture:** Extend the existing lesson model, commands, session authority and shared SceneSurface. Cache transient state by sequence and entry identity, never in authored content. Keep legacy routes and original episodes unchanged.

**Tech Stack:** Electron, React, TypeScript, existing node:test suite and Electron/Playwright acceptance harness.

Recovery: tag `authoring-teaching-checkpoint-2026-10-08` at `650689e`.

- [x] P1: In model.ts/session.ts add occurrence-keyed teaching snapshots, explicit reset, validated live Card movement and per-occurrence drawing history. Update old reset-per-visit assertion and add tests for navigation, reuse isolation, reset, reconciliation and serialization separation. Run npm test.
- [x] P2: Extend model/validation/commands and LessonTimeline with stable first-class Sections, rename/reorder/group/collapse, ungrouped scenes and Break entries using ordinary scene content. Preserve legacy section labels on load; defer section audio settings explicitly because current reconstructed audio belongs to scenes. Test round trips, ordering and commands.
- [x] P3: Add local-only workspace dimensions and accessible draggable splitters with reset and bounds. Keep LogicalSceneFrame uniform fitting and pointer mapping. Improve existing Inspector section surfaces and headings without another navigation layer. Verify wide/narrow layouts.
- [x] P4: Extend SceneSurface pointer handling with middle-drag panning independent of Draw, anchored Alt-wheel zoom, click/drag threshold, cancellation and live Card geometry callbacks. Wire Edit/Teach context menus and authoritative live session updates. Add active-lesson mouse navigation guards at Electron and renderer boundaries without intercepting text or ordinary keyboard navigation.
- [x] P5: Add pen/highlighter/eraser, size/color, drawing undo/redo and confirmed clear using existing drawing coordinates and renderer. Preserve drawing state on navigation and expose navigation without default left-drag panning.
- [x] P6: Add independent Card clipboard and copy/move to scene commands, keyboard actions respecting text editing, context destination picker and safe copy drag to timeline. Use existing history and select destination copy. Test shared Card content independence and cross-phase transfers.
- [x] Acceptance: Extend disposable Electron smoke fixture with two Sections, Break, multiple scenes/cards and test all corrected mouse gestures, session retention, Present mirroring, resize, drawing, copy and save/reopen. Run full tests, TypeScript, renderer/main builds. Record actual GUI evidence and remaining limits.

Implementation details: preserve optional migration-compatible properties on version-1 documents; current entry IDs are globally unique and form the stable occurrence key. Snapshot cards/drawings/viewport on leave, restore on entry, and reconcile cached references after edits. Reset current state explicitly rather than calling navigate. Present remains a passive projection. Splitters change CSS sizes only, never scene frames or object geometry. All new persistent commands remain pure and are applied by existing ProjectHistory.

Validation and manual acceptance: `docs/authoring-teaching-verification.md`. Kept on `story-studio-rebuild`; no merge or remote publication performed.
