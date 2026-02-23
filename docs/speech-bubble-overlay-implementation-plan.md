# Speech Bubble / Text Overlay System — Implementation Plan

## Architecture overview

### Goals
- Add in-app speech bubbles and free text overlays on top of slide media so teachers/kids can compose stories without external Canva editing.
- Keep overlays visible in both **Story** and **Boost** viewing flows.
- Preserve stable identity for overlays via:
  - a technical immutable ID (`overlayId`)
  - a classroom-friendly reference (`bubbleId`) such as `B1`, `B2`.

### Existing integration points
- **Source of truth model** lives in `ProjectData`/`Slide` interfaces in `src/shared/types.ts`.
- **Project load/save + normalization/migration hook** is `normalizeProjectData(...)` in `src/main/main.ts`.
- **Primary viewer/editor rendering** and mode handling (Story/Boost/Edit) is in `src/renderer/App.tsx`.
- **Visual stage and layering rules** are in `src/renderer/styles.css`.

### Proposed architecture (minimal change)
1. Extend shared schema with:
   - a **bubble definition library** at project level (template catalog).
   - **overlay instances** on each slide.
2. Add migration/defaulting in `normalizeProjectData(...)` so older projects load safely.
3. Add renderer helpers in `App.tsx`:
   - resolve overlay list for current slide.
   - render overlays as absolute-positioned layer above slide media.
   - render persistent `bubbleId` badge.
4. Phase 2 only: add edit interactions in Story Edit mode (selection/drag/resize/text edit + lock + z-order ops).

No new state management library is required; keep local React state patterns already used in `App.tsx`.

---

## Data model interfaces

> Add these in `src/shared/types.ts`.

```ts
export type OverlayKind = 'speech-bubble' | 'text';

export interface BubbleDefStyleDefaults {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  paddingX?: number; // normalized to slide width basis
  paddingY?: number; // normalized to slide height basis
}

export interface BubbleDefinition {
  bubbleDefId: string;        // immutable template ID
  name: string;               // human label ("Round Speech", "Thought Cloud")
  pngSrc: string;             // media://... or app asset path
  defaultStyle: BubbleDefStyleDefaults;
  // optional: intrinsic aspect ratio for resize constraints
  intrinsicAspectRatio?: number;
}

export interface OverlayGeometryNormalized {
  x: number;      // 0..1 (left)
  y: number;      // 0..1 (top)
  width: number;  // 0..1
  height: number; // 0..1
  rotation?: number; // deg, optional for future-proofing
}

export interface SlideOverlay {
  overlayId: string;       // technical immutable UUID
  bubbleId: string;        // user-facing stable ref, e.g. "B1"
  kind: OverlayKind;
  bubbleDefId?: string;    // required when kind='speech-bubble'
  text: string;
  geometry: OverlayGeometryNormalized;
  zIndex: number;
  locked: boolean;
  hidden?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

### Required existing interface extensions

```ts
// ProjectData
bubbleDefinitions?: BubbleDefinition[];

