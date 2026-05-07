import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceRoundCounter,
  awardRoundWin,
  clearCelebration,
  createCounterGameState,
  pauseTimers,
  resetRound,
  resumeTimers,
  startRound,
  stopRound,
  switchActivePlayer,
  tickTimers,
} from "./counterGame";

test("createCounterGameState initializes setup state with default topic, timers, and opacity", () => {
  const state = createCounterGameState({ roundLimit: 20, roundMode: "down" });

  assert.equal(state.roundLimit, 20);
  assert.equal(state.roundMode, "down");
  assert.equal(state.roundValue, 20);
  assert.equal(state.activePlayer, "red");
  assert.equal(state.status, "setup");
  assert.equal(state.topic, "");
  assert.equal(state.overlayOpacity, 0.9);
  assert.deepEqual(state.score, { red: 0, blue: 0 });
  assert.deepEqual(state.timers, {
    perQuestionEnabled: false,
    perQuestionSeconds: 0,
    perQuestionRemainingSeconds: 0,
    overallEnabled: false,
    overallSeconds: 0,
    overallRemainingSeconds: 0,
    paused: false,
    accumulatedMs: 0,
  });
  assert.deepEqual(state.celebration, {
    active: false,
    winner: null,
    nonce: 0,
  });
});

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
  assert.equal(next.roundLimit, 15);
  assert.equal(next.roundMode, "up");
  assert.equal(next.roundValue, 0);
  assert.equal(next.overlayOpacity, 0.82);
  assert.equal(next.timers.perQuestionEnabled, true);
  assert.equal(next.timers.perQuestionRemainingSeconds, 12);
  assert.equal(next.timers.overallRemainingSeconds, 90);
});

test("advanceRoundCounter counts down and resets only the per-question timer", () => {
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

  const ticked = tickTimers(
    {
      ...playing,
      timers: {
        ...playing.timers,
        perQuestionRemainingSeconds: 4,
        overallRemainingSeconds: 41,
      },
    },
    1000,
  );
  const next = advanceRoundCounter(ticked);

  assert.equal(next.roundValue, 19);
  assert.equal(next.timers.perQuestionRemainingSeconds, 10);
  assert.equal(next.timers.overallRemainingSeconds, 40);
});

test("advanceRoundCounter counts up to the configured limit and then stops", () => {
  let state = startRound(createCounterGameState({ roundLimit: 2, roundMode: "up" }), {
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

  state = advanceRoundCounter(state);
  assert.equal(state.roundValue, 1);

  state = advanceRoundCounter(state);
  assert.equal(state.roundValue, 2);

  state = advanceRoundCounter(state);
  assert.equal(state.roundValue, 2);
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

test("tickTimers accumulates sub-second intervals into whole-second countdown changes", () => {
  let state = startRound(createCounterGameState({ roundLimit: 20, roundMode: "down" }), {
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

  state = tickTimers(state, 250);
  state = tickTimers(state, 250);
  state = tickTimers(state, 250);
  assert.equal(state.timers.perQuestionRemainingSeconds, 5);
  assert.equal(state.timers.overallRemainingSeconds, 9);

  state = tickTimers(state, 250);
  assert.equal(state.timers.perQuestionRemainingSeconds, 4);
  assert.equal(state.timers.overallRemainingSeconds, 8);
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

test("switchActivePlayer swaps between red and blue", () => {
  const state = createCounterGameState({ roundLimit: 20, roundMode: "down" });

  assert.equal(switchActivePlayer(state).activePlayer, "blue");
  assert.equal(switchActivePlayer({ ...state, activePlayer: "blue" }).activePlayer, "red");
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

test("clearCelebration keeps score while removing active winner feedback", () => {
  const finished = awardRoundWin(
    startRound(createCounterGameState({ roundLimit: 20, roundMode: "down" }), {
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
    }),
    "red",
  );

  const next = clearCelebration(finished);

  assert.equal(next.score.red, 1);
  assert.equal(next.celebration.active, false);
  assert.equal(next.celebration.winner, null);
});

test("resetRound preserves scores and applies current settings", () => {
  const awarded = awardRoundWin(
    startRound(createCounterGameState({ roundLimit: 15, roundMode: "up" }), {
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
    }),
    "red",
  );

  const next = resetRound(awarded, {
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

  assert.deepEqual(next.score, { red: 1, blue: 0 });
  assert.equal(next.roundLimit, 10);
  assert.equal(next.roundMode, "down");
  assert.equal(next.roundValue, 10);
  assert.equal(next.activePlayer, "red");
  assert.equal(next.status, "setup");
  assert.equal(next.topic, "Animals");
  assert.equal(next.overlayOpacity, 0.65);
  assert.equal(next.timers.perQuestionEnabled, false);
  assert.equal(next.timers.perQuestionRemainingSeconds, 0);
  assert.equal(next.timers.overallRemainingSeconds, 30);
});
