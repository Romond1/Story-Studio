import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useScoreFeedback } from "../animations/scoreFeedback";
import { useScreenShake } from "../animations/screenShake";
import { usePointerTilt3D } from "../animations/pointerTilt";
import { useVFX } from "./VFXLayer";
import { miniGameRegistry } from "../miniGames/registry";
import type { MiniGameTransitionCue } from "../miniGames/types";
import { useBattleStore } from "../store/battleStore";
import { BattleIntroScreen } from "./BattleIntroScreen";
import { CoreInventory } from './CoreInventory';
import { observePlayArea } from "./observePlayArea";
import {
  wheelZoom,
  clampOffsets,
  computePlayAreaFitZoom,
  computeNextZoomView,
  reclampPlayAreaView,
  type PlayAreaMetrics,
} from "./zoomMath";
import type {
  BattleSide,
  CutsceneData,
  FighterData,
  MiniGameId,
  MiniGameWinner,
  PowerUpData,
  PowerUpEffectType,
} from "../types/game";
import { isMiniGameId } from "../types/game";

const MAX_PLAY_ZOOM = 3.5;
const POWER_UP_DEFAULT_COSTS: Record<PowerUpEffectType, number> = {
  heal: 15,
  peek: 10,
  shield: 15,
  powerBoost: 10,
  retry: 20,
};
const POWER_UP_DEFAULT_GAMES: Record<PowerUpEffectType, MiniGameId[]> = {
  heal: ["memoryReveal", "matchPairs", "laneBattle", "openBox"],
  peek: ["memoryReveal", "matchPairs", "openBox"],
  shield: ["memoryReveal", "matchPairs", "laneBattle", "openBox"],
  powerBoost: ["laneBattle"],
  retry: ["laneBattle", "openBox"],
};
const INTRO_SELECT_VALUE = "__intro_setup__";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function percent(current: number, max: number): number {
  return max <= 0 ? 0 : clamp((current / max) * 100, 0, 100);
}

type IntermissionTone = "victory" | "setback" | "draw";

interface IntermissionBanner {
  tone: IntermissionTone;
  title: string;
  subtitle: string;
}

function getIntermissionBanner(winner: MiniGameWinner): IntermissionBanner {
  if (winner === "hero") {
    return {
      tone: "victory",
      title: "Victory",
      subtitle: "Challenge accepted. Claim rewards.",
    };
  }
  if (winner === "villain") {
    return {
      tone: "setback",
      title: "Try Again",
      subtitle: "Challenge accepted. Regroup and strike again.",
    };
  }
  return {
    tone: "draw",
    title: "Even Match",
    subtitle: "Challenge accepted. Stay sharp for the next round.",
  };
}

function resolvePowerUpEffectType(powerUp: PowerUpData): PowerUpEffectType | null {
  if (
    powerUp.effectType === "heal" ||
    powerUp.effectType === "peek" ||
    powerUp.effectType === "shield" ||
    powerUp.effectType === "powerBoost" ||
    powerUp.effectType === "retry"
  ) {
    return powerUp.effectType;
  }
  const probe = `${powerUp.id} ${powerUp.name}`.toLowerCase();
  if (probe.includes("heal")) return "heal";
  if (probe.includes("peek")) return "peek";
  if (probe.includes("shield")) return "shield";
  if (probe.includes("boost") || probe.includes("power")) return "powerBoost";
  if (probe.includes("retry") || probe.includes("repick") || probe.includes("re-pick")) return "retry";
  return null;
}

function getPowerUpCost(powerUp: PowerUpData, effectType: PowerUpEffectType | null): number {
  if (typeof powerUp.energyCost === "number" && Number.isFinite(powerUp.energyCost)) {
    return Math.max(0, powerUp.energyCost);
  }
  return effectType ? POWER_UP_DEFAULT_COSTS[effectType] : 0;
}

function getPowerUpApplicableGames(
  powerUp: PowerUpData,
  effectType: PowerUpEffectType | null,
): MiniGameId[] {
  if (powerUp.applicableGames && powerUp.applicableGames.length > 0) {
    return powerUp.applicableGames;
  }
  return effectType ? POWER_UP_DEFAULT_GAMES[effectType] : [];
}

function scoreCutscene(cutscene: CutsceneData, gameId: string | null, winner: MiniGameWinner | null, battlePhase: string) {
  const tags = new Set(cutscene.tags.map((tag) => tag.toLowerCase()));
  let score = 0;
  if (gameId && tags.has(gameId.toLowerCase())) score += 3;
  if (winner === "hero" && tags.has("victory")) score += 2;
  if (winner === "villain" && tags.has("defeat")) score += 2;
  if (winner === "draw" && tags.has("neutral")) score += 2;
  if (battlePhase === "intermission" && tags.has("intermission")) score += 1;
  return score;
}

interface TransitionCueState extends MiniGameTransitionCue {
  id: number;
}

type CombatFeedbackTone = "damage" | "heal" | "blocked";

interface CombatFeedbackEntry {
  id: number;
  text: string;
  tone: CombatFeedbackTone;
}

interface PointerTrailPoint {
  id: number;
  x: number;
  y: number;
  colorA: string;
  colorB: string;
}

function isTypingElement(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  const modifiers = {
    shift: parts.includes("shift"),
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command"),
  };
  const keyPart = parts.find(
    (part) => !["shift", "ctrl", "control", "alt", "meta", "cmd", "command"].includes(part),
  );
  if (event.shiftKey !== modifiers.shift) return false;
  if (event.ctrlKey !== modifiers.ctrl) return false;
  if (event.altKey !== modifiers.alt) return false;
  if (event.metaKey !== modifiers.meta) return false;
  if (!keyPart) return true;
  return event.key.toLowerCase() === keyPart;
}

