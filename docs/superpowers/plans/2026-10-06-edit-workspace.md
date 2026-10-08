# Edit workspace implementation plan

Goal: Preserve authoring capability while sharing Teach spatial architecture.
Architecture: Reuse existing controls through typed Edit workspace slots; retain legacy fallback and all Core handlers.
Tech stack: React, TypeScript, Electron, Vite, node:test.

- [x] Inventory current controls and parity destinations in docs/edit-workspace-inventory.md.
- [x] Update teachWorkspace tests to require one row at every available height; run focused tests and confirm failure.
- [x] Implement fixed single-row TeachNavigator and Edit selection labels, section jump, semantic item labels, existing navigation handlers.
- [x] Add EditWorkspace.tsx/CSS with Inspector categories, separate tools, focus toggle, portal slots. Integrate existing sidebar, audio, break, Stage and media controls without copying command implementations.
- [x] Share fitted preview and divider; persist Edit split separately with default 60. Keep canonical frame shared across mode switches.
- [x] Run npm test, npm run build:renderer, npm run build:main and renderer typecheck. Capture responsive UI and inspect controls.
- [x] Compare feature inventory, document limitations and manual production acceptance; retain legacy fallback.

