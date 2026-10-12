import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFlipListMotion, useShakeFeedback } from "../../animations/cardMotion";
import { useScoreFeedback } from "../../animations/scoreFeedback";
import { useBattleStore } from "../../store/battleStore";
import type { CardData } from "../../types/game";
import type { MiniGamePlugin } from "../types";

type TurnSide = "hero" | "villain";

type MatchPairsPhase =
  | "start"
  | "heroTurn"
  | "villainTurn"
  | "firstCardSelected"
  | "secondCardSelected"
  | "checkingMatch"
  | "matchSuccess"
  | "matchFail"
  | "turnSwap"
  | "gameComplete";

interface MatchTile {
  tileId: string;
  card: CardData;
  isMatched: boolean;
  isFaceUp: boolean;
  matchedBy?: TurnSide;
}

interface LocalScores {
  hero: number;
  villain: number;
}

type CardRarity = "common" | "rare" | "epic" | "legendary";

function shuffle<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = cloned[i];
    cloned[i] = cloned[j];
    cloned[j] = current;
  }
  return cloned;
}

function computeGrid(totalTiles: number): { cols: number; rows: number } {
  const cols = Math.max(2, Math.round(Math.sqrt(totalTiles)));
  const rows = Math.ceil(totalTiles / cols);
  return { cols, rows };
}

function getWinnerText(scores: LocalScores): string {
  if (scores.hero > scores.villain) return "Hero wins Match Pairs.";
  if (scores.villain > scores.hero) return "Villain wins Match Pairs.";
  return "Match Pairs ended in a draw.";
}

function hashString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rarityFromValue(value: number): CardRarity {
  if (value >= 10) return "legendary";
  if (value >= 7) return "epic";
  if (value >= 4) return "rare";
  return "common";
}

