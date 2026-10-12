import { describe, expect, test } from "vitest";
import {
  COOP_CRASH_TIME_PENALTY,
  DANGER_EFFECTS,
  MYSTERY_BUFF_CHANCE,
  POWER_EFFECTS,
  ROWS,
  advanceCoopTimer,
  buildFoodFromQuestions,
  canPlayerMove,
  canRunCoopTimer,
  createCoopState,
  createFoodQuestionForIndex,
  createPlayers,
  describeOutcomeResult,
  getCoopOutcome,
  getCrashResolution,
  getActiveTurnAfterMove,
  getFoodType,
  getNextHead,
  isIllegalReverseMove,
  isOutOfBounds,
  isCellInsideCoopTimer,
  getRoundWinnerFromLoser,
  getNextTurn,
  getReverseDirection,
  HERO_CROWN_DEFAULT_SETTINGS,
  awardHeroCrown,
  calculateCrownBonus,
  chooseReachableHeroCrownCell,
  createPlayerDirectionLabelMap,
  expireHeroCrown,
  getHeroCrownSettings,
  shouldSpawnHeroCrown,
  updatePlayerDirectionLabel,
  parseQuestionLines,
  resolveCrystalEffect,
  resolveMysteryEffect,
  shuffleQuestions,
  shouldSpawnBattleBomb,
  getEnemySettings,
  chooseEnemySpawn,
  getNearestHead,
  stepEnemyToward,
  getEnemyCatch,
  getStreakTier,
} from "./gameLogic";

function randomFromSequence(values) {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value ?? 0;
  };
}

describe("villain helpers", () => {
  const config = { boardWidth: 10, boardHeight: 10 };
  const players = [{ id: "player-1", snake: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }];

  test("getEnemySettings normalizes bad values", () => {
    const s = getEnemySettings({ enabled: 1, speed: "warp", respawnDelayTurns: -3, defeatReward: "x" });
    expect(s.enabled).toBe(true);
    expect(s.speed).toBe("normal");
    expect(s.respawnDelayTurns).toBe(1);
    expect(s.defeatReward).toBe(3);
  });

  test("chooseEnemySpawn picks a far corner from the only head", () => {
    const spawn = chooseEnemySpawn(players, new Set(), config);
    expect(spawn).toEqual({ x: 9, y: 9 });
  });

  test("chooseEnemySpawn avoids blocked cells", () => {
    const spawn = chooseEnemySpawn(players, new Set(["9,9"]), config);
    expect(spawn).not.toEqual({ x: 9, y: 9 });
  });

  test("getNearestHead finds closest head", () => {
    const head = getNearestHead({ x: 9, y: 9 }, [
      { snake: [{ x: 0, y: 0 }] },
      { snake: [{ x: 8, y: 9 }] },
    ]);
    expect(head).toEqual({ x: 8, y: 9 });
  });

  test("stepEnemyToward moves one step closer to the nearest head", () => {
    const next = stepEnemyToward({ x: 5, y: 0 }, players, new Set(), config);
    expect(next.x).toBe(4);
    expect(next.y).toBe(0);
  });

  test("stepEnemyToward avoids bombs and stays put if boxed in", () => {
    const blocked = new Set(["4,0", "5,1"]);
    const next = stepEnemyToward({ x: 5, y: 0 }, players, blocked, config);
    expect(blocked.has(`${next.x},${next.y}`)).toBe(false);
  });

  test("getEnemyCatch returns the player whose snake the villain is on", () => {
    expect(getEnemyCatch({ x: 1, y: 0 }, players)).toBe("player-1");
    expect(getEnemyCatch({ x: 5, y: 5 }, players)).toBe(null);
  });

  test("getStreakTier escalates", () => {
    expect(getStreakTier(1).level).toBe(0);
    expect(getStreakTier(2).level).toBe(1);
    expect(getStreakTier(3).level).toBe(2);
    expect(getStreakTier(6).level).toBe(3);
  });
});

