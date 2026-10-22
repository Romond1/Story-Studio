# Media Pool Usability Implementation Plan

**Goal:** Clean readable media names and compact cards with accessible previews, without changing physical media or authored references.

**Architecture:** An optional asset title with derived fallback, shared thumbnail/preview components, and minimal adapters in the existing scene and legacy pools.

**Tech Stack:** TypeScript, React, existing CSS variables, native HTML dialog, Node tests, Electron/Playwright.

1. Add focused failing tests for filename cleanup, prefixes, duplicates, user overrides, immutable rename, validation and save/reload. Add a portable export/import title assertion to the existing package suite.
2. Implement `mediaDisplayName.ts`, optional `AssetItem.displayTitle`, and validation. Keep old documents untouched and existing canonical reference helpers unchanged.
3. Implement shared `MediaPoolThumbnail` and `MediaAssetPreview` components and scoped CSS. Use a single preview decoder; test dismissal, focus, play/seek and decoder teardown in the native UI.
4. Integrate both pools. Keep modifier selection, drag payloads, filters, bins and audio attachment. Remove double-click insertion. Wire explicit insertion using existing commands; rename using existing history callbacks.
5. Run focused and full existing tests, renderer/main builds, native smoke checks, desktop/narrow screenshots and layout audits. Inspect the diff for unrelated changes and leave changes uncommitted.