export function BattleShell() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const playAreaViewRef = useRef(useBattleStore.getState().playAreaView);
  const playAreaMetricsRef = useRef<PlayAreaMetrics | null>(null);
  const lastViewportRef = useRef({ width: 0, height: 0 });
  const autoFitRef = useRef(true);
  const panDragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [playViewportWidth, setPlayViewportWidth] = useState(0);
  const [powerUpTargetSide, setPowerUpTargetSide] = useState<BattleSide>("hero");
  const [powerUpMessage, setPowerUpMessage] = useState("");
  const [powerUpFlashSide, setPowerUpFlashSide] = useState<BattleSide | null>(null);
  const [healBurstSide, setHealBurstSide] = useState<BattleSide | null>(null);
  const [gameHeaderAction, setGameHeaderAction] = useState<ReactNode | null>(null);
  const [gameScoreOverlay, setGameScoreOverlay] = useState<ReactNode | null>(null);
  const [isIntroScreenActive, setIsIntroScreenActive] = useState(false);
  const [combatFeedback, setCombatFeedback] = useState<Record<BattleSide, CombatFeedbackEntry[]>>({
    hero: [],
    villain: [],
  });
  const [shieldFlash, setShieldFlash] = useState<Record<BattleSide, boolean>>({
    hero: false,
    villain: false,
  });
  const [isCutsceneMenuOpen, setIsCutsceneMenuOpen] = useState(false);
  const [isPlayCutsceneMenuOpen, setIsPlayCutsceneMenuOpen] = useState(false);
  const [playCutsceneTag, setPlayCutsceneTag] = useState("all");
  const [selectedCutsceneId, setSelectedCutsceneId] = useState<string | null>(null);
  const [selectedPlayCutsceneId, setSelectedPlayCutsceneId] = useState<string | null>(null);
  const [activeCutsceneId, setActiveCutsceneId] = useState<string | null>(null);
  const [cutsceneStatus, setCutsceneStatus] = useState<"idle" | "loading" | "ready" | "playing">("idle");
  const [transitionCue, setTransitionCue] = useState<TransitionCueState | null>(null);
  const [isPointerHighlightEnabled, setIsPointerHighlightEnabled] = useState(false);
  const [pointerPalette, setPointerPalette] = useState<"kids" | "villain">("kids");
  const [isPointerPressed, setIsPointerPressed] = useState(false);
  const [pointerPosition, setPointerPosition] = useState({ x: -9999, y: -9999 });
  const [pointerTrailPoints, setPointerTrailPoints] = useState<PointerTrailPoint[]>([]);
  const { bindShakeTarget, triggerShake } = useScreenShake();
  const { triggerConfetti, triggerImpact, triggerSparkles } = useVFX();
  usePointerTilt3D();
  const [heroHpGhost, setHeroHpGhost] = useState(100);
  const [villainHpGhost, setVillainHpGhost] = useState(100);
  const [heroEnergyGhost, setHeroEnergyGhost] = useState(100);
  const [villainEnergyGhost, setVillainEnergyGhost] = useState(100);
  const [portraitHitSide, setPortraitHitSide] = useState<BattleSide | null>(null);
  const portraitHitTimerRef = useRef<number | null>(null);
  const combatFeedbackIdRef = useRef(0);
  const combatFeedbackTimersRef = useRef<number[]>([]);
  const shieldFlashTimersRef = useRef<number[]>([]);
  const powerUpFlashTimerRef = useRef<number | null>(null);
  const healBurstTimerRef = useRef<number | null>(null);
  const previousHpRef = useRef({
    hero: useBattleStore.getState().battleState.hero.currentHp,
    villain: useBattleStore.getState().battleState.villain.currentHp,
  });
  const previousResolutionRef = useRef(useBattleStore.getState().intermissionState.resolution);
  const transitionCueTimerRef = useRef<number | null>(null);
  const pointerTrailIdRef = useRef(0);
  const pointerTrailTimersRef = useRef<number[]>([]);
  const pointerLastSpawnAtRef = useRef(0);

  const cardLibrary = useBattleStore((state) => state.cardLibrary);
  const encounter = useBattleStore((state) => state.activeEncounter);
  const selectedMiniGame = useBattleStore((state) => state.selectedMiniGame);
  const selectedEpisodeHeroId = useBattleStore((state) => state.selectedEpisodeHeroId);
  const battleProgress = useBattleStore((state) => state.battleProgress);
  const scores = useBattleStore((state) => state.scores);
  const battleState = useBattleStore((state) => state.battleState);
  const battleEffects = useBattleStore((state) => state.battleEffects);
  const intermissionState = useBattleStore((state) => state.intermissionState);
  const playAreaView = useBattleStore((state) => state.playAreaView);
  const setUIMode = useBattleStore((state) => state.setUIMode);
  const setSelectedMiniGame = useBattleStore((state) => state.setSelectedMiniGame);
  const setPlayAreaView = useBattleStore((state) => state.setPlayAreaView);
  const setSelectedEpisodeHeroId = useBattleStore((state) => state.setSelectedEpisodeHeroId);
  const resetPlayAreaView = useBattleStore((state) => state.resetPlayAreaView);
  const completeMiniGame = useBattleStore((state) => state.completeMiniGame);
  const usePowerUp = useBattleStore((state) => state.usePowerUp);
  const continueFromIntermission = useBattleStore((state) => state.continueFromIntermission);
  const resetBattleSession = useBattleStore((state) => state.resetBattleSession);

  const runtimeHero: FighterData = useMemo(() => {
    const selectedHeroOption = encounter.introSetup.heroes.find((hero) => hero.id === selectedEpisodeHeroId);
    if (!selectedHeroOption) {
      return encounter.hero;
    }
    return {
      ...encounter.hero,
      name: selectedHeroOption.name,
      portrait: selectedHeroOption.portrait,
      description: selectedHeroOption.subtitle ?? encounter.hero.description,
      video: selectedHeroOption.video ?? encounter.hero.video,
    };
  }, [encounter.hero, encounter.introSetup.heroes, selectedEpisodeHeroId]);

  const runtimeEncounter = useMemo(
    () => ({
      ...encounter,
      hero: runtimeHero,
    }),
    [encounter, runtimeHero],
  );
  const pointerConfig = runtimeEncounter.pointerHighlight;
  const activePointerColors = useMemo(
    () =>
      (pointerPalette === "villain" ? pointerConfig.villainColors : pointerConfig.kidsColors).filter(
        (entry) => entry.trim().length > 0,
      ),
    [pointerConfig.kidsColors, pointerConfig.villainColors, pointerPalette],
  );

  const activeMiniGameId = selectedMiniGame ?? runtimeEncounter.gameOrder[0] ?? null;
  const isIntroEnabled = runtimeEncounter.introSetup.enabled;
  const showIntroScreen = isIntroEnabled && isIntroScreenActive;
  const plugin = activeMiniGameId ? miniGameRegistry[activeMiniGameId] : null;
  const selectedGameBackground = activeMiniGameId ? runtimeEncounter.gameBackgrounds?.[activeMiniGameId] : undefined;
  const activeBackground =
    selectedGameBackground && selectedGameBackground.trim().length > 0 ? selectedGameBackground : runtimeEncounter.background;
  const panAvailable =
    isPanning ||
    (playAreaMetricsRef.current
      ? playAreaMetricsRef.current.contentWidth * playAreaView.zoom > playAreaMetricsRef.current.viewportWidth + 1 ||
        playAreaMetricsRef.current.contentHeight * playAreaView.zoom > playAreaMetricsRef.current.viewportHeight + 1
      : playAreaView.zoom > 1.001);

  const showIntermission =
    !showIntroScreen && (battleProgress.phase === "intermission" || battleProgress.phase === "battleComplete");
  const suggestedCutscenes = useMemo(() => {
    const winner = intermissionState.lastResult?.winner ?? null;
    return [...runtimeEncounter.cutscenes].sort(
      (a, b) =>
        scoreCutscene(b, intermissionState.sourceMiniGameId, winner, battleProgress.phase) -
        scoreCutscene(a, intermissionState.sourceMiniGameId, winner, battleProgress.phase),
    );
  }, [battleProgress.phase, intermissionState.lastResult?.winner, intermissionState.sourceMiniGameId, runtimeEncounter.cutscenes]);
  const activeCutscene = useMemo(
    () => runtimeEncounter.cutscenes.find((cutscene) => cutscene.id === activeCutsceneId) ?? null,
    [activeCutsceneId, runtimeEncounter.cutscenes],
  );
  const playCutsceneTagOptions = useMemo(() => {
    const tags = new Set<string>();
    runtimeEncounter.cutscenes.forEach((cutscene) => {
      cutscene.tags.forEach((tag) => {
        if (tag.trim().length > 0) {
          tags.add(tag);
        }
      });
    });
    return ["all", ...Array.from(tags).sort((a, b) => a.localeCompare(b))];
  }, [runtimeEncounter.cutscenes]);
  const playCutscenes = useMemo(() => {
    if (playCutsceneTag === "all") {
      return runtimeEncounter.cutscenes;
    }
    return runtimeEncounter.cutscenes.filter((cutscene) => cutscene.tags.includes(playCutsceneTag));
  }, [playCutsceneTag, runtimeEncounter.cutscenes]);
  const targetEnergy = battleState[powerUpTargetSide].currentEnergy;
  const powerUpRows = useMemo(
    () =>
      runtimeEncounter.powerUps.map((powerUp) => {
        const effectType = resolvePowerUpEffectType(powerUp);
        const cost = getPowerUpCost(powerUp, effectType);
        const applicableGames = getPowerUpApplicableGames(powerUp, effectType);
        const incompatible =
          activeMiniGameId &&
          applicableGames.length > 0 &&
          !applicableGames.includes(activeMiniGameId);
        const hasEnoughEnergy = targetEnergy >= cost;
        const queued =
          effectType === "shield"
            ? battleEffects.shieldCharges[powerUpTargetSide]
            : effectType === "peek"
              ? battleEffects.peekCharges[powerUpTargetSide]
              : effectType === "powerBoost"
                ? battleEffects.powerBoostCharges[powerUpTargetSide]
                : effectType === "retry"
                  ? battleEffects.retryCharges[powerUpTargetSide]
                  : 0;
        let disabledReason = "";
        if (battleState.outcome !== "active") {
          disabledReason = "Battle finished";
        } else if (!effectType) {
          disabledReason = "Set effect type in Edit Mode";
        } else if (powerUp.charges <= 0) {
          disabledReason = "No charges configured";
        } else if (incompatible) {
          disabledReason = "Unavailable in this mini-game";
        } else if (!hasEnoughEnergy) {
          disabledReason = `Need ${Math.max(0, cost - targetEnergy)} more Energy`;
        }
        return {
          powerUp,
          effectType,
          cost,
          queued,
          disabledReason,
        };
      }),
    [activeMiniGameId, battleEffects, battleState.outcome, powerUpTargetSide, runtimeEncounter.powerUps, targetEnergy],
  );

  useEffect(() => {
    playAreaViewRef.current = playAreaView;
  }, [playAreaView]);

  useEffect(() => {
    if (!isIntroEnabled && isIntroScreenActive) {
      setIsIntroScreenActive(false);
    }
  }, [isIntroEnabled, isIntroScreenActive]);

  useEffect(() => {
    if (showIntroScreen) {
      setGameHeaderAction(null);
      setGameScoreOverlay(null);
    }
  }, [showIntroScreen]);

  useEffect(() => {
    const nextCutsceneId = suggestedCutscenes[0]?.id ?? runtimeEncounter.cutscenes[0]?.id ?? null;
    setSelectedCutsceneId((current) =>
      current && runtimeEncounter.cutscenes.some((cutscene) => cutscene.id === current) ? current : nextCutsceneId,
    );
  }, [runtimeEncounter.cutscenes, suggestedCutscenes]);

  useEffect(() => {
    if (!playCutsceneTagOptions.includes(playCutsceneTag)) {
      setPlayCutsceneTag("all");
    }
  }, [playCutsceneTag, playCutsceneTagOptions]);

  useEffect(() => {
    const nextCutsceneId = playCutscenes[0]?.id ?? runtimeEncounter.cutscenes[0]?.id ?? null;
    setSelectedPlayCutsceneId((current) =>
      current && playCutscenes.some((cutscene) => cutscene.id === current) ? current : nextCutsceneId,
    );
  }, [playCutscenes, runtimeEncounter.cutscenes]);

  useEffect(() => {
    if (!showIntermission) {
      setIsCutsceneMenuOpen(false);
      setActiveCutsceneId(null);
      setCutsceneStatus("idle");
    }
  }, [showIntermission]);

  useEffect(() => {
    if (!powerUpMessage) return;
    const timeoutId = window.setTimeout(() => {
      setPowerUpMessage("");
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [powerUpMessage]);

  useEffect(() => {
    setIsPointerHighlightEnabled(pointerConfig.enabledByDefault);
  }, [pointerConfig.enabledByDefault]);

  useEffect(() => {
    setPointerPalette(pointerConfig.defaultPalette);
  }, [pointerConfig.defaultPalette]);

  const addPointerTrailPoint = useCallback(
    (x: number, y: number) => {
      const nextId = pointerTrailIdRef.current + 1;
      pointerTrailIdRef.current = nextId;
      const palette = activePointerColors.length >= 2 ? activePointerColors : ["#4cc9ff", "#8be9ff"];
      const colorIndex = nextId % palette.length;
      const point: PointerTrailPoint = {
        id: nextId,
        x,
        y,
        colorA: palette[colorIndex] ?? palette[0],
        colorB: palette[(colorIndex + 1) % palette.length] ?? palette[0],
      };
      setPointerTrailPoints((current) => [...current, point].slice(-Math.max(1, pointerConfig.trailLength)));
      const timeoutId = window.setTimeout(() => {
        setPointerTrailPoints((current) => current.filter((entry) => entry.id !== point.id));
        pointerTrailTimersRef.current = pointerTrailTimersRef.current.filter((timer) => timer !== timeoutId);
      }, Math.max(1, pointerConfig.fadeMs));
      pointerTrailTimersRef.current.push(timeoutId);
    },
    [activePointerColors, pointerConfig.fadeMs, pointerConfig.trailLength],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) return;
      if (!matchesShortcut(event, pointerConfig.shortcut)) return;
      event.preventDefault();
      setIsPointerHighlightEnabled((enabled) => !enabled);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pointerConfig.shortcut]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingElement(event.target)) return;
      if (!matchesShortcut(event, pointerConfig.paletteShortcut)) return;
      event.preventDefault();
      setPointerPalette((current) => (current === "kids" ? "villain" : "kids"));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pointerConfig.paletteShortcut]);

  useEffect(() => {
    const handleMove = (event: globalThis.MouseEvent) => {
      setPointerPosition({ x: event.clientX, y: event.clientY });
      if (!isPointerHighlightEnabled) return;
      if (pointerConfig.clickOnly && !isPointerPressed) return;
      const now = Date.now();
      const minInterval = Math.max(1, pointerConfig.spawnMs);
      if (now - pointerLastSpawnAtRef.current < minInterval) return;
      pointerLastSpawnAtRef.current = now;
      addPointerTrailPoint(event.clientX, event.clientY);
    };
    const handleDown = (event: globalThis.MouseEvent) => {
      if (event.button !== 0) return;
      setIsPointerPressed(true);
      if (isPointerHighlightEnabled) {
        addPointerTrailPoint(event.clientX, event.clientY);
      }
    };
    const handleUp = () => {
      setIsPointerPressed(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("blur", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("blur", handleUp);
    };
  }, [
    addPointerTrailPoint,
    isPointerHighlightEnabled,
    isPointerPressed,
    pointerConfig.clickOnly,
    pointerConfig.spawnMs,
  ]);

  useEffect(() => {
    if (!isPointerHighlightEnabled) {
      setPointerTrailPoints([]);
      setIsPointerPressed(false);
      for (const timerId of pointerTrailTimersRef.current) {
        window.clearTimeout(timerId);
      }
      pointerTrailTimersRef.current = [];
    }
  }, [isPointerHighlightEnabled]);

  const queueCombatFeedback = useCallback((side: BattleSide, text: string, tone: CombatFeedbackTone) => {
    const id = combatFeedbackIdRef.current + 1;
    combatFeedbackIdRef.current = id;
    setCombatFeedback((current) => ({
      ...current,
      [side]: [...current[side], { id, text, tone }],
    }));
    const timeoutId = window.setTimeout(() => {
      setCombatFeedback((current) => ({
        ...current,
        [side]: current[side].filter((entry) => entry.id !== id),
      }));
    }, 820);
    combatFeedbackTimersRef.current.push(timeoutId);
  }, []);

  const triggerShieldFlash = useCallback((side: BattleSide) => {
    setShieldFlash((current) => ({ ...current, [side]: true }));
    const timeoutId = window.setTimeout(() => {
      setShieldFlash((current) => ({ ...current, [side]: false }));
    }, 360);
    shieldFlashTimersRef.current.push(timeoutId);
  }, []);

  useEffect(() => {
    const previous = previousHpRef.current;
    const next = {
      hero: battleState.hero.currentHp,
      villain: battleState.villain.currentHp,
    };
    for (const side of ["hero", "villain"] as const) {
      const delta = next[side] - previous[side];
      if (delta < 0) {
        queueCombatFeedback(side, `-${Math.abs(delta)}`, "damage");
        triggerShake(Math.abs(delta) > 30 ? "heavy" : Math.abs(delta) > 15 ? "medium" : "light");
        triggerImpact(side === "hero" ? "#00e5ff" : "#ff2244");
        setPortraitHitSide(side);
        if (portraitHitTimerRef.current !== null) window.clearTimeout(portraitHitTimerRef.current);
        portraitHitTimerRef.current = window.setTimeout(() => setPortraitHitSide(null), 300);
      } else if (delta > 0) {
        queueCombatFeedback(side, `+${delta}`, "heal");
        triggerSparkles("#00ff88");
      }
    }
    previousHpRef.current = next;
  }, [
    battleState.hero.currentHp,
    battleState.villain.currentHp,
    queueCombatFeedback,
    triggerShake,
    triggerImpact,
    triggerSparkles,
  ]);

  // Ghost drain - delayed HP bar visual
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHeroHpGhost(percent(battleState.hero.currentHp, battleState.hero.maxHp));
      setVillainHpGhost(percent(battleState.villain.currentHp, battleState.villain.maxHp));
      setHeroEnergyGhost(percent(battleState.hero.currentEnergy, battleState.hero.maxEnergy));
      setVillainEnergyGhost(percent(battleState.villain.currentEnergy, battleState.villain.maxEnergy));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [battleState.hero.currentHp, battleState.hero.maxHp, battleState.villain.currentHp, battleState.villain.maxHp,
      battleState.hero.currentEnergy, battleState.hero.maxEnergy, battleState.villain.currentEnergy, battleState.villain.maxEnergy]);

  useEffect(() => {
    const resolution = intermissionState.resolution;
    if (!resolution || resolution === previousResolutionRef.current) {
      previousResolutionRef.current = resolution;
      return;
    }
    if (resolution.blockedDamageToHero > 0) {
      queueCombatFeedback("hero", "BLOCKED!", "blocked");
      triggerShieldFlash("hero");
    }
    if (resolution.blockedDamageToVillain > 0) {
      queueCombatFeedback("villain", "BLOCKED!", "blocked");
      triggerShieldFlash("villain");
    }
    previousResolutionRef.current = resolution;
  }, [intermissionState.resolution, queueCombatFeedback, triggerShieldFlash]);

  // Victory confetti
  useEffect(() => {
    if (battleProgress.phase === "intermission" && intermissionState.lastResult?.winner === "hero") {
      triggerConfetti();
    }
    if (battleProgress.phase === "battleComplete" && battleState.outcome === "heroVictory") {
      triggerConfetti();
      window.setTimeout(() => triggerConfetti(), 600);
    }
  }, [battleProgress.phase, intermissionState.lastResult?.winner, battleState.outcome, triggerConfetti]);

  useEffect(
    () => () => {
      for (const timerId of combatFeedbackTimersRef.current) {
        window.clearTimeout(timerId);
      }
      for (const timerId of shieldFlashTimersRef.current) {
        window.clearTimeout(timerId);
      }
      if (powerUpFlashTimerRef.current !== null) {
        window.clearTimeout(powerUpFlashTimerRef.current);
      }
      if (healBurstTimerRef.current !== null) {
        window.clearTimeout(healBurstTimerRef.current);
      }
      if (transitionCueTimerRef.current !== null) {
        window.clearTimeout(transitionCueTimerRef.current);
      }
      if (portraitHitTimerRef.current !== null) {
        window.clearTimeout(portraitHitTimerRef.current);
      }
      for (const timerId of pointerTrailTimersRef.current) {
        window.clearTimeout(timerId);
      }
    },
    [],
  );

  const publishTransitionCue = useCallback((cue: MiniGameTransitionCue | null) => {
    if (!cue) {
      setTransitionCue(null);
      if (transitionCueTimerRef.current !== null) {
        window.clearTimeout(transitionCueTimerRef.current);
        transitionCueTimerRef.current = null;
      }
      return;
    }
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setTransitionCue({ id, ...cue });
    if (transitionCueTimerRef.current !== null) {
      window.clearTimeout(transitionCueTimerRef.current);
    }
    const duration = cue.type === "round" ? 950 : cue.type === "start" ? 1100 : 1250;
    transitionCueTimerRef.current = window.setTimeout(() => {
      setTransitionCue((current) => (current?.id === id ? null : current));
      transitionCueTimerRef.current = null;
    }, duration);
  }, []);

  const triggerPowerUpFlash = useCallback((side: BattleSide) => {
    setPowerUpFlashSide(side);
    if (powerUpFlashTimerRef.current !== null) {
      window.clearTimeout(powerUpFlashTimerRef.current);
    }
    powerUpFlashTimerRef.current = window.setTimeout(() => {
      setPowerUpFlashSide(null);
      powerUpFlashTimerRef.current = null;
    }, 320);
  }, []);

  const triggerHealBurst = useCallback((side: BattleSide) => {
    setHealBurstSide(side);
    if (healBurstTimerRef.current !== null) {
      window.clearTimeout(healBurstTimerRef.current);
    }
    healBurstTimerRef.current = window.setTimeout(() => {
      setHealBurstSide(null);
      healBurstTimerRef.current = null;
    }, 900);
  }, []);

  const readMetrics = useCallback((): PlayAreaMetrics | null => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return null;
    setPlayViewportWidth(viewport.clientWidth);
    const metrics: PlayAreaMetrics = {
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      contentWidth: Math.max(content.scrollWidth, content.offsetWidth, 1),
      contentHeight: Math.max(content.scrollHeight, content.offsetHeight, 1),
      fitZoom: 1,
    };
    metrics.fitZoom = computePlayAreaFitZoom(metrics, Boolean(content.querySelector('.board-dash-game')));
    playAreaMetricsRef.current = metrics;
    return metrics;
  }, []);

  const reclampOffsets = useCallback(() => {
    const metrics = readMetrics();
    if (!metrics) return;
    const current = playAreaViewRef.current;
    const lastViewport = lastViewportRef.current;
    if (lastViewport.width !== metrics.viewportWidth || lastViewport.height !== metrics.viewportHeight) {
      autoFitRef.current = true;
      lastViewportRef.current = { width: metrics.viewportWidth, height: metrics.viewportHeight };
    }
    const next = reclampPlayAreaView(metrics, current, autoFitRef.current, MAX_PLAY_ZOOM);
    if (
      Math.abs(next.zoom - current.zoom) > 0.001 ||
      Math.abs(next.offsetX - current.offsetX) > 0.5 ||
      Math.abs(next.offsetY - current.offsetY) > 0.5
    ) {
      playAreaViewRef.current = next;
      setPlayAreaView(next);
    }
  }, [readMetrics, setPlayAreaView]);

  useEffect(() => {
    autoFitRef.current = true;
    const current = playAreaViewRef.current;
    if (current.zoom !== 1 || current.offsetX !== 0 || current.offsetY !== 0) {
      // Each game starts with its own natural fit, independent of prior zoom.
      const initial = { zoom: 1, offsetX: 0, offsetY: 0 };
      playAreaViewRef.current = initial;
      setPlayAreaView(initial);
    }
    reclampOffsets();
  }, [activeMiniGameId, showIntroScreen, reclampOffsets, setPlayAreaView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    return observePlayArea([viewport, content], reclampOffsets);
  }, [reclampOffsets]);

  const stopPanDrag = useCallback(() => {
    if (!panDragRef.current.active) return;
    panDragRef.current.active = false;
    setIsPanning(false);
    document.body.classList.remove("play-area-pan-active");
    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
    window.removeEventListener("blur", stopPanDrag);
  }, []);

  const handleWindowMouseMove = useCallback(
    (event: globalThis.MouseEvent) => {
      if (!panDragRef.current.active) return;
      event.preventDefault();
      const metrics = readMetrics();
      if (!metrics) return;
      const dx = event.clientX - panDragRef.current.lastX;
      const dy = event.clientY - panDragRef.current.lastY;
      panDragRef.current.lastX = event.clientX;
      panDragRef.current.lastY = event.clientY;
      const current = playAreaViewRef.current;
      const clamped = clampOffsets(metrics, current.zoom, current.offsetX + dx, current.offsetY + dy);
      playAreaViewRef.current = { ...current, offsetX: clamped.offsetX, offsetY: clamped.offsetY };
      setPlayAreaView({ offsetX: clamped.offsetX, offsetY: clamped.offsetY });
    },
    [readMetrics, setPlayAreaView],
  );

  const handleWindowMouseUp = useCallback(
    (event: globalThis.MouseEvent) => {
      if (event.button !== 1 && panDragRef.current.active) return;
      stopPanDrag();
    },
    [stopPanDrag],
  );

  useEffect(() => () => stopPanDrag(), [stopPanDrag]);

  const handlePlayAreaWheel = useCallback((event: globalThis.WheelEvent) => {
    if (showIntroScreen) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    const metrics = readMetrics();
    if (!metrics) return;
    autoFitRef.current = false;
    const current = playAreaViewRef.current;
    const nextZoom = wheelZoom(
      current.zoom, event.deltaY, event.deltaMode,
      metrics.fitZoom,
      MAX_PLAY_ZOOM,
    );
    if (nextZoom === current.zoom) return;
    const rect = viewport.getBoundingClientRect();
    const nextView = computeNextZoomView(
      metrics,
      current,
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      nextZoom,
    );
    playAreaViewRef.current = nextView;
    setPlayAreaView(nextView);
  }, [showIntroScreen, readMetrics, setPlayAreaView]);

  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport)return;
    // React's delegated wheel listener is passive; consume scrolling here.
    viewport.addEventListener('wheel',handlePlayAreaWheel,{passive:false});
    return()=>viewport.removeEventListener('wheel',handlePlayAreaWheel);
  },[handlePlayAreaWheel]);

  const handlePlayAreaMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1 || !panAvailable) return;
    event.preventDefault();
    if (!readMetrics()) return;
    autoFitRef.current = false;
    panDragRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
    setIsPanning(true);
    document.body.classList.add("play-area-pan-active");
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("blur", stopPanDrag);
  };

  const handleResetView = () => {
    autoFitRef.current = true;
    const metrics = readMetrics();
    if (!metrics) {
      resetPlayAreaView();
      playAreaViewRef.current = useBattleStore.getState().playAreaView;
      return;
    }
    const clamped = clampOffsets(metrics, metrics.fitZoom, 0, 0);
    const next = { zoom: metrics.fitZoom, offsetX: clamped.offsetX, offsetY: clamped.offsetY };
    playAreaViewRef.current = next;
    setPlayAreaView(next);
  };

  const handleStartBattleFromIntro = () => {
    if (!selectedEpisodeHeroId) {
      return;
    }
    setIsIntroScreenActive(false);
    setSelectedMiniGame(runtimeEncounter.gameOrder[0] ?? null);
    setPowerUpMessage("");
  };

  const handleResetBattle = useCallback(() => {
    resetBattleSession();
    setSelectedEpisodeHeroId(null);
    setIsIntroScreenActive(isIntroEnabled);
    setTransitionCue(null);
  }, [isIntroEnabled, resetBattleSession, setSelectedEpisodeHeroId]);

  const triggerCutscene = (cutsceneId: string | null) => {
    if (!cutsceneId) return;
    setActiveCutsceneId(cutsceneId);
    setCutsceneStatus("loading");
  };

  const handleUsePowerUp = (
    powerUpId: string,
    disabledReason: string,
    effectType: PowerUpEffectType | null,
  ) => {
    if (disabledReason) {
      setPowerUpMessage(disabledReason);
      return;
    }
    const used = usePowerUp(powerUpId, powerUpTargetSide, activeMiniGameId);
    if (!used) {
      setPowerUpMessage("Power-up could not be applied.");
      return;
    }
    const powerUpName = runtimeEncounter.powerUps.find((item) => item.id === powerUpId)?.name ?? "Power-Up";
    setPowerUpMessage(`${powerUpName} applied to ${powerUpTargetSide === "hero" ? "Hero" : "Villain"}.`);
    triggerPowerUpFlash(powerUpTargetSide);
    if (effectType === "heal") {
      triggerHealBurst(powerUpTargetSide);
    }
  };

  const battleSummaryTitle =
    battleProgress.phase === "battleComplete"
      ? battleState.outcome === "heroVictory"
        ? `${runtimeEncounter.hero.name} wins the boss fight`
        : battleState.outcome === "villainVictory"
          ? `${runtimeEncounter.villain.name} wins the boss fight`
          : "Both sides collapse at the same time"
      : `${miniGameRegistry[intermissionState.sourceMiniGameId ?? activeMiniGameId ?? "memoryReveal"]?.title ?? "Mini-Game"} resolved`;
  const intermissionWinner: MiniGameWinner =
    intermissionState.lastResult?.winner ??
    (battleState.outcome === "heroVictory"
      ? "hero"
      : battleState.outcome === "villainVictory"
        ? "villain"
        : "draw");
  const intermissionBanner = getIntermissionBanner(intermissionWinner);
  const winnerSide: BattleSide | null =
    intermissionWinner === "hero" ? "hero" : intermissionWinner === "villain" ? "villain" : null;
  const winnerPortrait = winnerSide ? runtimeEncounter[winnerSide].portrait : null;
  const winnerName = winnerSide ? runtimeEncounter[winnerSide].name : "No winner this round";
  const globalScoreFx = useScoreFeedback(scores.hero, scores.villain);
  const isIntenseMoment =
    battleProgress.currentRound >= runtimeEncounter.roundSettings.roundCount ||
    percent(battleState.hero.currentHp, battleState.hero.maxHp) <= 30 ||
    percent(battleState.villain.currentHp, battleState.villain.maxHp) <= 30;
  const intermissionScoreDelta = intermissionState.lastResult?.scoreDifference ?? 0;
  const intermissionStarCount = Math.min(3, Math.max(1, Math.ceil(intermissionScoreDelta / 2)));
  const totalRounds = Math.max(1, runtimeEncounter.roundSettings.roundCount);
  const roundProgress = Math.min(1, battleProgress.currentRound / totalRounds);
  const roundCircumference = 2 * Math.PI * 19;
  const roundDashOffset = roundCircumference * (1 - roundProgress);

  return (
    <div className="battle-shell" ref={bindShakeTarget}>
      {activeBackground ? (
        <div className="battle-scene-background" aria-hidden="true">
          <img src={activeBackground} alt="" />
        </div>
      ) : null}

      <header className="top-bar">
        <div className="top-chip">
          <h1>{runtimeEncounter.name}</h1>
        </div>

        <div className="top-score-pill">
          <div>
            <small>HERO</small>
            <div className="top-score-value-wrap">
              <strong className={`top-score-value hero ${globalScoreFx.heroPopTick % 2 ? "is-pop" : ""}`}>
                {scores.hero}
              </strong>
              {globalScoreFx.particles
                .filter((particle) => particle.side === "hero")
                .map((particle) => (
                  <span key={particle.id} className="top-score-particle top-score-particle--hero">
                    {particle.text}
                  </span>
                ))}
            </div>
          </div>
          <div>
            <small>ROUND</small>
            <div className="top-round-ring" aria-label={`Round ${battleProgress.currentRound} of ${totalRounds}`}>
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className="top-round-ring-track" cx="22" cy="22" r="19" />
                <circle
                  className="top-round-ring-progress"
                  cx="22"
                  cy="22"
                  r="19"
                  style={{
                    strokeDasharray: roundCircumference,
                    strokeDashoffset: roundDashOffset,
                  }}
                />
              </svg>
              <strong>
                {battleProgress.currentRound}/{totalRounds}
              </strong>
            </div>
          </div>
          <div>
            <small>VILLAIN</small>
            <div className="top-score-value-wrap">
              <strong className={`top-score-value villain ${globalScoreFx.villainPopTick % 2 ? "is-pop" : ""}`}>
                {scores.villain}
              </strong>
              {globalScoreFx.particles
                .filter((particle) => particle.side === "villain")
                .map((particle) => (
                  <span key={particle.id} className="top-score-particle top-score-particle--villain">
                    {particle.text}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <div className="top-bar-actions">
          <label>
            <span className="sr-only">Mini-Game</span>
            <select
              value={showIntroScreen ? INTRO_SELECT_VALUE : activeMiniGameId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (value === INTRO_SELECT_VALUE) {
                  setIsIntroScreenActive(true);
                  return;
                }
                if (isIntroEnabled && !selectedEpisodeHeroId) {
                  setIsIntroScreenActive(true);
                  return;
                }
                setIsIntroScreenActive(false);
                setSelectedMiniGame(isMiniGameId(value) ? value : null);
              }}
            >
              {isIntroEnabled ? <option value={INTRO_SELECT_VALUE}>Intro / Setup</option> : null}
              {runtimeEncounter.gameOrder.map((gameId) => (
                <option key={gameId} value={gameId}>
                  {miniGameRegistry[gameId].title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleResetBattle}>
            Reset Battle
          </button>
          <button type="button" onClick={() => setUIMode("edit")}>
            Switch to Edit Mode
          </button>
        </div>
      </header>

      <main className="battle-main">
        <aside className="fighter-panel hero-panel">
          <h2>Hero</h2>
          <CoreInventory />
          {battleEffects.shieldCharges.hero > 0 ? (
            <div className="fighter-shield-indicator">
              <span className="fighter-shield-ring" />
              <span>🛡 Shield x{battleEffects.shieldCharges.hero}</span>
            </div>
          ) : null}
          {healBurstSide === "hero" ? (
            <div className="fighter-heal-burst" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null}
          <div className={`fighter-portrait-frame ${shieldFlash.hero ? "is-shield-flash" : ""} ${portraitHitSide === "hero" ? "is-hit" : ""}`}>
            <div className="fighter-portrait-wrap">
              {runtimeEncounter.hero.video ? (
                <video
                  className="fighter-portrait"
                  src={runtimeEncounter.hero.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img className="fighter-portrait" src={runtimeEncounter.hero.portrait} alt="Hero portrait" />
              )}
            </div>
          </div>
          <p>{runtimeEncounter.hero.name}</p>
          <div className="fighter-stat-bars">
            <div className={`fighter-stat fighter-stat--hp ${percent(battleState.hero.currentHp, battleState.hero.maxHp) <= 25 ? "is-low-hp" : ""}`}>
              <span>HP</span>
              <span>
                {battleState.hero.currentHp}/{battleState.hero.maxHp}
              </span>
              <div className="stat-track">
                <div className="stat-ghost hp" style={{ width: `${heroHpGhost}%` }} />
                <div className="stat-fill hp" style={{ width: `${percent(battleState.hero.currentHp, battleState.hero.maxHp)}%` }} />
              </div>
              <div className="hp-feedback-layer" aria-live="polite" aria-atomic="false">
                {combatFeedback.hero.map((entry) => (
                  <div key={entry.id} className={`hp-feedback-float hp-feedback-float--${entry.tone}`}>
                    {entry.tone === "blocked" ? <span className="hp-feedback-icon">🛡</span> : null}
                    <span>{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fighter-stat">
              <span>Energy</span>
              <span>
                {battleState.hero.currentEnergy}/{battleState.hero.maxEnergy}
              </span>
              <div className="stat-track">
                <div className="stat-ghost energy" style={{ width: `${heroEnergyGhost}%` }} />
                <div className="stat-fill energy" style={{ width: `${percent(battleState.hero.currentEnergy, battleState.hero.maxEnergy)}%` }} />
              </div>
            </div>
          </div>
          <div className="fighter-loot-section">
            <h3>Power-Ups</h3>
            <div className="powerup-target-toggle">
              <span>Target</span>
              <div className="powerup-target-buttons">
                <button
                  type="button"
                  className={powerUpTargetSide === "hero" ? "is-active" : ""}
                  onClick={() => setPowerUpTargetSide("hero")}
                >
                  Hero
                </button>
                <button
                  type="button"
                  className={powerUpTargetSide === "villain" ? "is-active" : ""}
                  onClick={() => setPowerUpTargetSide("villain")}
                >
                  Villain
                </button>
              </div>
            </div>
            <div className="powerup-queued">
              <small>Shield x{battleEffects.shieldCharges[powerUpTargetSide]}</small>
              <small>Peek x{battleEffects.peekCharges[powerUpTargetSide]}</small>
              <small>Boost x{battleEffects.powerBoostCharges[powerUpTargetSide]}</small>
              <small>Retry x{battleEffects.retryCharges[powerUpTargetSide]}</small>
            </div>
            <div className="powerup-compact-list">
              {powerUpRows.map(({ powerUp, effectType, cost, queued, disabledReason }) => (
                <div key={powerUp.id} className="powerup-compact-item">
                  <div className="powerup-compact-copy">
                    <strong>{powerUp.name}</strong>
                    <small>
                      Cost {cost} Energy{queued > 0 ? ` | queued ${queued}` : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="powerup-action-button"
                    onClick={() => handleUsePowerUp(powerUp.id, disabledReason, effectType)}
                    disabled={Boolean(disabledReason)}
                  >
                    Use
                  </button>
                  {disabledReason ? <small className="powerup-disabled">{disabledReason}</small> : null}
                </div>
              ))}
            </div>
            {powerUpMessage ? <p className="powerup-feedback">{powerUpMessage}</p> : null}
          </div>
        </aside>

        <section className="center-column">
          {gameScoreOverlay && !showIntroScreen ? (
            <div className="gameplay-score-overlay">{gameScoreOverlay}</div>
          ) : null}
          <section className="gameplay-stage-frame">
            <section className={`gameplay-area ${isIntenseMoment ? "is-intense" : ""}`} aria-label="Gameplay area">
              {activeBackground ? (
                <div className="gameplay-scene-background" aria-hidden="true">
                  <img src={activeBackground} alt="" />
                </div>
              ) : null}
              <div className="overlay-mask">
                <div className="atmosphere-particles" aria-hidden="true" />
                      <div
                        ref={viewportRef}
                        className={`gameplay-zoom-viewport ${panAvailable ? "is-pan-enabled" : ""} ${isPanning ? "is-panning" : ""}`}
                        onMouseDown={handlePlayAreaMouseDown}
                  onAuxClick={(event) => event.button === 1 && event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <div
                    className="gameplay-zoom-layer"
                    style={{
                      "--play-area-zoom": 1,
                      width: playViewportWidth || '100%',
                      minWidth: 0,
                      zoom: playAreaView.zoom,
                      transform: `translate(${playAreaView.offsetX / playAreaView.zoom}px, ${playAreaView.offsetY / playAreaView.zoom}px)`,
                    } as CSSProperties}
                  >
                    <div ref={contentRef} className="gameplay-content-stage">
                      {showIntroScreen ? (
                        <BattleIntroScreen
                          encounter={runtimeEncounter}
                          cardLibrary={cardLibrary}
                          selectedHeroId={selectedEpisodeHeroId}
                          onSelectHero={setSelectedEpisodeHeroId}
                          onStartBattle={handleStartBattleFromIntro}
                        />
                      ) : plugin ? (
                        <plugin.Component
                          encounter={runtimeEncounter}
                          progress={battleProgress}
                          scores={scores}
                          battleState={battleState}
                          onComplete={completeMiniGame}
                          setHeaderAction={setGameHeaderAction}
                          setScoreOverlay={setGameScoreOverlay}
                          setTransitionCue={publishTransitionCue}
                        />
                      ) : (
                        <div className="mini-game-placeholder">
                          <h3>Gameplay Area Placeholder</h3>
                          <p>Select at least one mini-game to continue.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="zoom-toolbar">
                  {gameHeaderAction ? <div className="zoom-toolbar-start-action">{gameHeaderAction}</div> : null}
                  <span>Zoom {(playAreaView.zoom * 100).toFixed(0)}%</span>
                  <button type="button" onClick={handleResetView}>
                    Reset
                  </button>
                </div>

                {powerUpFlashSide ? (
                  <div className={`powerup-radial-flash powerup-radial-flash--${powerUpFlashSide}`} aria-hidden="true" />
                ) : null}

                {transitionCue ? (
                  <button
                    type="button"
                    className={`transition-cue transition-cue--${transitionCue.type} transition-cue--${transitionCue.side ?? "neutral"}`}
                    onClick={() => publishTransitionCue(null)}
                  >
                    <span>{transitionCue.text}</span>
                  </button>
                ) : null}

                {showIntermission ? (
                  <div className="stage-overlay">
                      <div className={`intermission-panel intermission-panel--${intermissionBanner.tone}`}>
                      <div className="intermission-aura" aria-hidden="true" />
                      <div className="intermission-header">
                        <div className="intermission-title-fuse">
                          <h3 className="intermission-main-title">{intermissionBanner.title}</h3>
                        </div>
                        <p className="intermission-subtitle">{intermissionBanner.subtitle}</p>
                        <p className="intermission-context">{battleSummaryTitle}</p>
                      </div>
                      <div className="intermission-winner-panel">
                        {winnerPortrait ? (
                          <div className="intermission-winner-avatar-wrap">
                            <img className="intermission-winner-avatar" src={winnerPortrait} alt={`${winnerName} portrait`} />
                          </div>
                        ) : (
                          <div className="intermission-winner-avatar-wrap intermission-winner-avatar-wrap--draw">
                            <span className="intermission-draw-mark">=</span>
                          </div>
                        )}
                        <p className="intermission-winner-kicker">Winner</p>
                        <h4 className="intermission-winner-name">{winnerName}</h4>
                        <div className="intermission-star-rating" aria-label={`Rating ${intermissionStarCount} of 3`}>
                          {[1, 2, 3].map((star) => (
                            <span
                              key={star}
                              className={`intermission-star ${star <= intermissionStarCount ? "is-active" : ""}`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="intermission-actions">
                        {battleProgress.phase === "intermission" ? (
                          <button type="button" onClick={continueFromIntermission}>
                            Continue to Next Mini-Game
                          </button>
                        ) : (
                          <button type="button" onClick={handleResetBattle}>
                            Start New Battle
                          </button>
                        )}
                        <button type="button" onClick={() => setIsCutsceneMenuOpen((open) => !open)}>
                          {isCutsceneMenuOpen ? "Hide Cutscene Menu" : "Open Cutscene Menu"}
                        </button>
                      </div>

                      {isCutsceneMenuOpen ? (
                        <div className="cutscene-menu">
                          <div className="cutscene-menu-toolbar">
                            <select
                              value={selectedCutsceneId ?? ""}
                              onChange={(event) => setSelectedCutsceneId(event.target.value || null)}
                            >
                              {suggestedCutscenes.map((cutscene) => (
                                <option key={cutscene.id} value={cutscene.id}>
                                  {cutscene.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => triggerCutscene(selectedCutsceneId)}
                              disabled={!selectedCutsceneId}
                            >
                              Play Cutscene
                            </button>
                          </div>
                          <div className="cutscene-list">
                            {suggestedCutscenes.length > 0 ? (
                              suggestedCutscenes.map((cutscene) => (
                                <button
                                  key={cutscene.id}
                                  type="button"
                                  className={`cutscene-list-item ${cutscene.id === selectedCutsceneId ? "is-active" : ""}`}
                                  onClick={() => setSelectedCutsceneId(cutscene.id)}
                                >
                                  <strong>{cutscene.name}</strong>
                                  <span>{cutscene.mediaType.toUpperCase()}</span>
                                  <small>{cutscene.tags.join(", ") || "untagged"}</small>
                                </button>
                              ))
                            ) : (
                              <p className="mini-game-result">No cutscenes defined yet. Add them in Edit Mode.</p>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {activeCutscene ? (
                  <div className="cutscene-overlay">
                    <div className="cutscene-player">
                      <div className="cutscene-player-header">
                        <div className="cutscene-player-meta">
                          <strong>{activeCutscene.name}</strong>
                          <small>{cutsceneStatus === "loading" ? "Loading cutscene..." : cutsceneStatus === "playing" ? "Playing" : "Ready"}</small>
                        </div>
                        <button
                          className="cutscene-close-button"
                          type="button"
                          onClick={() => {
                            setActiveCutsceneId(null);
                            setCutsceneStatus("idle");
                          }}
                        >
                          Close
                        </button>
                      </div>

                      <div className="cutscene-stage">
                        {cutsceneStatus === "loading" ? (
                          <div className="cutscene-loading">
                            <div className="cutscene-loading-bar" />
                            <p>Loading cutscene media...</p>
                          </div>
                        ) : null}
                        {activeCutscene.mediaType === "image" ? (
                          <img
                            className={`cutscene-media ${cutsceneStatus === "loading" ? "is-hidden" : ""}`}
                            src={activeCutscene.mediaSource}
                            alt={activeCutscene.name}
                            onLoad={() => setCutsceneStatus("ready")}
                          />
                        ) : (
                          <video
                            className={`cutscene-media ${cutsceneStatus === "loading" ? "is-hidden" : ""}`}
                            src={activeCutscene.mediaSource}
                            controls
                            autoPlay
                            onLoadedData={() => setCutsceneStatus("ready")}
                            onPlay={() => setCutsceneStatus("playing")}
                          />
                        )}
                      </div>

                      {activeCutscene.description ? <p className="cutscene-description">{activeCutscene.description}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </section>
        </section>

        <aside className="fighter-panel villain-panel">
          <h2>Villain</h2>
          {battleEffects.shieldCharges.villain > 0 ? (
            <div className="fighter-shield-indicator">
              <span className="fighter-shield-ring" />
              <span>🛡 Shield x{battleEffects.shieldCharges.villain}</span>
            </div>
          ) : null}
          {healBurstSide === "villain" ? (
            <div className="fighter-heal-burst" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null}
          <div className={`fighter-portrait-frame ${shieldFlash.villain ? "is-shield-flash" : ""} ${portraitHitSide === "villain" ? "is-hit" : ""}`}>
            <div className="fighter-portrait-wrap">
              {runtimeEncounter.villain.video ? (
                <video
                  className="fighter-portrait"
                  src={runtimeEncounter.villain.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img className="fighter-portrait" src={runtimeEncounter.villain.portrait} alt="Villain portrait" />
              )}
            </div>
          </div>
          <p>{runtimeEncounter.villain.name}</p>
          <div className="fighter-stat-bars">
            <div className={`fighter-stat fighter-stat--hp ${percent(battleState.villain.currentHp, battleState.villain.maxHp) <= 25 ? "is-low-hp" : ""}`}>
              <span>HP</span>
              <span>
                {battleState.villain.currentHp}/{battleState.villain.maxHp}
              </span>
              <div className="stat-track">
                <div className="stat-ghost hp" style={{ width: `${villainHpGhost}%` }} />
                <div className="stat-fill hp villain" style={{ width: `${percent(battleState.villain.currentHp, battleState.villain.maxHp)}%` }} />
              </div>
              <div className="hp-feedback-layer" aria-live="polite" aria-atomic="false">
                {combatFeedback.villain.map((entry) => (
                  <div key={entry.id} className={`hp-feedback-float hp-feedback-float--${entry.tone}`}>
                    {entry.tone === "blocked" ? <span className="hp-feedback-icon">🛡</span> : null}
                    <span>{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fighter-stat">
              <span>Energy</span>
              <span>
                {battleState.villain.currentEnergy}/{battleState.villain.maxEnergy}
              </span>
              <div className="stat-track">
                <div className="stat-ghost energy" style={{ width: `${villainEnergyGhost}%` }} />
                <div className="stat-fill energy villain" style={{ width: `${percent(battleState.villain.currentEnergy, battleState.villain.maxEnergy)}%` }} />
              </div>
            </div>
          </div>
          <div className="fighter-loot-section">
            <h3>Rewards</h3>
            <div className="reward-card-grid side-grid">
              {runtimeEncounter.rewards.map((reward) => (
                <div key={reward.id} className="reward-card">
                  <strong>{reward.name}</strong>
                  <small>+{reward.value}</small>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <div className={`play-cutscene-dock app-cutscene-dock ${isPlayCutsceneMenuOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className={`pointer-highlight-toggle ${isPointerHighlightEnabled ? "is-active" : ""}`}
          onClick={() => setIsPointerHighlightEnabled((enabled) => !enabled)}
          title={`Toggle pointer highlight (${pointerConfig.shortcut})`}
        >
          {isPointerHighlightEnabled ? "Pointer On" : "Pointer"}
        </button>
        <button
          type="button"
          className={`pointer-palette-toggle pointer-palette-${pointerPalette}`}
          onClick={() => setPointerPalette((current) => (current === "kids" ? "villain" : "kids"))}
          title={`Switch pointer palette (${pointerConfig.paletteShortcut})`}
        >
          {pointerPalette === "kids" ? "Kids Trail" : "Villain Trail"}
        </button>
        <button type="button" onClick={() => setIsPlayCutsceneMenuOpen((open) => !open)}>
          {isPlayCutsceneMenuOpen ? "Hide Cutscenes" : "Cutscenes"}
        </button>
        {isPlayCutsceneMenuOpen ? (
          <div className="play-cutscene-menu">
            <div className="play-cutscene-toolbar">
              <label>
                <span className="sr-only">Cutscene Tag Filter</span>
                <select
                  value={playCutsceneTag}
                  onChange={(event) => setPlayCutsceneTag(event.target.value)}
                >
                  {playCutsceneTagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag === "all" ? "All tags" : tag}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Cutscene</span>
                <select
                  value={selectedPlayCutsceneId ?? ""}
                  onChange={(event) => setSelectedPlayCutsceneId(event.target.value || null)}
                >
                  {playCutscenes.map((cutscene) => (
                    <option key={cutscene.id} value={cutscene.id}>
                      {cutscene.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => triggerCutscene(selectedPlayCutsceneId)}
              disabled={!selectedPlayCutsceneId}
            >
              Play
            </button>
          </div>
        ) : null}
      </div>
      <div className={`pointer-highlight-overlay ${isPointerHighlightEnabled ? "is-active" : ""}`} aria-hidden="true">
        <span
          className={`pointer-highlight-ring ${isPointerPressed ? "is-pressed" : ""}`}
          style={{
            left: `${pointerPosition.x}px`,
            top: `${pointerPosition.y}px`,
            width: `${Math.max(8, pointerConfig.ringSize)}px`,
            height: `${Math.max(8, pointerConfig.ringSize)}px`,
            ["--pointer-ring-a" as string]: activePointerColors[0] ?? "#4cc9ff",
            ["--pointer-ring-b" as string]:
              activePointerColors[1] ?? activePointerColors[0] ?? "#8be9ff",
          }}
        />
        {pointerTrailPoints.map((point, index) => {
          const depth = (index + 1) / Math.max(1, pointerTrailPoints.length);
          return (
            <span
              key={point.id}
              className="pointer-highlight-comet"
              style={{
                left: `${point.x}px`,
                top: `${point.y}px`,
                width: `${Math.max(6, pointerConfig.trailSize)}px`,
                height: `${Math.max(6, pointerConfig.trailSize)}px`,
                ["--trail-color-a" as string]: point.colorA,
                ["--trail-color-b" as string]: point.colorB,
                ["--trail-fade-ms" as string]: `${Math.max(1, pointerConfig.fadeMs)}ms`,
                ["--trail-start-opacity" as string]: `${0.3 + depth * 0.7}`,
                ["--trail-start-scale" as string]: `${0.7 + depth * 0.35}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
