# Boost Mode Implementation Plan (Agent A / Planner)

## Assumptions (explicit)
1. The app currently uses a single `App.tsx` composition with local React state and IPC-backed project save/load, and we should preserve this pattern for low-risk incremental delivery.
2. Existing `ProjectData.version` is `1` and projects are stored as `project.json` in a project folder.
3. Existing media assets and slide records are the source of truth; Boost Mode only references them via IDs.
4. `Section` already supports break-like content (`type: 'break'` + break-related fields), so `breakRef` can point to `sectionId` for break sections rather than introducing a second break table now.
5. Any renderer changes that are not required for Boost MVP (e.g., full overlay editor with drag/resize) must be deferred.
6. Boost Mode is introduced behind a feature flag initially to protect Story Mode.

---

## 1) Architecture Overview

### Mode hierarchy
- Add a **top-level mode switch**:
  - `Story`
  - `Boost`
- Keep Story submodes unchanged:
  - `Edit`
  - `Teach`
- Add Boost tabs:
  - `Activation`
  - `Language`
  - `Games`

### Layout invariants (non-negotiable)
- **Left sidebar = Navigation always** (sequence rail, add/reorder/jump).
- **Center = sacred viewer** (existing renderer/audio pipeline shared by Story + Boost).
- **Right sidebar = Tools always** (mode/tab-specific controls only).

### Shared runtime
- Both Story and Boost feed a **resolved presentation item** into the same viewer/audio path:
  - Story resolves from slide list + section state.
  - Boost resolves from `SequenceItem` -> (slide/break/prompt/minigame).
- Reuse existing media URL resolver, transition behavior, drawing behavior, and audio manager.

### New data concept
- Add `boostPack` to `ProjectData`.
- `boostPack` holds three independent sequences (`activation`, `language`, `games`) referencing existing IDs.
- Add tags for discovery/filtering and optional generation.

---

## 2) File-by-file Change List (exact paths)

### `src/shared/types.ts`
- Add schema version constants/types (`ProjectSchemaVersion = 2`).
- Extend `Slide` with:
  - `tags?: string[]`
  - `overlays?: OverlayItem[]` (default empty)
  - `audioCues?: AudioCue[]` (default empty)
- Extend `Section` with optional `tags?: string[]` for break tagging.
- Extend `AudioClip` (optional) with `tags?: string[]` if tagging dialogues/music is needed now.
- Add interfaces:
  - `OverlayItem`
  - `AudioCue`
  - `BoostPack`
  - `SequenceItem` + discriminated union subtypes
  - `SlideRefItem`, `BreakRefItem`, `PromptCardItem`, `MiniGameItem`
- Update `ProjectData`:
  - `version: 1 | 2` (or numeric `number` with runtime guard)
  - `boostPack?: BoostPack`

### `src/main/main.ts`
- Introduce migration/normalization entrypoint:
  - `migrateProjectData(raw: unknown): ProjectData`.
- Update `loadProject` and save/create flows to ensure:
  - v1 loads successfully.
  - Missing `boostPack`, `tags`, `overlays`, `audioCues` initialized safely.
- Increment new-project schema version to `2`.
- Keep old fields untouched to avoid Story regressions.

### `src/renderer/mode.ts`
- Replace flat mode model with hierarchical state types:
  - top-level mode: `'story' | 'boost'`
  - story tab: `'edit' | 'teach'`
  - boost tab: `'activation' | 'language' | 'games'`
- Keep `ensureEditMode` behavior for Story Edit-only actions.
- Add feature flag gate export, e.g., `ENABLE_BOOST_MODE`.

### `src/renderer/App.tsx`
- Add top-level mode switch UI + tab strip behavior.
- Keep sidebars structurally stable:
  - left navigation rail always mounted
  - right tools panel always mounted
- Add Boost navigation rail behavior:
  - show current sequence items
  - add/reorder/jump/remove actions
- Add Boost tools panel behavior:
  - slide picker (search + thumbnails)
  - item type insertion controls
  - minimal tag editor for selected slide
  - optional simple “Generate Activation Sequence” from tags (if implemented)
- Add selection state for current Boost sequence + selected item.
- Resolve currently viewed item from Story or Boost and route to existing viewer/audio.
- Optional read-only overlay rendering in viewer when current slide has overlays.

### `src/renderer/styles.css`
- Add minimal layout + tab styles for top-level mode strip, Boost tab strip, sequence list rows, tag chips.
- Ensure no disruptive restyling to Story UI.