describe("getFoodType", () => {
  test("uses a 16 by 12 board height", () => {
    expect(ROWS).toBe(12);
  });

  test("marks the danger allocation as mystery crystals", () => {
    expect(getFoodType(0, 36)).toBe("power");
    expect(getFoodType(7, 36)).toBe("mystery");
    expect(getFoodType(12, 36)).toBe("normal");
  });
});

describe("board bounds", () => {
  test("moving beyond the board edge does not wrap around", () => {
    expect(getNextHead({ x: 0, y: 0 }, "left")).toEqual({ x: -1, y: 0 });
    expect(getNextHead({ x: 15, y: 11 }, "right")).toEqual({ x: 16, y: 11 });
  });

  test("detects out-of-bounds positions", () => {
    expect(isOutOfBounds({ x: -1, y: 0 })).toBe(true);
    expect(isOutOfBounds({ x: 16, y: 0 })).toBe(true);
    expect(isOutOfBounds({ x: 0, y: 12 })).toBe(true);
    expect(isOutOfBounds({ x: 5, y: 5 })).toBe(false);
  });
});

describe("resolveMysteryEffect", () => {
  test("chooses buff outcomes when the random roll is within the weighted range", () => {
    const random = randomFromSequence([MYSTERY_BUFF_CHANCE - 0.01, 0.4]);
    const result = resolveMysteryEffect(random);
    expect(result.outcome).toBe("buff");
    expect(POWER_EFFECTS.map((effect) => effect.key)).toContain(result.effect.key);
  });

  test("chooses nerf outcomes when the random roll misses the weighted range", () => {
    const random = randomFromSequence([MYSTERY_BUFF_CHANCE + 0.01, 0.4]);
    const result = resolveMysteryEffect(random);
    expect(result.outcome).toBe("nerf");
    expect(DANGER_EFFECTS.map((effect) => effect.key)).toContain(result.effect.key);
  });
});

