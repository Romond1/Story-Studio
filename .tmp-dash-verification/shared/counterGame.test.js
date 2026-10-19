"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const counterGame_1 = require("./counterGame");
(0, node_test_1.default)("createCounterGameState initializes setup state with default topic, timers, and opacity", () => {
    const state = (0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" });
    strict_1.default.equal(state.roundLimit, 20);
    strict_1.default.equal(state.roundMode, "down");
    strict_1.default.equal(state.roundValue, 20);
    strict_1.default.equal(state.activePlayer, "red");
    strict_1.default.equal(state.status, "setup");
    strict_1.default.equal(state.topic, "");
    strict_1.default.equal(state.overlayOpacity, 0.9);
    strict_1.default.deepEqual(state.score, { red: 0, blue: 0 });
    strict_1.default.deepEqual(state.timers, {
        perQuestionEnabled: false,
        perQuestionSeconds: 0,
        perQuestionRemainingSeconds: 0,
        overallEnabled: false,
        overallSeconds: 0,
        overallRemainingSeconds: 0,
        paused: false,
        accumulatedMs: 0,
    });
    strict_1.default.deepEqual(state.celebration, {
        active: false,
        winner: null,
        nonce: 0,
    });
});
(0, node_test_1.default)("startRound applies topic, timers, and opacity settings", () => {
    const state = (0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" });
    const next = (0, counterGame_1.startRound)(state, {
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
    strict_1.default.equal(next.status, "playing");
    strict_1.default.equal(next.topic, "Animals");
    strict_1.default.equal(next.roundLimit, 15);
    strict_1.default.equal(next.roundMode, "up");
    strict_1.default.equal(next.roundValue, 0);
    strict_1.default.equal(next.overlayOpacity, 0.82);
    strict_1.default.equal(next.timers.perQuestionEnabled, true);
    strict_1.default.equal(next.timers.perQuestionRemainingSeconds, 12);
    strict_1.default.equal(next.timers.overallRemainingSeconds, 90);
});
(0, node_test_1.default)("advanceRoundCounter counts down and resets only the per-question timer", () => {
    const playing = (0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" }), {
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
    const ticked = (0, counterGame_1.tickTimers)({
        ...playing,
        timers: {
            ...playing.timers,
            perQuestionRemainingSeconds: 4,
            overallRemainingSeconds: 41,
        },
    }, 1000);
    const next = (0, counterGame_1.advanceRoundCounter)(ticked);
    strict_1.default.equal(next.roundValue, 19);
    strict_1.default.equal(next.timers.perQuestionRemainingSeconds, 10);
    strict_1.default.equal(next.timers.overallRemainingSeconds, 40);
});
(0, node_test_1.default)("advanceRoundCounter counts up to the configured limit and then stops", () => {
    let state = (0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 2, roundMode: "up" }), {
        roundLimit: 2,
        roundMode: "up",
        topic: "Places",
        overlayOpacity: 0.9,
        timers: {
            perQuestionEnabled: false,
            perQuestionSeconds: 0,
            overallEnabled: false,
            overallSeconds: 0,
        },
    });
    state = (0, counterGame_1.advanceRoundCounter)(state);
    strict_1.default.equal(state.roundValue, 1);
    state = (0, counterGame_1.advanceRoundCounter)(state);
    strict_1.default.equal(state.roundValue, 2);
    state = (0, counterGame_1.advanceRoundCounter)(state);
    strict_1.default.equal(state.roundValue, 2);
});
(0, node_test_1.default)("pauseTimers freezes enabled timers until resumeTimers is called", () => {
    const playing = (0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" }), {
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
    const paused = (0, counterGame_1.pauseTimers)(playing);
    const stillPaused = (0, counterGame_1.tickTimers)(paused, 2000);
    const resumed = (0, counterGame_1.resumeTimers)(stillPaused);
    const tickingAgain = (0, counterGame_1.tickTimers)(resumed, 1000);
    strict_1.default.equal(stillPaused.timers.perQuestionRemainingSeconds, 8);
    strict_1.default.equal(tickingAgain.timers.perQuestionRemainingSeconds, 7);
});
(0, node_test_1.default)("tickTimers accumulates sub-second intervals into whole-second countdown changes", () => {
    let state = (0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" }), {
        roundLimit: 20,
        roundMode: "down",
        topic: "Animals",
        overlayOpacity: 0.9,
        timers: {
            perQuestionEnabled: true,
            perQuestionSeconds: 5,
            overallEnabled: true,
            overallSeconds: 9,
        },
    });
    state = (0, counterGame_1.tickTimers)(state, 250);
    state = (0, counterGame_1.tickTimers)(state, 250);
    state = (0, counterGame_1.tickTimers)(state, 250);
    strict_1.default.equal(state.timers.perQuestionRemainingSeconds, 5);
    strict_1.default.equal(state.timers.overallRemainingSeconds, 9);
    state = (0, counterGame_1.tickTimers)(state, 250);
    strict_1.default.equal(state.timers.perQuestionRemainingSeconds, 4);
    strict_1.default.equal(state.timers.overallRemainingSeconds, 8);
});
(0, node_test_1.default)("stopRound halts timer activity without changing score", () => {
    const playing = (0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" }), {
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
    const stopped = (0, counterGame_1.stopRound)(playing);
    const next = (0, counterGame_1.tickTimers)(stopped, 5000);
    strict_1.default.equal(stopped.status, "stopped");
    strict_1.default.deepEqual(stopped.score, { red: 0, blue: 0 });
    strict_1.default.equal(next.timers.perQuestionRemainingSeconds, stopped.timers.perQuestionRemainingSeconds);
    strict_1.default.equal(next.timers.overallRemainingSeconds, stopped.timers.overallRemainingSeconds);
});
(0, node_test_1.default)("switchActivePlayer swaps between red and blue", () => {
    const state = (0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" });
    strict_1.default.equal((0, counterGame_1.switchActivePlayer)(state).activePlayer, "blue");
    strict_1.default.equal((0, counterGame_1.switchActivePlayer)({ ...state, activePlayer: "blue" }).activePlayer, "red");
});
(0, node_test_1.default)("awardRoundWin increments score and marks celebration winner", () => {
    const playing = (0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" }), {
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
    const next = (0, counterGame_1.awardRoundWin)(playing, "blue");
    strict_1.default.equal(next.score.blue, 1);
    strict_1.default.equal(next.status, "finished");
    strict_1.default.equal(next.celebration.winner, "blue");
    strict_1.default.equal(next.celebration.active, true);
});
(0, node_test_1.default)("clearCelebration keeps score while removing active winner feedback", () => {
    const finished = (0, counterGame_1.awardRoundWin)((0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 20, roundMode: "down" }), {
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
    }), "red");
    const next = (0, counterGame_1.clearCelebration)(finished);
    strict_1.default.equal(next.score.red, 1);
    strict_1.default.equal(next.celebration.active, false);
    strict_1.default.equal(next.celebration.winner, null);
});
(0, node_test_1.default)("resetRound preserves scores and applies current settings", () => {
    const awarded = (0, counterGame_1.awardRoundWin)((0, counterGame_1.startRound)((0, counterGame_1.createCounterGameState)({ roundLimit: 15, roundMode: "up" }), {
        roundLimit: 15,
        roundMode: "up",
        topic: "Objects",
        overlayOpacity: 0.77,
        timers: {
            perQuestionEnabled: true,
            perQuestionSeconds: 14,
            overallEnabled: true,
            overallSeconds: 95,
        },
    }), "red");
    const next = (0, counterGame_1.resetRound)(awarded, {
        roundLimit: 10,
        roundMode: "down",
        topic: "Animals",
        overlayOpacity: 0.65,
        timers: {
            perQuestionEnabled: false,
            perQuestionSeconds: 8,
            overallEnabled: true,
            overallSeconds: 30,
        },
    });
    strict_1.default.deepEqual(next.score, { red: 1, blue: 0 });
    strict_1.default.equal(next.roundLimit, 10);
    strict_1.default.equal(next.roundMode, "down");
    strict_1.default.equal(next.roundValue, 10);
    strict_1.default.equal(next.activePlayer, "red");
    strict_1.default.equal(next.status, "setup");
    strict_1.default.equal(next.topic, "Animals");
    strict_1.default.equal(next.overlayOpacity, 0.65);
    strict_1.default.equal(next.timers.perQuestionEnabled, false);
    strict_1.default.equal(next.timers.perQuestionRemainingSeconds, 0);
    strict_1.default.equal(next.timers.overallRemainingSeconds, 30);
});
