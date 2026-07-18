import { useEffect, useSyncExternalStore } from "react";
import { audioController } from "./AudioController";

export function useAudioController() {
  const snapshot = useSyncExternalStore(
    audioController.subscribe,
    audioController.getSnapshot,
    audioController.getSnapshot,
  );

  useEffect(() => {
    void audioController.initializeFromAppSettings(window.appApi);
  }, []);

  return { snapshot, controller: audioController };
}