describe("buildFoodFromQuestions", () => {
  test("parses question and answer blocks separated by blank lines", () => {
    expect(parseQuestionLines([
      "CLUE: They followed the glowing s__________ through the forest.",
      "Answer: shard",
      "",
      "UNSCRAMBLE: deeper / The / forest / into / shard / moving / is",
      "Answer: The shard is moving deeper into the forest.",
      "",
      "WHO SAID: “Do not rush, Yuki?”",
      "Answer: Kage",
    ])).toEqual([
      { id: 1, prompt: "CLUE: They followed the glowing s__________ through the forest.", answer: "shard", type: "custom" },
      { id: 2, prompt: "UNSCRAMBLE: deeper / The / forest / into / shard / moving / is", answer: "The shard is moving deeper into the forest.", type: "custom" },
      { id: 3, prompt: "WHO SAID: “Do not rush, Yuki?”", answer: "Kage", type: "custom" },
    ]);
  });

  test("stores parsed block answers on crystal questions", () => {
    const foods = buildFoodFromQuestions(["CLUE: The trees were too q__________.", "Answer: quiet"], {
      boardWidth: 8,
      boardHeight: 8,
      crystalCount: 1,
    }, randomFromSequence(new Array(200).fill(0.1)));

    expect(foods[0].question).toMatchObject({
      prompt: "CLUE: The trees were too q__________.",
      answer: "quiet",
    });
  });

  test("reuses parsed question-answer cards when adding extra crystals", () => {
    const questionLines = [
      "CLUE: They followed the glowing s__________ through the forest.",
      "Answer: shard",
      "",
      "FINISH: The kids found a big old c__________ in the forest.",
      "Answer: castle",
    ];

    expect(createFoodQuestionForIndex(questionLines, 0)).toMatchObject({
      prompt: "CLUE: They followed the glowing s__________ through the forest.",
      answer: "shard",
    });
    expect(createFoodQuestionForIndex(questionLines, 1)).toMatchObject({
      prompt: "FINISH: The kids found a big old c__________ in the forest.",
      answer: "castle",
    });
  });

  test("starts a new card after an answer even when blank lines were stripped", () => {
    expect(parseQuestionLines([
      "CLUE: They followed the glowing s__________ through the forest.",
      "Answer: shard",
      "FINISH: The kids found a big old c__________ in the forest.",
      "Answer: castle",
    ])).toEqual([
      { id: 1, prompt: "CLUE: They followed the glowing s__________ through the forest.", answer: "shard", type: "custom" },
      { id: 2, prompt: "FINISH: The kids found a big old c__________ in the forest.", answer: "castle", type: "custom" },
    ]);
  });

  test("keeps legacy one-line questions usable without answers", () => {
    expect(parseQuestionLines(["No delimiter"])).toEqual([
      { id: 1, prompt: "No delimiter", answer: "", type: "custom" },
    ]);
  });

  test("shuffles the question list before assigning prompts to crystals", () => {
    const shuffled = shuffleQuestions(
      ["Clue 1", "Unscramble 2", "Who said 3", "Finish 4"],
      randomFromSequence([0.75, 0.5, 0.25])
    );

    expect(shuffled).toEqual(["Who said 3", "Clue 1", "Unscramble 2", "Finish 4"]);
  });

  test("stores power crystals as buff effect payloads", () => {
    const questions = ["One", "Two", "Three"];
    const random = randomFromSequence(new Array(200).fill(0.1));
    const foods = buildFoodFromQuestions(questions, random);
    const power = foods.find((food) => food.foodType === "power");
    expect(power.effect).toMatchObject({
      outcome: "buff",
    });
    expect(POWER_EFFECTS.map((effect) => effect.key)).toContain(power.effect.effect.key);
  });

  test("stores hidden mystery outcomes on mystery crystals", () => {
    const questions = ["One", "Two", "Three"];
    const random = randomFromSequence(new Array(200).fill(0.1));
    const foods = buildFoodFromQuestions(questions, random);
    const mystery = foods.find((food) => food.foodType === "mystery");
    expect(mystery).toBeTruthy();
    expect(mystery.effect).toMatchObject({
      outcome: "buff",
    });
  });

  test("uses each provided question once when there are as many prompts as crystals", () => {
    const questions = Array.from({ length: 36 }, (_, index) => `Question ${index + 1}`);
    const random = randomFromSequence(new Array(400).fill(0.1));
    const foods = buildFoodFromQuestions(questions, random);
    const assignedPrompts = foods.map((food) => food.question.prompt);

    expect(new Set(assignedPrompts).size).toBe(36);
    expect(assignedPrompts).toContain("Question 1");
    expect(assignedPrompts).toContain("Question 36");
  });

  test("uses the configured crystal count instead of the fixed board count", () => {
    const foods = buildFoodFromQuestions(["One", "Two"], {
      boardWidth: 10,
      boardHeight: 10,
      crystalCount: 12,
    }, randomFromSequence(new Array(200).fill(0.1)));

    expect(foods).toHaveLength(12);
  });

  test("repeats questions when there are fewer prompts than configured crystals", () => {
    const foods = buildFoodFromQuestions(["Only one"], {
      boardWidth: 8,
      boardHeight: 8,
      crystalCount: 6,
    }, randomFromSequence(new Array(200).fill(0.1)));

    expect(foods).toHaveLength(6);
    expect(new Set(foods.map((food) => food.question.prompt))).toEqual(new Set(["Only one"]));
  });
});

describe("createPlayers", () => {
  test("creates the configured number of active players with unique names", () => {
    const players = createPlayers(
      [{ name: "Ana" }, { name: "Bo" }, { name: "Cy" }, { name: "Di" }],
      { boardWidth: 16, boardHeight: 12 }
    );

    expect(players).toHaveLength(4);
    expect(players.map((player) => player.name)).toEqual(["Ana", "Bo", "Cy", "Di"]);
    expect(new Set(players.map((player) => player.id)).size).toBe(4);
    expect(players.every((player) => player.snake.length === 2)).toBe(true);
  });
});

