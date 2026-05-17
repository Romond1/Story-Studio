import { type ReactNode, useState } from "react";
import type {
  AssetItem,
  RelicAnimationStyle,
  RelicSystem,
  RelicWidgetEntranceAnimation,
  RelicWidgetPosition,
  StudentRosterEntry,
} from "../../shared/types";
import {
  getActiveRelicStudentIds,
  getRelicStageLabel,
  getRelicTeacherProgressSummary,
} from "../../shared/relics";

interface RelicsPanelProps {
  relicSystem: RelicSystem;
  roster: StudentRosterEntry[];
  assets: AssetItem[];
  toMediaUrl: (relativePath: string) => string;
  onRelicChange: (updates: Partial<RelicSystem>) => void;
  onStudentProgressChange: (studentId: string, updates: { active?: boolean; progress?: number; notes?: string }) => void;
  onAddStudent: (name: string) => boolean | Promise<boolean>;
  onRenameStudent: (studentId: string, name: string) => boolean | Promise<boolean>;
  onArchiveStudent: (studentId: string) => void;
  onImportImage: (slot: "main" | "stage1" | "stage2" | "stage3") => void;
  onProgressAction: (action: "increase" | "decrease" | "reset" | "complete") => void;
  onShowRewardCard: () => void;
}

const positions: Array<{ value: RelicWidgetPosition; label: string }> = [
  { value: "topLeft", label: "Top Left" },
  { value: "topRight", label: "Top Right" },
  { value: "bottomLeft", label: "Bottom Left" },
  { value: "bottomRight", label: "Bottom Right" },
  { value: "centerBottom", label: "Center Bottom" },
];

const animationStyles: Array<{ value: RelicAnimationStyle; label: string }> = [
  { value: "none", label: "None" },
  { value: "glowPulse", label: "Glow Pulse" },
  { value: "sparkle", label: "Sparkle" },
  { value: "stageUnlockBurst", label: "Stage Unlock Burst" },
  { value: "completeCeremony", label: "Complete Ceremony" },
];

const entranceAnimations: Array<{ value: RelicWidgetEntranceAnimation; label: string }> = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "pop", label: "Pop" },
  { value: "slideUp", label: "Slide Up" },
  { value: "zoom", label: "Zoom" },
];

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="relic-panel__section">
      <button className="relic-panel__section-toggle" onClick={() => setOpen((value) => !value)}>
        <span>{open ? "v" : ">"}</span>
        <strong>{title}</strong>
      </button>
      {open && <div className="relic-panel__section-body">{children}</div>}
    </section>
  );
}

function imageLabel(asset?: AssetItem): string {
  return asset?.originalName || asset?.filename || "No image";
}

function ImagePickerRow({
  label,
  assetId,
  assets,
  toMediaUrl,
  onImport,
}: {
  label: string;
  assetId: string | null;
  assets: AssetItem[];
  toMediaUrl: (relativePath: string) => string;
  onImport: () => void;
}) {
  const asset = assetId ? assets.find((item) => item.id === assetId) : undefined;
  return (
    <div className="relic-image-row">
      <div className="relic-image-row__preview">
        {asset ? <img src={toMediaUrl(asset.relativePath)} alt="" /> : <span>+</span>}
      </div>
      <div className="relic-image-row__label">
        <strong>{label}</strong>
        <span>{imageLabel(asset)}</span>
      </div>
      <button onClick={onImport}>Load</button>
    </div>
  );
}

