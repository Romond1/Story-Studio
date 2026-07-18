import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  buildAudioDeviceMenuOptions,
  getAudioDeviceSelectionLabel,
  selectAudioDeviceMenuOption,
} from "../../shared/audioDeviceMenu";
import {
  AUDIO_STAGE_CONTROLS,
  type AudioBusName,
  type AudioStageControl,
  type SavedAudioDevice,
} from "../../shared/audioSettings";
import { AudioMeter } from "./AudioMeter";
import { AudioStatus } from "./AudioStatus";
import {
  type AudioController,
  type AudioDeviceState,
  type AudioSnapshot,
} from "./AudioController";
import { useAudioController } from "./useAudioController";

const STAGE_CONTROL_LABELS: Record<AudioStageControl, string> = {
  "microphone-volume": "Microphone volume",
  "microphone-mute": "Microphone mute",
  "media-volume": "Media/story volume",
  "media-mute": "Media/story mute",
  "master-volume": "Master volume",
  "master-mute": "Master mute",
  "monitor-volume": "Monitor volume",
  "monitor-mute": "Monitor mute",
  "mix-volume": "Mix-output volume",
  "mix-mute": "Mix-output mute",
  "microphone-meter": "Microphone meter",
  "media-meter": "Media/story meter",
  "master-meter": "Master meter",
  "monitor-meter": "Monitor-output meter",
  "mix-meter": "Mix-output meter",
  "stop-all": "Stop All Audio",
  "test-microphone": "Test Microphone",
  "reconnect-devices": "Reconnect Missing Devices",
};

const BUS_LABELS: Record<AudioBusName, string> = {
  microphone: "Microphone",
  media: "Media / Story",
  master: "Master Mix",
  monitor: "Monitor Output",
  mix: "Mix / Virtual Output",
};

