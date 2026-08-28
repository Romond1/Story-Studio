# Unified Stage Drawing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crash-prone break drawing path with the modern live-stroke pipeline, render drawing above every presentation layer, and toggle draw mode with `Ctrl+D`.

**Architecture:** Add small shared lifecycle functions that can be tested without a browser, then move live canvas behavior into a single `StageDrawingOverlay` component. Normal slides mount that component as the last child of `.stage`; breaks mount the same component as the last child of `ZoomPanWrapper`. Both placements participate in an isolated stage stacking context above media, cards, bubbles, rewards, and movement effects while editor chrome remains above or outside the canvas.

**Tech Stack:** React 18, TypeScript 5.7, HTML Canvas 2D, Electron 34, Node test runner

---

## File Map

- Create `src/shared/drawingLifecycle.ts`: pure animation ownership, completed-stroke, and shortcut predicates.
- Create `src/shared/drawingLifecycle.test.ts`: regression tests for leaked frames, click-only strokes, and `Ctrl+D` filtering.
- Create `src/renderer/drawing/StageDrawingOverlay.tsx`: the one live marker/highlighter renderer used by slides and breaks.
- Modify `src/renderer/App.tsx`: remove both embedded canvas implementations, mount the shared overlay, and register `Ctrl+D`.
- Modify `src/renderer/styles.css`: isolate stage stacking, position the shared canvas at the top of presentation content, and keep break editor chrome above it.
- Modify `tsconfig.test.json`: compile the new shared test and source files.

### Task 1: Add Testable Drawing Lifecycle Rules

**Files:**
- Create: `src/shared/drawingLifecycle.ts`
- Create: `src/shared/drawingLifecycle.test.ts`
- Modify: `tsconfig.test.json`

- [ ] **Step 1: Add the failing lifecycle and shortcut tests**

Create `src/shared/drawingLifecycle.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { MarkerStroke } from "./types";
import {
  appendCompletedMarkerStroke,
  isDrawModeShortcut,
  startManagedAnimationLoop,
} from "./drawingLifecycle";

test("managed animation cleanup cancels the latest scheduled frame", () => {
  let nextId = 0;
  const callbacks = new Map<number, (time: number) => void>();
  const cancelled: number[] = [];
  const scheduler = {
    request(callback: (time: number) => void) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id: number) {
      cancelled.push(id);
      callbacks.delete(id);
    },
  };

  const stop = startManagedAnimationLoop(scheduler, () => undefined);
  callbacks.get(1)?.(16);
  assert.equal(callbacks.has(2), true);

  stop();
  assert.deepEqual(cancelled, [2]);
  assert.equal(callbacks.size, 0);
});

test("managed animation callback cannot reschedule after cleanup", () => {
  let scheduled: ((time: number) => void) | null = null;
  let requests = 0;
  const scheduler = {
    request(callback: (time: number) => void) {
      requests += 1;
      scheduled = callback;
      return requests;
    },
    cancel() {},
  };
  const stop = startManagedAnimationLoop(scheduler, () => stop());
  scheduled?.(16);
  assert.equal(requests, 1);
});

test("completed marker is committed once and click-only marker is ignored", () => {
  const base: MarkerStroke[] = [];
  const click: MarkerStroke = {
    id: "click",
    color: "#fff",
    size: 12,
    opacity: 1,
    rainbow: false,
    points: [{ x: 0.1, y: 0.1, t: 1 }],
  };
  const line: MarkerStroke = {
    ...click,
    id: "line",
    points: [...click.points, { x: 0.2, y: 0.2, t: 2 }],
  };
  assert.strictEqual(appendCompletedMarkerStroke(base, click), base);
  assert.deepEqual(appendCompletedMarkerStroke(base, line), [line]);
});

test("Ctrl+D toggles drawing only outside editable controls", () => {
  const base = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, key: "d" };
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "DIV" } }), true);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "INPUT" } }), false);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "TEXTAREA" } }), false);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "SELECT" } }), false);
  assert.equal(isDrawModeShortcut({ ...base, target: { tagName: "DIV", isContentEditable: true } }), false);
  assert.equal(isDrawModeShortcut({ ...base, repeat: true, target: null }), false);
  assert.equal(isDrawModeShortcut({ ...base, ctrlKey: false, target: null }), false);
});
```

