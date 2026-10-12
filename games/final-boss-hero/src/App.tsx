import { useEffect } from "react";
import { BattleShell } from "./components/BattleShell";
import { EditModeShell } from "./components/EditModeShell";
import { VFXProvider } from "./components/VFXLayer";
import { useBattleStore } from "./store/battleStore";

export function App() {
  const uiMode = useBattleStore((state) => state.uiMode);

  useEffect(() => {
    const appWindow = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
      __battleStore?: typeof useBattleStore;
    };

    appWindow.render_game_to_text = () => {
      const state = useBattleStore.getState();
      return JSON.stringify({
        mode: state.uiMode,
        selectedMiniGame: state.selectedMiniGame,
        battlePhase: state.battleProgress.phase,
        currentRound: state.battleProgress.currentRound,
        scores: state.scores,
        battleState: state.battleState,
        battleEffects: state.battleEffects,
        intermission: state.intermissionState,
      });
    };
    appWindow.advanceTime = () => undefined;
    appWindow.__battleStore = useBattleStore;

    return () => {
      delete appWindow.render_game_to_text;
      delete appWindow.advanceTime;
      delete appWindow.__battleStore;
    };
  }, []);

  return (
    <VFXProvider>
      {uiMode === "edit" ? <EditModeShell /> : <BattleShell />}
    </VFXProvider>
  );
}