### `src/renderer/main.tsx`
- No major logic change expected; only if app-level providers/config flags need wiring.

### `src/main/preload.ts`
- No API contract changes expected unless explicit boost utilities are split into IPC (prefer not; keep save via existing `saveProject`).

### `README.md` (or `docs/` additions)
- Add short section: schema v2, Boost Mode concept, migration guarantees.

### New file: `docs/boost-mode-plan.md` (implementation companion)
- Execution checklist for Agent B with phase-by-phase tasks and QA.

---

## 3) Data Model Definitions (TypeScript interfaces)

```ts
// src/shared/types.ts

export type ProjectSchemaVersion = 1 | 2;

export interface OverlayItem {
  id: string;
  type: 'speechBubble' | 'textBox';
  text: string;
  // normalized 0..1 coordinates relative to slide viewport
  x: number;
  y: number;
  width: number;
  height: number;
  // style primitives for read-only render support
  align?: 'left' | 'center' | 'right';
  theme?: 'light' | 'dark' | 'accent';
  visible?: boolean;
  zIndex?: number;
}

export interface AudioCue {
  id: string;
  kind: 'dialogue' | 'sfx' | 'bgm' | 'music' | 'voiceover';
  label: string;
  // seconds from slide start or item start
  timeSec: number;
  targetAssetId?: string;
  targetUrl?: string;
  volume?: number; // 0..1
  fadeMs?: number;
  tags?: string[];
}

export interface SlideRefItem {
  id: string;
  type: 'slideRef';
  slideId: string;
  viewOverride?: {
    zoom?: number;
    panX?: number;
    panY?: number;
  };
}

export interface BreakRefItem {
  id: string;
  type: 'breakRef';
  breakId: string; // references Section.id where section.type === 'break'
  textOverride?: string;
}

export interface PromptCardItem {
  id: string;
  type: 'promptCard';
  title?: string;
  body: string;
  durationMs?: number;
}

export interface MiniGameItem {
  id: string;
  type: 'miniGame';
  gameType: 'placeholder';
  config?: Record<string, unknown>;
}

export type SequenceItem = SlideRefItem | BreakRefItem | PromptCardItem | MiniGameItem;

export interface BoostPack {
  activationSequence: SequenceItem[];
  languageSequence: SequenceItem[];
  gamesSequence: SequenceItem[];
}
```

Tag model:
- Tags are plain strings (e.g. `"character:Yuki"`, `"beat:key"`, `"targetLine"`).
- Storage:
  - `Slide.tags?: string[]`
  - Optional `Section.tags?: string[]` for break tagging
  - Optional `AudioClip.tags?: string[]` for dialogue/music tagging (if consumed now)
- No centralized taxonomy in MVP; free-form with normalized trim/lowercase on save.

---

## 4) Save Schema Versioning + Migration (pseudocode)

```ts
const CURRENT_SCHEMA_VERSION = 2;

function emptyBoostPack(): BoostPack {
  return {
    activationSequence: [],
    languageSequence: [],
    gamesSequence: [],
  };
}

function migrateV1ToV2(v1: ProjectDataV1): ProjectDataV2 {
  return {
    ...v1,
    version: 2,
    slides: v1.slides.map((s) => ({
      ...s,
      tags: Array.isArray(s.tags) ? s.tags : [],
      overlays: Array.isArray((s as any).overlays) ? (s as any).overlays : [],
      audioCues: Array.isArray((s as any).audioCues) ? (s as any).audioCues : [],
    })),
    sections: v1.sections.map((sec) => ({
      ...sec,
      tags: Array.isArray((sec as any).tags) ? (sec as any).tags : [],
    })),
    boostPack: isBoostPack((v1 as any).boostPack) ? (v1 as any).boostPack : emptyBoostPack(),
  };
}

function normalizeProjectData(raw: unknown): ProjectDataV2 {
  const parsed = parseAndValidateBase(raw);

  if (parsed.version === 1) {
    return migrateV1ToV2(parsed);
  }

  // v2+ safe normalization
  return {
    ...parsed,
    version: 2,
    slides: parsed.slides.map(normalizeSlide),
    sections: parsed.sections.map(normalizeSection),
    boostPack: isBoostPack(parsed.boostPack) ? parsed.boostPack : emptyBoostPack(),
  };
}
```

