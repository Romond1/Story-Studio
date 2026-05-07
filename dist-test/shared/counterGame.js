"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCounterGameState = createCounterGameState;
exports.startRound = startRound;
exports.advanceRoundCounter = advanceRoundCounter;
exports.tickTimers = tickTimers;
exports.pauseTimers = pauseTimers;
exports.resumeTimers = resumeTimers;
exports.stopRound = stopRound;
exports.switchActivePlayer = switchActivePlayer;
exports.awardRoundWin = awardRoundWin;
exports.clearCelebration = clearCelebration;
exports.resetRound = resetRound;
function clampRoundLimit(roundLimit) {
    if (!Number.isFinite(roundLimit))
        return 20;
    return Math.max(1, Math.min(999, Math.round(roundLimit)));
}
function clampOpacity(value) {
    if (!Number.isFinite(value))
        return 0.9;
    return Math.max(0.2, Math.min(1, value));
}
function clampSeconds(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(60 * 60 * 24, Math.round(value)));
}
function normalizeTopic(topic) {
    return typeof topic === "string" ? topic.trim() : "";
}
function initialRoundValue(roundLimit, roundMode) {
    return roundMode === "down" ? roundLimit : 0;
}
function createTimerState(config) {
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
function resetPerQuestionTimer(timers) {
    return {
        ...timers,
        perQuestionRemainingSeconds: timers.perQuestionEnabled ? timers.perQuestionSeconds : 0,
        accumulatedMs: 0,
    };
}
function createCounterGameState(settings) {
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
function startRound(state, settings) {
    return {
        ...resetRound(state, settings),
        status: "playing",
    };
}
function advanceRoundCounter(state) {
    if (state.status !== "playing") {
        return state;
    }
    const nextRoundValue = state.roundMode === "down"
        ? Math.max(0, state.roundValue - 1)
        : Math.min(state.roundLimit, state.roundValue + 1);
    return {
        ...state,
        roundValue: nextRoundValue,
        timers: resetPerQuestionTimer(state.timers),
    };
}
function tickTimers(state, elapsedMs) {
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
function pauseTimers(state) {
    return {
        ...state,
        timers: {
            ...state.timers,
            paused: true,
        },
    };
}
function resumeTimers(state) {
    return {
        ...state,
        timers: {
            ...state.timers,
            paused: false,
        },
    };
}
function stopRound(state) {
    return {
        ...state,
        status: "stopped",
        timers: {
            ...state.timers,
            paused: true,
        },
    };
}
function switchActivePlayer(state) {
    return {
        ...state,
        activePlayer: state.activePlayer === "red" ? "blue" : "red",
    };
}
function awardRoundWin(state, winner) {
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
function clearCelebration(state) {
    return {
        ...state,
        celebration: {
            ...state.celebration,
            active: false,
            winner: null,
        },
    };
}
function resetRound(state, settings = {
    roundLimit: state.roundLimit,
    roundMode: state.roundMode,
    topic: state.topic,
    overlayOpacity: state.overlayOpacity,
    timers: state.timers,
}) {
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
