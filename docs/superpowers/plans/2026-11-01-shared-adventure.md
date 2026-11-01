# Shared Adventure skeleton implementation plan

**Goal:** A usable cooperative teaching workspace in dedicated scene lesson folders, without networking.

**Architecture:** Extend scene lessons with validated group preparation and live state. Use the existing LessonApp authority, import/save lifecycle and ordinary ScenePlan projection. Keep the group domain independent of networking and permanent progression.

**Tech stack:** Existing TypeScript, React, Electron, Node tests; no added dependency.

User instructions prohibit commits, pushes and deployments. Execute inline in the current working tree to preserve the uncommitted baseline.

## 1. Domain and persistence contract

- [x] Add `src/shared/sharedAdventure.ts`: prepared members/devices/objectives, live scores/objective completion, scoring ledger, reset, validation and public ScenePlan projection.
- [x] Add `src/shared/sharedAdventure.test.ts`, register it in `tsconfig.test.json`, and observe failure before implementation. Cover three members/two devices; deduplicated scoring; exact undo; participation; reset retaining preparation; malformed references; scene document round-trip; hidden teacher fields; validated Present snapshot.
- [x] Add an optional field to scene lessons only in `src/shared/lesson/model.ts`; validate it in `src/shared/lesson/validation.ts`. Existing documents without the field retain their behavior. Strict episodes remain unchanged.

## 2. Teacher workspace

- [x] Add `src/renderer/sharedAdventure/SharedAdventureWorkspace.tsx` and scoped CSS. Group editing, device/location assignment, existing-profile selection, mission editing/completion, selected/team awards, undo/reset, image/prompt reveal, normal import/save/open actions, and a passive preview.
- [x] Add a Beginning destination in `src/renderer/Beginning.tsx`.
- [x] Integrate with `src/renderer/lesson/LessonApp.tsx`: create a dedicated draft when entering from an ordinary lesson, preserve the existing dirty-project confirmation, activate only after media revocation, reuse imported assets and media resolution, and publish the group plan through the single existing publisher. Suspend solo keyboard and audio ownership while group mode is active.
- [x] Keep teacher controls and profile/device metadata out of the public plan. Do not use Tab as a global shortcut.

## 3. Verification and handoff

- [x] Run focused domain tests, `npm test`, `npx tsc --noEmit -p tsconfig.json`, `npm run build:renderer`, `npm run build:main`.
- [x] Exercise actual Electron Control and Present: create group lesson; import image; three members sharing two device labels; score two/all; undo; toggle board; save/open; reset; return to solo lesson. Capture wide/narrow Control and Presenter evidence.
- [x] Document usage and exact limitations. Reusable packs, cooperative rounds and Broadcast remain subsequent milestones.