Add both new files to the `include` array in `tsconfig.test.json`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsc -p tsconfig.test.json
```

Expected: compilation fails because `./drawingLifecycle` does not exist.

- [ ] **Step 3: Implement the lifecycle helpers**

Create `src/shared/drawingLifecycle.ts`:

```ts
import type { MarkerStroke } from "./types";
import { isEditableKeyTarget } from "./movement";

export interface AnimationScheduler {
  request(callback: (time: number) => void): number;
  cancel(id: number): void;
}

export function startManagedAnimationLoop(
  scheduler: AnimationScheduler,
  onFrame: (time: number) => void,
): () => void {
  let active = true;
  let frameId = 0;
  const frame = (time: number) => {
    if (!active) return;
    onFrame(time);
    if (active) frameId = scheduler.request(frame);
  };
  frameId = scheduler.request(frame);
  return () => {
    if (!active) return;
    active = false;
    scheduler.cancel(frameId);
  };
}

export function appendCompletedMarkerStroke(
  persisted: MarkerStroke[],
  active: MarkerStroke,
): MarkerStroke[] {
  return active.points.length > 1 ? [...persisted, active] : persisted;
}

export function isDrawModeShortcut(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  key: string;
  target: { tagName?: string; isContentEditable?: boolean } | null;
}): boolean {
  return event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && !event.shiftKey
    && !event.repeat
    && event.key.toLowerCase() === "d"
    && !isEditableKeyTarget(event.target);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npx tsc -p tsconfig.test.json; node --test dist-test/shared/drawingLifecycle.test.js
```

Expected: four tests pass and the process exits 0.

- [ ] **Step 5: Commit the lifecycle guardrails**

```powershell
git add src/shared/drawingLifecycle.ts src/shared/drawingLifecycle.test.ts tsconfig.test.json
git commit -m "test: guard drawing loop lifecycle"
```

### Task 2: Build the Shared Live Stage Drawing Overlay

**Files:**
- Create: `src/renderer/drawing/StageDrawingOverlay.tsx`

- [ ] **Step 1: Create the shared component using the tested lifecycle API**

Create `src/renderer/drawing/StageDrawingOverlay.tsx`. Export `DrawSettings`, `HighlighterStroke`, and `ViewportState` so `App.tsx` no longer declares duplicate private types. The component props must be:

```ts
export interface StageDrawingOverlayProps {
  targetId: string;
  settings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange(strokes: MarkerStroke[]): void;
  clearSignal: number;
  viewportRef: MutableRefObject<ViewportState>;
  contentWidth?: number;
  contentHeight?: number;
}
```

Implement these exact lifecycle rules inside the component:

```ts
const canvasRef = useRef<HTMLCanvasElement | null>(null);
const settingsRef = useRef(settings);
const markersRef = useRef(markerStrokes);
const onMarkersChangeRef = useRef(onMarkerStrokesChange);
const activeMarkerRef = useRef<MarkerStroke | null>(null);
const activeHighlighterRef = useRef<HighlighterStroke | null>(null);
const highlightersRef = useRef<HighlighterStroke[]>([]);
const isDrawingRef = useRef(false);

useEffect(() => { settingsRef.current = settings; }, [settings]);
useEffect(() => { markersRef.current = markerStrokes; }, [markerStrokes]);
useEffect(() => { onMarkersChangeRef.current = onMarkerStrokesChange; }, [onMarkerStrokesChange]);
useEffect(() => {
  isDrawingRef.current = false;
  activeMarkerRef.current = null;
  activeHighlighterRef.current = null;
  highlightersRef.current = [];
}, [targetId, clearSignal]);
```

Use the modern pixel-space renderer: translate by `pan`, scale once by `zoom`, draw each normalized point as `point.x * contentWidth` and `point.y * contentHeight`, and set `ctx.lineWidth = stroke.size`. Render persisted markers, the active marker, completed fading highlighters, and the active highlighter every frame. Filter expired highlighters in the ref without calling React state setters.

Start exactly one loop:

```ts
useEffect(() => startManagedAnimationLoop(
  {
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (id) => window.cancelAnimationFrame(id),
  },
  (now) => drawFrame(now),
), []);
```

On pointer-down, create the selected stroke immediately. On pointer-move, replace the active ref with a copy containing the appended point so the next frame displays it. On pointer-up, append a marker with `appendCompletedMarkerStroke(markersRef.current, stroke)` and call `onMarkersChangeRef.current(next)` only if the returned array changed. Move a completed highlighter into `highlightersRef.current` so its live tail keeps fading. Return one canvas:

```tsx
return (
  <canvas
    ref={canvasRef}
    className={settings.drawMode ? "stage-drawing-overlay active" : "stage-drawing-overlay"}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={finishStroke}
    onPointerCancel={finishStroke}
    onPointerLeave={finishStroke}
  />
);
```

- [ ] **Step 2: Verify the unused component compiles**

Run:

```powershell
npm run build:renderer
```

Expected: Vite production build succeeds with no TypeScript or bundling errors.

- [ ] **Step 3: Commit the shared renderer**

```powershell
git add src/renderer/drawing/StageDrawingOverlay.tsx
git commit -m "feat: add shared live drawing overlay"
```

### Task 3: Replace Break Drawing with the Shared Renderer

**Files:**
- Modify: `src/renderer/App.tsx:7155-7610`

- [ ] **Step 1: Import the shared types and component**

Add:

```ts
import {
  StageDrawingOverlay,
  type DrawSettings,
  type ViewportState,
} from "./drawing/StageDrawingOverlay";
```

Delete the local `ViewportState`, `DrawSettings`, and `HighlighterStroke` declarations while retaining `DrawTool` and `DEFAULT_DRAW_SETTINGS`.

- [ ] **Step 2: Remove the legacy break drawing path**

From `ZoomPanWrapper`, delete `canvasRef`, local highlighter state, active stroke refs, `isDrawingRef`, `getContentPoint`, the drawing branches in the mouse listeners, and the complete legacy `// Drawing Loop` effect. Keep zoom, pan, middle-click panning, children, viewport persistence, and the existing marker-stroke props.

Add a stable break viewport ref and synchronize it on every render:

```ts
const drawingViewportRef = useRef<ViewportState>({ zoom, pan });
drawingViewportRef.current = { zoom, pan };
```

Render the shared canvas after the transformed content:

```tsx
<div style={contentStyle}>{children}</div>
<StageDrawingOverlay
  targetId={`break:${targetId}`}
  settings={drawSettings}
  markerStrokes={markerStrokes}
  onMarkerStrokesChange={onMarkerStrokesChange}
  clearSignal={clearSignal}
  viewportRef={drawingViewportRef}
  contentWidth={contentWidth}
  contentHeight={contentHeight}
/>
```

Add `targetId: string` to `ZoomPanWrapper` props and pass `selectedSection.id` at the break call site.

- [ ] **Step 3: Verify the break path compiles and lifecycle tests remain green**

Run:

```powershell
npx tsc -p tsconfig.test.json; node --test dist-test/shared/drawingLifecycle.test.js; npm run build:renderer
```

Expected: four focused tests pass and the renderer build exits 0.

- [ ] **Step 4: Commit the break replacement**

```powershell
git add src/renderer/App.tsx
git commit -m "fix: replace legacy break drawing loop"
```

### Task 4: Move Normal Drawing Above Every Presentation Layer

**Files:**
- Modify: `src/renderer/App.tsx:5900-6090, 7611-8560`
- Modify: `src/renderer/styles.css:404-443, 576-595, 1329-1335`

- [ ] **Step 1: Remove drawing ownership from `MediaView`**

Delete `canvasRef`, highlighter and active-stroke refs, drawing clear effect, `getContentPoint`, the canvas drawing effect, `handleDrawStart`, `handleDrawMove`, `handleDrawEnd`, and the `<canvas>` from `MediaView`. Remove its `markerStrokes`, `onMarkerStrokesChange`, and `clearSignal` props. Keep `drawSettings` because bubble and trim editing still use it to disable pointer interaction while drawing.

Remove those three props from incoming and outgoing `MediaView` call sites.

- [ ] **Step 2: Mount the shared overlay last in `.stage`**

After `BCardInstanceLayer` and before the closing `.stage` tag, add:

```tsx
{currentSlide && (
  <StageDrawingOverlay
    targetId={`slide:${currentSlide.id}`}
    settings={drawSettings}
    markerStrokes={currentSlide.markerStrokes ?? []}
    onMarkerStrokesChange={updateCurrentSlideMarkerStrokes}
    clearSignal={drawClearSignal}
    viewportRef={viewportRef}
  />
)}
```

This placement is later than media bubbles, ACards, and BCards. The canvas z-index will also exceed outer presentation effects in the same isolated `.stage-wrap` stacking context.

- [ ] **Step 3: Define explicit stage stacking**

Replace the old drawing overlay rules with:

```css
.stage-wrap {
  isolation: isolate;
}

.stage-drawing-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 20000;
  pointer-events: none;
  touch-action: none;
}

.stage-drawing-overlay.active {
  pointer-events: auto;
  cursor: crosshair;
}
```

Keep `.break-editor-panel` and the break Edit button outside drawing input by changing their stage z-index from `60` to `21000`. Do not raise media, bubble, ACard, BCard, relic, movement, spark, or final badge layers above `20000`.

- [ ] **Step 4: Run renderer and full unit verification**

Run:

```powershell
npm test; npm run build:renderer
```

Expected: all Node tests pass and the Vite build succeeds.

- [ ] **Step 5: Commit topmost unified drawing**

```powershell
git add src/renderer/App.tsx src/renderer/styles.css
git commit -m "feat: draw above all stage content"
```

### Task 5: Add the Global Ctrl+D Toggle

**Files:**
- Modify: `src/renderer/App.tsx:930-1000, 2330-2440`

- [ ] **Step 1: Import the tested predicate**

```ts
import { isDrawModeShortcut } from "../shared/drawingLifecycle";
```

- [ ] **Step 2: Register one global shortcut effect**

Near the existing global key effects, add:

```ts
useEffect(() => {
  const handleDrawShortcut = (event: KeyboardEvent) => {
    if (!isDrawModeShortcut({
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      repeat: event.repeat,
      key: event.key,
      target: event.target instanceof HTMLElement ? event.target : null,
    })) return;

    event.preventDefault();
    setDrawSettings((previous) => ({
      ...previous,
      drawMode: !previous.drawMode,
    }));
  };

  window.addEventListener("keydown", handleDrawShortcut);
  return () => window.removeEventListener("keydown", handleDrawShortcut);
}, []);
```

Do not alter the existing plain `D`/ArrowRight navigation handler.

- [ ] **Step 3: Verify shortcut tests, full tests, and renderer build**

Run:

```powershell
npm test; npm run build:renderer
```

Expected: every test passes and the renderer production build succeeds.

- [ ] **Step 4: Commit the shortcut**

```powershell
git add src/renderer/App.tsx
git commit -m "feat: toggle drawing with control d"
```

### Task 6: Complete Crash and Behavior Verification

**Files:**
- Verify only; modify files only if a failing check reveals a requirement defect, using a new RED/GREEN cycle.

- [ ] **Step 1: Run the complete automated suite**

```powershell
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run both production compilation paths**

```powershell
npm run build:renderer
npm run build:main
```

Expected: both commands exit 0.

- [ ] **Step 3: Inspect source for orphan drawing loops and legacy canvases**

```powershell
rg -n "Drawing Loop|requestAnimationFrame\(drawFrame\)|drawing-overlay" src/renderer/App.tsx src/renderer/drawing src/renderer/styles.css
```

Expected: no legacy break drawing loop, no `MediaView` drawing canvas, and only the managed shared overlay implementation remains.

- [ ] **Step 4: Perform the manual regression sequence in the running Electron app**

Run `npm run dev`, then verify:

1. Enter a break and press `Ctrl+D`.
2. Click once with marker selected; the window remains responsive and does not turn black.
3. Draw repeated marker strokes; lines follow the pointer smoothly.
4. Select highlighter, rainbow, sparkle, and a fade duration; the live tail appears during pointer movement and fades after release.
5. Draw over break title, questions, timer, images, bubbles, ACards, and BCards.
6. Repeat on a normal slide and draw over bubbles, cards, relic, movement, spark, and final badge presentation layers.
7. Press `Ctrl+D` again; drawing turns off.
8. Press plain `D`; navigation still advances.
9. Focus an input, textarea, select, and content-editable bubble; `Ctrl+D` does not toggle drawing.
10. Enter and leave breaks repeatedly while drawing; responsiveness remains stable.

- [ ] **Step 5: Review the final diff against the approved specification**

```powershell
git diff HEAD~4 --check
git status --short
```

Expected: no whitespace errors and no unintended files.

