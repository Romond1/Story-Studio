import { create } from "zustand";
import { applyMiniGameResolution, createBattleState } from "../battle/battleSystem";
import { DEFAULT_ENCOUNTER, SAMPLE_CARD_LIBRARY } from "../data/sampleData";
import type { BossProjectFileV1 } from "../types/projectFile";
import {
  type ActionItem,
  type BattleEffectsState,
  type BattleProgress,
  type BattleResolutionRules,
  type BattleSide,
  type BattleSettings,
  type BattleState,
  type BoardDashMedallionKind,
  type CardData,
  type CutsceneData,
  type DifficultyLevel,
  type EncounterConfig,
  type EpisodeHeroOption,
  type FighterData,
  type IntroSetupConfig,
  type IntermissionState,
  type MiniGameId,
  type MiniGameResult,
  type OverlayState,
  type PointerHighlightConfig,
  type PlayAreaViewState,
  type PowerUpData,
  type PowerUpEffectType,
  type RewardData,
  type ScoreState,
  type UIMode,
  BOARD_DASH_MEDALLION_KINDS,
  isMiniGameId,
  MINI_GAME_IDS,
} from "../types/game";

const ENCOUNTER_STORAGE_KEY = "story-studio.final-boss-hero.encounter.v1";
const SAVE_INDEX_STORAGE_KEY = "story-studio.final-boss-hero.state-saves.v1";
const ACTIVE_SAVE_STORAGE_KEY = "story-studio.final-boss-hero.active-save.v1";
const DEFAULT_CARD_USAGE: MiniGameId[] = ["memoryReveal", "matchPairs", "laneBattle", "openBox", "boardDash"];
const DEFAULT_POWER_UP_ENERGY_COSTS: Record<PowerUpEffectType, number> = {
  heal: 15,
  peek: 10,
  shield: 15,
  powerBoost: 10,
  retry: 20,
};
const POWER_UP_COMPATIBLE_GAMES: Record<PowerUpEffectType, MiniGameId[]> = {
  heal: DEFAULT_CARD_USAGE,
  peek: ["memoryReveal", "matchPairs", "openBox"],
  shield: DEFAULT_CARD_USAGE,
  powerBoost: ["laneBattle"],
  retry: ["laneBattle", "openBox"],
};

interface SavedStateEntry {
  key: string;
  name: string;
  savedAt: string;
}

function cloneEncounter(config: EncounterConfig): EncounterConfig {
  return JSON.parse(JSON.stringify(config)) as EncounterConfig;
}

function normalizeEnabledMiniGames(ids: MiniGameId[]): MiniGameId[] {
  return [...new Set(ids)];
}

function normalizeGameOrder(enabledMiniGames: MiniGameId[], gameOrder: MiniGameId[]): MiniGameId[] {
  const enabled = new Set(enabledMiniGames);
  const orderedEnabled = gameOrder.filter((gameId) => enabled.has(gameId));
  const missing = enabledMiniGames.filter((gameId) => !orderedEnabled.includes(gameId));
  return [...orderedEnabled, ...missing];
}

