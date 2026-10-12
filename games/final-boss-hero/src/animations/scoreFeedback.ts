import { useEffect, useRef, useState } from "react";

export type ScoreSide = "hero" | "villain";

interface ScoreParticle {
  id: number;
  side: ScoreSide;
  text: string;
}

interface UseScoreFeedbackResult {
  heroPopTick: number;
  villainPopTick: number;
  heroSweepTick: number;
  villainSweepTick: number;
  particles: ScoreParticle[];
}

export function useScoreFeedback(heroScore: number, villainScore: number): UseScoreFeedbackResult {
  const [heroPopTick, setHeroPopTick] = useState(0);
  const [villainPopTick, setVillainPopTick] = useState(0);
  const [heroSweepTick, setHeroSweepTick] = useState(0);
  const [villainSweepTick, setVillainSweepTick] = useState(0);
  const [particles, setParticles] = useState<ScoreParticle[]>([]);
  const previousRef = useRef({ hero: heroScore, villain: villainScore });
  const particleIdRef = useRef(0);
  const particleTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    const heroDelta = heroScore - previous.hero;
    const villainDelta = villainScore - previous.villain;

    if (heroDelta > 0) {
      setHeroPopTick((tick) => tick + 1);
      setHeroSweepTick((tick) => tick + 1);
      const id = ++particleIdRef.current;
      setParticles((current) => [...current, { id, side: "hero", text: `+${heroDelta}` }]);
      const timeoutId = window.setTimeout(() => {
        setParticles((current) => current.filter((entry) => entry.id !== id));
      }, 1100);
      particleTimersRef.current.push(timeoutId);
    }

    if (villainDelta > 0) {
      setVillainPopTick((tick) => tick + 1);
      setVillainSweepTick((tick) => tick + 1);
      const id = ++particleIdRef.current;
      setParticles((current) => [...current, { id, side: "villain", text: `+${villainDelta}` }]);
      const timeoutId = window.setTimeout(() => {
        setParticles((current) => current.filter((entry) => entry.id !== id));
      }, 1100);
      particleTimersRef.current.push(timeoutId);
    }

    previousRef.current = { hero: heroScore, villain: villainScore };
  }, [heroScore, villainScore]);

  useEffect(
    () => () => {
      for (const timerId of particleTimersRef.current) {
        window.clearTimeout(timerId);
      }
    },
    [],
  );

  return {
    heroPopTick,
    villainPopTick,
    heroSweepTick,
    villainSweepTick,
    particles,
  };
}
