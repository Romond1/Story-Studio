import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFlipListMotion, useShakeFeedback } from "../../animations/cardMotion";
import { useScoreFeedback } from "../../animations/scoreFeedback";
import { useBattleStore } from "../../store/battleStore";
import type { CardData } from "../../types/game";
import type { MiniGamePlugin } from "../types";

type MemoryRevealPhase =
  | "preview"
  | "hide"
  | "targetHighlighted"
  | "roundResult";

const MEMORY_REVEAL_MAX_ROUNDS = 4;

function getCardsForRound(round: number): number {
  if (round <= 1) return 3;
  if (round === 2) return 4;
  if (round === 3) return 5;
  return 6;
}

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

function buildCandidatesWithTarget(cards: CardData[], targetIndex: number, limit: number): CardData[] {
  if (cards.length === 0) return [];
  const safeTargetIndex = Math.min(Math.max(targetIndex, 0), cards.length - 1);
  const targetCard = cards[safeTargetIndex];
  const others = cards.filter((_, index) => index !== safeTargetIndex);
  const count = Math.max(1, Math.min(limit, cards.length));
  const picked = [targetCard, ...shuffle(others).slice(0, Math.max(0, count - 1))];
  return shuffle(picked);
}

function getOutcomeText(heroHit: boolean, villainHit: boolean): string {
  if (heroHit && !villainHit) return "Hero wins this round.";
  if (!heroHit && villainHit) return "Villain wins this round.";
  if (heroHit && villainHit) return "Both found the target. Draw round.";
  return "Nobody found the target. Draw round.";
}

interface RoundState {
  cards: CardData[];
  targetIndex: number;
  heroChoiceId: string | null;
  villainChoiceId: string | null;
  heroCandidates: CardData[];
  villainCandidates: CardData[];
  revealedCardId: string | null;
  scored: boolean;
}

