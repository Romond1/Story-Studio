# Relics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Relics feature with a global roster, per-project relic progress, backward-compatible project loading, teacher controls, hotkeys, and a stage widget.

**Architecture:** Shared relic helpers own normalization, stage math, roster reconciliation, and progress mutations. Electron main stores the global roster in an app settings JSON file and normalizes project relic data on load. React adds a Relics tab plus stage overlay components wired into existing project asset import/save behavior.

**Tech Stack:** React 18, TypeScript, Electron IPC/preload, Vite, Node test runner, project asset imports through existing `window.appApi.importMedia()`.

---

### Task 1: Shared Relic Types and Helpers

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/relics.test.ts`
- Create: `src/shared/relics.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Write failing tests**

Create `src/shared/relics.test.ts` with tests for default normalization, partial normalization, progress clamping, stage boundaries, roster reconciliation, active-only progress mutation, no-active safety, and image fallback.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx tsc -p tsconfig.test.json && node --test dist-test/shared/relics.test.js`

Expected: TypeScript fails because `src/shared/relics.ts` does not exist.

- [ ] **Step 3: Implement shared types and helpers**

Add `StudentRosterEntry`, `StudentRosterSettings`, `RelicSystem`, `RelicStudentProgress`, `RelicStage`, `RelicWidgetPosition`, and `RelicAnimationStyle` to `src/shared/types.ts`.

Create `src/shared/relics.ts` exporting default relic state, normalization, progress clamp/stage helpers, roster reconciliation, active student selection, progress mutation, and image selection.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx tsc -p tsconfig.test.json && node --test dist-test/shared/relics.test.js`

Expected: relic tests pass.

### Task 2: Project and Roster Persistence

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/vite-env.d.ts`

- [ ] **Step 1: Wire project normalization**

Import `normalizeRelicSystem` in `src/main/main.ts` and set `relicSystem: normalizeRelicSystem((data as any).relicSystem)` inside `normalizeProjectData`.

- [ ] **Step 2: Add app settings IPC**

In `src/main/main.ts`, add `settingsPath()`, `normalizeStudentRosterSettings()`, `readStudentRosterSettings()`, `writeStudentRosterSettings()`, and IPC handlers `settings:get-student-roster` and `settings:save-student-roster`.

- [ ] **Step 3: Expose preload APIs**

Add `getStudentRoster` and `saveStudentRoster` to `src/main/preload.ts` and the renderer app API type declaration.

- [ ] **Step 4: Type-check**

Run: `npm run build:main`

Expected: main process builds.

### Task 3: Renderer Relics UI and Stage Components

**Files:**
- Create: `src/renderer/relics/RelicsPanel.tsx`
- Create: `src/renderer/relics/RelicStageWidget.tsx`
- Create: `src/renderer/relics/relics.css`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Build `RelicsPanel`**

Create a compact teacher panel with relic configuration, image selectors/import buttons, roster controls, active checkboxes, progress controls, widget settings, animation settings, and reward/completion buttons.

- [ ] **Step 2: Build `RelicStageWidget`**

Render only active students, choose stage image by lowest active progress, show group or per-student progress, and show the completion reward overlay.

- [ ] **Step 3: Wire top-level `Relics` mode**

Extend `topMode` to include `relics`, render the tab beside Story/Boost/Badge/Boards, show `RelicsPanel` in the sidebar, and keep stage content visible while the relic widget overlays the stage.

- [ ] **Step 4: Load and save global roster in renderer**

On app mount, load `window.appApi.getStudentRoster()`. Add roster change helpers that save settings and reconcile the open project’s `relicSystem.studentProgress`.

- [ ] **Step 5: Wire progress actions and hotkeys**

Use shared progress helpers for `+1`, `-1`, reset, and complete. Register `Ctrl+Alt+ArrowUp`, `Ctrl+Alt+ArrowDown`, `Ctrl+Alt+R`, and `Ctrl+Alt+C`, ignoring text inputs/contenteditable elements.

- [ ] **Step 6: Type-check renderer**

Run: `npm run build:renderer`

Expected: renderer builds.

### Task 4: Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run shared tests**

Run: `npx tsc -p tsconfig.test.json && node --test dist-test/shared/relics.test.js`

Expected: tests pass.

- [ ] **Step 2: Run main build**

Run: `npm run build:main`

Expected: build passes.

- [ ] **Step 3: Run renderer build**

Run: `npm run build:renderer`

Expected: build passes.

- [ ] **Step 4: Manual smoke check**

Start the app with `npm run dev`, open a project, confirm the Relics tab appears, create/rename/archive a roster student, configure a relic title and stage title, import an image, activate a student, adjust progress, hide/show the widget, and save.