function Section({ title, description, children, className = "" }: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`audio-settings-section ${className}`}>
      <div className="audio-settings-section__heading">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DeviceSelect({
  label,
  devices,
  selected,
  onChange,
  disabled,
  active,
  flowing,
}: {
  label: string;
  devices: AudioDeviceState[];
  selected: SavedAudioDevice;
  onChange: (device: SavedAudioDevice) => Promise<void>;
  disabled?: boolean;
  active?: boolean;
  flowing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pendingDevice, setPendingDevice] = useState<SavedAudioDevice | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const menuId = useId();
  const options = buildAudioDeviceMenuOptions(devices, selected);
  const selectedOption = options.find((option) => option.deviceId === selected.deviceId) ?? options[0];
  const selectedState = devices.find((device) => device.deviceId === selected.deviceId);
  return (
    <div className="audio-device-row">
      <div
        ref={pickerRef}
        className="audio-device-picker"
        onBlur={(event) => {
          if (!pickerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <span id={labelId} className="audio-device-row__label">{label}</span>
        <button
          type="button"
          className="audio-device-picker__trigger"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          disabled={disabled || Boolean(pendingDevice)}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span>{getAudioDeviceSelectionLabel(selectedOption, pendingDevice)}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {open && (
          <div id={menuId} className="audio-device-picker__menu" role="listbox" aria-labelledby={labelId}>
            {options.map((option) => (
              <button
                key={option.deviceId}
                type="button"
                role="option"
                aria-selected={option.deviceId === selected.deviceId}
                className={option.deviceId === selected.deviceId ? "is-selected" : ""}
                onClick={() => {
                  const device = selectAudioDeviceMenuOption(options, option.deviceId);
                  setOpen(false);
                  if (!device) return;
                  setPendingDevice(device);
                  setSelectionError(null);
                  void onChange(device)
                    .catch((error: unknown) => {
                      const detail = error instanceof Error ? error.message : String(error);
                      setSelectionError(`Could not use ${device.label}: ${detail}`);
                    })
                    .finally(() => setPendingDevice(null));
                }}
              >
                <span>{option.label}</span>
                {option.deviceId === selected.deviceId && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
        {selectionError && <span className="audio-device-picker__error" role="alert">{selectionError}</span>}
      </div>
      <div className="audio-device-row__meta">
        <span className={selectedState?.connected || selected.deviceId === "default" ? "is-good" : "is-error"}>
          {selectedState?.connected || selected.deviceId === "default" ? "Connected" : "Missing"}
        </span>
        <span>{selectedState?.sampleRate ? `${selectedState.sampleRate} Hz` : "Rate unavailable"}</span>
        <span>{selectedState?.channelCount ? `${selectedState.channelCount} ch` : "Channels unavailable"}</span>
        <span>{(active ?? selectedState?.active) ? "Stream active" : "Stream inactive"}</span>
        <span>{(flowing ?? selectedState?.flowing) ? "Samples flowing" : "No samples detected"}</span>
      </div>
    </div>
  );
}

function MixerRow({ bus, snapshot, controller }: {
  bus: AudioBusName;
  snapshot: AudioSnapshot;
  controller: AudioController;
}) {
  const muted = snapshot.settings.muted[bus];
  return (
    <div className="audio-mixer-row">
      <span>{BUS_LABELS[bus]}</span>
      <input
        aria-label={`${BUS_LABELS[bus]} volume`}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={snapshot.settings.volumes[bus]}
        onChange={(event) => controller.setBusVolume(bus, Number(event.target.value))}
      />
      <output>{Math.round(snapshot.settings.volumes[bus] * 100)}%</output>
      <button
        type="button"
        className={muted ? "is-muted" : ""}
        aria-pressed={muted}
        onClick={() => controller.setBusMuted(bus, !muted)}
      >
        {muted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}

export function AudioSettingsWorkspace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot, controller } = useAudioController();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Copy Audio Diagnostics");

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const workspace = workspaceRef.current;
    workspace?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !workspace) return;
      const focusable = Array.from(workspace.querySelectorAll<HTMLElement>(
        "button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  const sameSelectedOutput = snapshot.settings.devices.monitor.deviceId === snapshot.settings.devices.mix.deviceId;
  const toggleStageControl = (control: AudioStageControl) => {
    const selected = snapshot.settings.stageControls.includes(control);
    controller.setStageControls(selected
      ? snapshot.settings.stageControls.filter((item) => item !== control)
      : [...snapshot.settings.stageControls, control]);
  };

  return (
    <div className="audio-settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={workspaceRef}
        className="audio-settings-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-settings-title"
        tabIndex={-1}
      >
        <header className="audio-settings-header">
          <div>
            <span className="audio-settings-eyebrow">Story Studio audio engine</span>
            <h2 id="audio-settings-title">Audio Settings</h2>
          </div>
          <div className="audio-settings-header__actions">
            <AudioStatus snapshot={snapshot} />
            <button type="button" onClick={onClose} aria-label="Close Audio Settings">Close</button>
          </div>
        </header>

        <div className="audio-settings-scroll">
          <Section
            title="Routing"
            description="Device changes are validated before the current route is retired."
          >
            <div className="audio-routing-list">
              <DeviceSelect
                label="Microphone Input"
                devices={snapshot.devices.inputs}
                selected={snapshot.settings.devices.microphone}
                active={snapshot.diagnostics.activeMicrophoneStreams === 1}
                flowing={snapshot.meters.microphone.flowing}
                onChange={(device) => controller.enableMic(device.deviceId === "default" ? undefined : device.deviceId)}
              />
              <DeviceSelect
                label="Monitor Output"
                devices={snapshot.devices.outputs}
                selected={snapshot.settings.devices.monitor}
                active={snapshot.diagnostics.activeMonitorStreams === 1}
                flowing={snapshot.meters.monitor.flowing}
                onChange={(device) => controller.selectOutput("monitor", device)}
              />
              <DeviceSelect
                label="Mix / Virtual Output"
                devices={snapshot.devices.outputs}
                selected={snapshot.settings.devices.mix}
                active={snapshot.diagnostics.activeMixStreams === 1}
                flowing={snapshot.meters.mix.flowing}
                onChange={(device) => controller.selectOutput("mix", device)}
              />
            </div>
            {sameSelectedOutput && (
              <p className="audio-inline-warning">
                Monitor and Mix are set to the same device. Story Studio keeps only the most recently selected route active to prevent doubled audio.
              </p>
            )}
          </Section>

          <div className="audio-settings-grid">
            <Section title="Mixer" description="Microphone and lesson audio enter the Zoom mix once.">
              <div className="audio-mixer-list">
                {(["microphone", "media", "master", "monitor", "mix"] as AudioBusName[]).map((bus) => (
                  <MixerRow key={bus} bus={bus} snapshot={snapshot} controller={controller} />
                ))}
              </div>
              <div className="audio-toggle-list">
                <label>
                  <input
                    type="checkbox"
                    checked={snapshot.settings.monitoringEnabled}
                    onChange={(event) => controller.setMonitoringEnabled(event.target.checked)}
                  />
                  Headphone monitoring enabled
                </label>
                <label className={snapshot.settings.microphoneMonitorEnabled ? "audio-feedback-toggle is-warning" : "audio-feedback-toggle"}>
                  <input
                    type="checkbox"
                    checked={snapshot.settings.microphoneMonitorEnabled}
                    onChange={(event) => controller.setMicrophoneMonitorEnabled(event.target.checked)}
                  />
                  Monitor my microphone (testing only)
                </label>
                {snapshot.settings.microphoneMonitorEnabled && (
                  <p className="audio-inline-warning">You may hear delayed self-echo or create feedback. Turn this off for lessons.</p>
                )}
              </div>
            </Section>

            <Section title="Live meters" description="Follow the signal from source to physical output.">
              <div className="audio-meter-list">
                <AudioMeter label="Microphone Input" reading={snapshot.meters.microphone} />
                <AudioMeter label="Story / Media Audio" reading={snapshot.meters.media} />
                <AudioMeter label="Master Mix" reading={snapshot.meters.master} />
                <AudioMeter label="Monitor Output" reading={snapshot.meters.monitor} />
                <AudioMeter label="Mix / Virtual Output" reading={snapshot.meters.mix} />
              </div>
            </Section>
          </div>

          {snapshot.warnings.length > 0 && (
            <Section title="Warnings" className="audio-warnings-section">
              <div className="audio-warning-list">
                {snapshot.warnings.map((warning) => (
                  <div key={warning.id} className={`audio-warning audio-warning--${warning.severity}`}>
                    <strong>{warning.label}</strong>
                    <span>{warning.detail}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Testing and recovery" description="Test one route at a time before opening Zoom.">
            <div className="audio-action-row">
              <button type="button" onClick={() => controller.testMicrophone()}>Test Microphone</button>
              <button type="button" onClick={() => controller.sendTestTone("monitor")}>Test Monitor Output</button>
              <button type="button" onClick={() => controller.sendTestTone("mix")}>Test Mix Output</button>
              <button type="button" onClick={() => void controller.reconnectMissingDevices()}>Reconnect Missing Devices</button>
              <button type="button" onClick={() => void controller.restart()}>Restart Audio Engine</button>
              <button type="button" className="audio-danger-button" onClick={() => controller.stopAll()}>Stop All Audio</button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(controller.copyDiagnosticsText()).then(() => {
                    setCopyStatus("Copied");
                    window.setTimeout(() => setCopyStatus("Copy Audio Diagnostics"), 1400);
                  });
                }}
              >
                {copyStatus}
              </button>
            </div>
          </Section>

          <Section
            title="Stage Panel Controls"
            description="Choose the controls and meters available during a live lesson."
          >
            <div className="audio-stage-control-grid">
              {AUDIO_STAGE_CONTROLS.map((control) => (
                <label key={control}>
                  <input
                    type="checkbox"
                    checked={snapshot.settings.stageControls.includes(control)}
                    onChange={() => toggleStageControl(control)}
                  />
                  {STAGE_CONTROL_LABELS[control]}
                </label>
              ))}
            </div>
            <p className="audio-settings-note">Audio status and Open Audio Settings always remain visible.</p>
          </Section>

          <section className="audio-diagnostics">
            <button
              type="button"
              className="audio-diagnostics__toggle"
              aria-expanded={diagnosticsOpen}
              onClick={() => setDiagnosticsOpen((value) => !value)}
            >
              Diagnostics <span>{diagnosticsOpen ? "−" : "+"}</span>
            </button>
            {diagnosticsOpen && (
              <dl>
                <div><dt>Engine state</dt><dd>{snapshot.engineState}</dd></div>
                <div><dt>Generation</dt><dd>{snapshot.diagnostics.generation}</dd></div>
                <div><dt>Audio context sample rate</dt><dd>{snapshot.diagnostics.sampleRate ?? "Unavailable"}</dd></div>
                <div><dt>Analyser buffer size</dt><dd>{snapshot.diagnostics.bufferSize ?? "Unavailable"}</dd></div>
                <div><dt>Active streams</dt><dd>{snapshot.diagnostics.activeStreamCount}</dd></div>
                <div><dt>Microphone streams</dt><dd>{snapshot.diagnostics.activeMicrophoneStreams}</dd></div>
                <div><dt>Monitor streams</dt><dd>{snapshot.diagnostics.activeMonitorStreams}</dd></div>
                <div><dt>Mix streams</dt><dd>{snapshot.diagnostics.activeMixStreams}</dd></div>
                <div><dt>Callbacks</dt><dd>{snapshot.diagnostics.activeCallbackCount}</dd></div>
                <div><dt>Device listeners</dt><dd>{snapshot.diagnostics.activeListenerCount}</dd></div>
                <div><dt>Underruns</dt><dd>{snapshot.diagnostics.underruns}</dd></div>
                <div><dt>Overruns</dt><dd>{snapshot.diagnostics.overruns}</dd></div>
                <div><dt>Dropped buffers</dt><dd>{snapshot.diagnostics.droppedBuffers}</dd></div>
                <div><dt>Last stream error</dt><dd>{snapshot.diagnostics.lastStreamError ?? "None"}</dd></div>
                <div><dt>Last reconnect attempt</dt><dd>{snapshot.diagnostics.lastReconnectAttempt ?? "None"}</dd></div>
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
