export const COLS = 16;
export const ROWS = 12;
export const INITIAL_FOOD_COUNT = 36;
export const MIN_FOOD_GAP = 2;
export const POWER_RATIO = 0.2;
export const MYSTERY_RATIO = 0.15;
export const MYSTERY_BUFF_CHANCE = 0.68;
export const COOP_CRASH_TIME_PENALTY = 5;
export const COOP_START_TIME = 90;

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const STUDENT_START = [
  { x: 2, y: 2 },
  { x: 1, y: 2 },
];

export const TEACHER_START = [
  { x: 13, y: 9 },
  { x: 14, y: 9 },
];

export const POWER_EFFECTS = [
  { key: "doubleGrow", label: "+2 growth", description: "Gain one extra segment." },
  { key: "shield", label: "Shield", description: "Ignore one crash." },
  { key: "bonusPoint", label: "+1 bonus point", description: "Gain one extra point." },
];

export const DANGER_EFFECTS = [
  { key: "loseSegment", label: "Lose segment", description: "Shrink by one segment." },
  { key: "skipTurn", label: "Skip next turn", description: "Miss the next move." },
  { key: "reverseControls", label: "Reverse controls", description: "Next move is reversed." },
];

export const COOP_BUFF_EFFECTS = [
  { key: "shield", label: "Shield", description: "Ignore one crash." },
  { key: "addTime", label: "+8 sec", description: "Add 8 seconds to the team timer.", amount: 8 },
  { key: "freezeTime", label: "Freeze time", description: "Pause the timer for 1-3 moves." },
];

export const COOP_NERF_EFFECTS = [
  { key: "removeTime", label: "-8 sec", description: "Remove 8 seconds from the team timer.", amount: 8 },
  { key: "addCrystals", label: "+2 crystals", description: "Spawn 2 extra crystals on the board.", amount: 2 },
  { key: "removeCrystals", label: "-2 crystals", description: "Remove 2 crystals from the board.", amount: 2 },
];

const PLAYER_COLORS = ["student", "teacher", "mint", "sun"];
const TIMER_DIGIT_SEGMENTS = {
  0: ["top", "upperLeft", "upperRight", "lowerLeft", "lowerRight", "bottom"],
  1: ["upperRight", "lowerRight"],
  2: ["top", "upperRight", "middle", "lowerLeft", "bottom"],
  3: ["top", "upperRight", "middle", "lowerRight", "bottom"],
  4: ["upperLeft", "upperRight", "middle", "lowerRight"],
  5: ["top", "upperLeft", "middle", "lowerRight", "bottom"],
  6: ["top", "upperLeft", "middle", "lowerLeft", "lowerRight", "bottom"],
  7: ["top", "upperRight", "lowerRight"],
  8: ["top", "upperLeft", "upperRight", "middle", "lowerLeft", "lowerRight", "bottom"],
  9: ["top", "upperLeft", "upperRight", "middle", "lowerRight", "bottom"],
};

export function posKey(pos) {
  return `${pos.x},${pos.y}`;
}

export function clampWrap(value, max) {
  if (value < 0) return max - 1;
  if (value >= max) return 0;
  return value;
}

export function getChebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function getBoardConfig(config = {}) {
  return {
    boardWidth: config.boardWidth ?? COLS,
    boardHeight: config.boardHeight ?? ROWS,
    crystalCount: config.crystalCount ?? INITIAL_FOOD_COUNT,
  };
}

function inRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function digitSegmentRects(thickness = 0.18) {
  return {
    top: { left: thickness, right: 1 - thickness, top: 0, bottom: thickness },
    upperLeft: { left: 0, right: thickness, top: thickness, bottom: 0.5 - thickness / 2 },
    upperRight: { left: 1 - thickness, right: 1, top: thickness, bottom: 0.5 - thickness / 2 },
    middle: { left: thickness, right: 1 - thickness, top: 0.5 - thickness / 2, bottom: 0.5 + thickness / 2 },
    lowerLeft: { left: 0, right: thickness, top: 0.5 + thickness / 2, bottom: 1 - thickness },
    lowerRight: { left: 1 - thickness, right: 1, top: 0.5 + thickness / 2, bottom: 1 - thickness },
    bottom: { left: thickness, right: 1 - thickness, top: 1 - thickness, bottom: 1 },
  };
}

