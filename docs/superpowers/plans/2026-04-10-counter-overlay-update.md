# Counter Overlay Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the standalone counter overlay with stable OBS-safe layout, configurable timers, topic/opacity settings, collapsible control rail, and winner celebrations.

**Architecture:** Extend the shared counter state module so round logic, timer logic, topic settings, and celebration triggers stay testable outside React. Keep the standalone overlay as a separate Electron entry and update only its renderer/UI so Story Studio remains unaffected. Use CSS-driven motion and lightweight renderer effects for confetti and color washes.

**Tech Stack:** TypeScript, React 18, Electron, Vite, CSS, Node test runner

---

## File Structure

- Modify: `src/shared/counterGame.ts`
  - Expand state/types to cover topic, overlay opacity, round status, timer config/state, and winner celebration metadata.
- Modify: `src/shared/counterGame.test.ts`
  - Add failing tests for timer resets, pause/resume, stop round, topic/settings resets, and winner state.
- Modify: `tsconfig.test.json`
  - Keep shared logic test entry coverage aligned if new shared files are introduced.
- Modify: `src/counter/CounterApp.tsx`
  - Keep the outer layout stable, move round controls into the main stage, add topic/timers/opacity UI, and wire the collapsible right rail.
- Modify: `src/counter/counter.css`
  - Preserve frame geometry while adding fixed rail behavior, animations, hover polish, and celebration styling.
- Optional create: `src/counter/useCounterTicker.ts`
  - If needed, isolate timer ticking/animation timing from the main component.
- Optional create: `src/counter/ConfettiBurst.tsx`
  - If needed, keep celebration rendering focused and small.

### Task 1: Extend Shared Counter State

**Files:**
- Modify: `src/shared/counterGame.test.ts`
- Modify: `src/shared/counterGame.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("startRound applies topic, timers, and opacity settings", () => {
  const state = createCounterGameState({ roundLimit: 20, roundMode: "down" });

  const next = startRound(state, {
    roundLimit: 15,
    roundMode: "up",
    topic: "Animals",
    overlayOpacity: 0.82,
    timers: {
      perQuestionEnabled: true,
      perQuestionSeconds: 12,
      overallEnabled: true,
      overallSeconds: 90,
    },
  });

  assert.equal(next.status, "playing");
  assert.equal(next.topic, "Animals");
  assert.equal(next.roundValue, 0);
  assert.equal(next.overlayOpacity, 0.82);
  assert.equal(next.timers.perQuestionRemainingSeconds, 12);
  assert.equal(next.timers.overallRemainingSeconds, 90);
});

test("advanceRoundCounter resets only the per-question timer", () => {
  const playing = startRound(createCounterGameState({ roundLimit: 20, roundMode: "down" }), {
    roundLimit: 20,
    roundMode: "down",
    topic: "Food",
    overlayOpacity: 0.9,
    timers: {
      perQuestionEnabled: true,
      perQuestionSeconds: 10,
      overallEnabled: true,
      overallSeconds: 60,
    },
  });

  const ticked = tickTimers({ ...playing, timers: { ...playing.timers, perQuestionRemainingSeconds: 4, overallRemainingSeconds: 41 } }, 1000);
  const next = advanceRoundCounter(ticked);

  assert.equal(next.roundValue, 19);
  assert.equal(next.timers.perQuestionRemainingSeconds, 10);
  assert.equal(next.timers.overallRemainingSeconds, 40);
});

test("pauseTimers freezes enabled timers until resumeTimers is called", () => {
  const playing = startRound(createCounterGameState({ roundLimit: 20, roundMode: "down" }), {
    roundLimit: 20,
    roundMode: "down",
    topic: "Places",
    overlayOpacity: 0.88,
    timers: {
      perQuestionEnabled: true,
      perQuestionSeconds: 8,
      overallEnabled: false,
      overallSeconds: 0,
    },
  });

  const paused = pauseTimers(playing);
  const stillPaused = tickTimers(paused, 2000);
  const resumed = resumeTimers(stillPaused);
  const tickingAgain = tickTimers(resumed, 1000);

  assert.equal(stillPaused.timers.perQuestionRemainingSeconds, 8);
  assert.equal(tickingAgain.timers.perQuestionRemainingSeconds, 7);
});

test("stopRound halts timer activity without changing score", () => {
  const playing = startRound(createCounterGameState({ roundLimit: 20, roundMode: "down" }), {
    roundLimit: 20,
    roundMode: "down",
    topic: "Animals",
    overlayOpacity: 0.9,
    timers: {
      perQuestionEnabled: true,
      perQuestionSeconds: 15,
      overallEnabled: true,
      overallSeconds: 120,
    },
  });

  const stopped = stopRound(playing);
  const next = tickTimers(stopped, 5000);

  assert.equal(stopped.status, "stopped");
  assert.deepEqual(stopped.score, { red: 0, blue: 0 });
  assert.equal(next.timers.perQuestionRemainingSeconds, stopped.timers.perQuestionRemainingSeconds);
  assert.equal(next.timers.overallRemainingSeconds, stopped.timers.overallRemainingSeconds);
});

test("awardRoundWin increments score and marks celebration winner", () => {
  const playing = startRound(createCounterGameState({ roundLimit: 20, roundMode: "down" }), {
    roundLimit: 20,
    roundMode: "down",
    topic: "Food",
    overlayOpacity: 0.86,
    timers: {
      perQuestionEnabled: false,
      perQuestionSeconds: 0,
      overallEnabled: false,
      overallSeconds: 0,
    },
  });

  const next = awardRoundWin(playing, "blue");

  assert.equal(next.score.blue, 1);
  assert.equal(next.status, "finished");
  assert.equal(next.celebration.winner, "blue");
  assert.equal(next.celebration.active, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc -p tsconfig.test.json; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node --test dist-test/shared/counterGame.test.js`
