# Relics Architecture Design

Date: 2026-05-17
Project: Story Studio

## Goal

Add a Relics system that works for both new and old Story Studio lessons. Old projects must load without manual migration, receive safe default relic data on open, allow the teacher to configure and use relics, and save the new relic data back into the project.

The design separates:

- Global student roster: school-wide student identities, stored outside project files.
- Lesson relic data: each project stores its relic configuration, widget settings, and per-student progress for that lesson only.

## Current App Shape

Story Studio is a React renderer with Electron main/preload APIs.

- Project state type lives in `src/shared/types.ts`.
- Main-process project normalization and migration live in `src/main/main.ts` through `normalizeProjectData`.
- Project files are stored as `project.json` in the selected project folder.
- Project media is imported through `project:import-media`, copied into the project `assets/` folder, and referenced by `AssetItem.id` plus `relativePath`.
- The top navigation modes and much of the stage/sidebar UI live in `src/renderer/App.tsx`.
- Badge/star student state currently lives in `ProjectData.sparkStudents`, which is lesson/project data and should not become the global roster.

## Recommended Architecture

Use main/shared normalization for project relic data and a small Electron settings API for the global roster.

This keeps old project compatibility strongest because `relicSystem` is normalized before React renders project data. It also keeps roster identity out of lesson files while preserving per-lesson progress in each `project.json`.

## Data Model

Add shared types:

```ts
export interface StudentRosterEntry {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRosterSettings {
  version: 1;
  studentRoster: StudentRosterEntry[];
}

export type RelicWidgetPosition =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | "centerBottom";

export type RelicAnimationStyle =
  | "none"
  | "glowPulse"
  | "sparkle"
  | "stageUnlockBurst"
  | "completeCeremony";

export interface RelicStudentProgress {
  progress: number;
  active: boolean;
  notes?: string;
}

export interface RelicSystem {
  enabled: boolean;
  relicTitle: string;
  relicDescription: string;
  mainImageAssetId: string | null;
  stageImageAssetIds: {
    stage1: string | null;
    stage2: string | null;
    stage3: string | null;
  };
  stageTitles: {
    stage1: string;
    stage2: string;
    stage3: string;
  };
  studentProgress: Record<string, RelicStudentProgress>;
  showOnStage: boolean;
  widgetPosition: RelicWidgetPosition;
  widgetOffset: { x: number; y: number };
  widgetScale: number;
  animationStyle: RelicAnimationStyle;
  animateOnProgress: boolean;
  animateOnStageChange: boolean;
  animateOnComplete: boolean;
}
```

Add `relicSystem?: RelicSystem` to `ProjectData`.

Images use asset IDs rather than embedded data or raw paths. This follows the existing Story Studio project asset approach: import media copies files into the project `assets/` folder, project JSON stores asset references, and renderer resolves them through `toMediaUrl`.

## Global Roster Persistence

Add app settings storage in Electron main:

- Store roster in a JSON file under Electron `app.getPath("userData")`, for example `story-studio-settings.json`.
- Shape: `{ version: 1, studentRoster: [...] }`.
- Add preload APIs:
  - `getStudentRoster(): Promise<StudentRosterSettings>`
  - `saveStudentRoster(settings: StudentRosterSettings): Promise<StudentRosterSettings>`

The settings loader must tolerate missing files and malformed fields by returning `{ version: 1, studentRoster: [] }` or sanitized entries.

Roster IDs are stable UUIDs. Rename changes only `name` and `updatedAt`. Remove should archive by default (`archived: true`) so old lesson progress remains harmless. A hard delete can be avoided for the first version.

## Project Normalization and Backward Compatibility

Add `normalizeRelicSystem(input, roster?)` as shared/testable logic. Main-process `normalizeProjectData` should call it without requiring roster access, so old projects are safe even before renderer loads the global roster.

Default relic state:

```ts
{
  enabled: true,
  relicTitle: "",
  relicDescription: "",
  mainImageAssetId: null,
  stageImageAssetIds: { stage1: null, stage2: null, stage3: null },
  stageTitles: {
    stage1: "Echo Fragment Found",
    stage2: "Echo Core Restored",
    stage3: "Echo Stone Awakened"
  },
  studentProgress: {},
  showOnStage: true,
  widgetPosition: "topRight",
  widgetOffset: { x: 0, y: 0 },
  widgetScale: 1,
  animationStyle: "glowPulse",
  animateOnProgress: true,
  animateOnStageChange: true,
  animateOnComplete: true
}
```

Renderer reconciliation runs after both project and roster are available:

- For every non-archived roster student missing from `relicSystem.studentProgress`, add `{ progress: 0, active: false }`.
- Clamp existing progress to integer `0..30`.
- Preserve progress for student IDs no longer in the roster, but hide them from the active roster UI.
- Preserve unknown unrelated project fields by spreading existing data and changing only `relicSystem`.

This means old projects load normally, can use the Relics tab immediately, and save with relic data included after the teacher changes or saves the project.

## Stage and Progress Rules

Progress is lesson-specific and stored at `project.data.relicSystem.studentProgress[studentId].progress`.

Stage calculation:

- `0`: Not Started
- `1..10`: Stage 1
- `11..20`: Stage 2
- `21..29`: Stage 3
- `30`: Complete

Helper functions should be tested in `src/shared/relics.ts`:

- `clampRelicProgress(value): number`
- `getRelicStage(progress): RelicStage`
- `getNextRelicStageDistance(progress): number | null`
- `applyRelicProgressDelta(relicSystem, studentIds, delta)`
- `setRelicProgressForStudents(relicSystem, studentIds, progress)`
- `ensureRelicProgressForRoster(relicSystem, roster)`

