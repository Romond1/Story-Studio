export type CounterPlayer = "red" | "blue";
export type CounterRoundMode = "down" | "up";
export type CounterStatus = "setup" | "playing" | "stopped" | "finished";

export interface CounterTimerConfig {
  perQuestionEnabled: boolean;
  perQuestionSeconds: number;
  overallEnabled: boolean;
  overallSeconds: number;
}

export interface CounterTimerState extends CounterTimerConfig {
  perQuestionRemainingSeconds: number;
  overallRemainingSeconds: number;
  paused: boolean;
  accumulatedMs: number;
}

export interface CounterCelebrationState {
  active: boolean;
  winner: CounterPlayer | null;
  nonce: number;
}

export interface CounterRoundSettings {
  roundLimit: number;
  roundMode: CounterRoundMode;
  topic?: string;
  overlayOpacity?: number;
  timers?: CounterTimerConfig;
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

function clampRoundLimit(roundLimit: number): number {
  if (!Number.isFinite(roundLimit)) return 20;
  return Math.max(1, Math.min(999, Math.round(roundLimit)));
}

function clampOpacity(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.9;
  return Math.max(0.2, Math.min(1, value as number));
}

function clampSeconds(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(60 * 60 * 24, Math.round(value as number)));
}

function normalizeTopic(topic: string | undefined): string {
  return typeof topic === "string" ? topic.trim() : "";
}

function initialRoundValue(roundLimit: number, roundMode: CounterRoundMode): number {
  return roundMode === "down" ? roundLimit : 0;
}

function createTimerState(config?: CounterTimerConfig): CounterTimerState {
  const perQuestionEnabled = config?.perQuestionEnabled ?? false;
  const perQuestionSeconds = clampSeconds(config?.perQuestionSeconds);
  const overallEnabled = config?.overallEnabled ?? false;
  const overallSeconds = clampSeconds(config?.overallSeconds);

  return {
    perQuestionEnabled,
    perQuestionSeconds,
    perQuestionRemainingSeconds: perQuestionEnabled ? perQuestionSeconds : 0,
    overallEnabled,
    overallSeconds,
    overallRemainingSeconds: overallEnabled ? overallSeconds : 0,
    paused: false,
    accumulatedMs: 0,
  };
}

function resetPerQuestionTimer(timers: CounterTimerState): CounterTimerState {
  return {
    ...timers,
    perQuestionRemainingSeconds: timers.perQuestionEnabled ? timers.perQuestionSeconds : 0,
    accumulatedMs: 0,
  };
}

export function createCounterGameState(settings: CounterRoundSettings): CounterGameState {
  const roundLimit = clampRoundLimit(settings.roundLimit);

  return {
    roundLimit,
    roundMode: settings.roundMode,
    roundValue: initialRoundValue(roundLimit, settings.roundMode),
    activePlayer: "red",
    status: "setup",
    score: {
      red: 0,
      blue: 0,
    },
    topic: normalizeTopic(settings.topic),
    overlayOpacity: clampOpacity(settings.overlayOpacity),
    timers: createTimerState(settings.timers),
    celebration: {
      active: false,
      winner: null,
      nonce: 0,
    },
  };
}

export function startRound(state: CounterGameState, settings: CounterRoundSettings): CounterGameState {
  return {
    ...resetRound(state, settings),
    status: "playing",
  };
}

export function advanceRoundCounter(state: CounterGameState): CounterGameState {
  if (state.status !== "playing") {
    return state;
  }

  const nextRoundValue =
    state.roundMode === "down"
      ? Math.max(0, state.roundValue - 1)
      : Math.min(state.roundLimit, state.roundValue + 1);

  return {
    ...state,
    roundValue: nextRoundValue,
    timers: resetPerQuestionTimer(state.timers),
  };
}

export function tickTimers(state: CounterGameState, elapsedMs: number): CounterGameState {
  if (state.status !== "playing" || state.timers.paused) {
    return state;
  }

  const totalElapsedMs = state.timers.accumulatedMs + elapsedMs;
  const elapsedSeconds = Math.floor(totalElapsedMs / 1000);
  if (elapsedSeconds <= 0) {
    return {
      ...state,
      timers: {
        ...state.timers,
        accumulatedMs: totalElapsedMs,
      },
    };
  }

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
      accumulatedMs: totalElapsedMs % 1000,
    },
  };
}

export function pauseTimers(state: CounterGameState): CounterGameState {
  return {
    ...state,
    timers: {
      ...state.timers,
      paused: true,
    },
  };
}

export function resumeTimers(state: CounterGameState): CounterGameState {
  return {
    ...state,
    timers: {
      ...state.timers,
      paused: false,
    },
  };
}

export function stopRound(state: CounterGameState): CounterGameState {
  return {
    ...state,
    status: "stopped",
    timers: {
      ...state.timers,
      paused: true,
    },
  };
}

export function switchActivePlayer(state: CounterGameState): CounterGameState {
  return {
    ...state,
    activePlayer: state.activePlayer === "red" ? "blue" : "red",
  };
}

export function awardRoundWin(state: CounterGameState, winner: CounterPlayer): CounterGameState {
  return {
    ...state,
    status: "finished",
    score: {
      ...state.score,
      [winner]: state.score[winner] + 1,
    },
    celebration: {
      active: true,
      winner,
      nonce: state.celebration.nonce + 1,
    },
  };
}

export function clearCelebration(state: CounterGameState): CounterGameState {
  return {
    ...state,
    celebration: {
      ...state.celebration,
      active: false,
      winner: null,
    },
  };
}

export function resetRound(
  state: CounterGameState,
  settings: CounterRoundSettings = {
    roundLimit: state.roundLimit,
    roundMode: state.roundMode,
    topic: state.topic,
    overlayOpacity: state.overlayOpacity,
    timers: state.timers,
  },
): CounterGameState {
  const roundLimit = clampRoundLimit(settings.roundLimit);

  return {
    ...state,
    roundLimit,
    roundMode: settings.roundMode,
    roundValue: initialRoundValue(roundLimit, settings.roundMode),
    activePlayer: "red",
    status: "setup",
    topic: normalizeTopic(settings.topic),
    overlayOpacity: clampOpacity(settings.overlayOpacity),
    timers: createTimerState(settings.timers),
    celebration: {
      ...state.celebration,
      active: false,
      winner: null,
    },
  };
}