function sanitizeDifficulty(value: unknown): DifficultyLevel {
  return value === "easy" || value === "normal" || value === "hard" ? value : "normal";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function sanitizeMiniGameList(value: unknown): MiniGameId[] {
  const ids = toStringArray(value).filter((entry): entry is MiniGameId => isMiniGameId(entry));
  return [...new Set(ids)];
}

function sanitizeNonNegativeNumber(value: unknown, fallback: number, minimum = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

const BOARD_DASH_MEDALLION_MAX = 20;

function sanitizeMedallionCounts(
  value: unknown,
  fallback: Record<BoardDashMedallionKind, number>,
): Record<BoardDashMedallionKind, number> {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<BoardDashMedallionKind, unknown>>;
  const result = {} as Record<BoardDashMedallionKind, number>;
  BOARD_DASH_MEDALLION_KINDS.forEach((kind) => {
    result[kind] = Math.round(
      Math.min(BOARD_DASH_MEDALLION_MAX, sanitizeNonNegativeNumber(source[kind], fallback[kind], 0)),
    );
  });
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createInitialBattleEffects(): BattleEffectsState {
  return {
    shieldCharges: { hero: 0, villain: 0 },
    peekCharges: { hero: 0, villain: 0 },
    powerBoostCharges: { hero: 0, villain: 0 },
    retryCharges: { hero: 0, villain: 0 },
  };
}

function normalizePowerUpEffectType(value: unknown, fallbackId = ""): PowerUpEffectType | null {
  if (value === "heal" || value === "peek" || value === "shield" || value === "powerBoost" || value === "retry") {
    return value;
  }
  const id = fallbackId.toLowerCase();
  if (id.includes("heal")) return "heal";
  if (id.includes("peek")) return "peek";
  if (id.includes("shield")) return "shield";
  if (id.includes("boost") || id.includes("power")) return "powerBoost";
  if (id.includes("retry") || id.includes("repick") || id.includes("re-pick")) return "retry";
  return null;
}

function getPowerUpEnergyCost(powerUp: PowerUpData, effectType: PowerUpEffectType | null): number {
  if (typeof powerUp.energyCost === "number" && Number.isFinite(powerUp.energyCost)) {
    return Math.max(0, powerUp.energyCost);
  }
  if (effectType) {
    return DEFAULT_POWER_UP_ENERGY_COSTS[effectType];
  }
  return 0;
}

function isBattlePhase(
  value: unknown,
): value is BattleProgress["phase"] {
  return (
    value === "setup" ||
    value === "inProgress" ||
    value === "roundComplete" ||
    value === "intermission" ||
    value === "battleComplete"
  );
}

function isOverlayState(value: unknown): value is OverlayState {
  return (
    value === "none" ||
    value === "roundResult" ||
    value === "battleResult" ||
    value === "saveConfirmation"
  );
}

function isUIMode(value: unknown): value is UIMode {
  return value === "play" || value === "edit";
}

function sanitizeSaveName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 80) : `Save ${new Date().toLocaleString()}`;
}

function makeSaveStorageKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${ENCOUNTER_STORAGE_KEY}.save.${slug || "snapshot"}`;
}

function loadSaveIndex(): SavedStateEntry[] {
  const raw = localStorage.getItem(SAVE_INDEX_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is SavedStateEntry => {
        if (!entry || typeof entry !== "object") return false;
        const source = entry as Partial<SavedStateEntry>;
        return (
          typeof source.key === "string" &&
          typeof source.name === "string" &&
          typeof source.savedAt === "string"
        );
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

function saveIndex(entries: SavedStateEntry[]): void {
  localStorage.setItem(SAVE_INDEX_STORAGE_KEY, JSON.stringify(entries.slice(0, 40)));
}

function sanitizeBattleEffects(raw: unknown): BattleEffectsState {
  const source = raw && typeof raw === "object" ? (raw as Partial<BattleEffectsState>) : {};
  const fallback = createInitialBattleEffects();
  return {
    shieldCharges: {
      hero: sanitizeNonNegativeNumber(source.shieldCharges?.hero, fallback.shieldCharges.hero),
      villain: sanitizeNonNegativeNumber(source.shieldCharges?.villain, fallback.shieldCharges.villain),
    },
    peekCharges: {
      hero: sanitizeNonNegativeNumber(source.peekCharges?.hero, fallback.peekCharges.hero),
      villain: sanitizeNonNegativeNumber(source.peekCharges?.villain, fallback.peekCharges.villain),
    },
    powerBoostCharges: {
      hero: sanitizeNonNegativeNumber(
        source.powerBoostCharges?.hero,
        fallback.powerBoostCharges.hero,
      ),
      villain: sanitizeNonNegativeNumber(
        source.powerBoostCharges?.villain,
        fallback.powerBoostCharges.villain,
      ),
    },
    retryCharges: {
      hero: sanitizeNonNegativeNumber(source.retryCharges?.hero, fallback.retryCharges.hero),
      villain: sanitizeNonNegativeNumber(source.retryCharges?.villain, fallback.retryCharges.villain),
    },
  };
}

function sanitizeBattleProgress(raw: unknown, fallback: BattleProgress): BattleProgress {
  const source = raw && typeof raw === "object" ? (raw as Partial<BattleProgress>) : {};
  return {
    phase: isBattlePhase(source.phase) ? source.phase : fallback.phase,
    currentRound: sanitizeNonNegativeNumber(source.currentRound, fallback.currentRound, 1),
    completedMiniGames: sanitizeMiniGameList(source.completedMiniGames),
  };
}

function sanitizeScores(raw: unknown, fallback: ScoreState): ScoreState {
  const source = raw && typeof raw === "object" ? (raw as Partial<ScoreState>) : {};
  return {
    hero: sanitizeNonNegativeNumber(source.hero, fallback.hero),
    villain: sanitizeNonNegativeNumber(source.villain, fallback.villain),
  };
}

function sanitizeBattleState(raw: unknown, settings: BattleSettings): BattleState {
  const fallback = createBattleState(settings);
  const source = raw && typeof raw === "object" ? (raw as Partial<BattleState>) : {};
  const heroSource =
    source.hero && typeof source.hero === "object" ? source.hero : fallback.hero;
  const villainSource =
    source.villain && typeof source.villain === "object" ? source.villain : fallback.villain;
  const clamped: BattleState = {
    hero: {
      currentHp: sanitizeNonNegativeNumber(heroSource.currentHp, fallback.hero.currentHp),
      maxHp: settings.heroMaxHp,
      currentEnergy: sanitizeNonNegativeNumber(heroSource.currentEnergy, fallback.hero.currentEnergy),
      maxEnergy: settings.heroMaxEnergy,
    },
    villain: {
      currentHp: sanitizeNonNegativeNumber(villainSource.currentHp, fallback.villain.currentHp),
      maxHp: settings.villainMaxHp,
      currentEnergy: sanitizeNonNegativeNumber(
        villainSource.currentEnergy,
        fallback.villain.currentEnergy,
      ),
      maxEnergy: settings.villainMaxEnergy,
    },
    outcome:
      source.outcome === "heroVictory" ||
      source.outcome === "villainVictory" ||
      source.outcome === "draw" ||
      source.outcome === "active"
        ? source.outcome
        : fallback.outcome,
  };
  return clampBattleStateToSettings(clamped, settings);
}

function sanitizeIntermissionState(raw: unknown): IntermissionState {
  const source = raw && typeof raw === "object" ? (raw as Partial<IntermissionState>) : {};
  return {
    sourceMiniGameId: source.sourceMiniGameId && isMiniGameId(source.sourceMiniGameId)
      ? source.sourceMiniGameId
      : null,
    lastResult:
      source.lastResult &&
      typeof source.lastResult === "object" &&
      source.lastResult.miniGameId &&
      isMiniGameId(source.lastResult.miniGameId)
        ? {
            miniGameId: source.lastResult.miniGameId,
            winner:
              source.lastResult.winner === "hero" ||
              source.lastResult.winner === "villain" ||
              source.lastResult.winner === "draw"
                ? source.lastResult.winner
                : "draw",
            heroScore: sanitizeNonNegativeNumber(source.lastResult.heroScore, 0),
            villainScore: sanitizeNonNegativeNumber(source.lastResult.villainScore, 0),
            scoreDifference: sanitizeNonNegativeNumber(source.lastResult.scoreDifference, 0),
          }
        : null,
    resolution:
      source.resolution && typeof source.resolution === "object"
        ? {
            damageToHero: sanitizeNonNegativeNumber(source.resolution.damageToHero, 0),
            damageToVillain: sanitizeNonNegativeNumber(source.resolution.damageToVillain, 0),
            blockedDamageToHero: sanitizeNonNegativeNumber(source.resolution.blockedDamageToHero, 0),
            blockedDamageToVillain: sanitizeNonNegativeNumber(
              source.resolution.blockedDamageToVillain,
              0,
            ),
            heroEnergyDelta: sanitizeNonNegativeNumber(source.resolution.heroEnergyDelta, 0, -9999),
            villainEnergyDelta: sanitizeNonNegativeNumber(
              source.resolution.villainEnergyDelta,
              0,
              -9999,
            ),
            winner:
              source.resolution.winner === "hero" ||
              source.resolution.winner === "villain" ||
              source.resolution.winner === "draw"
                ? source.resolution.winner
                : "draw",
          }
        : null,
  };
}

function buildProjectFile(state: {
  activeEncounter: EncounterConfig;
  cardLibrary: CardData[];
  selectedMiniGame: MiniGameId | null;
  selectedEpisodeHeroId: string | null;
  battleProgress: BattleProgress;
  scores: ScoreState;
  battleState: BattleState;
  battleEffects: BattleEffectsState;
  intermissionState: IntermissionState;
}): BossProjectFileV1 {
  return {
    metadata: {
      schema: "final-boss-hero-project",
      version: 1,
      projectName: state.activeEncounter.name,
      exportedAt: new Date().toISOString(),
    },
    project: {
      encounter: cloneEncounter(state.activeEncounter),
      cardLibrary: JSON.parse(JSON.stringify(state.cardLibrary)) as CardData[],
    },
    session: {
      selectedMiniGame: state.selectedMiniGame,
      selectedEpisodeHeroId: state.selectedEpisodeHeroId,
      battleProgress: JSON.parse(JSON.stringify(state.battleProgress)) as BattleProgress,
      scores: { ...state.scores },
      battleState: JSON.parse(JSON.stringify(state.battleState)) as BattleState,
      battleEffects: JSON.parse(JSON.stringify(state.battleEffects)) as BattleEffectsState,
      intermissionState: JSON.parse(JSON.stringify(state.intermissionState)) as IntermissionState,
    },
  };
}

function sanitizeProjectImportPayload(raw: unknown): {
  activeEncounter: EncounterConfig;
  cardLibrary: CardData[];
  selectedMiniGame: MiniGameId | null;
  selectedEpisodeHeroId: string | null;
  battleProgress: BattleProgress;
  scores: ScoreState;
  battleState: BattleState;
  battleEffects: BattleEffectsState;
  intermissionState: IntermissionState;
} | null {
  if (!isRecord(raw) || !isRecord(raw.metadata) || !isRecord(raw.project)) {
    return null;
  }
  if (raw.metadata.schema !== "final-boss-hero-project" || raw.metadata.version !== 1) {
    return null;
  }
  if (!isRecord(raw.project.encounter)) {
    return null;
  }
  const sanitizedEncounter = sanitizeEncounter(raw.project.encounter);
  if (!sanitizedEncounter) {
    return null;
  }
  const parsedLibrary = sanitizeCardLibrary(raw.project.cardLibrary);
  const cardLibrary = parsedLibrary.length > 0 ? parsedLibrary : SAMPLE_CARD_LIBRARY;
  const selectedCardIds = normalizeSelectedCardIds(sanitizedEncounter.selectedCardIds, cardLibrary);
  const activeEncounter = {
    ...sanitizedEncounter,
    selectedCardIds:
      selectedCardIds.length > 0 ? selectedCardIds : cardLibrary.slice(0, 6).map((card) => card.id),
  };

  const session = isRecord(raw.session) ? raw.session : {};
  const selectedMiniGame =
    typeof session.selectedMiniGame === "string" &&
    isMiniGameId(session.selectedMiniGame) &&
    activeEncounter.gameOrder.includes(session.selectedMiniGame)
      ? session.selectedMiniGame
      : activeEncounter.gameOrder[0] ?? null;
  const selectedEpisodeHeroId =
    typeof session.selectedEpisodeHeroId === "string" &&
    activeEncounter.introSetup.heroes.some((hero) => hero.id === session.selectedEpisodeHeroId)
      ? session.selectedEpisodeHeroId
      : null;
  const battleProgress = sanitizeBattleProgress(session.battleProgress, initialBattleProgress);
  const scores = sanitizeScores(session.scores, initialScores);
  const battleState = sanitizeBattleState(session.battleState, activeEncounter.battleSettings);
  const battleEffects = sanitizeBattleEffects(session.battleEffects);
  const intermissionState = sanitizeIntermissionState(session.intermissionState);
  return {
    activeEncounter,
    cardLibrary,
    selectedMiniGame,
    selectedEpisodeHeroId,
    battleProgress,
    scores,
    battleState,
    battleEffects,
    intermissionState,
  };
}

function sanitizeCard(raw: unknown): CardData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<CardData>;
  if (
    typeof source.id !== "string" ||
    typeof source.title !== "string" ||
    typeof source.image !== "string" ||
    typeof source.pairId !== "string" ||
    typeof source.value !== "number" ||
    !Array.isArray(source.tags)
  ) {
    return null;
  }

  return {
    id: source.id,
    title: source.title,
    image: source.image,
    value: source.value,
    pairId: source.pairId,
    tags: source.tags.filter((tag): tag is string => typeof tag === "string"),
    description: typeof source.description === "string" ? source.description : undefined,
    frontImage: typeof source.frontImage === "string" ? source.frontImage : undefined,
    backImage: typeof source.backImage === "string" ? source.backImage : undefined,
    frontText: typeof source.frontText === "string" ? source.frontText : undefined,
    backText: typeof source.backText === "string" ? source.backText : undefined,
    textColor: typeof source.textColor === "string" ? source.textColor : undefined,
    fontSize: typeof source.fontSize === "number" ? source.fontSize : undefined,
    textAlign:
      source.textAlign === "left" || source.textAlign === "center" || source.textAlign === "right"
        ? source.textAlign
        : undefined,
    cardWidth: typeof source.cardWidth === "number" ? source.cardWidth : undefined,
    cardHeight: typeof source.cardHeight === "number" ? source.cardHeight : undefined,
    // Missing assignments are the original card model's "all games" default.
    // Preserve explicit [] (none) when importing an edited project.
    miniGames: source.miniGames === undefined ? undefined : sanitizeMiniGameList(source.miniGames),
    boardDashQuestion: typeof source.boardDashQuestion === "string" ? source.boardDashQuestion : undefined,
  };
}

function sanitizeCardLibrary(raw: unknown): CardData[] {
  return Array.isArray(raw)
    ? raw.map((entry) => sanitizeCard(entry)).filter((entry): entry is CardData => Boolean(entry))
    : [];
}

function sanitizeReward(raw: unknown): RewardData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<RewardData>;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    typeof source.description !== "string" ||
    typeof source.value !== "number"
  ) {
    return null;
  }

  return {
    id: source.id,
    name: source.name,
    description: source.description,
    value: source.value,
    icon: typeof source.icon === "string" ? source.icon : undefined,
    category: typeof source.category === "string" ? source.category : undefined,
    applicableGames: sanitizeMiniGameList(source.applicableGames),
    effectType: typeof source.effectType === "string" ? source.effectType : undefined,
    effectValue: typeof source.effectValue === "number" ? source.effectValue : undefined,
  };
}

function sanitizePowerUp(raw: unknown): PowerUpData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<PowerUpData>;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    typeof source.description !== "string" ||
    typeof source.charges !== "number"
  ) {
    return null;
  }

  return {
    id: source.id,
    name: source.name,
    description: source.description,
    charges: source.charges,
    energyCost:
      typeof source.energyCost === "number" && Number.isFinite(source.energyCost)
        ? Math.max(0, source.energyCost)
        : undefined,
    icon: typeof source.icon === "string" ? source.icon : undefined,
    category: typeof source.category === "string" ? source.category : undefined,
    applicableGames: sanitizeMiniGameList(source.applicableGames),
    effectType:
      typeof source.effectType === "string"
        ? normalizePowerUpEffectType(source.effectType, source.id) ?? source.effectType
        : undefined,
    effectValue: typeof source.effectValue === "number" ? source.effectValue : undefined,
  };
}

function sanitizeCutscene(raw: unknown): CutsceneData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<CutsceneData>;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    typeof source.mediaSource !== "string" ||
    (source.mediaType !== "image" && source.mediaType !== "video")
  ) {
    return null;
  }

  return {
    id: source.id,
    name: source.name,
    mediaSource: source.mediaSource,
    mediaType: source.mediaType,
    description: typeof source.description === "string" ? source.description : undefined,
    tags: toStringArray(source.tags),
  };
}

function sanitizeActionItem(raw: unknown): ActionItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const source = raw as Partial<ActionItem>;
  if (typeof source.id !== "string" || typeof source.text !== "string" || source.text.trim().length === 0) {
    return null;
  }
  return {
    id: source.id,
    text: source.text,
    emoji: typeof source.emoji === "string" ? source.emoji : undefined,
    category: typeof source.category === "string" ? source.category : undefined,
  };
}

function sanitizeBattleResolutionRules(
  raw: unknown,
  fallback: BattleResolutionRules,
): BattleResolutionRules {
  const source = raw && typeof raw === "object" ? (raw as Partial<BattleResolutionRules>) : {};
  return {
    baseDamage: sanitizeNonNegativeNumber(source.baseDamage, fallback.baseDamage),
    bonusDamagePerScore: sanitizeNonNegativeNumber(
      source.bonusDamagePerScore,
      fallback.bonusDamagePerScore,
    ),
    drawDamage: sanitizeNonNegativeNumber(source.drawDamage, fallback.drawDamage),
    participationEnergyCost: sanitizeNonNegativeNumber(
      source.participationEnergyCost,
      fallback.participationEnergyCost,
    ),
    winnerEnergyGain: sanitizeNonNegativeNumber(source.winnerEnergyGain, fallback.winnerEnergyGain),
    loserEnergyLoss: sanitizeNonNegativeNumber(source.loserEnergyLoss, fallback.loserEnergyLoss),
    drawEnergyGain: sanitizeNonNegativeNumber(source.drawEnergyGain, fallback.drawEnergyGain),
  };
}

function sanitizeBattleSettings(raw: unknown, fallback: BattleSettings): BattleSettings {
  const source = raw && typeof raw === "object" ? (raw as Partial<BattleSettings>) : {};
  const heroMaxHp = sanitizeNonNegativeNumber(source.heroMaxHp, fallback.heroMaxHp, 1);
  const heroMaxEnergy = sanitizeNonNegativeNumber(source.heroMaxEnergy, fallback.heroMaxEnergy);
  const villainMaxHp = sanitizeNonNegativeNumber(source.villainMaxHp, fallback.villainMaxHp, 1);
  const villainMaxEnergy = sanitizeNonNegativeNumber(
    source.villainMaxEnergy,
    fallback.villainMaxEnergy,
  );

  return {
    heroStartHp: sanitizeNonNegativeNumber(source.heroStartHp, fallback.heroStartHp),
    heroMaxHp,
    heroStartEnergy: sanitizeNonNegativeNumber(source.heroStartEnergy, fallback.heroStartEnergy),
    heroMaxEnergy,
    villainStartHp: sanitizeNonNegativeNumber(source.villainStartHp, fallback.villainStartHp),
    villainMaxHp,
    villainStartEnergy: sanitizeNonNegativeNumber(
      source.villainStartEnergy,
      fallback.villainStartEnergy,
    ),
    villainMaxEnergy,
    resolution: sanitizeBattleResolutionRules(source.resolution, fallback.resolution),
  };
}

function createEditorId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeEpisodeHeroOption(raw: unknown): EpisodeHeroOption | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const source = raw as Partial<EpisodeHeroOption>;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    typeof source.portrait !== "string"
  ) {
    return null;
  }
  return {
    id: source.id,
    name: source.name,
    portrait: source.portrait,
    subtitle: typeof source.subtitle === "string" ? source.subtitle : undefined,
    video: typeof source.video === "string" ? source.video : undefined,
  };
}

function buildFallbackIntroSetup(hero: FighterData): IntroSetupConfig {
  const fallbackHeroes = cloneEncounter(DEFAULT_ENCOUNTER).introSetup.heroes;
  const heroOption: EpisodeHeroOption = {
    id: "hero-primary",
    name: hero.name,
    portrait: hero.portrait,
    subtitle: hero.description,
    video: hero.video,
  };
  const mergedHeroes = [heroOption];
  for (const candidate of fallbackHeroes) {
    const duplicate =
      mergedHeroes.some(
        (option) =>
          option.name.toLowerCase() === candidate.name.toLowerCase() ||
          option.portrait === candidate.portrait,
      );
    if (!duplicate) {
      mergedHeroes.push(candidate);
    }
    if (mergedHeroes.length >= 3) {
      break;
    }
  }
  return {
    enabled: true,
    title: "Episode Setup",
    subtitle: "Pick a hero and review battle cards before the challenge begins.",
    startButtonLabel: "Start Battle",
    heroes: mergedHeroes,
  };
}

function sanitizeIntroSetup(raw: unknown, hero: FighterData): IntroSetupConfig {
  const fallback = buildFallbackIntroSetup(hero);
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const source = raw as Partial<IntroSetupConfig>;
  const heroes = Array.isArray(source.heroes)
    ? source.heroes
        .map((entry) => sanitizeEpisodeHeroOption(entry))
        .filter((entry): entry is EpisodeHeroOption => Boolean(entry))
    : [];
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    title: typeof source.title === "string" && source.title.trim().length > 0 ? source.title : fallback.title,
    subtitle:
      typeof source.subtitle === "string" && source.subtitle.trim().length > 0
        ? source.subtitle
        : fallback.subtitle,
    startButtonLabel:
      typeof source.startButtonLabel === "string" && source.startButtonLabel.trim().length > 0
        ? source.startButtonLabel
        : fallback.startButtonLabel,
    heroes: heroes.length > 0 ? heroes : fallback.heroes,
  };
}

function sanitizePointerHighlightConfig(raw: unknown, fallback: PointerHighlightConfig): PointerHighlightConfig {
  const source = raw && typeof raw === "object" ? (raw as Partial<PointerHighlightConfig>) : {};
  const shortcut =
    typeof source.shortcut === "string" && source.shortcut.trim().length > 0
      ? source.shortcut.trim().slice(0, 24)
      : fallback.shortcut;
  const paletteShortcut =
    typeof source.paletteShortcut === "string" && source.paletteShortcut.trim().length > 0
      ? source.paletteShortcut.trim().slice(0, 24)
      : fallback.paletteShortcut;
  const normalizeColors = (value: unknown, fallbackColors: string[]): string[] => {
    if (!Array.isArray(value)) return fallbackColors;
    const cleaned = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 8);
    return cleaned.length >= 2 ? cleaned : fallbackColors;
  };
  return {
    enabledByDefault:
      typeof source.enabledByDefault === "boolean" ? source.enabledByDefault : fallback.enabledByDefault,
    shortcut,
    paletteShortcut,
    clickOnly: typeof source.clickOnly === "boolean" ? source.clickOnly : fallback.clickOnly,
    defaultPalette:
      source.defaultPalette === "kids" || source.defaultPalette === "villain"
        ? source.defaultPalette
        : fallback.defaultPalette,
    kidsColors: normalizeColors(source.kidsColors, fallback.kidsColors),
    villainColors: normalizeColors(source.villainColors, fallback.villainColors),
    ringSize: sanitizeNonNegativeNumber(source.ringSize, fallback.ringSize, 1),
    trailSize: sanitizeNonNegativeNumber(source.trailSize, fallback.trailSize, 1),
    trailLength: sanitizeNonNegativeNumber(source.trailLength, fallback.trailLength, 1),
    fadeMs: sanitizeNonNegativeNumber(source.fadeMs, fallback.fadeMs, 1),
    spawnMs: sanitizeNonNegativeNumber(source.spawnMs, fallback.spawnMs, 1),
  };
}

function sanitizeEncounter(raw: unknown): EncounterConfig | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<EncounterConfig>;
  if (typeof source.id !== "string" || typeof source.name !== "string") {
    return null;
  }

  const fallback = cloneEncounter(DEFAULT_ENCOUNTER);
  const heroPatch: Partial<EncounterConfig["hero"]> =
    source.hero && typeof source.hero === "object" ? source.hero : {};
  const villainPatch: Partial<EncounterConfig["villain"]> =
    source.villain && typeof source.villain === "object" ? source.villain : {};
  // Backward compatibility: always ensure every registered mini-game is present,
  // so saves made before a new game (e.g. Board Dash) was added still include it.
  const enabled = normalizeEnabledMiniGames([
    ...(Array.isArray(source.enabledMiniGames)
      ? source.enabledMiniGames.filter((value): value is MiniGameId => isMiniGameId(String(value)))
      : fallback.enabledMiniGames),
    ...MINI_GAME_IDS,
  ]);
  const order = normalizeGameOrder(
    enabled,
    Array.isArray(source.gameOrder)
      ? source.gameOrder.filter((value): value is MiniGameId => isMiniGameId(String(value)))
      : fallback.gameOrder,
  );

  const gameBackgroundsSource =
    source.gameBackgrounds && typeof source.gameBackgrounds === "object" ? source.gameBackgrounds : {};
  const gameBackgrounds: Partial<Record<MiniGameId, string>> = {};
  for (const gameId of DEFAULT_CARD_USAGE) {
    const candidate = (gameBackgroundsSource as Record<string, unknown>)[gameId];
    if (typeof candidate === "string") {
      gameBackgrounds[gameId] = candidate;
    }
  }

  const heroData: FighterData = {
    ...fallback.hero,
    ...heroPatch,
    video: typeof heroPatch.video === "string" ? heroPatch.video : fallback.hero.video,
  };
  const villainData: FighterData = {
    ...fallback.villain,
    ...villainPatch,
    video: typeof villainPatch.video === "string" ? villainPatch.video : fallback.villain.video,
  };

  return {
    id: source.id,
    name: source.name,
    hero: heroData,
    villain: villainData,
    introSetup: sanitizeIntroSetup(source.introSetup, heroData),
    background: typeof source.background === "string" ? source.background : fallback.background,
    gameBackgrounds,
    selectedCardIds: Array.isArray(source.selectedCardIds)
      ? source.selectedCardIds.filter((value): value is string => typeof value === "string")
      : fallback.selectedCardIds,
    enabledMiniGames: enabled,
    gameOrder: order,
    roundSettings: {
      roundCount:
        typeof source.roundSettings?.roundCount === "number"
          ? Math.max(1, Math.floor(source.roundSettings.roundCount))
          : fallback.roundSettings.roundCount,
      difficulty: sanitizeDifficulty(source.roundSettings?.difficulty),
    },
    rewards:
      Array.isArray(source.rewards) && source.rewards.length > 0
        ? source.rewards
            .map((entry) => sanitizeReward(entry))
            .filter((entry): entry is RewardData => Boolean(entry))
        : fallback.rewards,
    powerUps:
      Array.isArray(source.powerUps) && source.powerUps.length > 0
        ? source.powerUps
            .map((entry) => sanitizePowerUp(entry))
            .filter((entry): entry is PowerUpData => Boolean(entry))
        : fallback.powerUps,
    battleSettings: sanitizeBattleSettings(source.battleSettings, fallback.battleSettings),
    cutscenes:
      Array.isArray(source.cutscenes) && source.cutscenes.length > 0
        ? source.cutscenes
            .map((entry) => sanitizeCutscene(entry))
            .filter((entry): entry is CutsceneData => Boolean(entry))
        : fallback.cutscenes,
    actionItems:
      Array.isArray(source.actionItems) && source.actionItems.length > 0
        ? source.actionItems
            .map((entry) => sanitizeActionItem(entry))
            .filter((entry): entry is ActionItem => Boolean(entry))
        : fallback.actionItems,
    boardDashMedallionCounts: sanitizeMedallionCounts(source.boardDashMedallionCounts, fallback.boardDashMedallionCounts),
    boardDashCardLimit: Math.round(
      sanitizeNonNegativeNumber(source.boardDashCardLimit, fallback.boardDashCardLimit, 0),
    ),
    boardDashCardIds: Array.isArray(source.boardDashCardIds)
      ? source.boardDashCardIds.filter((value): value is string => typeof value === "string")
      : Array.isArray(source.selectedCardIds)
        ? source.selectedCardIds.filter((value): value is string => typeof value === "string")
        : fallback.boardDashCardIds,
    pointerHighlight: sanitizePointerHighlightConfig(source.pointerHighlight, fallback.pointerHighlight),
  };
}

function normalizeSelectedCardIds(ids: string[], cardLibrary: CardData[]): string[] {
  const cardIds = new Set(cardLibrary.map((card) => card.id));
  return [...new Set(ids.filter((id) => cardIds.has(id)))];
}

function clampBattleStateToSettings(battleState: BattleState, settings: BattleSettings): BattleState {
  const heroMaxHp = Math.max(1, settings.heroMaxHp);
  const heroMaxEnergy = Math.max(0, settings.heroMaxEnergy);
  const villainMaxHp = Math.max(1, settings.villainMaxHp);
  const villainMaxEnergy = Math.max(0, settings.villainMaxEnergy);

  return {
    ...battleState,
    hero: {
      currentHp: Math.min(battleState.hero.currentHp, heroMaxHp),
      maxHp: heroMaxHp,
      currentEnergy: Math.min(battleState.hero.currentEnergy, heroMaxEnergy),
      maxEnergy: heroMaxEnergy,
    },
    villain: {
      currentHp: Math.min(battleState.villain.currentHp, villainMaxHp),
      maxHp: villainMaxHp,
      currentEnergy: Math.min(battleState.villain.currentEnergy, villainMaxEnergy),
      maxEnergy: villainMaxEnergy,
    },
  };
}

function getNextMiniGame(gameOrder: MiniGameId[], currentGame: MiniGameId | null): MiniGameId | null {
  if (gameOrder.length === 0) {
    return null;
  }
  if (!currentGame) {
    return gameOrder[0];
  }
  const currentIndex = gameOrder.indexOf(currentGame);
  if (currentIndex < 0) {
    return gameOrder[0];
  }
  return gameOrder[(currentIndex + 1) % gameOrder.length] ?? gameOrder[0];
}

function computeBattleOutcome(heroHp: number, villainHp: number): BattleState["outcome"] {
  if (heroHp <= 0 && villainHp <= 0) {
    return "draw";
  }
  if (villainHp <= 0) {
    return "heroVictory";
  }
  if (heroHp <= 0) {
    return "villainVictory";
  }
  return "active";
}

const initialEncounter = cloneEncounter(DEFAULT_ENCOUNTER);

const initialBattleProgress: BattleProgress = {
  phase: "setup",
  currentRound: 1,
  completedMiniGames: [],
};

const initialScores: ScoreState = {
  hero: 0,
  villain: 0,
};

const initialPlayAreaView: PlayAreaViewState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

const initialIntermissionState: IntermissionState = {
  sourceMiniGameId: null,
  lastResult: null,
  resolution: null,
};

export interface BattleStoreState {
  cardLibrary: CardData[];
  activeEncounter: EncounterConfig;
  selectedMiniGame: MiniGameId | null;
  selectedEpisodeHeroId: string | null;
  battleProgress: BattleProgress;
  scores: ScoreState;
  battleState: BattleState;
  battleEffects: BattleEffectsState;
  intermissionState: IntermissionState;
  playAreaView: PlayAreaViewState;
  uiMode: UIMode;
  overlayState: OverlayState;
  setUIMode: (mode: UIMode) => void;
  setOverlayState: (overlayState: OverlayState) => void;
  setPlayAreaView: (patch: Partial<PlayAreaViewState>) => void;
  resetPlayAreaView: () => void;
  setSelectedMiniGame: (gameId: MiniGameId | null) => void;
  setEncounterName: (name: string) => void;
  updateIntroSetup: (patch: Partial<IntroSetupConfig>) => void;
  createIntroHeroOption: () => string;
  updateIntroHeroOption: (heroId: string, patch: Partial<EpisodeHeroOption>) => void;
  deleteIntroHeroOption: (heroId: string) => void;
  setSelectedEpisodeHeroId: (heroId: string | null) => void;
  applySelectedEpisodeHero: () => boolean;
  updateHero: (patch: Partial<EncounterConfig["hero"]>) => void;
  updateVillain: (patch: Partial<EncounterConfig["villain"]>) => void;
  setBackground: (background: string) => void;
  setGameBackground: (gameId: MiniGameId, background: string) => void;
  toggleCardSelection: (cardId: string) => void;
  setCardSelected: (cardId: string, selected: boolean) => void;
  createCard: () => string;
  updateCard: (cardId: string, patch: Partial<CardData>) => void;
  duplicateCard: (cardId: string) => string | null;
  deleteCard: (cardId: string) => void;
  toggleMiniGameEnabled: (gameId: MiniGameId) => void;
  setGameOrder: (gameOrder: MiniGameId[]) => void;
  moveGameOrderItem: (index: number, direction: -1 | 1) => void;
  setRoundCount: (roundCount: number) => void;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  updateBattleSettings: (patch: Partial<BattleSettings>) => void;
  updateBattleResolutionRules: (patch: Partial<BattleResolutionRules>) => void;
  updatePointerHighlight: (patch: Partial<PointerHighlightConfig>) => void;
  createCutscene: () => string;
  updateCutscene: (cutsceneId: string, patch: Partial<CutsceneData>) => void;
  duplicateCutscene: (cutsceneId: string) => string | null;
  deleteCutscene: (cutsceneId: string) => void;
  createActionItem: () => string;
  updateActionItem: (actionItemId: string, patch: Partial<ActionItem>) => void;
  deleteActionItem: (actionItemId: string) => void;
  setBoardDashMedallionCount: (kind: BoardDashMedallionKind, count: number) => void;
  setBoardDashCardLimit: (limit: number) => void;
  setBoardDashCardSelected: (cardId: string, selected: boolean) => void;
  createReward: () => string;
  updateReward: (rewardId: string, patch: Partial<RewardData>) => void;
  duplicateReward: (rewardId: string) => string | null;
  deleteReward: (rewardId: string) => void;
  createPowerUp: () => string;
  updatePowerUp: (powerUpId: string, patch: Partial<PowerUpData>) => void;
  duplicatePowerUp: (powerUpId: string) => string | null;
  deletePowerUp: (powerUpId: string) => void;
  setBattleProgress: (patch: Partial<BattleProgress>) => void;
  adjustScores: (heroDelta: number, villainDelta: number) => void;
  usePowerUp: (powerUpId: string, side: BattleSide, miniGameId: MiniGameId | null) => boolean;
  consumeBattleEffectCharge: (
    effectType: "peek" | "powerBoost" | "retry",
    side: BattleSide,
  ) => boolean;
  completeMiniGame: (result: MiniGameResult) => void;
  continueFromIntermission: () => void;
  saveEncounterToLocalStorage: (saveName?: string) => void;
  loadEncounterFromLocalStorage: (saveName?: string) => void;
  exportProjectFile: () => BossProjectFileV1;
  importProjectFile: (payload: unknown) => { ok: boolean; error?: string };
  resetBattleProgress: () => void;
  resetBattleSession: () => void;
}

export const useBattleStore = create<BattleStoreState>((set, get) => ({
  cardLibrary: SAMPLE_CARD_LIBRARY,
  activeEncounter: initialEncounter,
  selectedMiniGame: initialEncounter.gameOrder[0] ?? null,
  selectedEpisodeHeroId: null,
  battleProgress: initialBattleProgress,
  scores: initialScores,
  battleState: createBattleState(initialEncounter.battleSettings),
  battleEffects: createInitialBattleEffects(),
  intermissionState: initialIntermissionState,
  playAreaView: initialPlayAreaView,
  uiMode: "play",
  overlayState: "none",
  setUIMode: (mode) => set({ uiMode: mode }),
  setOverlayState: (overlayState) => set({ overlayState }),
  setPlayAreaView: (patch) =>
    set((state) => ({
      playAreaView: {
        ...state.playAreaView,
        ...patch,
      },
    })),
  resetPlayAreaView: () => set({ playAreaView: { ...initialPlayAreaView } }),
  setSelectedMiniGame: (gameId) => set({ selectedMiniGame: gameId }),
  setEncounterName: (name) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        name,
      },
    })),
  updateIntroSetup: (patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        introSetup: {
          ...state.activeEncounter.introSetup,
          ...patch,
          heroes: patch.heroes ?? state.activeEncounter.introSetup.heroes,
        },
      },
    })),
  createIntroHeroOption: () => {
    const heroId = createEditorId("hero-option");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        introSetup: {
          ...state.activeEncounter.introSetup,
          heroes: [
            ...state.activeEncounter.introSetup.heroes,
            {
              id: heroId,
              name: "New Hero",
              portrait: "https://placehold.co/220x250?text=Hero",
              subtitle: "Hero subtitle",
              video: "",
            },
          ],
        },
      },
    }));
    return heroId;
  },
  updateIntroHeroOption: (heroId, patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        introSetup: {
          ...state.activeEncounter.introSetup,
          heroes: state.activeEncounter.introSetup.heroes.map((hero) =>
            hero.id === heroId
              ? {
                  ...hero,
                  ...patch,
                }
              : hero,
          ),
        },
      },
    })),
  deleteIntroHeroOption: (heroId) =>
    set((state) => {
      const heroes = state.activeEncounter.introSetup.heroes.filter((hero) => hero.id !== heroId);
      return {
        activeEncounter: {
          ...state.activeEncounter,
          introSetup: {
            ...state.activeEncounter.introSetup,
            heroes,
          },
        },
        selectedEpisodeHeroId:
          state.selectedEpisodeHeroId === heroId ? null : state.selectedEpisodeHeroId,
      };
    }),
  setSelectedEpisodeHeroId: (heroId) => set({ selectedEpisodeHeroId: heroId }),
  applySelectedEpisodeHero: () => {
    const state = get();
    const selectedHeroId = state.selectedEpisodeHeroId;
    if (!selectedHeroId) {
      return false;
    }
    const selectedHero = state.activeEncounter.introSetup.heroes.find((hero) => hero.id === selectedHeroId);
    return Boolean(selectedHero);
  },
  updateHero: (patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        hero: {
          ...state.activeEncounter.hero,
          ...patch,
        },
      },
    })),
  updateVillain: (patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        villain: {
          ...state.activeEncounter.villain,
          ...patch,
        },
      },
    })),
  setBackground: (background) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        background,
      },
    })),
  setGameBackground: (gameId, background) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        gameBackgrounds: {
          ...(state.activeEncounter.gameBackgrounds ?? {}),
          [gameId]: background,
        },
      },
    })),
  toggleCardSelection: (cardId) =>
    set((state) => {
      const selectedCardIds = state.activeEncounter.selectedCardIds.includes(cardId)
        ? state.activeEncounter.selectedCardIds.filter((id) => id !== cardId)
        : [...state.activeEncounter.selectedCardIds, cardId];
      return {
        activeEncounter: {
          ...state.activeEncounter,
          selectedCardIds,
        },
      };
    }),
  setCardSelected: (cardId, selected) =>
    set((state) => {
      const exists = state.activeEncounter.selectedCardIds.includes(cardId);
      if (selected && !exists) {
        return {
          activeEncounter: {
            ...state.activeEncounter,
            selectedCardIds: [...state.activeEncounter.selectedCardIds, cardId],
          },
        };
      }
      if (!selected && exists) {
        return {
          activeEncounter: {
            ...state.activeEncounter,
            selectedCardIds: state.activeEncounter.selectedCardIds.filter((id) => id !== cardId),
          },
        };
      }
      return state;
    }),
  createCard: () => {
    const cardId = createEditorId("card");
    const newCard: CardData = {
      id: cardId,
      title: "New Card",
      image: "https://placehold.co/96x96?text=Card",
      value: 1,
      pairId: "new",
      tags: [],
      miniGames: [...DEFAULT_CARD_USAGE],
      frontText: "Front",
      backText: "Back",
      textAlign: "center",
    };
    set((state) => ({
      cardLibrary: [...state.cardLibrary, newCard],
      activeEncounter: {
        ...state.activeEncounter,
        selectedCardIds: [...state.activeEncounter.selectedCardIds, cardId],
      },
    }));
    return cardId;
  },
  updateCard: (cardId, patch) =>
    set((state) => ({
      cardLibrary: state.cardLibrary.map((card) =>
        card.id === cardId
          ? {
              ...card,
              ...patch,
            }
          : card,
      ),
    })),
  duplicateCard: (cardId) => {
    const source = get().cardLibrary.find((card) => card.id === cardId);
    if (!source) {
      return null;
    }
    const duplicatedId = createEditorId("card");
    set((state) => ({
      cardLibrary: [
        ...state.cardLibrary,
        {
          ...source,
          id: duplicatedId,
          title: `${source.title} Copy`,
        },
      ],
      activeEncounter: {
        ...state.activeEncounter,
        selectedCardIds: [...state.activeEncounter.selectedCardIds, duplicatedId],
      },
    }));
    return duplicatedId;
  },
  deleteCard: (cardId) =>
    set((state) => ({
      cardLibrary: state.cardLibrary.filter((card) => card.id !== cardId),
      activeEncounter: {
        ...state.activeEncounter,
        selectedCardIds: state.activeEncounter.selectedCardIds.filter((id) => id !== cardId),
      },
    })),
  toggleMiniGameEnabled: (gameId) =>
    set((state) => {
      const enabled = state.activeEncounter.enabledMiniGames.includes(gameId)
        ? state.activeEncounter.enabledMiniGames.filter((id) => id !== gameId)
        : [...state.activeEncounter.enabledMiniGames, gameId];
      const normalizedEnabled = normalizeEnabledMiniGames(enabled);
      const normalizedOrder = normalizeGameOrder(normalizedEnabled, state.activeEncounter.gameOrder);
      return {
        activeEncounter: {
          ...state.activeEncounter,
          enabledMiniGames: normalizedEnabled,
          gameOrder: normalizedOrder,
        },
        selectedMiniGame:
          state.selectedMiniGame && normalizedEnabled.includes(state.selectedMiniGame)
            ? state.selectedMiniGame
            : normalizedOrder[0] ?? null,
      };
    }),
  setGameOrder: (gameOrder) =>
    set((state) => {
      const normalizedOrder = normalizeGameOrder(state.activeEncounter.enabledMiniGames, gameOrder);
      return {
        activeEncounter: {
          ...state.activeEncounter,
          gameOrder: normalizedOrder,
        },
        selectedMiniGame:
          state.selectedMiniGame && normalizedOrder.includes(state.selectedMiniGame)
            ? state.selectedMiniGame
            : normalizedOrder[0] ?? null,
      };
    }),
  moveGameOrderItem: (index, direction) =>
    set((state) => {
      const order = [...state.activeEncounter.gameOrder];
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || index >= order.length || targetIndex >= order.length) {
        return state;
      }
      [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
      return {
        activeEncounter: {
          ...state.activeEncounter,
          gameOrder: order,
        },
      };
    }),
  setRoundCount: (roundCount) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        roundSettings: {
          ...state.activeEncounter.roundSettings,
          roundCount: Math.max(1, Math.floor(roundCount)),
        },
      },
    })),
  setDifficulty: (difficulty) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        roundSettings: {
          ...state.activeEncounter.roundSettings,
          difficulty,
        },
      },
    })),
  updateBattleSettings: (patch) =>
    set((state) => {
      const nextSettings: BattleSettings = {
        ...state.activeEncounter.battleSettings,
        ...patch,
        resolution: {
          ...state.activeEncounter.battleSettings.resolution,
          ...(patch.resolution ?? {}),
        },
      };
      return {
        activeEncounter: {
          ...state.activeEncounter,
          battleSettings: nextSettings,
        },
        battleState: clampBattleStateToSettings(state.battleState, nextSettings),
      };
    }),
  updateBattleResolutionRules: (patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        battleSettings: {
          ...state.activeEncounter.battleSettings,
          resolution: {
            ...state.activeEncounter.battleSettings.resolution,
            ...patch,
          },
        },
      },
    })),
  updatePointerHighlight: (patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        pointerHighlight: sanitizePointerHighlightConfig(
          {
            ...state.activeEncounter.pointerHighlight,
            ...patch,
          },
          state.activeEncounter.pointerHighlight,
        ),
      },
    })),
  createCutscene: () => {
    const cutsceneId = createEditorId("cutscene");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        cutscenes: [
          ...state.activeEncounter.cutscenes,
          {
            id: cutsceneId,
            name: "New Cutscene",
            mediaSource: "https://placehold.co/1280x720?text=Cutscene",
            mediaType: "image",
            description: "",
            tags: ["intermission"],
          },
        ],
      },
    }));
    return cutsceneId;
  },
  updateCutscene: (cutsceneId, patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        cutscenes: state.activeEncounter.cutscenes.map((cutscene) =>
          cutscene.id === cutsceneId
            ? {
                ...cutscene,
                ...patch,
                tags: patch.tags ? [...patch.tags] : cutscene.tags,
              }
            : cutscene,
        ),
      },
    })),
  duplicateCutscene: (cutsceneId) => {
    const source = get().activeEncounter.cutscenes.find((cutscene) => cutscene.id === cutsceneId);
    if (!source) {
      return null;
    }
    const duplicatedId = createEditorId("cutscene");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        cutscenes: [
          ...state.activeEncounter.cutscenes,
          {
            ...source,
            id: duplicatedId,
            name: `${source.name} Copy`,
            tags: [...source.tags],
          },
        ],
      },
    }));
    return duplicatedId;
  },
  deleteCutscene: (cutsceneId) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        cutscenes: state.activeEncounter.cutscenes.filter((cutscene) => cutscene.id !== cutsceneId),
      },
    })),
  createActionItem: () => {
    const actionItemId = createEditorId("action");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        actionItems: [
          ...state.activeEncounter.actionItems,
          { id: actionItemId, text: "New on-camera action", emoji: "⭐", category: "movement" },
        ],
      },
    }));
    return actionItemId;
  },
  updateActionItem: (actionItemId, patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        actionItems: state.activeEncounter.actionItems.map((item) =>
          item.id === actionItemId ? { ...item, ...patch } : item,
        ),
      },
    })),
  deleteActionItem: (actionItemId) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        actionItems: state.activeEncounter.actionItems.filter((item) => item.id !== actionItemId),
      },
    })),
  setBoardDashMedallionCount: (kind, count) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        boardDashMedallionCounts: {
          ...state.activeEncounter.boardDashMedallionCounts,
          [kind]: Math.round(Math.min(BOARD_DASH_MEDALLION_MAX, Math.max(0, Number.isFinite(count) ? count : 0))),
        },
      },
    })),
  setBoardDashCardLimit: (limit) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        boardDashCardLimit: Math.round(Math.max(0, Number.isFinite(limit) ? limit : 0)),
      },
    })),
  setBoardDashCardSelected: (cardId, selected) =>
    set((state) => {
      const current = state.activeEncounter.boardDashCardIds;
      const has = current.includes(cardId);
      if (selected === has) {
        return state;
      }
      const nextIds = selected ? [...current, cardId] : current.filter((id) => id !== cardId);
      // Ticking a new card in: raise the per-game limit so it's actually usable right away.
      const nextLimit =
        selected && nextIds.length > state.activeEncounter.boardDashCardLimit
          ? nextIds.length
          : state.activeEncounter.boardDashCardLimit;
      return {
        activeEncounter: {
          ...state.activeEncounter,
          boardDashCardIds: nextIds,
          boardDashCardLimit: nextLimit,
        },
      };
    }),
  createReward: () => {
    const rewardId = createEditorId("reward");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        rewards: [
          ...state.activeEncounter.rewards,
          {
            id: rewardId,
            name: "New Reward",
            description: "",
            value: 1,
            category: "reward",
          },
        ],
      },
    }));
    return rewardId;
  },
  updateReward: (rewardId, patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        rewards: state.activeEncounter.rewards.map((reward) =>
          reward.id === rewardId
            ? {
                ...reward,
                ...patch,
              }
            : reward,
        ),
      },
    })),
  duplicateReward: (rewardId) => {
    const source = get().activeEncounter.rewards.find((reward) => reward.id === rewardId);
    if (!source) {
      return null;
    }
    const duplicatedId = createEditorId("reward");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        rewards: [
          ...state.activeEncounter.rewards,
          {
            ...source,
            id: duplicatedId,
            name: `${source.name} Copy`,
          },
        ],
      },
    }));
    return duplicatedId;
  },
  deleteReward: (rewardId) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        rewards: state.activeEncounter.rewards.filter((reward) => reward.id !== rewardId),
      },
    })),
  createPowerUp: () => {
    const powerUpId = createEditorId("power");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        powerUps: [
          ...state.activeEncounter.powerUps,
          {
            id: powerUpId,
            name: "New Power-Up",
            description: "",
            charges: 1,
            energyCost: 10,
            category: "power-up",
            effectType: "heal",
            effectValue: 10,
            applicableGames: [...DEFAULT_CARD_USAGE],
          },
        ],
      },
    }));
    return powerUpId;
  },
  updatePowerUp: (powerUpId, patch) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        powerUps: state.activeEncounter.powerUps.map((powerUp) =>
          powerUp.id === powerUpId
            ? {
                ...powerUp,
                ...patch,
                energyCost:
                  typeof patch.energyCost === "number" && Number.isFinite(patch.energyCost)
                    ? Math.max(0, patch.energyCost)
                    : powerUp.energyCost,
                effectType:
                  typeof patch.effectType === "string"
                    ? normalizePowerUpEffectType(patch.effectType, powerUp.id) ?? patch.effectType
                    : powerUp.effectType,
              }
            : powerUp,
        ),
      },
    })),
  duplicatePowerUp: (powerUpId) => {
    const source = get().activeEncounter.powerUps.find((powerUp) => powerUp.id === powerUpId);
    if (!source) {
      return null;
    }
    const duplicatedId = createEditorId("power");
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        powerUps: [
          ...state.activeEncounter.powerUps,
          {
            ...source,
            id: duplicatedId,
            name: `${source.name} Copy`,
          },
        ],
      },
    }));
    return duplicatedId;
  },
  deletePowerUp: (powerUpId) =>
    set((state) => ({
      activeEncounter: {
        ...state.activeEncounter,
        powerUps: state.activeEncounter.powerUps.filter((powerUp) => powerUp.id !== powerUpId),
      },
    })),
  setBattleProgress: (patch) =>
    set((state) => ({
      battleProgress: {
        ...state.battleProgress,
        ...patch,
      },
    })),
  adjustScores: (heroDelta, villainDelta) =>
    set((state) => ({
      scores: {
        hero: state.scores.hero + heroDelta,
        villain: state.scores.villain + villainDelta,
      },
    })),
  usePowerUp: (powerUpId, side, miniGameId) => {
    const state = get();
    if (state.battleState.outcome !== "active") {
      return false;
    }
    const powerUp = state.activeEncounter.powerUps.find((entry) => entry.id === powerUpId);
    if (!powerUp) {
      return false;
    }
    const effectType = normalizePowerUpEffectType(powerUp.effectType, powerUp.id);
    if (!effectType) {
      return false;
    }

    const compatibleGames =
      powerUp.applicableGames && powerUp.applicableGames.length > 0
        ? powerUp.applicableGames
        : POWER_UP_COMPATIBLE_GAMES[effectType];
    if (miniGameId && compatibleGames.length > 0 && !compatibleGames.includes(miniGameId)) {
      return false;
    }

    const cost = getPowerUpEnergyCost(powerUp, effectType);
    const currentEnergy = state.battleState[side].currentEnergy;
    if (currentEnergy < cost) {
      return false;
    }

    const value = Math.max(
      1,
      powerUp.effectValue ??
        (effectType === "heal"
          ? 10
          : effectType === "powerBoost"
            ? 1
            : 1),
    );
    const nextBattleState: BattleState = {
      ...state.battleState,
      hero: { ...state.battleState.hero },
      villain: { ...state.battleState.villain },
      outcome: state.battleState.outcome,
    };
    nextBattleState[side] = {
      ...nextBattleState[side],
      currentEnergy: clamp(nextBattleState[side].currentEnergy - cost, 0, nextBattleState[side].maxEnergy),
    };

    const nextEffects: BattleEffectsState = {
      shieldCharges: { ...state.battleEffects.shieldCharges },
      peekCharges: { ...state.battleEffects.peekCharges },
      powerBoostCharges: { ...state.battleEffects.powerBoostCharges },
      retryCharges: { ...state.battleEffects.retryCharges },
    };

    if (effectType === "heal") {
      nextBattleState[side] = {
        ...nextBattleState[side],
        currentHp: clamp(nextBattleState[side].currentHp + value, 0, nextBattleState[side].maxHp),
      };
      nextBattleState.outcome = computeBattleOutcome(
        nextBattleState.hero.currentHp,
        nextBattleState.villain.currentHp,
      );
    } else if (effectType === "shield") {
      nextEffects.shieldCharges[side] += 1;
    } else if (effectType === "peek") {
      nextEffects.peekCharges[side] += 1;
    } else if (effectType === "powerBoost") {
      nextEffects.powerBoostCharges[side] += 1;
    } else if (effectType === "retry") {
      nextEffects.retryCharges[side] += 1;
    }

    set({
      battleState: nextBattleState,
      battleEffects: nextEffects,
    });
    return true;
  },
  consumeBattleEffectCharge: (effectType, side) => {
    const state = get();
    const nextEffects: BattleEffectsState = {
      shieldCharges: { ...state.battleEffects.shieldCharges },
      peekCharges: { ...state.battleEffects.peekCharges },
      powerBoostCharges: { ...state.battleEffects.powerBoostCharges },
      retryCharges: { ...state.battleEffects.retryCharges },
    };
    const container =
      effectType === "peek"
        ? nextEffects.peekCharges
        : effectType === "powerBoost"
          ? nextEffects.powerBoostCharges
          : nextEffects.retryCharges;
    if (container[side] <= 0) {
      return false;
    }
    container[side] -= 1;
    set({ battleEffects: nextEffects });
    return true;
  },
  completeMiniGame: (result) => {
    const state = get();
    const { nextBattleState, summary } = applyMiniGameResolution(
      state.battleState,
      state.activeEncounter.battleSettings,
      result,
      {
        shieldCharges: state.battleEffects.shieldCharges,
      },
    );
    const nextEffects: BattleEffectsState = {
      shieldCharges: {
        hero:
          state.battleEffects.shieldCharges.hero - (summary.blockedDamageToHero > 0 ? 1 : 0),
        villain:
          state.battleEffects.shieldCharges.villain - (summary.blockedDamageToVillain > 0 ? 1 : 0),
      },
      peekCharges: { ...state.battleEffects.peekCharges },
      powerBoostCharges: { ...state.battleEffects.powerBoostCharges },
      retryCharges: { ...state.battleEffects.retryCharges },
    };
    nextEffects.shieldCharges.hero = Math.max(0, nextEffects.shieldCharges.hero);
    nextEffects.shieldCharges.villain = Math.max(0, nextEffects.shieldCharges.villain);
    set({
      scores: {
        hero: state.scores.hero + result.heroScore,
        villain: state.scores.villain + result.villainScore,
      },
      battleState: nextBattleState,
      battleEffects: nextEffects,
      intermissionState: {
        sourceMiniGameId: result.miniGameId,
        lastResult: result,
        resolution: summary,
      },
      battleProgress: {
        ...state.battleProgress,
        phase: nextBattleState.outcome === "active" ? "intermission" : "battleComplete",
        completedMiniGames: [
          ...new Set<MiniGameId>([...state.battleProgress.completedMiniGames, result.miniGameId]),
        ],
      },
      overlayState: "none",
    });
  },
  continueFromIntermission: () => {
    const state = get();
    if (state.battleProgress.phase !== "intermission") {
      return;
    }
    set({
      selectedMiniGame: getNextMiniGame(state.activeEncounter.gameOrder, state.intermissionState.sourceMiniGameId),
      intermissionState: {
        ...initialIntermissionState,
      },
      battleProgress: {
        ...state.battleProgress,
        phase: "setup",
        currentRound: 1,
      },
      overlayState: "none",
    });
  },
  exportProjectFile: () => {
    const state = get();
    return buildProjectFile({
      activeEncounter: state.activeEncounter,
      cardLibrary: state.cardLibrary,
      selectedMiniGame: state.selectedMiniGame,
      selectedEpisodeHeroId: state.selectedEpisodeHeroId,
      battleProgress: state.battleProgress,
      scores: state.scores,
      battleState: state.battleState,
      battleEffects: state.battleEffects,
      intermissionState: state.intermissionState,
    });
  },
  importProjectFile: (payload) => {
    const imported = sanitizeProjectImportPayload(payload);
    if (!imported) {
      return { ok: false, error: "Invalid project file format." };
    }
    set({
      cardLibrary: imported.cardLibrary,
      activeEncounter: imported.activeEncounter,
      selectedMiniGame: imported.selectedMiniGame,
      selectedEpisodeHeroId: imported.selectedEpisodeHeroId,
      battleProgress: imported.battleProgress,
      scores: imported.scores,
      battleState: imported.battleState,
      battleEffects: imported.battleEffects,
      intermissionState: imported.intermissionState,
      uiMode: "edit",
      overlayState: "none",
      playAreaView: { ...initialPlayAreaView },
    });
    return { ok: true };
  },
  saveEncounterToLocalStorage: (saveName) => {
    const snapshot = get();
    const nextName = sanitizeSaveName(
      saveName ??
        loadSaveIndex().find((entry) => entry.key === localStorage.getItem(ACTIVE_SAVE_STORAGE_KEY))?.name ??
        "",
    );
    const saveKey = makeSaveStorageKey(nextName);
    const savedAt = new Date().toISOString();
    localStorage.setItem(
      saveKey,
      JSON.stringify({
        version: 2,
        name: nextName,
        savedAt,
        state: {
          cardLibrary: snapshot.cardLibrary,
          activeEncounter: snapshot.activeEncounter,
          selectedMiniGame: snapshot.selectedMiniGame,
          selectedEpisodeHeroId: snapshot.selectedEpisodeHeroId,
          battleProgress: snapshot.battleProgress,
          scores: snapshot.scores,
          battleState: snapshot.battleState,
          battleEffects: snapshot.battleEffects,
          intermissionState: snapshot.intermissionState,
          playAreaView: snapshot.playAreaView,
          uiMode: snapshot.uiMode,
          overlayState: snapshot.overlayState,
        },
      }),
    );
    const existing = loadSaveIndex().filter((entry) => entry.key !== saveKey);
    saveIndex([{ key: saveKey, name: nextName, savedAt }, ...existing]);
    localStorage.setItem(ACTIVE_SAVE_STORAGE_KEY, saveKey);
    localStorage.setItem(
      ENCOUNTER_STORAGE_KEY,
      JSON.stringify({
        encounter: snapshot.activeEncounter,
        cardLibrary: snapshot.cardLibrary,
      }),
    );
    set({ overlayState: "saveConfirmation" });
  },
  loadEncounterFromLocalStorage: (saveName) => {
    const index = loadSaveIndex();
    const matchedByName = saveName
      ? index.find((entry) => entry.name.toLowerCase() === saveName.toLowerCase())
      : undefined;
    const matchedByKey = saveName ? index.find((entry) => entry.key === saveName) : undefined;
    const activeKey =
      matchedByKey?.key ??
      matchedByName?.key ??
      localStorage.getItem(ACTIVE_SAVE_STORAGE_KEY) ??
      index[0]?.key ??
      ENCOUNTER_STORAGE_KEY;
    const raw = localStorage.getItem(activeKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        isRecord(parsed) &&
        parsed.version === 2 &&
        isRecord(parsed.state) &&
        isRecord(parsed.state.activeEncounter)
      ) {
        const sanitizedEncounter = sanitizeEncounter(parsed.state.activeEncounter);
        if (!sanitizedEncounter) {
          return;
        }
        const parsedLibrary = sanitizeCardLibrary(parsed.state.cardLibrary);
        const cardLibrary = parsedLibrary.length > 0 ? parsedLibrary : SAMPLE_CARD_LIBRARY;
        const selectedCardIds = normalizeSelectedCardIds(sanitizedEncounter.selectedCardIds, cardLibrary);
        const activeEncounter = {
          ...sanitizedEncounter,
          selectedCardIds:
            selectedCardIds.length > 0 ? selectedCardIds : cardLibrary.slice(0, 6).map((card) => card.id),
        };
        const selectedMiniGameRaw = parsed.state.selectedMiniGame;
        const selectedMiniGame =
          typeof selectedMiniGameRaw === "string" &&
          isMiniGameId(selectedMiniGameRaw) &&
          activeEncounter.gameOrder.includes(selectedMiniGameRaw)
            ? selectedMiniGameRaw
            : activeEncounter.gameOrder[0] ?? null;
        const selectedEpisodeHeroIdRaw = parsed.state.selectedEpisodeHeroId;
        const selectedEpisodeHeroId =
          typeof selectedEpisodeHeroIdRaw === "string" &&
          activeEncounter.introSetup.heroes.some((hero) => hero.id === selectedEpisodeHeroIdRaw)
            ? selectedEpisodeHeroIdRaw
            : null;
        const battleProgress = sanitizeBattleProgress(parsed.state.battleProgress, initialBattleProgress);
        const scores = sanitizeScores(parsed.state.scores, initialScores);
        const battleState = sanitizeBattleState(parsed.state.battleState, activeEncounter.battleSettings);
        const battleEffects = sanitizeBattleEffects(parsed.state.battleEffects);
        const intermissionState = sanitizeIntermissionState(parsed.state.intermissionState);
        const playAreaSource =
          parsed.state.playAreaView && typeof parsed.state.playAreaView === "object"
            ? (parsed.state.playAreaView as Partial<PlayAreaViewState>)
            : {};
        const playAreaView: PlayAreaViewState = {
          zoom:
            typeof playAreaSource.zoom === "number" && Number.isFinite(playAreaSource.zoom)
              ? playAreaSource.zoom
              : initialPlayAreaView.zoom,
          offsetX:
            typeof playAreaSource.offsetX === "number" && Number.isFinite(playAreaSource.offsetX)
              ? playAreaSource.offsetX
              : initialPlayAreaView.offsetX,
          offsetY:
            typeof playAreaSource.offsetY === "number" && Number.isFinite(playAreaSource.offsetY)
              ? playAreaSource.offsetY
              : initialPlayAreaView.offsetY,
        };
        set({
          cardLibrary,
          activeEncounter,
          selectedMiniGame,
          selectedEpisodeHeroId,
          battleProgress,
          scores,
          battleState,
          battleEffects,
          intermissionState,
          playAreaView,
          uiMode: isUIMode(parsed.state.uiMode) ? parsed.state.uiMode : "play",
          overlayState: isOverlayState(parsed.state.overlayState) ? parsed.state.overlayState : "none",
        });
        localStorage.setItem(ACTIVE_SAVE_STORAGE_KEY, activeKey);
        return;
      }

      const payload = parsed as { encounter?: unknown; cardLibrary?: unknown } | EncounterConfig;
      const parsedEncounter = isRecord(payload) && "encounter" in payload ? payload.encounter : payload;
      const sanitized = sanitizeEncounter(parsedEncounter);
      if (!sanitized) {
        return;
      }
      const parsedLibrary =
        isRecord(payload) && "cardLibrary" in payload ? sanitizeCardLibrary(payload.cardLibrary) : [];
      const cardLibrary = parsedLibrary.length > 0 ? parsedLibrary : SAMPLE_CARD_LIBRARY;
      const selectedCardIds = normalizeSelectedCardIds(sanitized.selectedCardIds, cardLibrary);
      const activeEncounter = {
        ...sanitized,
        selectedCardIds:
          selectedCardIds.length > 0 ? selectedCardIds : cardLibrary.slice(0, 6).map((card) => card.id),
      };
      set({
        cardLibrary,
        activeEncounter,
        selectedMiniGame: activeEncounter.gameOrder[0] ?? null,
        selectedEpisodeHeroId: null,
        battleProgress: {
          ...initialBattleProgress,
        },
        scores: {
          ...initialScores,
        },
        battleState: createBattleState(activeEncounter.battleSettings),
        battleEffects: createInitialBattleEffects(),
        intermissionState: {
          ...initialIntermissionState,
        },
        overlayState: "none",
      });
    } catch {
      set({ overlayState: "none" });
    }
  },
  resetBattleProgress: () =>
    set((state) => ({
      battleProgress: {
        ...initialBattleProgress,
      },
      scores: {
        ...initialScores,
      },
      battleState: createBattleState(state.activeEncounter.battleSettings),
      battleEffects: createInitialBattleEffects(),
      intermissionState: {
        ...initialIntermissionState,
      },
      selectedEpisodeHeroId: null,
      selectedMiniGame: state.activeEncounter.gameOrder[0] ?? null,
      overlayState: "none",
    })),
  resetBattleSession: () =>
    set((state) => ({
      battleProgress: {
        ...initialBattleProgress,
      },
      scores: {
        ...initialScores,
      },
      battleState: createBattleState(state.activeEncounter.battleSettings),
      battleEffects: createInitialBattleEffects(),
      intermissionState: {
        ...initialIntermissionState,
      },
      selectedEpisodeHeroId: null,
      selectedMiniGame: state.activeEncounter.gameOrder[0] ?? null,
      overlayState: "none",
    })),
}));
