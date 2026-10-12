import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFlipListMotion, useShakeFeedback } from "../../animations/cardMotion";
import { useScoreFeedback } from "../../animations/scoreFeedback";
import { useBattleStore } from "../../store/battleStore";
import type { MiniGamePlugin } from "../types";

type Side = "hero" | "villain";
type OpenBoxPhase = "intro" | "selecting" | "revealing" | "revealed" | "gameComplete";
type BoxEffectType = "gain1" | "gain2" | "lose1" | "nothing" | "steal1";

interface BoxEffect {
  type: BoxEffectType;
  label: string;
}

interface OpenBoxItem {
  id: string;
  index: number;
  effect: BoxEffect;
  opened: boolean;
}

interface Scores {
  hero: number;
  villain: number;
}

interface StealFx {
  id: number;
  from: Side;
  to: Side;
}

function pickRandomEffect(): BoxEffect {
  const roll = Math.random();
  if (roll < 0.26) return { type: "gain1", label: "+1 point" };
  if (roll < 0.44) return { type: "gain2", label: "+2 points" };
  if (roll < 0.62) return { type: "lose1", label: "lose 1 point" };
  if (roll < 0.82) return { type: "nothing", label: "nothing" };
  return { type: "steal1", label: "steal 1 point" };
}

function computeGrid(boxCount: number): { cols: number; rows: number } {
  const cols = Math.max(2, Math.ceil(Math.sqrt(boxCount)));
  const rows = Math.ceil(boxCount / cols);
  return { cols, rows };
}

function buildBoxes(boxCount: number): OpenBoxItem[] {
  return Array.from({ length: boxCount }, (_, i) => ({
    id: `box-${i + 1}`,
    index: i + 1,
    effect: pickRandomEffect(),
    opened: false,
  }));
}

function finalWinnerText(scores: Scores): string {
  if (scores.hero > scores.villain) return "Hero wins Open the Box.";
  if (scores.villain > scores.hero) return "Villain wins Open the Box.";
  return "Open the Box ends in a draw.";
}

function applyEffect(effect: BoxEffect, side: Side, scores: Scores): Scores {
  let hero = scores.hero;
  let villain = scores.villain;

  if (effect.type === "gain1") {
    if (side === "hero") hero += 1;
    else villain += 1;
  } else if (effect.type === "gain2") {
    if (side === "hero") hero += 2;
    else villain += 2;
  } else if (effect.type === "lose1") {
    if (side === "hero") hero = Math.max(0, hero - 1);
    else villain = Math.max(0, villain - 1);
  } else if (effect.type === "steal1") {
    if (side === "hero" && villain > 0) {
      villain -= 1;
      hero += 1;
    } else if (side === "villain" && hero > 0) {
      hero -= 1;
      villain += 1;
    }
  }

  return { hero, villain };
}