Progress controls affect only active students. If no students are active, controls do nothing safely and the UI shows a gentle warning such as "No active student selected."

## Relics Tab

Add a top-level `Relics` tab near Story, Boost, Badge, and Boards. Do not redesign the app.

The sidebar/panel for Relics includes these compact sections:

1. Relic Configuration
   - title, description, stage titles
   - image pickers for main/stage 1/stage 2/stage 3
   - import image through existing `window.appApi.importMedia()`, then select imported image asset ID

2. Student Roster / Active Students
   - list non-archived roster students
   - show name, active checkbox, current lesson progress, stage, optional notes if low effort
   - add, rename, archive/remove

3. Active Session Controls
   - increase +1, decrease -1, reset 0, complete 30
   - disabled or warning when no students are active

4. Teacher Progress Display
   - exact `7 / 30`
   - stage label
   - next stage distance

5. Main Stage Widget Settings
   - show on stage
   - position preset
   - optional x/y offset and scale

6. Animation Settings
   - animation style
   - animate on progress, stage change, complete

7. Reward Card / Completion Controls
   - Show Reward Card
   - Complete Relic

## Main Stage Widget

Render a `RelicStageWidget` inside `stage-wrap`, above story/boost/break stage content, similar to `SparkOverlay` and `FinalBadgeOverlay`.

It shows only active roster students. If no active student exists or `showOnStage` is false, it renders nothing.

One active student:

- student name
- relic image
- relic title
- current stage title
- progress bar

Multiple active students:

- combined name line such as `Luca & Sofia`
- relic image/title
- if all progress values match, one group progress bar
- if progress differs, show compact per-student progress rows

Group image selection uses the lowest active progress so mixed-progress groups do not overstate the group's stage. This should be documented in a code comment near the selector helper.

Image fallback:

- progress `0`: main image
- `1..10`: stage 1 image, fallback main image
- `11..20`: stage 2 image, fallback main image
- `21..30`: stage 3 image, fallback main image

## Reward Card

Add renderer state for `isRelicRewardCardVisible`. Clicking "Show Reward Card" displays a large student-facing overlay on the stage. It does not change progress.

Text:

- `RELIC COMPLETE!`
- `You unlocked the [Relic Title]!`
- `Digital Hero Card Earned!`

The overlay has a close/hide button. Completion is controlled separately by "Complete Relic", which sets active students to 30.

## Hotkeys

Register global renderer hotkeys while Story Studio is focused:

- `Ctrl + Alt + ArrowUp`: active students +1
- `Ctrl + Alt + ArrowDown`: active students -1
- `Ctrl + Alt + R`: active students reset to 0
- `Ctrl + Alt + C`: active students complete to 30

Hotkeys must ignore events from `input`, `textarea`, `select`, and contenteditable elements. They should not conflict with existing spark/student hotkeys. If a conflict is found during implementation, choose the closest safe alternative and show it in the Relics tab.

## Animation

Use CSS-based animation classes only.

Events:

- progress increase: pulse/glow progress bar when enabled
- boundary crossing `0->1`, `10->11`, `20->21`, `29->30`: stage unlock burst when enabled
- reaching 30: completion ceremony when enabled

Keep animation state local to the renderer. Do not save transient animation state in project data.

## Save and Load Behavior

Project save remains `window.appApi.saveProject(project.data, mode)`.

Because `relicSystem` is part of `ProjectData`, project JSON will include:

- relic configuration
- image asset IDs
- per-student progress and active flags
- widget visibility/position/offset/scale
- animation settings

Global roster save is separate and called when adding, renaming, or archiving students.

When adding a student:

- create roster entry in global settings
- add progress `{ progress: 0, active: false }` to the currently open project
- other projects get default progress when opened

When archiving/removing a student:

- mark roster entry archived
- keep project progress data intact
- hide archived students from normal active roster list

## Implementation Boundaries

Prefer isolated files:

- `src/shared/relics.ts`
- `src/shared/relics.test.ts`
- `src/renderer/relics/RelicsPanel.tsx`
- `src/renderer/relics/RelicStageWidget.tsx`
- `src/renderer/relics/relics.css`

Small edits in existing files:

- `src/shared/types.ts`: add relic and roster types.
- `src/main/main.ts`: normalize project relic data and add roster settings IPC.
- `src/main/preload.ts`: expose roster APIs.
- `src/renderer/App.tsx`: add top tab, state wiring, project update callbacks, stage widget, reward overlay, hotkeys.
- `src/renderer/styles.css`: import or include relic CSS if the app does not have CSS module imports.

## Testing Plan

Use TDD for shared behavior before production code:

- missing `relicSystem` becomes a complete default object
- partial `relicSystem` is filled safely
- progress clamps to `0..30`
- stage calculation matches all boundaries
- roster reconciliation adds missing students with progress 0 inactive
- old student IDs not in roster are preserved
- active student progress updates affect all and only active students
- no active student update is safe
- image selection uses expected stage image fallback

Manual app checks after implementation:

- old project without relic data opens
- old project can save after relic edits
- new project saves relic data
- reload restores title, images, stage titles, progress, active students, widget settings, animations, visibility
- global roster persists across projects
- progress remains lesson-specific
- hotkeys work while teaching
- hotkeys do not fire while typing
- stage widget hides when disabled
- multiple active students progress together
- no-active-student state is safe

## Open Decisions

The recommended defaults are:

- Archive student removals instead of hard deleting roster entries.
- Use top-level `Relics` tab, not a nested Boost subtab, because relic controls apply during story and boost teaching.
- Store active flags inside lesson relic progress so each lesson can remember its last active teaching setup.

These can be changed before implementation if desired.
