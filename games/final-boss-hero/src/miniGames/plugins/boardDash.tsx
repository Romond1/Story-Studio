import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Dice3D } from "../../components/Dice3D";
import { computeBoardProjectionPadding } from "../../components/boardProjection";
import { BOARD_DASH_ICONS } from "../../data/boardDashAssets";
import { useScoreFeedback } from "../../animations/scoreFeedback";
import { useBattleStore } from "../../store/battleStore";
import type { ActionItem, BoardDashMedallionKind, CardData } from "../../types/game";
import { BOARD_DASH_MEDALLION_KINDS } from "../../types/game";
import type { MiniGamePlugin } from "../types";

type Side = "hero" | "villain";
type BoardPhase = "intro" | "rolling" | "moving" | "resolve" | "gameComplete";
type TileKind = "start" | "finish" | "card" | "move" | "bonus" | "back3" | "rollAgain" | "steal";

interface Point {
  x: number;
  y: number;
}

interface BoardTile {
  index: number;
  kind: TileKind;
  pos: Point;
  card?: CardData;
  action?: ActionItem;
}

interface LastLanding {
  title: string;
  detail: string;
  icon: string | null;
}

const DEFAULT_TILE_COUNT = 18;
const ROLL_SPIN_MS = 850;
const STEP_MS = 230;
/** Fixed on-board tile size in px (before play-area zoom) — the PNGs inside never rescale. */
const BOARD_TILE_PX = 60;
/** Minimum center-to-center distance between the closest tiles, as a multiple of tile size. */
const TILE_SPACING = 1.16;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function quad(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  };
}

/** Densely-sampled heraldic shield outline (percent coords), clockwise from top-left. */
function buildShieldOutline(): Point[] {
  const pts: Point[] = [];
  const seg = 36;
  const pushLine = (a: Point, b: Point) => {
    for (let i = 0; i < seg; i += 1) pts.push({ x: lerp(a.x, b.x, i / seg), y: lerp(a.y, b.y, i / seg) });
  };
  const pushQuad = (p0: Point, c: Point, p1: Point) => {
    for (let i = 0; i < seg; i += 1) pts.push(quad(p0, c, p1, i / seg));
  };
  const TL = { x: 15, y: 9 };
  const TR = { x: 85, y: 9 };
  const RS = { x: 85, y: 44 };
  const BP = { x: 50, y: 96 };
  const LS = { x: 15, y: 44 };
  pushLine(TL, TR); // flat top
  pushLine(TR, RS); // right shoulder
  pushQuad(RS, { x: 85, y: 84 }, BP); // right curve to point
  pushQuad(BP, { x: 15, y: 84 }, LS); // left curve from point
  pushLine(LS, TL); // left shoulder back up
  return pts;
}

/**
 * Densely-sampled SMOOTH 5-point star (percent coords), starting at the top tip. Built from a
 * polar curve r = base + amp·cos(5θ) so the tips and notches are rounded rather than sharp —
 * that keeps the curvature gentle everywhere, so evenly arc-spaced tiles stay evenly spaced in
 * 2D too (no bunching at tips → no overlap and no weird large gaps).
 */
function buildStarOutline(): Point[] {
  const pts: Point[] = [];
  const cx = 50;
  const cy = 52;
  const base = 38;
  const amp = 9;
  const points = 5;
  const samples = 240;
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const r = base + amp * Math.cos(points * t);
    const ang = t - Math.PI / 2; // start at the top tip
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}

/** Over this many tiles the shield can't hold fixed-size tiles cleanly, so switch to a star. */
const STAR_TILE_THRESHOLD = 25;

function outlineFor(totalTiles: number): Point[] {
  return totalTiles > STAR_TILE_THRESHOLD ? buildStarOutline() : buildShieldOutline();
}

/** Aspect ratio (height / width) of the board box for each shape. */
function boardAspectFor(totalTiles: number): number {
  return totalTiles > STAR_TILE_THRESHOLD ? 1 : 6 / 5;
}

/**
 * Smallest center-to-center distance between consecutive tiles, in "board-width units". The tiles
 * are round-ish (circular medallions / rounded-corner cards), so straight-line distance is the
 * right overlap test. Sizing the board so the CLOSEST pair sits `TILE_SPACING` tiles apart keeps
 * every tile clear of its neighbours while staying as tight as possible.
 */