export function isCellInsideCoopTimer({ x, y, boardWidth, boardHeight, timerText }) {
  if (!timerText || boardWidth <= 0 || boardHeight <= 0) return false;

  const px = (x + 0.5) / boardWidth;
  const py = (y + 0.5) / boardHeight;
  const mask = { left: 0, top: 0.12, width: 1, height: 0.74 };
  const glyphWidth = 0.24;
  const colonWidth = 0.08;
  const glyphGap = 0.03;
  const totalWidth = timerText.split("").reduce((sum, char, index, list) => {
    const width = char === ":" ? colonWidth : glyphWidth;
    return sum + width + (index < list.length - 1 ? glyphGap : 0);
  }, 0);
  const offsetX = (1 - totalWidth) / 2;
  const segments = digitSegmentRects();

  let cursor = offsetX;
  for (const char of timerText) {
    const width = char === ":" ? colonWidth : glyphWidth;
    const glyphLeft = mask.left + (cursor * mask.width);
    const glyphTop = mask.top;
    const glyphWidthAbs = width * mask.width;
    const glyphHeightAbs = mask.height;

    if (char === ":") {
      const dotWidth = glyphWidthAbs * 0.55;
      const left = glyphLeft + (glyphWidthAbs - dotWidth) / 2;
      const topDot = {
        left,
        right: left + dotWidth,
        top: glyphTop + glyphHeightAbs * 0.28,
        bottom: glyphTop + glyphHeightAbs * 0.4,
      };
      const bottomDot = {
        left,
        right: left + dotWidth,
        top: glyphTop + glyphHeightAbs * 0.6,
        bottom: glyphTop + glyphHeightAbs * 0.72,
      };
      if (inRect(px, py, topDot) || inRect(px, py, bottomDot)) return true;
    } else {
      const digit = TIMER_DIGIT_SEGMENTS[char];
      if (digit) {
        const localX = (px - glyphLeft) / glyphWidthAbs;
        const localY = (py - glyphTop) / glyphHeightAbs;
        if (localX >= 0 && localX <= 1 && localY >= 0 && localY <= 1) {
          if (char === "1") {
            if (inRect(localX, localY, { left: 0, right: 1, top: 0.04, bottom: 0.96 })) return true;
          } else if (digit.some((segment) => inRect(localX, localY, segments[segment]))) return true;
        }
      }
    }

    cursor += width + glyphGap;
  }

  return false;
}

export function canPlaceFood(cell, blockedKeys, cells, minGap) {
  if (blockedKeys.has(posKey(cell))) return false;
  return cells.every((placed) => getChebyshevDistance(cell, placed) > minGap);
}

export function randomSpacedCells(blockedKeys, count, minGap, config = {}, random = Math.random) {
  const { boardWidth, boardHeight } = getBoardConfig(config);
  const cells = [];
  let attempts = 0;
  const maxAttempts = 30000;

  while (cells.length < count && attempts < maxAttempts) {
    attempts += 1;
    const cell = {
      x: Math.floor(random() * boardWidth),
      y: Math.floor(random() * boardHeight),
    };

    if (canPlaceFood(cell, blockedKeys, cells, minGap)) {
      cells.push(cell);
    }
  }

  if (cells.length < count) {
    for (let y = 0; y < boardHeight && cells.length < count; y += 1) {
      for (let x = 0; x < boardWidth && cells.length < count; x += 1) {
        const cell = { x, y };
        if (canPlaceFood(cell, blockedKeys, cells, 1)) {
          cells.push(cell);
        }
      }
    }
  }

  return cells;
}

