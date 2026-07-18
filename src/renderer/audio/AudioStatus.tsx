import { useSyncExternalStore } from "react";
import {
  audioController,
  type AudioSnapshot,
} from "./AudioController";

const STATE_LABELS: Record<AudioSnapshot["engineState"], string> = {
  stopped: "Stopped",
  starting: "Starting",
  active: "Active",
  muted: "Muted",
  warning: "Warning",
  error: "Error",
  reconnecting: "Reconnecting",
};

export function AudioStatus({
  compact = false,
  snapshot: suppliedSnapshot,
}: {
  compact?: boolean;
  snapshot?: AudioSnapshot;
}) {
  const liveSnapshot = useSyncExternalStore(
    audioController.subscribe,
    audioController.getSnapshot,
    audioController.getSnapshot,
  );
  const snapshot = suppliedSnapshot ?? liveSnapshot;
  const warningCount = snapshot.warnings.length;
  const label = STATE_LABELS[snapshot.engineState];

  return (
    <span
      className={`audio-status audio-status--${snapshot.engineState} ${compact ? "audio-status--compact" : ""}`}
      title={warningCount ? `${label}: ${snapshot.warnings[0].label}` : `Audio engine ${label.toLowerCase()}`}
    >
      <span className="audio-status__dot" aria-hidden="true" />
      {!compact && <span>{label}</span>}
      {warningCount > 0 && <span className="audio-status__badge">{warningCount}</span>}
    </span>
  );
}
