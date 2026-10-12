export const MINI_GAME_IDS = [
  "memoryReveal",
  "matchPairs",
  "laneBattle",
  "openBox",
  "boardDash",
] as const;

export type MiniGameId = (typeof MINI_GAME_IDS)[number];
export type MiniGameWinner = "hero" | "villain" | "draw";
export const BOARD_DASH_MEDALLION_KINDS = ["move", "bonus", "back3", "rollAgain", "steal"] as const;
export type BoardDashMedallionKind = (typeof BOARD_DASH_MEDALLION_KINDS)[number];
export type BattleSide = "hero" | "villain";
export type BattleOutcome = "active" | "heroVictory" | "villainVictory" | "draw";
export type CutsceneMediaType = "image" | "video";
export type PowerUpEffectType = "heal" | "peek" | "shield" | "powerBoost" | "retry";

export interface CardData {
  id: string;
  title: string;
  image: string;
  value: number;
  pairId: string;
  tags: string[];
  description?: string;
  frontImage?: string;
  backImage?: string;
  frontText?: string;
  backText?: string;
  textColor?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  cardWidth?: number;
  cardHeight?: number;
  miniGames?: MiniGameId[];
  /** Question shown in Board Dash when a player lands on this card's tile. */
  boardDashQuestion?: string;
}

export interface ActionItem {
  id: string;
  /** The on-camera challenge the kid performs, e.g. "Pose like a hero". */
  text: string;
  /** Optional emoji shown on the board token for quick visual reading. */
  emoji?: string;
  /** Optional grouping label, e.g. "movement" or "color". */
  category?: string;
}

export interface FighterData {
  name: string;
  portrait: string;
  health: number;
  energy: number;
  description?: string;
  video?: string;
}

export interface EpisodeHeroOption {
  id: string;
  name: string;
  portrait: string;
  subtitle?: string;
  video?: string;
}

export interface IntroSetupConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  startButtonLabel: string;
  heroes: EpisodeHeroOption[];
}

export type DifficultyLevel = "easy" | "normal" | "hard";

export interface RoundSettings {
  roundCount: number;
  difficulty: DifficultyLevel;
}

export interface BattleResolutionRules {
  baseDamage: number;
  bonusDamagePerScore: number;
  drawDamage: number;
  participationEnergyCost: number;
  winnerEnergyGain: number;
  loserEnergyLoss: number;
  drawEnergyGain: number;
}

export interface BattleSettings {
  heroStartHp: number;
  heroMaxHp: number;
  heroStartEnergy: number;
  heroMaxEnergy: number;
  villainStartHp: number;
  villainMaxHp: number;
  villainStartEnergy: number;
  villainMaxEnergy: number;
  resolution: BattleResolutionRules;
}

export interface BattleCombatantState {
  currentHp: number;
  maxHp: number;
  currentEnergy: number;
  maxEnergy: number;
}

export interface BattleState {
  hero: BattleCombatantState;
  villain: BattleCombatantState;
  outcome: BattleOutcome;
}

export interface MiniGameResult {
  miniGameId: MiniGameId;
  winner: MiniGameWinner;
  heroScore: number;
  villainScore: number;
  scoreDifference: number;
}

export interface BattleResolutionSummary {
  damageToHero: number;
  damageToVillain: number;
  blockedDamageToHero: number;
  blockedDamageToVillain: number;
  heroEnergyDelta: number;
  villainEnergyDelta: number;
  winner: MiniGameWinner;
}

export interface SideCharges {
  hero: number;
  villain: number;
}

export interface BattleEffectsState {
  shieldCharges: SideCharges;
  peekCharges: SideCharges;
  powerBoostCharges: SideCharges;
  retryCharges: SideCharges;
}

export interface IntermissionState {
  sourceMiniGameId: MiniGameId | null;
  lastResult: MiniGameResult | null;
  resolution: BattleResolutionSummary | null;
}

export interface CutsceneData {
  id: string;
  name: string;
  mediaSource: string;
  mediaType: CutsceneMediaType;
  description?: string;
  tags: string[];
}

export interface RewardData {
  id: string;
  name: string;
  description: string;
  value: number;
  icon?: string;
  category?: string;
  applicableGames?: MiniGameId[];
  effectType?: string;
  effectValue?: number;
}

export interface PowerUpData {
  id: string;
  name: string;
  description: string;
  charges: number;
  energyCost?: number;
  icon?: string;
  category?: string;
  applicableGames?: MiniGameId[];
  effectType?: PowerUpEffectType | string;
  effectValue?: number;
}

export interface PointerHighlightConfig {
  enabledByDefault: boolean;
  shortcut: string;
  paletteShortcut: string;
  clickOnly: boolean;
  defaultPalette: "kids" | "villain";
  kidsColors: string[];
  villainColors: string[];
  ringSize: number;
  trailSize: number;
  trailLength: number;
  fadeMs: number;
  spawnMs: number;
}

export interface EncounterConfig {
  id: string;
  name: string;
  hero: FighterData;
  villain: FighterData;
  introSetup: IntroSetupConfig;
  background: string;
  gameBackgrounds?: Partial<Record<MiniGameId, string>>;
  selectedCardIds: string[];
  enabledMiniGames: MiniGameId[];
  gameOrder: MiniGameId[];
  roundSettings: RoundSettings;
  rewards: RewardData[];
  powerUps: PowerUpData[];
  battleSettings: BattleSettings;
  cutscenes: CutsceneData[];
  actionItems: ActionItem[];
  /** How many of each medallion tile kind to place on the Board Dash track (0 = disabled). */
  boardDashMedallionCounts: Record<BoardDashMedallionKind, number>;
  /** Max number of the ticked cards placed on the board per game (picked at random if fewer than ticked). */
  boardDashCardLimit: number;
  /** Card ids used on Board Dash card tiles (independent of other mini-games). */
  boardDashCardIds: string[];
  pointerHighlight: PointerHighlightConfig;
}

export type BattlePhase = "setup" | "inProgress" | "roundComplete" | "intermission" | "battleComplete";

export interface BattleProgress {
  phase: BattlePhase;
  currentRound: number;
  completedMiniGames: MiniGameId[];
}

export interface ScoreState {
  hero: number;
  villain: number;
}

export type UIMode = "play" | "edit";

export type OverlayState =
  | "none"
  | "roundResult"
  | "battleResult"
  | "saveConfirmation";

export interface BattleFlowState {
  uiMode: UIMode;
  selectedMiniGame: MiniGameId | null;
  overlayState: OverlayState;
}

export interface PlayAreaViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export function isMiniGameId(value: string): value is MiniGameId {
  return MINI_GAME_IDS.includes(value as MiniGameId);
}