export function getNextHead(head, dir) {
  const delta = DIRS[dir];
  return {
    x: head.x + delta.x,
    y: head.y + delta.y,
  };
}

export function isOutOfBounds(pos, config = {}) {
  const { boardWidth, boardHeight } = getBoardConfig(config);
  return pos.x < 0 || pos.x >= boardWidth || pos.y < 0 || pos.y >= boardHeight;
}

export function segmentsContain(segments, pos) {
  return segments.some((s) => s.x === pos.x && s.y === pos.y);
}

export function randomFrom(list, indexSeed) {
  return list[indexSeed % list.length];
}

export function weightedRandomFrom(weightedList, random = Math.random) {
  const totalWeight = weightedList.reduce((sum, item) => sum + item.weight, 0);
  let target = random() * totalWeight;

  for (const item of weightedList) {
    target -= item.weight;
    if (target <= 0) return item.value;
  }

  return weightedList[weightedList.length - 1].value;
}

export function getFoodType(index, total) {
  const powerCount = Math.max(4, Math.floor(total * POWER_RATIO));
  const mysteryCount = Math.max(3, Math.floor(total * MYSTERY_RATIO));
  if (index < powerCount) return "power";
  if (index < powerCount + mysteryCount) return "mystery";
  return "normal";
}

export function resolveMysteryEffect(random = Math.random) {
  const isBuff = random() < MYSTERY_BUFF_CHANCE;
  const pool = isBuff ? POWER_EFFECTS : DANGER_EFFECTS;
  const choiceIndex = Math.floor(random() * pool.length);
  return {
    outcome: isBuff ? "buff" : "nerf",
    effect: pool[choiceIndex],
  };
}

export function resolveCoopEffect(random = Math.random) {
  const isBuff = random() < 0.6;
  if (isBuff) {
    const buffRoll = random();
    let effect;
    if (buffRoll < 0.4) effect = { ...COOP_BUFF_EFFECTS[2], moves: Math.floor(random() * 3) + 1 };
    else if (buffRoll < 0.7) effect = COOP_BUFF_EFFECTS[0];
    else effect = COOP_BUFF_EFFECTS[1];
    return { outcome: "buff", effect };
  }

  const effect = randomFrom(COOP_NERF_EFFECTS, Math.floor(random() * COOP_NERF_EFFECTS.length));
  return { outcome: "nerf", effect };
}

export function resolveCrystalEffect(mode, foodType, random = Math.random) {
  if (mode === "coop" && foodType !== "normal") {
    return resolveCoopEffect(random);
  }

  if (foodType === "power") {
    return {
      outcome: "buff",
      effect: randomFrom(POWER_EFFECTS, Math.floor(random() * POWER_EFFECTS.length)),
    };
  }

  if (foodType === "mystery") {
    return resolveMysteryEffect(random);
  }

  return null;
}

export function shuffleQuestions(questions, random = Math.random) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function parseQuestionLines(questionLines) {
  const hasAnswerLabels = questionLines.some((line) => /^answer\s*:/i.test(line.trim()));
  if (!hasAnswerLabels) {
    return questionLines
      .map((line, index) => {
        const [prompt, ...answerParts] = line.split("|");
        return {
          id: index + 1,
          prompt: prompt.trim(),
          answer: answerParts.join("|").trim(),
          type: "custom",
        };
      })
      .filter((q) => q.prompt.length > 0);
  }

  const questions = [];
  let promptLines = [];
  let answer = "";

  const pushQuestion = () => {
    const prompt = promptLines.join(" ").trim();
    if (!prompt) return;
    questions.push({
      id: questions.length + 1,
      prompt,
      answer: answer.trim(),
      type: "custom",
    });
    promptLines = [];
    answer = "";
  };

  questionLines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      pushQuestion();
      return;
    }

    const answerMatch = line.match(/^answer\s*:\s*(.*)$/i);
    if (answerMatch) {
      answer = answerMatch[1].trim();
      return;
    }

    if (answer) pushQuestion();

    const [prompt, ...answerParts] = line.split("|");
    promptLines.push(prompt.trim());
    if (answerParts.length) answer = answerParts.join("|").trim();
  });

  pushQuestion();
  return questions;
}