Expected: FAIL with missing functions/properties such as `startRound`, `tickTimers`, `pauseTimers`, or timer state fields.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface CounterTimerState {
  perQuestionEnabled: boolean;
  perQuestionSeconds: number;
  perQuestionRemainingSeconds: number;
  overallEnabled: boolean;
  overallSeconds: number;
  overallRemainingSeconds: number;
  paused: boolean;
}

export interface CounterCelebrationState {
  active: boolean;
  winner: CounterPlayer | null;
  nonce: number;
}

export interface CounterGameState {
  roundLimit: number;
  roundMode: CounterRoundMode;
  roundValue: number;
  activePlayer: CounterPlayer;
  status: CounterStatus;
  score: Record<CounterPlayer, number>;
  topic: string;
  overlayOpacity: number;
  timers: CounterTimerState;
  celebration: CounterCelebrationState;
}

export function startRound(state: CounterGameState, settings: CounterRoundSettings): CounterGameState {
  const base = resetRound(state, settings);
  return {
    ...base,
    status: "playing",
  };
}

export function tickTimers(state: CounterGameState, elapsedMs: number): CounterGameState {
  if (state.status !== "playing" || state.timers.paused) return state;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds <= 0) return state;

  return {
    ...state,
    timers: {
      ...state.timers,
      perQuestionRemainingSeconds: state.timers.perQuestionEnabled
        ? Math.max(0, state.timers.perQuestionRemainingSeconds - elapsedSeconds)
        : 0,
      overallRemainingSeconds: state.timers.overallEnabled
        ? Math.max(0, state.timers.overallRemainingSeconds - elapsedSeconds)
        : 0,
    },
  };
}

export function pauseTimers(state: CounterGameState): CounterGameState {
  return { ...state, timers: { ...state.timers, paused: true } };
}

export function resumeTimers(state: CounterGameState): CounterGameState {
  return { ...state, timers: { ...state.timers, paused: false } };
}