export function RelicsPanel({
  relicSystem,
  roster,
  assets,
  toMediaUrl,
  onRelicChange,
  onStudentProgressChange,
  onAddStudent,
  onRenameStudent,
  onArchiveStudent,
  onImportImage,
  onProgressAction,
  onShowRewardCard,
}: RelicsPanelProps) {
  const [newStudentName, setNewStudentName] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [renamingStudentId, setRenamingStudentId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const activeIds = getActiveRelicStudentIds(relicSystem, roster);
  const visibleRoster = roster.filter((student) => !student.archived);

  const submitStudent = async () => {
    const name = newStudentName.trim();
    if (!name) return;
    setIsAddingStudent(true);
    try {
      const added = await onAddStudent(name);
      if (added) setNewStudentName("");
    } finally {
      setIsAddingStudent(false);
    }
  };

  const submitRename = async (studentId: string) => {
    const name = renameDraft.trim();
    if (!name) return;
    const renamed = await onRenameStudent(studentId, name);
    if (renamed) {
      setRenamingStudentId(null);
      setRenameDraft("");
    }
  };

  return (
    <div className="relic-panel">
      <h3>Relics</h3>

      <CollapsibleSection title="Student Roster / Active Students">
        <div className="relic-add-student">
          <input
            value={newStudentName}
            placeholder="Student name"
            onChange={(event) => setNewStudentName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitStudent();
              }
            }}
          />
          <button disabled={!newStudentName.trim() || isAddingStudent} onClick={submitStudent}>
            {isAddingStudent ? "Adding..." : "Add"}
          </button>
        </div>
        {visibleRoster.length === 0 ? (
          <p className="relic-panel__hint">Add a student to begin using relic progress.</p>
        ) : visibleRoster.map((student) => {
          const progress = relicSystem.studentProgress[student.id]?.progress ?? 0;
          const summary = getRelicTeacherProgressSummary(relicSystem, progress);
          return (
            <div className="relic-student-row" key={student.id}>
              <label className="relic-student-row__active">
                <input
                  type="checkbox"
                  checked={relicSystem.studentProgress[student.id]?.active ?? false}
                  onChange={(event) => onStudentProgressChange(student.id, { active: event.target.checked })}
                />
              </label>
              <div className="relic-student-row__main">
                {renamingStudentId === student.id ? (
                  <input
                    className="relic-student-row__rename"
                    value={renameDraft}
                    autoFocus
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitRename(student.id);
                      } else if (event.key === "Escape") {
                        setRenamingStudentId(null);
                        setRenameDraft("");
                      }
                    }}
                  />
                ) : (
                  <strong>{student.name}</strong>
                )}
                <span>{summary.progressLabel} - {getRelicStageLabel(progress)}{summary.nextStageIn !== null ? ` - Next in ${summary.nextStageIn}` : ""}</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={progress}
                  onChange={(event) => onStudentProgressChange(student.id, { progress: Number(event.target.value) })}
                />
              </div>
              <div className="relic-student-row__actions">
                {renamingStudentId === student.id ? (
                  <>
                    <button disabled={!renameDraft.trim()} onClick={() => submitRename(student.id)}>Save</button>
                    <button onClick={() => { setRenamingStudentId(null); setRenameDraft(""); }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => { setRenamingStudentId(student.id); setRenameDraft(student.name); }}>Rename</button>
                )}
                <button onClick={() => onArchiveStudent(student.id)}>Remove</button>
              </div>
            </div>
          );
        })}
      </CollapsibleSection>

      <CollapsibleSection title="Active Session Controls">
        {activeIds.length === 0 && <p className="relic-panel__warning">No active student selected.</p>}
        <div className="relic-button-grid">
          <button disabled={activeIds.length === 0} onClick={() => onProgressAction("increase")}>+1</button>
          <button disabled={activeIds.length === 0} onClick={() => onProgressAction("decrease")}>-1</button>
          <button disabled={activeIds.length === 0} onClick={() => onProgressAction("reset")}>Reset</button>
          <button disabled={activeIds.length === 0} onClick={() => onProgressAction("complete")}>Complete Relic</button>
        </div>
        <label>
          Show/hide hotkey
          <input value={relicSystem.hotkeys.toggleWidget} onChange={(event) => onRelicChange({ hotkeys: { ...relicSystem.hotkeys, toggleWidget: event.target.value } })} />
        </label>
        <label>
          +1 hotkey
          <input value={relicSystem.hotkeys.increaseProgress} onChange={(event) => onRelicChange({ hotkeys: { ...relicSystem.hotkeys, increaseProgress: event.target.value } })} />
        </label>
        <label>
          -1 hotkey
          <input value={relicSystem.hotkeys.decreaseProgress} onChange={(event) => onRelicChange({ hotkeys: { ...relicSystem.hotkeys, decreaseProgress: event.target.value } })} />
        </label>
        <p className="relic-panel__hint">Examples: Ctrl+Alt+W, Ctrl+Alt+ArrowUp, Ctrl+Alt+-</p>
      </CollapsibleSection>

      <CollapsibleSection title="Reward Card / Completion Controls">
        <div className="relic-button-grid">
          <button disabled={activeIds.length === 0} onClick={onShowRewardCard}>Show Reward Card</button>
          <button disabled={activeIds.length === 0} onClick={() => onProgressAction("complete")}>Complete Relic</button>
        </div>
        <p className="relic-panel__hint">Reward card hotkey: Ctrl+Alt+K</p>
      </CollapsibleSection>

      <CollapsibleSection title="Main Stage Widget Settings">
        <label className="relic-inline-check">
          <input
            type="checkbox"
            checked={relicSystem.showOnStage}
            onChange={(event) => onRelicChange({ showOnStage: event.target.checked })}
          />
          Show relic widget on main stage
        </label>
        <label>
          Position
          <select value={relicSystem.widgetPosition} onChange={(event) => onRelicChange({ widgetPosition: event.target.value as RelicWidgetPosition })}>
            {positions.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}
          </select>
        </label>
        <div className="relic-three-cols">
          <label>X <input type="number" value={relicSystem.widgetOffset.x} onChange={(event) => onRelicChange({ widgetOffset: { ...relicSystem.widgetOffset, x: Number(event.target.value) } })} /></label>
          <label>Y <input type="number" value={relicSystem.widgetOffset.y} onChange={(event) => onRelicChange({ widgetOffset: { ...relicSystem.widgetOffset, y: Number(event.target.value) } })} /></label>
          <label>Scale <input type="number" min={0.5} max={3} step={0.1} value={relicSystem.widgetScale} onChange={(event) => onRelicChange({ widgetScale: Number(event.target.value) })} /></label>
        </div>
        <label>
          Opacity: {Math.round(relicSystem.widgetOpacity * 100)}%
          <input type="range" min={0.25} max={1} step={0.05} value={relicSystem.widgetOpacity} onChange={(event) => onRelicChange({ widgetOpacity: Number(event.target.value) })} />
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Animation Settings">
        <label>
          Widget Pop-in Animation
          <select value={relicSystem.widgetEntranceAnimation} onChange={(event) => onRelicChange({ widgetEntranceAnimation: event.target.value as RelicWidgetEntranceAnimation })}>
            {entranceAnimations.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
          </select>
        </label>
        <label>
          Animation Style
          <select value={relicSystem.animationStyle} onChange={(event) => onRelicChange({ animationStyle: event.target.value as RelicAnimationStyle })}>
            {animationStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
          </select>
        </label>
        <label>Duration: {relicSystem.animationDurationMs}ms <input type="range" min={500} max={5000} step={100} value={relicSystem.animationDurationMs} onChange={(event) => onRelicChange({ animationDurationMs: Number(event.target.value) })} /></label>
        <label>Intensity: {relicSystem.animationIntensity.toFixed(1)} <input type="range" min={0.5} max={3} step={0.1} value={relicSystem.animationIntensity} onChange={(event) => onRelicChange({ animationIntensity: Number(event.target.value) })} /></label>
        <label className="relic-inline-check"><input type="checkbox" checked={relicSystem.rgbFlowEnabled} onChange={(event) => onRelicChange({ rgbFlowEnabled: event.target.checked })} /> RGB flowing widget colors</label>
        <label className="relic-inline-check"><input type="checkbox" checked={relicSystem.animateOnProgress} onChange={(event) => onRelicChange({ animateOnProgress: event.target.checked })} /> Animate when progress increases</label>
        <label className="relic-inline-check"><input type="checkbox" checked={relicSystem.animateOnStageChange} onChange={(event) => onRelicChange({ animateOnStageChange: event.target.checked })} /> Animate when stage changes</label>
        <label className="relic-inline-check"><input type="checkbox" checked={relicSystem.animateOnComplete} onChange={(event) => onRelicChange({ animateOnComplete: event.target.checked })} /> Animate when relic completes</label>
      </CollapsibleSection>

      <CollapsibleSection title="Relic Configuration" defaultOpen={false}>
        <label>Relic Title <input value={relicSystem.relicTitle} placeholder="Echo Stone" onChange={(event) => onRelicChange({ relicTitle: event.target.value })} /></label>
        <label>Relic Description <textarea value={relicSystem.relicDescription} placeholder="Restore the Echo Stone by winning stars and completing the boss challenge." onChange={(event) => onRelicChange({ relicDescription: event.target.value })} /></label>
        <label>Stage 1 Title <input value={relicSystem.stageTitles.stage1} onChange={(event) => onRelicChange({ stageTitles: { ...relicSystem.stageTitles, stage1: event.target.value } })} /></label>
        <label>Stage 2 Title <input value={relicSystem.stageTitles.stage2} onChange={(event) => onRelicChange({ stageTitles: { ...relicSystem.stageTitles, stage2: event.target.value } })} /></label>
        <label>Stage 3 Title <input value={relicSystem.stageTitles.stage3} onChange={(event) => onRelicChange({ stageTitles: { ...relicSystem.stageTitles, stage3: event.target.value } })} /></label>
        <ImagePickerRow label="Main Image" assetId={relicSystem.mainImageAssetId} assets={assets} toMediaUrl={toMediaUrl} onImport={() => onImportImage("main")} />
        <ImagePickerRow label="Stage 1 Image" assetId={relicSystem.stageImageAssetIds.stage1} assets={assets} toMediaUrl={toMediaUrl} onImport={() => onImportImage("stage1")} />
        <ImagePickerRow label="Stage 2 Image" assetId={relicSystem.stageImageAssetIds.stage2} assets={assets} toMediaUrl={toMediaUrl} onImport={() => onImportImage("stage2")} />
        <ImagePickerRow label="Stage 3 Image" assetId={relicSystem.stageImageAssetIds.stage3} assets={assets} toMediaUrl={toMediaUrl} onImport={() => onImportImage("stage3")} />
      </CollapsibleSection>
    </div>
  );
}
