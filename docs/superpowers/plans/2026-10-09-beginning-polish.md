# Beginning polish implementation plan

**Goal:** Ship the supplied launcher, restrained theme, and reliable active-bin imports without changing timeline architecture.

**Architecture:** A launcher component sits within the rebuilt app lifecycle. A pure import merge helper handles bin ownership. Shared CSS tokens provide the visual layer.

**Tech stack:** React, TypeScript, Vite, Electron, Node tests and Electron/Playwright smoke tests.

- [x] Add regression tests in `src/shared/lesson/mediaImport.test.ts` for loose imports, nested folder imports, root imports and stale destinations. Run TypeScript tests to confirm failure before implementing `mergeLessonMediaImport`.
- [x] Implement `src/shared/lesson/mediaImport.ts`; wire the destination through `LessonMediaPool.tsx` and `LessonApp.tsx`. Reset pool state by project key and expose bins independently of filters.
- [x] Create `Beginning.tsx` with static asset imports, accessible cards, settings and Users entries. Integrate startup and return navigation into `LessonApp.tsx`; retain explicit legacy startup. Apply selected sequence and Teach mode when opening a lesson from the launcher.
- [x] Add `studioTheme.css`, loaded after existing styles, with semantic theme tokens, scoped teacher controls, launcher responsiveness and inspector hierarchy. Avoid styling scene contents.
- [x] Add Electron smoke coverage in `scripts/beginning-polish-smoke.cjs`; update existing smoke entry steps for the new startup. Check file/folder/drop import persistence, switching bins during import, all launcher entries and return navigation.
- [x] Run `npm test`, `npm run build:renderer`, `npm run build:main`, `npx tsc --noEmit`, Electron acceptance scripts. Save desktop/narrow screenshots and inspect them. Report verified outcomes and any compromises.