Migration guarantees:
- Existing projects open with no user action.
- Story Mode data and behavior preserved.
- Newly introduced arrays default to `[]`.
- Save writes back as version `2`.

---

## 5) UI Component Breakdown

> Keep these as small internal components in `App.tsx` first (low risk). Extract later only if needed.

### New top-level UI pieces
1. `ModeSwitchBar`
   - Props: `topMode`, `onChangeTopMode`, feature-flag visibility.
   - Renders `Story | Boost` toggle.

2. `StorySubTabBar`
   - Existing behavior for `Edit | Teach`.

3. `BoostTabBar`
   - Props: `boostTab`, `onChangeBoostTab`.
   - Renders `Activation | Language | Games`.

### Left Sidebar: Navigation (always)
4. `NavigationRail`
   - Story mode: existing section/slide navigator.
   - Boost mode: sequence list for selected boost tab.

5. `BoostSequenceRail`
   - Props:
     - `items: SequenceItem[]`
     - `selectedItemId`
     - `onSelect/onReorder/onRemove/onMoveUp/onMoveDown`
   - Responsibilities:
     - List items with compact labels (`slideRef -> slide title/id`, etc.).
     - Jump to item.
     - Reorder (buttons first; drag optional later).

### Right Sidebar: Tools (always)
6. `ToolsPanel`
   - Story mode: existing tools panel.
   - Boost mode: Boost-specific tools only.

7. `BoostToolsPanel`
   - Contains:
     - `SlidePicker` (thumbnail + search filter on slide tags/text/id)
     - Insert item actions (`Add SlideRef`, `Add PromptCard`, `Add BreakRef`, `Add MiniGame`)
     - `TagEditor` for currently selected slide
     - Optional `GenerateActivationButton`

8. `TagEditor`
   - Props: `tags`, `onAddTag`, `onRemoveTag`
   - Minimal chip list + text input.

### Viewer additions
9. `OverlayLayer` (optional read-only)
   - Props: `overlays: OverlayItem[]`
   - Render speech bubble/text boxes if `visible !== false`.
   - No drag/resize/edit interactions in this milestone.

---

## 6) State / Store Changes

Use existing local React state pattern; do not add new store library.

### New state slices in `App.tsx`
- `topMode: 'story' | 'boost'` (feature-gated)
- `storyMode: 'edit' | 'teach'` (existing semantics)
- `boostTab: 'activation' | 'language' | 'games'`
- `selectedBoostItemId: string | null`
- `boostSearchQuery: string`
- `boostFeatureEnabled: boolean` (constant/env flag)

### Derived selectors/helpers
- `getActiveBoostSequence(project, boostTab)`
- `setActiveBoostSequence(project, boostTab, nextItems)`
- `resolveCurrentPresentationItem(...)`
- `getSlideById`, `getBreakById`
- `normalizeTags(tags: string[]): string[]`

### Mutations
- Sequence operations:
  - `addSequenceItem(tab, item)`
  - `removeSequenceItem(tab, itemId)`
  - `moveSequenceItem(tab, from, to)`
- Tag operations:
  - `addTagToSlide(slideId, tag)`
  - `removeTagFromSlide(slideId, tag)`
- Keep all updates immutable and mark `isDirty` consistently.

---

## 7) Step-by-step Implementation Phases (buildable checkpoints)

### Phase 0 — Guardrails + Feature Flag
- Add `ENABLE_BOOST_MODE` flag default `false`.
- Add top-level mode state but keep UI hidden unless flag enabled.
- Checkpoint: app builds; Story Edit/Teach unchanged.

### Phase 1 — Schema v2 + Migration (no UI dependency)
- Extend shared interfaces (`BoostPack`, tags, overlays, audioCues).
- Implement migration in main process load path.
- New project creation writes v2 with default `boostPack` and empty overlay/audioCue arrays.
- Checkpoint: open old project -> auto-normalized; save works.

### Phase 2 — Top-level Mode and Stable Layout Skeleton
- Add `Story | Boost` switch (flag-protected).
- Ensure left/right sidebars remain consistent containers.
- Keep viewer bound to existing story flow for now.
- Checkpoint: switch visible with flag, no Story regressions.

### Phase 3 — Boost Tabs + Sequence CRUD (MVP)
- Add Boost tabs and three sequences.
- Implement add/remove/reorder/jump for sequence items.
- Implement slide picker + search to add `slideRef` only initially.
- Checkpoint: can build sequences referencing existing slides; persistence verified.

