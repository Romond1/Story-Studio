# Mini-game Break Editor Implementation Plan

**Goal:** Configure Spinning Wheel Breaks inside the existing editor.
**Architecture:** Version-2 wheel settings under the Phase 1 configuration; referenced Cards; retained inactive drafts; renderer-owned editor and static preview.
**Tech stack:** TypeScript, React, existing Electron scene editor, node:test.

- [x] Add failing wheel-authoring tests covering distinct pool/session/segments, quota warnings, removal and stable IDs, retained drafts, v1 loading, copy remapping and export/import.
- [x] Add validated wheel settings and pure authoring operations. Extend registry and draft-switch/copy helpers; defer v2 runtime gameplay.
- [x] Build Break experience/Spinning Wheel controls and static logical-frame preview. Link question editing to the existing Card editor and preserve scene tools.
- [x] Verify unit tests, renderer/main builds and typecheck; run native editor smoke and inspect desktop/narrow evidence.
- [x] Review scoped changes, document files/controls/placeholders/issues and stop. Preserve all existing uncommitted Phase 1 work. Do not commit or push.