export function stopRound(state: CounterGameState): CounterGameState {
  return { ...state, status: "stopped", timers: { ...state.timers, paused: true } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc -p tsconfig.test.json; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node --test dist-test/shared/counterGame.test.js`
Expected: PASS for all shared counter tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/counterGame.ts src/shared/counterGame.test.ts tsconfig.test.json
git commit -m "feat: extend counter overlay game state"
```

### Task 2: Add Stable Overlay UI and Collapsible Rail

**Files:**
- Modify: `src/counter/CounterApp.tsx`
- Modify: `src/counter/counter.css`
- Optional create: `src/counter/useCounterTicker.ts`

- [ ] **Step 1: Write the failing UI wiring expectation in code comments/tests if feasible**

```ts
// Target behaviors to wire:
// - Right rail always exists and collapses horizontally
// - Start/Stop/Pause/Resume buttons stay on the main stage
// - Topic, timers, and opacity are editable from the rail
// - Layout class names do not depend on round start in a way that removes regions
```

- [ ] **Step 2: Run existing build to capture baseline**

Run: `npm run build:renderer`
Expected: PASS before UI changes so any new failure is attributable to this task.

- [ ] **Step 3: Write minimal implementation**

```tsx
const [isRailCollapsed, setIsRailCollapsed] = useState(false);
const [settings, setSettings] = useState({
  topic: "Animals",
  roundLimitInput: "20",
  roundMode: "down" as CounterRoundMode,
  overlayOpacity: 0.9,
  perQuestionEnabled: true,
  perQuestionSeconds: "10",
  overallEnabled: false,
  overallSeconds: "120",
});

<div className="counter-layout counter-layout--stable">
  <section className="counter-stage">
    <div className="topic-chip">{gameState.topic || "Choose a topic"}</div>
    <div className="timer-row">
      <div className="timer-pill">{formatSeconds(gameState.timers.perQuestionRemainingSeconds)}</div>
      <div className="timer-pill">{formatSeconds(gameState.timers.overallRemainingSeconds)}</div>
    </div>
    <div className="action-row">
      <button onClick={handleStartRound}>Start Round</button>
      <button onClick={handleStopRound}>Stop Round</button>
      <button onClick={handlePauseTimers}>Pause Timers</button>
      <button onClick={handleResumeTimers}>Resume Timers</button>
    </div>
  </section>
  <aside className={`control-rail ${isRailCollapsed ? "is-collapsed" : ""}`}>
    <button className="rail-toggle" onClick={() => setIsRailCollapsed((value) => !value)}>→</button>
  </aside>
</div>
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run build:renderer`
Expected: PASS with the updated standalone counter renderer.

- [ ] **Step 5: Commit**

```bash
git add src/counter/CounterApp.tsx src/counter/counter.css src/counter/useCounterTicker.ts
git commit -m "feat: stabilize counter overlay layout"
```

### Task 3: Add Celebrations and Visual Polish

**Files:**
- Modify: `src/counter/CounterApp.tsx`
- Modify: `src/counter/counter.css`
- Optional create: `src/counter/ConfettiBurst.tsx`

- [ ] **Step 1: Write the failing visual state expectations in logic/UI comments**

```ts
// Winner celebration requirements:
// - red/blue confetti burst keyed from celebration nonce
// - temporary color wash on the main panel
// - no geometry/layout changes during celebration
```

- [ ] **Step 2: Run renderer build before celebration changes**

Run: `npm run build:renderer`
Expected: PASS before this visual step starts.

- [ ] **Step 3: Write minimal implementation**

```tsx
useEffect(() => {
  if (!gameState.celebration.active) return;
  const timeoutId = window.setTimeout(() => {
    setGameState((current) => clearCelebration(current));
  }, 2200);
  return () => window.clearTimeout(timeoutId);
}, [gameState.celebration.nonce, gameState.celebration.active]);

<section
  className={[
    "counter-card",
    gameState.celebration.active ? `winner-flash winner-flash--${gameState.celebration.winner}` : "",
  ].join(" ")}
>
  <ConfettiBurst active={gameState.celebration.active} winner={gameState.celebration.winner} />
</section>
```

```css
.winner-flash--red {
  animation: winnerWashRed 2.2s ease forwards;
}

.winner-flash--blue {
  animation: winnerWashBlue 2.2s ease forwards;
}

.ghost-btn:hover,
.winner-btn:hover,
.start-btn:hover {
  transform: translateY(-1px);
  transition: transform 260ms ease, box-shadow 360ms ease, background-color 360ms ease;
}
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run build:renderer`
Expected: PASS with celebration styles/components included.

- [ ] **Step 5: Commit**

```bash
git add src/counter/CounterApp.tsx src/counter/counter.css src/counter/ConfettiBurst.tsx
git commit -m "feat: add counter overlay celebrations"
```

### Task 4: End-to-End Verification

**Files:**
- Modify: `src/shared/counterGame.test.ts`
- Modify: `src/counter/CounterApp.tsx`
- Modify: `src/counter/counter.css`

- [ ] **Step 1: Re-run shared logic tests**

Run: `npm run test:counter`
Expected: PASS with timer and winner state coverage included.

- [ ] **Step 2: Re-run build verification**

Run: `npm run build:main`
Expected: PASS

- [ ] **Step 3: Re-run renderer verification**

Run: `npm run build:renderer`
Expected: PASS

- [ ] **Step 4: Smoke-run the standalone overlay**

Run: `npm run dev:counter`
Expected: The standalone Electron overlay opens with stable layout, a collapsible right rail, visible topic/timers, and manual round controls.

- [ ] **Step 5: Commit**

```bash
git add src/shared/counterGame.ts src/shared/counterGame.test.ts src/counter/CounterApp.tsx src/counter/counter.css docs/superpowers/specs/2026-04-10-counter-overlay-design.md docs/superpowers/plans/2026-04-10-counter-overlay-update.md
git commit -m "feat: upgrade standalone counter overlay"
```
