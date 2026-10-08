# Card and Booster workflow simplification

**Goal:** Add, edit, position, duplicate and present Card V2 content directly in Story and Booster contexts.

**Architecture:** Attach one existing Card V2 placement to each supported authored host. Its private activity holds independent instances without requiring a Set. Reuse the passive render plan and Core session authority. Edit selection remains separate from live occurrence state.

**Audit and decisions:** The library already supports multi-face authoring, Sets, Recall & Reveal, previews and persistence validation. Only standalone Booster activities currently render Card V2. Add a host attachment, contextual inspector and logical canvas manipulation; preserve the library as an advanced workflow. Keep the four Edit categories; put Booster navigation and simple sequence actions in the existing shell. Reuse references explicitly; independent copies create fresh placements, instances, definitions and face mappings.

**Alternatives:** A library shortcut cannot resolve missing host rendering. A new card engine would duplicate authority and violate scope. Host attachments reuse the current engine with a small compatible extension.

**Interaction references:** PowerPoint's object selection and sizing, Canva's add/duplicate element flow, and Genially's interactive question appearing on canvas with a configuration panel suggest one immediate creation action followed by contextual editing. Structured classroom activities remain optional.

## Checkpoints

- [x] U1: Test atomic quick-add, host identity, geometry bounds, and rollback. Implement shared commands and host attachment properties.
- [x] U2: Contextual inspector, face tools, local style, logical drag/resize, duplicate/delete/copy. Reuse CardV2Scene.
- [x] U3: Explicit linked/independent choices; Sets and activity creation available as advanced actions.
- [x] U4: Stable four-category inspector, breadcrumbs, Back to Story, Booster chooser and item navigation.
- [x] U5: Add Card on Booster canvas; supported slide media and prompts; reuse/independent slide choice; safe sequence reorder/duplicate/remove.
- [x] U6: Focused command tests, existing tests, renderer typecheck/build, main build and browser acceptance on disposable fixtures. Record limitations and manual checklist.

Files: shared/cardAuthoring.ts and tests own immutable transactions; shared/types.ts and cardsV2.ts own compatible data extensions; cardV2Render.ts applies placement style. CardPlacementInspector.tsx owns contextual authoring. CardV2Scene.tsx owns logical pointer gestures. App.tsx wires the active Edit host and live host separately. presentationSnapshot.ts, usePresentProjection.ts and present.tsx project overlay plans without a second runtime. Main normalization preserves attachments. LessonTimeline retains sequence selection.

Validation: `npm test`, `npx tsc --noEmit`, `npm run build:renderer`, `npm run build:main`. Browser automation exercises one-click creation, text/faces, geometry, duplication, Booster entry/return, history and live independence. Production episode files are read-only.