export function createFoodQuestionForIndex(questionLines, index) {
  const cleanedQuestions = parseQuestionLines(questionLines);
  const safeQuestions = cleanedQuestions.length
    ? cleanedQuestions
    : [{ id: 1, type: "custom", prompt: "Question 1", answer: "" }];

  return safeQuestions[index % safeQuestions.length];
}

export function getPlayerSpawnAnchors(playerCount, boardWidth = COLS, boardHeight = ROWS) {
  return [
    { head: { x: 2, y: 2 }, heading: "right" },
    { head: { x: boardWidth - 3, y: boardHeight - 3 }, heading: "left" },
    { head: { x: boardWidth - 3, y: 2 }, heading: "left" },
    { head: { x: 2, y: boardHeight - 3 }, heading: "right" },
  ].slice(0, playerCount);
}

export function buildStartingSnake(index, boardWidth = COLS, boardHeight = ROWS) {
  const anchors = getPlayerSpawnAnchors(index + 1, boardWidth, boardHeight);
  const anchor = anchors[index];
  const tail = anchor.heading === "right"
    ? { x: anchor.head.x - 1, y: anchor.head.y }
    : { x: anchor.head.x + 1, y: anchor.head.y };

  return [anchor.head, tail];
}

export function createPlayers(playerConfigs, { boardWidth = COLS, boardHeight = ROWS } = {}) {
  return playerConfigs.map((player, index) => {
    const snake = buildStartingSnake(index, boardWidth, boardHeight);
    const heading = getPlayerSpawnAnchors(playerConfigs.length, boardWidth, boardHeight)[index].heading;
    return {
      id: `player-${index + 1}`,
      name: player.name,
      colorKey: PLAYER_COLORS[index % PLAYER_COLORS.length],
      score: 0,
      rounds: 0,
      shield: 0,
      skipTurn: false,
      reverseControls: false,
      heading,
      snake,
      pendingFreezeMoves: 0,
    };
  });
}

export function buildFoodFromQuestions(questionLines, configOrRandom = {}, maybeRandom = Math.random) {
  const config = typeof configOrRandom === "function" ? {} : configOrRandom;
  const random = typeof configOrRandom === "function" ? configOrRandom : maybeRandom;
  const { boardWidth, boardHeight, crystalCount } = getBoardConfig(config);
  const playerCount = config.playerCount ?? 2;
  const blocked = new Set(
    getPlayerSpawnAnchors(playerCount, boardWidth, boardHeight)
      .flatMap((anchor) => [
        posKey(anchor.head),
        posKey(anchor.heading === "right"
          ? { x: anchor.head.x - 1, y: anchor.head.y }
          : { x: anchor.head.x + 1, y: anchor.head.y }),
      ])
  );

  const cleanedQuestions = parseQuestionLines(questionLines);
  const shuffledQuestions = shuffleQuestions(cleanedQuestions, random);
  const safeQuestions = shuffledQuestions.length
    ? shuffledQuestions
    : [{ id: 1, type: "custom", prompt: "Question 1", answer: "" }];

  const cells = randomSpacedCells(blocked, crystalCount, MIN_FOOD_GAP, { boardWidth, boardHeight }, random);

  return cells.map((cell, i) => {
    const foodType = getFoodType(i, crystalCount);
    return {
      id: `food-${i}`,
      ...cell,
      foodType,
      effect: resolveCrystalEffect(config.mode ?? "versus", foodType, random),
      question: safeQuestions[i % safeQuestions.length],
    };
  });
}

export function normalizeDirectionValue(value) {
  return value.trim().toLowerCase();
}