function minTileGapUnits(positions: Point[], aspect: number): number {
  if (positions.length < 2) return 0.25;
  let min = Infinity;
  for (let i = 0; i < positions.length; i += 1) {
    const a = positions[i];
    const b = positions[(i + 1) % positions.length];
    const dx = (a.x - b.x) / 100;
    const dy = ((a.y - b.y) / 100) * aspect;
    min = Math.min(min, Math.hypot(dx, dy));
  }
  return min > 0 && Number.isFinite(min) ? min : 0.25;
}

/** Evenly distribute n tiles by arc length around a closed outline. */
function distributeAlongOutline(outline: Point[], n: number): Point[] {
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < outline.length; i += 1) {
    total += Math.hypot(outline[i].x - outline[i - 1].x, outline[i].y - outline[i - 1].y);
    cum.push(total);
  }
  // close the loop
  const last = outline[outline.length - 1];
  total += Math.hypot(outline[0].x - last.x, outline[0].y - last.y);

  const result: Point[] = [];
  for (let k = 0; k < n; k += 1) {
    const target = (k / n) * total;
    let i = 1;
    while (i < cum.length && cum[i] < target) i += 1;
    if (i >= cum.length) {
      result.push(outline[outline.length - 1]);
      continue;
    }
    const segLen = cum[i] - cum[i - 1];
    const t = segLen > 0 ? (target - cum[i - 1]) / segLen : 0;
    result.push({
      x: lerp(outline[i - 1].x, outline[i].x, t),
      y: lerp(outline[i - 1].y, outline[i].y, t),
    });
  }
  return result;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Arranges kinds so no two adjacent tiles share a kind AND the two broad categories
 * ("card" vs. every medallion kind) don't clump on one side of the board — cards and
 * medallions are interleaved as evenly as their counts allow.
 */
function arrangeSpread(pool: TileKind[]): TileKind[] {
  const isCard = (kind: TileKind) => kind === "card";
  const valid = (candidate: TileKind[]) =>
    candidate.every((kind, i) => {
      if (i === 0) return true;
      if (kind === candidate[i - 1]) return false;
      // Disallow 3-in-a-row of the same category (all cards or all medallions).
      if (i >= 2 && isCard(kind) === isCard(candidate[i - 1]) && isCard(kind) === isCard(candidate[i - 2])) return false;
      return true;
    });

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const candidate = shuffle(pool);
    if (valid(candidate)) return candidate;
  }

  // Deterministic fallback: evenly interleave cards and medallions, then fill each
  // stream most-frequent-kind-first into alternating slots so no kind repeats back to back.
  const cards = pool.filter(isCard);
  const medallions = pool.filter((kind) => !isCard(kind));
  const result: TileKind[] = [];
  const cardStep = cards.length > 0 ? medallions.length / cards.length : Infinity;
  let medallionCursor = 0;
  let nextCardAt = cardStep / 2;
  const counts = new Map<TileKind, number>();
  medallions.forEach((kind) => counts.set(kind, (counts.get(kind) ?? 0) + 1));
  const sortedMedallions = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const medallionQueue: TileKind[] = [];
  let idx = 0;
  sortedMedallions.forEach(([kind, count]) => {
    for (let i = 0; i < count; i += 1) {
      if (idx >= medallions.length) idx = 1;
      medallionQueue[idx] = kind;
      idx += 2;
    }
  });
  let cardsPlaced = 0;
  for (let i = 0; i < pool.length; i += 1) {
    if (cardsPlaced < cards.length && i >= nextCardAt) {
      result.push("card");
      cardsPlaced += 1;
      nextCardAt += cardStep + 1;
    } else if (medallionCursor < medallionQueue.length) {
      result.push(medallionQueue[medallionCursor]);
      medallionCursor += 1;
    } else {
      result.push("card");
      cardsPlaced += 1;
    }
  }
  return result;
}

/** Board Dash is capped at this many total tiles (incl. start/finish) so a huge deck can't run away. */
const MAX_TOTAL_TILES = 60;