export const matchPairsPlugin: MiniGamePlugin = {
  id: "matchPairs",
  title: "Match Pairs",
  description: "Manual teacher-controlled turn-based matching mini-game.",
  Component: ({ encounter, onComplete, setHeaderAction, setScoreOverlay, setTransitionCue }) => {
    const cardLibrary = useBattleStore((state) => state.cardLibrary);
    const battleEffects = useBattleStore((state) => state.battleEffects);
    const setBattleProgress = useBattleStore((state) => state.setBattleProgress);
    const setOverlayState = useBattleStore((state) => state.setOverlayState);
    const consumeBattleEffectCharge = useBattleStore((state) => state.consumeBattleEffectCharge);

    const selectedCards = useMemo(
      () =>
        cardLibrary.filter(
          (card) =>
            encounter.selectedCardIds.includes(card.id) &&
            (!card.miniGames || card.miniGames.includes("matchPairs")),
        ),
      [cardLibrary, encounter.selectedCardIds],
    );

    const [tiles, setTiles] = useState<MatchTile[]>([]);
    const [phase, setPhase] = useState<MatchPairsPhase>("start");
    const [turn, setTurn] = useState<TurnSide>("hero");
    const [selectorIndex, setSelectorIndex] = useState(0);
    const [firstPickIndex, setFirstPickIndex] = useState<number | null>(null);
    const [secondPickIndex, setSecondPickIndex] = useState<number | null>(null);
    const [localScores, setLocalScores] = useState<LocalScores>({ hero: 0, villain: 0 });
    const [winnerText, setWinnerText] = useState("");
    const [gameStarted, setGameStarted] = useState(false);
    const [peekTileId, setPeekTileId] = useState<string | null>(null);
    const [peekText, setPeekText] = useState("");
    const [recentMatchTileIds, setRecentMatchTileIds] = useState<string[]>([]);

    const timeoutRef = useRef<number[]>([]);
    const peekTimeoutRef = useRef<number | null>(null);
    const completedRef = useRef(false);
    const previousTurnRef = useRef<TurnSide>("hero");
    const gameStartCueShownRef = useRef(false);
    const tileIds = useMemo(() => tiles.map((tile) => tile.tileId), [tiles]);
    const { bindFlipItem: bindTileMotion } = useFlipListMotion(tileIds);
    const { triggerShake, shakeClassName } = useShakeFeedback();
    const scoreFx = useScoreFeedback(localScores.hero, localScores.villain);

    const { cols } = useMemo(() => computeGrid(tiles.length || 2), [tiles.length]);

    const clearTimers = () => {
      timeoutRef.current.forEach((timer) => window.clearTimeout(timer));
      timeoutRef.current = [];
      if (peekTimeoutRef.current !== null) {
        window.clearTimeout(peekTimeoutRef.current);
        peekTimeoutRef.current = null;
      }
    };

    const setupBoard = () => {
      clearTimers();
      const baseCards = selectedCards;
      const pairedTiles = shuffle(
        baseCards.flatMap((card) => [
          { tileId: `${card.id}-a`, card, isMatched: false, isFaceUp: false },
          { tileId: `${card.id}-b`, card, isMatched: false, isFaceUp: false },
        ]),
      );
      setTiles(pairedTiles);
      setPhase("start");
      setTurn("hero");
      setSelectorIndex(0);
      setFirstPickIndex(null);
      setSecondPickIndex(null);
      setLocalScores({ hero: 0, villain: 0 });
      setWinnerText("");
      setGameStarted(false);
      setPeekTileId(null);
      setPeekText("");
      setRecentMatchTileIds([]);
      completedRef.current = false;
      setOverlayState("none");
    };

    useEffect(() => {
      setupBoard();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCards]);

    useEffect(() => {
      return () => clearTimers();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePeek = (side: TurnSide) => {
      if (!gameStarted || phase === "gameComplete") return;
      if (!consumeBattleEffectCharge("peek", side)) return;
      const hiddenTiles = tiles.filter((tile) => !tile.isMatched && !tile.isFaceUp);
      if (hiddenTiles.length === 0) return;
      const revealed = hiddenTiles[Math.floor(Math.random() * hiddenTiles.length)];
      if (!revealed) return;
      setPeekTileId(revealed.tileId);
      setPeekText(`${side === "hero" ? "Hero" : "Villain"} peeked ${revealed.card.title}.`);
      if (peekTimeoutRef.current !== null) {
        window.clearTimeout(peekTimeoutRef.current);
      }
      peekTimeoutRef.current = window.setTimeout(() => {
        setPeekTileId(null);
        setPeekText("");
        peekTimeoutRef.current = null;
      }, 1400);
    };

    const isSelectableTile = (index: number): boolean => {
      const tile = tiles[index];
      if (!tile) return false;
      if (tile.isMatched) return false;
      if (tile.isFaceUp) return false;
      return true;
    };

    const beginGame = useCallback(() => {
      if (phase !== "start" || tiles.length === 0) return;
      setGameStarted(true);
      setPhase("heroTurn");
      setBattleProgress({ phase: "inProgress", currentRound: 1 });
    }, [phase, setBattleProgress, tiles.length]);

    useEffect(() => {
      if (!gameStarted) {
        gameStartCueShownRef.current = false;
        setHeaderAction(
          <button type="button" data-icon="start" className="is-phase-action" onClick={beginGame}>
            Start Game
          </button>,
        );
        return () => setHeaderAction(null);
      }

      const actions: JSX.Element[] = [];

      if (phase !== "gameComplete") {
        actions.push(
          <button
            key="hero-peek"
            type="button"
            data-icon="peek"
            onClick={() => handlePeek("hero")}
            disabled={battleEffects.peekCharges.hero <= 0}
          >
            Hero Peek
          </button>,
        );
        actions.push(
          <button
            key="villain-peek"
            type="button"
            data-icon="peek"
            onClick={() => handlePeek("villain")}
            disabled={battleEffects.peekCharges.villain <= 0}
          >
            Villain Peek
          </button>,
        );
      }

      if (phase === "gameComplete") {
        actions.push(
          <button key="restart-matchpairs" type="button" data-icon="restart" onClick={setupBoard}>
            Restart
          </button>,
        );
      }

      if (actions.length > 0) {
        setHeaderAction(<div className="mini-game-toolbar-actions">{actions}</div>);
      } else {
        setHeaderAction(null);
      }
      return () => setHeaderAction(null);
    }, [
      battleEffects.peekCharges.hero,
      battleEffects.peekCharges.villain,
      beginGame,
      gameStarted,
      phase,
      setHeaderAction,
    ]);

    useEffect(() => {
      if (gameStarted && !gameStartCueShownRef.current) {
        setTransitionCue({ text: "MATCH PAIRS", type: "start" });
        gameStartCueShownRef.current = true;
      }
    }, [gameStarted, setTransitionCue]);

    useEffect(() => {
      if (!gameStarted) return;
      if (phase !== "heroTurn" && phase !== "villainTurn") return;
      if (previousTurnRef.current === turn && phase !== "heroTurn" && phase !== "villainTurn") return;
      setTransitionCue({
        text: turn === "hero" ? "HERO'S TURN" : "VILLAIN'S TURN",
        type: "turn",
        side: turn,
      });
      previousTurnRef.current = turn;
    }, [gameStarted, phase, setTransitionCue, turn]);

    useEffect(() => {
      setScoreOverlay(
        <div className="mini-game-score-banner">
          <span className="mini-game-score-label">Match Pairs Score</span>
          <div className="mini-game-score-values">
            <div className="mini-score-value-wrap">
              <strong
                className={`mini-score-value hero ${scoreFx.heroPopTick % 2 ? "is-pop" : ""} ${scoreFx.heroSweepTick % 2 ? "is-sweep" : ""}`}
              >
                {localScores.hero}
              </strong>
              {scoreFx.particles
                .filter((particle) => particle.side === "hero")
                .map((particle) => (
                  <span key={particle.id} className="mini-score-particle mini-score-particle--hero">
                    {particle.text}
                  </span>
                ))}
            </div>
            <span>:</span>
            <div className="mini-score-value-wrap">
              <strong
                className={`mini-score-value villain ${scoreFx.villainPopTick % 2 ? "is-pop" : ""} ${scoreFx.villainSweepTick % 2 ? "is-sweep" : ""}`}
              >
                {localScores.villain}
              </strong>
              {scoreFx.particles
                .filter((particle) => particle.side === "villain")
                .map((particle) => (
                  <span key={particle.id} className="mini-score-particle mini-score-particle--villain">
                    {particle.text}
                  </span>
                ))}
            </div>
          </div>
          <small>
            {phase} | Turn {turn === "hero" ? "Hero" : "Villain"}
          </small>
        </div>,
      );
      return () => setScoreOverlay(null);
    }, [localScores.hero, localScores.villain, phase, setScoreOverlay, turn]);

    const moveSelector = (rowDelta: number, colDelta: number) => {
      if (phase === "checkingMatch" || phase === "matchSuccess" || phase === "matchFail" || phase === "turnSwap") {
        return;
      }
      const row = Math.floor(selectorIndex / cols);
      const col = selectorIndex % cols;
      const nextRow = Math.max(0, Math.floor((tiles.length - 1) / cols) >= 0 ? row + rowDelta : 0);
      const maxRow = Math.floor((tiles.length - 1) / cols);
      const boundedRow = Math.min(Math.max(0, nextRow), maxRow);
      let boundedCol = Math.min(Math.max(0, col + colDelta), cols - 1);
      let nextIndex = boundedRow * cols + boundedCol;

      while (nextIndex >= tiles.length && boundedCol > 0) {
        boundedCol -= 1;
        nextIndex = boundedRow * cols + boundedCol;
      }

      if (nextIndex >= 0 && nextIndex < tiles.length) {
        setSelectorIndex(nextIndex);
      }
    };

    const cancelFirstPick = () => {
      if (phase !== "firstCardSelected" || firstPickIndex === null) return;
      setTiles((prev) => prev.map((tile, index) => (index === firstPickIndex ? { ...tile, isFaceUp: false } : tile)));
      setFirstPickIndex(null);
      setPhase(turn === "hero" ? "heroTurn" : "villainTurn");
    };

    const resolveTurnAfterSecondPick = (firstIndex: number, secondIndex: number) => {
      setPhase("checkingMatch");

      const firstTile = tiles[firstIndex];
      const secondTile = tiles[secondIndex];
      const isMatch = firstTile.card.id === secondTile.card.id;
      const scoringSide = turn;

      const checkTimer = window.setTimeout(() => {
        if (isMatch) {
          setRecentMatchTileIds([firstTile.tileId, secondTile.tileId]);
          setTiles((prev) =>
            prev.map((tile, index) =>
              index === firstIndex || index === secondIndex ? { ...tile, isMatched: true, matchedBy: scoringSide } : tile,
            ),
          );
          setLocalScores((prev) => {
            const updated =
              turn === "hero" ? { ...prev, hero: prev.hero + 1 } : { ...prev, villain: prev.villain + 1 };
            return updated;
          });
          setPhase("matchSuccess");
        } else {
          setPhase("matchFail");
        }

        const postResultTimer = window.setTimeout(() => {
          setRecentMatchTileIds([]);
          if (!isMatch) {
            setTiles((prev) =>
              prev.map((tile, index) =>
                index === firstIndex || index === secondIndex ? { ...tile, isFaceUp: false } : tile,
              ),
            );
          }

          setFirstPickIndex(null);
          setSecondPickIndex(null);

          const allMatched = isMatch
            ? tiles.filter((tile, index) => tile.isMatched || index === firstIndex || index === secondIndex).length ===
              tiles.length
            : tiles.filter((tile) => tile.isMatched).length === tiles.length;

          if (allMatched) {
            const finalScores =
              turn === "hero"
                ? { ...localScores, hero: localScores.hero + (isMatch ? 1 : 0) }
                : { ...localScores, villain: localScores.villain + (isMatch ? 1 : 0) };
            setWinnerText(getWinnerText(finalScores));
            setPhase("gameComplete");
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete({
                miniGameId: "matchPairs",
                winner:
                  finalScores.hero > finalScores.villain
                    ? "hero"
                    : finalScores.villain > finalScores.hero
                      ? "villain"
                      : "draw",
                heroScore: finalScores.hero,
                villainScore: finalScores.villain,
                scoreDifference: Math.abs(finalScores.hero - finalScores.villain),
              });
            }
            return;
          }

          setPhase("turnSwap");
          const swapTimer = window.setTimeout(() => {
            const nextTurn: TurnSide = turn === "hero" ? "villain" : "hero";
            setTurn(nextTurn);
            setPhase(nextTurn === "hero" ? "heroTurn" : "villainTurn");
          }, 450);
          timeoutRef.current.push(swapTimer);
        }, 850);

        timeoutRef.current.push(postResultTimer);
      }, 500);

      timeoutRef.current.push(checkTimer);
    };

    const selectTile = (index: number) => {
      if (!gameStarted) return;
      if (
        phase !== "heroTurn" &&
        phase !== "villainTurn" &&
        phase !== "firstCardSelected"
      ) {
        const pendingTile = tiles[index];
        if (pendingTile) triggerShake(`match-${pendingTile.tileId}`);
        return;
      }
      if (!isSelectableTile(index)) {
        const blockedTile = tiles[index];
        if (blockedTile) triggerShake(`match-${blockedTile.tileId}`);
        return;
      }

      if (firstPickIndex === null) {
        setTiles((prev) => prev.map((tile, tileIndex) => (tileIndex === index ? { ...tile, isFaceUp: true } : tile)));
        setFirstPickIndex(index);
        setSelectorIndex(index);
        setPhase("firstCardSelected");
        return;
      }

      if (index === firstPickIndex) return;

      setTiles((prev) => prev.map((tile, tileIndex) => (tileIndex === index ? { ...tile, isFaceUp: true } : tile)));
      setSecondPickIndex(index);
      setSelectorIndex(index);
      setPhase("secondCardSelected");
      resolveTurnAfterSecondPick(firstPickIndex, index);
    };

    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveSelector(-1, 0);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveSelector(1, 0);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveSelector(0, -1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveSelector(0, 1);
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectTile(selectorIndex);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelFirstPick();
        }
      };

      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectorIndex, tiles, phase, firstPickIndex, gameStarted, turn]);

    if (selectedCards.length < 2) {
      return (
        <div className="mini-game-placeholder">
          <h3>Match Pairs</h3>
          <p>Select at least two cards assigned to Match Pairs in Edit Mode to play.</p>
        </div>
      );
    }

    return (
      <div className="match-pairs">
        <div className="mini-game-hud">
          <span>Match Pairs</span>
          <span>Phase: {phase}</span>
          <span>Turn: {turn === "hero" ? "Hero" : "Villain"}</span>
          <span>
            Score {localScores.hero}:{localScores.villain}
          </span>
          <span>
            Peek Hx{battleEffects.peekCharges.hero} Vx{battleEffects.peekCharges.villain}
          </span>
        </div>

        <div
          className={`match-grid ${turn === "hero" ? "is-turn-hero" : "is-turn-villain"}`}
          style={{
            gridTemplateColumns: `repeat(${computeGrid(tiles.length || 2).cols}, max-content)`,
          }}
        >
          {tiles.map((tile, index) => {
            const isFocused = selectorIndex === index;
            const isPicked = firstPickIndex === index || secondPickIndex === index;
            const cardHash = hashString(tile.card.title || tile.card.id);
            const rarity = rarityFromValue(tile.card.value);
            const cardClass = [
              "match-tile",
              "motion-card",
              `card-rarity-${rarity}`,
              isFocused ? "is-focused" : "",
              isPicked ? "is-picked" : "",
              tile.isMatched ? "is-matched" : "",
              tile.matchedBy === "hero" ? "is-matched-hero" : "",
              tile.matchedBy === "villain" ? "is-matched-villain" : "",
              recentMatchTileIds.includes(tile.tileId) ? "is-recent-match" : "",
              tile.isFaceUp || tile.isMatched ? "is-up" : "is-down",
              shakeClassName(`match-${tile.tileId}`),
            ]
              .filter(Boolean)
              .join(" ");
            const isFaceUp = tile.isFaceUp || tile.isMatched || tile.tileId === peekTileId;

            return (
              <button
                key={tile.tileId}
                type="button"
                ref={bindTileMotion(tile.tileId)}
                className={cardClass}
                style={{
                  ["--swirl-duration" as string]: `${2600 + (tile.tileId.length * 173 + index * 97) % 1800}ms`,
                  ["--swirl-angle" as string]: `${(tile.tileId.length * 47 + index * 29) % 360}deg`,
                  ["--card-hue-a" as string]: `${cardHash % 360}`,
                  ["--card-hue-b" as string]: `${(cardHash + 68) % 360}`,
                }}
                onClick={() => selectTile(index)}
                disabled={!gameStarted || phase === "checkingMatch" || phase === "turnSwap" || phase === "gameComplete"}
              >
                <div className={`card-flip3d ${isFaceUp ? "is-flipped" : ""}`}>
                  <div className="card-face card-face--back">
                    <span>?</span>
                    {isPicked ? <span className="match-selected-indicator">Selected</span> : null}
                  </div>
                  <div className="card-face card-face--front">
                    <img src={tile.card.image} alt={tile.card.title} />
                    <div className="match-tile-caption">
                      <strong>{tile.card.title}</strong>
                      <small>Value {tile.card.value}</small>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {peekText ? <p className="mini-game-result">{peekText}</p> : null}
        {phase === "matchSuccess" ? <p className="mini-game-result success">{turn} scored +1 (matched pair).</p> : null}
        {phase === "matchSuccess" ? (
          <div className={`match-confetti match-confetti--${turn}`} aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <span key={index} style={{ ["--i" as string]: index }} />
            ))}
          </div>
        ) : null}
        {phase === "matchFail" ? <p className="mini-game-result fail">No match. Turn will swap.</p> : null}
        {phase === "turnSwap" ? <p className="mini-game-result">Swapping turns...</p> : null}
        {phase === "gameComplete" ? <p className="mini-game-result complete">{winnerText}</p> : null}
      </div>
    );
  },
};