export function createPlayerDirectionLabelMap(players = [], defaultLabels = {}, existingLabels = {}) {
  return players.reduce((labelsByPlayer, player) => ({
    ...labelsByPlayer,
    [player.id]: { ...defaultLabels, ...(existingLabels[player.id] || {}) },
  }), {});
}

export function updatePlayerDirectionLabel(labelsByPlayer, playerId, direction, value) {
  return {
    ...labelsByPlayer,
    [playerId]: {
      ...(labelsByPlayer[playerId] || {}),
      [direction]: value,
    },
  };
}

export const HERO_CROWN_DEFAULT_SETTINGS = {
  enabled: true,
  frequency: "medium",
  expiresAfterMoves: 5,
  cosmeticDurationSeconds: 30,
  bonusValue: 3,
};

export const HERO_CROWN_FREQUENCY_CHANCES = {
  low: 0.1,
  medium: 0.2,
  high: 0.35,
};

export const HERO_CROWN_CHALLENGES = [
  "Touch something blue!",
  "Do a hero pose!",
  "Jump 3 times!",
  "Make a shield pose!",
  "Point to the sky!",
  "Touch your head!",
  "Show me a strong face!",
  "Pretend to cast magic!",
  "Spin once!",
  "Make rabbit ears!",
];

export function getHeroCrownSettings(settings = {}) {
  const merged = { ...HERO_CROWN_DEFAULT_SETTINGS, ...(settings || {}) };
  return {
    enabled: Boolean(merged.enabled),
    frequency: HERO_CROWN_FREQUENCY_CHANCES[merged.frequency] ? merged.frequency : HERO_CROWN_DEFAULT_SETTINGS.frequency,
    expiresAfterMoves: Math.max(1, Number(merged.expiresAfterMoves) || HERO_CROWN_DEFAULT_SETTINGS.expiresAfterMoves),
    cosmeticDurationSeconds: Math.max(1, Number(merged.cosmeticDurationSeconds) || HERO_CROWN_DEFAULT_SETTINGS.cosmeticDurationSeconds),
    bonusValue: Math.max(0, Number(merged.bonusValue) || HERO_CROWN_DEFAULT_SETTINGS.bonusValue),
  };
}

export function shouldSpawnHeroCrown(frequency = HERO_CROWN_DEFAULT_SETTINGS.frequency, roll = Math.random()) {
  return roll < (HERO_CROWN_FREQUENCY_CHANCES[frequency] ?? HERO_CROWN_FREQUENCY_CHANCES[HERO_CROWN_DEFAULT_SETTINGS.frequency]);
}

export function expireHeroCrown(crownTile, movedPlayerId = null) {
  if (!crownTile) return null;
  if (crownTile.targetPlayerId && movedPlayerId && crownTile.targetPlayerId !== movedPlayerId) return crownTile;
  const remainingMoves = Math.max(0, (Number(crownTile.remainingMoves) || 0) - 1);
  return remainingMoves > 0 ? { ...crownTile, remainingMoves } : null;
}

export function chooseReachableHeroCrownCell({
  player,
  blockedKeys = new Set(),
  maxMoves = HERO_CROWN_DEFAULT_SETTINGS.expiresAfterMoves,
  config = {},
  random = Math.random,
} = {}) {
  const head = player?.snake?.[0];
  const { boardWidth, boardHeight } = getBoardConfig(config);
  if (!head) return null;

  const candidates = [];
  const moveLimit = Math.max(1, Number(maxMoves) || HERO_CROWN_DEFAULT_SETTINGS.expiresAfterMoves);
  for (let y = 0; y < boardHeight; y += 1) {
    for (let x = 0; x < boardWidth; x += 1) {
      const distance = Math.abs(x - head.x) + Math.abs(y - head.y);
      if (distance > 0 && distance <= moveLimit && !blockedKeys.has(posKey({ x, y }))) {
        candidates.push({ x, y, distance });
      }
    }
  }

  if (!candidates.length) return randomSpacedCells(blockedKeys, 1, 1, config, random)[0] ?? null;

  const closestDistance = Math.min(...candidates.map((cell) => cell.distance));
  const closeCandidates = candidates.filter((cell) => cell.distance <= Math.min(moveLimit, closestDistance + 2));
  const chosen = closeCandidates[Math.floor(random() * closeCandidates.length)] ?? closeCandidates[0];
  return { x: chosen.x, y: chosen.y };
}

