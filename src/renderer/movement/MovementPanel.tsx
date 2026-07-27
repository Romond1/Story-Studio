import type { MovementConfig, MovementEventConfig } from "../../shared/types";
import {
  BUILT_IN_MOVEMENT_GIFS,
  DEFAULT_MOVEMENT_EVENTS,
  createMovementEvent,
  duplicateMovementEvent,
  normalizeMovementConfig,
} from "../../shared/movement";
import "./movement.css";

interface MovementPanelProps {
  config: MovementConfig;
  isEditMode: boolean;
  onChange: (config: MovementConfig) => void;
  onTrigger: (event: MovementEventConfig) => void;
  onRandomTrigger: () => void;
  onImportGif: (eventId: string) => Promise<void>;
  onImportJingle: () => Promise<void>;
  getMediaUrl: (relativePath: string) => string;
}

function shortcutLabel(shortcut: string) {
  if (!shortcut) return "None";
  if (shortcut.startsWith("Numpad")) return `NP ${shortcut.slice("Numpad".length)}`;
  if (shortcut.startsWith("Digit")) return shortcut.slice("Digit".length);
  if (shortcut.startsWith("Key")) return shortcut.slice("Key".length);
  return shortcut;
}

function createMovementId(existingIds: Set<string>): string {
  const makeCandidate = () => {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return `custom-movement-${globalThis.crypto.randomUUID()}`;
    }
    return `custom-movement-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  };
  let candidate = makeCandidate();
  while (existingIds.has(candidate)) {
    candidate = makeCandidate();
  }
  return candidate;
}

export function MovementPanel({
  config,
  isEditMode,
  onChange,
  onTrigger,
  onRandomTrigger,
  onImportGif,
  onImportJingle,
  getMediaUrl,
}: MovementPanelProps) {
  const normalized = normalizeMovementConfig(config);
  const defaultEventIds = new Set(DEFAULT_MOVEMENT_EVENTS.map((event) => event.id));
  const existingEventIds = new Set(normalized.events.map((event) => event.id));

  const patchEvent = (eventId: string, updates: Partial<MovementEventConfig>) => {
    onChange({
      ...normalized,
      events: normalized.events.map((event) => event.id === eventId ? { ...event, ...updates } : event),
    });
  };

  const addEvent = () => {
    onChange({
      ...normalized,
      events: [
        ...normalized.events,
        createMovementEvent(normalized.events.length + 1, createMovementId(existingEventIds)),
      ],
    });
  };

  const duplicateEvent = (source: MovementEventConfig) => {
    onChange({
      ...normalized,
      events: [
        ...normalized.events,
        duplicateMovementEvent(source, normalized.events.length + 1, () => createMovementId(existingEventIds)),
      ],
    });
  };

  const removeEvent = (eventId: string) => {
    const nextDeletedEventIds = defaultEventIds.has(eventId)
      ? [...(normalized.deletedEventIds || []), eventId]
      : (normalized.deletedEventIds || []);
    onChange({
      ...normalized,
      deletedEventIds: Array.from(new Set(nextDeletedEventIds)),
      events: normalized.events.filter((event) => event.id !== eventId),
    });
  };

  return (
    <div className="movement-panel">
      <div className="movement-panel-header">
        <h3>Movement</h3>
        <div className="movement-header-actions">
          {isEditMode && (
            <button className="movement-random-btn" onClick={addEvent}>
              + Add
            </button>
          )}
          <button
            className="movement-random-btn"
            disabled={!normalized.randomEnabled || !normalized.events.some((event) => event.enabled)}
            onClick={onRandomTrigger}
          >
            Random
          </button>
        </div>
      </div>

      <label className="movement-toggle-row">
        <input
          type="checkbox"
          checked={normalized.randomEnabled}
          disabled={!isEditMode}
          onChange={(event) => onChange({ ...normalized, randomEnabled: event.target.checked })}
        />
        Random shortcut
      </label>
      {isEditMode && (
        <div className="movement-compact-grid">
          <label>
            Random Key
            <input
              value={shortcutLabel(normalized.randomShortcut || "Numpad0")}
              readOnly
              onKeyDown={(keyEvent) => {
                keyEvent.preventDefault();
                onChange({ ...normalized, randomShortcut: keyEvent.code });
              }}
              title="Focus this field and press a key to assign random movement."
            />
          </label>
          <label>
            Jingle
            <select
              value={normalized.jingleEnabled ? "on" : "off"}
              onChange={(event) => onChange({ ...normalized, jingleEnabled: event.target.value === "on" })}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label>
            Jingle Vol
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={normalized.jingleVolume ?? 0.35}
              onChange={(event) => onChange({ ...normalized, jingleVolume: Number(event.target.value) })}
            />
          </label>
          <div className="movement-jingle-row">
            <span title={normalized.jingleRelativePath || "Built-in chime"}>
              {normalized.jingleRelativePath ? normalized.jingleRelativePath.split(/[\\/]/).pop() : "Built-in chime"}
            </span>
            <button type="button" className="movement-trigger-btn" onClick={onImportJingle}>
              Upload Jingle
            </button>
            {normalized.jingleRelativePath && (
              <button
                type="button"
                className="movement-remove-btn"
                onClick={() => onChange({ ...normalized, jingleRelativePath: null })}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="movement-event-list">
        {normalized.events.map((event) => (
          <div key={event.id} className={`movement-event-card ${event.enabled ? "" : "is-disabled"}`}>
            <div className="movement-event-title-row">
              <label className="movement-toggle-row">
                <input
                  type="checkbox"
                  checked={event.enabled}
                  onChange={(changeEvent) => patchEvent(event.id, { enabled: changeEvent.target.checked })}
                />
                <span>{event.name}</span>
              </label>
              <div className="movement-card-actions">
                <button
                  className="movement-trigger-btn"
                  disabled={!event.enabled}
                  onClick={() => onTrigger(event)}
                >
                  Trigger
                </button>
                {isEditMode && (
                  <>
                    <button
                      className="movement-trigger-btn"
                      onClick={() => duplicateEvent(event)}
                      title="Duplicate movement"
                    >
                      Duplicate
                    </button>
                    <button
                      className="movement-remove-btn"
                      onClick={() => removeEvent(event.id)}
                      title="Remove movement"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {isEditMode ? (
              <div className="movement-edit-grid">
                <details className="movement-details" open>
                  <summary>Basics</summary>
                  <label>
                    Name
                    <input
                      value={event.name}
                      onChange={(changeEvent) => patchEvent(event.id, { name: changeEvent.target.value })}
                    />
                  </label>
                  <label>
                    Instruction
                    <input
                      value={event.instruction}
                      onChange={(changeEvent) => patchEvent(event.id, { instruction: changeEvent.target.value })}
                    />
                  </label>
                  <label>
                    Duration
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={event.durationSeconds}
                      onChange={(changeEvent) => patchEvent(event.id, { durationSeconds: Math.max(1, Number(changeEvent.target.value) || 1) })}
                    />
                  </label>
                  <label>
                    Shortcut
                    <input
                      value={shortcutLabel(event.shortcut)}
                      readOnly
                      onKeyDown={(keyEvent) => {
                        keyEvent.preventDefault();
                        patchEvent(event.id, { shortcut: keyEvent.code });
                      }}
                      title="Focus this field and press a key to assign it."
                    />
                  </label>
                </details>

                <details className="movement-details">
                  <summary>GIF / Animation</summary>
                  <div className="movement-gif-picker">
                    <div className="movement-gif-preview">
                      {event.gifRelativePath ? (
                        <img src={getMediaUrl(event.gifRelativePath)} alt="" />
                      ) : (
                        <span>No GIF</span>
                      )}
                    </div>
                    <div className="movement-gif-actions">
                      <select
                        value={event.gifRelativePath || ""}
                        onChange={(changeEvent) => patchEvent(event.id, { gifRelativePath: changeEvent.target.value || null })}
                      >
                        <option value="">No GIF</option>
                        {BUILT_IN_MOVEMENT_GIFS.map((gif) => (
                          <option key={gif.relativePath} value={gif.relativePath}>
                            {gif.label}
                          </option>
                        ))}
                        {!!event.gifRelativePath && !BUILT_IN_MOVEMENT_GIFS.some((gif) => gif.relativePath === event.gifRelativePath) && (
                          <option value={event.gifRelativePath}>Custom GIF</option>
                        )}
                      </select>
                      <button type="button" className="movement-trigger-btn" onClick={() => onImportGif(event.id)}>
                        Upload GIF
                      </button>
                    </div>
                  </div>
                  <label>
                    Animation
                    <select
                      value={event.animation}
                      onChange={(changeEvent) => patchEvent(event.id, { animation: changeEvent.target.value as MovementEventConfig["animation"] })}
                    >
                      <option value="color-burst">Color Burst</option>
                      <option value="runner">Runner</option>
                      <option value="hero-flash">Hero Flash</option>
                      <option value="head-bounce">Head Bounce</option>
                      <option value="nose-bounce">Nose Bounce</option>
                    </select>
                  </label>
                </details>

                <details className="movement-details">
                  <summary>Overlay / Colors</summary>
                  <label>
                    Overlay Opacity ({Math.round((event.overlayOpacity ?? 0.72) * 100)}%)
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={event.overlayOpacity ?? 0.72}
                      onChange={(changeEvent) => patchEvent(event.id, { overlayOpacity: Number(changeEvent.target.value) })}
                    />
                  </label>
                  <label>
                    Wheel Speed ({event.ringSpeedSeconds ?? 1.5}s)
                    <input
                      type="range"
                      min={0.25}
                      max={5}
                      step={0.05}
                      value={event.ringSpeedSeconds ?? 1.5}
                      onChange={(changeEvent) => patchEvent(event.id, { ringSpeedSeconds: Number(changeEvent.target.value) })}
                    />
                  </label>
                  <label>
                    Intensity ({event.intensity ?? 1}x)
                    <input
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.1}
                      value={event.intensity ?? 1}
                      onChange={(changeEvent) => patchEvent(event.id, { intensity: Number(changeEvent.target.value) })}
                    />
                  </label>
                  <label>
                    GIF Scale ({event.gifScale ?? 1}x)
                    <input
                      type="range"
                      min={0.4}
                      max={2}
                      step={0.05}
                      value={event.gifScale ?? 1}
                      onChange={(changeEvent) => patchEvent(event.id, { gifScale: Number(changeEvent.target.value) })}
                    />
                  </label>
                  <div className="movement-color-row">
                    <label>
                      Color 1
                      <input
                        type="color"
                        value={event.primaryColor || "#ff4094"}
                        onChange={(changeEvent) => patchEvent(event.id, { primaryColor: changeEvent.target.value })}
                      />
                    </label>
                    <label>
                      Color 2
                      <input
                        type="color"
                        value={event.secondaryColor || "#44dcff"}
                        onChange={(changeEvent) => patchEvent(event.id, { secondaryColor: changeEvent.target.value })}
                      />
                    </label>
                    <label>
                      Color 3
                      <input
                        type="color"
                        value={event.accentColor || "#ffea5c"}
                      onChange={(changeEvent) => patchEvent(event.id, { accentColor: changeEvent.target.value })}
                    />
                  </label>
                </div>
                </details>
              </div>
            ) : (
              <div className="movement-teach-summary">
                <span>{event.instruction}</span>
                <span>{shortcutLabel(event.shortcut)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