export const openBoxPlugin: MiniGamePlugin = {
  id: "openBox",
  title: "Open the Box",
  description: "Both players pick different boxes, then reveal together.",
  Component: ({ onComplete, setHeaderAction, setScoreOverlay, setTransitionCue }) => {
    const battleEffects = useBattleStore((state) => state.battleEffects);
    const setBattleProgress = useBattleStore((state) => state.setBattleProgress);
    const setOverlayState = useBattleStore((state) => state.setOverlayState);
    const consumeBattleEffectCharge = useBattleStore((state) => state.consumeBattleEffectCharge);

    const boxCount = useMemo(() => 12, []);

    const { cols, rows } = useMemo(() => computeGrid(boxCount), [boxCount]);

    const [phase, setPhase] = useState<OpenBoxPhase>("intro");
    const [boxes, setBoxes] = useState<OpenBoxItem[]>([]);
    const [heroSelected, setHeroSelected] = useState<string | null>(null);
    const [villainSelected, setVillainSelected] = useState<string | null>(null);
    const [scores, setScores] = useState<Scores>({ hero: 0, villain: 0 });
    const [round, setRound] = useState(1);
    const [statusText, setStatusText] = useState("Press Start Game.");
    const [resultText, setResultText] = useState("");
    const [peekedBoxId, setPeekedBoxId] = useState<string | null>(null);
    const [peekText, setPeekText] = useState("");
    const [revealingBoxIds, setRevealingBoxIds] = useState<string[]>([]);
    const [stealFx, setStealFx] = useState<StealFx[]>([]);
    const previousRoundRef = useRef(1);
    const gameStartCueShownRef = useRef(false);
    const peekTimeoutRef = useRef<number | null>(null);
    const revealTimeoutRef = useRef<number | null>(null);
    const stealFxTimeoutRef = useRef<number | null>(null);
    const boxIds = useMemo(() => boxes.map((box) => box.id), [boxes]);
    const { bindFlipItem: bindBoxMotion } = useFlipListMotion(boxIds);
    const { triggerShake, shakeClassName } = useShakeFeedback();
    const scoreFx = useScoreFeedback(scores.hero, scores.villain);

    const unopenedCount = boxes.filter((box) => !box.opened).length;
    const clearPeek = () => {
      if (peekTimeoutRef.current !== null) {
        window.clearTimeout(peekTimeoutRef.current);
        peekTimeoutRef.current = null;
      }
      setPeekedBoxId(null);
      setPeekText("");
    };

    const setup = useCallback(() => {
      setBoxes(buildBoxes(boxCount));
      setPhase("intro");
      setHeroSelected(null);
      setVillainSelected(null);
      setScores({ hero: 0, villain: 0 });
      setRound(1);
      setStatusText("Press Start Game.");
      setResultText("");
      clearPeek();
      setRevealingBoxIds([]);
      setStealFx([]);
      setOverlayState("none");
      setBattleProgress({ phase: "setup", currentRound: 1 });
    }, [boxCount, setBattleProgress, setOverlayState]);

    useEffect(() => {
      setup();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boxCount]);

    useEffect(
      () => () => {
        if (peekTimeoutRef.current !== null) {
          window.clearTimeout(peekTimeoutRef.current);
        }
        if (revealTimeoutRef.current !== null) {
          window.clearTimeout(revealTimeoutRef.current);
        }
        if (stealFxTimeoutRef.current !== null) {
          window.clearTimeout(stealFxTimeoutRef.current);
        }
      },
      [],
    );

    const startGame = useCallback(() => {
      if (phase !== "intro") return;
      setPhase("selecting");
      setStatusText("Pick one different box for Hero and one for Villain.");
      setBattleProgress({ phase: "inProgress", currentRound: 1 });
    }, [phase, setBattleProgress]);

    useEffect(() => {
      if (phase === "intro") {
        gameStartCueShownRef.current = false;
      }
      if (phase === "selecting" && !gameStartCueShownRef.current) {
        setTransitionCue({ text: "OPEN THE BOX", type: "start" });
        const timerId = window.setTimeout(() => {
          setTransitionCue({ text: `ROUND ${round}`, type: "round" });
        }, 260);
        gameStartCueShownRef.current = true;
        return () => window.clearTimeout(timerId);
      }
      return undefined;
    }, [phase, round, setTransitionCue]);

    useEffect(() => {
      if (round === previousRoundRef.current) return;
      setTransitionCue({ text: `ROUND ${round}`, type: "round" });
      previousRoundRef.current = round;
    }, [round, setTransitionCue]);

    useEffect(() => {
      setScoreOverlay(
        <div className="mini-game-score-banner">
          <span className="mini-game-score-label">Open the Box Score</span>
          <div className="mini-game-score-values">
            <div className="mini-score-value-wrap">
              <strong
                className={`mini-score-value hero ${scoreFx.heroPopTick % 2 ? "is-pop" : ""} ${scoreFx.heroSweepTick % 2 ? "is-sweep" : ""}`}
              >
                {scores.hero}
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
                {scores.villain}
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
            Round {round} | {phase}
          </small>
        </div>,
      );
      return () => setScoreOverlay(null);
    }, [phase, round, scores.hero, scores.villain, setScoreOverlay]);

    const selectBox = (id: string) => {
      if (phase !== "selecting") {
        triggerShake(`box-${id}`);
        return;
      }
      const box = boxes.find((item) => item.id === id);
      if (!box || box.opened) {
        triggerShake(`box-${id}`);
        return;
      }

      if (!heroSelected) {
        setHeroSelected(id);
        return;
      }
      if (!villainSelected && id !== heroSelected) {
        setVillainSelected(id);
        return;
      }
      triggerShake(`box-${id}`);
    };

    const reveal = useCallback(() => {
      if (phase !== "selecting" || !heroSelected || !villainSelected) return;
      if (heroSelected === villainSelected) return;

      const heroBox = boxes.find((item) => item.id === heroSelected);
      const villainBox = boxes.find((item) => item.id === villainSelected);
      if (!heroBox || !villainBox) return;

      setPhase("revealing");
      setRevealingBoxIds([heroSelected, villainSelected]);
      clearPeek();
      setStatusText("Chests are opening...");

      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
      }

      revealTimeoutRef.current = window.setTimeout(() => {
        const heroStealTriggered = heroBox.effect.type === "steal1" && scores.villain > 0;
        const afterHero = applyEffect(heroBox.effect, "hero", scores);
        const villainStealTriggered = villainBox.effect.type === "steal1" && afterHero.hero > 0;
        const afterBoth = applyEffect(villainBox.effect, "villain", afterHero);

        setScores(afterBoth);
        setBoxes((prev) =>
          prev.map((item) =>
            item.id === heroSelected || item.id === villainSelected ? { ...item, opened: true } : item,
          ),
        );
        setPhase("revealed");
        setRevealingBoxIds([]);
        setStatusText(
          `Hero Box ${heroBox.index}: ${heroBox.effect.label} | Villain Box ${villainBox.index}: ${villainBox.effect.label}`,
        );

        const steals: StealFx[] = [];
        if (heroStealTriggered) {
          steals.push({ id: Date.now() + Math.random(), from: "villain", to: "hero" });
        }
        if (villainStealTriggered) {
          steals.push({ id: Date.now() + Math.random(), from: "hero", to: "villain" });
        }
        if (steals.length > 0) {
          setStealFx((current) => [...current, ...steals]);
          if (stealFxTimeoutRef.current !== null) {
            window.clearTimeout(stealFxTimeoutRef.current);
          }
          stealFxTimeoutRef.current = window.setTimeout(() => {
            setStealFx([]);
            stealFxTimeoutRef.current = null;
          }, 1600);
        }
        revealTimeoutRef.current = null;
      }, 520);
    }, [boxes, heroSelected, phase, scores, villainSelected]);

    const nextTurn = useCallback(() => {
      if (phase !== "revealed") return;
      const remaining = boxes.filter((box) => !box.opened).length;
      if (remaining < 2) {
        setPhase("gameComplete");
        setResultText(finalWinnerText(scores));
        onComplete({
          miniGameId: "openBox",
          winner: scores.hero > scores.villain ? "hero" : scores.villain > scores.hero ? "villain" : "draw",
          heroScore: scores.hero,
          villainScore: scores.villain,
          scoreDifference: Math.abs(scores.hero - scores.villain),
        });
        return;
      }

      const nextRound = round + 1;
      setRound(nextRound);
      setHeroSelected(null);
      setVillainSelected(null);
      setRevealingBoxIds([]);
      setPhase("selecting");
      clearPeek();
      setStatusText("Pick one different box for Hero and one for Villain.");
      setBattleProgress({ currentRound: nextRound, phase: "inProgress" });
      setOverlayState("none");
    }, [boxes, onComplete, phase, round, scores, setBattleProgress, setOverlayState]);

    const handlePeek = useCallback((side: Side) => {
      if (phase !== "selecting") return;
      if (!consumeBattleEffectCharge("peek", side)) return;
      const hidden = boxes.filter((box) => !box.opened);
      if (hidden.length === 0) return;
      const target = hidden[Math.floor(Math.random() * hidden.length)];
      if (!target) return;
      setPeekedBoxId(target.id);
      setPeekText(`${side === "hero" ? "Hero" : "Villain"} peeked Box ${target.index}: ${target.effect.label}.`);
      if (peekTimeoutRef.current !== null) {
        window.clearTimeout(peekTimeoutRef.current);
      }
      peekTimeoutRef.current = window.setTimeout(() => {
        setPeekedBoxId((current) => (current === target.id ? null : current));
        setPeekText("");
        peekTimeoutRef.current = null;
      }, 1400);
    }, [boxes, consumeBattleEffectCharge, phase]);

    useEffect(() => {
      if (phase === "intro") {
        setHeaderAction(
          <button type="button" data-icon="start" className="is-phase-action" onClick={startGame}>
            Start Game
          </button>,
        );
      } else if (phase === "selecting") {
        const actions: JSX.Element[] = [
          <button
            key="reveal"
            type="button"
            data-icon="reveal"
            className="is-phase-action"
            onClick={reveal}
            disabled={!heroSelected || !villainSelected}
          >
            Reveal
          </button>,
          <button
            key="hero-peek"
            type="button"
            data-icon="peek"
            onClick={() => handlePeek("hero")}
            disabled={battleEffects.peekCharges.hero <= 0}
          >
            Hero Peek
          </button>,
          <button
            key="villain-peek"
            type="button"
            data-icon="peek"
            onClick={() => handlePeek("villain")}
            disabled={battleEffects.peekCharges.villain <= 0}
          >
            Villain Peek
          </button>,
          <button
            key="hero-retry"
            type="button"
            data-icon="retry"
            onClick={() => {
              if (!consumeBattleEffectCharge("retry", "hero")) return;
              setHeroSelected(null);
            }}
            disabled={!heroSelected || battleEffects.retryCharges.hero <= 0}
          >
            Hero Retry
          </button>,
          <button
            key="villain-retry"
            type="button"
            data-icon="retry"
            onClick={() => {
              if (!consumeBattleEffectCharge("retry", "villain")) return;
              setVillainSelected(null);
            }}
            disabled={!villainSelected || battleEffects.retryCharges.villain <= 0}
          >
            Villain Retry
          </button>,
        ];
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            {actions}
          </div>,
        );
      } else if (phase === "revealing") {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="wait" disabled>
              Revealing...
            </button>
          </div>,
        );
      } else if (phase === "revealed") {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="next" className="is-phase-action" onClick={nextTurn}>
              Next Turn
            </button>
          </div>,
        );
      } else if (phase === "gameComplete") {
        setHeaderAction(
          <div className="mini-game-toolbar-actions">
            <button type="button" data-icon="restart" onClick={setup}>
              Restart Open the Box
            </button>
          </div>,
        );
      } else {
        setHeaderAction(null);
      }
      return () => setHeaderAction(null);
    }, [
      battleEffects.peekCharges.hero,
      battleEffects.peekCharges.villain,
      battleEffects.retryCharges.hero,
      battleEffects.retryCharges.villain,
      consumeBattleEffectCharge,
      heroSelected,
      phase,
      reveal,
      setHeaderAction,
      setup,
      startGame,
      villainSelected,
      nextTurn,
      handlePeek,
    ]);

    return (
      <div className="open-box-game">
        <div className="mini-game-hud">
          <span>Open the Box</span>
          <span>Round {round}</span>
          <span>Phase: {phase}</span>
          <span>
            Score {scores.hero}:{scores.villain}
          </span>
          <span>Left: {unopenedCount}</span>
          <span>
            Peek Hx{battleEffects.peekCharges.hero} Vx{battleEffects.peekCharges.villain}
          </span>
          <span>
            Retry Hx{battleEffects.retryCharges.hero} Vx{battleEffects.retryCharges.villain}
          </span>
        </div>

        <div className="open-box-picks compact">
          <span>Hero: {heroSelected ? heroSelected.replace("box-", "Box ") : "None"}</span>
          <span>Villain: {villainSelected ? villainSelected.replace("box-", "Box ") : "None"}</span>
        </div>
        <div className="mini-game-result">{phase === "gameComplete" ? resultText : statusText}</div>
        {peekText ? <div className="mini-game-result">{peekText}</div> : null}
        {stealFx.map((fx) => (
          <div
            key={fx.id}
            className={`open-box-steal-fx open-box-steal-fx--${fx.from}-to-${fx.to}`}
            aria-hidden="true"
          >
            <span>+1</span>
          </div>
        ))}

        <div className="open-box-grid-wrap">
          <div
            className="open-box-grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
              {boxes.map((box) => {
                const isHeroPick = heroSelected === box.id;
                const isVillainPick = villainSelected === box.id;
                const isFaceUp = box.opened || peekedBoxId === box.id;
                const isRevealing = revealingBoxIds.includes(box.id);
                return (
                  <button
                    key={box.id}
                    type="button"
                    ref={bindBoxMotion(box.id)}
                    className={`open-box-tile ${isHeroPick ? "is-hero-selected" : ""} ${
                      isVillainPick ? "is-villain-selected" : ""
                  } ${box.opened ? `is-opened effect-${box.effect.type}` : "is-closed"} ${
                      isRevealing ? "is-revealing" : ""
                    } motion-card ${shakeClassName(`box-${box.id}`)}`}
                    onClick={() => selectBox(box.id)}
                    disabled={phase !== "selecting" || box.opened}
                  >
                    <div className={`card-flip3d ${isFaceUp ? "is-flipped" : ""}`}>
                      <div className="card-face card-face--back open-box-card-back">
                        <span className="open-box-corner open-box-corner--tl">{box.index}</span>
                        <span className="open-box-back-number">{box.index}</span>
                        <span className="open-box-corner open-box-corner--br">{box.index}</span>
                        {(isHeroPick || isVillainPick) && !box.opened ? (
                          <span
                            className={`box-selected-indicator ${isHeroPick ? "is-hero" : "is-villain"}`}
                          >
                            {isHeroPick ? "Hero" : "Villain"}
                          </span>
                        ) : null}
                      </div>
                      <div className="card-face card-face--front">
                        <strong>Box {box.index}</strong>
                        <span>{box.effect.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    );
  },
};
