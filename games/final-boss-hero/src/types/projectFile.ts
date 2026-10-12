import type {
  BattleEffectsState,
  BattleProgress,
  BattleState,
  CardData,
  EncounterConfig,
  IntermissionState,
  MiniGameId,
  ScoreState,
} from "./game";

export interface BossProjectMetadata {
  schema: "final-boss-hero-project";
  version: 1;
  projectName: string;
  exportedAt: string;
}

export interface BossProjectSessionState {
  selectedMiniGame: MiniGameId | null;
  selectedEpisodeHeroId: string | null;
  battleProgress: BattleProgress;
  scores: ScoreState;
  battleState: BattleState;
  battleEffects: BattleEffectsState;
  intermissionState: IntermissionState;
}

export interface BossProjectFileV1 {
  metadata: BossProjectMetadata;
  project: {
    encounter: EncounterConfig;
    cardLibrary: CardData[];
  };
  session: BossProjectSessionState;
}