export function awardHeroCrown(player, now = Date.now(), cosmeticDurationSeconds = HERO_CROWN_DEFAULT_SETTINGS.cosmeticDurationSeconds) {
  return {
    ...player,
    crowns: (player.crowns || 0) + 1,
    crownEffectUntil: now + (Math.max(1, Number(cosmeticDurationSeconds) || HERO_CROWN_DEFAULT_SETTINGS.cosmeticDurationSeconds) * 1000),
  };
}

export function calculateCrownBonus(player, bonusValue = HERO_CROWN_DEFAULT_SETTINGS.bonusValue) {
  return (player?.crowns || 0) * Math.max(0, Number(bonusValue) || HERO_CROWN_DEFAULT_SETTINGS.bonusValue);
}

export function getReverseDirection(dir) {
  const map = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };
  return map[dir] || dir;
}

export function describeOutcomeResult(effectDetails) {
  if (!effectDetails?.effect) return null;

  return {
    tone: effectDetails.outcome === "nerf" ? "nerf" : "buff",
    title: effectDetails.outcome === "nerf" ? "You've been nerfed" : "You've been buffed",
    label: effectDetails.effect.label,
    description: effectDetails.effect.description,
  };
}

export function getNextTurn(playerId, players = []) {
  if (!players.length) {
    return playerId === "student" ? "teacher" : "student";
  }

  const index = players.findIndex((player) => player.id === playerId);
  if (index === -1) return players[0].id;
  return players[(index + 1) % players.length].id;
}

export function canPlayerMove(activeTurn, playerId) {
  return activeTurn === playerId;
}

export function getActiveTurnAfterMove(playerId, foundFood) {
  return foundFood ? playerId : getNextTurn(playerId);
}

export function shouldSpawnBattleBomb(phase, battleMoveCount) {
  return phase === "battle" && battleMoveCount > 0 && battleMoveCount % 4 === 0;
}

export function getRoundWinnerFromLoser(loser, players = []) {
  if (!players.length) {
    return loser === "student" ? "teacher" : "student";
  }
  return players.find((player) => player.id !== loser)?.id ?? players[0]?.id ?? loser;
}

export function isIllegalReverseMove(snake, nextHead) {
  if (!snake || snake.length < 2) return false;
  return snake[1].x === nextHead.x && snake[1].y === nextHead.y;
}

export function advanceCoopTimer(state, { movesConsumed = 1, seconds = 1 }) {
  if (state.frozenMovesRemaining > 0) {
    return {
      ...state,
      frozenMovesRemaining: Math.max(0, state.frozenMovesRemaining - movesConsumed),
    };
  }

  return {
    ...state,
    timerRemaining: Math.max(0, state.timerRemaining - seconds),
  };
}

export function createCoopState(startTime = COOP_START_TIME) {
  return {
    timerRemaining: startTime,
    frozenMovesRemaining: 0,
  };
}

export function canRunCoopTimer({
  gameStarted,
  mode,
  paused = false,
  hasPendingPickup = false,
  hasPickupResolution = false,
  hasResultOverlay = false,
}) {
  return Boolean(gameStarted && mode === "coop" && !paused && !hasPendingPickup && !hasPickupResolution && !hasResultOverlay);
}

export function getCoopOutcome({ timerRemaining, crystalsRemaining }) {
  if (crystalsRemaining === 0) return "win";
  if (timerRemaining <= 0 && crystalsRemaining > 0) return "loss";
  return null;
}