### Phase 4 — Non-slide Items + Tag Editor
- Add insertion/edit minimal UI for `breakRef`, `promptCard`, `miniGame` placeholders.
- Add tag editor on selected slide (chip add/remove).
- Optional simple generation button:
  - Build Activation sequence from slides filtered by tag token.
- Checkpoint: all required item types creatable and persisted.

### Phase 5 — Shared Viewer Resolution + Optional Overlay Read-only
- Route Boost selected item to central viewer/audio pipeline.
- `slideRef` uses actual slide rendering/audio.
- `breakRef` uses existing break rendering path.
- `promptCard` and `miniGame` show lightweight placeholder cards in viewer.
- Optional: render `OverlayLayer` read-only if slide has overlays.
- Checkpoint: Boost playback/preview uses same engine as Story.

### Phase 6 — Hardening + Regression Sweep
- Full manual QA pass (below).
- Fix edge cases: missing refs, deleted slides referenced by sequence.
- Add safety UI for broken references (`[Missing slide]`).
- Flip feature flag default to true only after regression confidence.
- Checkpoint: release-ready.

---

## 8) QA Checklist

### Core regression (must pass)
- Story Mode opens existing project and behaves identically (Edit + Teach).
- Slide navigation, transitions, draw tools, audio playback unchanged.
- Import media/audio and save/load unchanged.

### Boost functional
- Can switch to Boost mode (when flag enabled).
- Each tab (`Activation`, `Language`, `Games`) maintains independent sequence.
- Add `slideRef` from slide picker; item plays existing slide media/audio.
- Reorder/jump/remove sequence items works and persists after save/reopen.
- Add `breakRef`, `promptCard`, `miniGame` placeholder and persist.

### Tags
- Add/remove slide tags in Boost tools.
- Tags persist after save/reopen.
- Slide picker search by tag text returns expected slides.

### Migration
- Open v1 project with no `boostPack/tags/overlays/audioCues`.
- Confirm defaults initialized and file saves as v2.

### Overlay/audioCue foundational support
- Existing slides without overlays/audioCues render unchanged.
- Slides with overlays (seeded JSON) render read-only overlays (if implemented).
- `audioCues` survive save/load roundtrip.

### Edge cases
- Sequence points to deleted slide/break -> graceful fallback row + non-crash viewer placeholder.
- Empty sequences -> friendly empty state.

---

## 9) Risks + Fallback Steps

1. **Risk: Story regressions due to mode-state coupling**
   - Fallback: keep Boost behind feature flag until all Story checks pass.

2. **Risk: Migration corrupts legacy project shape**
   - Fallback: pure additive migration; never remove/rename old fields in this milestone.

3. **Risk: Large `App.tsx` complexity**
   - Fallback: introduce small internal helper components first; postpone major file split.

4. **Risk: Sequence references break when slide deleted**
   - Fallback: leave orphan refs but mark as missing in UI; allow cleanup action.

5. **Risk: Overlay rendering impacts viewer performance**
   - Fallback: optional read-only render path behind secondary flag; default off if unstable.

---

## 10) Definition of Done (minimal)

- Top-level mode switch `Story | Boost` exists.
- Story mode still offers `Edit | Teach` and passes regression checklist.
- Boost mode has tabs `Activation | Language | Games`.
- Each Boost tab persists an independent `SequenceItem[]` in `boostPack`.
- `slideRef` references existing slides (no duplication) and uses shared viewer/audio path.
- `breakRef`, `promptCard`, `miniGame` minimal stubs implemented.
- Tags are editable for slides (at minimum) and persisted.
- Schema version bumped with migration path for old projects.
- `OverlayItem` + `AudioCue` interfaces and persistence defaults added.
- Full overlay editor explicitly deferred with a follow-on milestone.

---

## Deferred (explicitly out of scope)

- Full overlay authoring UX (drag/resize/rotate, rich style inspector, snapping).
- Advanced sequence generation algorithms beyond simple tag filter.
- New global state framework or major architectural refactor.

### Follow-on milestone (Overlay Editor)
1. Add overlay creation toolbar (speech bubble/text box presets).
2. Add direct-manipulation canvas interactions (drag/resize handles).
3. Add layer list and z-index ordering.
4. Add style panel (font, colors, stroke, tail direction).
5. Add undo/redo integration and keyboard nudging.
6. Add dedicated tests for overlay editing fidelity.