describe("mode-specific crystal effects", () => {
  test("uses the co-op effect pool and can choose freeze-time", () => {
    const effect = resolveCrystalEffect("coop", "mystery", randomFromSequence([0.05, 0.1]));

    expect(effect.effect.key).toBe("freezeTime");
    expect(effect.effect.moves).toBeGreaterThanOrEqual(1);
    expect(effect.effect.moves).toBeLessThanOrEqual(3);
  });
});

describe("getReverseDirection", () => {
  test("flips directions for reverse-controls penalties", () => {
    expect(getReverseDirection("up")).toBe("down");
    expect(getReverseDirection("left")).toBe("right");
  });
});

describe("player direction labels", () => {
  test("creates independent direction label sets for each player", () => {
    const labels = createPlayerDirectionLabelMap([
      { id: "player-1" },
      { id: "player-2" },
    ], { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT" });

    const updated = updatePlayerDirectionLabel(labels, "player-2", "up", "BLUE");

    expect(updated["player-1"].up).toBe("UP");
    expect(updated["player-2"].up).toBe("BLUE");
  });
});

describe("hero crown helpers", () => {
  test("fills missing crown settings with safe defaults", () => {
    expect(getHeroCrownSettings({ expiresAfterMoves: 2 })).toMatchObject({
      enabled: true,
      frequency: "medium",
      expiresAfterMoves: 2,
      cosmeticDurationSeconds: HERO_CROWN_DEFAULT_SETTINGS.cosmeticDurationSeconds,
      bonusValue: HERO_CROWN_DEFAULT_SETTINGS.bonusValue,
    });
  });

  test("expires a crown tile after its remaining moves run out", () => {
    expect(expireHeroCrown({ x: 2, y: 3, remainingMoves: 2 })).toMatchObject({ remainingMoves: 1 });
    expect(expireHeroCrown({ x: 2, y: 3, remainingMoves: 1 })).toBeNull();
  });

  test("does not count down a targeted crown on another player's move", () => {
    const crown = { x: 2, y: 3, targetPlayerId: "player-1", remainingMoves: 2 };

    expect(expireHeroCrown(crown, "player-2")).toEqual(crown);
    expect(expireHeroCrown(crown, "player-1")).toMatchObject({ remainingMoves: 1 });
  });

  test("chooses a crown cell reachable from the target player's head", () => {
    const cell = chooseReachableHeroCrownCell({
      player: { id: "player-1", snake: [{ x: 4, y: 4 }] },
      blockedKeys: new Set(["4,4"]),
      maxMoves: 3,
      config: { boardWidth: 10, boardHeight: 10 },
      random: () => 0,
    });

    expect(Math.abs(cell.x - 4) + Math.abs(cell.y - 4)).toBeLessThanOrEqual(3);
    expect(cell).not.toEqual({ x: 4, y: 4 });
  });

  test("calculates crown bonus from player crowns and configured value", () => {
    expect(calculateCrownBonus({ crowns: 2 }, 3)).toBe(6);
  });

  test("awards crowns and applies visual-only cosmetic timing", () => {
    const awarded = awardHeroCrown({ id: "player-1", score: 4, crowns: 1 }, 1000, 30);

    expect(awarded).toMatchObject({
      score: 4,
      crowns: 2,
      crownEffectUntil: 31000,
    });
  });

  test("uses deterministic frequency thresholds for crown spawn checks", () => {
    expect(shouldSpawnHeroCrown("low", 0.09)).toBe(true);
    expect(shouldSpawnHeroCrown("low", 0.1)).toBe(false);
    expect(shouldSpawnHeroCrown("high", 0.34)).toBe(true);
  });
});

describe("describeOutcomeResult", () => {
  test("formats buff copy for the reveal modal", () => {
    expect(
      describeOutcomeResult({
        outcome: "buff",
        effect: POWER_EFFECTS[0],
      })
    ).toMatchObject({
      tone: "buff",
      title: "You've been buffed",
      label: POWER_EFFECTS[0].label,
    });
  });

  test("formats nerf copy for the reveal modal", () => {
    expect(
      describeOutcomeResult({
        outcome: "nerf",
        effect: DANGER_EFFECTS[0],
      })
    ).toMatchObject({
      tone: "nerf",
      title: "You've been nerfed",
      label: DANGER_EFFECTS[0].label,
    });
  });
});

describe("turn helpers", () => {
  test("strictly alternates turns between student and teacher", () => {
    expect(getNextTurn("student")).toBe("teacher");
    expect(getNextTurn("teacher")).toBe("student");
  });

  test("allows moves only for the active player", () => {
    expect(canPlayerMove("student", "student")).toBe(true);
    expect(canPlayerMove("student", "teacher")).toBe(false);
  });

  test("keeps the current player active while a pickup question is unresolved", () => {
    expect(getActiveTurnAfterMove("student", true)).toBe("student");
    expect(getActiveTurnAfterMove("student", false)).toBe("teacher");
  });

  test("spawns battle bombs every four total battle moves", () => {
    expect(shouldSpawnBattleBomb("battle", 1)).toBe(false);
    expect(shouldSpawnBattleBomb("battle", 4)).toBe(true);
    expect(shouldSpawnBattleBomb("collection", 4)).toBe(false);
  });

  test("maps the crashing player to the other round winner", () => {
    expect(getRoundWinnerFromLoser("student")).toBe("teacher");
    expect(getRoundWinnerFromLoser("teacher")).toBe("student");
  });

  test("treats moving back into the neck as an illegal reverse move", () => {
    expect(
      isIllegalReverseMove(
        [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }],
        { x: 2, y: 2 }
      )
    ).toBe(true);
  });
});

describe("co-op timer and crash helpers", () => {
  test("stops the co-op timer when the round is paused", () => {
    expect(
      canRunCoopTimer({
        gameStarted: true,
        mode: "coop",
        paused: true,
        hasPendingPickup: false,
        hasPickupResolution: false,
        hasResultOverlay: false,
      })
    ).toBe(false);
  });

  test("creates co-op state from a configured starting timer", () => {
    expect(createCoopState(150)).toEqual({
      timerRemaining: 150,
      frozenMovesRemaining: 0,
    });
  });

  test("shades cells inside the large co-op timer mask", () => {
    expect(
      isCellInsideCoopTimer({
        x: 2,
        y: 2,
        boardWidth: 16,
        boardHeight: 12,
        timerText: "1:30",
      })
    ).toBe(true);
  });

  test("does not shade cells outside the large co-op timer mask", () => {
    expect(
      isCellInsideCoopTimer({
        x: 0,
        y: 0,
        boardWidth: 16,
        boardHeight: 12,
        timerText: "1:30",
      })
    ).toBe(false);
  });

  test("freezes the timer for the configured number of moves", () => {
    const nextState = advanceCoopTimer(
      { timerRemaining: 30, frozenMovesRemaining: 2 },
      { movesConsumed: 1, seconds: 1 }
    );

    expect(nextState.timerRemaining).toBe(30);
    expect(nextState.frozenMovesRemaining).toBe(1);
  });

  test("returns a co-op win when all crystals are cleared in time", () => {
    expect(getCoopOutcome({ timerRemaining: 10, crystalsRemaining: 0 })).toBe("win");
  });

  test("returns a co-op loss when time expires with crystals remaining", () => {
    expect(getCoopOutcome({ timerRemaining: 0, crystalsRemaining: 3 })).toBe("loss");
  });

  test("preserves snake length and applies a time penalty in co-op crashes", () => {
    const outcome = getCrashResolution("coop", {
      snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }],
    });

    expect(outcome.keepLength).toBe(true);
    expect(outcome.timePenalty).toBe(COOP_CRASH_TIME_PENALTY);
  });
});
