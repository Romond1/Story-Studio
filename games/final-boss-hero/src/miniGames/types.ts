import type { ComponentType, ReactNode } from "react";
import type {
  BattleSide,
  BattleProgress,
  BattleState,
  EncounterConfig,
  MiniGameId,
  MiniGameResult,
  ScoreState,
} from "../types/game";

export interface MiniGameRuntimeProps {
  encounter: EncounterConfig;
  progress: BattleProgress;
  scores: ScoreState;
  battleState: BattleState;
  onComplete: (result: MiniGameResult) => void;
  setHeaderAction: (action: ReactNode | null) => void;
  setScoreOverlay: (overlay: ReactNode | null) => void;
  setTransitionCue: (cue: MiniGameTransitionCue | null) => void;
}

export interface MiniGameTransitionCue {
  text: string;
  type: "turn" | "round" | "start";
  side?: BattleSide;
}

export interface MiniGamePlugin {
  id: MiniGameId;
  title: string;
  description: string;
  Component: ComponentType<MiniGameRuntimeProps>;
}