function buildBoard(
  cards: CardData[],
  actions: ActionItem[],
  medallionCounts: Record<BoardDashMedallionKind, number>,
  cardLimit: number,
): BoardTile[] {
  const shuffledCards = shuffle(cards);
  const actionPool = shuffle(actions);
  const cardCount = Math.max(0, Math.min(shuffledCards.length, Math.round(cardLimit)));
  const cardPool = shuffledCards.slice(0, cardCount);

  let pool: TileKind[] = [
    ...BOARD_DASH_MEDALLION_KINDS.flatMap((kind) => Array(Math.max(0, Math.round(medallionCounts[kind] ?? 0))).fill(kind)),
    ...Array(cardCount).fill("card" as TileKind),
  ];
  if (pool.length === 0) {
    // Nothing configured — fall back to a small, playable default so the board isn't empty.
    pool = Array(6).fill("move" as TileKind);
  }
  pool = pool.slice(0, Math.max(0, MAX_TOTAL_TILES - 2));

  const middleKinds = arrangeSpread(pool);
  const total = middleKinds.length + 2;
  const positions = distributeAlongOutline(outlineFor(total), total);
  let cardCursor = 0;
  let actionCursor = 0;

  return positions.map((pos, index) => {
    let kind: TileKind;
    if (index === 0) kind = "start";
    else if (index === total - 1) kind = "finish";
    else kind = middleKinds[index - 1] ?? "move";

    const tile: BoardTile = { index, kind, pos };
    if (kind === "card" && cardPool.length > 0) {
      tile.card = cardPool[cardCursor % cardPool.length];
      cardCursor += 1;
    } else if (kind === "move" && actionPool.length > 0) {
      tile.action = actionPool[actionCursor % actionPool.length];
      actionCursor += 1;
    }
    return tile;
  });
}

const TILE_META: Record<TileKind, { label: string; emoji: string }> = {
  start: { label: "Start", emoji: "🏁" },
  finish: { label: "Finish", emoji: "🏆" },
  card: { label: "Card", emoji: "🃏" },
  move: { label: "Move", emoji: "🎭" },
  bonus: { label: "Bonus +1", emoji: "✨" },
  back3: { label: "Back 3", emoji: "💨" },
  rollAgain: { label: "Roll Again", emoji: "🎲" },
  steal: { label: "Steal", emoji: "🪙" },
};

const TILE_ICON: Partial<Record<TileKind, string>> = {
  ...BOARD_DASH_ICONS,
};

