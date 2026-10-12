import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFlipListMotion, useShakeFeedback } from "../../animations/cardMotion";
import { useScoreFeedback } from "../../animations/scoreFeedback";
import { useBattleStore } from "../../store/battleStore";
import type { CardData } from "../../types/game";
import type { MiniGamePlugin } from "../types";

type LanePhase = "intro" | "playing" | "result" | "gameComplete";
type Side = "hero" | "villain";

interface HandCard {
  instanceId: string;
  card: CardData;
  laneValue: number;
  spent: boolean;
}

interface PowerCard {
  id: string;
  title: string;
  image: string;
}

interface LaneScores {
  hero: number;
  villain: number;
}

interface RoundResult {
  winner: Side | "draw";
  message: string;
  heroDelta: number;
  villainDelta: number;
}

type CardRarity = "common" | "rare" | "epic" | "legendary";

function pickRandomCard(cards: CardData[]): CardData | null {
  if (cards.length === 0) return null;
  return cards[Math.floor(Math.random() * cards.length)];
}

function availableLaneValues(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function pickUniqueLaneValue(preferred: number, usedValues: Set<number>): number {
  const boundedPreferred = Math.max(1, Math.min(12, preferred));
  if (!usedValues.has(boundedPreferred)) return boundedPreferred;
  const free = availableLaneValues().filter((value) => !usedValues.has(value));
  if (free.length === 0) return boundedPreferred;
  return free[Math.floor(Math.random() * free.length)];
}

function createHandCard(card: CardData, side: Side, counter: number, laneValue: number): HandCard {
  return { instanceId: `${side}-${card.id}-${counter}`, card, laneValue, spent: false };
}

function finalWinnerText(scores: LaneScores): string {
  if (scores.hero > scores.villain) return "Hero wins Lane Battle.";
  if (scores.villain > scores.hero) return "Villain wins Lane Battle.";
  return "Lane Battle ends in a draw.";
}

function resolveRound(heroValue: number, villainValue: number): RoundResult {
  if (heroValue > villainValue) {
    return {
      winner: "hero",
      message: "Hero played the higher value and won the Special Card.",
      heroDelta: 1,
      villainDelta: 0,
    };
  }

  if (villainValue > heroValue) {
    return {
      winner: "villain",
      message: "Villain played the higher value and won the Special Card.",
      heroDelta: 0,
      villainDelta: 1,
    };
  }

  return {
    winner: "draw",
    message: "Both played equal values. Special Card is not awarded this turn.",
    heroDelta: 0,
    villainDelta: 0,
  };
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

export const laneBattlePlugin: MiniGamePlugin = {
  id: "laneBattle",
  title: "Lane Battle",
  description: "Manual bigger-card-wins duel with spent cards per turn and round-based refill.",
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
            (!card.miniGames || card.miniGames.includes("laneBattle")),
        ),
      [cardLibrary, encounter.selectedCardIds],
    );

    const maxRounds = Math.max(1, encounter.roundSettings?.roundCount ?? 5);
    const heroCounterRef = useRef(0);
    const villainCounterRef = useRef(0);
    const resolvedTurnRef = useRef(false);
    const completedRef = useRef(false);

    const [phase, setPhase] = useState<LanePhase>("intro");
    const [round, setRound] = useState(1);
    const [heroHand, setHeroHand] = useState<HandCard[]>([]);
    const [villainHand, setVillainHand] = useState<HandCard[]>([]);
    const [heroSelectedId, setHeroSelectedId] = useState<string | null>(null);
    const [villainSelectedId, setVillainSelectedId] = useState<string | null>(null);
    const [heroPlayedId, setHeroPlayedId] = useState<string | null>(null);
    const [villainPlayedId, setVillainPlayedId] = useState<string | null>(null);
    const [powerCard, setPowerCard] = useState<PowerCard | null>(null);
    const [laneScores, setLaneScores] = useState<LaneScores>({ hero: 0, villain: 0 });
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
    const [gameResultText, setGameResultText] = useState("");
    const [powerActionText, setPowerActionText] = useState("");
    const previousRoundRef = useRef(1);
    const gameStartCueShownRef = useRef(false);
    const heroHandIds = useMemo(() => heroHand.map((entry) => entry.instanceId), [heroHand]);
    const villainHandIds = useMemo(() => villainHand.map((entry) => entry.instanceId), [villainHand]);
    const { bindFlipItem: bindHeroHandCard } = useFlipListMotion(heroHandIds);
    const { bindFlipItem: bindVillainHandCard } = useFlipListMotion(villainHandIds);
    const { triggerShake, shakeClassName } = useShakeFeedback();
    const scoreFx = useScoreFeedback(laneScores.hero, laneScores.villain);

    const buildPowerCard = useCallback((): PowerCard | null => {
      if (selectedCards.length === 0) return null;
      const base = pickRandomCard(selectedCards);
      if (!base) return null;
      return {
        id: `power-${Date.now()}-${Math.random()}`,
        title: "",
        image: base.image,
      };
    }, [selectedCards]);

    const drawHand = useCallback((side: Side, counterRef: MutableRefObject<number>): HandCard[] => {
      const hand: HandCard[] = [];
      const usedValues = new Set<number>();
      for (let i = 0; i < 3; i += 1) {
        const card = pickRandomCard(selectedCards);
        if (!card) break;
        counterRef.current += 1;
        const laneValue = pickUniqueLaneValue(card.value, usedValues);
        usedValues.add(laneValue);
        hand.push(createHandCard(card, side, counterRef.current, laneValue));
      }
      return hand;
    }, [selectedCards]);

    const setupGame = useCallback(() => {
      heroCounterRef.current = 0;
      villainCounterRef.current = 0;
      resolvedTurnRef.current = false;
      setHeroHand(drawHand("hero", heroCounterRef));
      setVillainHand(drawHand("villain", villainCounterRef));
      setHeroSelectedId(null);
      setVillainSelectedId(null);
      setHeroPlayedId(null);
      setVillainPlayedId(null);
      setPowerCard(null);
      setLaneScores({ hero: 0, villain: 0 });
      setRoundResult(null);
      setGameResultText("");
      setPowerActionText("");
      setRound(1);
      previousRoundRef.current = 1;
      setPhase("intro");
      completedRef.current = false;
      setOverlayState("none");
      setBattleProgress({ phase: "setup", currentRound: 1 });
    }, [drawHand, setBattleProgress, setOverlayState]);

    useEffect(() => {
      setupGame();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCards, maxRounds]);

    const startGame = useCallback(() => {
      if (phase !== "intro") return;
      if (heroHand.length === 0 || villainHand.length === 0) {
        setPhase("gameComplete");
        setGameResultText("Not enough cards to start Lane Battle.");
        return;
      }
      setPowerCard(buildPowerCard());
      setPhase("playing");
      setBattleProgress({ phase: "inProgress", currentRound: 1 });
    }, [buildPowerCard, heroHand.length, phase, setBattleProgress, villainHand.length]);

    useEffect(() => {
      if (phase === "intro") {
        gameStartCueShownRef.current = false;
      }
      if (phase === "playing" && !gameStartCueShownRef.current) {
        setTransitionCue({ text: "LANE BATTLE", type: "start" });
        const timerId = window.setTimeout(() => {
          setTransitionCue({ text: `ROUND ${round}`, type: "round" });
        }, 260);
        gameStartCueShownRef.current = true;
        return () => window.clearTimeout(timerId);
      }
      return undefined;
    }, [phase, round, setTransitionCue]);

    useEffect(() => {
      if (phase !== "playing") return;
      if (round === previousRoundRef.current) return;
      setTransitionCue({ text: `ROUND ${round}`, type: "round" });
      previousRoundRef.current = round;
    }, [phase, round, setTransitionCue]);

    useEffect(() => {
      setScoreOverlay(
        <div className="mini-game-score-banner">
          <span className="mini-game-score-label">Special Cards Won</span>
          <div className="mini-game-score-values">
            <div className="mini-score-value-wrap">
              <strong
                className={`mini-score-value hero ${scoreFx.heroPopTick % 2 ? "is-pop" : ""} ${scoreFx.heroSweepTick % 2 ? "is-sweep" : ""}`}
              >
                {laneScores.hero}
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
                {laneScores.villain}
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
            Round {round}/{maxRounds} | {phase}
          </small>
        </div>,
      );
      return () => setScoreOverlay(null);
    }, [laneScores.hero, laneScores.villain, maxRounds, phase, round, setScoreOverlay]);

    const playHeroCard = (instanceId: string) => {
      if (phase !== "playing" || heroPlayedId) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      const card = heroHand.find((item) => item.instanceId === instanceId);
      if (!card || card.spent) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      setHeroSelectedId(instanceId);
      if (consumeBattleEffectCharge("powerBoost", "hero")) {
        setHeroHand((prev) =>
          prev.map((entry) =>
            entry.instanceId === instanceId
              ? { ...entry, laneValue: Math.min(12, entry.laneValue + 1) }
              : entry,
          ),
        );
        setPowerActionText("Hero consumed Power Boost (+1 lane value).");
      }
      setHeroPlayedId(instanceId);
    };

    const playVillainCard = (instanceId: string) => {
      if (phase !== "playing" || villainPlayedId) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      const card = villainHand.find((item) => item.instanceId === instanceId);
      if (!card || card.spent) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      setVillainSelectedId(instanceId);
      if (consumeBattleEffectCharge("powerBoost", "villain")) {
        setVillainHand((prev) =>
          prev.map((entry) =>
            entry.instanceId === instanceId
              ? { ...entry, laneValue: Math.min(12, entry.laneValue + 1) }
              : entry,
          ),
        );
        setPowerActionText("Villain consumed Power Boost (+1 lane value).");
      }
      setVillainPlayedId(instanceId);
    };

    const heroCardClick = (instanceId: string) => {
      if (phase !== "playing" || heroPlayedId) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      const card = heroHand.find((item) => item.instanceId === instanceId);
      if (!card || card.spent) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      setHeroSelectedId(instanceId);
    };

    const villainCardClick = (instanceId: string) => {
      if (phase !== "playing" || villainPlayedId) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      const card = villainHand.find((item) => item.instanceId === instanceId);
      if (!card || card.spent) {
        triggerShake(`lane-${instanceId}`);
        return;
      }
      setVillainSelectedId(instanceId);
    };

    useEffect(() => {
      if (phase !== "playing") return;
      if (!heroPlayedId || !villainPlayedId || !powerCard) return;
      if (resolvedTurnRef.current) return;

      const heroCard = heroHand.find((card) => card.instanceId === heroPlayedId);
      const villainCard = villainHand.find((card) => card.instanceId === villainPlayedId);
      if (!heroCard || !villainCard) return;

      const result = resolveRound(heroCard.laneValue, villainCard.laneValue);
      resolvedTurnRef.current = true;
      setRoundResult(result);
      setHeroHand((prev) =>
        prev.map((card) => (card.instanceId === heroCard.instanceId ? { ...card, spent: true } : card)),
      );
      setVillainHand((prev) =>
        prev.map((card) => (card.instanceId === villainCard.instanceId ? { ...card, spent: true } : card)),
      );
      setLaneScores((prev) => ({
        hero: prev.hero + result.heroDelta,
        villain: prev.villain + result.villainDelta,
      }));
      setPhase("result");
    }, [phase, heroPlayedId, villainPlayedId, powerCard, heroHand, villainHand]);

    const hasMoreTurnsThisRound =
      heroHand.some((card) => !card.spent) && villainHand.some((card) => !card.spent);

    const nextStep = useCallback(() => {
      if (phase !== "result") return;

      setHeroSelectedId(null);
      setVillainSelectedId(null);
      setHeroPlayedId(null);
      setVillainPlayedId(null);
      setRoundResult(null);
      setPowerActionText("");
      resolvedTurnRef.current = false;

      if (hasMoreTurnsThisRound) {
        setPowerCard(buildPowerCard());
        setPhase("playing");
        setBattleProgress({ currentRound: round, phase: "inProgress" });
        setOverlayState("none");
        return;
      }

      if (round >= maxRounds) {
        setGameResultText(finalWinnerText(laneScores));
        setPhase("gameComplete");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            miniGameId: "laneBattle",
            winner:
              laneScores.hero > laneScores.villain
                ? "hero"
                : laneScores.villain > laneScores.hero
                  ? "villain"
                  : "draw",
            heroScore: laneScores.hero,
            villainScore: laneScores.villain,
            scoreDifference: Math.abs(laneScores.hero - laneScores.villain),
          });
        }
        return;
      }

      const next = round + 1;
      setRound(next);
      setHeroHand(drawHand("hero", heroCounterRef));
      setVillainHand(drawHand("villain", villainCounterRef));
      setPowerCard(buildPowerCard());
      setPhase("playing");
      setBattleProgress({ currentRound: next, phase: "inProgress" });
      setOverlayState("none");
    }, [
      buildPowerCard,
      drawHand,
      hasMoreTurnsThisRound,
      laneScores,
      maxRounds,
      onComplete,
      phase,
      round,
      setBattleProgress,
      setOverlayState,
    ]);

    useEffect(() => {
      if (phase === "intro") {
        setHeaderAction(
          <button type="button" data-icon="start" className="is-phase-action" onClick={startGame}>
            Start Game
          </button>,
        );
        return () => setHeaderAction(null);
      }

      const actions: JSX.Element[] = [];

      if (phase === "playing" && heroSelectedId && !heroPlayedId) {
        actions.push(
          <button
            key="hero-retry"
            type="button"
            data-icon="retry"
            onClick={() => {
              if (!consumeBattleEffectCharge("retry", "hero")) return;
              setHeroSelectedId(null);
              setPowerActionText("Hero used Retry and may re-pick.");
            }}
            disabled={battleEffects.retryCharges.hero <= 0}
          >
            Hero Retry
          </button>,
        );
      }

      if (phase === "playing" && villainSelectedId && !villainPlayedId) {
        actions.push(
          <button
            key="villain-retry"
            type="button"
            data-icon="retry"
            onClick={() => {
              if (!consumeBattleEffectCharge("retry", "villain")) return;
              setVillainSelectedId(null);
              setPowerActionText("Villain used Retry and may re-pick.");
            }}
            disabled={battleEffects.retryCharges.villain <= 0}
          >
            Villain Retry
          </button>,
        );
      }

      if (phase === "result") {
        actions.push(
          <button key="next-step" type="button" data-icon="next" className="is-phase-action" onClick={nextStep}>
            {hasMoreTurnsThisRound ? "Next Turn" : "Next Round"}
          </button>,
        );
      }

      if (phase === "gameComplete") {
        actions.push(
          <button key="restart-lane" type="button" data-icon="restart" onClick={setupGame}>
            Restart Lane Battle
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
      battleEffects.retryCharges.hero,
      battleEffects.retryCharges.villain,
      consumeBattleEffectCharge,
      hasMoreTurnsThisRound,
      heroPlayedId,
      heroSelectedId,
      nextStep,
      phase,
      setHeaderAction,
      setupGame,
      startGame,
      villainPlayedId,
      villainSelectedId,
    ]);

    const heroPlayedCard = heroHand.find((card) => card.instanceId === heroPlayedId) ?? null;
    const villainPlayedCard = villainHand.find((card) => card.instanceId === villainPlayedId) ?? null;
    const heroSelectedCard = heroHand.find((card) => card.instanceId === heroSelectedId) ?? null;
    const villainSelectedCard = villainHand.find((card) => card.instanceId === villainSelectedId) ?? null;
    const heroSlotCard = heroPlayedCard ?? heroSelectedCard;
    const villainSlotCard = villainPlayedCard ?? villainSelectedCard;

    if (selectedCards.length < 1) {
      return (
        <div className="mini-game-placeholder">
          <h3>Lane Battle</h3>
          <p>Select cards assigned to Lane Battle in Edit Mode to play.</p>
        </div>
      );
    }

    return (
      <div className="lane-battle">
        <div className="mini-game-hud">
          <span>Lane Battle</span>
          <span>
            Round {round}/{maxRounds}
          </span>
          <span>Phase: {phase}</span>
          <span>
            Special Cards {laneScores.hero}:{laneScores.villain}
          </span>
          <span>
            Boost Hx{battleEffects.powerBoostCharges.hero} Vx{battleEffects.powerBoostCharges.villain}
          </span>
          <span>
            Retry Hx{battleEffects.retryCharges.hero} Vx{battleEffects.retryCharges.villain}
          </span>
        </div>

        <div className="lane-arena">
          {/* Left column - Hero deck cards stacked vertically */}
          <section className="lane-deck lane-hero-deck">
            <div className="lane-hand-grid">
              {heroHand.map((handCard, index) => {
                const isSelected = heroSelectedId === handCard.instanceId;
                const isPlayed = heroPlayedId === handCard.instanceId;
                const hash = hashString(handCard.card.title || handCard.card.id);
                const rarity = rarityFromValue(handCard.card.value);
                return (
                  <button
                    key={handCard.instanceId}
                    type="button"
                    ref={bindHeroHandCard(handCard.instanceId)}
                    className={`lane-card card-rarity-${rarity} ${isSelected ? "is-selected-hero" : ""} ${
                      handCard.spent || isPlayed ? "is-spent" : ""
                    } motion-card ${shakeClassName(`lane-${handCard.instanceId}`)}`}
                    style={{
                      ["--card-hue-a" as string]: `${hash % 360}`,
                      ["--card-hue-b" as string]: `${(hash + 74) % 360}`,
                    }}
                    onClick={() => heroCardClick(handCard.instanceId)}
                    onDoubleClick={() => playHeroCard(handCard.instanceId)}
                    disabled={phase !== "playing" || !!heroPlayedId || handCard.spent}
                  >
                    <img src={handCard.card.image} alt={handCard.card.title} />
                    <small className="lane-card-badge">H{index + 1}</small>
                    <span className="lane-card-value-overlay">{handCard.laneValue}</span>
                    <div className="lane-card-caption">
                      <strong>{handCard.card.title}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Center column — Play slots + Special card */}
          <section className="lane-board">
            <div className="lane-board-inner">
              <div className="lane-play-slot lane-play-slot-left">
                <p>Player Card Slot</p>
                {heroSlotCard ? (
                  <div className="lane-slot-card lane-slot-card-hero">
                    <img src={heroSlotCard.card.image} alt={heroSlotCard.card.title} />
                    <span className="lane-card-value-overlay">{heroSlotCard.laneValue}</span>
                    <div className="lane-card-caption">
                      <strong>{heroSlotCard.card.title}</strong>
                    </div>
                  </div>
                ) : (
                  <span className="lane-slot-empty">Empty</span>
                )}
              </div>

              <div className="lane-clash-card lane-game-card">
                {powerCard ? (
                  <img src={powerCard.image} alt="Center card" />
                ) : (
                  <span className="lane-slot-empty">Empty</span>
                )}
              </div>

              <div className="lane-play-slot lane-play-slot-right">
                <p>Player Card Slot</p>
                {villainSlotCard ? (
                  <div className="lane-slot-card lane-slot-card-villain">
                    <img src={villainSlotCard.card.image} alt={villainSlotCard.card.title} />
                    <span className="lane-card-value-overlay">{villainSlotCard.laneValue}</span>
                    <div className="lane-card-caption">
                      <strong>{villainSlotCard.card.title}</strong>
                    </div>
                  </div>
                ) : (
                  <span className="lane-slot-empty">Empty</span>
                )}
              </div>
            </div>
            {roundResult ? <p className="lane-result-text">{roundResult.message}</p> : null}
          </section>

          {/* Right column — Villain deck cards stacked vertically */}
          <section className="lane-deck lane-villain-deck">
            <div className="lane-hand-grid">
              {villainHand.map((handCard, index) => {
                const isSelected = villainSelectedId === handCard.instanceId;
                const isPlayed = villainPlayedId === handCard.instanceId;
                const hash = hashString(handCard.card.title || handCard.card.id);
                const rarity = rarityFromValue(handCard.card.value);
                return (
                  <button
                    key={handCard.instanceId}
                    type="button"
                    ref={bindVillainHandCard(handCard.instanceId)}
                    className={`lane-card card-rarity-${rarity} ${isSelected ? "is-selected-villain" : ""} ${
                      handCard.spent || isPlayed ? "is-spent" : ""
                    } motion-card ${shakeClassName(`lane-${handCard.instanceId}`)}`}
                    style={{
                      ["--card-hue-a" as string]: `${hash % 360}`,
                      ["--card-hue-b" as string]: `${(hash + 74) % 360}`,
                    }}
                    onClick={() => villainCardClick(handCard.instanceId)}
                    onDoubleClick={() => playVillainCard(handCard.instanceId)}
                    disabled={phase !== "playing" || !!villainPlayedId || handCard.spent}
                  >
                    <img src={handCard.card.image} alt={handCard.card.title} />
                    <small className="lane-card-badge">V{index + 1}</small>
                    <span className="lane-card-value-overlay">{handCard.laneValue}</span>
                    <div className="lane-card-caption">
                      <strong>{handCard.card.title}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        {phase === "playing" ? (
          <p className="mini-game-result">Click a deck card once to select, then double-click to play it into the slot.</p>
        ) : null}
        {phase === "playing" && powerActionText ? <p className="mini-game-result">{powerActionText}</p> : null}
        {phase === "result" ? (
          <p className="mini-game-result">
            {hasMoreTurnsThisRound ? "Turn resolved. Press Next Turn." : "Round resolved. Press Next Round."}
          </p>
        ) : null}
        {phase === "gameComplete" ? <p className="mini-game-result complete">{gameResultText}</p> : null}
      </div>
    );
  },
};