export const memoryRevealPlugin: MiniGamePlugin = {
  id: "memoryReveal",
  title: "Memory Reveal",
  description: "Teacher-controlled two-side memory reveal with manual selections and reveal.",
  Component: ({ encounter, progress, onComplete, setHeaderAction, setScoreOverlay, setTransitionCue }) => {
    const cardLibrary = useBattleStore((state) => state.cardLibrary);
    const battleEffects = useBattleStore((state) => state.battleEffects);
    const setBattleProgress = useBattleStore((state) => state.setBattleProgress);
    const setOverlayState = useBattleStore((state) => state.setOverlayState);
    const consumeBattleEffectCharge = useBattleStore((state) => state.consumeBattleEffectCharge);
    const completedRef = useRef(false);
    const peekTimeoutRef = useRef<number | null>(null);
    const previousRoundRef = useRef(1);
    const gameStartCueShownRef = useRef(false);

    const [phase, setPhase] = useState<MemoryRevealPhase>("preview");
    const [localScores, setLocalScores] = useState({ hero: 0, villain: 0 });
    const [roundState, setRoundState] = useState<RoundState>({
      cards: [],
      targetIndex: 0,
      heroChoiceId: null,
      villainChoiceId: null,
      heroCandidates: [],
      villainCandidates: [],
      revealedCardId: null,
      scored: false,
    });
    const [peekRevealCardId, setPeekRevealCardId] = useState<string | null>(null);
    const [peekText, setPeekText] = useState("");
    const { triggerShake, shakeClassName } = useShakeFeedback();
    const heroCandidateKeys = useMemo(
      () => roundState.heroCandidates.map((card, index) => `hero-candidate-${card.id}-${index}`),
      [roundState.heroCandidates],
    );
    const villainCandidateKeys = useMemo(
      () => roundState.villainCandidates.map((card, index) => `villain-candidate-${card.id}-${index}`),
      [roundState.villainCandidates],
    );
    const memoryCardKeys = useMemo(
      () => roundState.cards.map((card, index) => `memory-grid-${card.id}-${index}`),
      [roundState.cards],
    );
    const { bindFlipItem: bindHeroCandidate } = useFlipListMotion(heroCandidateKeys);
    const { bindFlipItem: bindVillainCandidate } = useFlipListMotion(villainCandidateKeys);
    const { bindFlipItem: bindMemoryCard } = useFlipListMotion(memoryCardKeys);
    const scoreFx = useScoreFeedback(localScores.hero, localScores.villain);

    const currentRound = Math.min(Math.max(progress.currentRound, 1), MEMORY_REVEAL_MAX_ROUNDS);
    const selectedCards = useMemo(
      () =>
        cardLibrary.filter(
          (card) =>
            encounter.selectedCardIds.includes(card.id) &&
            (!card.miniGames || card.miniGames.includes("memoryReveal")),
        ),
      [cardLibrary, encounter.selectedCardIds],
    );

    const setupRound = useCallback(() => {
      const cardsNeeded = getCardsForRound(currentRound);
      const cards = shuffle(selectedCards).slice(0, Math.max(2, Math.min(cardsNeeded, selectedCards.length)));
      const targetIndex = cards.length > 0 ? Math.floor(Math.random() * cards.length) : 0;
      const heroCandidates = buildCandidatesWithTarget(cards, targetIndex, 3);
      const villainCandidates = buildCandidatesWithTarget(cards, targetIndex, 3);

      setRoundState({
        cards,
        targetIndex,
        heroChoiceId: null,
        villainChoiceId: null,
        heroCandidates,
        villainCandidates,
        revealedCardId: null,
        scored: false,
      });
      if (peekTimeoutRef.current !== null) {
        window.clearTimeout(peekTimeoutRef.current);
        peekTimeoutRef.current = null;
      }
      setPeekRevealCardId(null);
      setPeekText("");
      setPhase("preview");
      completedRef.current = false;
      setOverlayState("none");
      setBattleProgress({
        currentRound,
        phase: "inProgress",
      });
    }, [currentRound, selectedCards, setBattleProgress, setOverlayState]);

    const goToHide = useCallback(() => {
      if (phase !== "preview") {
        return;
      }
      setPhase("hide");
    }, [phase]);

    useEffect(() => {
      if (phase === "preview") {
        gameStartCueShownRef.current = false;
      }
      if (phase === "hide" && !gameStartCueShownRef.current) {
        setTransitionCue({ text: "MEMORY REVEAL", type: "start" });
        const timerId = window.setTimeout(() => {
          setTransitionCue({ text: `ROUND ${currentRound}`, type: "round" });
        }, 260);
        gameStartCueShownRef.current = true;
        return () => window.clearTimeout(timerId);
      }
      return undefined;
    }, [currentRound, phase, setTransitionCue]);

    useEffect(() => {
      if (currentRound === previousRoundRef.current) return;
      setTransitionCue({ text: `ROUND ${currentRound}`, type: "round" });
      previousRoundRef.current = currentRound;
    }, [currentRound, setTransitionCue]);

    useEffect(() => {
      setScoreOverlay(
        <div className="mini-game-score-banner">
          <span className="mini-game-score-label">Memory Reveal Score</span>
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
            Round {currentRound}/{MEMORY_REVEAL_MAX_ROUNDS} | {phase}
          </small>
        </div>,
      );
      return () => setScoreOverlay(null);
    }, [currentRound, localScores.hero, localScores.villain, phase, setScoreOverlay]);

    useEffect(
      () => () => {
        if (peekTimeoutRef.current !== null) {
          window.clearTimeout(peekTimeoutRef.current);
        }
      },
      [],
    );

    useEffect(() => {
      setupRound();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRound, selectedCards]);

    useEffect(() => {
      if (currentRound === 1) {
        setLocalScores({ hero: 0, villain: 0 });
      }
    }, [currentRound]);

    const goToTargetHighlighted = useCallback(() => {
      if (phase !== "hide") {
        return;
      }
      setPhase("targetHighlighted");
    }, [phase]);

    const handleHeroPick = (cardId: string) => {
      if (phase !== "targetHighlighted") {
        triggerShake(`hero-pick-${cardId}`);
        return;
      }
      setRoundState((state) => ({ ...state, heroChoiceId: cardId }));
    };

    const handleVillainPick = (cardId: string) => {
      if (phase !== "targetHighlighted") {
        triggerShake(`villain-pick-${cardId}`);
        return;
      }
      setRoundState((state) => ({ ...state, villainChoiceId: cardId }));
    };

    const handleReveal = useCallback(() => {
      if (phase !== "targetHighlighted" || !roundState.heroChoiceId || !roundState.villainChoiceId) {
        triggerShake("memory-reveal-action");
        return;
      }
      const targetCard = roundState.cards[roundState.targetIndex];
      const targetCardId = targetCard?.id ?? null;
      if (roundState.scored) {
        return;
      }
      const heroHit = roundState.heroChoiceId === targetCardId;
      const villainHit = roundState.villainChoiceId === targetCardId;
      const nextScores = {
        hero: localScores.hero + (heroHit ? 1 : 0),
        villain: localScores.villain + (villainHit ? 1 : 0),
      };
      setLocalScores(nextScores);
      setOverlayState("none");
      setBattleProgress({
        phase: currentRound >= MEMORY_REVEAL_MAX_ROUNDS ? "roundComplete" : "roundComplete",
      });
      setRoundState((state) => ({ ...state, revealedCardId: targetCardId, scored: true }));
      setPhase("roundResult");
      if (currentRound >= MEMORY_REVEAL_MAX_ROUNDS && !completedRef.current) {
        completedRef.current = true;
        onComplete({
          miniGameId: "memoryReveal",
          winner:
            nextScores.hero > nextScores.villain
              ? "hero"
              : nextScores.villain > nextScores.hero
                ? "villain"
                : "draw",
          heroScore: nextScores.hero,
          villainScore: nextScores.villain,
          scoreDifference: Math.abs(nextScores.hero - nextScores.villain),
        });
      }
    }, [
      currentRound,
      localScores.hero,
      localScores.villain,
      onComplete,
      phase,
      roundState.cards,
      roundState.heroChoiceId,
      roundState.scored,
      roundState.targetIndex,
      roundState.villainChoiceId,
      setBattleProgress,
      setOverlayState,
      triggerShake,
    ]);

    const startNextRound = useCallback(() => {
      if (phase !== "roundResult" || currentRound >= MEMORY_REVEAL_MAX_ROUNDS) {
        return;
      }
      setPeekRevealCardId(null);
      setPeekText("");
      setBattleProgress({ currentRound: currentRound + 1, phase: "inProgress" });
      setOverlayState("none");
    }, [currentRound, phase, setBattleProgress, setOverlayState]);

    const handlePeek = (side: "hero" | "villain") => {
      if (phase !== "hide" && phase !== "targetHighlighted") {
        return;
      }
      if (roundState.cards.length === 0) {
        return;
      }
      if (!consumeBattleEffectCharge("peek", side)) {
        return;
      }
      const revealed = roundState.cards[Math.floor(Math.random() * roundState.cards.length)];
      if (!revealed) {
        return;
      }
      setPeekRevealCardId(revealed.id);
      setPeekText(`${side === "hero" ? "Hero" : "Villain"} peeked ${revealed.title}.`);
      if (peekTimeoutRef.current !== null) {
        window.clearTimeout(peekTimeoutRef.current);
      }
      peekTimeoutRef.current = window.setTimeout(() => {
        setPeekRevealCardId(null);
        setPeekText("");
        peekTimeoutRef.current = null;
      }, 1400);
    };

    useEffect(() => {
      if (phase === "preview") {
        setHeaderAction(
          <button type="button" data-icon="start" className="is-phase-action" onClick={goToHide}>
            Start Game
          </button>,
        );
        return () => setHeaderAction(null);
      }

      const actions: JSX.Element[] = [];

      if (phase === "hide" || phase === "targetHighlighted") {
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

      if (phase === "hide") {
        actions.push(
          <button key="guess" type="button" data-icon="reveal" className="is-phase-action" onClick={goToTargetHighlighted}>
            Guess
          </button>,
        );
      }

      if (phase === "targetHighlighted") {
        actions.push(
          <button
            key="reveal"
            type="button"
            data-icon="reveal"
            className="is-phase-action"
            onClick={handleReveal}
            disabled={!roundState.heroChoiceId || !roundState.villainChoiceId}
          >
            Reveal
          </button>,
        );
      }

      if (phase === "roundResult" && currentRound < MEMORY_REVEAL_MAX_ROUNDS) {
        actions.push(
          <button key="next-round" type="button" data-icon="next" className="is-phase-action" onClick={startNextRound}>
            Next Round
          </button>,
        );
      }

      if (phase === "roundResult" && currentRound >= MEMORY_REVEAL_MAX_ROUNDS) {
        actions.push(
          <button key="replay" type="button" data-icon="restart" onClick={setupRound}>
            Replay Memory Reveal
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
      currentRound,
      goToHide,
      goToTargetHighlighted,
      handleReveal,
      phase,
      roundState.heroChoiceId,
      roundState.villainChoiceId,
      setHeaderAction,
      setupRound,
      startNextRound,
    ]);

    const heroHit = roundState.heroChoiceId === roundState.revealedCardId;
    const villainHit = roundState.villainChoiceId === roundState.revealedCardId;
    const showFaces = phase === "preview" || phase === "roundResult";
    const showTargetHighlight =
      phase === "targetHighlighted" ||
      phase === "roundResult";

    if (selectedCards.length < 2) {
      return (
        <div className="mini-game-placeholder">
          <h3>Memory Reveal</h3>
          <p>Select at least two cards assigned to Memory Reveal in Edit Mode to play.</p>
        </div>
      );
    }

    return (
      <div className="memory-reveal">
        <div className="mini-game-hud">
          <span>Memory Reveal</span>
          <span>
            Round {currentRound}/{MEMORY_REVEAL_MAX_ROUNDS}
          </span>
          <span>Phase: {phase}</span>
          <span>
            Score {localScores.hero} : {localScores.villain}
          </span>
          <span>
            Peek Hx{battleEffects.peekCharges.hero} Vx{battleEffects.peekCharges.villain}
          </span>
        </div>

        <div className="memory-arena">
          <section className="memory-side memory-side-left">
            <h4>Hero Candidates</h4>
            <div className="memory-candidate-list">
              {roundState.heroCandidates.map((card, index) => {
                const isSelected = roundState.heroChoiceId === card.id;
                const motionKey = `hero-pick-${card.id}`;
                return (
                  <button
                    key={card.id}
                    type="button"
                    ref={bindHeroCandidate(`hero-candidate-${card.id}-${index}`)}
                    className={`memory-candidate motion-card ${isSelected ? "is-selected-hero" : ""} ${shakeClassName(motionKey)}`}
                    onClick={() => handleHeroPick(card.id)}
                    disabled={phase !== "targetHighlighted"}
                  >
                    <img src={card.image} alt={card.title} />
                    <div className="memory-candidate-caption">
                      <strong>{card.title}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="memory-center">
            <div className="memory-target-banner">
              <span className={phase === "targetHighlighted" ? "pulse" : ""}>
                Target Position: {roundState.targetIndex + 1}
              </span>
            </div>

            <div className="memory-grid">
              {roundState.cards.map((card, index) => {
                const isTargetIndex = roundState.targetIndex === index;
                const isRevealedTarget = showFaces && roundState.revealedCardId === card.id;
                const isFaceUp = showFaces || card.id === peekRevealCardId;
                const cardClass = [
                  "memory-card",
                  "motion-card",
                  isFaceUp ? "is-face-up" : "is-face-down",
                  showTargetHighlight && isTargetIndex ? "is-target-slot" : "",
                  isRevealedTarget ? "is-target" : "",
                  shakeClassName("memory-reveal-action"),
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={`${card.id}-${index}`}
                    ref={bindMemoryCard(`memory-grid-${card.id}-${index}`)}
                    className={cardClass}
                  >
                    <div className={`card-flip3d ${isFaceUp ? "is-flipped" : ""}`}>
                      <div className="card-face card-face--back">
                        <span>?</span>
                      </div>
                      <div className="card-face card-face--front">
                        <img src={card.image} alt={card.title} />
                        <div className="memory-card-caption">
                          <strong>{card.title}</strong>
                          <small>Value {card.value}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="memory-side memory-side-right">
            <h4>Villain Candidates</h4>
            <div className="memory-candidate-list">
              {roundState.villainCandidates.map((card, index) => {
                const isSelected = roundState.villainChoiceId === card.id;
                const motionKey = `villain-pick-${card.id}`;
                return (
                  <button
                    key={card.id}
                    type="button"
                    ref={bindVillainCandidate(`villain-candidate-${card.id}-${index}`)}
                    className={`memory-candidate motion-card ${isSelected ? "is-selected-villain" : ""} ${shakeClassName(motionKey)}`}
                    onClick={() => handleVillainPick(card.id)}
                    disabled={phase !== "targetHighlighted"}
                  >
                    <img src={card.image} alt={card.title} />
                    <div className="memory-candidate-caption">
                      <strong>{card.title}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {phase === "roundResult" ? (
          <div className="mini-game-result">
            <p>{getOutcomeText(heroHit, villainHit)}</p>
            <p>
              Target: {roundState.cards[roundState.targetIndex]?.title ?? "N/A"}
            </p>
            <p>
              Hero Guess:{" "}
              {roundState.heroCandidates.find((card) => card.id === roundState.heroChoiceId)?.title ?? "None"}
            </p>
            <p>
              Villain Guess:{" "}
              {roundState.villainCandidates.find((card) => card.id === roundState.villainChoiceId)?.title ??
                "None"}
            </p>
          </div>
        ) : null}
        {(phase === "hide" || phase === "targetHighlighted") && peekText ? (
          <p className="mini-game-result">{peekText}</p>
        ) : null}
      </div>
    );
  },
};