export const boardDashPlugin: MiniGamePlugin = {
  id: "boardDash",
  title: "Board Dash",
  description: "Roll the dice and race your token to the finish, answering cards and doing actions.",
  Component: ({ encounter, onComplete, setHeaderAction, setScoreOverlay, setTransitionCue }) => {
    const cardLibrary = useBattleStore((state) => state.cardLibrary);
    const setBattleProgress = useBattleStore((state) => state.setBattleProgress);
    const setOverlayState = useBattleStore((state) => state.setOverlayState);

    const eligibleCards = useMemo(
      () => cardLibrary.filter((card) => encounter.boardDashCardIds.includes(card.id)),
      [cardLibrary, encounter.boardDashCardIds],
    );
    const actionItems = encounter.actionItems;
    const medallionCounts = encounter.boardDashMedallionCounts;
    const cardLimit = encounter.boardDashCardLimit;

    const [board, setBoard] = useState<BoardTile[]>([]);
    const [phase, setPhase] = useState<BoardPhase>("intro");
    const [currentSide, setCurrentSide] = useState<Side>("hero");
    const [positions, setPositions] = useState<Record<Side, number>>({ hero: 0, villain: 0 });
    const [dice, setDice] = useState(1);
    const [spinning, setSpinning] = useState(false);
    const [activeTile, setActiveTile] = useState<BoardTile | null>(null);
    const [challenges, setChallenges] = useState<Record<Side, number>>({ hero: 0, villain: 0 });
    const [statusText, setStatusText] = useState("Press Start Game.");
    const [lastLanding, setLastLanding] = useState<LastLanding | null>(null);
    const [winner, setWinner] = useState<Side | null>(null);

    const finishIndex = board.length > 0 ? board.length - 1 : DEFAULT_TILE_COUNT - 1;
    const useStarShape = board.length > STAR_TILE_THRESHOLD;
    const trackOutline = useMemo(() => outlineFor(board.length), [board.length]);
    const timersRef = useRef<number[]>([]);
    const startCueRef = useRef(false);
    const scoreFx = useScoreFeedback(challenges.hero, challenges.villain);

    const clearTimers = useCallback(() => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    }, []);

    const setup = useCallback(() => {
      clearTimers();
      setBoard(buildBoard(eligibleCards, actionItems, medallionCounts, cardLimit));
      setPhase("intro");
      setCurrentSide("hero");
      setPositions({ hero: 0, villain: 0 });
      setDice(1);
      setSpinning(false);
      setActiveTile(null);
      setChallenges({ hero: 0, villain: 0 });
      setWinner(null);
      setStatusText("Press Start Game.");
      setLastLanding(null);
      startCueRef.current = false;
      setOverlayState("none");
      setBattleProgress({ phase: "setup", currentRound: 1 });
    }, [actionItems, cardLimit, clearTimers, eligibleCards, medallionCounts, setBattleProgress, setOverlayState]);

    useEffect(() => {
      setup();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eligibleCards.length, actionItems.length, cardLimit, JSON.stringify(medallionCounts)]);

    useEffect(() => () => clearTimers(), [clearTimers]);

    const sideName = useCallback(
      (side: Side) => (side === "hero" ? encounter.hero.name : encounter.villain.name),
      [encounter.hero.name, encounter.villain.name],
    );

    const endTurn = useCallback(
      (lastSide: Side) => {
        const next: Side = lastSide === "hero" ? "villain" : "hero";
        setCurrentSide(next);
        setActiveTile(null);
        setPhase("rolling");
        // Keep the center message showing what the last player did — the turn banner and the
        // header "Roll for…" button already tell the next player it's their turn.
        setTransitionCue({ text: `${next === "hero" ? "HERO" : "VILLAIN"} TURN`, type: "turn", side: next });
      },
      [setTransitionCue],
    );

    const continueTurn = useCallback(
      (side: Side) => {
        setActiveTile(null);
        setPhase("rolling");
        // Leave the "landed on Roll Again" description on the board — don't replace it with a prompt.
        setTransitionCue({ text: "ROLL AGAIN", type: "turn", side });
      },
      [setTransitionCue],
    );

    const finishGame = useCallback(
      (winningSide: Side) => {
        clearTimers();
        setWinner(winningSide);
        setPhase("gameComplete");
        setStatusText(`${sideName(winningSide)} reached the finish!`);
        const finalChallenges = { ...challenges };
        onComplete({
          miniGameId: "boardDash",
          winner: winningSide,
          heroScore: finalChallenges.hero + (winningSide === "hero" ? 3 : 0),
          villainScore: finalChallenges.villain + (winningSide === "villain" ? 3 : 0),
          scoreDifference: 3,
        });
      },
      [challenges, clearTimers, onComplete, sideName],
    );

    const announceLanding = useCallback((side: Side, tile: BoardTile, detail: string) => {
      const label = tile.card ? tile.card.title : TILE_META[tile.kind].label;
      setLastLanding({
        title: `${sideName(side)} landed on ${label}`,
        detail,
        icon: TILE_ICON[tile.kind] ?? null,
      });
    }, [sideName]);

    const resolveLanding = useCallback(
      (side: Side, landedIndex: number) => {
        const tile = board[landedIndex];
        if (!tile) {
          endTurn(side);
          return;
        }
        // All messages describe what the character just did (the last move) and stay on the
        // board — never an instruction like "roll again" or "do it on camera".
        if (tile.kind === "card" && tile.card) {
          setActiveTile(tile);
          setPhase("resolve");
          setStatusText(`${sideName(side)} landed on a Card`);
          announceLanding(side, tile, "Answer the question in English.");
          return;
        }
        if (tile.kind === "move" && tile.action) {
          setActiveTile(tile);
          setPhase("resolve");
          setStatusText(`${sideName(side)} landed on a Move`);
          announceLanding(side, tile, tile.action.text);
          return;
        }
        if (tile.kind === "back3") {
          const target = Math.max(0, landedIndex - 3);
          setStatusText(`${sideName(side)} landed on Back 3 — moved back 3 spaces`);
          announceLanding(side, tile, "Moved back 3 spaces.");
          const id = window.setTimeout(() => {
            setPositions((prev) => ({ ...prev, [side]: target }));
            endTurn(side);
          }, 520);
          timersRef.current.push(id);
          return;
        }
        if (tile.kind === "bonus") {
          setStatusText(`${sideName(side)} landed on Bonus — +1 point`);
          announceLanding(side, tile, "Gained +1 point.");
          setChallenges((prev) => ({ ...prev, [side]: prev[side] + 1 }));
          const id = window.setTimeout(() => endTurn(side), 520);
          timersRef.current.push(id);
          return;
        }
        if (tile.kind === "steal") {
          const other: Side = side === "hero" ? "villain" : "hero";
          setStatusText(`${sideName(side)} landed on Steal — took a point`);
          announceLanding(side, tile, "Stole 1 point from the opponent.");
          setChallenges((prev) => ({ ...prev, [side]: prev[side] + 1, [other]: Math.max(0, prev[other] - 1) }));
          const id = window.setTimeout(() => endTurn(side), 520);
          timersRef.current.push(id);
          return;
        }
        if (tile.kind === "rollAgain") {
          setStatusText(`${sideName(side)} landed on Roll Again`);
          announceLanding(side, tile, "Takes another turn.");
          const id = window.setTimeout(() => continueTurn(side), 520);
          timersRef.current.push(id);
          return;
        }
        // start / move without an assigned action
        setStatusText(`${sideName(side)} moved forward`);
        announceLanding(side, tile, "Moved forward.");
        const id = window.setTimeout(() => endTurn(side), 600);
        timersRef.current.push(id);
      },
      [announceLanding, board, continueTurn, endTurn, sideName],
    );

    const animateMove = useCallback(
      (side: Side, from: number, steps: number) => {
        setPhase("moving");
        let step = 0;
        const hop = () => {
          step += 1;
          const nextPos = Math.min(finishIndex, from + step);
          setPositions((prev) => ({ ...prev, [side]: nextPos }));
          if (nextPos >= finishIndex) {
            const id = window.setTimeout(() => finishGame(side), STEP_MS + 120);
            timersRef.current.push(id);
            return;
          }
          if (step >= steps) {
            const id = window.setTimeout(() => resolveLanding(side, nextPos), STEP_MS + 80);
            timersRef.current.push(id);
            return;
          }
          const id = window.setTimeout(hop, STEP_MS);
          timersRef.current.push(id);
        };
        const id = window.setTimeout(hop, STEP_MS);
        timersRef.current.push(id);
      },
      [finishGame, finishIndex, resolveLanding],
    );

    const rollDice = useCallback(() => {
      if (phase !== "rolling") return;
      setSpinning(true);
      setStatusText(`${sideName(currentSide)} is rolling...`);
      const rolled = 1 + Math.floor(Math.random() * 6);
      const id = window.setTimeout(() => {
        setDice(rolled);
        setSpinning(false);
        setStatusText(`${sideName(currentSide)} rolled ${rolled}!`);
        animateMove(currentSide, positions[currentSide], rolled);
      }, ROLL_SPIN_MS);
      timersRef.current.push(id);
    }, [animateMove, currentSide, phase, positions, sideName]);

    const startGame = useCallback(() => {
      if (phase !== "intro") return;
      setPhase("rolling");
      setCurrentSide("hero");
      setStatusText(`${sideName("hero")}, roll the dice!`);
      setBattleProgress({ phase: "inProgress", currentRound: 1 });
    }, [phase, sideName, setBattleProgress]);

    const completeChallenge = useCallback(() => {
      if (phase !== "resolve") return;
      const side = currentSide;
      setChallenges((prev) => ({ ...prev, [side]: prev[side] + 1 }));
      endTurn(side);
    }, [currentSide, endTurn, phase]);

    useEffect(() => {
      if (phase === "rolling" && !startCueRef.current) {
        setTransitionCue({ text: "BOARD DASH", type: "start" });
        startCueRef.current = true;
      }
    }, [phase, setTransitionCue]);

    // Header controls per phase.
    useEffect(() => {
      if (phase === "intro") {
        setHeaderAction(
          <button type="button" data-icon="start" className="is-phase-action" onClick={startGame}>
            Start Game
          </button>,
        );
      } else if (phase === "rolling") {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="dice" className="is-phase-action" onClick={rollDice}>
              Roll for {currentSide === "hero" ? "Hero" : "Villain"}
            </button>
          </div>,
        );
      } else if (phase === "resolve") {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="next" className="is-phase-action" onClick={completeChallenge}>
              Done — Next Turn
            </button>
          </div>,
        );
      } else if (phase === "gameComplete") {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="restart" onClick={setup}>
              Restart Board Dash
            </button>
          </div>,
        );
      } else {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="wait" disabled>
              Moving...
            </button>
          </div>,
        );
      }
      return () => setHeaderAction(null);
    }, [phase, currentSide, completeChallenge, rollDice, setHeaderAction, setup, startGame]);

    // Score overlay (challenges done + lead).
    useEffect(() => {
      setScoreOverlay(
        <div className="mini-game-score-banner">
          <span className="mini-game-score-label">Board Dash — Challenges</span>
          <div className="mini-game-score-values">
            <div className="mini-score-value-wrap">
              <strong className={`mini-score-value hero ${scoreFx.heroPopTick % 2 ? "is-pop" : ""}`}>
                {challenges.hero}
              </strong>
            </div>
            <span>:</span>
            <div className="mini-score-value-wrap">
              <strong className={`mini-score-value villain ${scoreFx.villainPopTick % 2 ? "is-pop" : ""}`}>
                {challenges.villain}
              </strong>
            </div>
          </div>
          <small>{statusText}</small>
        </div>,
      );
      return () => setScoreOverlay(null);
    }, [challenges.hero, challenges.villain, scoreFx.heroPopTick, scoreFx.villainPopTick, setScoreOverlay, statusText]);

    const hasMedallions = BOARD_DASH_MEDALLION_KINDS.some((kind) => (medallionCounts[kind] ?? 0) > 0);
    if (eligibleCards.length === 0 && actionItems.length === 0 && !hasMedallions) {
      return (
        <div className="board-dash-game">
          <div className="mini-game-result">
            Add cards, medallions, or Action Items to Board Dash in Edit Mode to play.
          </div>
        </div>
      );
    }

    // Tiles (and the PNGs inside them) are a FIXED size — never scaled by tile count. Instead the
    // whole board box grows so the CLOSEST pair of fixed-size tiles never overlaps, and the shape
    // switches to a star once the shield can no longer hold them cleanly.
    const boardAspect = boardAspectFor(board.length);
    const gapUnits = minTileGapUnits(board.map((tile) => tile.pos), boardAspect);
    const boardWidthPx = Math.round(
      Math.max(430, Math.min(2200, (BOARD_TILE_PX * TILE_SPACING) / gapUnits)),
    );
    const projectionPadding = computeBoardProjectionPadding(boardWidthPx, boardWidthPx * boardAspect);
    return (
      <div className="board-dash-game" style={{
        "--board-projection-inline": `${projectionPadding.inline}px`,
        "--board-projection-bottom": `${projectionPadding.bottom}px`,
      } as CSSProperties}>
        <div className="board-dash-dice-dock" aria-label="Board Dash dice">
          <Dice3D value={dice} spinning={spinning} side={currentSide} />
          <span>{phase === "rolling" ? `Roll for ${currentSide === "hero" ? "Hero" : "Villain"}` : `Dice: ${dice}`}</span>
        </div>

        <div
          className={`board-dash-board ${useStarShape ? "is-star" : ""}`}
          style={{
            width: `calc(${boardWidthPx}px * var(--play-area-zoom))`,
            aspectRatio: useStarShape ? "1 / 1" : "5 / 6",
            ["--tile" as string]: `calc(${BOARD_TILE_PX}px * var(--play-area-zoom))`,
          }}
        >
          <div
            className="board-dash-track"
            aria-hidden="true"
            style={{ clipPath: `polygon(${trackOutline.map((p) => `${p.x}% ${p.y}%`).join(",")})` }}
          />

          {board.map((tile) => {
            const heroHere = positions.hero === tile.index;
            const villainHere = positions.villain === tile.index;
            const meta = TILE_META[tile.kind];
            const iconSrc = TILE_ICON[tile.kind];
            const isActive = activeTile?.index === tile.index && phase === "resolve";
            const showImage = tile.kind === "card" && !!tile.card?.image;
            return (
              <div
                key={tile.index}
                className={`board-tile board-tile--${tile.kind} ${isActive ? "is-active" : ""} ${showImage ? "has-image" : ""}`}
                style={{ left: `${tile.pos.x}%`, top: `${tile.pos.y}%` }}
              >
                {showImage ? <img className="board-tile-image" src={tile.card!.image} alt="" /> : null}
                <div className="board-tile-face">
                  {!showImage && iconSrc ? <img className="board-tile-icon" src={iconSrc} alt="" /> : null}
                  {!showImage && !iconSrc ? <span className="board-tile-emoji">{meta.emoji}</span> : null}
                  <span className="board-tile-label">{tile.card ? tile.card.title : meta.label}</span>
                </div>
                <div className="board-tile-tokens">
                  {heroHere ? (
                    <span key={`h-${positions.hero}`} className="board-token board-token--hero is-hopping">
                      <span className="board-token-shadow" aria-hidden="true" />
                      <span className="board-token-pawn">
                        {encounter.hero.portrait ? <img src={encounter.hero.portrait} alt="" /> : "🦸"}
                      </span>
                    </span>
                  ) : null}
                  {villainHere ? (
                    <span key={`v-${positions.villain}`} className="board-token board-token--villain is-hopping">
                      <span className="board-token-shadow" aria-hidden="true" />
                      <span className="board-token-pawn">
                        {encounter.villain.portrait ? <img src={encounter.villain.portrait} alt="" /> : "👹"}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}

          <div className="board-dash-center">
            {lastLanding && phase !== "gameComplete" ? (
              <div className="board-dash-lastmove">
                <strong className="board-dash-lastmove-title">{lastLanding.title}</strong>
                {lastLanding.icon ? <img className="board-dash-lastmove-icon" src={lastLanding.icon} alt="" /> : null}
                <span className="board-dash-lastmove-detail">{lastLanding.detail}</span>
              </div>
            ) : (
              <p className="board-dash-status">{statusText}</p>
            )}
            {phase === "resolve" && activeTile ? (
              <div className="board-resolve-panel board-resolve-panel--inside">
                {activeTile.kind === "card" && activeTile.card ? (
                  <div className="board-resolve-card motion-card is-foil">
                    <img src={activeTile.card.image} alt={activeTile.card.title} />
                    <div className="board-resolve-caption">
                      <strong>{activeTile.card.title}</strong>
                      {activeTile.card.boardDashQuestion ? (
                        <span className="board-resolve-question">{activeTile.card.boardDashQuestion}</span>
                      ) : activeTile.card.description ? (
                        <span>{activeTile.card.description}</span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="board-resolve-action">
                    <span className="board-resolve-action-emoji">{activeTile.action?.emoji ?? "鹿"}</span>
                    <strong>{activeTile.action?.text ?? "Do an action!"}</strong>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {phase === "resolve" && activeTile ? (
          <div className="board-resolve-panel">
            {activeTile.kind === "card" && activeTile.card ? (
              <div className="board-resolve-card motion-card is-foil">
                <img src={activeTile.card.image} alt={activeTile.card.title} />
                <div className="board-resolve-caption">
                  <strong>{activeTile.card.title}</strong>
                  {activeTile.card.boardDashQuestion ? (
                    <span className="board-resolve-question">{activeTile.card.boardDashQuestion}</span>
                  ) : activeTile.card.description ? (
                    <span>{activeTile.card.description}</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="board-resolve-action">
                <span className="board-resolve-action-emoji">{activeTile.action?.emoji ?? "🎭"}</span>
                <strong>{activeTile.action?.text ?? "Do an action!"}</strong>
              </div>
            )}
          </div>
        ) : null}

        {phase === "gameComplete" && winner ? (
          <div className="mini-game-result board-dash-result">
            🏆 {sideName(winner)} wins Board Dash!
          </div>
        ) : null}
      </div>
    );
  },
};
