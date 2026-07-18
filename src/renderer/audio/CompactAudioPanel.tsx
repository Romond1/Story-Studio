import type { AudioBusName, AudioStageControl } from "../../shared/audioSettings";
import { AudioMeter } from "./AudioMeter";
import { AudioStatus } from "./AudioStatus";
import { useAudioController } from "./useAudioController";

const VOLUME_CONTROLS: Partial<Record<AudioStageControl, AudioBusName>> = {
  "microphone-volume": "microphone",
  "media-volume": "media",
  "master-volume": "master",
  "monitor-volume": "monitor",
  "mix-volume": "mix",
};

const MUTE_CONTROLS: Partial<Record<AudioStageControl, AudioBusName>> = {
  "microphone-mute": "microphone",
  "media-mute": "media",
  "master-mute": "master",
  "monitor-mute": "monitor",
  "mix-mute": "mix",
};

const METER_CONTROLS: Partial<Record<AudioStageControl, AudioBusName>> = {
  "microphone-meter": "microphone",
  "media-meter": "media",
  "master-meter": "master",
  "monitor-meter": "monitor",
  "mix-meter": "mix",
};

const BUS_LABELS: Record<AudioBusName, string> = {
  microphone: "Microphone",
  media: "Media",
  master: "Master",
  monitor: "Monitor",
  mix: "Mix Output",
};

export function CompactAudioPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { snapshot, controller } = useAudioController();

  const renderControl = (control: AudioStageControl) => {
    const volumeBus = VOLUME_CONTROLS[control];
    if (volumeBus) {
      return (
        <label key={control} className="compact-audio-control compact-audio-control--slider">
          <span>{BUS_LABELS[volumeBus]}</span>
          <input
            aria-label={`${BUS_LABELS[volumeBus]} volume`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={snapshot.settings.volumes[volumeBus]}
            onChange={(event) => controller.setBusVolume(volumeBus, Number(event.target.value))}
          />
          <output>{Math.round(snapshot.settings.volumes[volumeBus] * 100)}%</output>
        </label>
      );
    }

    const muteBus = MUTE_CONTROLS[control];
    if (muteBus) {
      const muted = snapshot.settings.muted[muteBus];
      return (
        <button
          key={control}
          type="button"
          className={`compact-audio-control compact-audio-control--button ${muted ? "is-muted" : ""}`}
          aria-pressed={muted}
          onClick={() => controller.setBusMuted(muteBus, !muted)}
        >
          <span>{BUS_LABELS[muteBus]}</span>
          <strong>{muted ? "Muted" : "Live"}</strong>
        </button>
      );
    }

    const meterBus = METER_CONTROLS[control];
    if (meterBus) {
      return (
        <AudioMeter
          key={control}
          compact
          label={BUS_LABELS[meterBus]}
          reading={snapshot.meters[meterBus]}
        />
      );
    }

    if (control === "stop-all") {
      return <button key={control} type="button" className="audio-danger-button" onClick={() => controller.stopAll()}>Stop All Audio</button>;
    }
    if (control === "test-microphone") {
      return <button key={control} type="button" onClick={() => controller.testMicrophone()}>Test Microphone</button>;
    }
    if (control === "reconnect-devices") {
      return <button key={control} type="button" onClick={() => void controller.reconnectMissingDevices()}>Reconnect Devices</button>;
    }
    return null;
  };

  return (
    <div className="audio-block compact-audio-panel">
      <div className="compact-audio-panel__header">
        <h4>Audio</h4>
        <AudioStatus compact snapshot={snapshot} />
      </div>
      <div className="compact-audio-panel__controls">
        {snapshot.settings.stageControls.map(renderControl)}
      </div>
      {snapshot.warnings.length > 0 && (
        <button type="button" className="compact-audio-panel__warning" onClick={onOpenSettings}>
          {snapshot.warnings[0].label}
        </button>
      )}
      <button type="button" className="compact-audio-panel__open" onClick={onOpenSettings}>
        Open Audio Settings
      </button>
    </div>
  );
}