// Slide
overlays?: SlideOverlay[];
nextBubbleSeq?: number; // slide-local monotonic counter for B IDs
```

### Stable `bubbleId` strategy (non-negotiable)
- Keep `overlayId = crypto.randomUUID()` immutable forever.
- Keep `bubbleId` immutable after creation (never re-number on delete/reorder).
- Add `slide.nextBubbleSeq` counter:
  - on create overlay: `bubbleId = "B" + nextBubbleSeq`, then increment.
  - migration for old slides with no counter: compute max numeric suffix among existing `bubbleId`s and set `nextBubbleSeq = max + 1`.
- If imported data has duplicate `bubbleId` on same slide, migration resolves collisions by assigning from `nextBubbleSeq` upward and persisting result.

This is simple, deterministic, and stable for classroom references.

---

## Rendering approach (coordinate system, normalization)

### Coordinate model
- Store geometry normalized to slide frame (`0..1`) so overlays survive viewport resize/zoom.
- Render-time conversion:
  - `leftPx = geometry.x * renderedSlideWidth`
  - `topPx = geometry.y * renderedSlideHeight`
  - `widthPx = geometry.width * renderedSlideWidth`
  - `heightPx = geometry.height * renderedSlideHeight`

### Layering contract
- In stage container:
  1. base slide media (image/video)
  2. marker/highlighter canvas (existing)
  3. **overlay layer** (new)
  4. transition/effects UI (existing)
- Overlay layer should use pointer-events conditionally:
  - Phase 1: `pointer-events: none` (read-only)
  - Phase 2 edit mode: `pointer-events: auto`

### Bubble and text rendering
- `speech-bubble` overlay:
  - render `pngSrc` from resolved `bubbleDefId` as background/image.
  - overlay editable text region with template defaults (`defaultStyle`).
- `text` overlay:
  - transparent box with styled text only.
- Always render a `bubbleId` badge (e.g. small chip near top-left of overlay bounds).

### Story + Boost compatibility
- Rendering should be mode-agnostic in shared stage renderer path so both modes see identical overlays.
- Editing affordances only appear in Story Edit mode (`ensureEditMode(...)` guarded actions).

---

## Editing interaction design (Phase 2)

### Selection
- Single-click overlay to select.
- Shift-click for multi-select (optional stretch goal; can defer if too much risk).
- Selected overlay shows handles + focus ring + `bubbleId` badge.

### Drag move
- Drag interior of selected overlay to move.
- Convert pixel delta to normalized delta based on current rendered slide size.
- Clamp bounds to slide area (`x/y` within `[0,1]`, preserving width/height).
- Respect `locked=true` (no move/resize/text edit).

### Resize
- Corner handles (NW/NE/SW/SE) in Phase 2 baseline.
- For bubble templates with `intrinsicAspectRatio`, default to aspect-preserving resize (Shift override optional).
- Minimum size guard (e.g. width >= 0.05, height >= 0.05 normalized).

### Text editing
- Double-click or Enter on selected overlay opens inline textarea/contenteditable region.
- Escape cancels active edit; blur/Enter commits.
- Persist `updatedAt` and dirty state after commit.

### Keyboard + commands
- Delete/Backspace removes selected unlocked overlay.
- Cmd/Ctrl+D duplicates selected overlay, assigns new `overlayId` + next `bubbleId`.
- Bracket or menu actions for z-index ordering (bring front/back one step).

### Locking
- Lock toggle in overlay inspector/toolbar.
- Locked overlays still render badge and can be selected (read-only), but cannot be modified.

---

## Two-phase step plan with checkpoints

## Phase 1 — Schema + migration + read-only rendering + bubbleId badge

### Step 1: Shared types and defaults
**Files**
- `src/shared/types.ts`

**Changes**
- Add interfaces/types listed above.
- Extend `Slide` and `ProjectData` with optional overlay-related fields.

**Checkpoint**
- TypeScript compile passes with optional fields (no runtime behavior change yet).

### Step 2: Project normalization/migration
**Files**
- `src/main/main.ts`

**Changes**
- Enhance `normalizeProjectData(...)`:
  - ensure `data.bubbleDefinitions` exists (seed minimal built-ins if empty).
  - ensure every slide has `overlays` array and `nextBubbleSeq`.
  - validate/fix overlay identity:
    - missing `overlayId` => assign UUID.
    - missing/duplicate `bubbleId` => assign stable sequence IDs using `nextBubbleSeq`.
  - initialize missing geometry/zIndex/locked defaults.

**Checkpoint**
- Old projects open without crash.
- Saving immediately writes normalized overlay-ready schema.

### Step 3: Read-only stage rendering
**Files**
- `src/renderer/App.tsx`
- `src/renderer/styles.css`

**Changes**
- Add overlay rendering function in the existing slide stage path.
- Compute normalized-to-pixel placement from actual rendered media rect.
- Render bubble/text + badge with `bubbleId`.
- Keep pointer events off (read-only).

**Checkpoint**
- Overlays visible in Story and Boost playback paths.
- Badge always visible and legible.

### Step 4: Smoke QA + fixture data
**Files**
- optional sample project JSON fixture under repo test assets/docs.

**Changes**
- Add one or two sample overlays to verify rendering and migration fallback.

**Checkpoint (Phase 1 exit criteria)**
- Open migrated project, overlays display, IDs stable across save/reload.

---

## Phase 2 — Editing UI in Story Edit mode

### Step 1: Editor state + selection model
**Files**
- `src/renderer/App.tsx`

**Changes**
- Add selected overlay state keyed by slide.
- Add helper utilities:
  - `createOverlay(...)`
  - `updateOverlayGeometry(...)`
  - `updateOverlayText(...)`
  - `deleteOverlay(...)`
  - `reorderOverlayZ(...)`

**Checkpoint**
- Can select/deselect overlays in edit mode only.

### Step 2: Drag/resize interactions
**Files**
- `src/renderer/App.tsx`
- `src/renderer/styles.css`

**Changes**
- Pointer handlers for drag + resize handles.
- Geometry conversion/clamping helpers.
- Visual selected handles.

**Checkpoint**
- Move/resize persists correctly after save/reload.

### Step 3: Text editing + locking + creation tools
**Files**
- `src/renderer/App.tsx`
- `src/renderer/styles.css`

**Changes**
- Inline text edit affordance.
- Lock/unlock toggle.
- Add overlay button(s):
  - Add speech bubble (choose template, default position).
  - Add text overlay.
- Generate `overlayId` + `bubbleId` using slide `nextBubbleSeq`.

**Checkpoint**
- Teacher can create/edit/remove overlays without collisions in bubble IDs.

### Step 4: Mode hardening and regression checks
**Files**
- `src/renderer/App.tsx`

**Changes**
- Guard all mutating overlay actions with Story Edit mode checks.
- Ensure Boost/Teach views remain read-only and performant.

**Checkpoint (Phase 2 exit criteria)**
- Full authoring flow works in Story Edit; Story/Boost both render overlays correctly.

---

## File-by-file change list (planned)

1. `src/shared/types.ts`
   - Add overlay and bubble template interfaces.
   - Extend `Slide` and `ProjectData` with overlay fields.
2. `src/main/main.ts`
   - Extend `normalizeProjectData(...)` for migration/defaults and ID repair.
3. `src/renderer/App.tsx`
   - Phase 1: read-only overlay rendering + badge.
   - Phase 2: selection, drag, resize, text edit, add/delete, lock, z-order.
4. `src/renderer/styles.css`
   - Add overlay layer styling, badge styles, selection handles, edit affordances.
5. *(Optional)* `README.md` or `docs/` follow-up notes
   - Short authoring guide and schema notes for contributors.

---

## Migration notes

- Backward compatible approach: all new fields optional in type layer, normalized at load.
- Do **not** bump project version unless existing app already uses strict version gates; current code suggests normalization over hard versioning.
- Migration should be idempotent:
  - running multiple times must not reassign valid existing `overlayId`/`bubbleId`.
- Collision policy (same slide): preserve earliest occurrence, reassign later duplicates.
- Persist normalized output on next save.

---

## Manual QA checklist

### Phase 1 QA
- [ ] Open pre-overlay legacy project; app loads with no errors.
- [ ] Save legacy project; JSON now contains `bubbleDefinitions`, slide `overlays`, and `nextBubbleSeq`.
- [ ] Overlay with `bubbleId=B1` remains `B1` after close/reopen.
- [ ] Duplicate/missing bubble IDs in fixture are repaired once and remain stable afterward.
- [ ] Overlays visually appear in Story mode.
- [ ] Overlays visually appear in Boost mode.
- [ ] `bubbleId` badge visible on each overlay and readable on light/dark slides.

### Phase 2 QA
- [ ] In Story Edit mode, can add speech bubble and text overlays.
- [ ] New overlays get monotonic `bubbleId` values (`B1`, `B2`, ...), no reuse after delete.
- [ ] Drag and resize are smooth; geometry clamps to slide bounds.
- [ ] Text edit commits and persists after save/reload.
- [ ] Locked overlay cannot be moved/resized/edited.
- [ ] Z-order commands update visual stacking deterministically.
- [ ] Switching Story ↔ Boost preserves rendering and prevents accidental edits in Boost.
- [ ] Undo/redo behavior (if present in app) is verified or explicitly documented as out-of-scope.

### Regression QA
- [ ] Existing marker/highlighter drawing still works.
- [ ] Slide transitions unaffected by overlay layer.
- [ ] Import/open/save performance remains acceptable on multi-slide projects.