export const ENEMY_DEFAULT_SETTINGS = {
  enabled: false,
  speed: "normal", // slow = moves every 2 turns, normal = every turn
  respawnDelayTurns: 5,
  defeatReward: 3,
};

export const ENEMY_SPEED_STEP_INTERVAL = { slow: 2, normal: 1 };

export function getEnemySettings(settings = {}) {
  const merged = { ...ENEMY_DEFAULT_SETTINGS, ...(settings || {}) };
  return {
    enabled: Boolean(merged.enabled),
    speed: ENEMY_SPEED_STEP_INTERVAL[merged.speed] ? merged.speed : ENEMY_DEFAULT_SETTINGS.speed,
    respawnDelayTurns: Math.max(1, Number(merged.respawnDelayTurns) || ENEMY_DEFAULT_SETTINGS.respawnDelayTurns),
    defeatReward: Math.max(0, Number(merged.defeatReward) || ENEMY_DEFAULT_SETTINGS.defeatReward),
  };
}

// Pick the spawn cell that is as far as possible from every snake head, so the
// villain always appears at a fair distance and gives players time to react.
export function chooseEnemySpawn(players = [], blockedKeys = new Set(), config = {}) {
  const { boardWidth, boardHeight } = getBoardConfig(config);
  const heads = players.map((p) => p.snake?.[0]).filter(Boolean);
  let best = null;
  let bestScore = -1;
  for (let y = 0; y < boardHeight; y += 1) {
    for (let x = 0; x < boardWidth; x += 1) {
      if (blockedKeys.has(posKey({ x, y }))) continue;
      const score = heads.length
        ? Math.min(...heads.map((h) => Math.abs(h.x - x) + Math.abs(h.y - y)))
        : x + y;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

export function getNearestHead(pos, players = []) {
  let best = null;
  let bestDist = Infinity;
  players.forEach((p) => {
    const head = p.snake?.[0];
    if (!head) return;
    const dist = Math.abs(head.x - pos.x) + Math.abs(head.y - pos.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = head;
    }
  });
  return best;
}

// Greedy one-step chase toward the nearest head. Walls and blocked cells (bombs)
// are avoided; snake cells are allowed so the villain can catch a player.
export function stepEnemyToward(enemy, players = [], blockedKeys = new Set(), config = {}) {
  if (!enemy) return enemy;
  const target = getNearestHead(enemy, players);
  if (!target) return enemy;
  const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
  let best = null;
  let bestDist = Math.abs(enemy.x - target.x) + Math.abs(enemy.y - target.y);
  for (const d of dirs) {
    const next = { x: enemy.x + d.x, y: enemy.y + d.y };
    if (isOutOfBounds(next, config)) continue;
    if (blockedKeys.has(posKey(next))) continue;
    const dist = Math.abs(next.x - target.x) + Math.abs(next.y - target.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = next;
    }
  }
  return best ? { ...enemy, x: best.x, y: best.y } : enemy;
}

export function getEnemyCatch(enemy, players = []) {
  if (!enemy) return null;
  const caught = players.find((p) => segmentsContain(p.snake || [], enemy));
  return caught ? caught.id : null;
}

export function getStreakTier(streak = 0) {
  if (streak >= 5) return { level: 3, label: "UNSTOPPABLE", hue: 280 };
  if (streak >= 3) return { level: 2, label: "ON FIRE", hue: 18 };
  if (streak >= 2) return { level: 1, label: "STREAK", hue: 45 };
  return { level: 0, label: "", hue: 45 };
}

export function getCrashResolution(mode, playerState) {
  if (mode === "coop") {
    return {
      keepLength: true,
      timePenalty: COOP_CRASH_TIME_PENALTY,
      nextLength: playerState.snake.length,
    };
  }

  return {
    keepLength: false,
    timePenalty: 0,
    nextLength: 2,
  };
}
