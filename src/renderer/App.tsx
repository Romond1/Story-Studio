import {
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type WheelEvent,
  Fragment,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AssetItem,
  BadgeStudentSprite,
  DrawPoint,
  MarkerStroke,
  ProjectState,
  Section,
  Slide,
  TransitionType,
  AudioClip,
  BoostPack,
  OverlayItem,
  BubbleDef,
  BubbleTemplate,
  SequenceItem,
  SlideRefItem,
  BreakRefItem,
  PromptCardItem,
  MiniGameItem,
  SparkConfig,
  SparkStudent,
  StoryReferenceItem,
  ACardRefItem,
  BCardInstance,
  ImportResult,
  ProjectData,
  BCardTeachState,
  RelicSystem,
  StudentRosterEntry,
  StudentRosterSettings,
} from "../shared/types";
import { BUBBLE_LIBRARY } from "../shared/bubbleDefs";
import {
  decorateImportedAssetsForContext,
  getAssetDescription,
  getAssetDisplayLabel,
  withCanonicalAssetDefaults,
} from "../shared/mediaReferences";
import { applyMediaImportToProjectData } from "../shared/mediaImport";
import {
  appendAssetsAndUpdateSection,
  deleteSectionInProjectData,
  duplicateBreakSectionInProjectData,
  moveSectionInProjectData,
  updateSectionInProjectData,
} from "../shared/sectionMutations";
import { resolveVideoAudioSettings } from "../shared/videoAudio";
import {
  clampVideoTimeToTrim,
  getEffectiveVideoTrim,
  normalizeVideoTrimSettings,
  shouldStopAtTrimOut,
} from "../shared/videoTrim";
import {
  normalizeImageAdjustments,
  resolveImageAdjustments,
} from "../shared/imageAdjustments";
import {
  applyRelicProgressDelta,
  clampRelicProgress,
  ensureRelicProgressForRoster,
  getActiveRelicStudentIds,
  normalizeRelicSystem,
  normalizeStudentRosterSettings,
  setRelicProgressForStudents,
} from "../shared/relics";
import ContextMenu, { MenuItem } from "./components/ContextMenu";
import { BUILD_VERSION } from "../shared/version";
import { type AppMode, DEFAULT_MODE, ensureEditMode } from "./mode";
import { audioManager } from "./audio/AudioManager";
import { AudioSettingsWorkspace } from "./audio/AudioSettingsWorkspace";
import { CompactAudioPanel } from "./audio/CompactAudioPanel";
import { AudioStatus } from "./audio/AudioStatus";
import { SparkProvider, useSparks, DEFAULT_SPARK_CONFIG, getStudentSparkTotal } from "./sparks/SparkProvider";
import { SparkOverlay } from "./sparks/SparkOverlay";
import { BadgePanel } from "./sparks/BadgePanel";
import { FinalBadgeOverlay } from "./sparks/FinalBadgeOverlay";
import { Rnd } from "react-rnd";
import { CardSystemProvider } from "./store/CardStore";
import { ACardSystem } from "./acards/ACardSystem";
import { ACardSidebar } from "./acards/ACardSidebar";
import { BoardEmptyState } from "./acards/BoardEmptyState";
import { ACardEditor } from "./acards/ACardEditor";
import { ACardStageRenderer } from "./acards/ACardStageRenderer";
import { BCardInstanceLayer, type BCardOverlayClickAction } from "./acards/BCardInstanceLayer";
import { BCardEditor } from "./acards/BCardEditor";
import { RelicsPanel } from "./relics/RelicsPanel";
import { RelicStageWidget } from "./relics/RelicStageWidget";

function formatVideoTrimTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  const m = Math.floor(Math.abs(safeSeconds) / 60);
  const s = Math.floor(Math.abs(safeSeconds) % 60);
  return `${safeSeconds < 0 ? "-" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// CLIP PLAYER COMPONENT
function AudioClipPlayer({
  clip,
  label,
  onUpdate,
  onPlay,
  onStop,
  onPause,
  showRemove = false,
  onRemove,
}: {
  clip: AudioClip;
  label: string;
  onUpdate: (updates: Partial<AudioClip>) => void;
  onPlay: (url: string, volume: number, fadeOptions?: { fadeEnabled: boolean }) => void;
  onStop: (url: string, fadeOptions?: { fadeEnabled: boolean }) => void;
  onPause: (url: string) => void;
  showRemove?: boolean;
  onRemove?: () => void;
}) {
  const [time, setTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const isPlaying = audioManager.isPlaying(clip.url);
  const duration = audioManager.getDuration(clip.url) || 100;
  const shortcutBadge = (() => {
    const s = clip.shortcut || "";
    if (!s) return "";
    if (s.startsWith("Key")) return s.slice(3);         // KeyA -> A
    if (s.startsWith("Digit")) return s.slice(5);       // Digit1 -> 1
    if (s.startsWith("Numpad")) return `NP${s.slice(6)}`; // Numpad1 -> NP1
    if (s === "Space") return "SPACE";
    return s.toUpperCase();
  })();

  // time polling
  useEffect(() => {
    const interval = setInterval(() => setTime(audioManager.getCurrentTime(clip.url)), 100);
    return () => clearInterval(interval);
  }, [clip.url]);

  // hotkey handling
  useEffect(() => {
    if (!clip.shortcut) return;

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;

      if (e.code === clip.shortcut) {
        if (audioManager.isPlaying(clip.url)) {
          onPause(clip.url);
        } else {
          onPlay(clip.url, clip.volume, { fadeEnabled: clip.fadeEnabled || false });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clip.url, clip.shortcut, clip.volume, clip.fadeEnabled, onPlay, onPause]);

  const bgColors = clip.color ? clip.color : "transparent";

  return (
    <div style={{ background: isPlaying ? `${bgColors}ee` : bgColors, filter: isPlaying ? "brightness(1.5)" : "none", transition: "all 0.2s", display: "flex", gap: 10, padding: "8px", borderRadius: 6, marginBottom: 8, border: `1px solid ${isPlaying ? "#88c" : "#333"}`, boxSizing: "border-box", overflow: "hidden", maxWidth: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        {/* Row 1: transport + shortcut + volume (top) */}
        <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 6 }}>
          <button
            onClick={() =>
              isPlaying
                ? onPause(clip.url)
                : onPlay(clip.url, clip.volume, { fadeEnabled: clip.fadeEnabled || false })
            }
            style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {isPlaying ? "||" : ">"}
          </button>

          <button
            onClick={() => onStop(clip.url, { fadeEnabled: clip.fadeEnabled || false })}
            style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            []
          </button>

          {clip.shortcut ? (
            <span style={{ fontSize: "0.65rem", color: "#bbb", border: "1px solid #555", borderRadius: 3, padding: "1px 4px", lineHeight: 1.2 }}>
              SH {shortcutBadge}
            </span>
          ) : null}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{ background: "transparent", border: "none", padding: 0 }}
            aria-label="Audio settings"
          >
            SET
          </button>
          {showRemove && onRemove && (
            <button
              onClick={onRemove}
              style={{ background: "transparent", border: "none", padding: 0, marginLeft: 4, color: "#ff6666" }}
              title="Remove audio"
            >
              DEL
            </button>
          )}
        </div>

        {/* Row 2: single long seek bar + time (under controls) */}
        <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 6 }}>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={time}
            onChange={(e) => audioManager.seek(clip.url, Number(e.target.value))}
            style={{ flex: 1, minWidth: 0 }}
          />
          <span style={{ fontSize: "0.75rem", color: "#ddd", whiteSpace: "nowrap" }}>
            {Math.floor(time)} / {Math.floor(duration)}s
          </span>
        </div>

        {/* Row 3: editable file/track name (full width) */}
        <input
          type="text"
          value={clip.name || label}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid #333",
            color: "#fff",
            fontSize: "0.9rem",
            minWidth: 0,
            outline: "none",
            padding: "3px 6px",
            borderRadius: 4,
            boxSizing: "border-box",
          }}
        />

        {showSettings && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: 4, marginTop: 4, fontSize: "0.75rem", color: "#ccc", boxSizing: "border-box" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Shortcut{" "}
              <input
                type="text"
                readOnly
                value={shortcutBadge}
                placeholder="-"
                onKeyDown={(e) => {
                  const blocked = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"]);
                  if (blocked.has(e.key)) return;

                  if (e.key === "Escape") return; // optional cancel
                  e.preventDefault();

                  if (e.key === "Backspace" || e.key === "Delete") {
                    onUpdate({ shortcut: "" });
                    return;
                  }

                  onUpdate({ shortcut: e.code }); // stores Digit1 vs Numpad1 distinctly
                }}
                style={{ width: 44, background: "#222", border: "1px solid #444", color: "#fff", textAlign: "center" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>Fade <input type="checkbox" checked={clip.fadeEnabled || false} onChange={e => onUpdate({ fadeEnabled: e.target.checked })} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>Color <input type="color" value={clip.color || "#111111"} onChange={e => onUpdate({ color: e.target.value })} style={{ width: 16, height: 16, padding: 0, border: "none", background: "transparent" }} /></label>
          </div>
        )}
      </div>

      <div style={{ width: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "4px 0" }}>
        <span style={{ fontSize: "0.65rem", color: "#aaa" }}>Vol</span>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", minHeight: 70 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={clip.volume ?? 1}
            onChange={(e) => {
              const v = Number(e.target.value);
              audioManager.setVolume(clip.url, v);
              onUpdate({ volume: v });
            }}
            style={{ width: 70, height: 20, transform: "rotate(-90deg)", cursor: "pointer" }}
          />
        </div>
        <span style={{ fontSize: "0.65rem", color: "#aaa" }}>{Math.round((clip.volume ?? 1) * 100)}%</span>
      </div>
    </div>
  );
}


type DrawTool = "highlighter" | "marker";

// Internal type for communication, not strict state control
interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

interface DrawSettings {
  tool: DrawTool;
  drawMode: boolean;
  size: number;
  opacity: number;
  fadeMs: number;
  color: string;
  rainbow: boolean;
  sparkle: boolean;
}

const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  tool: "highlighter",
  drawMode: false,
  size: 12,
  opacity: 0.45,
  fadeMs: 2000,
  color: "#f7f06d",
  rainbow: false,
  sparkle: false,
};

interface HighlighterStroke {
  id: string;
  points: DrawPoint[];
  size: number;
  opacity: number;
  color: string;
  fadeMs: number;
  rainbow: boolean;
  sparkle: boolean;
}

const DEFAULT_BCARD_TEACH_STATE: BCardTeachState = {
  isFlipped: false,
  isBlurred: false,
  isCovered: false,
  isZoomed: false,
};

const LIVE_SESSION_STORAGE_KEY = "story-studio.live-session.v1";
const LIVE_SESSION_AUTO_RESTORE_KEY = "story-studio.live-session.auto-restore";
const STUDENT_ROSTER_FALLBACK_STORAGE_KEY = "story-studio.student-roster.v1";
const LIVE_SESSION_DEBOUNCE_MS = 500;

type LiveSessionSnapshot = {
  version: 1;
  savedAt: string;
  projectFolderPath: string;
  projectCreatedAt: string;
  appMode: AppMode;
  topMode: "story" | "boost" | "badge" | "boards" | "relics";
  boostTab: "activation" | "language" | "games" | "badge";
  currentIndex: number;
  selectedSectionId: string | null;
  selectedBoostItemId: string | null;
  selectedStoryRefId: string | null;
  selectedACardId: string | null;
  overlayBCardClickAction: BCardOverlayClickAction;
  sparkStudents: SparkStudent[];
  activeStudentId: string | null;
  badgeVisible: boolean;
  finalScoreRevealed: boolean;
};

function toMediaUrl(relativePath: string): string {
  if (!relativePath || typeof relativePath !== 'string') return "";
  const normalizedRelative = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const encodedRelative = normalizedRelative
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `media://${encodedRelative}`;
}

function ensureSections(project: ProjectState): ProjectState {
  if (project.data.sections.length > 0) {
    return project;
  }

  const fallback: Section = { id: crypto.randomUUID(), name: "Section 1" };
  return {
    ...project,
    data: {
      ...project.data,
      sections: [fallback],
      slides: project.data.slides.map((slide) => ({
        ...slide,
        sectionId: fallback.id,
      })),
    },
  };
}

function normalizeStoryRefs(items: StoryReferenceItem[] | undefined): StoryReferenceItem[] {
  const refs = Array.isArray(items) ? items : [];
  return refs
    .filter((item): item is StoryReferenceItem => item?.type === "aCardRef")
    .map((item) => ({
      ...item,
      aCardId: typeof item.aCardId === "string" ? item.aCardId : "",
    }));
}

function normalizeBCardInstances(items: BCardInstance[] | undefined): BCardInstance[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .filter((item): item is BCardInstance => !!item && typeof item.bCardId === "string" && !!item.bCardId)
    .map((item, index) => ({
      ...item,
      position:
        item.position && Number.isFinite(item.position.x) && Number.isFinite(item.position.y)
          ? { x: item.position.x, y: item.position.y }
          : { x: 48 + (index % 4) * 6, y: 34 + Math.floor(index / 4) * 8 },
      size: {
        width: Number.isFinite(item.size?.width) ? Math.max(40, item.size.width) : 270,
        height: Number.isFinite(item.size?.height) ? Math.max(40, item.size.height) : 390,
      },
      zIndex: Number.isFinite(item.zIndex) ? Math.max(1, item.zIndex) : index + 1,
      displayMode: item.displayMode === "board" ? "board" : "overlay",
    }));
}

function sanitizeProjectCardReferences(
  data: ProjectData,
  aCardIds: Set<string>,
  bCardIds: Set<string>,
): { data: ProjectData; changed: boolean } {
  let changed = false;

  const sanitizeInstances = (instances: BCardInstance[] | undefined): BCardInstance[] | undefined => {
    if (!instances) return undefined;
    const normalized = normalizeBCardInstances(instances);
    const next = normalized.filter((instance) => bCardIds.has(instance.bCardId));

    const same =
      normalized.length === next.length &&
      normalized.every((instance, index) => next[index]?.id === instance.id);

    if (!same) changed = true;
    return same ? instances : next;
  };

  const sanitizeSequence = (seq: SequenceItem[]) => {
    const next: SequenceItem[] = [];
    for (const item of seq || []) {
      if (item.type === "aCardRef") {
        if (aCardIds.has(item.aCardId)) {
          next.push({ ...item, bCardInstances: sanitizeInstances(item.bCardInstances) });
        } else {
          changed = true;
        }
        continue;
      }
      next.push({ ...item, bCardInstances: sanitizeInstances(item.bCardInstances) });
    }
    return next;
  };

  const sanitizeStoryRefs = (refs: StoryReferenceItem[] | undefined): StoryReferenceItem[] | undefined => {
    if (!refs) return undefined;
    const normalized = normalizeStoryRefs(refs);
    const next = normalized.filter((item) => {
      if (item.type === "aCardRef") return aCardIds.has(item.aCardId);
      return false;
    });

    const sameLength = refs.length === next.length;
    const sameItems =
      sameLength &&
      refs.every((item, index) => {
        const other = next[index];
        if (!other || item.type !== other.type || item.id !== other.id) return false;
        if (item.type === "aCardRef") return item.aCardId === (other as ACardRefItem).aCardId;
        return false;
      });

    if (!sameItems) changed = true;
    return sameItems ? refs : next;
  };

  const boostPack = data.boostPack
    ? {
        activationSequence: sanitizeSequence(data.boostPack.activationSequence || []),
        languageSequence: sanitizeSequence(data.boostPack.languageSequence || []),
        gamesSequence: sanitizeSequence(data.boostPack.gamesSequence || []),
      }
    : data.boostPack;

  const slides = data.slides.map((slide) => {
    const storyReferences = sanitizeStoryRefs(slide.storyReferences);
    return { ...slide, storyReferences, bCardInstances: sanitizeInstances(slide.bCardInstances) };
  });

  const sections = data.sections.map((section) => {
    const storyReferences = sanitizeStoryRefs(section.storyReferences);
    return { ...section, storyReferences, bCardInstances: sanitizeInstances(section.bCardInstances) };
  });

  return changed ? { data: { ...data, boostPack, slides, sections }, changed: true } : { data, changed: false };
}

function SparkLab() {
  const { sparkConfig, setSparkConfig, resetSparkConfig, triggerSpark } = useSparks();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#aaa' };
  const inputStyle: React.CSSProperties = { background: '#111', color: '#fff', border: '1px solid #333', padding: '2px 4px', borderRadius: 4 };

  return (
    <div style={{ display: 'inline-flex', position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ marginLeft: 8, background: isOpen ? '#4a4a5c' : '#3a3a4c', borderColor: isOpen ? '#667' : '#556' }}
      >
        Spark Lab
      </button>

      {isOpen && (
        <div ref={menuRef} style={{ position: 'fixed', top: 60, left: 320, zIndex: 10000, background: '#1a1a24', border: '1px solid #445', borderRadius: 8, padding: 16, width: 280, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', color: '#eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #334', paddingBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Spark Lab</h4>
	            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>X</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              Burst Duration ({(sparkConfig?.burstDurationMs ?? 800)}ms)
              <input type="range" min={300} max={2400} step={50} value={sparkConfig?.burstDurationMs ?? 800} onChange={e => setSparkConfig({ burstDurationMs: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Particle Count ({(sparkConfig?.particleCount ?? 10)})
              <input type="range" min={4} max={32} step={1} value={sparkConfig?.particleCount ?? 10} onChange={e => setSparkConfig({ particleCount: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Glow Intensity ({(sparkConfig?.glowIntensity ?? 60)}%)
              <input type="range" min={0} max={200} step={5} value={sparkConfig?.glowIntensity ?? 60} onChange={e => setSparkConfig({ glowIntensity: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Color Intensity ({(sparkConfig?.colorIntensity ?? 100)}%)
              <input type="range" min={0} max={200} step={5} value={sparkConfig?.colorIntensity ?? 100} onChange={e => setSparkConfig({ colorIntensity: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Counter Visible ({(sparkConfig?.counterVisibleMs ?? 2000)}ms)
              <input type="range" min={500} max={6000} step={100} value={sparkConfig?.counterVisibleMs ?? 2000} onChange={e => setSparkConfig({ counterVisibleMs: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Scale Pop ({(sparkConfig?.scalePopIntensity ?? 1.2).toFixed(1)}x)
              <input type="range" min={1.0} max={3.0} step={0.1} value={sparkConfig?.scalePopIntensity ?? 1.2} onChange={e => setSparkConfig({ scalePopIntensity: Number(e.target.value) })} />
            </label>

            <div style={{ borderTop: '1px solid #333', margin: '4px 0', paddingTop: 8 }} />

            <label style={labelStyle}>
              Counter Size ({(sparkConfig?.counterSize ?? 2.5).toFixed(1)}rem)
              <input type="range" min={1.0} max={10.0} step={0.2} value={sparkConfig?.counterSize ?? 2.5} onChange={e => setSparkConfig({ counterSize: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Spark Size ({(sparkConfig?.sparkSize ?? 50)}px)
              <input type="range" min={20} max={200} step={2} value={sparkConfig?.sparkSize ?? 50} onChange={e => setSparkConfig({ sparkSize: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Position Top ({(sparkConfig?.positionTop ?? 120)}px)
              <input type="range" min={0} max={1000} step={10} value={sparkConfig?.positionTop ?? 120} onChange={e => setSparkConfig({ positionTop: Number(e.target.value) })} />
            </label>

            <label style={labelStyle}>
              Position Right ({(sparkConfig?.positionRight ?? 40)}px)
              <input type="range" min={0} max={1000} step={10} value={sparkConfig?.positionRight ?? 40} onChange={e => setSparkConfig({ positionRight: Number(e.target.value) })} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
              <button style={{ fontSize: '0.7rem', background: '#442' }} onClick={() => triggerSpark('gold')}>Gold</button>
              <button style={{ fontSize: '0.7rem', background: '#244' }} onClick={() => triggerSpark('blue')}>Blue</button>
              <button style={{ fontSize: '0.7rem', background: '#424' }} onClick={() => triggerSpark('pink')}>Pink</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function SparkHotkeyHandler({
  appMode,
  onActiveStudentChangeFlash,
}: {
  appMode: string;
  onActiveStudentChangeFlash?: (name: string) => void;
}) {
  const { triggerSpark, students, activeStudentId, setActiveStudentId } = useSparks();

  useEffect(() => {
    if (appMode !== 'teach') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        triggerSpark('gold');
      } else if (e.key === ']') {
        e.preventDefault();
        triggerSpark('blue');
      } else if (e.key === '\\') {
        e.preventDefault();
        triggerSpark('pink');
      } else if (e.key === 'Backspace') {
        if (students.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        const currentIndex = students.findIndex((student) => student.id === activeStudentId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % students.length : 0;
        const nextStudent = students[nextIndex];
        if (!nextStudent) return;
        setActiveStudentId(nextStudent.id);
        onActiveStudentChangeFlash?.(nextStudent.name || 'Student');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, triggerSpark, students, activeStudentId, setActiveStudentId, onActiveStudentChangeFlash]);

  return null;
}

const BadgeTabBackground = ({ project, toMediaUrl }: { project: any, toMediaUrl: any }) => {
  const { badgeConfig } = useSparks();
  const tabBg = badgeConfig.tabBackground || {};
  const assets = project?.data.assets || [];
  const bgAsset = assets.find((a: any) => a.id === tabBg.assetId);
  const bgUrl = bgAsset ? toMediaUrl(bgAsset.relativePath) : null;

  if (!bgUrl) return null;

  const style = {
    '--tab-bg-blur': tabBg.blur ?? 0,
    '--tab-bg-brightness': `${tabBg.brightness ?? 100}%`,
    '--tab-bg-scale': tabBg.scale ?? 1,
    '--tab-bg-posX': `${tabBg.posX ?? 50}%`,
    '--tab-bg-posY': `${tabBg.posY ?? 50}%`,
  } as React.CSSProperties;

  return (
    <div className="tab-background-layer" style={style}>
      <img src={bgUrl} className="tab-background-img" alt="" />
    </div>
  );
};

const BadgeStudentSprites = ({
  assetsById,
  getMediaUrl,
  isEditMode,
}: {
  assetsById: Map<string, AssetItem>;
  getMediaUrl: (path: string) => string;
  isEditMode: boolean;
}) => {
  const { badgeConfig, setBadgeConfig, students, isFinalScoreRevealed, removeStudent } = useSparks();
  const checkedStudents = students.filter((student) => student.badgeVisible !== false);
  const sprites = badgeConfig.badgeSprites || [];
  const motion = badgeConfig.badgeSpriteMotion || "spin";
  const durationMs = badgeConfig.badgeSpriteAnimDurationMs ?? 3200;
  const intensity = (badgeConfig.badgeSpriteAnimIntensity ?? 100) / 100;
  const shouldShowScore = isFinalScoreRevealed && badgeConfig.showFinalScore;
  const getVariantSparkCount = (student: SparkStudent, variant: "gold" | "blue" | "pink") => {
    if (variant === "gold") return student.yellowSparks || 0;
    if (variant === "blue") return student.blueSparks || 0;
    return student.pinkSparks || 0;
  };

  const updateSprite = (spriteId: string, updates: Partial<BadgeStudentSprite>) => {
    const nextSprites = sprites.map((sprite) =>
      sprite.id === spriteId ? { ...sprite, ...updates } : sprite,
    );
    setBadgeConfig({ badgeSprites: nextSprites });
  };

  return (
    <div className={`badge-student-sprite-layer ${isEditMode ? "is-edit" : ""}`}>
      {checkedStudents.flatMap((student) => {
        const variants: Array<"gold" | "blue" | "pink"> = ["gold", "blue", "pink"];
        return variants.map((variant) => {
          const sprite = sprites.find(
            (item) => item.studentId === student.id && (item.variant || "gold") === variant,
          );
          if (!sprite) return null;

          const variantAssetId = badgeConfig.badgeSparkAssetIds?.[variant];
          const asset = assetsById.get(variantAssetId || "");
          if (!asset) return null;

          const scoreText = shouldShowScore ? String(getVariantSparkCount(student, variant)) : "?";
          const motionClass = `badge-sprite-motion-${motion}`;

          return (
            <Rnd
              key={sprite.id}
              bounds="parent"
              disableDragging={!isEditMode}
              enableResizing={isEditMode ? { bottomRight: true } : false}
              minWidth={60}
              minHeight={60}
              resizeHandleStyles={{
                bottomRight: {
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(20,20,20,0.9)",
                  right: -9,
                  bottom: -9,
                },
              }}
              size={{ width: sprite.width, height: sprite.height }}
              position={{ x: sprite.x, y: sprite.y }}
              onDragStop={(_, data) => {
                updateSprite(sprite.id, { x: data.x, y: data.y });
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                updateSprite(sprite.id, {
                  x: position.x,
                  y: position.y,
                  width: ref.offsetWidth,
                  height: ref.offsetHeight,
                });
              }}
              style={{
                zIndex: sprite.zIndex ?? 20,
                pointerEvents: isEditMode ? "auto" : "none",
              }}
            >
              <div
                className={`badge-sprite-frame ${motionClass}`}
                style={{
                  "--badge-sprite-dur": `${durationMs}ms`,
                  "--badge-sprite-intensity": intensity,
                } as React.CSSProperties}
              >
                <img
                  src={getMediaUrl(asset.relativePath)}
                  className="badge-student-sprite"
                  alt={`${student.name || "student"} ${variant} badge`}
                />
                <div className="badge-sprite-score">
                  <div className="badge-sprite-student-name">{student.name || "Student"}</div>
                  <div className="badge-sprite-score-value">{scoreText}</div>
                </div>
              </div>
            </Rnd>
          );
        });
      })}
    </div>
  );
};

export function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  // Track viewport of ACTIVE slide without triggering re-renders
  const viewportRef = useRef<ViewportState>({ zoom: 1, pan: { x: 0, y: 0 } });
  // Track playback time of ACTIVE media (for seamless transition freezing)
  const lastMediaTimeRef = useRef(0);
  const lastRightClickRef = useRef<number>(0);
  const teachToolsHostRef = useRef<HTMLDivElement | null>(null);

  // Transition UI Staging State
  const [stagedTransition, setStagedTransition] =
    useState<TransitionType>("fade");
  const [stagedDuration, setStagedDuration] = useState(500);
  const [stagedDirection, setStagedDirection] = useState<
    "left" | "right" | "up" | "down"
  >("left");

  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_MODE);

  const ENABLE_BOOST_MODE = true;
  const [topMode, setTopMode] = useState<'story' | 'boost' | 'badge' | 'boards' | 'relics'>('story');
  const [selectedACardId, setSelectedACardId] = useState<string | null>(null);
  const [selectedLibraryBCardId, setSelectedLibraryBCardId] = useState<string | null>(null);
  const [boostTab, setBoostTab] = useState<'activation' | 'language' | 'games' | 'badge'>('activation');
  const [selectedBoostItemId, setSelectedBoostItemId] = useState<string | null>(null);
  const [boostSearchQuery, setBoostSearchQuery] = useState("");
  const [selectedStoryRefId, setSelectedStoryRefId] = useState<string | null>(null);
  const [selectedPlacedBCardId, setSelectedPlacedBCardId] = useState<string | null>(null);
  const [overlayBCardTeachStates, setOverlayBCardTeachStates] = useState<Record<string, BCardTeachState>>({});
  const [overlayBCardClickAction, setOverlayBCardClickAction] = useState<BCardOverlayClickAction>("flip");
  const [badgeVisibleState, setBadgeVisibleState] = useState(false);
  const [finalScoreRevealedState, setFinalScoreRevealedState] = useState(false);
  const [storyRefsCollapsed, setStoryRefsCollapsed] = useState(true);
  const [storyBCardTeachCollapsed, setStoryBCardTeachCollapsed] = useState(true);
  const [boostBCardTeachCollapsed, setBoostBCardTeachCollapsed] = useState(true);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(
    null,
  );
  const [renamingSlideId, setRenamingSlideId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [updateAudio, setUpdateAudio] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragImportActive, setIsDragImportActive] = useState(false);
  const dragImportDepthRef = useRef(0);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(
    null,
  );
  const [dragInsertIndex, setDragInsertIndex] = useState<number | null>(
    null,
  );
  const [drawPanelCollapsed, setDrawPanelCollapsed] = useState(true);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    null,
  );
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(
    new Set(),
  );
  const [breakEditorDraft, setBreakEditorDraft] = useState<{
    sectionId: string;
    name: string;
    questions: string;
  } | null>(null);
  const [drawClearSignal, setDrawClearSignal] = useState(0);
  const [showBreakEditor, setShowBreakEditor] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSaveChoiceModal, setShowSaveChoiceModal] = useState(false);
  const [isSaveInProgress, setIsSaveInProgress] = useState(false);
  const [showSlideSelector, setShowSlideSelector] = useState(false);
  const [bubblePanelOpen, setBubblePanelOpen] = useState(false);
  const [copyBubbleOverlayId, setCopyBubbleOverlayId] = useState<string | null>(null);
  const [copyBubbleTargetIds, setCopyBubbleTargetIds] = useState<string[]>([]);
  const [showBreakBgLibrary, setShowBreakBgLibrary] = useState(false);
  const [breakThumbDrag, setBreakThumbDrag] = useState<{
    sectionId: string;
    mediaId: string;
    mode: "move" | "scale";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startScale: number;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "create" | "open" | "close" | null
  >(null);
  const [pendingSectionDeleteId, setPendingSectionDeleteId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    id: number;
    type: "edit" | "teach" | "success";
    duration: number;
  } | null>(null);

  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({
    ...DEFAULT_DRAW_SETTINGS,
  });

  const [timerState, setTimerState] = useState<{
    isRunning: boolean;
    startTime: number;
    accumulated: number;
  }>({ isRunning: false, startTime: 0, accumulated: 0 });
  const [timerNow, setTimerNow] = useState(Date.now());

  const [showRestoreSessionPrompt, setShowRestoreSessionPrompt] = useState(false);
  const [savedLiveSession, setSavedLiveSession] = useState<LiveSessionSnapshot | null>(null);
  const [pendingRestoreSession, setPendingRestoreSession] = useState<LiveSessionSnapshot | null>(null);
  const [studentRoster, setStudentRoster] = useState<StudentRosterEntry[]>([]);
  const [isRelicRewardCardVisible, setIsRelicRewardCardVisible] = useState(false);
  const [relicAnimationSignal, setRelicAnimationSignal] = useState<{
    kind: "progress" | "stage" | "complete";
    nonce: number;
  } | null>(null);

  useEffect(() => {
    if (!timerState.isRunning) return;
    const interval = setInterval(() => setTimerNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [timerState.isRunning]);

  const toggleTimer = () => {
    if (timerState.isRunning) {
      // Pause
      setTimerState((prev) => ({
        ...prev,
        isRunning: false,
        accumulated: prev.accumulated + (Date.now() - prev.startTime),
        startTime: 0,
      }));
    } else {
      // Start
      setTimerState((prev) => ({
        ...prev,
        isRunning: true,
        startTime: Date.now(),
      }));
    }
  };

  const resetTimer = () => {
    setTimerState({ isRunning: false, startTime: 0, accumulated: 0 });
    setTimerNow(Date.now());
  };

  // Check for unsaved changes on close
  // General UI Selected audio items tracking for bulk ops


  // Initialization: apply stored window dimensions if present from main process
  useEffect(() => {
    const unsub = window.appApi.onRequestClose(() => {
      if (isDirty) {
        setPendingAction("close");
        setShowConfirmModal(true);
      } else {
        window.appApi.forceClose();
      }
    });
    return () => unsub();
  }, [isDirty]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.floor(Math.abs(seconds) % 60);
    return `${seconds < 0 ? "-" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "teach" | "edit" = "success",
      duration = 2000,
    ) => {
      const id = Date.now();
      setToast({ message, type, duration, id });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, duration);
    },
    [],
  );

  const parseLiveSessionSnapshot = (
    raw: string | null,
  ): LiveSessionSnapshot | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<LiveSessionSnapshot>;
      if (
        parsed.version !== 1 ||
        typeof parsed.projectFolderPath !== "string" ||
        typeof parsed.projectCreatedAt !== "string" ||
        !Array.isArray(parsed.sparkStudents)
      ) {
        return null;
      }
      return {
        version: 1,
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
        projectFolderPath: parsed.projectFolderPath,
        projectCreatedAt: parsed.projectCreatedAt,
        appMode: parsed.appMode === "edit" ? "edit" : "teach",
        topMode:
          parsed.topMode === "boost" ||
          parsed.topMode === "badge" ||
          parsed.topMode === "boards" ||
          parsed.topMode === "relics"
            ? parsed.topMode
            : "story",
        boostTab:
          parsed.boostTab === "language" ||
          parsed.boostTab === "games" ||
          parsed.boostTab === "badge"
            ? parsed.boostTab
            : "activation",
        currentIndex: Number.isFinite(parsed.currentIndex) ? Math.max(0, Number(parsed.currentIndex)) : 0,
        selectedSectionId: typeof parsed.selectedSectionId === "string" ? parsed.selectedSectionId : null,
        selectedBoostItemId: typeof parsed.selectedBoostItemId === "string" ? parsed.selectedBoostItemId : null,
        selectedStoryRefId: typeof parsed.selectedStoryRefId === "string" ? parsed.selectedStoryRefId : null,
        selectedACardId: typeof parsed.selectedACardId === "string" ? parsed.selectedACardId : null,
        overlayBCardClickAction:
          parsed.overlayBCardClickAction === "flip" ||
          parsed.overlayBCardClickAction === "blur" ||
          parsed.overlayBCardClickAction === "cover" ||
          parsed.overlayBCardClickAction === "zoom"
            ? parsed.overlayBCardClickAction
            : "flip",
        sparkStudents: parsed.sparkStudents as SparkStudent[],
        activeStudentId: typeof parsed.activeStudentId === "string" ? parsed.activeStudentId : null,
        badgeVisible: Boolean(parsed.badgeVisible),
        finalScoreRevealed: Boolean(parsed.finalScoreRevealed),
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const snapshot = parseLiveSessionSnapshot(
      window.localStorage.getItem(LIVE_SESSION_STORAGE_KEY),
    );
    if (!snapshot) return;
    setSavedLiveSession(snapshot);
    setShowRestoreSessionPrompt(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let fallbackRaw: unknown = null;
    try {
      fallbackRaw = JSON.parse(window.localStorage.getItem(STUDENT_ROSTER_FALLBACK_STORAGE_KEY) || "null");
    } catch {
      fallbackRaw = null;
    }
    const fallbackSettings = normalizeStudentRosterSettings(fallbackRaw);
    const appApi = window.appApi as typeof window.appApi & {
      getStudentRoster?: () => Promise<StudentRosterSettings>;
      saveStudentRoster?: (settings: StudentRosterSettings) => Promise<StudentRosterSettings>;
    };

    if (!appApi.getStudentRoster) {
      setStudentRoster(fallbackSettings.studentRoster);
      return () => {
        cancelled = true;
      };
    }

    appApi.getStudentRoster()
      .then((settings) => {
        if (cancelled) return;
        const normalized = normalizeStudentRosterSettings(settings);
        if (normalized.studentRoster.length === 0 && fallbackSettings.studentRoster.length > 0) {
          setStudentRoster(fallbackSettings.studentRoster);
          void appApi.saveStudentRoster?.(fallbackSettings).catch((error) => console.error(error));
        } else {
          setStudentRoster(normalized.studentRoster);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setStudentRoster(fallbackSettings.studentRoster);
          showToast("Using local student roster fallback", "edit", 2000);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (project) {
      setShowRestoreSessionPrompt(false);
    }
  }, [project]);

  const assetsById = useMemo(() => {
    const map = new Map<string, AssetItem>();
    project?.data?.assets?.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [project]);

  const relicSystem = useMemo(
    () => normalizeRelicSystem(project?.data.relicSystem),
    [project?.data.relicSystem],
  );

  useEffect(() => {
    if (!project) return;
    const reconciled = ensureRelicProgressForRoster(normalizeRelicSystem(project.data.relicSystem), studentRoster);
    if (JSON.stringify(reconciled.studentProgress) === JSON.stringify(project.data.relicSystem?.studentProgress ?? {})) {
      return;
    }
    setProject({
      ...project,
      data: {
        ...project.data,
        relicSystem: reconciled,
      },
    });
  }, [project, studentRoster]);

  const updateRelicSystem = useCallback((updater: (current: RelicSystem) => RelicSystem) => {
    setProject((prev) => {
      if (!prev) return prev;
      const nextRelicSystem = normalizeRelicSystem(updater(normalizeRelicSystem(prev.data.relicSystem)));
      return {
        ...prev,
        data: {
          ...prev.data,
          relicSystem: nextRelicSystem,
        },
      };
    });
    setIsDirty(true);
  }, [showToast]);

  const patchRelicSystem = useCallback((updates: Partial<RelicSystem>) => {
    updateRelicSystem((current) => ({ ...current, ...updates }));
  }, [updateRelicSystem]);

  const saveRoster = useCallback(async (nextRoster: StudentRosterEntry[]): Promise<StudentRosterEntry[]> => {
    const settings = normalizeStudentRosterSettings({ version: 1, studentRoster: nextRoster });
    window.localStorage.setItem(STUDENT_ROSTER_FALLBACK_STORAGE_KEY, JSON.stringify(settings));
    setStudentRoster(settings.studentRoster);

    const appApi = window.appApi as typeof window.appApi & {
      saveStudentRoster?: (nextSettings: StudentRosterSettings) => Promise<StudentRosterSettings>;
    };
    if (!appApi.saveStudentRoster) {
      showToast("Student roster saved locally. Restart Story Studio to enable global roster file storage.", "edit", 2600);
      return settings.studentRoster;
    }

    try {
      const saved = await appApi.saveStudentRoster(settings);
      const normalized = normalizeStudentRosterSettings(saved);
      window.localStorage.setItem(STUDENT_ROSTER_FALLBACK_STORAGE_KEY, JSON.stringify(normalized));
      setStudentRoster(normalized.studentRoster);
      return normalized.studentRoster;
    } catch (error) {
      console.error(error);
      showToast("Student roster saved locally; global settings file was unavailable", "edit", 2600);
      return settings.studentRoster;
    }
  }, []);

  const addRosterStudent = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    const now = new Date().toISOString();
    const student: StudentRosterEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const nextRoster = [...studentRoster, student];
    const savedRoster = await saveRoster(nextRoster);
    updateRelicSystem((current) => {
      const withRoster = ensureRelicProgressForRoster(current, savedRoster);
      return {
        ...withRoster,
        studentProgress: {
          ...withRoster.studentProgress,
          [student.id]: {
            ...(withRoster.studentProgress[student.id] ?? { progress: 0, active: false }),
            active: true,
          },
        },
      };
    });
    showToast(`Added ${student.name}`, "success", 1200);
    return true;
  }, [saveRoster, showToast, studentRoster, updateRelicSystem]);

  const renameRosterStudent = useCallback(async (studentId: string, name: string): Promise<boolean> => {
    const student = studentRoster.find((item) => item.id === studentId);
    if (!student || !name.trim()) return false;
    const nextRoster = studentRoster.map((item) =>
      item.id === studentId ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item,
    );
    await saveRoster(nextRoster);
    showToast("Student renamed", "success", 1200);
    return true;
  }, [saveRoster, showToast, studentRoster]);

  const archiveRosterStudent = useCallback(async (studentId: string) => {
    const student = studentRoster.find((item) => item.id === studentId);
    if (!student) return;
    const nextRoster = studentRoster.map((item) =>
      item.id === studentId ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item,
    );
    await saveRoster(nextRoster);
    showToast("Student removed from active roster", "success", 1400);
  }, [saveRoster, showToast, studentRoster]);

  const updateRelicStudentProgress = useCallback((
    studentId: string,
    updates: { active?: boolean; progress?: number; notes?: string },
  ) => {
    updateRelicSystem((current) => ({
      ...current,
      studentProgress: {
        ...current.studentProgress,
        [studentId]: {
          ...(current.studentProgress[studentId] ?? { progress: 0, active: false }),
          ...updates,
          ...(updates.progress !== undefined ? { progress: clampRelicProgress(updates.progress) } : {}),
        },
      },
    }));
  }, [updateRelicSystem]);

  const runRelicProgressAction = useCallback((action: "increase" | "decrease" | "reset" | "complete") => {
    const activeStudentIds = getActiveRelicStudentIds(relicSystem, studentRoster);
    if (activeStudentIds.length === 0) {
      showToast("No active student selected", "edit", 1200);
      return;
    }
    const beforeProgress = activeStudentIds.map((studentId) => relicSystem.studentProgress[studentId]?.progress ?? 0);
    const afterProgress = beforeProgress.map((progress) => {
      if (action === "increase") return clampRelicProgress(progress + 1);
      if (action === "decrease") return clampRelicProgress(progress - 1);
      if (action === "reset") return 0;
      return 30;
    });
    const crossesStageBoundary = beforeProgress.some((progress, index) => {
      const next = afterProgress[index] ?? progress;
      return (
        (progress === 0 && next >= 1) ||
        (progress <= 10 && next >= 11) ||
        (progress <= 20 && next >= 21) ||
        (progress <= 29 && next >= 30)
      );
    });
    const reachesComplete = beforeProgress.some((progress, index) => progress < 30 && (afterProgress[index] ?? progress) >= 30);
    updateRelicSystem((current) => {
      const visibleCurrent = { ...current, showOnStage: true };
      if (action === "increase") return applyRelicProgressDelta(visibleCurrent, activeStudentIds, 1);
      if (action === "decrease") return applyRelicProgressDelta(visibleCurrent, activeStudentIds, -1);
      if (action === "reset") return setRelicProgressForStudents(visibleCurrent, activeStudentIds, 0);
      return setRelicProgressForStudents(visibleCurrent, activeStudentIds, 30);
    });
    if (action === "complete") {
      setIsRelicRewardCardVisible(true);
    }
    const kind = reachesComplete ? "complete" : crossesStageBoundary ? "stage" : "progress";
    const shouldAnimate =
      (kind === "complete" && relicSystem.animateOnComplete) ||
      (kind === "stage" && relicSystem.animateOnStageChange) ||
      (kind === "progress" && relicSystem.animateOnProgress);
    if (shouldAnimate) {
      setRelicAnimationSignal({ kind, nonce: Date.now() });
    }
  }, [relicSystem, showToast, studentRoster, updateRelicSystem]);

  const toggleRelicWidgetVisibility = useCallback(() => {
    updateRelicSystem((current) => ({ ...current, showOnStage: !current.showOnStage }));
  }, [updateRelicSystem]);

  const matchesRelicHotkey = useCallback((event: KeyboardEvent, hotkey: string): boolean => {
    const parts = hotkey.split("+").map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return false;
    const key = parts[parts.length - 1];
    const wantsCtrl = parts.includes("ctrl") || parts.includes("control");
    const wantsAlt = parts.includes("alt") || parts.includes("option");
    const wantsShift = parts.includes("shift");
    const wantsMeta = parts.includes("meta") || parts.includes("cmd") || parts.includes("command");
    const eventKey = event.key.toLowerCase();
    const normalizedKey =
      key === "up" ? "arrowup" :
      key === "down" ? "arrowdown" :
      key === "left" ? "arrowleft" :
      key === "right" ? "arrowright" :
      key;
    return (
      event.ctrlKey === wantsCtrl &&
      event.altKey === wantsAlt &&
      event.shiftKey === wantsShift &&
      event.metaKey === wantsMeta &&
      eventKey === normalizedKey
    );
  }, []);

  const importRelicImage = useCallback(async (slot: "main" | "stage1" | "stage2" | "stage3") => {
    if (!project) return;
    const result = await window.appApi.importMedia();
    if (!result || result.importedAssets.length === 0) return;
    const normalizedImportedAssets = decorateImportedAssetsForContext(project.data, result.importedAssets);
    const imageAsset = normalizedImportedAssets.find((asset) => asset.mediaType === "image");
    if (!imageAsset) {
      showToast("Choose an image file for relic art", "edit", 1600);
      return;
    }
    setProject((prev) => {
      if (!prev) return prev;
      const current = normalizeRelicSystem(prev.data.relicSystem);
      const nextRelicSystem: RelicSystem = slot === "main"
        ? { ...current, mainImageAssetId: imageAsset.id }
        : {
            ...current,
            stageImageAssetIds: {
              ...current.stageImageAssetIds,
              [slot]: imageAsset.id,
            },
          };
      return {
        ...prev,
        data: {
          ...prev.data,
          assets: [...prev.data.assets, ...normalizedImportedAssets],
          relicSystem: nextRelicSystem,
        },
      };
    });
    setIsDirty(true);
  }, [project, showToast]);

  useEffect(() => {
    const handleRelicHotkeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (matchesRelicHotkey(event, relicSystem.hotkeys.increaseProgress)) {
        event.preventDefault();
        runRelicProgressAction("increase");
      } else if (matchesRelicHotkey(event, relicSystem.hotkeys.decreaseProgress)) {
        event.preventDefault();
        runRelicProgressAction("decrease");
      } else if (matchesRelicHotkey(event, relicSystem.hotkeys.toggleWidget)) {
        event.preventDefault();
        toggleRelicWidgetVisibility();
      } else if (!event.ctrlKey || !event.altKey || event.metaKey || event.shiftKey) {
        return;
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        runRelicProgressAction("reset");
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        runRelicProgressAction("complete");
      } else if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        setIsRelicRewardCardVisible(true);
      }
    };
    window.addEventListener("keydown", handleRelicHotkeys);
    return () => window.removeEventListener("keydown", handleRelicHotkeys);
  }, [matchesRelicHotkey, relicSystem.hotkeys, runRelicProgressAction, toggleRelicWidgetVisibility]);

  const sections = project?.data.sections ?? [];
  let _matchedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  let activeItem: SequenceItem | null = null;
  let activeBoostSequence: SequenceItem[] = [];
  let activeBoostIndex = -1;
  if (topMode === 'boost') {
    _matchedSection = null;
    if (project?.data.boostPack) {
      activeBoostSequence = project.data.boostPack[`${boostTab}Sequence` as keyof BoostPack] || [];
      activeBoostIndex = activeBoostSequence.findIndex((i) => i.id === selectedBoostItemId);
      activeItem = activeBoostIndex >= 0 ? activeBoostSequence[activeBoostIndex] : null;
      if (activeItem?.type === 'breakRef') {
        const breakId = (activeItem as Extract<SequenceItem, { type: 'breakRef' }>).breakId;
        _matchedSection = sections.find(s => s.id === breakId) ?? null;
      }
    }
  }

  const boostBackdropContext = (() => {
    if (topMode !== "boost" || !project || activeBoostIndex < 0) return null;
    for (let i = activeBoostIndex; i >= 0; i -= 1) {
      const item = activeBoostSequence[i];
      if (!item) continue;
      if (item.type === "slideRef") {
        const slide = project.data.slides.find((s) => s.id === item.slideId) ?? null;
        if (slide) return { kind: "slide" as const, slide };
        continue;
      }
      if (item.type === "breakRef") {
        const section = sections.find((s) => s.id === item.breakId) ?? null;
        if (section) return { kind: "break" as const, section };
      }
    }
    return null;
  })();

  if (topMode === "boost" && boostTab === "language" && activeItem?.type === "aCardRef" && boostBackdropContext?.kind === "break") {
    _matchedSection = boostBackdropContext.section;
  }

  const selectedSection = _matchedSection;
  const selectedSectionType = topMode === 'boost' && activeItem && activeItem.type !== 'slideRef' && activeItem.type !== 'breakRef'
    ? activeItem.type
    : selectedSection?.type;

  useEffect(() => {
    const nextShowBreakEditor =
      selectedSection?.type === "break" && appMode === "edit" && topMode === "story";
    setShowBreakEditor((prev) => (prev === nextShowBreakEditor ? prev : nextShowBreakEditor));
  }, [selectedSection?.id, selectedSection?.type, appMode, topMode]);

  useEffect(() => {
    if (selectedSection?.type !== "break") {
      setBreakEditorDraft((prev) => (prev === null ? prev : null));
      return;
    }
    setBreakEditorDraft((prev) => {
      if (
        prev?.sectionId === selectedSection.id &&
        prev.name === (selectedSection.name || "") &&
        prev.questions === (selectedSection.questions || "")
      ) {
        return prev;
      }
      return {
        sectionId: selectedSection.id,
        name: selectedSection.name || "",
        questions: selectedSection.questions || "",
      };
    });
  }, [selectedSection?.id, selectedSection?.type]);

  const sectionSlideIndices = useMemo(() => {
    if (!project) return new Map<string, number[]>();
    const map = new Map<string, number[]>();
    project.data.slides.forEach((slide, index) => {
      const list = map.get(slide.sectionId) ?? [];
      list.push(index);
      map.set(slide.sectionId, list);
    });
    return map;
  }, [project]);

  const visibleSlideIndices = useMemo(() => {
    if (!project) return [];
    if (!selectedSectionId) return project.data.slides.map((_, index) => index);
    return sectionSlideIndices.get(selectedSectionId) ?? [];
  }, [project, sectionSlideIndices, selectedSectionId]);

  let currentSlide = project?.data.slides[currentIndex] ?? null;
  let currentAsset = currentSlide
    ? (assetsById.get(currentSlide.assetId) ?? null)
    : null;

  if (topMode === 'boost' && activeItem) {
    if (activeItem.type === 'slideRef') {
      const activeSlide = project?.data.slides.find(s => s.id === activeItem.slideId) ?? null;
      currentSlide = activeSlide;
      currentAsset = activeSlide ? (assetsById.get(activeSlide.assetId) ?? null) : null;
    } else if (activeItem.type === 'aCardRef' && boostTab === 'language') {
      if (boostBackdropContext?.kind === "slide") {
        currentSlide = boostBackdropContext.slide;
        currentAsset = assetsById.get(boostBackdropContext.slide.assetId) ?? null;
      } else {
        currentSlide = null;
        currentAsset = null;
      }
    } else {
      currentSlide = null;
      currentAsset = null;
    }
  }

  const currentVideoAudioSettings = currentSlide
    ? resolveVideoAudioSettings(currentSlide.videoAudio)
    : resolveVideoAudioSettings(undefined);
  const stripReferencePrefix = (value: string, referenceCode?: string) => {
    const trimmed = value.trim();
    if (!trimmed || !referenceCode) return trimmed;
    const escapedCode = referenceCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return trimmed.replace(new RegExp(`^${escapedCode}\\s+`, "i"), "").trim();
  };

  const getSlideEditableDescription = (slide: Slide) => {
    const asset = assetsById.get(slide.assetId);
    const customName = slide.name?.trim();
    if (customName) return stripReferencePrefix(customName, asset?.referenceCode);
    return asset ? getAssetDescription(asset) : "Unknown asset";
  };

  const getSlideDisplayName = (slide: Slide, mode: "edit" | "teach" = appMode) => {
    const asset = assetsById.get(slide.assetId);
    const description = getSlideEditableDescription(slide);
    if (mode === "teach") return description;
    if (asset?.referenceCode) return `${asset.referenceCode} ${description}`.trim();
    return asset ? getAssetDisplayLabel(asset, mode) : "Unknown asset";
  };

  const storyRefContext = useMemo(() => {
    if (topMode !== "story" || !project) return null;
    if (selectedSection?.type === "break" && selectedSection) {
      return {
        target: "break" as const,
        id: selectedSection.id,
        refs: normalizeStoryRefs(selectedSection.storyReferences),
      };
    }
    if (currentSlide) {
      return {
        target: "slide" as const,
        id: currentSlide.id,
        refs: normalizeStoryRefs(currentSlide.storyReferences),
      };
    }
    return null;
  }, [topMode, project, selectedSection, currentSlide]);

  const storyBCardHost = useMemo(() => {
    if (topMode !== "story") return null;
    if (selectedSection?.type === "break" && selectedSection) {
      return {
        target: "break" as const,
        id: selectedSection.id,
        instances: normalizeBCardInstances(selectedSection.bCardInstances),
      };
    }
    if (currentSlide) {
      return {
        target: "slide" as const,
        id: currentSlide.id,
        instances: normalizeBCardInstances(currentSlide.bCardInstances),
      };
    }
    return null;
  }, [topMode, selectedSection, currentSlide]);

  const storyACardRefs = storyRefContext?.refs || [];
  const boostLanguageACardRefs: ACardRefItem[] =
    topMode === "boost" && boostTab === "language" && activeItem?.type === "aCardRef"
      ? [{ id: activeItem.id, type: "aCardRef", aCardId: (activeItem as ACardRefItem).aCardId }]
      : [];
  const stageHasHalfACardOverlay =
    storyACardRefs.some((ref) => (project?.data.aCardLibrary || {})[ref.aCardId]?.stageMode === "half") ||
    boostLanguageACardRefs.some((ref) => (project?.data.aCardLibrary || {})[ref.aCardId]?.stageMode === "half");
  const canEditStoryRefs = topMode === "story" && (appMode === "edit" || appMode === "teach");
  const boostBCardHost = useMemo(() => {
    if (topMode !== "boost" || !activeItem) return null;
    return {
      target: "boost" as const,
      id: activeItem.id,
      instances: normalizeBCardInstances(activeItem.bCardInstances),
    };
  }, [topMode, activeItem]);
  const activeOverlayBCardInstances = topMode === "story"
    ? (storyBCardHost?.instances || [])
    : (boostBCardHost?.instances || []);
  const selectedOverlayBCardInstanceId =
    selectedPlacedBCardId && activeOverlayBCardInstances.some((item) => item.id === selectedPlacedBCardId)
      ? selectedPlacedBCardId
      : (activeOverlayBCardInstances[0]?.id || null);
  const selectedOverlayBCardState = selectedOverlayBCardInstanceId
    ? (overlayBCardTeachStates[selectedOverlayBCardInstanceId] || DEFAULT_BCARD_TEACH_STATE)
    : null;

  const setOverlayBCardState = (instanceId: string, next: BCardTeachState) => {
    setOverlayBCardTeachStates((prev) => ({ ...prev, [instanceId]: next }));
  };
  const toggleSelectedOverlayBCardState = (property: keyof BCardTeachState) => {
    if (!selectedOverlayBCardInstanceId || !selectedOverlayBCardState) return;
    setOverlayBCardState(selectedOverlayBCardInstanceId, {
      ...selectedOverlayBCardState,
      [property]: !selectedOverlayBCardState[property],
    });
  };
  const resetSelectedOverlayBCardState = () => {
    if (!selectedOverlayBCardInstanceId) return;
    setOverlayBCardState(selectedOverlayBCardInstanceId, DEFAULT_BCARD_TEACH_STATE);
  };

  useEffect(() => {
    if (!storyRefContext) {
      if (selectedStoryRefId) setSelectedStoryRefId(null);
      return;
    }
    if (!selectedStoryRefId) return;
    if (!storyRefContext.refs.some((item) => item.id === selectedStoryRefId)) {
      setSelectedStoryRefId(storyRefContext.refs[0]?.id || null);
    }
  }, [storyRefContext, selectedStoryRefId]);

  useEffect(() => {
    const validIds = new Set(activeOverlayBCardInstances.map((item) => item.id));
    setOverlayBCardTeachStates((prev) => {
      const next: Record<string, BCardTeachState> = {};
      for (const [id, state] of Object.entries(prev)) {
        if (validIds.has(id)) next[id] = state;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length) {
        let changed = false;
        for (const key of prevKeys) {
          if (!(key in next) || next[key] !== prev[key]) {
            changed = true;
            break;
          }
        }
        if (!changed) return prev;
      }
      return next;
    });
  }, [activeOverlayBCardInstances]);

  useEffect(() => {
    if (!selectedPlacedBCardId) return;
    if (!activeOverlayBCardInstances.some((item) => item.id === selectedPlacedBCardId)) {
      setSelectedPlacedBCardId(activeOverlayBCardInstances[0]?.id || null);
    }
  }, [activeOverlayBCardInstances, selectedPlacedBCardId]);

  useEffect(() => {
    if (topMode === "story") {
      setStoryRefsCollapsed(true);
      setStoryBCardTeachCollapsed(true);
    }
    if (topMode === "boost") {
      setBoostBCardTeachCollapsed(true);
    }
  }, [topMode]);

  const previousSlide =
    previousIndex !== null ? project?.data.slides[previousIndex] : null;
  const previousAsset = previousSlide
    ? (assetsById.get(previousSlide.assetId) ?? null)
    : null;
  const resolvedCurrentSrc =
    project && currentAsset ? toMediaUrl(currentAsset.relativePath) : null;

  // Sync staged transition controls when slide changes
  useEffect(() => {
    if (currentSlide) {
      setStagedTransition(currentSlide.transition);
      setStagedDuration(currentSlide.transitionDuration ?? 500);
      setStagedDirection(currentSlide.transitionDirection ?? "left");
    }
  }, [currentSlide]);

  const goToSlideByAbsoluteIndex = useCallback(
    (index: number) => {
      if (!project) return;
      if (index === currentIndex) return;
      const targetSlide = project?.data.slides[index];
      if (!targetSlide) return;

      const duration = targetSlide?.transitionDuration ?? 500;

      // Ensure the view switches if the target slide is in a different section
      // This fixes the bug where the stage gets "stuck" on a break section
      if (targetSlide.sectionId !== selectedSectionId) {
        setSelectedSectionId(targetSlide.sectionId);
        audioManager.stopSectionMusic();
      }

      setPreviousIndex(currentIndex);
      setCurrentIndex(index);
      audioManager.stopSlideAudio(); // Stop slide audio on slide change
      setIsAnimating(true);
      window.setTimeout(() => {
        setIsAnimating(false);
        setPreviousIndex(null);
      }, duration);
    },
    [project, currentIndex, selectedSectionId],
  );

  const goToNextSlide = () => {
    if (!project) return;
    if (selectedSection?.type === 'break') {
      const sections = project.data.sections;
      const currentIdx = sections.findIndex(s => s.id === selectedSection.id);
      for (let i = currentIdx + 1; i < sections.length; i++) {
        const firstSlide = sectionSlideIndices.get(sections[i].id)?.[0];
        if (firstSlide !== undefined) {
          goToSlideByAbsoluteIndex(firstSlide);
          return;
        }
      }
    } else if (currentIndex < project.data.slides.length - 1) {
      goToSlideByAbsoluteIndex(currentIndex + 1);
    }
  };

  const goToPrevSlide = () => {
    if (!project) return;
    if (selectedSection?.type === 'break') {
      const sections = project.data.sections;
      const currentIdx = sections.findIndex(s => s.id === selectedSection.id);
      for (let i = currentIdx - 1; i >= 0; i--) {
        const slides = sectionSlideIndices.get(sections[i].id);
        if (slides && slides.length > 0) {
          goToSlideByAbsoluteIndex(slides[slides.length - 1]);
          return;
        }
      }
    } else if (currentIndex > 0) {
      goToSlideByAbsoluteIndex(currentIndex - 1);
    }
  };

  const goToNextBreak = () => {
    if (!project) return;
    const currentSectionId = selectedSectionId || currentSlide?.sectionId;
    if (!currentSectionId) return;

    const sections = project.data.sections;
    const currentIdx = sections.findIndex((s) => s.id === currentSectionId);

    const nextBreak = sections
      .slice(currentIdx + 1)
      .find((s) => s.type === "break");
    if (nextBreak) {
      selectSection(nextBreak.id);
    }
  };

  const goToPrevBreak = () => {
    if (!project) return;
    const currentSectionId = selectedSectionId || currentSlide?.sectionId;
    if (!currentSectionId) return;

    const sections = project.data.sections;
    const currentIdx = sections.findIndex((s) => s.id === currentSectionId);

    const prevBreak = [...sections]
      .slice(0, currentIdx)
      .reverse()
      .find((s) => s.type === "break");
    if (prevBreak) {
      selectSection(prevBreak.id);
    }
  };

  const updateCurrentSlide = (updates: Partial<Slide>) => {
    if (!project || !currentSlide) return;
    const newSlides = project.data.slides.map((s, index) => {
      if (index === currentIndex) {
        return { ...s, ...updates };
      }
      return s;
    });
    setProject({ ...project, data: { ...project.data, slides: newSlides } });
    setIsDirty(true);
  };

  const applyTransitionToSlide = () => {
    if (!project || !currentSlide) return;
    updateCurrentSlide({
      transition: stagedTransition,
      transitionDuration: stagedDuration,
      transitionDirection: stagedDirection,
    });
    showToast("Applied", "success", 1000);
  };

  const applyTransitionToSection = () => {
    if (!project || !currentSlide) return;
    const { transition, transitionDuration, transitionDirection } = {
      transition: stagedTransition,
      transitionDuration: stagedDuration,
      transitionDirection: stagedDirection,
    };
    /* Removed confirm dialog as requested */

    const newSlides = project.data.slides.map((s) => {
      if (s.sectionId === currentSlide.sectionId) {
        return { ...s, transition, transitionDuration, transitionDirection };
      }
      return s;
    });
    setProject({ ...project, data: { ...project.data, slides: newSlides } });
    setIsDirty(true);
    showToast("Applied", "success", 1000);
  };

  const goToVisibleOffset = useCallback(
    (offset: number) => {
      const currentVisiblePos = visibleSlideIndices.indexOf(currentIndex);
      if (currentVisiblePos < 0) return;
      const target = visibleSlideIndices[currentVisiblePos + offset];
      if (target === undefined) return;
      goToSlideByAbsoluteIndex(target);
    },
    [visibleSlideIndices, currentIndex, goToSlideByAbsoluteIndex],
  );

  const updateSequenceItem = (itemId: string, updates: Partial<SequenceItem>) => {
    if (!project || !project.data.boostPack) return;
    const prop = (boostTab + 'Sequence') as 'activationSequence' | 'languageSequence' | 'gamesSequence';
    const seq = project.data.boostPack[prop] || [];
    const newSeq = seq.map(item => item.id === itemId ? { ...item, ...updates } as SequenceItem : item);
    setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack, [prop]: newSeq } } });
    setIsDirty(true);
  };

  const buildNewBCardInstance = (bCardId: string, existingCount: number): BCardInstance => ({
    id: crypto.randomUUID(),
    bCardId,
    position: { x: Math.min(86, 46 + (existingCount % 4) * 7), y: Math.min(82, 34 + Math.floor(existingCount / 4) * 9) },
    size: { width: 270, height: 390 },
    zIndex: existingCount + 1,
    displayMode: 'overlay',
  });

  const addSequenceItem = (type: 'slideRef' | 'breakRef' | 'promptCard' | 'miniGame' | 'aCardRef') => {
    if (!project || !project.data.boostPack) return;
    const prop = (boostTab + 'Sequence') as 'activationSequence' | 'languageSequence' | 'gamesSequence';
    const seq = project.data.boostPack[prop] || [];
    let newItem: SequenceItem;
    const id = `item-${Date.now()}`;
    if (type === 'slideRef') {
      newItem = { id, type, slideId: project.data.slides[0]?.id || '' } as SlideRefItem;
    } else if (type === 'breakRef') {
      newItem = { id, type, breakId: project.data.sections.find(s => s.type === 'break')?.id || '' } as BreakRefItem;
    } else if (type === 'promptCard') {
      newItem = { id, type, body: '' } as PromptCardItem;
    } else if (type === 'aCardRef') {
      newItem = { id, type, aCardId: Object.values(project.data.aCardLibrary || {})[0]?.id || '' } as any;
    } else {
      newItem = { id, type: 'miniGame', gameType: 'placeholder' } as MiniGameItem;
    }
    setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack, [prop]: [...seq, newItem] } } });
    setSelectedBoostItemId(id);
    setIsDirty(true);
  };

  const updateStoryReferences = (nextRefs: StoryReferenceItem[]) => {
    if (!project || !storyRefContext) return;
    const normalized = normalizeStoryRefs(nextRefs);

    if (storyRefContext.target === "slide") {
      setProject({
        ...project,
        data: {
          ...project.data,
          slides: project.data.slides.map((slide) =>
            slide.id === storyRefContext.id ? { ...slide, storyReferences: normalized } : slide,
          ),
        },
      });
    } else {
      setProject({
        ...project,
        data: {
          ...project.data,
          sections: project.data.sections.map((section) =>
            section.id === storyRefContext.id ? { ...section, storyReferences: normalized } : section,
          ),
        },
      });
    }
    setIsDirty(true);
  };

  const updateStoryBCardInstances = (nextInstances: BCardInstance[]) => {
    if (!project || !storyBCardHost) return;
    const normalized = normalizeBCardInstances(nextInstances);

    if (storyBCardHost.target === 'slide') {
      setProject({
        ...project,
        data: {
          ...project.data,
          slides: project.data.slides.map((slide) =>
            slide.id === storyBCardHost.id ? { ...slide, bCardInstances: normalized } : slide,
          ),
        },
      });
    } else {
      setProject({
        ...project,
        data: {
          ...project.data,
          sections: project.data.sections.map((section) =>
            section.id === storyBCardHost.id ? { ...section, bCardInstances: normalized } : section,
          ),
        },
      });
    }
    setIsDirty(true);
  };

  const updateBoostBCardInstances = (nextInstances: BCardInstance[]) => {
    if (!project || !project.data.boostPack || !activeItem) return;
    updateSequenceItem(activeItem.id, { bCardInstances: normalizeBCardInstances(nextInstances) } as Partial<SequenceItem>);
  };

  const addStoryReference = (type: "aCardRef" | "bCard") => {
    if (!(topMode === "story" && (appMode === "edit" || appMode === "teach"))) return;
    if (!project) return;

    if (type === "bCard") {
      if (!storyBCardHost) return;
      const defaultBCardId = Object.values(project.data.bCardLibrary || {})[0]?.id || "";
      if (!defaultBCardId) return;
      const newInstance = buildNewBCardInstance(defaultBCardId, storyBCardHost.instances.length);
      updateStoryBCardInstances([...(storyBCardHost.instances || []), newInstance]);
      setSelectedPlacedBCardId(newInstance.id);
      return;
    }

    if (!storyRefContext) return;

    const id = `story-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newRef: StoryReferenceItem =
      {
        id,
        type: "aCardRef",
        aCardId: Object.values(project.data.aCardLibrary || {})[0]?.id || "",
      };

    updateStoryReferences([...(storyRefContext.refs || []), newRef]);
    setSelectedStoryRefId(id);
  };

  const updateStoryReference = (refId: string, updates: Partial<StoryReferenceItem>) => {
    if (!storyRefContext) return;
    const next = (storyRefContext.refs || []).map((item) =>
      item.id === refId ? ({ ...item, ...updates } as StoryReferenceItem) : item,
    );
    updateStoryReferences(next);
  };

  const removeStoryReference = (refId: string) => {
    if (!(topMode === "story" && (appMode === "edit" || appMode === "teach"))) return;
    if (!storyRefContext) return;
    updateStoryReferences((storyRefContext.refs || []).filter((item) => item.id !== refId));
    if (selectedStoryRefId === refId) setSelectedStoryRefId(null);
  };

  const moveStoryReference = (refId: string, direction: "up" | "down") => {
    if (!(topMode === "story" && (appMode === "edit" || appMode === "teach"))) return;
    if (!storyRefContext) return;
    const refs = [...(storyRefContext.refs || [])];
    const index = refs.findIndex((item) => item.id === refId);
    if (index < 0) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === refs.length - 1) return;
    const swap = direction === "up" ? index - 1 : index + 1;
    [refs[index], refs[swap]] = [refs[swap], refs[index]];
    updateStoryReferences(refs);
  };

  const updatePlacedBCardInstance = (instanceId: string, updates: Partial<BCardInstance>) => {
    const source = topMode === 'story' ? storyBCardHost : boostBCardHost;
    if (!source) return;
    const next = source.instances.map((instance) =>
      instance.id === instanceId ? { ...instance, ...updates } : instance,
    );
    if (topMode === 'story') {
      updateStoryBCardInstances(next);
      return;
    }
    updateBoostBCardInstances(next);
  };

  const updateACardBCardInstance = (aCardId: string, instanceId: string, updates: Partial<BCardInstance>) => {
    if (!project) return;
    const aCard = (project.data.aCardLibrary || {})[aCardId];
    if (!aCard) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        aCardLibrary: {
          ...(project.data.aCardLibrary || {}),
          [aCardId]: {
            ...aCard,
            bCardInstances: aCard.bCardInstances.map((instance) =>
              instance.id === instanceId ? { ...instance, ...updates } : instance,
            ),
          },
        },
      },
    });
    setIsDirty(true);
  };

  const handlePlacedACardInstanceClick = (instanceId: string) => {
    setSelectedPlacedBCardId(instanceId);
    if (overlayBCardClickAction === "none") return;
    const mapping = {
      flip: "isFlipped",
      blur: "isBlurred",
      cover: "isCovered",
      zoom: "isZoomed",
    } as const;
    const property = mapping[overlayBCardClickAction];
    const current = overlayBCardTeachStates[instanceId] || DEFAULT_BCARD_TEACH_STATE;
    setOverlayBCardState(instanceId, {
      ...current,
      [property]: !current[property],
    });
  };

  const removePlacedBCardInstance = (instanceId: string) => {
    const source = topMode === 'story' ? storyBCardHost : boostBCardHost;
    if (!source) return;
    const next = source.instances.filter((instance) => instance.id !== instanceId);
    if (topMode === 'story') {
      updateStoryBCardInstances(next);
    } else {
      updateBoostBCardInstances(next);
    }
    if (selectedPlacedBCardId === instanceId) {
      setSelectedPlacedBCardId(next[0]?.id || null);
    }
  };

  const addBoostBCardInstance = () => {
    if (!project || !boostBCardHost) return;
    const defaultBCardId = Object.values(project.data.bCardLibrary || {})[0]?.id || "";
    if (!defaultBCardId) return;
    const newInstance = buildNewBCardInstance(defaultBCardId, boostBCardHost.instances.length);
    updateBoostBCardInstances([...(boostBCardHost.instances || []), newInstance]);
    setSelectedPlacedBCardId(newInstance.id);
  };

  const renderTagEditor = (slide: Slide | null) => {
    if (!slide || !project) return null;
    return (
      <div style={{ marginBottom: 16, borderBottom: '1px solid #333', paddingBottom: 16 }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#66f", fontSize: "0.9rem" }}>Tags</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {(slide.tags || []).map((tag, idx) => (
            <span key={idx} style={{ background: '#333', padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              {tag}
              <button onClick={() => {
                const newTags = slide.tags!.filter((_, i) => i !== idx);
                const newSlides = project.data.slides.map(s => s.id === slide.id ? { ...s, tags: newTags } : s);
                setProject({ ...project, data: { ...project.data, slides: newSlides } });
                setIsDirty(true);
              }} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}>X</button>
            </span>
          ))}
          {!(slide.tags || []).length && <span style={{ color: '#666', fontSize: '0.8rem' }}>No tags</span>}
        </div>
        <input
          type="text"
          placeholder="Add tag and press Enter"
          style={{ width: '100%', boxSizing: 'border-box', background: '#222', color: '#fff', border: '1px solid #444', padding: '6px', borderRadius: 4, fontSize: '0.8rem', outline: 'none' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = e.currentTarget.value.trim();
              if (val && !(slide.tags || []).includes(val)) {
                const newTags = [...(slide.tags || []), val];
                const newSlides = project.data.slides.map(s => s.id === slide.id ? { ...s, tags: newTags } : s);
                setProject({ ...project, data: { ...project.data, slides: newSlides } });
                setIsDirty(true);
                e.currentTarget.value = '';
              }
            }
          }}
        />
      </div>
    );
  };

  const selectSection = useCallback(
    (sectionId: string) => {
      setSelectedSectionId((prevSectionId) => {
        if (prevSectionId === sectionId) return prevSectionId; // same section: keep music playing
        audioManager.stopSectionMusic(); // only when section actually changes
        return sectionId;
      });

      const firstInSection = sectionSlideIndices.get(sectionId)?.[0];
      if (firstInSection !== undefined) {
        setCurrentIndex(firstInSection);
      }
    },
    [sectionSlideIndices],
  );

  const toggleMode = useCallback(() => {
    setAppMode((prev) => {
      const next = prev === "edit" ? "teach" : "edit";
      console.log(`MODE: ${next}`);
      if (next === "teach") {
        showToast("Teach Mode", "teach", 1200);
      } else {
        showToast("Edit Mode", "edit", 1200);
      }
      return next;
    });
  }, [showToast]);

  useEffect(() => {
    const unsub = audioManager.subscribe(() => {
      setUpdateAudio((v) => v + 1);
    });
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "m" || e.key === "M")
      ) {
        e.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [toggleMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (appMode === "edit" && (e.key === "Delete" || e.key === "Backspace")) {
        if (activeOverlayId && project) {
          const cSlide = project.data.slides[currentIndex];
          if (cSlide) {
            const nextOverlays = (cSlide.overlays || []).filter((o) => o.id !== activeOverlayId);
            setProject({
              ...project,
              data: {
                ...project.data,
                slides: project.data.slides.map((s) => (s.id === cSlide.id ? { ...s, overlays: nextOverlays } : s)),
              },
            });
            setActiveOverlayId(null);
            setIsDirty(true);
            return;
          }
        }
      }

      if (e.code === "NumpadAdd" || e.code === "NumpadSubtract") {
        const bgms = selectedSection?.bgm;
        if (!bgms || bgms.length === 0) return;

        e.preventDefault();

        const delta = e.code === "NumpadAdd" ? 0.05 : -0.05;
        const first = bgms[0];
        const current = first.volume ?? 1;
        const next = Math.max(0, Math.min(1, Number((current + delta).toFixed(2))));
        if (next === current) return;

        updateSection(selectedSection.id, {
          bgm: bgms.map((b, i) => (i === 0 ? { ...b, volume: next } : b)),
        });

        audioManager.setVolume(first.url, next);
        return;
      }

      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        goToVisibleOffset(1);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        goToVisibleOffset(-1);
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedSectionId) setExpandedSectionId(selectedSectionId);
      } else if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedSectionId && expandedSectionId === selectedSectionId) {
          setExpandedSectionId(null);
        }
      } else {
        const digitMatch = /^Digit([1-9])$/.exec(e.code); // top row only
        if (digitMatch) {
          if (!project) return;
          const num = Number(digitMatch[1]);
          const sections = project.data.sections.filter((s) => s.type !== "break");
          const section = sections[num - 1];
          if (section) {
            selectSection(section.id);
          }
        } else if (e.key.startsWith("F")) {
          const fNum = parseInt(e.key.substring(1));
          if (!isNaN(fNum) && fNum >= 1 && fNum <= 9) {
            e.preventDefault(); // Prevent default browser actions for F-keys
            if (!project) return;
            const breaks = project.data.sections.filter(
              (s) => s.type === "break",
            );
            const section = breaks[fNum - 1];
            if (section) {
              selectSection(section.id);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goToVisibleOffset,
    project,
    appMode,
    selectSection,
    selectedSectionId,
    expandedSectionId,
    activeOverlayId,
    currentIndex,
  ]);

  const setProjectState = (
    next: ProjectState | null,
    restoreSnapshot?: LiveSessionSnapshot | null,
  ) => {
    if (!next) {
      setProject(null);
      setSelectedSectionId(null);
      setCurrentIndex(0);
      setPreviousIndex(null);
      setError(null);
      setExpandedSectionId(null);
      setSelectedSlideIds(new Set());
      setSelectedStoryRefId(null);
      setOverlayBCardTeachStates({});
      setOverlayBCardClickAction("none");
      setBadgeVisibleState(false);
      setFinalScoreRevealedState(false);
      setDrawPanelCollapsed(true);
      setDrawSettings({ ...DEFAULT_DRAW_SETTINGS });
      return;
    }

    const normalized = ensureSections(next);
    const { data: sanitizedData } = sanitizeProjectCardReferences(
      normalized.data,
      new Set(Object.keys(normalized.data.aCardLibrary || {})),
      new Set(Object.keys(normalized.data.bCardLibrary || {})),
    );
    let normalizedWithRefs = {
      ...normalized,
      data: withCanonicalAssetDefaults(sanitizedData),
    };
    const matchesRestore =
      !!restoreSnapshot &&
      (restoreSnapshot.projectFolderPath === normalizedWithRefs.folderPath ||
        restoreSnapshot.projectCreatedAt === normalizedWithRefs.data.createdAt);

    if (matchesRestore && restoreSnapshot) {
      normalizedWithRefs = {
        ...normalizedWithRefs,
        data: {
          ...normalizedWithRefs.data,
          sparkStudents: restoreSnapshot.sparkStudents,
          activeStudentId: restoreSnapshot.activeStudentId || normalizedWithRefs.data.activeStudentId,
        },
      };
    }
    setProject(normalizedWithRefs);
    const fallbackSectionId = normalizedWithRefs.data.sections[0]?.id ?? null;
    const restoredSectionId =
      matchesRestore && restoreSnapshot?.selectedSectionId &&
      normalizedWithRefs.data.sections.some((s) => s.id === restoreSnapshot.selectedSectionId)
        ? restoreSnapshot.selectedSectionId
        : fallbackSectionId;
    setSelectedSectionId(restoredSectionId);
    setExpandedSectionId(restoredSectionId);
    const restoredIndex =
      matchesRestore && restoreSnapshot
        ? Math.min(
            Math.max(0, restoreSnapshot.currentIndex || 0),
            Math.max(0, normalizedWithRefs.data.slides.length - 1),
          )
        : 0;
    const restoredSlideId = normalizedWithRefs.data.slides[restoredIndex]?.id;
    setSelectedSlideIds(restoredSlideId ? new Set([restoredSlideId]) : new Set());
    setCurrentIndex(restoredIndex);
    setPreviousIndex(null);
    setError(null);
    setError(null);
    setSelectedStoryRefId(
      matchesRestore ? (restoreSnapshot?.selectedStoryRefId || null) : null,
    );
    setOverlayBCardTeachStates({});
    setOverlayBCardClickAction(
      matchesRestore ? (restoreSnapshot?.overlayBCardClickAction || "flip") : "flip",
    );
    setBadgeVisibleState(matchesRestore ? Boolean(restoreSnapshot?.badgeVisible) : false);
    setFinalScoreRevealedState(matchesRestore ? Boolean(restoreSnapshot?.finalScoreRevealed) : false);
    setDrawPanelCollapsed(true);
    setDrawSettings({ ...DEFAULT_DRAW_SETTINGS });
    setTopMode(matchesRestore ? (restoreSnapshot?.topMode || "story") : "story");
    setBoostTab(matchesRestore ? (restoreSnapshot?.boostTab || "activation") : "activation");
    setSelectedBoostItemId(matchesRestore ? (restoreSnapshot?.selectedBoostItemId || null) : null);
    setSelectedACardId(matchesRestore ? (restoreSnapshot?.selectedACardId || null) : null);
    setAppMode(matchesRestore ? (restoreSnapshot?.appMode || "teach") : "teach");
    setIsDirty(matchesRestore);
  };

  const executePendingAction = async (action: "create" | "open" | "close") => {
    if (action === "close") {
      window.appApi.forceClose();
      return;
    }

    try {
      let next;
      if (action === "create") {
        next = await window.appApi.createProject();
      } else {
        next = await window.appApi.openProject();
      }
      if (next) {
        setProjectState(next, pendingRestoreSession);
        setPendingRestoreSession(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    const didSave = await performSave("save");
    if (!didSave) return;
    if (pendingAction) {
      executePendingAction(pendingAction);
      setPendingAction(null);
    }
  };

  const handleConfirmDiscard = () => {
    setShowConfirmModal(false);
    if (pendingAction) {
      executePendingAction(pendingAction);
      setPendingAction(null);
    }
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingAction(null);
  };

  const onCreateProject = () => {
    if (isDirty) {
      setPendingAction("create");
      setShowConfirmModal(true);
    } else {
      executePendingAction("create");
    }
  };

  const onOpenProject = () => {
    if (isDirty) {
      setPendingAction("open");
      setShowConfirmModal(true);
    } else {
      executePendingAction("open");
    }
  };

  useEffect(() => {
    if (!breakThumbDrag) return;
    const onMove = (event: globalThis.MouseEvent) => {
      const dx = event.clientX - breakThumbDrag.startClientX;
      const dy = event.clientY - breakThumbDrag.startClientY;
      if (breakThumbDrag.mode === "move") {
        updateBreakMediaItem(breakThumbDrag.sectionId, breakThumbDrag.mediaId, {
          x: breakThumbDrag.startX + dx,
          y: breakThumbDrag.startY + dy,
        });
      } else {
        const nextScale = Math.max(
          0.1,
          Math.min(4, breakThumbDrag.startScale + dx / 200),
        );
        updateBreakMediaItem(breakThumbDrag.sectionId, breakThumbDrag.mediaId, {
          scale: nextScale,
        });
      }
    };
    const onUp = () => setBreakThumbDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [breakThumbDrag]);

  const onStartFreshSession = () => {
    window.localStorage.removeItem(LIVE_SESSION_STORAGE_KEY);
    setSavedLiveSession(null);
    setPendingRestoreSession(null);
    setShowRestoreSessionPrompt(false);
    setBadgeVisibleState(false);
    setFinalScoreRevealedState(false);
  };

  const onRestoreSession = async () => {
    if (!savedLiveSession) return;
    setPendingRestoreSession(savedLiveSession);
    setShowRestoreSessionPrompt(false);
    try {
      const next = await window.appApi.openProjectByPath(savedLiveSession.projectFolderPath);
      if (!next) return;
      setProjectState(next, savedLiveSession);
      setPendingRestoreSession(null);
      showToast("Session restored", "success", 1500);
    } catch (err) {
      setError((err as Error).message);
      showToast("Open the project manually to restore session", "edit", 2000);
    }
  };

  const createLiveSessionSnapshot = (): LiveSessionSnapshot | null => {
    if (!project) return null;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      projectFolderPath: project.folderPath,
      projectCreatedAt: project.data.createdAt,
      appMode,
      topMode,
      boostTab,
      currentIndex,
      selectedSectionId,
      selectedBoostItemId,
      selectedStoryRefId,
      selectedACardId,
      overlayBCardClickAction,
      sparkStudents: project.data.sparkStudents || [],
      activeStudentId: project.data.activeStudentId || null,
      badgeVisible: badgeVisibleState,
      finalScoreRevealed: finalScoreRevealedState,
    };
  };

  const persistLiveSessionSnapshot = () => {
    const snapshot = createLiveSessionSnapshot();
    if (!snapshot) return null;
    window.localStorage.setItem(LIVE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  };

  useEffect(() => {
    if (!savedLiveSession) return;
    if (window.localStorage.getItem(LIVE_SESSION_AUTO_RESTORE_KEY) !== "1") return;
    window.localStorage.removeItem(LIVE_SESSION_AUTO_RESTORE_KEY);
    void onRestoreSession();
  }, [savedLiveSession]);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      persistLiveSessionSnapshot();
    }, LIVE_SESSION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    project?.folderPath,
    project?.data.createdAt,
    project?.data.sparkStudents,
    project?.data.activeStudentId,
    appMode,
    topMode,
    boostTab,
    currentIndex,
    selectedSectionId,
    selectedBoostItemId,
    selectedStoryRefId,
    selectedACardId,
    overlayBCardClickAction,
    badgeVisibleState,
    finalScoreRevealedState,
  ]);

  const applyImportedMedia = (result: ImportResult, targetSectionId: string | null | undefined) => {
    if (!project || result.importedAssets.length === 0 || result.createdSlides.length === 0) return;

    const nextData = applyMediaImportToProjectData(project.data, result, targetSectionId);
    setProject({
      ...project,
      data: nextData,
    });
    setIsDirty(true);

    if (nextData.slides.length > 0 && project.data.slides.length === 0) {
      setCurrentIndex(0);
    }
  };

  const onImportMedia = async () => {
    if (!ensureEditMode(appMode, "import media")) return;
    if (!project) return;
    try {
      const result = await window.appApi.importMedia();
      if (!result) return;
      applyImportedMedia(result, selectedSectionId ?? project.data.sections[0]?.id);
    } catch (err) {
      console.error(err);
      alert("Failed to import media: " + (err as Error).message);
      setError((err as Error).message);
    }
  };

  const getDroppedFilePaths = (event: DragEvent<HTMLDivElement>) => {
    const preloadPaths = window.appApi.getPendingDroppedFilePaths();
    if (preloadPaths.length > 0) return preloadPaths;

    return Array.from(event.dataTransfer.files)
      .map((file) => window.appApi.getPathForFile(file))
      .filter((path): path is string => typeof path === "string" && path.length > 0);
  };

  const handleAppDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    if (!project || appMode !== "edit") return;
    dragImportDepthRef.current += 1;
    setIsDragImportActive(true);
  };

  const handleAppDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    if (!project || appMode !== "edit") {
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.dataTransfer.dropEffect = "copy";
    setIsDragImportActive(true);
  };

  const handleAppDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    dragImportDepthRef.current = Math.max(0, dragImportDepthRef.current - 1);
    if (dragImportDepthRef.current === 0) {
      setIsDragImportActive(false);
    }
  };

  const handleAppDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    dragImportDepthRef.current = 0;
    setIsDragImportActive(false);
    if (!project || appMode !== "edit") return;

    const filePaths = getDroppedFilePaths(event);
    if (filePaths.length === 0) {
      showToast("No readable media files found in that drop", "edit", 2200);
      return;
    }

    try {
      const result = await window.appApi.importDroppedMedia(filePaths);
      if (!result) {
        showToast("No supported image or video files found in that drop", "edit", 2200);
        return;
      }
      applyImportedMedia(result, selectedSectionId ?? project.data.sections[0]?.id);
      showToast(`Imported ${result.importedAssets.length} dropped file${result.importedAssets.length === 1 ? "" : "s"}`, "success");
    } catch (err) {
      console.error(err);
      alert("Failed to import dropped media: " + (err as Error).message);
      setError((err as Error).message);
    }
  };

  const onImportAudio = async (type: "dialogue" | "sfx" | "bgm" | "section-bgm") => {
    if (!ensureEditMode(appMode, "import audio")) return;
    if (!project) return;
    try {
      const importedAssets = await window.appApi.importAudio();
      if (!importedAssets || importedAssets.length === 0) return;

      const normalizedImportedAssets = decorateImportedAssetsForContext(project.data, importedAssets);
      const nextAssets = [...project.data.assets, ...normalizedImportedAssets];
      let nextData = { ...project.data, assets: nextAssets };

      if (type === "section-bgm" && selectedSectionId) {
        const clips = normalizedImportedAssets.map((a) => ({
          url: toMediaUrl(a.relativePath),
          volume: 1,
          name: getAssetDescription(a),
        }));

        nextData.sections = nextData.sections.map((s) =>
          s.id === selectedSectionId
            ? {
              ...s,
              bgm: [
                ...(Array.isArray(s.bgm) ? s.bgm : (s.bgm ? [s.bgm] : [])),
                ...clips,
              ],
            }
            : s,
        );
      } else if (currentSlide) {
        const clips = normalizedImportedAssets.map((a) => ({
          url: toMediaUrl(a.relativePath),
          volume: 1,
          name: getAssetDescription(a),
        }));
        nextData.slides = nextData.slides.map((s) => {
          if (s.id !== currentSlide.id) return s;
          const updated = { ...s };
          if (type === "dialogue") {
            updated.dialogue = [...(updated.dialogue || []), ...clips];
          } else if (type === "sfx") {
            updated.sfx = [...(updated.sfx || []), ...clips];
          } else if (type === "bgm") {
            updated.bgm = clips[0];
          }
          return updated;
        });
      }

      setProject({ ...project, data: nextData });
      setIsDirty(true);
    } catch (err) {
      console.error(err);
      alert("Failed to import audio (Did you restart the Dev Server?): " + (err as Error).message);
      setError((err as Error).message);
    }
  };

  const onImportBubbleTemplate = async () => {
    if (!ensureEditMode(appMode, "import bubble template")) return;
    if (!project) return;
    try {
      const result = await (window as any).api.importBubbleTemplate() as { success: boolean; relativePath: string };
      if (!result || !result.success || !result.relativePath) return;

      const filename = result.relativePath.split('/').pop() || '';
      const templateName = filename.replace(/\.png$/i, '');

      const newTemplate: BubbleTemplate = {
        templateName,
        imageSrc: result.relativePath,
        defaultTextRect: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      };

      const nextData = {
        ...project.data,
        bubbleDefinitions: [...(project.data.bubbleDefinitions || []), newTemplate],
      };

      setProject({ ...project, data: nextData });
      setIsDirty(true);

      // Persist as requested
      await window.appApi.saveProject(nextData);
      setIsDirty(false);
      showToast("Bubble template imported and project saved", "success");
    } catch (err) {
      console.error(err);
      alert("Failed to import bubble template: " + (err as Error).message);
    }
  };

  const performSave = async (mode: "save" | "saveAs") => {
    if (!ensureEditMode(appMode, "save")) return;
    if (!project) return;
    try {
      setIsSaveInProgress(true);
      const response = await window.appApi.saveProject(project.data, mode);
      if (!response) return;
      setProject({
        ...project,
        folderPath: response.folderPath,
        data: {
          ...project.data,
          updatedAt: response.lastSavedAt,
        },
        lastSavedAt: response.lastSavedAt,
      });
      setIsDirty(false);
      showToast(mode === "saveAs" ? "Saved as new project" : "Saved", "success", 2000);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setIsSaveInProgress(false);
    }
  };

  const onSave = () => {
    if (!ensureEditMode(appMode, "save")) return;
    if (!project) return;
    setShowSaveChoiceModal(true);
  };

  const onRefreshApp = async () => {
    if (!ensureEditMode(appMode, "refresh app")) return;
    if (!project) return;
    setContextMenu(null);
    setPendingSectionDeleteId(null);
    persistLiveSessionSnapshot();
    window.localStorage.setItem(LIVE_SESSION_AUTO_RESTORE_KEY, "1");
    if (isDirty) {
      const didSave = await performSave("save");
      if (!didSave) {
        showToast("Could not save before refresh", "edit", 2200);
        return;
      }
      persistLiveSessionSnapshot();
    }
    if (window.appApi.reloadApp) {
      window.appApi.reloadApp();
    } else {
      window.location.reload();
    }
  };

  const updateTransition = (transition: TransitionType) => {
    if (!project || !currentSlide) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((slide) =>
          slide.id === currentSlide.id ? { ...slide, transition } : slide,
        ),
      },
    });
    setIsDirty(true);
  };

  const updateSection = (sectionId: string, updates: Partial<Section>) => {
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: updateSectionInProjectData(prev.data, sectionId, updates),
      };
    });
    setIsDirty(true);
  };

  const updateBreakMediaItem = (
    sectionId: string,
    mediaId: string,
    updates: Partial<{ x: number; y: number; scale: number }>,
  ) => {
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          sections: prev.data.sections.map((section) => {
            if (section.id !== sectionId) return section;
            const breakMedia = (section.breakMedia || []).map((item) =>
              item.id === mediaId ? { ...item, ...updates } : item,
            );
            return { ...section, breakMedia };
          }),
        },
      };
    });
    setIsDirty(true);
  };

  const updateSlide = (slideId: string, updates: Partial<Slide>) => {
    if (!project) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((slide) =>
          slide.id === slideId ? { ...slide, ...updates } : slide,
        ),
      },
    });
    setIsDirty(true);
  };

  const commitSlideName = (slideId: string, rawName: string) => {
    const slide = project?.data.slides.find((s) => s.id === slideId);
    const asset = slide ? assetsById.get(slide.assetId) : undefined;
    const trimmed = stripReferencePrefix(rawName, asset?.referenceCode).trim();
    updateSlide(slideId, { name: trimmed || undefined });
    setRenamingSlideId(null);
  };

  const onAddSection = () => {
    if (!ensureEditMode(appMode, "add section")) return;
    const count = (project?.data.sections || []).filter(
      (s) => s.type !== "break",
    ).length;
    const nextSection: Section = {
      id: crypto.randomUUID(),
      name: `Section ${count + 1}`,
      type: "section",
    };
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          sections: [...prev.data.sections, nextSection],
        },
      };
    });
    setSelectedSectionId(nextSection.id);
    setExpandedSectionId(nextSection.id);
    setIsDirty(true);
  };

  const onAddBreak = () => {
    if (!ensureEditMode(appMode, "add break")) return;
    const count = (project?.data.sections || []).filter(
      (s) => s.type === "break",
    ).length;
    const nextBreak: Section = {
      id: crypto.randomUUID(),
      name: `Question Time ${count + 1}`,
      type: "break",
      questions: "",
      breakMedia: [],
      background: "#2a2a3a",
      font: "Inter",
      fontSize: 28,
      align: "center",
      position: "center",
    };
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          sections: [...prev.data.sections, nextBreak],
        },
      };
    });
    setSelectedSectionId(nextBreak.id);
    setExpandedSectionId(nextBreak.id);
    setIsDirty(true);
  };

  const getNextBubbleId = () => {
    if (!project) return "B0001";
    let max = 0;
    project.data.slides.forEach(s => {
      (s.overlays || []).forEach(o => {
        if (o.bubbleId?.startsWith('B')) {
          const num = parseInt(o.bubbleId.substring(1), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      });
    });
    return `B${(max + 1).toString().padStart(4, '0')}`;
  };

  const onAddBubble = () => {
    if (!ensureEditMode(appMode, "add bubble")) return;
    if (!project || !currentSlide) return;

    const classicDef = BUBBLE_LIBRARY.find((b) => b.bubbleDefId === "BD_CLASSIC") || BUBBLE_LIBRARY[0];
    const newBubble: OverlayItem = {
      id: crypto.randomUUID(),
      type: "speechBubble",
      text: "New Bubble text...",
      x: 100,
      y: 100,
      width: 300,
      height: 150,
      align: "center",
      theme: "light",
      visible: true,
      zIndex: 5,
      bubbleDefId: classicDef?.bubbleDefId ?? "BD_CLASSIC",
      bubbleId: getNextBubbleId(),
      fontSize: 24,
      fontFamily: "sans-serif",
      fontWeight: "400",
      fontStyle: "normal",
      textColor: "#000000",
      tailAngleDeg: 135,
    };

    const nextSlide: Slide = {
      ...currentSlide,
      overlays: [...(currentSlide.overlays || []), newBubble],
    };

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((s) => (s.id === currentSlide.id ? nextSlide : s)),
      },
    });
    setIsDirty(true);
  };

  const onDuplicateBubble = (ov: OverlayItem) => {
    if (!ensureEditMode(appMode, "duplicate bubble")) return;
    if (!project || !currentSlide) return;

    const newBubble: OverlayItem = {
      ...ov,
      id: crypto.randomUUID(),
      bubbleId: getNextBubbleId(),
      x: (ov.x || 0) + 20,
      y: (ov.y || 0) + 20,
    };

    const nextSlide: Slide = {
      ...currentSlide,
      overlays: [...(currentSlide.overlays || []), newBubble],
    };

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((s) => (s.id === currentSlide.id ? nextSlide : s)),
      },
    });
    setIsDirty(true);
    setActiveOverlayId(newBubble.id);
  };

  const onCopyBubbleToSlide = (ov: OverlayItem, targetSlideId: string) => {
    if (!ensureEditMode(appMode, "copy bubble")) return;
    if (!project) return;

    const targetIndex = project.data.slides.findIndex(s => s.id === targetSlideId);
    if (targetIndex === -1) return;

    const newBubble: OverlayItem = {
      ...ov,
      id: crypto.randomUUID(),
      bubbleId: getNextBubbleId(),
    };

    const nextSlides = project.data.slides.map(s => {
      if (s.id === targetSlideId) {
        return { ...s, overlays: [...(s.overlays || []), newBubble] };
      }
      return s;
    });

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: nextSlides,
      },
    });
    setIsDirty(true);
    showToast(`Copied ${newBubble.bubbleId} to slide ${targetIndex + 1}`, "success");
  };

  const openCopyBubblePicker = (ov: OverlayItem) => {
    if (!ensureEditMode(appMode, "copy bubble")) return;
    setActiveOverlayId(ov.id);
    setCopyBubbleOverlayId(ov.id);
    setCopyBubbleTargetIds([]);
  };

  const toggleCopyBubbleTarget = (slideId: string) => {
    setCopyBubbleTargetIds((prev) =>
      prev.includes(slideId)
        ? prev.filter((id) => id !== slideId)
        : [...prev, slideId],
    );
  };

  const confirmCopyBubbleToSlides = () => {
    if (!ensureEditMode(appMode, "copy bubble")) return;
    if (!project || !copyBubbleOverlayId || copyBubbleTargetIds.length === 0) return;

    const sourceBubble = project.data.slides
      .flatMap((slide) => slide.overlays || [])
      .find((overlay) => overlay.id === copyBubbleOverlayId);
    if (!sourceBubble) return;

    let maxBubbleNumber = 0;
    project.data.slides.forEach((slide) => {
      (slide.overlays || []).forEach((overlay) => {
        if (overlay.bubbleId?.startsWith("B")) {
          const num = parseInt(overlay.bubbleId.substring(1), 10);
          if (!isNaN(num)) maxBubbleNumber = Math.max(maxBubbleNumber, num);
        }
      });
    });

    const targetIdSet = new Set(copyBubbleTargetIds);
    const nextSlides = project.data.slides.map((slide) => {
      if (!targetIdSet.has(slide.id)) return slide;
      maxBubbleNumber += 1;
      const copiedBubble: OverlayItem = {
        ...sourceBubble,
        id: crypto.randomUUID(),
        bubbleId: `B${maxBubbleNumber.toString().padStart(4, "0")}`,
      };
      return { ...slide, overlays: [...(slide.overlays || []), copiedBubble] };
    });

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: nextSlides,
      },
    });
    setIsDirty(true);
    showToast(`Copied ${sourceBubble.bubbleId || "bubble"} to ${copyBubbleTargetIds.length} slide${copyBubbleTargetIds.length === 1 ? "" : "s"}`, "success");
    setCopyBubbleOverlayId(null);
    setCopyBubbleTargetIds([]);
  };

  const onDeleteSlide = (slideId: string) => {
    if (!ensureEditMode(appMode, "delete slide")) return;
    if (!project) return;

    const indexToDelete = project.data.slides.findIndex(s => s.id === slideId);
    if (indexToDelete === -1) return;

    const nextSlides = project.data.slides.filter(s => s.id !== slideId);

    // CLEAN UP references
    let newBoostPack = project.data.boostPack;
    if (newBoostPack) {
      const cleanSeq = (seq: SequenceItem[]) => (seq || []).filter(item => {
        if (item.type === 'slideRef') return (item as SlideRefItem).slideId !== slideId;
        return true;
      });
      newBoostPack = {
        activationSequence: cleanSeq(newBoostPack.activationSequence),
        languageSequence: cleanSeq(newBoostPack.languageSequence),
        gamesSequence: cleanSeq(newBoostPack.gamesSequence),
      };
    }

    const nextSections = project.data.sections.map(s => {
      if (s.breakMedia) {
        return {
          ...s,
          breakMedia: s.breakMedia.filter(bm => bm.slideId !== slideId)
        };
      }
      return s;
    });

    // Selection fallback
    if (currentIndex === indexToDelete) {
      const nextIdx = Math.max(0, indexToDelete - 1);
      setCurrentIndex(nextIdx);
    } else if (currentIndex > indexToDelete) {
      setCurrentIndex(currentIndex - 1);
    }

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: nextSlides,
        sections: nextSections,
        boostPack: newBoostPack,
      }
    });
    setIsDirty(true);
  };

  const onDeleteBubbleTemplate = (templateName: string) => {
    if (!ensureEditMode(appMode, "delete template")) return;
    if (!project) return;

    const nextData = {
      ...project.data,
      bubbleDefinitions: (project.data.bubbleDefinitions || []).filter(bt => bt.templateName !== templateName)
    };

    setProject({ ...project, data: nextData });
    setIsDirty(true);
  };

  const currentVisiblePos = visibleSlideIndices.indexOf(currentIndex);

  const renumberSectionAssetReferences = (data: ProjectData, sectionId: string): ProjectData => {
    const section = data.sections.find((item) => item.id === sectionId);
    if (!section || section.type === "break") return data;

    let sectionOrdinal = 0;
    for (const item of data.sections) {
      if (item.type === "break") continue;
      sectionOrdinal += 1;
      if (item.id === sectionId) break;
    }

    const assetOrdinalById = new Map<string, number>();
    let ordinal = 0;
    for (const slide of data.slides) {
      if (slide.sectionId !== sectionId) continue;
      if (assetOrdinalById.has(slide.assetId)) continue;
      ordinal += 1;
      assetOrdinalById.set(slide.assetId, ordinal);
    }
    if (!assetOrdinalById.size) return data;

    let changed = false;
    const nextAssets = data.assets.map((asset) => {
      const nextOrdinal = assetOrdinalById.get(asset.id);
      if (!nextOrdinal) return asset;
      const referenceCode = `${sectionOrdinal}.${nextOrdinal}`;
      const referenceDescription = getAssetDescription(asset);
      const canonicalLabel = `${referenceCode} ${referenceDescription}`.trim();

      if (
        asset.referenceCode === referenceCode &&
        asset.referenceOrdinal === nextOrdinal &&
        asset.referenceContext === "section" &&
        asset.referenceContextId === sectionId &&
        asset.referenceDescription === referenceDescription &&
        asset.canonicalLabel === canonicalLabel
      ) {
        return asset;
      }

      changed = true;
      return {
        ...asset,
        referenceCode,
        referenceDescription,
        canonicalLabel,
        referenceContext: "section" as const,
        referenceContextId: sectionId,
        referenceOrdinal: nextOrdinal,
      };
    });

    return changed ? { ...data, assets: nextAssets } : data;
  };

  const reorderSlidesWithinSection = (fromIndex: number, insertIndex: number) => {
    if (!ensureEditMode(appMode, "reorder slides")) return;
    if (!project) return;
    if (fromIndex === insertIndex || fromIndex + 1 === insertIndex) return;

    const fromSlide = project.data.slides[fromIndex];
    if (!fromSlide) {
      setDraggedSlideIndex(null);
      setDragInsertIndex(null);
      return;
    }

    const sectionIndices = sectionSlideIndices.get(fromSlide.sectionId) ?? [];
    if (!sectionIndices.length) return;
    const firstIndex = sectionIndices[0];
    const lastIndex = sectionIndices[sectionIndices.length - 1];
    if (insertIndex < firstIndex || insertIndex > lastIndex + 1) {
      setDraggedSlideIndex(null);
      setDragInsertIndex(null);
      return;
    }

    const nextSlides = [...project.data.slides];
    const [movedSlide] = nextSlides.splice(fromIndex, 1);
    const insertAt = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
    nextSlides.splice(insertAt, 0, movedSlide);

    let nextData: ProjectData = {
      ...project.data,
      slides: nextSlides,
    };
    nextData = renumberSectionAssetReferences(nextData, movedSlide.sectionId);

    setProject({
      ...project,
      data: nextData,
    });
    setIsDirty(true);
    setCurrentIndex(insertAt);
    setPreviousIndex(null);
    setDraggedSlideIndex(null);
    setDragInsertIndex(null);
  };

  const deleteSection = (sectionId: string) => {
    if (!ensureEditMode(appMode, "delete section")) return;
    if (!project) return;

    setPendingSectionDeleteId(sectionId);
  };

  const confirmDeleteSection = () => {
    if (!ensureEditMode(appMode, "delete section")) return;
    if (!project || !pendingSectionDeleteId) return;

    const sectionId = pendingSectionDeleteId;
    const sectionIndex = project.data.sections.findIndex(
      (s) => s.id === sectionId,
    );
    if (sectionIndex === -1) {
      setPendingSectionDeleteId(null);
      return;
    }

    const previewDeletion = deleteSectionInProjectData(project.data, sectionId);
    if (!previewDeletion) {
      setPendingSectionDeleteId(null);
      return;
    }
    const currentSlideId = project.data.slides[currentIndex]?.id;

    setPendingSectionDeleteId(null);
    setContextMenu(null);
    setRenamingSectionId(null);
    setRenamingSlideId(null);
    setActiveOverlayId(null);
    setSelectedSlideIds(new Set());
    setDraggedSlideIndex(null);
    setDragInsertIndex(null);
    setBreakEditorDraft(null);
    setShowBreakEditor(false);
    setDrawSettings((prev) => ({ ...prev, drawMode: false }));
    dragImportDepthRef.current = 0;
    setIsDragImportActive(false);

    setProject((prev) => {
      if (!prev) return prev;
      const result = deleteSectionInProjectData(prev.data, sectionId);
      if (!result) return prev;
      return {
        ...prev,
        data: result.data,
      };
    });
    setIsDirty(true);

    const newSlides = previewDeletion.data.slides;
    const newSections = previewDeletion.data.sections;

    if (selectedSectionId === sectionId) {
      // Fallback selection to nearest neighbor or null if none left
      const fallbackId = newSections[Math.max(0, previewDeletion.deletedSectionIndex - 1)]?.id ?? newSections[0]?.id;

      setSelectedSectionId(fallbackId ?? null);

      // Reset or update currentIndex based on new slides
      if (fallbackId) {
        // Find the first slide in newSlides that belongs to the fallback section
        const firstInFallback = newSlides.findIndex(s => s.sectionId === fallbackId);
        setCurrentIndex(firstInFallback !== -1 ? firstInFallback : 0);
      } else {
        setCurrentIndex(0);
      }
    } else {
      // Current slide should still exist, find its new index in the merged slide array
      if (currentSlideId) {
        const newIdx = newSlides.findIndex(s => s.id === currentSlideId);
        if (newIdx !== -1) {
          setCurrentIndex(newIdx);
        } else {
          setCurrentIndex(0);
        }
      }
    }

    if (expandedSectionId === sectionId) {
      setExpandedSectionId(null);
    }
  };

  const cancelDeleteSection = () => {
    setPendingSectionDeleteId(null);
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    if (!ensureEditMode(appMode, "reorder section")) return;
    setProject((prev) => {
      if (!prev) return prev;
      const nextData = moveSectionInProjectData(prev.data, sectionId, direction);
      if (!nextData) return prev;
      return {
        ...prev,
        data: nextData,
      };
    });
    setIsDirty(true);
  };

  const duplicateBreak = (sectionId: string) => {
    if (!ensureEditMode(appMode, "duplicate break")) return;
    if (!project) return;
    const result = duplicateBreakSectionInProjectData(
      project.data,
      sectionId,
      () => crypto.randomUUID(),
    );
    if (!result) return;
    setProject({
      ...project,
      data: result.data,
    });
    setIsDirty(true);
    setSelectedSectionId(result.duplicatedId);
    setExpandedSectionId(result.duplicatedId);
  };

  const onDeleteBubble = () => {
    const activeOverlay = currentSlide?.overlays?.find(o => o.id === activeOverlayId);
    if (!activeOverlay || !currentSlide || !project) return;
    const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).filter(o => o.id !== activeOverlay.id);
    setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
    setActiveOverlayId(null);
    setIsDirty(true);
  };

  const deleteCurrentSection = () => {
    if (selectedSectionId) {
      deleteSection(selectedSectionId);
    }
  };

  const handleStageContextMenu = (e: React.MouseEvent) => {
    if (topMode === 'boost') return;
    e.preventDefault();

    const now = Date.now();
    if (now - lastRightClickRef.current < 400) {
      // Double right-click toggle
      setAppMode(prev => prev === 'teach' ? 'edit' : 'teach');
      setContextMenu(null);
      lastRightClickRef.current = 0; // Reset
      return;
    }
    lastRightClickRef.current = now;

    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const onSlideWrapperClick = (slideIndex: number, event: MouseEvent) => {
    if (!project) return;
    const slide = project.data.slides[slideIndex];
    if (!slide) return;

    if (event.ctrlKey || event.metaKey) {
      const next = new Set(selectedSlideIds);
      if (next.has(slide.id)) next.delete(slide.id);
      else next.add(slide.id);
      setSelectedSlideIds(next);
    } else if (event.shiftKey) {
      const start = Math.min(currentIndex, slideIndex);
      const end = Math.max(currentIndex, slideIndex);
      const next = new Set<string>();
      for (let i = start; i <= end; i++) {
        next.add(project.data.slides[i].id);
      }
      setSelectedSlideIds(next);
    } else {
      goToSlideByAbsoluteIndex(slideIndex);
      setSelectedSlideIds(new Set([slide.id]));
    }
  };

  /* Removed reorderSections logic */

  const updateCurrentSlideMarkerStrokes = (strokes: MarkerStroke[]) => {
    if (!project || !currentSlide) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((slide, index) =>
          index === currentIndex ? { ...slide, markerStrokes: strokes } : slide,
        ),
      },
    });
  };

  const clearCurrentSlideDrawings = () => {
    if (selectedSectionType === "break" && selectedSection) {
      updateSection(selectedSection.id, { markerStrokes: [] });
    } else {
      updateCurrentSlideMarkerStrokes([]);
    }
    setDrawClearSignal((prev) => prev + 1);
  };

  const updateSlideAudio = (
    type: "dialogue" | "sfx" | "bgm",
    index: number | null,
    updates: Partial<AudioClip>,
  ) => {
    if (!project || !currentSlide) return;
    const updateAudioClipArray = (
      arr: AudioClip[] | undefined,
      idx: number,
      upds: Partial<AudioClip>,
    ) => {
      if (!arr) return arr;
      const res = [...arr];
      if (res[idx]) res[idx] = { ...res[idx], ...upds };
      return res;
    };

    let nextSlide = { ...currentSlide };
    if (type === "dialogue" && index !== null) {
      nextSlide.dialogue = updateAudioClipArray(
        nextSlide.dialogue,
        index,
        updates,
      );
    } else if (type === "sfx" && index !== null) {
      nextSlide.sfx = updateAudioClipArray(nextSlide.sfx, index, updates);
    } else if (type === "bgm") {
      if (nextSlide.bgm) nextSlide.bgm = { ...nextSlide.bgm, ...updates };
    }

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((s) =>
          s.id === currentSlide.id ? nextSlide : s,
        ),
      },
    });
    setIsDirty(true);
  };

  const removeSlideAudio = (type: "dialogue" | "sfx" | "bgm", index?: number) => {
    if (!project || !currentSlide) return;

    const clipToRemove =
      type === "bgm"
        ? currentSlide.bgm
        : (type === "dialogue" ? currentSlide.dialogue : currentSlide.sfx)?.[index ?? -1];

    if (clipToRemove) {
      audioManager.stopClip(clipToRemove.url, { fadeEnabled: clipToRemove.fadeEnabled || false });
    }

    const nextSlide = { ...currentSlide };
    if (type === "dialogue" && typeof index === "number") {
      nextSlide.dialogue = (nextSlide.dialogue || []).filter((_, i) => i !== index);
    } else if (type === "sfx" && typeof index === "number") {
      nextSlide.sfx = (nextSlide.sfx || []).filter((_, i) => i !== index);
    } else if (type === "bgm") {
      nextSlide.bgm = undefined;
    }

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((s) => (s.id === currentSlide.id ? nextSlide : s)),
      },
    });
    setIsDirty(true);
  };

  const removeSectionBgm = (index: number) => {
    if (!project || !selectedSection) return;
    const sectionTracks = selectedSection.bgm || [];
    const clip = sectionTracks[index];
    if (!clip) return;

    audioManager.stopClip(clip.url, { fadeEnabled: clip.fadeEnabled || false });
    // keep section music singleton state clean if this one was active
    audioManager.stopSectionMusic(undefined, clip.fadeEnabled || false);

    updateSection(selectedSection.id, {
      bgm: sectionTracks.filter((_, i) => i !== index),
    });
  };

  const activeSparkStudentName =
    project?.data.sparkStudents?.find((student) => student.id === project?.data.activeStudentId)?.name ||
    project?.data.sparkStudents?.[0]?.name ||
    "No Student";

  return (
    <SparkProvider
      config={project?.data.sparkConfig}
      onConfigChange={(updates) => {
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              sparkConfig: {
                ...(prev.data.sparkConfig || DEFAULT_SPARK_CONFIG),
                ...updates
              }
            }
          };
        });
        setIsDirty(true);
      }}
      badgeConfig={project?.data.badgeConfig}
      onBadgeConfigChange={(updates) => {
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              badgeConfig: {
                ...(prev.data.badgeConfig || {}),
                ...updates
              }
            }
          };
        });
        setIsDirty(true);
      }}
      students={project?.data.sparkStudents}
      activeStudentId={project?.data.activeStudentId}
      onStudentsChange={(nextStudents) => {
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              sparkStudents: nextStudents,
            }
          };
        });
        setIsDirty(true);
      }}
      onActiveStudentChange={(nextActiveStudentId) => {
        setProject(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              activeStudentId: nextActiveStudentId,
            }
          };
        });
        setIsDirty(true);
      }}
      isBadgeVisible={badgeVisibleState}
      isFinalScoreRevealed={finalScoreRevealedState}
      onBadgeVisibilityChange={setBadgeVisibleState}
      onFinalScoreRevealedChange={setFinalScoreRevealedState}
    >
      <CardSystemProvider
        aCardLibrary={project?.data.aCardLibrary || {}}
        bCardLibrary={project?.data.bCardLibrary || {}}
        onChange={(aCardLibrary, bCardLibrary) => {
          setProject(prev => {
            if (!prev) return prev;
            const mergedData: ProjectData = {
              ...prev.data,
              aCardLibrary,
              bCardLibrary,
            };
            const { data: sanitizedData } = sanitizeProjectCardReferences(
              mergedData,
              new Set(Object.keys(aCardLibrary || {})),
              new Set(Object.keys(bCardLibrary || {})),
            );
            return {
              ...prev,
              data: sanitizedData,
            };
          });
          setIsDirty(true);
        }}
      >
        <SparkHotkeyHandler
          appMode={appMode}
          onActiveStudentChangeFlash={(name) => showToast(`Active Student: ${name}`, "teach", 300)}
        />
        <div
          className={isDragImportActive ? "app drag-import-active" : "app"}
          onDragEnter={handleAppDragEnter}
          onDragOver={handleAppDragOver}
          onDragLeave={handleAppDragLeave}
          onDrop={handleAppDrop}
        >
          {isDragImportActive && (
            <div className="drag-import-overlay">
              <div className="drag-import-message">
                Drop media into {selectedSection?.name || "the current section"}
              </div>
            </div>
          )}
          <header
            className="topbar"
            style={{
              background: appMode === "edit" ? "#331515" : undefined,
              borderBottomColor: appMode === "edit" ? "#552222" : undefined,
            }}
          >
            <button onClick={onCreateProject}>Create Project</button>
            <button onClick={onOpenProject}>Open Project</button>
            <button onClick={onImportMedia} disabled={!project}>
              Import Media
            </button>
            <button onClick={onSave} disabled={!project || isSaveInProgress}>
              Save
            </button>
            {appMode === "edit" && (
              <button onClick={onRefreshApp} disabled={!project || isSaveInProgress}>
                Refresh App
              </button>
            )}
            {appMode === "edit" && <SparkLab />}
            {selectedSectionType === "break" && (
              <button
                onClick={toggleTimer}
                style={{
                  marginLeft: 10,
                  background: timerState.isRunning ? "#ff4444" : "#44ff44",
                  color: "#000",
                }}
              >
                {timerState.isRunning ? "Stop Timer" : "Start Timer"}
              </button>
            )}
            {ENABLE_BOOST_MODE && (
              <div style={{ display: 'flex', gap: 4, background: '#222', padding: '2px', borderRadius: 4, marginRight: 10 }}>
                <button
                  style={{ background: topMode === 'story' ? '#444' : 'transparent', color: topMode === 'story' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  onClick={() => setTopMode('story')}
                >Story</button>
                <button
                  style={{ background: topMode === 'boost' ? '#444' : 'transparent', color: topMode === 'boost' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  onClick={() => setTopMode('boost')}
                >Boost</button>
                <button
                  style={{ background: topMode === 'badge' ? '#444' : 'transparent', color: topMode === 'badge' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  onClick={() => setTopMode('badge')}
                >Badge</button>
                <button
                  style={{ background: topMode === 'relics' ? '#444' : 'transparent', color: topMode === 'relics' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  onClick={() => setTopMode('relics')}
                >Relics</button>
                <button
                  style={{ background: topMode === 'boards' ? '#444' : 'transparent', color: topMode === 'boards' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  onClick={() => setTopMode('boards')}
                >Boards</button>
              </div>
            )}

            <button
              className="audio-toolbar-button"
              style={{ marginLeft: "auto" }}
              onClick={() => setAudioSettingsOpen(true)}
            >
              <span aria-hidden="true">♪</span>
              <span>Audio</span>
              <AudioStatus compact />
            </button>

            <button
              onClick={toggleMode}
              style={{
                marginRight: 10,
                alignSelf: "center",
                fontSize: "0.8rem",
                opacity: 0.9,
                background: appMode === "edit" ? "#5a2525" : undefined,
                borderColor: appMode === "edit" ? "#883333" : undefined,
              }}
            >
              {appMode === "edit" ? "Edit" : "Teach"}
            </button>

            <div className="topbar-active-student-chip" title="Active spark student">
              <span className="topbar-active-student-label">Active Student</span>
              <span className="topbar-active-student-name">{activeSparkStudentName}</span>
            </div>

            <span className="build-chip" title="Build marker">
              Build {BUILD_VERSION}
            </span>
          </header>
          <AudioSettingsWorkspace
            open={audioSettingsOpen}
            onClose={() => setAudioSettingsOpen(false)}
          />
          {showRestoreSessionPrompt && savedLiveSession && !project && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.72)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2600,
              }}
            >
              <div
                style={{
                  width: 480,
                  maxWidth: "92vw",
                  background: "#1f1f26",
                  border: "1px solid #434357",
                  borderRadius: 10,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <h3 style={{ margin: 0, color: "#fff" }}>Restore Lesson Session?</h3>
                <div style={{ color: "#b8bfd6", fontSize: "0.9rem", lineHeight: 1.4 }}>
                  A crash-recovery session was found from {new Date(savedLiveSession.savedAt).toLocaleString()}.
                </div>
                <div style={{ color: "#9199b2", fontSize: "0.8rem", wordBreak: "break-all" }}>
                  Project: {savedLiveSession.projectFolderPath}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    onClick={onStartFreshSession}
                    style={{ background: "#3a3131", border: "1px solid #6a4444", color: "#ffd1d1" }}
                  >
                    Start Fresh
                  </button>
                  <button
                    onClick={onRestoreSession}
                    style={{ background: "#2c4a2c", border: "1px solid #4f7a4f", color: "#ddffdd" }}
                  >
                    Restore Session
                  </button>
                </div>
              </div>
            </div>
          )}
          {toast && (
            <div
              className="toast-msg"
              key={toast.id}
              style={{
                background:
                  toast.type === "edit"
                    ? "rgba(180, 40, 40, 0.85)"
                    : "rgba(42, 90, 42, 0.9)",
                borderColor:
                  toast.type === "edit"
                    ? "rgba(255, 80, 80, 0.3)"
                    : "rgba(74, 138, 74, 0.4)",
                animation: `fadeToast ${toast.duration}ms forwards`,
              }}
            >
              {toast.message}
            </div>
          )}

          {showSlideSelector && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
              <div className="break-slide-picker-modal">
                <h3 style={{ margin: 0, color: "#eee" }}>Select Slide</h3>
                <div className="break-slide-picker-list">
                  {project?.data.slides.map((s) => {
                    const asset = assetsById.get(s.assetId);
                    return (
                      <button key={s.id} onClick={() => {
                        const newMedia = [{ id: `img-${Date.now()}`, slideId: s.id, fit: "contain" as const }];
                        const nextBreakMedia = [...(selectedSection?.breakMedia || []), ...newMedia];
                        if (selectedSection) updateSection(selectedSection.id, { breakMedia: nextBreakMedia });
                        setShowSlideSelector(false);
                      }} className="break-slide-picker-item">
                        <span className="break-slide-picker-thumb">
                          {asset ? (
                            asset.mediaType === "video" ? (
                              <video
                                src={toMediaUrl(asset.relativePath)}
                                muted
                                preload="metadata"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : asset.mediaType === "image" ? (
                              <img
                                src={toMediaUrl(asset.relativePath)}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : (
                              <span style={{ fontSize: "0.6rem", color: "#8ea2c7" }}>A</span>
                            )
                          ) : (
                            <span style={{ fontSize: "0.6rem", color: "#8ea2c7" }}>?</span>
                          )}
                        </span>
                        <span className="break-slide-picker-label">
                          {getSlideDisplayName(s, "edit")}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setShowSlideSelector(false)} className="break-slide-picker-cancel">Cancel</button>
              </div>
            </div>
          )}

          {copyBubbleOverlayId && project && currentSlide && appMode === "edit" && (() => {
            const sourceBubble = project.data.slides
              .flatMap((slide) => slide.overlays || [])
              .find((overlay) => overlay.id === copyBubbleOverlayId);
            return (
              <div className="bubble-copy-backdrop" onClick={() => setCopyBubbleOverlayId(null)}>
                <div className="bubble-copy-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="bubble-copy-header">
                    <div>
                      <h3>Copy Bubble to Slides</h3>
                      <p>{sourceBubble?.bubbleId || "Selected bubble"} can be copied to one or more slides.</p>
                    </div>
                    <button onClick={() => setCopyBubbleOverlayId(null)}>Close</button>
                  </div>
                  <div className="bubble-copy-grid">
                    {project.data.slides.map((slide, idx) => {
                      const asset = assetsById.get(slide.assetId);
                      const isCurrent = slide.id === currentSlide.id;
                      const isSelected = copyBubbleTargetIds.includes(slide.id);
                      return (
                        <button
                          key={slide.id}
                          className={isSelected ? "bubble-copy-card selected" : "bubble-copy-card"}
                          onClick={() => !isCurrent && toggleCopyBubbleTarget(slide.id)}
                          disabled={isCurrent}
                          title={isCurrent ? "Current slide already has this bubble" : getSlideDisplayName(slide, "edit")}
                        >
                          <span className="bubble-copy-thumb">
                            {asset ? (
                              asset.mediaType === "video" ? (
                                <video src={toMediaUrl(asset.relativePath)} muted preload="metadata" />
                              ) : asset.mediaType === "image" ? (
                                <img src={toMediaUrl(asset.relativePath)} alt="" />
                              ) : (
                                <span>Audio</span>
                              )
                            ) : (
                              <span>No media</span>
                            )}
                          </span>
                          <span className="bubble-copy-meta">
                            <strong>Slide {idx + 1}</strong>
                            <span>{getSlideDisplayName(slide, "edit")}</span>
                          </span>
                          <span className="bubble-copy-check">{isCurrent ? "Current" : isSelected ? "Selected" : "Select"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bubble-copy-footer">
                    <button onClick={() => setCopyBubbleTargetIds(project.data.slides.filter((slide) => slide.id !== currentSlide.id).map((slide) => slide.id))}>
                      Select All
                    </button>
                    <button onClick={() => setCopyBubbleTargetIds([])}>
                      Clear
                    </button>
                    <button
                      className="bubble-copy-confirm"
                      onClick={confirmCopyBubbleToSlides}
                      disabled={copyBubbleTargetIds.length === 0}
                    >
                      Copy to {copyBubbleTargetIds.length || 0} Slide{copyBubbleTargetIds.length === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {showBreakBgLibrary && selectedSection?.type === "break" && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100 }}>
              <div style={{ background: "#2a2a30", border: "1px solid #444", borderRadius: 8, padding: 18, width: 420, display: "flex", flexDirection: "column", gap: 12, maxHeight: "80vh" }}>
                <h3 style={{ margin: 0, color: "#eee" }}>Select Break Background</h3>
                <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {(project?.data.assets || [])
                    .filter((a) => a.mediaType === "image")
                    .map((asset) => {
                      const linkedSlide = project?.data.slides.find((s) => s.assetId === asset.id);
                      const label = linkedSlide
                        ? getSlideDisplayName(linkedSlide, "edit")
                        : getAssetDisplayLabel(asset, "edit");
                      return (
                      <button
                        key={asset.id}
                        onClick={() => {
                          updateSection(selectedSection.id, { background: `url('${toMediaUrl(asset.relativePath)}')` });
                          setShowBreakBgLibrary(false);
                        }}
                        style={{ textAlign: "left", padding: "8px", background: "#111", border: "1px solid #333", color: "#fff", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <img
                          src={toMediaUrl(asset.relativePath)}
                          alt=""
                          style={{ width: 56, height: 34, objectFit: "cover", borderRadius: 4, border: "1px solid #30364d", flex: "0 0 auto" }}
                        />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {label}
                        </span>
                      </button>
                    )})}
                  {!(project?.data.assets || []).some((a) => a.mediaType === "image") && (
                    <div style={{ color: "#888", fontSize: "0.85rem" }}>No images in project library.</div>
                  )}
                </div>
                <button onClick={() => setShowBreakBgLibrary(false)} style={{ alignSelf: "flex-end", padding: "6px 12px" }}>Close</button>
              </div>
            </div>
          )}

          {pendingSectionDeleteId && (() => {
            const section = project?.data.sections.find((item) => item.id === pendingSectionDeleteId);
            if (!section) return null;
            const sectionKind = section.type === "break" ? "Break" : "Section";
            return (
              <div className="app-modal-backdrop">
                <div className="app-confirm-modal">
                  <h3>Delete {sectionKind}</h3>
                  <p>
                    Delete {sectionKind.toLowerCase()} "{section.name}"? This will also delete all slides in this section.
                  </p>
                  <div className="app-confirm-actions">
                    <button onClick={cancelDeleteSection}>Cancel</button>
                    <button className="danger" onClick={confirmDeleteSection}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {showConfirmModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
              }}
            >
              <div
                style={{
                  background: "#2a2a30",
                  border: "1px solid #444",
                  borderRadius: 8,
                  padding: 24,
                  width: 400,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#eee" }}>
                  Unsaved Changes
                </h3>
                <p style={{ margin: 0, color: "#aaa", lineHeight: 1.5 }}>
                  You have unsaved changes in your project. Do you want to save them
                  before continuing?
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={handleConfirmCancel}
                    style={{ background: "transparent", border: "1px solid #555" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDiscard}
                    style={{
                      background: "#442222",
                      border: "1px solid #663333",
                      color: "#ffaaaa",
                    }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    style={{
                      background: "#2a5a2a",
                      border: "1px solid #4a8a4a",
                      color: "#fff",
                    }}
                  >
                    Yes, Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSaveChoiceModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
              }}
            >
              <div
                style={{
                  background: "#2a2a30",
                  border: "1px solid #444",
                  borderRadius: 8,
                  padding: 20,
                  width: 320,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#eee" }}>
                  Save Project
                </h3>
                <p style={{ margin: 0, color: "#aaa", lineHeight: 1.4 }}>
                  Choose how you want to save this project.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setShowSaveChoiceModal(false)}
                    style={{ background: "transparent", border: "1px solid #555" }}
                    disabled={isSaveInProgress}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setShowSaveChoiceModal(false);
                      await performSave("save");
                    }}
                    style={{ background: "#2a5a2a", border: "1px solid #4a8a4a", color: "#fff" }}
                    disabled={isSaveInProgress}
                  >
                    Save
                  </button>
                  <button
                    onClick={async () => {
                      setShowSaveChoiceModal(false);
                      await performSave("saveAs");
                    }}
                    style={{ background: "#2f4d7a", border: "1px solid #42679e", color: "#fff" }}
                    disabled={isSaveInProgress}
                  >
                    Save As
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={`content ${topMode === 'badge' ? 'is-badge-mode' : ''}`}>
            {topMode === 'badge' && (
              <BadgeTabBackground project={project} toMediaUrl={toMediaUrl} />
            )}
            <aside className="sidebar">
              {topMode === 'badge' ? (
                <BadgePanel
                  isEditMode={appMode === "edit"}
                  project={project}
                  show="content"
                  onUpdateProject={(upd) => {
                    if (upd.data) {
                      setProject(prev => prev ? { ...prev, data: upd.data! } : prev);
                      setIsDirty(true);
                    }
                  }}
                />
              ) : topMode === 'relics' ? (
                <RelicsPanel
                  relicSystem={relicSystem}
                  roster={studentRoster}
                  assets={project?.data.assets || []}
                  toMediaUrl={toMediaUrl}
                  onRelicChange={patchRelicSystem}
                  onStudentProgressChange={updateRelicStudentProgress}
                  onAddStudent={addRosterStudent}
                  onRenameStudent={renameRosterStudent}
                  onArchiveStudent={archiveRosterStudent}
                  onImportImage={importRelicImage}
                  onProgressAction={runRelicProgressAction}
                  onShowRewardCard={() => setIsRelicRewardCardVisible(true)}
                />
              ) : topMode === 'story' ? (
                <>
                  <h3>Sections</h3>
                  {sections.length ? (
                    <ul>
                      {sections.map((section, index) => {
                        const isBreak = section.type === "break";
                        const count = isBreak
                          ? (section.breakMedia?.length ?? 0)
                          : (sectionSlideIndices.get(section.id)?.length ?? 0);
                        const isSelected = selectedSectionId === section.id;
                        const isExpanded = expandedSectionId === section.id;
                        return (
                          <li
                            key={section.id}
                            className={`section-wrapper ${isBreak ? "break-item" : ""}`}
                          >
                            <div className="section-item">
                              <div
                                className="section-name"
                                style={{
                                  fontWeight: isSelected ? "bold" : "normal",
                                  cursor: "pointer",
                                  flex: 1,
                                }}
                                onClick={() => {
                                  selectSection(section.id);
                                  setExpandedSectionId(isExpanded ? null : section.id);
                                }}
                                onDoubleClick={() => setRenamingSectionId(section.id)}
                              >
                                {renamingSectionId === section.id ? (
                                  <input
                                    className="section-input"
                                    defaultValue={section.name}
                                    autoFocus
                                    onBlur={(event) => {
                                      updateSection(section.id, {
                                        name: event.target.value,
                                      });
                                      setRenamingSectionId(null);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        updateSection(section.id, {
                                          name: (event.target as HTMLInputElement)
                                            .value,
                                        });
                                        setRenamingSectionId(null);
                                      } else if (event.key === "Escape") {
                                        setRenamingSectionId(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span>
                                    {isBreak ? "* " : isExpanded ? "v " : "> "}
                                    {section.name}
                                  </span>
                                )}
                              </div>
                              {!isBreak && (
                                <small
                                  style={{
                                    minWidth: "20px",
                                    textAlign: "right",
                                    display: "inline-block",
                                  }}
                                >
                                  {count}
                                </small>
                              )}
                              {appMode === 'edit' && (
                                <>
                                  <button
                                    className="section-ctrl-btn"
                                    title="Move Up"
                                    disabled={index === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveSection(section.id, "up");
                                    }}
                                  >
                                    Up
                                  </button>
                                  <button
                                    className="section-ctrl-btn"
                                    title="Move Down"
                                    disabled={index === sections.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveSection(section.id, "down");
                                    }}
                                  >
                                    Down
                                  </button>
                                  <button
                                    className="section-delete-btn"
                                    title="Delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSection(section.id);
                                    }}
                                  >
                                    X
                                  </button>
                                </>
                              )}
                            </div>
                            {!isBreak && isExpanded && (
                              <ul className="slide-list">
                                {(sectionSlideIndices.get(section.id) ?? []).map(
                                  (slideIndex, localIndex, sectionIndices) => {
                                    const slide = project!.data.slides[slideIndex];
                                    const asset = assetsById.get(slide.assetId);
                                    const isDragging = draggedSlideIndex === slideIndex;
                                    const isSlideSelected = selectedSlideIds.has(
                                      slide.id,
                                    );
                                    const isCurrent = slideIndex === currentIndex;
                                    const endInsertTarget =
                                      sectionIndices[sectionIndices.length - 1] + 1;

                                    return (
                                      <Fragment key={slide.id}>
                                        {appMode === "edit" && (
                                          <li
                                            className={`slide-drop-zone ${dragInsertIndex === slideIndex ? "active" : ""}`}
                                            onDragOver={(event) => {
                                              event.preventDefault();
                                              if (draggedSlideIndex !== null) {
                                                setDragInsertIndex(slideIndex);
                                              }
                                            }}
                                            onDrop={(event) => {
                                              event.preventDefault();
                                              if (draggedSlideIndex === null) return;
                                              reorderSlidesWithinSection(
                                                draggedSlideIndex,
                                                slideIndex,
                                              );
                                            }}
                                          />
                                        )}
                                        <li className="slide-row">
                                          <button
                                            draggable={
                                              appMode === "edit" &&
                                              renamingSlideId !== slide.id
                                            }
                                            className={`slide-btn ${appMode === "edit" ? "slide-btn--edit" : "slide-btn--teach"} ${isSlideSelected ? "selected" : ""} ${isCurrent && topMode === 'story' ? "current-slide" : ""}`}
                                            style={{ position: 'relative' }}
                                            onClick={(e) =>
                                              onSlideWrapperClick(slideIndex, e)
                                            }
                                            onDragStart={(event) => {
                                              if (
                                                appMode !== "edit" ||
                                                renamingSlideId === slide.id
                                              ) {
                                                return;
                                              }
                                              event.stopPropagation();
                                              event.dataTransfer.effectAllowed = "move";
                                              event.dataTransfer.setData(
                                                "text/plain",
                                                String(slideIndex),
                                              );
                                              setDraggedSlideIndex(slideIndex);
                                              setDragInsertIndex(slideIndex);
                                            }}
                                            onDragEnd={() => {
                                              setDraggedSlideIndex(null);
                                              setDragInsertIndex(null);
                                            }}
                                          >
                                            <span className={`slide-thumb ${appMode === "edit" ? "slide-thumb--edit" : "slide-thumb--teach"}`}>
                                              {asset ? (
                                                asset.mediaType === "video" ? (
                                                  <video
                                                    src={toMediaUrl(asset.relativePath)}
                                                    muted
                                                    preload="metadata"
                                                    className="slide-thumb-media"
                                                  />
                                                ) : asset.mediaType === "image" ? (
                                                  <img
                                                    src={toMediaUrl(asset.relativePath)}
                                                    alt={getAssetDescription(asset)}
                                                    className="slide-thumb-media"
                                                  />
                                                ) : (
                                                  <span className="slide-thumb-fallback">A</span>
                                                )
                                              ) : (
                                                <span className="slide-thumb-fallback">?</span>
                                              )}
                                            </span>
                                            {renamingSlideId === slide.id ? (
                                              <input
                                                className="section-input slide-label-text"
                                                defaultValue={getSlideEditableDescription(slide)}
                                                autoFocus
                                                onBlur={(event) =>
                                                  commitSlideName(
                                                    slide.id,
                                                    event.target.value,
                                                  )
                                                }
                                                onKeyDown={(event) => {
                                                  event.stopPropagation();
                                                  if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    commitSlideName(
                                                      slide.id,
                                                      (
                                                        event.target as HTMLInputElement
                                                      ).value,
                                                    );
                                                  } else if (
                                                    event.key === "Escape"
                                                  ) {
                                                    event.preventDefault();
                                                    setRenamingSlideId(null);
                                                  }
                                                }}
                                                onClick={(event) =>
                                                  event.stopPropagation()
                                                }
                                                onDoubleClick={(event) =>
                                                  event.stopPropagation()
                                                }
                                              />
                                            ) : (
                                              <span
                                                className="slide-label-text"
                                                title="Double-click to rename slide"
                                                onDoubleClick={(event) => {
                                                  event.stopPropagation();
                                                  if (appMode !== "edit")
                                                    return;
                                                  setRenamingSlideId(slide.id);
                                                }}
                                              >
                                                {getSlideDisplayName(
                                                  slide,
                                                  appMode,
                                                )}
                                              </span>
                                            )}
                                            {isDragging && <small> (Dragging)</small>}
                                            {appMode === "edit" && (
                                              <div
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onDeleteSlide(slide.id);
                                                }}
                                                title="Delete Slide"
                                                style={{
                                                  position: 'absolute',
                                                  top: 0,
                                                  right: 0,
                                                  padding: '2px 6px',
                                                  background: 'rgba(0, 0, 0, 0.3)',
                                                  color: '#fff',
                                                  fontSize: '0.75rem',
                                                  borderRadius: '0 0 0 4px',
                                                  cursor: 'pointer',
                                                  zIndex: 5
                                                }}
                                              >
                                                X
                                              </div>
                                            )}
                                          </button>
                                        </li>
                                        {appMode === "edit" && localIndex === sectionIndices.length - 1 && (
                                          <li
                                            className={`slide-drop-zone ${dragInsertIndex === endInsertTarget ? "active" : ""}`}
                                            onDragOver={(event) => {
                                              event.preventDefault();
                                              if (draggedSlideIndex !== null) {
                                                setDragInsertIndex(endInsertTarget);
                                              }
                                            }}
                                            onDrop={(event) => {
                                              event.preventDefault();
                                              if (draggedSlideIndex === null) return;
                                              reorderSlidesWithinSection(
                                                draggedSlideIndex,
                                                endInsertTarget,
                                              );
                                            }}
                                          />
                                        )}
                                      </Fragment>
                                    );
                                  },
                                )}
                              </ul>
                            )}

                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>No sections yet.</p>
                  )}

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="section-break-btn"
                      style={{ flex: 1, marginTop: 0 }}
                      onClick={onAddSection}
                      disabled={!project}
                    >
                      + Section
                    </button>
                    <button
                      className="section-break-btn"
                      style={{ flex: 1, marginTop: 0 }}
                      onClick={onAddBreak}
                      disabled={!project}
                    >
                      + Break
                    </button>
                  </div>
                </>
              ) : topMode === 'boards' ? (
                <ACardSidebar
                  selectedACardId={selectedACardId}
                  selectedBCardId={selectedLibraryBCardId}
                  onSelectACard={setSelectedACardId}
                  onSelectBCard={setSelectedLibraryBCardId}
                  appMode={appMode}
                />
              ) : (
                <>
                  <h3 style={{ marginBottom: 16 }}>Boost Sequences</h3>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                    {(['activation', 'language', 'games', 'badge'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setBoostTab(tab)}
                        style={{ flex: 1, padding: '4px', background: boostTab === tab ? '#555' : '#222', border: 'none', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 2 }}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  {boostTab === 'badge' ? (
                    <BadgePanel
                      isEditMode={appMode === "edit"}
                      project={project}
                      show="content"
                      onUpdateProject={(upd) => {
                        if (upd.data) {
                          setProject(prev => prev ? { ...prev, data: upd.data! } : prev);
                          setIsDirty(true);
                        }
                      }}
                    />
                  ) : (
                    <>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(project?.data.boostPack?.[`${boostTab}Sequence` as keyof BoostPack] || []).map((item, index, arr) => {
                          // ... existing item rendering ...
                          const isSelected = selectedBoostItemId === item.id;
                          let title: string = item.type;
                          if (item.type === 'slideRef') {
                            const slideRef = item as Extract<SequenceItem, { type: 'slideRef' }>;
                            const slide = project!.data.slides.find(s => s.id === slideRef.slideId);
                            const bIds = slide?.overlays?.map(o => {
                              const d = BUBBLE_LIBRARY.find(lib => lib.bubbleDefId === o.bubbleDefId);
                              const tName = d?.templateName || d?.name || o.type;
                              return `${o.bubbleId} - ${tName}`;
                            }).filter(Boolean).join(', ');
                            const bStr = bIds ? ` [${bIds}]` : '';
                            title = `Slide: ${slide ? getSlideDisplayName(slide, appMode) : slideRef.slideId}${bStr}`;
                          } else if (item.type === 'aCardRef') {
                            const aCard = (project!.data.aCardLibrary || {})[(item as any).aCardId];
                            title = `ACard: ${aCard?.name || (item as any).aCardId || '(none)'}`;
                          }
                          const hostedBCardCount = normalizeBCardInstances(item.bCardInstances).length;
                          if (hostedBCardCount > 0) {
                            title += ` + ${hostedBCardCount} BCard${hostedBCardCount === 1 ? '' : 's'}`;
                          }

                          return (
                            <li key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '6px', background: isSelected ? '#334' : '#222', border: isSelected ? '1px solid #66f' : '1px solid #333', cursor: 'pointer', borderRadius: 4 }} onClick={() => setSelectedBoostItemId(item.id)}>
                              <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {title}</span>
                              <button
                                style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#888', cursor: index === 0 ? 'default' : 'pointer' }}
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!project) return;
                                  const seq = [...arr];
                                  [seq[index - 1], seq[index]] = [seq[index], seq[index - 1]];
                                  setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack!, [`${boostTab}Sequence`]: seq } } });
                                  setIsDirty(true);
                                }}
                              >Up</button>
                              <button
                                style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#888', cursor: index === arr.length - 1 ? 'default' : 'pointer' }}
                                disabled={index === arr.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!project) return;
                                  const seq = [...arr];
                                  [seq[index + 1], seq[index]] = [seq[index], seq[index + 1]];
                                  setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack!, [`${boostTab}Sequence`]: seq } } });
                                  setIsDirty(true);
                                }}
                              >Down</button>
                              <button
                                style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#f66', cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!project) return;
                                  const seq = arr.filter((_, i) => i !== index);
                                  setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack!, [`${boostTab}Sequence`]: seq } } });
                                  setIsDirty(true);
                                  if (isSelected) setSelectedBoostItemId(null);
                                }}
                              >X</button>
                            </li>
                          );
                        })}
                      </ul>
                      {!(project?.data.boostPack?.[`${boostTab}Sequence` as keyof BoostPack] || []).length && (
                        <div style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', marginTop: 24 }}>Sequence is empty</div>
                      )}
                    </>
                  )}
                </>
              )}
            </aside>

            <main className="stage-wrap" style={{ position: "relative" }}>
              <SparkOverlay />
              <FinalBadgeOverlay
                assets={project?.data.assets}
                getMediaUrl={toMediaUrl}
              />
              <RelicStageWidget
                relicSystem={relicSystem}
                roster={studentRoster}
                assetsById={assetsById}
                toMediaUrl={toMediaUrl}
                rewardVisible={isRelicRewardCardVisible}
                onHideReward={() => setIsRelicRewardCardVisible(false)}
                animationSignal={relicAnimationSignal}
                onWidgetOffsetChange={(widgetOffset) => patchRelicSystem({ widgetOffset })}
              />
              {topMode === 'boards' ? (
                <div style={{ position: 'absolute', inset: 0 }}>
                  {selectedACardId ? (
                    <ACardSystem
                      aCardId={selectedACardId}
                      mode={appMode}
                      assets={project?.data.assets || []}
                      resolveImageUrl={(id) => {
                        const asset = assetsById.get(id);
                        return asset ? toMediaUrl(asset.relativePath) : null;
                      }}
                    />
                  ) : selectedLibraryBCardId ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                      <BCardEditor
                        bCardId={selectedLibraryBCardId}
                        assets={project?.data.assets || []}
                        resolveImageUrl={(id) => {
                          const asset = assetsById.get(id);
                          return asset ? toMediaUrl(asset.relativePath) : null;
                        }}
                      />
                    </div>
                  ) : (
                    <BoardEmptyState onCreated={setSelectedACardId} />
                  )}
                </div>
              ) : topMode === 'boost' && boostTab !== 'language' && activeItem?.type === 'aCardRef' && (activeItem as any).aCardId ? (
                <div style={{ position: 'absolute', inset: 0 }}>
                  <ACardSystem
                    aCardId={(activeItem as any).aCardId}
                    mode={appMode}
                    assets={project?.data.assets || []}
                    teachPanelHost={teachToolsHostRef.current}
                    resolveImageUrl={(id) => {
                      const asset = assetsById.get(id);
                      return asset ? toMediaUrl(asset.relativePath) : null;
                    }}
                  />
                </div>
              ) : topMode === 'badge' ? (
                <div className="badge-stage">
                  <div className="badge-bg-layer">
                    {project?.data.badgeImageAssetId ? (
                      <img
                        src={toMediaUrl(assetsById.get(project.data.badgeImageAssetId)?.relativePath || '')}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : null}
                  </div>
                  <div className={`badge-shield-layer ${appMode === "edit" ? "is-edit" : ""}`}>
                    <BadgeStudentSprites
                      assetsById={assetsById}
                      getMediaUrl={toMediaUrl}
                      isEditMode={appMode === "edit"}
                    />
                  </div>
                </div>
              ) : selectedSectionType === "break" && selectedSection ? (
                <>
                  {appMode === "edit" && !showBreakEditor && (
                    <button
                      style={{ position: "absolute", top: 10, right: 10, zIndex: 60, padding: "8px 12px", background: "#333", border: "1px solid #555", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: "0.85rem" }}
                      onClick={() => setShowBreakEditor(true)}
                    >
                      Edit Break
                    </button>
                  )}
                  {appMode === "edit" && showBreakEditor && (
                    <div key={selectedSection.id} className="break-editor-panel" style={{ position: "absolute", top: 10, right: 10, width: "330px", maxHeight: "calc(100% - 20px)", height: "auto", zIndex: 60 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #444", paddingBottom: "8px", margin: 0 }}>
                        <h3 style={{ margin: 0, color: "#fff" }}>Break Editor</h3>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            onClick={() => duplicateBreak(selectedSection.id)}
                            style={{ border: "1px solid rgba(104, 182, 129, 0.8)", borderRadius: 6, padding: "4px 8px", background: "rgba(42, 102, 67, 0.95)", color: "#e3ffe8", cursor: "pointer", fontSize: "0.72rem" }}
                          >
                            Duplicate
                          </button>
                          <button onClick={() => setShowBreakEditor(false)} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>X</button>
                        </div>
                      </div>

                        <label className="break-editor-label">
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Title</span>
                          <textarea
                            value={breakEditorDraft?.sectionId === selectedSection.id ? breakEditorDraft.name : (selectedSection.name || "")}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setBreakEditorDraft((prev) =>
                                prev?.sectionId === selectedSection.id
                                  ? { ...prev, name: nextValue }
                                  : { sectionId: selectedSection.id, name: nextValue, questions: selectedSection.questions || "" },
                              );
                              updateSection(selectedSection.id, { name: nextValue });
                            }}
                            onBlur={() => {
                              if (breakEditorDraft?.sectionId === selectedSection.id) {
                                updateSection(selectedSection.id, { name: breakEditorDraft.name });
                              }
                            }}
                            className="break-editor-textarea"
                            style={{ minHeight: 40 }}
                          />
                        </label>

                      <label className="break-editor-label">
                        <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Questions</span>
                        <textarea
                          value={breakEditorDraft?.sectionId === selectedSection.id ? breakEditorDraft.questions : (selectedSection.questions || "")}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setBreakEditorDraft((prev) =>
                              prev?.sectionId === selectedSection.id
                                ? { ...prev, questions: nextValue }
                                : { sectionId: selectedSection.id, name: selectedSection.name || "", questions: nextValue },
                            );
                            updateSection(selectedSection.id, { questions: nextValue });
                          }}
                          onBlur={() => {
                            if (breakEditorDraft?.sectionId === selectedSection.id) {
                              updateSection(selectedSection.id, { questions: breakEditorDraft.questions });
                            }
                          }}
                          className="break-editor-textarea"
                          style={{ minHeight: 100 }}
                        />
                      </label>

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 100 }}>
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Font Family</span>
                          <select
                            value={selectedSection.font || "sans-serif"}
                            onChange={(e) => updateSection(selectedSection.id, { font: e.target.value })}
                            style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "6px", borderRadius: 4, outline: "none" }}
                          >
                            <option value="sans-serif">Sans-Serif</option>
                            <option value="serif">Serif</option>
                            <option value="monospace">Monospace</option>
                            <option value="Georgia, serif">Georgia</option>
                            <option value="Arial, sans-serif">Arial</option>
                            <option value="'Times New Roman', serif">Times New Roman</option>
                          </select>
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, width: "70px" }}>
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Q-Size</span>
                          <input
                            type="number"
                            min="1"
                            value={selectedSection.fontSize || 24}
                            onChange={(e) => updateSection(selectedSection.id, { fontSize: Number(e.target.value) })}
                            style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "6px", borderRadius: 4, outline: "none" }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, width: "70px" }}>
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>T-Size</span>
                          <input
                            type="number"
                            min="1"
                            value={selectedSection.titleFontSize || 40}
                            onChange={(e) => updateSection(selectedSection.id, { titleFontSize: Number(e.target.value) })}
                            style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "6px", borderRadius: 4, outline: "none" }}
                          />
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: "16px", flexDirection: "column" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Text Color</span>
                          <input
                            type="color"
                            value={(selectedSection as any).textColor || "#ffffff"}
                            onChange={(e) => updateSection(selectedSection.id, { textColor: e.target.value } as any)}
                            style={{ background: "transparent", border: "none", width: 24, height: 24, cursor: "pointer", padding: 0 }}
                          />
                        </label>

                        <div className="break-editor-section-block">
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Background</span>
                          {(() => {
                            const bg = selectedSection.background || "#111111";
                            const isGrad = bg.startsWith("linear-gradient");
                            const isImg = bg.startsWith("url");
                            const bgTransform = selectedSection.bgTransform || { x: 0, y: 0, scale: 1, blur: 0 };

                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <button onClick={() => updateSection(selectedSection.id, { background: "#111111" })} style={{ border: "1px solid rgba(106, 126, 161, 0.65)", borderRadius: 6, padding: "4px 8px", background: !isGrad && !isImg ? "rgba(52, 64, 89, 0.95)" : "rgba(43, 52, 73, 0.9)", color: "#e6ecff", cursor: "pointer", fontSize: "0.72rem" }}>Solid</button>
                                  <button onClick={() => updateSection(selectedSection.id, { background: "linear-gradient(180deg, #111111, #333333)" })} style={{ border: "1px solid rgba(106, 126, 161, 0.65)", borderRadius: 6, padding: "4px 8px", background: isGrad ? "rgba(52, 64, 89, 0.95)" : "rgba(43, 52, 73, 0.9)", color: "#e6ecff", cursor: "pointer", fontSize: "0.72rem" }}>Gradient</button>
                                  <button onClick={() => updateSection(selectedSection.id, { background: "url('')" })} style={{ border: "1px solid rgba(106, 126, 161, 0.65)", borderRadius: 6, padding: "4px 8px", background: isImg ? "rgba(52, 64, 89, 0.95)" : "rgba(43, 52, 73, 0.9)", color: "#e6ecff", cursor: "pointer", fontSize: "0.72rem" }}>Image</button>
                                </div>

                                {!isImg && !isGrad && (
                                  <input
                                    type="color"
                                    value={bg}
                                    onChange={(e) => updateSection(selectedSection.id, { background: e.target.value })}
                                    style={{ background: "transparent", border: "1px solid rgba(130, 149, 184, 0.55)", width: 34, height: 24, borderRadius: 4, cursor: "pointer", padding: 0 }}
                                  />
                                )}
                                {isGrad && (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <input type="color" value={(bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"])[0]} onChange={(e) => { const c = bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"]; updateSection(selectedSection.id, { background: `linear-gradient(180deg, ${e.target.value}, ${c[1] || c[0]})` }) }} style={{ background: "transparent", border: "1px solid rgba(130, 149, 184, 0.55)", width: 34, height: 24, borderRadius: 4, cursor: "pointer", padding: 0 }} />
                                    <input type="color" value={(bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"])[1]} onChange={(e) => { const c = bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"]; updateSection(selectedSection.id, { background: `linear-gradient(180deg, ${c[0]}, ${e.target.value})` }) }} style={{ background: "transparent", border: "1px solid rgba(130, 149, 184, 0.55)", width: 34, height: 24, borderRadius: 4, cursor: "pointer", padding: 0 }} />
                                  </div>
                                )}

                                {isImg && (
                                  <div className="break-editor-image-card">
                                    <div style={{ fontSize: "0.72rem", color: "#a9b5cd" }}>Image BG</div>
                                    <div className="break-editor-grid-2">
                                      <button
                                        onClick={() => setShowBreakBgLibrary(true)}
                                        className="break-editor-btn"
                                      >
                                        Project Library
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!project) return;
                                          const result = await window.appApi.importMedia();
                                          if (result && result.importedAssets.length > 0) {
                                            const normalizedImportedAssets = decorateImportedAssetsForContext(
                                              project.data,
                                              result.importedAssets,
                                              selectedSection.id,
                                            );
                                            setProject((prev) => {
                                              if (!prev) return prev;
                                              return {
                                                ...prev,
                                                data: appendAssetsAndUpdateSection(
                                                  prev.data,
                                                  selectedSection.id,
                                                  normalizedImportedAssets,
                                                  { background: `url('${toMediaUrl(normalizedImportedAssets[0].relativePath)}')` },
                                                ),
                                              };
                                            });
                                            setIsDirty(true);
                                          }
                                        }}
                                        className="break-editor-btn"
                                      >
                                        Import File
                                      </button>
                                    </div>
                                    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "#a9b5cd" }}>
                                      Scale ({(bgTransform.scale ?? 1).toFixed(1)}x)
                                      <input className="break-editor-range" type="range" min={0.5} max={3} step={0.1} value={bgTransform.scale ?? 1} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...bgTransform, scale: Number(e.target.value) } })} />
                                    </label>
                                    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "#a9b5cd" }}>
                                      Blur ({Math.round(bgTransform.blur ?? 0)}px)
                                      <input className="break-editor-range" type="range" min={0} max={20} step={1} value={bgTransform.blur ?? 0} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...bgTransform, blur: Number(e.target.value) } })} />
                                    </label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "#a9b5cd" }}>
                                        X ({Math.round(bgTransform.x ?? 0)})
                                        <input className="break-editor-range" type="range" min={-100} max={100} step={1} value={bgTransform.x ?? 0} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...bgTransform, x: Number(e.target.value) } })} />
                                      </label>
                                      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: "0.72rem", color: "#a9b5cd" }}>
                                        Y ({Math.round(bgTransform.y ?? 0)})
                                        <input className="break-editor-range" type="range" min={-100} max={100} step={1} value={bgTransform.y ?? 0} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...bgTransform, y: Number(e.target.value) } })} />
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "10px", borderTop: "1px solid #444", paddingTop: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Images</span>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              onClick={async () => {
                                if (!project) return;
                                const result = await window.appApi.importMedia();
                                if (result && result.createdSlides && result.createdSlides.length > 0) {
                                  const newMedia = result.createdSlides.map((s, i) => ({ id: `img-${Date.now()}-${i}`, slideId: s.id, fit: "contain" as const }));
                                  const normalizedImportedAssets = decorateImportedAssetsForContext(
                                    project.data,
                                    result.importedAssets,
                                    selectedSection.id,
                                  );
                                  const nextAssets = [...project.data.assets, ...normalizedImportedAssets];
                                  const nextSlides = [...project.data.slides, ...result.createdSlides.map(s => ({ ...s, sectionId: selectedSection.id }))];
                                  const nextBreakMedia = [...(selectedSection.breakMedia || []), ...newMedia];
                                  setProject({
                                    ...project,
                                    data: {
                                      ...project.data,
                                      assets: nextAssets,
                                      slides: nextSlides,
                                      sections: project.data.sections.map(s => s.id === selectedSection.id ? { ...s, breakMedia: nextBreakMedia } : s)
                                    }
                                  });
                                  setIsDirty(true);
                                }
                              }}
                              style={{ background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}
                            >
                              + Local
                            </button>
                            <button
                              onClick={() => setShowSlideSelector(true)}
                              style={{ background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}
                            >
                              + Project
                            </button>
                          </div>
                        </div>
                        {selectedSection.breakMedia && selectedSection.breakMedia.map((m, i) => {
                          const slide = project?.data.slides.find((s) => s.id === m.slideId);
                          return (
                            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4, background: "#222", padding: "6px", borderRadius: 4 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.7rem", color: "#ccc", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                                  {slide ? getSlideDisplayName(slide, "edit") : `Image ${i + 1}`}
                                </span>
                                <button
                                  onClick={() => {
                                    const arr = [...(selectedSection.breakMedia || [])];
                                    arr.splice(i, 1);
                                    updateSection(selectedSection.id, { breakMedia: arr });
                                  }}
                                  title="Remove image"
                                  style={{ background: "transparent", border: "none", color: "#ff6666", cursor: "pointer", padding: 0 }}
                                >
                                  X
                                </button>
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-end" }}>
                                <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column", minWidth: 60 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    X
                                    <div style={{ display: "flex", gap: 2 }}>
                                      <button onClick={() => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, x: (Number(m.x) || 0) - 10 }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ padding: "0 2px", background: "#444", border: "none", color: "#bbb", fontSize: "0.6rem", cursor: "pointer" }}>-10</button>
                                      <button onClick={() => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, x: (Number(m.x) || 0) + 10 }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ padding: "0 2px", background: "#444", border: "none", color: "#bbb", fontSize: "0.6rem", cursor: "pointer" }}>+10</button>
                                    </div>
                                  </div>
                                  <input type="text" value={m.x ?? 0} onBlur={(e) => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, x: Number(e.target.value) || 0 }; updateSection(selectedSection.id, { breakMedia: arr }) }} onChange={(e) => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, x: e.target.value as any }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem", width: "100%" }} />
                                </label>

                                <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column", minWidth: 60 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    Y
                                    <div style={{ display: "flex", gap: 2 }}>
                                      <button onClick={() => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, y: (Number(m.y) || 0) - 10 }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ padding: "0 2px", background: "#444", border: "none", color: "#bbb", fontSize: "0.6rem", cursor: "pointer" }}>-10</button>
                                      <button onClick={() => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, y: (Number(m.y) || 0) + 10 }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ padding: "0 2px", background: "#444", border: "none", color: "#bbb", fontSize: "0.6rem", cursor: "pointer" }}>+10</button>
                                    </div>
                                  </div>
                                  <input type="text" value={m.y ?? 0} onBlur={(e) => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, y: Number(e.target.value) || 0 }; updateSection(selectedSection.id, { breakMedia: arr }) }} onChange={(e) => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, y: e.target.value as any }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem", width: "100%" }} />
                                </label>

                                <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column", minWidth: 60 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    SCL
                                    <div style={{ display: "flex", gap: 2 }}>
                                      <button onClick={() => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, scale: Math.max(0.1, (Number(m.scale) || 1) - 0.1) }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ padding: "0 2px", background: "#444", border: "none", color: "#bbb", fontSize: "0.6rem", cursor: "pointer" }}>-</button>
                                      <button onClick={() => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, scale: (Number(m.scale) || 1) + 0.1 }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ padding: "0 2px", background: "#444", border: "none", color: "#bbb", fontSize: "0.6rem", cursor: "pointer" }}>+</button>
                                    </div>
                                  </div>
                                  <input type="number" step="0.1" value={m.scale ?? 1} onChange={(e) => { const arr = [...(selectedSection.breakMedia || [])]; arr[i] = { ...m, scale: Number(e.target.value) }; updateSection(selectedSection.id, { breakMedia: arr }) }} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem", width: "100%" }} />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "10px", borderTop: "1px solid #444", paddingTop: "10px" }}>
                        <h4 style={{ margin: 0, color: "#fff" }}>Timer</h4>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Mode</span>
                          <select
                            value={selectedSection.timerMode ?? "countup"}
                            onChange={(e) => updateSection(selectedSection.id, { timerMode: e.target.value as any })}
                            style={{ flex: 1, background: "#111", border: "1px solid #333", color: "#fff", padding: "4px", borderRadius: 4 }}
                          >
                            <option value="countup">Count Up (Timer)</option>
                            <option value="countdown">Count Down (Stopwatch)</option>
                          </select>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, width: "100px" }}>
                            <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Size</span>
                            <input
                              type="number"
                              min="1"
                              step="0.1"
                              value={selectedSection.timerSize || 4.0}
                              onChange={(e) => updateSection(selectedSection.id, { timerSize: Number(e.target.value) })}
                              style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "4px", borderRadius: 4, width: "100%" }}
                            />
                          </label>
                        </label>
                        {selectedSection.timerMode === "countdown" && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Min</span>
                              <input
                                type="number" min="0" value={Math.floor((selectedSection.timerDuration ?? 300) / 60)}
                                onChange={(e) => { const mins = Number(e.target.value); const secs = (selectedSection.timerDuration ?? 300) % 60; updateSection(selectedSection.id, { timerDuration: mins * 60 + secs }); }}
                                style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "4px", borderRadius: 4 }}
                              />
                            </label>
                            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Sec</span>
                              <input
                                type="number" min="0" max="59" value={(selectedSection.timerDuration ?? 300) % 60}
                                onChange={(e) => { const secs = Number(e.target.value); const mins = Math.floor((selectedSection.timerDuration ?? 300) / 60); updateSection(selectedSection.id, { timerDuration: mins * 60 + secs }); }}
                                style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "4px", borderRadius: 4 }}
                              />
                            </label>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ flex: 1, padding: "6px", background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }} onClick={toggleTimer}>
                            {timerState.isRunning ? "Stop" : "Start"}
                          </button>
                          <button style={{ flex: 1, padding: "6px", background: "#3a3a4a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }} onClick={resetTimer}>
                            Reset
                          </button>
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={selectedSection.timer ?? false} onChange={(e) => updateSection(selectedSection.id, { timer: e.target.checked })} />
                          <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Show timer to viewers</span>
                        </label>
                      </div>

                      <div style={{ marginTop: "10px", borderTop: "1px solid #444", paddingTop: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <h4 style={{ margin: 0, color: "#fff" }}>Break Music</h4>
                          <button
                            onClick={async () => {
                              if (!project) return;
                              try {
                                const importedAssets = await window.appApi.importAudio();
                                if (!importedAssets || importedAssets.length === 0) return;

                                const normalizedImportedAssets = decorateImportedAssetsForContext(project.data, importedAssets);
                                const newClips = normalizedImportedAssets.map(a => ({
                                  url: toMediaUrl(a.relativePath),
                                  volume: 1,
                                  name: getAssetDescription(a),
                                  fadeEnabled: true
                                }));

                                const nextAssets = [...project.data.assets, ...normalizedImportedAssets];
                                const nextBgm = [...(selectedSection.bgm || []), ...newClips];

                                setProject({
                                  ...project,
                                  data: {
                                    ...project.data,
                                    assets: nextAssets,
                                    sections: project.data.sections.map(s => s.id === selectedSection.id ? { ...s, bgm: nextBgm } : s)
                                  }
                                });
                                setIsDirty(true);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            style={{ background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem" }}
                          >
                            + Audio (File)
                          </button>
                        </div>
                        {(selectedSection.bgm ?? []).map((clip, idx) => (
                          <AudioClipPlayer
                            key={idx}
                            clip={clip}
                            label={`BTM ${idx + 1}`}
                            onUpdate={(updates) => {
                              const bgm = [...selectedSection.bgm!];
                              bgm[idx] = { ...bgm[idx], ...updates };
                              updateSection(selectedSection.id, { bgm });
                            }}
                            onPlay={(url, vol, opts) => audioManager.playClip(url, vol, true, { fadeEnabled: opts?.fadeEnabled || false }, "section-bgm")}
                            onPause={(url) => audioManager.pauseClip(url)}
                            onStop={(url, opts) => audioManager.stopClip(url, { fadeEnabled: opts?.fadeEnabled || false })}
                            showRemove={true}
                            onRemove={() => {
                              audioManager.stopClip(clip.url, { fadeEnabled: clip.fadeEnabled || false });
                              const bgm = [...selectedSection.bgm!];
                              bgm.splice(idx, 1);
                              updateSection(selectedSection.id, { bgm });
                            }}
                          />
                        ))}
                      </div>

                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => setShowBreakEditor(false)}
                        className="break-editor-btn"
                        style={{ padding: "10px", marginTop: 10, fontWeight: "bold" }}
                      >
                        Done
                      </button>
                    </div>
                  )}
                  <ZoomPanWrapper
                    className="break-stage-wrapper"
                    drawSettings={drawSettings}
                    markerStrokes={selectedSection.markerStrokes ?? []}
                    contentWidth={1920}
                    contentHeight={1080}
                    onMarkerStrokesChange={(strokes) =>
                      updateSection(selectedSection.id, { markerStrokes: strokes })
                    }
                    clearSignal={drawClearSignal}
                    initialViewport={selectedSection.breakViewport}
                    onViewportChange={(vp) => {
                      if (appMode === "edit" || (appMode === "teach" && !selectedSection.breakViewport)) { // Try recording it the first time Teach interacts with it? Actually user wants Edit changes saved. Let's record in both places, or maybe strictly edit. Let's just do it broadly for break. Wait, user specifically said "Update viewport state whenever the user changes pan/zoom in Edit".
                        if (appMode === "edit") {
                          updateSection(selectedSection.id, { breakViewport: vp });
                        }
                      }
                    }}
                  >
                    <div
                      className="break-stage"
                      onContextMenu={handleStageContextMenu}
                      style={{
                        backgroundColor: selectedSection.background && !selectedSection.background.startsWith("url") ? undefined : "#111",
                        background: selectedSection.bgTransform && selectedSection.bgTransform.blur ? "transparent" : (selectedSection.background || "#111"),
                        backgroundRepeat: "no-repeat",
                        backgroundSize: selectedSection.bgTransform ? `${(selectedSection.bgTransform.scale ?? 1) * 100}%` : "cover",
                        backgroundPosition: selectedSection.bgTransform ? `calc(50% + ${selectedSection.bgTransform.x ?? 0}px) calc(50% + ${selectedSection.bgTransform.y ?? 0}px)` : "center",
                        width: 1920,
                        height: 1080,
                        position: "relative",
                        overflow: "hidden",
                        transformOrigin: "top left", // Handled by wrapper
                      }}
                    >
                      {selectedSection.bgTransform && selectedSection.bgTransform.blur && selectedSection.background?.startsWith("url") ? (
                        <div style={{ position: "absolute", zIndex: -1, inset: -100, pointerEvents: "none", background: selectedSection.background || "#111", backgroundRepeat: "no-repeat", backgroundSize: `${(selectedSection.bgTransform.scale ?? 1) * 100}%`, backgroundPosition: `calc(50% + ${selectedSection.bgTransform.x ?? 0}px) calc(50% + ${selectedSection.bgTransform.y ?? 0}px)`, filter: `blur(${selectedSection.bgTransform.blur}px)` }} />
                      ) : null}
                      {/* Thumbnails at Top */}
                      <div className="break-thumbnails-grid">
                        {(selectedSection.breakMedia ?? []).map((m) => {
                          const slide = project?.data.slides.find(
                            (s) => s.id === m.slideId,
                          );
                          const asset = slide ? assetsById.get(slide.assetId) : null;
                          if (!asset) return null;
                          const src = toMediaUrl(asset.relativePath);
                          const baseWidth = selectedSection.thumbnailSize ?? 200;
                          const baseHeight = baseWidth * 0.5625;
                          const scale = m.scale ?? 1;
                          return (
                            <div
                              key={m.id}
                              style={{
                                position: "relative",
                                width: baseWidth * scale,
                                height: baseHeight * scale,
                                transform: `translate(${m.x ?? 0}px, ${m.y ?? 0}px)`,
                                cursor: appMode === "edit" ? "move" : "default",
                                outline:
                                  breakThumbDrag?.mediaId === m.id
                                    ? "2px solid rgba(123, 173, 255, 0.95)"
                                    : "none",
                                borderRadius: 8,
                              }}
                              onMouseDown={(event) => {
                                if (appMode !== "edit") return;
                                event.preventDefault();
                                event.stopPropagation();
                                setBreakThumbDrag({
                                  sectionId: selectedSection.id,
                                  mediaId: m.id,
                                  mode: "move",
                                  startClientX: event.clientX,
                                  startClientY: event.clientY,
                                  startX: Number(m.x) || 0,
                                  startY: Number(m.y) || 0,
                                  startScale: Number(m.scale) || 1,
                                });
                              }}
                            >
                              <img
                                src={src}
                                className="break-stage-thumb"
                                style={{
                                  objectFit: m.fit,
                                  width: "100%",
                                  height: "100%",
                                }}
                              />
                              {appMode === "edit" && (
                                <div
                                  style={{
                                    position: "absolute",
                                    width: 12,
                                    height: 12,
                                    right: -6,
                                    bottom: -6,
                                    borderRadius: "50%",
                                    background: "#fff",
                                    border: "2px solid #4f79d6",
                                    cursor: "nwse-resize",
                                  }}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setBreakThumbDrag({
                                      sectionId: selectedSection.id,
                                      mediaId: m.id,
                                      mode: "scale",
                                      startClientX: event.clientX,
                                      startClientY: event.clientY,
                                      startX: Number(m.x) || 0,
                                      startY: Number(m.y) || 0,
                                      startScale: Number(m.scale) || 1,
                                    });
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Content Overlay */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems:
                            selectedSection.align === "left"
                              ? "flex-start"
                              : selectedSection.align === "right"
                                ? "flex-end"
                                : "center",
                          justifyContent:
                            selectedSection.position === "top"
                              ? "flex-start"
                              : selectedSection.position === "bottom"
                                ? "flex-end"
                                : "center",
                          width: "100%",
                          padding: "40px",
                          fontFamily: selectedSection.font,
                          color: (selectedSection as any).textColor || "#ffffff",
                          flex: 1,
                        }}
                      >
                        <div className="break-title" style={{ fontSize: selectedSection.titleFontSize ? `${selectedSection.titleFontSize}px` : "2.5rem" }}>
                          {selectedSection.name}
                        </div>
                        <div
                          className="break-questions"
                          style={{
                            fontSize: selectedSection.fontSize,
                            fontWeight: selectedSection.isBold ? "bold" : "normal",
                            fontStyle: selectedSection.isItalic ? "italic" : "normal",
                          }}
                        >
                          {selectedSection.questions}
                        </div>
                        {selectedSection.timer && (
                          <div className="break-timer" style={{ fontSize: selectedSection.timerSize ? `${selectedSection.timerSize}rem` : "4.0rem" }}>
                            {(() => {
                              const elapsedMs =
                                timerState.accumulated +
                                (timerState.isRunning
                                  ? timerNow - timerState.startTime
                                  : 0);
                              const elapsedSec = Math.floor(elapsedMs / 1000);
                              const displaySec =
                                selectedSection.timerMode === "countdown"
                                  ? (selectedSection.timerDuration ?? 300) -
                                  elapsedSec
                                  : elapsedSec;
                              // Clamp countdown to 0? Or allow negative? Usually stop at 0.
                              // User said "to 00:00". So clamp.
                              const finalSec =
                                selectedSection.timerMode === "countdown"
                                  ? Math.max(0, displaySec)
                                  : displaySec;
                              return formatTime(finalSec);
                            })()}
                          </div>
                        )}
                      </div>

                      {((topMode === "story" && storyACardRefs.length > 0) || (topMode === "boost" && boostTab === "language" && boostLanguageACardRefs.length > 0)) && (
                        <div style={{ position: "absolute", inset: 0, zIndex: 34, pointerEvents: "none" }}>
                          {(topMode === "story" ? storyACardRefs : boostLanguageACardRefs).map((ref) => (
                            <ACardStageRenderer
                              key={ref.id}
                              aCardId={ref.aCardId}
                              teachStates={overlayBCardTeachStates}
                              mode={appMode}
                              selectedInstanceId={selectedPlacedBCardId}
                              onInstanceClick={(instanceId) => handlePlacedACardInstanceClick(instanceId)}
                              onInstanceChange={appMode === "edit" ? (instanceId, updates) => updateACardBCardInstance(ref.aCardId, instanceId, updates) : undefined}
                              resolveImageUrl={(id) => {
                                const asset = assetsById.get(id);
                                return asset ? toMediaUrl(asset.relativePath) : null;
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {activeOverlayBCardInstances.length > 0 && (
                        <BCardInstanceLayer
                          instances={activeOverlayBCardInstances}
                          mode={appMode}
                          selectedInstanceId={selectedOverlayBCardInstanceId}
                          onSelectInstance={setSelectedPlacedBCardId}
                          onInstanceChange={updatePlacedBCardInstance}
                          teachStates={overlayBCardTeachStates}
                          clickAction={overlayBCardClickAction}
                          onTeachStateChange={setOverlayBCardState}
                          resolveImageUrl={(id) => {
                            const asset = assetsById.get(id);
                            return asset ? toMediaUrl(asset.relativePath) : null;
                          }}
                        />
                      )}
                    </div>
                  </ZoomPanWrapper>
                </>
              ) : activeItem?.type === 'promptCard' ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef', color: '#111', borderRadius: 8 }}>
                  <div style={{ background: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: 600, textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: 20 }}>{activeItem.title || 'Prompt Card'}</h2>
                    <p style={{ fontSize: '1.25rem', whiteSpace: 'pre-wrap' }}>{activeItem.body || 'Add a prompt body in the tools panel.'}</p>
                  </div>
                </div>
              ) : activeItem?.type === 'miniGame' ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', color: '#fff', borderRadius: 8 }}>
                  <div style={{ textAlign: 'center', padding: 40, border: '2px dashed #444', borderRadius: 8 }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: 10 }}>Mini-Game</h2>
                    <p>Placeholder. Game logic not implemented.</p>
                  </div>
                </div>
              ) : activeItem?.type === 'breakRef' && !selectedSection ? (
                <div className="stage">
                  <div className="placeholder">Referenced break section not found.</div>
                </div>
              ) : (
                <>
                  <div
                    className="stage-controls"
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      padding: "10px",
                      background: "#222",
                      borderRadius: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <button
                      onClick={() => goToVisibleOffset(-1)}
                      disabled={!project || currentVisiblePos <= 0}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => goToVisibleOffset(1)}
                      disabled={
                        !project ||
                        currentVisiblePos < 0 ||
                        currentVisiblePos >= visibleSlideIndices.length - 1
                      }
                    >
                      Next
                    </button>

                    <div
                      style={{
                        width: 1,
                        height: 20,
                        background: "#444",
                        margin: "0 4px",
                      }}
                    />

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        fontSize: 10,
                      }}
                    >
                      Transition
                      <select
                        value={stagedTransition}
                        onChange={(e) =>
                          setStagedTransition(e.target.value as TransitionType)
                        }
                        disabled={!currentSlide}
                        style={{ padding: "2px 4px" }}
                      >
                        <option value="none">None</option>
                        <option value="fade">Fade</option>
                        <option value="crossfade">Crossfade</option>
                        <option value="fade-black">Fade Black</option>
                        <option value="cinematic">Cinematic</option>
                        <option value="blur">Blur</option>
                        <option value="pixel">Pixel Reveal</option>
                        <option value="card-slide">Card Slide</option>
                      </select>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        fontSize: 10,
                      }}
                    >
                      Direction
                      <select
                        value={stagedDirection}
                        onChange={(e) => setStagedDirection(e.target.value as any)}
                        style={{ padding: "2px 4px" }}
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                      </select>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        fontSize: 10,
                        minWidth: 100,
                      }}
                    >
                      Duration: {stagedDuration}ms
                      <input
                        type="range"
                        min={100}
                        max={4000}
                        step={100}
                        value={stagedDuration}
                        onChange={(e) => setStagedDuration(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </label>

                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      <button
                        onClick={applyTransitionToSection}
                        style={{ fontSize: 10, padding: "4px 8px" }}
                        title="Apply this transition to all slides in current section"
                      >
                        Apply to Section
                      </button>
                      <button
                        onClick={applyTransitionToSlide}
                        style={{ fontSize: 10, padding: "4px 8px" }}
                        title="Apply this transition only to current slide"
                      >
                        Apply to Slide
                      </button>
                    </div>

                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                        marginLeft: 10,
                      }}
                    >
                      <button
                        onClick={() => setDrawPanelCollapsed((v) => !v)}
                        style={{
                          background: !drawPanelCollapsed ? "#447" : undefined,
                          fontSize: 10,
                          padding: "4px 8px",
                        }}
                      >
                        Draw
                      </button>
                      {!drawPanelCollapsed && (
                        <div
                          className="draw-panel"
                          style={{
                            top: "100%",
                            right: 0,
                            left: "auto",
                            marginTop: 4,
                          }}
                        >
                          <label>
                            Tool
                            <select
                              value={drawSettings.tool}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  tool: event.target.value as DrawTool,
                                }))
                              }
                            >
                              <option value="highlighter">Highlighter</option>
                              <option value="marker">Marker</option>
                            </select>
                          </label>

                          <label>
                            Size
                            <input
                              type="range"
                              min={2}
                              max={36}
                              value={drawSettings.size}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  size: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label>
                            Opacity
                            <input
                              type="range"
                              min={0.1}
                              max={1}
                              step={0.05}
                              value={drawSettings.opacity}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  opacity: Number(event.target.value),
                                }))
                              }
                            />
                          </label>

                          {drawSettings.tool === "highlighter" && (
                            <label>
                              Fade (ms)
                              <input
                                type="range"
                                min={400}
                                max={6000}
                                step={100}
                                value={drawSettings.fadeMs}
                                onChange={(event) =>
                                  setDrawSettings((prev) => ({
                                    ...prev,
                                    fadeMs: Number(event.target.value),
                                  }))
                                }
                              />
                            </label>
                          )}

                          <label>
                            Color
                            <input
                              type="color"
                              value={drawSettings.color}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  color: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="draw-inline-check">
                            <input
                              type="checkbox"
                              checked={drawSettings.rainbow}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  rainbow: event.target.checked,
                                }))
                              }
                            />
                            Rainbow
                          </label>

                          <label className="draw-inline-check">
                            <input
                              type="checkbox"
                              checked={drawSettings.sparkle}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  sparkle: event.target.checked,
                                }))
                              }
                            />
                            Sparkle
                          </label>

                          <label className="draw-inline-check">
                            <input
                              type="checkbox"
                              checked={drawSettings.drawMode}
                              onChange={(event) =>
                                setDrawSettings((prev) => ({
                                  ...prev,
                                  drawMode: event.target.checked,
                                }))
                              }
                            />
                            Draw mode
                          </label>

                          <button onClick={clearCurrentSlideDrawings}>
                            Clear Drawings
                          </button>
                        </div>
                      )}
                    </div>

                    {appMode === "edit" && (
                      <div className="bubble-toolbar-menu">
                        <button
                          onClick={() => setBubblePanelOpen((v) => !v)}
                          disabled={!project || !currentSlide}
                          style={{
                            background: bubblePanelOpen ? "#465147" : undefined,
                            fontSize: 10,
                            padding: "4px 8px",
                          }}
                        >
                          Bubbles
                        </button>
                        {bubblePanelOpen && (
                          <div className="bubble-stage-panel">
                            <div className="bubble-stage-panel-header">
                              <strong>Bubbles on Slide</strong>
                              <button onClick={onAddBubble} disabled={!project || !currentSlide}>+ Add</button>
                            </div>
                            {currentSlide && (currentSlide.overlays || []).length > 0 ? (
                              <ul className="bubble-stage-list">
                                {[...(currentSlide.overlays || [])]
                                  .sort((a, b) => (a.bubbleId || "").localeCompare(b.bubbleId || ""))
                                  .map((ov) => {
                                    const def = BUBBLE_LIBRARY.find(lib => lib.bubbleDefId === ov.bubbleDefId);
                                    const templateName = def?.name || def?.templateName || "";
                                    const shortName = ov.text && ov.text.length > 28 ? ov.text.substring(0, 25) + "..." : ov.text;
                                    const label = `${ov.bubbleId || "Bubble"}${templateName ? ` (${templateName})` : ""}`;
                                    const isActive = activeOverlayId === ov.id;
                                    return (
                                      <li key={ov.id} className={isActive ? "bubble-stage-item active" : "bubble-stage-item"}>
                                        <button className="bubble-stage-select" onClick={() => setActiveOverlayId(ov.id)} title={shortName || label}>
                                          <span>{label}</span>
                                          {shortName && <small>{shortName}</small>}
                                        </button>
                                        <div className="bubble-stage-actions">
                                          <button onClick={() => onDuplicateBubble(ov)}>Duplicate</button>
                                          <button onClick={() => openCopyBubblePicker(ov)}>Copy to</button>
                                        </div>
                                      </li>
                                    );
                                  })}
                              </ul>
                            ) : (
                              <div className="bubble-stage-empty">No bubbles on this slide.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="stage" onContextMenu={handleStageContextMenu}>
                    {!currentAsset && (
                      <div className="placeholder">
                        {topMode === 'boost' && activeItem?.type === 'slideRef'
                          ? 'Selected Slide or Asset not found.'
                          : 'Import media to start presenting.'}
                      </div>
                    )}
                    {currentAsset && (
                      <div
                        className="media-layer"
                        style={
                          stageHasHalfACardOverlay
                            ? { position: "absolute", top: 0, left: 0, width: "100%", height: "50%" }
                            : undefined
                        }
                      >
                        {/* Outgoing Slide */}
                        {isAnimating && previousAsset && (
                          <MediaView
                            key={previousSlide?.id}
                            asset={previousAsset}
                            overlays={previousSlide?.overlays ?? []}
                            videoAudio={previousSlide?.videoAudio}
                            className={`media ${currentSlide?.transition === "card-slide"
                              ? `transition-card-slide-${currentSlide.transitionDirection ?? "left"}-out`
                              : `transition-${currentSlide?.transition ?? "fade"}-out`
                              }`}
                            style={
                              {
                                "--transition-duration":
                                  (currentSlide?.transitionDuration ?? 500) + "ms",
                              } as any
                            }
                            drawSettings={drawSettings}
                            markerStrokes={previousSlide?.markerStrokes ?? []}
                            onMarkerStrokesChange={() => undefined}
                            clearSignal={drawClearSignal}
                            initialZoom={viewportRef.current.zoom}
                            initialPan={viewportRef.current.pan}
                            paused={true}
                            initialTime={lastMediaTimeRef.current}
                            showControls={false}
                            bubbleDefinitions={project?.data.bubbleDefinitions}
                          />
                        )}
                        {/* Incoming Slide */}
                        <MediaView
                          key={currentSlide?.id}
                          asset={currentAsset}
                          overlays={currentSlide?.overlays ?? []}
                          videoAudio={currentSlide?.videoAudio}
                          className={`media ${currentSlide?.transition === "card-slide"
                            ? `transition-card-slide-${currentSlide.transitionDirection ?? "left"}-in`
                            : `transition-${currentSlide?.transition ?? "fade"}-in`
                            }`}
                          style={
                            {
                              "--transition-duration":
                                (currentSlide?.transitionDuration ?? 500) + "ms",
                            } as any
                          }
                          drawSettings={drawSettings}
                          markerStrokes={currentSlide?.markerStrokes ?? []}
                          onMarkerStrokesChange={(strokes) =>
                            updateCurrentSlideMarkerStrokes(strokes)
                          }
                          clearSignal={drawClearSignal}
                          initialZoom={viewportRef.current.zoom}
                          initialPan={viewportRef.current.pan}
                          onViewportChange={(v) => {
                            viewportRef.current = v;
                          }}
                          paused={false}
                          onTimeUpdate={(t) => {
                            lastMediaTimeRef.current = t;
                          }}
                          showControls={true}
                          isEditMode={appMode === "edit"}
                          activeOverlayId={activeOverlayId}
                          showOverlayIds={appMode === "edit"}
                          onOverlaySelect={setActiveOverlayId}
                          onOverlayChange={(id, updates) => {
                            if (!project || !currentSlide) return;
                            const nextOverlays = (currentSlide.overlays || []).map((o) =>
                              o.id === id ? { ...o, ...updates } : o
                            );
                            setProject({
                              ...project,
                              data: {
                                ...project.data,
                                slides: project.data.slides.map((s) => (s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s)),
                              },
                            });
                            setIsDirty(true);
                          }}
                          videoTrim={currentSlide?.videoTrim}
                          onVideoTrimChange={(videoTrim) => {
                            if (!project || !currentSlide) return;
                            setProject({
                              ...project,
                              data: {
                                ...project.data,
                                slides: project.data.slides.map((s) =>
                                  s.id === currentSlide.id ? { ...s, videoTrim } : s
                                ),
                              },
                            });
                            setIsDirty(true);
                          }}
                          imageAdjustments={currentSlide?.imageAdjustments}
                          onImageAdjustmentsChange={(imageAdjustments) => {
                            if (!project || !currentSlide) return;
                            setProject({
                              ...project,
                              data: {
                                ...project.data,
                                slides: project.data.slides.map((s) =>
                                  s.id === currentSlide.id ? { ...s, imageAdjustments } : s
                                ),
                              },
                            });
                            setIsDirty(true);
                          }}
                          bubbleDefinitions={project?.data.bubbleDefinitions}
                        />
                      </div>
                    )}

                    {((topMode === "story" && storyACardRefs.length > 0) || (topMode === "boost" && boostTab === "language" && boostLanguageACardRefs.length > 0)) && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 34, pointerEvents: "none" }}>
                        {(topMode === "story" ? storyACardRefs : boostLanguageACardRefs).map((ref) => (
                          <ACardStageRenderer
                            key={ref.id}
                            aCardId={ref.aCardId}
                            teachStates={overlayBCardTeachStates}
                            mode={appMode}
                            selectedInstanceId={selectedPlacedBCardId}
                            onInstanceClick={(instanceId) => handlePlacedACardInstanceClick(instanceId)}
                            onInstanceChange={appMode === "edit" ? (instanceId, updates) => updateACardBCardInstance(ref.aCardId, instanceId, updates) : undefined}
                            resolveImageUrl={(id) => {
                              const asset = assetsById.get(id);
                              return asset ? toMediaUrl(asset.relativePath) : null;
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {activeOverlayBCardInstances.length > 0 && (
                      <BCardInstanceLayer
                        instances={activeOverlayBCardInstances}
                        mode={appMode}
                        selectedInstanceId={selectedOverlayBCardInstanceId}
                        onSelectInstance={setSelectedPlacedBCardId}
                        onInstanceChange={updatePlacedBCardInstance}
                        teachStates={overlayBCardTeachStates}
                        clickAction={overlayBCardClickAction}
                        onTeachStateChange={setOverlayBCardState}
                        resolveImageUrl={(id) => {
                          const asset = assetsById.get(id);
                          return asset ? toMediaUrl(asset.relativePath) : null;
                        }}
                      />
                    )}
                  </div>
                </>
              )}
            </main>

            <aside className="audio-sidebar">
              {topMode === 'story' || topMode === 'relics' ? (
                <>
                  <div className="audio-block" style={{ border: '1px solid #3a475f', background: 'linear-gradient(180deg, #1a202b, #171b24)', order: 90 }}>
                    <h4
                      onClick={() => setStoryRefsCollapsed((v) => !v)}
                      style={{ margin: "0", color: "#a9c7ff", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    >
                      Story Scene Attachments
                      <span>{storyRefsCollapsed ? ">" : "v"}</span>
                    </h4>
                    {!storyRefsCollapsed && (
                      <>
                        <p style={{ margin: "8px 0 8px 0", fontSize: "0.75rem", color: "#8896af" }}>
                          {storyBCardHost
                            ? `Target: ${storyBCardHost.target === "break" ? "Break" : "Slide"}`
                            : "Select a slide or break to attach references."}
                        </p>
                        {canEditStoryRefs && (
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <button
                              style={{ flex: 1, padding: "6px", fontSize: "0.75rem", background: "#233b2c", border: "1px solid #3f6f51", color: "#c6f3d0", borderRadius: 4 }}
                              onClick={() => addStoryReference("aCardRef")}
                              disabled={!storyRefContext}
                            >
                              + ACard Board
                            </button>
                            <button
                              style={{ flex: 1, padding: "6px", fontSize: "0.75rem", background: "#24343d", border: "1px solid #456576", color: "#c3ebff", borderRadius: 4 }}
                              onClick={() => addStoryReference("bCard")}
                              disabled={!storyBCardHost}
                            >
                              + BCard Overlay
                            </button>
                          </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <h5 style={{ margin: 0, color: "#b9dbff", fontSize: "0.8rem" }}>ACard Boards</h5>
                            {(storyRefContext?.refs?.length || 0) > 0 ? (
                              storyRefContext!.refs.map((ref, index, arr) => {
                                const isSelected = selectedStoryRefId === ref.id;
                                const title = `ACard: ${((project?.data.aCardLibrary || {})[ref.aCardId]?.name || ref.aCardId || "(missing)")}`;
                                return (
                                  <div
                                    key={ref.id}
                                    onClick={() => setSelectedStoryRefId(ref.id)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "6px",
                                      background: isSelected ? "#28374f" : "#1a1f2a",
                                      border: isSelected ? "1px solid #78b3ff" : "1px solid #2f3a4e",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span style={{ flex: 1, fontSize: "0.75rem", color: "#d9e2f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {index + 1}. {title}
                                    </span>
                                    {canEditStoryRefs && (
                                      <>
                                        <button style={{ padding: "2px 6px", fontSize: "0.72rem", background: "transparent", border: "none", color: "#8aa8d9", cursor: index === 0 ? "default" : "pointer" }} disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveStoryReference(ref.id, "up"); }}>^</button>
                                        <button style={{ padding: "2px 6px", fontSize: "0.72rem", background: "transparent", border: "none", color: "#8aa8d9", cursor: index === arr.length - 1 ? "default" : "pointer" }} disabled={index === arr.length - 1} onClick={(e) => { e.stopPropagation(); moveStoryReference(ref.id, "down"); }}>v</button>
                                        <button style={{ padding: "2px 6px", fontSize: "0.72rem", background: "transparent", border: "none", color: "#f88", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); removeStoryReference(ref.id); }}>X</button>
                                      </>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ fontSize: "0.75rem", color: "#6f7f9d", textAlign: "center", padding: "8px 0" }}>
                                No ACard boards on this target.
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <h5 style={{ margin: 0, color: "#b9dbff", fontSize: "0.8rem" }}>BCard Overlays</h5>
                            {(storyBCardHost?.instances.length || 0) > 0 ? (
                              storyBCardHost!.instances.map((instance, index) => {
                                const bCard = (project?.data.bCardLibrary || {})[instance.bCardId];
                                const isSelected = selectedPlacedBCardId === instance.id;
                                return (
                                  <div
                                    key={instance.id}
                                    onClick={() => setSelectedPlacedBCardId(instance.id)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "6px",
                                      background: isSelected ? "#27404a" : "#1a1f2a",
                                      border: isSelected ? "1px solid #7be8df" : "1px solid #2f3a4e",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span style={{ flex: 1, fontSize: "0.75rem", color: "#d9e2f3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {index + 1}. {bCard?.name || instance.bCardId || "(missing)"}
                                    </span>
                                    {canEditStoryRefs && (
                                      <button style={{ padding: "2px 6px", fontSize: "0.72rem", background: "transparent", border: "none", color: "#f88", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); removePlacedBCardInstance(instance.id); }}>X</button>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ fontSize: "0.75rem", color: "#6f7f9d", textAlign: "center", padding: "8px 0" }}>
                                No BCard overlays on this target.
                              </div>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const selectedRef = storyRefContext?.refs.find((item) => item.id === selectedStoryRefId) || null;
                          if (!selectedRef) return null;
                          return (
                            <div style={{ marginTop: 10, borderTop: "1px solid #2f3a4e", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                              <h5 style={{ margin: 0, color: "#b9dbff", fontSize: "0.8rem" }}>Edit ACard Reference</h5>
                              <select
                                value={selectedRef.aCardId}
                                onChange={(e) => updateStoryReference(selectedRef.id, { aCardId: e.target.value } as any)}
                                style={{ background: "#18202c", color: "#fff", border: "1px solid #395170", borderRadius: 4, padding: "6px" }}
                                disabled={!canEditStoryRefs}
                              >
                                <option value="">(Select an ACard)</option>
                                {Object.values(project?.data.aCardLibrary || {}).map((ac) => (
                                  <option key={ac.id} value={ac.id}>{ac.name}</option>
                                ))}
                              </select>
                              {canEditStoryRefs && selectedRef.aCardId && (
                                <div style={{ minHeight: 360, overflow: "hidden", border: "1px solid #2f3a4e", borderRadius: 8 }}>
                                  <ACardEditor
                                    aCardId={selectedRef.aCardId}
                                    selectedInstanceId={selectedPlacedBCardId}
                                    onSelectInstance={(id) => setSelectedPlacedBCardId(id || null)}
                                    assets={project?.data.assets || []}
                                    resolveImageUrl={(id) => {
                                      const asset = assetsById.get(id);
                                      return asset ? toMediaUrl(asset.relativePath) : null;
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(() => {
                          const selectedInstance = storyBCardHost?.instances.find((item) => item.id === selectedPlacedBCardId) || null;
                          if (!selectedInstance) return null;
                          return (
                            <div style={{ marginTop: 10, borderTop: "1px solid #2f3a4e", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                              <h5 style={{ margin: 0, color: "#b9dbff", fontSize: "0.8rem" }}>Edit BCard Overlay</h5>
                              <select
                                value={selectedInstance.bCardId}
                                onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { bCardId: e.target.value })}
                                style={{ background: "#18202c", color: "#fff", border: "1px solid #395170", borderRadius: 4, padding: "6px" }}
                                disabled={!canEditStoryRefs}
                              >
                                <option value="">(Select a BCard)</option>
                                {Object.values(project?.data.bCardLibrary || {}).map((bc) => (
                                  <option key={bc.id} value={bc.id}>{bc.name}</option>
                                ))}
                              </select>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#9bb2d7" }}>
                                  Width
                                  <input type="number" min={40} value={selectedInstance.size.width} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { size: { ...selectedInstance.size, width: parseInt(e.target.value, 10) || 270 } })} style={{ background: "#18202c", color: "#fff", border: "1px solid #395170", borderRadius: 4, padding: "6px" }} />
                                </label>
                                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#9bb2d7" }}>
                                  Height
                                  <input type="number" min={40} value={selectedInstance.size.height} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { size: { ...selectedInstance.size, height: parseInt(e.target.value, 10) || 390 } })} style={{ background: "#18202c", color: "#fff", border: "1px solid #395170", borderRadius: 4, padding: "6px" }} />
                                </label>
                              </div>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#9bb2d7" }}>
                                Z Index
                                <input type="number" min={1} value={selectedInstance.zIndex} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { zIndex: parseInt(e.target.value, 10) || 1 })} style={{ background: "#18202c", color: "#fff", border: "1px solid #395170", borderRadius: 4, padding: "6px" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#9bb2d7" }}>
                                Frame Style
                                <select value={selectedInstance.displayMode || "overlay"} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { displayMode: e.target.value as "overlay" | "board" })} style={{ background: "#18202c", color: "#fff", border: "1px solid #395170", borderRadius: 4, padding: "6px" }}>
                                  <option value="overlay">Overlay</option>
                                  <option value="board">Board Shell</option>
                                </select>
                              </label>
                              {selectedOverlayBCardInstanceId === selectedInstance.id && selectedOverlayBCardState && (
                                <div style={{ borderTop: "1px solid #2f3a4e", paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                                  <h5 style={{ margin: 0, color: "#b9dbff", fontSize: "0.8rem" }}>Preview Actions</h5>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isFlipped")} style={{ padding: "6px", background: selectedOverlayBCardState.isFlipped ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Flip</button>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isBlurred")} style={{ padding: "6px", background: selectedOverlayBCardState.isBlurred ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Blur</button>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isCovered")} style={{ padding: "6px", background: selectedOverlayBCardState.isCovered ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Cover</button>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isZoomed")} style={{ padding: "6px", background: selectedOverlayBCardState.isZoomed ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Zoom</button>
                                  </div>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#99b5cd" }}>
                                    Card Click Action
                                    <select value={overlayBCardClickAction} onChange={(e) => setOverlayBCardClickAction(e.target.value as BCardOverlayClickAction)} style={{ background: "#1a2530", color: "#fff", border: "1px solid #486579", borderRadius: 4, padding: "6px" }}>
                                      <option value="flip">Flip</option>
                                      <option value="none">None</option>
                                      <option value="blur">Blur</option>
                                      <option value="cover">Cover</option>
                                      <option value="zoom">Zoom</option>
                                    </select>
                                  </label>
                                  <button onClick={resetSelectedOverlayBCardState} style={{ padding: "6px", background: "#372831", border: "1px solid #6f4c5e", color: "#ffd9ea", borderRadius: 4 }}>
                                    Reset Preview State
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {appMode === "teach" && activeOverlayBCardInstances.length > 0 && selectedOverlayBCardInstanceId && selectedOverlayBCardState && (
                    <div className="audio-block" style={{ border: "1px solid #3f5968", background: "linear-gradient(180deg, #182129, #121920)", order: 91 }}>
                      <h4
                        onClick={() => setStoryBCardTeachCollapsed((v) => !v)}
                        style={{ margin: 0, color: "#9ecbff", fontSize: "0.88rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      >
                        BCard Teach Actions
                        <span>{storyBCardTeachCollapsed ? ">" : "v"}</span>
                      </h4>
                      {!storyBCardTeachCollapsed && (
                        <>
                          <p style={{ margin: "8px 0 8px 0", fontSize: "0.74rem", color: "#8098b0" }}>
                            Controls are stage-safe and live only in this sidebar.
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <button onClick={() => toggleSelectedOverlayBCardState("isFlipped")} style={{ padding: "6px", background: selectedOverlayBCardState.isFlipped ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Flip</button>
                            <button onClick={() => toggleSelectedOverlayBCardState("isBlurred")} style={{ padding: "6px", background: selectedOverlayBCardState.isBlurred ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Blur</button>
                            <button onClick={() => toggleSelectedOverlayBCardState("isCovered")} style={{ padding: "6px", background: selectedOverlayBCardState.isCovered ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Cover</button>
                            <button onClick={() => toggleSelectedOverlayBCardState("isZoomed")} style={{ padding: "6px", background: selectedOverlayBCardState.isZoomed ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Zoom</button>
                          </div>
                          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, fontSize: "0.75rem", color: "#99b5cd" }}>
                            Card Click Action
                            <select
                              value={overlayBCardClickAction}
                              onChange={(e) => setOverlayBCardClickAction(e.target.value as BCardOverlayClickAction)}
                              style={{ background: "#1a2530", color: "#fff", border: "1px solid #486579", borderRadius: 4, padding: "6px" }}
                            >
                              <option value="none">None</option>
                              <option value="flip">Flip</option>
                              <option value="blur">Blur</option>
                              <option value="cover">Cover</option>
                              <option value="zoom">Zoom</option>
                            </select>
                          </label>
                          <button onClick={resetSelectedOverlayBCardState} style={{ marginTop: 8, padding: "6px", background: "#372831", border: "1px solid #6f4c5e", color: "#ffd9ea", borderRadius: 4 }}>
                            Reset Card State
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {(() => {
                    const activeOverlay = currentSlide?.overlays?.find(o => o.id === activeOverlayId);
                    return activeOverlay && appMode === "edit" ? (
                      <div className="audio-block" style={{ border: '1px solid #55f', background: '#1a1a24' }}>
                        <h4 style={{ color: '#88f', margin: '4px 0 8px 0' }}>Selected Bubble: {activeOverlay.bubbleId || 'N/A'}</h4>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Bubble Type
                          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            <select
                              value={activeOverlay.bubbleDefId || 'BD_CLASSIC'}
                              onChange={(e) => {
                                if (!currentSlide || !project) return;
                                const defId = e.target.value;
                                let customSrc: string | undefined = undefined;

                                if (defId.startsWith('BD_CUSTOM_')) {
                                  const tName = defId.replace('BD_CUSTOM_', '');
                                  const bt = (project.data.bubbleDefinitions || []).find(d => d.templateName === tName);
                                  if (bt) customSrc = bt.imageSrc;
                                }

                                const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, bubbleDefId: defId, customImageSrc: customSrc } : o);
                                setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                                setIsDirty(true);
                              }}
                              style={{ flex: 1, background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: 4 }}
                            >
                              {(() => {
                                const mappedCustom = (project?.data.bubbleDefinitions || []).map(bt => ({
                                  bubbleDefId: `BD_CUSTOM_${bt.templateName}`,
                                  name: bt.templateName
                                }));
                                return [...BUBBLE_LIBRARY, ...mappedCustom].map(lib => (
                                  <option key={lib.bubbleDefId} value={lib.bubbleDefId}>{lib.name}</option>
                                ));
                              })()}
                            </select>
                            <button
                              onClick={onImportBubbleTemplate}
                              title="Import PNG Bubble Template"
                              style={{ padding: '0 8px', background: '#444', color: '#fff', border: '1px solid #666', borderRadius: 4, cursor: 'pointer' }}
                            >
                              +
                            </button>
                          </div>
                        </label>

                        {(project?.data.bubbleDefinitions || []).length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <h5 style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>Custom Templates</h5>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {project?.data.bubbleDefinitions?.map((bt) => (
                                <div key={bt.templateName} style={{ display: 'flex', alignItems: 'center', background: '#222', border: '1px solid #333', padding: '2px 4px', borderRadius: 4, fontSize: '0.75rem' }}>
                                  <span style={{ color: '#eee', marginRight: 8 }}>{bt.templateName}</span>
                                  <button
                                    onClick={() => onDeleteBubbleTemplate(bt.templateName)}
                                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 'bold' }}
                                    title="Remove Template"
                                  >
                                    X
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: '0.8rem', color: '#ccc', gap: 8, marginBottom: 8 }}>
                          <input
                            type="checkbox"
                            checked={!!activeOverlay.locked}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, locked: e.target.checked } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                          />
                          Locked
                        </label>
                        <button
                          onClick={() => {
                            if (!currentSlide || !project) return;
                            const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).filter(o => o.id !== activeOverlay.id);
                            setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                            setActiveOverlayId(null);
                            setIsDirty(true);
                          }}
                          style={{ background: '#633', color: '#fff', border: 'none', padding: '6px', borderRadius: 4, width: '100%', cursor: 'pointer', marginBottom: 8 }}
                        >
                          Delete Bubble
                        </button>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Font Size
                          <input
                            type="number"
                            min={10} max={200}
                            value={activeOverlay.fontSize ?? 24}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, fontSize: Number(e.target.value) } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: 4 }}
                          />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Text Alignment
                          <select
                            value={activeOverlay.align || 'center'}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, align: e.target.value as any } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: 4 }}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Font Family
                          <select
                            value={activeOverlay.fontFamily || 'sans-serif'}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, fontFamily: e.target.value } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: 4 }}
                          >
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Comic Sans MS">Comic Sans MS</option>
                            <option value="sans-serif">Default</option>
                          </select>
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Bold Strength ({activeOverlay.fontWeight || 400})
                          <input
                            type="range"
                            min={400} max={900} step={100}
                            value={Number(activeOverlay.fontWeight) || 400}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, fontWeight: String(e.target.value) } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: '0.8rem', color: '#ccc', gap: 8, marginBottom: 8 }}>
                          <input
                            type="checkbox"
                            checked={activeOverlay.fontStyle === 'italic'}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, fontStyle: (e.target.checked ? 'italic' : 'normal') as 'italic' | 'normal' | undefined } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                          />
                          Italic
                        </label>

                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: '#ccc', gap: 4, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!activeOverlay.flipX}
                              onChange={(e) => {
                                if (!currentSlide || !project) return;
                                const nextOverlays = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, flipX: e.target.checked } : o);
                                setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                                setIsDirty(true);
                              }}
                            />
                            Flip H
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: '#ccc', gap: 4, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!activeOverlay.flipY}
                              onChange={(e) => {
                                if (!currentSlide || !project) return;
                                const nextOverlays = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, flipY: e.target.checked } : o);
                                setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                                setIsDirty(true);
                              }}
                            />
                            Flip V
                          </label>
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Text Color
                          <input
                            type="color"
                            value={activeOverlay.textColor || '#000000'}
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, textColor: e.target.value } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                            style={{ background: "transparent", border: "none", width: "100%", height: 24, cursor: "pointer", padding: 0 }}
                          />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
                          Tags (comma-separated)
                          <input
                            type="text"
                            value={(activeOverlay.tags || []).join(', ')}
                            placeholder="tag1, tag2..."
                            onChange={(e) => {
                              if (!currentSlide || !project) return;
                              const tagArr = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                              const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, tags: tagArr } : o);
                              setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                              setIsDirty(true);
                            }}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: 4 }}
                          />
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          {(['x', 'y', 'width', 'height'] as const).map(prop => (
                            <label key={prop} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4 }}>
                              TextRect {prop}
                              <input
                                type="number"
                                min={0} max={1} step={0.05}
                                value={activeOverlay.textRect?.[prop] ?? BUBBLE_LIBRARY.find(d => d.bubbleDefId === activeOverlay.bubbleDefId)?.textRect?.[prop] ?? (prop === 'width' || prop === 'height' ? 1 : 0)}
                                onChange={(e) => {
                                  if (!currentSlide || !project) return;
                                  const val = Math.max(0, Math.min(1, Number(e.target.value)));
                                  const currentRect = activeOverlay.textRect ?? BUBBLE_LIBRARY.find(d => d.bubbleDefId === activeOverlay.bubbleDefId)?.textRect ?? { x: 0, y: 0, width: 1, height: 1 };
                                  const nextRect = { ...currentRect, [prop]: val };
                                  const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).map(o => o.id === activeOverlay.id ? { ...o, textRect: nextRect } : o);
                                  setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                                  setIsDirty(true);
                                }}
                                style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '4px', borderRadius: 4 }}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="audio-block">
                    {currentSlide && renderTagEditor(currentSlide)}
                    <h4>Slide Audio</h4>
                    {currentSlide && (
                      <>
                        {currentAsset?.mediaType === "video" && (
                          <div style={{ marginBottom: 12, padding: "8px", border: "1px solid #333", borderRadius: 6, background: "#181818" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.80rem", color: "#ffaaaa", marginBottom: 8 }}>
                              <span>Video Audio</span>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#ddd" }}>
                                <input
                                  type="checkbox"
                                  checked={currentVideoAudioSettings.enabled}
                                  onChange={(e) => {
                                    if (!currentSlide) return;
                                    updateCurrentSlide({
                                      videoAudio: {
                                        ...currentVideoAudioSettings,
                                        enabled: e.target.checked,
                                      },
                                    });
                                  }}
                                />
                                Sound On
                              </label>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: currentVideoAudioSettings.enabled ? "#ccc" : "#666" }}>
                              <span style={{ minWidth: 42 }}>Volume</span>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={currentVideoAudioSettings.volume}
                                disabled={!currentVideoAudioSettings.enabled}
                                onChange={(e) => {
                                  if (!currentSlide) return;
                                  updateCurrentSlide({
                                    videoAudio: {
                                      ...currentVideoAudioSettings,
                                      volume: Number(e.target.value),
                                    },
                                  });
                                }}
                                style={{ flex: 1 }}
                              />
                              <span style={{ minWidth: 38, textAlign: "right" }}>
                                {Math.round(currentVideoAudioSettings.volume * 100)}%
                              </span>
                            </label>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.80rem", color: "#ffaaaa", marginBottom: 4 }}>
                          <span>Dialogue</span>
                          {appMode === "edit" && <button style={{ padding: "0px 6px", fontSize: "12px", background: "#4a2a2a", border: "1px solid #7a3a3a" }} onClick={() => onImportAudio("dialogue")}>+</button>}
                        </div>
                        {currentSlide.dialogue?.map((clip, idx) => (
                          <AudioClipPlayer
                            key={`diag-${idx}`}
                            clip={clip}
                            label={`Dialogue ${idx + 1}`}
                            onUpdate={(upds) => updateSlideAudio("dialogue", idx, upds)}
                            onPlay={(url, vol, opts) => audioManager.playClip(url, vol, false, opts, "dialogue")}
                            onPause={(url) => audioManager.pauseClip(url)}
                            onStop={(url, opts) => audioManager.stopClip(url, opts)}
                            showRemove={appMode === "edit"}
                            onRemove={() => removeSlideAudio("dialogue", idx)}
                          />
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.80rem", color: "#ffaaaa", marginTop: 10, marginBottom: 4 }}>
                          <span>SFX</span>
                          {appMode === "edit" && <button style={{ padding: "0px 6px", fontSize: "12px", background: "#4a2a2a", border: "1px solid #7a3a3a" }} onClick={() => onImportAudio("sfx")}>+</button>}
                        </div>
                        {currentSlide.sfx?.map((clip, idx) => (
                          <AudioClipPlayer
                            key={`sfx-${idx}`}
                            clip={clip}
                            label={`SFX ${idx + 1}`}
                            onUpdate={(upds) => updateSlideAudio("sfx", idx, upds)}
                            onPlay={(url, vol, opts) => audioManager.playClip(url, vol, false, opts, "sfx")}
                            onPause={(url) => audioManager.pauseClip(url)}
                            onStop={(url, opts) => audioManager.stopClip(url, opts)}
                            showRemove={appMode === "edit"}
                            onRemove={() => removeSlideAudio("sfx", idx)}
                          />
                        ))}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.80rem", color: "#ffaaaa", marginTop: 10, marginBottom: 4 }}>
                          <span>Slide BGM</span>
                          {appMode === "edit" && <button style={{ padding: "0px 6px", fontSize: "12px", background: "#4a2a2a", border: "1px solid #7a3a3a" }} onClick={() => onImportAudio("bgm")}>+</button>}
                        </div>
                        {currentSlide.bgm && (
                          <AudioClipPlayer
                            clip={currentSlide.bgm}
                            label={"Slide BGM"}
                            onUpdate={(upds) => updateSlideAudio("bgm", null, upds)}
                            onPlay={(url, vol, opts) => audioManager.playClip(url, vol, true, opts, "slide-bgm")}
                            onPause={(url) => audioManager.pauseClip(url)}
                            onStop={(url, opts) => audioManager.stopClip(url, opts)}
                            showRemove={appMode === "edit"}
                            onRemove={() => removeSlideAudio("bgm")}
                          />
                        )}
                        {!currentSlide.dialogue?.length &&
                          !currentSlide.sfx?.length &&
                          !currentSlide.bgm && (
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "#666",
                                textAlign: "center",
                                padding: "10px 0",
                              }}
                            >
                              No audio on this slide
                            </div>
                          )}
                      </>
                    )}
                  </div>

                  <div className="audio-block">
                    <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px 0", color: "#ffb86c", fontSize: "0.9rem", borderBottom: "1px solid #333", paddingBottom: "6px" }}>
                      Section Music
                      {appMode === "edit" && <button style={{ padding: "0px 6px", fontSize: "12px", background: "#4a2a2a", border: "1px solid #7a3a3a", color: "#fff" }} onClick={() => onImportAudio("section-bgm")}>+</button>}
                    </h4>
                    {selectedSection?.bgm?.length ? (
                      selectedSection.bgm.map((clip, idx) => (
                        <AudioClipPlayer
                          key={`section-bgm-${idx}`}
                          clip={clip}
                          label={`Section BGM ${idx + 1}`}
                          onUpdate={(upds) =>
                            updateSection(selectedSection.id, {
                              bgm: (selectedSection.bgm || []).map((c, i) => (i === idx ? { ...c, ...upds } : c)),
                            })
                          }
                          onPlay={(url, vol, opts) => audioManager.playSectionMusic(url, vol, opts?.fadeEnabled)}
                          onPause={(url) => audioManager.pauseClip(url)}
                          onStop={(url, opts) => audioManager.stopSectionMusic(undefined, opts?.fadeEnabled)}
                          showRemove={appMode === "edit"}
                          onRemove={() => removeSectionBgm(idx)}
                        />
                      ))
                    ) : (
                      <div style={{ fontSize: "0.85rem", color: "#666", textAlign: "center", padding: "10px 0" }}>
                        No section music
                      </div>
                    )}


                  </div>

                  <CompactAudioPanel onOpenSettings={() => setAudioSettingsOpen(true)} />
                </>
              ) : topMode === 'badge' ? (
                <div className="audio-block" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <BadgePanel
                    isEditMode={appMode === "edit"}
                    project={project}
                    show="settings"
                    onUpdateProject={(upd) => {
                      if (upd.data) {
                        setProject(prev => prev ? { ...prev, data: upd.data! } : prev);
                        setIsDirty(true);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="audio-block" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: "0", color: "#66f", fontSize: "1rem" }}>Boost Tools</h4>

                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: "10px 0", borderBottom: '1px solid #333', paddingBottom: 10 }}>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('slideRef')}>+ SlideRef</button>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('breakRef')}>+ BreakRef</button>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('promptCard')}>+ Prompt</button>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('miniGame')}>+ Game</button>
                    <button style={{ padding: '6px', background: '#253525', border: '1px solid #4a6a4a', color: '#adfaad', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('aCardRef')}>+ ACard</button>
                    <button style={{ padding: '6px', background: '#253535', border: '1px solid #4a6a6a', color: '#adeaff', borderRadius: 4, cursor: activeItem ? 'pointer' : 'not-allowed', opacity: activeItem ? 1 : 0.45, fontSize: '0.75rem', flex: 1 }} onClick={addBoostBCardInstance} disabled={!activeItem}>+ BCard Overlay</button>
                  </div>

                  {activeItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {activeItem.type === 'slideRef' && (
                        <>
                          <h4 style={{ margin: 0, color: "#ccc", fontSize: "0.85rem" }}>Editing SlideRef</h4>
                          <details style={{ marginBottom: 16 }}>
                            <summary style={{ cursor: 'pointer', color: '#88f', fontSize: '0.85rem', marginBottom: 8 }}>Select Slide</summary>
                            <input
                              type="text"
                              placeholder="Search slides..."
                              value={boostSearchQuery}
                              onChange={e => setBoostSearchQuery(e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', background: '#222', color: '#fff', border: '1px solid #444', padding: '6px', marginBottom: 12, borderRadius: 4 }}
                            />
                            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {project?.data.slides.map((s, idx) => {
                                const asset = assetsById.get(s.assetId);
                                const visibleLabel = getSlideDisplayName(s, appMode);
                                const searchText = `${visibleLabel} ${asset ? getAssetDescription(asset) : ""}`.toLowerCase();
                                const matches = searchText.includes(boostSearchQuery.toLowerCase());
                                if (boostSearchQuery && !matches) return null;
                                return (
                                  <button
                                    key={s.id}
                                    style={{ padding: '6px', background: activeItem.slideId === s.id ? '#556' : '#222', border: activeItem.slideId === s.id ? '1px solid #77f' : '1px solid #444', color: '#ddd', borderRadius: 4, cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
                                    onClick={() => updateSequenceItem(activeItem.id, { slideId: s.id })}
                                  >
                                    {idx + 1}. {visibleLabel.length > 30 ? visibleLabel.slice(0, 30) + '...' : visibleLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </details>
                        </>
                      )}
                      {activeItem.type === 'breakRef' && (
                        <>
                          <h4 style={{ margin: 0, color: "#ccc", fontSize: "0.85rem" }}>Editing BreakRef</h4>
                          <select
                            value={activeItem.breakId}
                            onChange={e => updateSequenceItem(activeItem.id, { breakId: e.target.value })}
                            style={{ background: '#222', color: '#fff', padding: 4, border: '1px solid #555', borderRadius: 4 }}
                          >
                            <option value="">(Select a break)</option>
                            {project?.data.sections.filter(s => s.type === 'break').map(b => (
                              <option key={b.id} value={b.id}>{b.name || 'Unnamed Break'}</option>
                            ))}
                          </select>
                        </>
                      )}
                      {activeItem.type === 'promptCard' && (
                        <>
                          <h4 style={{ margin: 0, color: "#ccc", fontSize: "0.85rem" }}>Editing PromptCard</h4>
                          <input type="text" placeholder="Title (optional)" value={activeItem.title || ''} onChange={e => updateSequenceItem(activeItem.id, { title: e.target.value })} style={{ background: '#222', color: '#fff', padding: 6, border: '1px solid #555', borderRadius: 4 }} />
                          <textarea placeholder="Body" value={activeItem.body} onChange={e => updateSequenceItem(activeItem.id, { body: e.target.value })} style={{ background: '#222', color: '#fff', padding: 6, border: '1px solid #555', borderRadius: 4, minHeight: 80, resize: 'vertical' }} />
                        </>
                      )}
                      {activeItem.type === 'miniGame' && (
                        <h4 style={{ margin: 0, color: "#ccc", fontSize: "0.85rem" }}>Editing MiniGame</h4>
                      )}
                      {activeItem.type === 'aCardRef' && (
                        <>
                          <h4 style={{ margin: 0, color: '#adfaad', fontSize: '0.85rem' }}>ACard Reference</h4>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>Select which ACard (stage/board) to show at this step.</p>
                          <select
                            value={(activeItem as any).aCardId || ''}
                            onChange={e => updateSequenceItem(activeItem.id, { aCardId: e.target.value } as any)}
                            style={{ background: '#222', color: '#fff', padding: '6px', border: '1px solid #4a6a4a', borderRadius: 4, width: '100%' }}
                          >
                            <option value="">(Select an ACard)</option>
                            {Object.values(project?.data.aCardLibrary || {}).map(ac => (
                              <option key={ac.id} value={ac.id}>{ac.name}</option>
                            ))}
                          </select>
                          {!(activeItem as any).aCardId && (
                            <p style={{ margin: 0, color: '#f88', fontSize: '0.75rem' }}>No ACards exist yet - create one in the Boards tab.</p>
                          )}
                          {appMode === 'teach' && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #2f3340', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <h4 style={{ margin: 0, color: '#9ecbff', fontSize: '0.8rem' }}>BCard Teach Tools</h4>
                              <div ref={teachToolsHostRef} />
                            </div>
                          )}
                        </>
                      )}
                      <div style={{ borderTop: '1px solid #2f3340', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h4 style={{ margin: 0, color: '#adeaff', fontSize: '0.85rem' }}>BCard Overlays On This Host</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>These BCards live on the current Boost scene item and render over the host content.</p>
                        <button style={{ padding: '6px', background: '#24343d', border: '1px solid #456576', color: '#c3ebff', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }} onClick={addBoostBCardInstance}>
                          + Place BCard Overlay
                        </button>
                        {(boostBCardHost?.instances.length || 0) > 0 ? (
                          boostBCardHost!.instances.map((instance, index) => {
                            const bCard = (project?.data.bCardLibrary || {})[instance.bCardId];
                            const isSelected = selectedPlacedBCardId === instance.id;
                            return (
                              <div key={instance.id} onClick={() => setSelectedPlacedBCardId(instance.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px', background: isSelected ? '#27404a' : '#1a1f2a', border: isSelected ? '1px solid #7be8df' : '1px solid #2f3a4e', borderRadius: 6, cursor: 'pointer' }}>
                                <span style={{ flex: 1, fontSize: '0.75rem', color: '#d9e2f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {index + 1}. {bCard?.name || instance.bCardId || '(missing)'}
                                </span>
                                <button style={{ padding: '2px 6px', fontSize: '0.72rem', background: 'transparent', border: 'none', color: '#f88', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); removePlacedBCardInstance(instance.id); }}>X</button>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: '#6f7f9d', textAlign: 'center', padding: '8px 0' }}>
                            No BCard overlays on this Boost item.
                          </div>
                        )}
                        {(() => {
                          const selectedInstance = boostBCardHost?.instances.find((item) => item.id === selectedPlacedBCardId) || null;
                          if (!selectedInstance) return null;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                              <select value={selectedInstance.bCardId} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { bCardId: e.target.value })} style={{ background: '#222', color: '#fff', padding: '6px', border: '1px solid #4a6a6a', borderRadius: 4, width: '100%' }}>
                                <option value="">(Select a BCard)</option>
                                {Object.values(project?.data.bCardLibrary || {}).map(bc => (
                                  <option key={bc.id} value={bc.id}>{bc.name}</option>
                                ))}
                              </select>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#9fc5d6' }}>
                                  Width
                                  <input type="number" min={40} value={selectedInstance.size.width} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { size: { ...selectedInstance.size, width: parseInt(e.target.value, 10) || 270 } })} style={{ background: '#222', color: '#fff', padding: '6px', border: '1px solid #4a6a6a', borderRadius: 4 }} />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#9fc5d6' }}>
                                  Height
                                  <input type="number" min={40} value={selectedInstance.size.height} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { size: { ...selectedInstance.size, height: parseInt(e.target.value, 10) || 390 } })} style={{ background: '#222', color: '#fff', padding: '6px', border: '1px solid #4a6a6a', borderRadius: 4 }} />
                                </label>
                              </div>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#9fc5d6' }}>
                                Z Index
                                <input type="number" min={1} value={selectedInstance.zIndex} onChange={(e) => updatePlacedBCardInstance(selectedInstance.id, { zIndex: parseInt(e.target.value, 10) || 1 })} style={{ background: '#222', color: '#fff', padding: '6px', border: '1px solid #4a6a6a', borderRadius: 4 }} />
                              </label>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#9fc5d6' }}>
                                Frame Style
                                <select value={selectedInstance.displayMode || 'overlay'} onChange={e => updatePlacedBCardInstance(selectedInstance.id, { displayMode: e.target.value as 'overlay' | 'board' })} style={{ background: '#222', color: '#fff', padding: '6px', border: '1px solid #4a6a6a', borderRadius: 4, width: '100%' }}>
                                  <option value="overlay">Overlay</option>
                                  <option value="board">Board Shell</option>
                                </select>
                              </label>
                              {selectedOverlayBCardInstanceId === selectedInstance.id && selectedOverlayBCardState && (
                                <div style={{ borderTop: '1px solid #2f3340', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <h4 style={{ margin: 0, color: '#9ecbff', fontSize: '0.8rem' }}>Preview Actions</h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isFlipped")} style={{ padding: "6px", background: selectedOverlayBCardState.isFlipped ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Flip</button>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isBlurred")} style={{ padding: "6px", background: selectedOverlayBCardState.isBlurred ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Blur</button>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isCovered")} style={{ padding: "6px", background: selectedOverlayBCardState.isCovered ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Cover</button>
                                    <button onClick={() => toggleSelectedOverlayBCardState("isZoomed")} style={{ padding: "6px", background: selectedOverlayBCardState.isZoomed ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Zoom</button>
                                  </div>
                                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#99b5cd" }}>
                                    Card Click Action
                                    <select value={overlayBCardClickAction} onChange={(e) => setOverlayBCardClickAction(e.target.value as BCardOverlayClickAction)} style={{ background: "#1a2530", color: "#fff", border: "1px solid #486579", borderRadius: 4, padding: "6px" }}>
                                      <option value="flip">Flip</option>
                                      <option value="none">None</option>
                                      <option value="blur">Blur</option>
                                      <option value="cover">Cover</option>
                                      <option value="zoom">Zoom</option>
                                    </select>
                                  </label>
                                  <button onClick={resetSelectedOverlayBCardState} style={{ padding: "6px", background: "#372831", border: "1px solid #6f4c5e", color: "#ffd9ea", borderRadius: 4 }}>
                                    Reset Preview State
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {appMode === "teach" && activeOverlayBCardInstances.length > 0 && selectedOverlayBCardInstanceId && selectedOverlayBCardState && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2f3340", display: "flex", flexDirection: "column", gap: 8 }}>
                            <h4
                              onClick={() => setBoostBCardTeachCollapsed((v) => !v)}
                              style={{ margin: 0, color: "#9ecbff", fontSize: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                            >
                              BCard Teach Actions
                              <span>{boostBCardTeachCollapsed ? ">" : "v"}</span>
                            </h4>
                            {!boostBCardTeachCollapsed && (
                              <>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                                  <button onClick={() => toggleSelectedOverlayBCardState("isFlipped")} style={{ padding: "6px", background: selectedOverlayBCardState.isFlipped ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Flip</button>
                                  <button onClick={() => toggleSelectedOverlayBCardState("isBlurred")} style={{ padding: "6px", background: selectedOverlayBCardState.isBlurred ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Blur</button>
                                  <button onClick={() => toggleSelectedOverlayBCardState("isCovered")} style={{ padding: "6px", background: selectedOverlayBCardState.isCovered ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Cover</button>
                                  <button onClick={() => toggleSelectedOverlayBCardState("isZoomed")} style={{ padding: "6px", background: selectedOverlayBCardState.isZoomed ? "#2e5461" : "#1c2a35", border: "1px solid #486579", color: "#e3f5ff", borderRadius: 4 }}>Zoom</button>
                                </div>
                                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.75rem", color: "#99b5cd" }}>
                                  Card Click Action
                                  <select value={overlayBCardClickAction} onChange={(e) => setOverlayBCardClickAction(e.target.value as BCardOverlayClickAction)} style={{ background: "#1a2530", color: "#fff", border: "1px solid #486579", borderRadius: 4, padding: "6px" }}>
                                    <option value="none">None</option>
                                    <option value="flip">Flip</option>
                                    <option value="blur">Blur</option>
                                    <option value="cover">Cover</option>
                                    <option value="zoom">Zoom</option>
                                  </select>
                                </label>
                                <button onClick={resetSelectedOverlayBCardState} style={{ padding: "6px", background: "#372831", border: "1px solid #6f4c5e", color: "#ffd9ea", borderRadius: 4 }}>
                                  Reset Card State
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {activeItem.type === 'slideRef' && currentSlide && renderTagEditor(currentSlide)}
                    </div>
                  ) : (
                    <div style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', marginTop: 24 }}>Select an item in Boost Sequences to edit</div>
                  )}
                </div>
              )}
            </aside>
          </div>
          {
            contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                items={(() => {
                  if (appMode === 'teach') {
                    return [
                      {
                        label: "Draw",
                        submenu: [
                          {
                            label: drawSettings.drawMode ? "Disable Drawing" : "Enable Drawing",
                            onClick: () => setDrawSettings(prev => ({ ...prev, drawMode: !prev.drawMode }))
                          },
                          {
                            label: "Clear Drawing",
                            onClick: clearCurrentSlideDrawings
                          }
                        ]
                      },
                      {
                        label: "Next Slide",
                        onClick: goToNextSlide,
                        disabled: !project || (currentIndex >= project.data.slides.length - 1 && selectedSection?.type !== 'break')
                      },
                      {
                        label: "Prev Slide",
                        onClick: goToPrevSlide,
                        disabled: !project || (currentIndex <= 0 && selectedSection?.type !== 'break')
                      },
                      {
                        label: "Next Break",
                        onClick: goToNextBreak
                      },
                      {
                        label: "Prev Break",
                        onClick: goToPrevBreak
                      }
                    ];
                  }

                  // Edit Mode
                  const activeOverlay = currentSlide?.overlays?.find(o => o.id === activeOverlayId);
                  const isSlideFirst = currentIndex === 0;
                  const isSlideLast = project ? currentIndex === project.data.slides.length - 1 : true;

                  const sectionIndex = project ? project.data.sections.findIndex(s => s.id === selectedSectionId) : -1;
                  const isSectionFirst = sectionIndex === 0;
                  const isSectionLast = project ? sectionIndex === (project.data.sections?.length || 0) - 1 : true;

                  return [
                    {
                      label: "Slide",
                      submenu: [
                        { label: "Add Slide", onClick: onImportMedia },
                        { label: "Delete Slide", onClick: () => currentSlide && onDeleteSlide(currentSlide.id) },
                        { isDivider: true },
                        { label: "Move Slide Up", disabled: isSlideFirst, onClick: () => reorderSlidesWithinSection(currentIndex, currentIndex - 1) },
                        { label: "Move Slide Down", disabled: isSlideLast, onClick: () => reorderSlidesWithinSection(currentIndex, currentIndex + 2) },
                      ]
                    },
                    {
                      label: "Break",
                      submenu: [
                        { label: "Add Break", onClick: onAddBreak },
                        { label: "Delete Break", onClick: deleteCurrentSection, disabled: !selectedSectionId },
                        { isDivider: true },
                        { label: "Move Break Up", disabled: isSectionFirst, onClick: () => selectedSectionId && moveSection(selectedSectionId, "up") },
                        { label: "Move Break Down", disabled: isSectionLast, onClick: () => selectedSectionId && moveSection(selectedSectionId, "down") },
                      ]
                    },
                    {
                      label: "Audio",
                      submenu: [
                        { label: "Add Dialogue", onClick: () => onImportAudio('dialogue') },
                        { label: "Add SFX", onClick: () => onImportAudio('sfx') },
                        { label: "Add Background", onClick: () => onImportAudio('bgm') },
                        { label: "Add Section Background Sound", onClick: () => onImportAudio('section-bgm') }
                      ]
                    },
                    {
                      label: "Bubbles",
                      submenu: [
                        { label: "Add Bubble", onClick: onAddBubble },
                        { label: "Delete Bubble", disabled: !activeOverlay, onClick: onDeleteBubble },
                        { label: "Duplicate Bubble", disabled: !activeOverlay, onClick: () => activeOverlay && onDuplicateBubble(activeOverlay) },
                        {
                          label: "Remove Bubble Template",
                          disabled: !activeOverlay || !activeOverlay.bubbleDefId?.startsWith('BD_CUSTOM_'),
                          onClick: () => {
                            if (activeOverlay?.bubbleDefId?.startsWith('BD_CUSTOM_')) {
                              onDeleteBubbleTemplate(activeOverlay.bubbleDefId.replace('BD_CUSTOM_', ''));
                            }
                          }
                        }
                      ]
                    },
                    {
                      label: "Transition",
                      submenu: [
                        {
                          label: "Apply to Slide",
                          submenu: (['fade', 'crossfade', 'fade-black', 'cinematic', 'pixel', 'blur', 'card-slide'] as TransitionType[]).map(t => ({
                            label: t,
                            onClick: () => {
                              if (!currentSlide) return;
                              updateCurrentSlide({
                                transition: t,
                                transitionDuration: stagedDuration,
                                transitionDirection: stagedDirection,
                              });
                              showToast(`Applied ${t}`, "success", 1000);
                            }
                          }))
                        },
                        {
                          label: "Apply to Section",
                          submenu: (['fade', 'crossfade', 'fade-black', 'cinematic', 'pixel', 'blur', 'card-slide'] as TransitionType[]).map(t => ({
                            label: t,
                            onClick: () => {
                              if (!currentSlide || !project) return;
                              const newSlides = project.data.slides.map((s) => {
                                if (s.sectionId === currentSlide.sectionId) {
                                  return { ...s, transition: t, transitionDuration: stagedDuration, transitionDirection: stagedDirection };
                                }
                                return s;
                              });
                              setProject({ ...project, data: { ...project.data, slides: newSlides } });
                              setIsDirty(true);
                              showToast(`Applied ${t} to Section`, "success", 1000);
                            }
                          }))
                        }
                      ]
                    }
                  ];
                })()}
              />
            )}
        </div>
      </CardSystemProvider>
    </SparkProvider>
  );
}

function ZoomPanWrapper({
  children,
  className,
  drawSettings,
  markerStrokes,
  contentWidth,
  contentHeight,
  onMarkerStrokesChange,
  clearSignal,
  initialViewport,
  onViewportChange,
}: {
  children: React.ReactNode;
  className?: string;
  drawSettings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange: (strokes: MarkerStroke[]) => void;
  clearSignal: number;
  contentWidth?: number;
  contentHeight?: number;
  initialViewport?: { zoom: number; panX: number; panY: number };
  onViewportChange?: (viewport: { zoom: number; panX: number; panY: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [zoom, setZoom] = useState(initialViewport?.zoom ?? 1);
  const [pan, setPan] = useState({ x: initialViewport?.panX ?? 0, y: initialViewport?.panY ?? 0 });
  const targetZoomRef = useRef(initialViewport?.zoom ?? 1);
  const targetPanRef = useRef({ x: initialViewport?.panX ?? 0, y: initialViewport?.panY ?? 0 });

  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (initialViewport) {
      targetZoomRef.current = initialViewport.zoom;
      targetPanRef.current = { x: initialViewport.panX, y: initialViewport.panY };
      setZoom(initialViewport.zoom);
      setPan({ x: initialViewport.panX, y: initialViewport.panY });
    }
  }, [initialViewport]);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [highlighterStrokes, setHighlighterStrokes] = useState<
    HighlighterStroke[]
  >([]);
  const activeHighlighterRef = useRef<HighlighterStroke | null>(null);
  const activeMarkerRef = useRef<MarkerStroke | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    setHighlighterStrokes([]);
  }, [clearSignal]);

  const onWheelZoom = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    // Calculate target zoom
    const zoomFactor = Math.pow(1.0015, -event.deltaY);
    let newTargetZoom = targetZoomRef.current * zoomFactor;
    newTargetZoom = Math.min(4, Math.max(1, newTargetZoom));

    // Calculate target pan to anchor cursor
    // We project the cursor into content space using the current targets,
    // then calculate where it should be with the new zoom.
    const currentTargetPan = targetPanRef.current;
    const currentTargetZoom = targetZoomRef.current;

    const contentX = (cursorX - currentTargetPan.x) / currentTargetZoom;
    const contentY = (cursorY - currentTargetPan.y) / currentTargetZoom;

    const newTargetPanX = cursorX - contentX * newTargetZoom;
    const newTargetPanY = cursorY - contentY * newTargetZoom;

    targetZoomRef.current = newTargetZoom;
    targetPanRef.current = { x: newTargetPanX, y: newTargetPanY };

    if (onViewportChange) {
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => {
        onViewportChange({ zoom: newTargetZoom, panX: newTargetPanX, panY: newTargetPanY });
      }, 300);
    }
  };

  const getContentPoint = (
    clientX: number,
    clientY: number,
  ): DrawPoint | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const cWidth = contentWidth ?? rect.width;
    const cHeight = contentHeight ?? rect.height;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = (localX - pan.x) / zoom / cWidth;
    const y = (localY - pan.y) / zoom / cHeight;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      t: performance.now(),
      h: drawSettings.rainbow ? (performance.now() / 18) % 360 : undefined,
    };
  };

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (drawSettings.drawMode && event.button === 0) {
      // Draw Start
      event.preventDefault();
      const point = getContentPoint(event.clientX, event.clientY);
      if (!point) return;

      isDrawingRef.current = true;
      if (drawSettings.tool === "highlighter") {
        activeHighlighterRef.current = {
          id: crypto.randomUUID(),
          points: [point],
          size: drawSettings.size,
          opacity: drawSettings.opacity,
          color: drawSettings.color,
          fadeMs: drawSettings.fadeMs,
          rainbow: drawSettings.rainbow,
          sparkle: drawSettings.sparkle,
        };
        setHighlighterStrokes((prev) => [
          ...prev,
          activeHighlighterRef.current!,
        ]);
      } else {
        activeMarkerRef.current = {
          id: crypto.randomUUID(),
          color: drawSettings.color,
          size: drawSettings.size,
          opacity: drawSettings.opacity,
          rainbow: drawSettings.rainbow,
          points: [point],
        };
        onMarkerStrokesChange([...markerStrokes, activeMarkerRef.current!]);
      }
    } else if (
      event.button === 1 ||
      (!drawSettings.drawMode && event.button === 0)
    ) {
      // Pan Start (Middle click OR Left click if not drawing)
      // Actually, if drawMode is false, maybe we allow left click pan? Or keep strict?
      // User requested "zoom/pan same as normal slides".
      // Normal slides: Middle click Pan. Left click select?
      // MediaView onMouseDown: `if (event.button !== 1) return;` (Only middle click).
      // So I should keep strict middle click for Pan if I want identical behavior.
      // But user might want left click pan if drawMode is off?
      // I'll stick to Middle Click for Pan to be consistent.
      if (event.button !== 1) return;
      event.preventDefault();
      targetZoomRef.current = zoom;
      targetPanRef.current = pan;
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsPanning(true);
    }
  };

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (isDrawingRef.current) {
        const point = getContentPoint(event.clientX, event.clientY);
        if (point) {
          if (activeHighlighterRef.current) {
            activeHighlighterRef.current.points.push(point);
            // Force update? No, render loop handles it by ref, but state update triggers re-render?
            // Actually we need to update state to trigger re-render of canvas?
            // We rely on requestAnimationFrame loop for canvas? Or React render?
            // MediaView onMouseDown stores PIXEL coordinates?
            // MediaView `drawFrame` loop draws whatever is in `markerStrokes` and `highlighterStrokes`.
            // `markerStrokes` is updated via `onMarkerStrokesChange` which updates App state.
            // `highlighterStrokes` is local state.
            // Here:
            if (activeHighlighterRef.current) {
              // We need to update state to trigger re-render if we rely on React render?
            }
          } else if (activeMarkerRef.current) {
            activeMarkerRef.current.points.push(point);
            // Update parent state
            onMarkerStrokesChange([
              ...markerStrokes.slice(0, -1),
              { ...activeMarkerRef.current },
            ]);
          }
        }
      } else if (isPanning) {
        const deltaX = event.clientX - panStartRef.current.x;
        const deltaY = event.clientY - panStartRef.current.y;
        const nextPan = {
          x: panStartRef.current.panX + deltaX,
          y: panStartRef.current.panY + deltaY,
        };
        setPan(nextPan);
        targetPanRef.current = nextPan;
      }
    };

    const onUp = () => {
      isDrawingRef.current = false;
      setIsPanning(false);
      activeHighlighterRef.current = null;
      activeMarkerRef.current = null;
      if (onViewportChange) {
        onViewportChange({ zoom: targetZoomRef.current, panX: targetPanRef.current.x, panY: targetPanRef.current.y });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning, markerStrokes, drawSettings, pan, zoom]); // Add deps

  // Animation Loop (Zoom/Pan)
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      setZoom((prev) => {
        const target = targetZoomRef.current;
        if (Math.abs(target - prev) < 0.001) return target;
        return prev + (target - prev) * 0.2;
      });
      setPan((prev) => {
        const target = targetPanRef.current;
        const dist = Math.hypot(target.x - prev.x, target.y - prev.y);
        if (dist < 0.1) return target;
        return {
          x: prev.x + (target.x - prev.x) * 0.2,
          y: prev.y + (target.y - prev.y) * 0.2,
        };
      });
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Drawing Loop
  useEffect(() => {
    const drawFrame = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        requestAnimationFrame(drawFrame);
        return;
      }

      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        requestAnimationFrame(drawFrame);
        return;
      }

      const now = performance.now();
      ctx.clearRect(0, 0, width, height);

      const cWidth = contentWidth ?? width;
      const cHeight = contentHeight ?? height;

      ctx.save();
      // Apply transform
      ctx.translate(pan.x, pan.y);
      // Canvas is width/height of screen.
      // Content is width/height of Rect (100%).
      // Our coordinates are 0..1 relative to Rect.
      // So we scale by Rect size.
      ctx.scale(zoom * cWidth, zoom * cHeight);

      // Draw Function
      const renderStroke = (
        stroke: {
          points: DrawPoint[];
          size: number;
          opacity: number;
          color: string;
          rainbow: boolean;
          fadeMs?: number;
          sparkle?: boolean;
        },
        segmentAlpha: (index: number) => number,
      ) => {
        const points = stroke.points;
        if (points.length < 2) return;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Size is in pixels? Or relative?
        // MediaView uses `stroke.size`.
        // But we scaled coordinate system by `width, height`.
        // If we draw withlineWidth=size, it will be huge (multiplied by width).
        // We need to divide lineWidth by scale?
        // `ctx.lineWidth = stroke.size / (width * zoom)`? No.
        // Wait, MediaView: `ctx.scale(zoom, zoom)`. And `ctx.lineWidth = stroke.size`.
        // But MediaView logic at 1241: `x = (localX - pan.x) / zoom / rect.width`.
        // So x is normalized.
        // But MediaView render logic at 1373: `ctx.scale(zoom, zoom)`.
        // DOES NOT scale by `rect.width`.
        // This implies MediaView strokes are in PIXELS?
        // Let's check MediaView logic again (Step 330).
        // Line 1239: `localX`. Line 1241: `x` normalized.
        // Line 1373: `ctx.scale(zoom, zoom)`.
        // Missing `ctx.scale(width, height)`?
        // If strokes are normalized (0..1), and we only scale by 0..1 pixels?
        // Which is invisible.
        // MediaView MUST be scaling by `width, height` somewhere?
        // OR `MediaView` `onMouseDown` stores PIXEL coordinates?
        // Step 330 Line 1245: `x` is normalized.
        // Step 330 Line 1375: `renderStroke`.
        // I missed where `x` is converted back to pixels for drawing.
        // Ah, maybe `MediaView` stores Normalized points, but renders them by multiplying?
        // Or maybe `MediaView` stores non-normalized points?
        // Wait, `MediaView` Step 330 says `x = ... / rect.width`. So normalized.
        // I must have missed `ctx.scale` or `p.x * width` in MediaView render loop.
        // I will assume I need to scale by `width, height` or add `ctx.scale(width, height)`.
        // If I add `ctx.scale(width, height)`, then `lineWidth` of 10 becomes 10 * width (huge).
        // So I must set `ctx.lineWidth = stroke.size / width`? (approx).
        // Or `ctx.lineWidth = stroke.size / ((width+height)/2)`.
        // This seems complex.
        // Let's assume standard behavior:
        // Scale context by width, height.
        // Divide lineWidth by average scale.
        ctx.lineWidth = stroke.size / ((cWidth + cHeight) / 2); // Approximation

        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = stroke.opacity;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
          const p = points[i];
          const prevP = points[i - 1];

          // Rainbow effect
          if (stroke.rainbow && p.h !== undefined) {
            const gradient = ctx.createLinearGradient(
              prevP.x,
              prevP.y,
              p.x,
              p.y,
            );
            gradient.addColorStop(0, `hsl(${prevP.h}, 100%, 50%)`);
            gradient.addColorStop(1, `hsl(${p.h}, 100%, 50%)`);
            ctx.strokeStyle = gradient;
          } else {
            ctx.strokeStyle = stroke.color;
          }

          // Fade effect for highlighter
          if (stroke.fadeMs && stroke.fadeMs > 0) {
            const age = now - p.t;
            const alpha = Math.max(0, 1 - age / stroke.fadeMs);
            ctx.globalAlpha = stroke.opacity * alpha;
          } else {
            ctx.globalAlpha = stroke.opacity;
          }

          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }
      };

      // Filter out faded highlighters, but avoid a no-op state write every frame.
      setHighlighterStrokes((prev) => {
        let changed = false;
        const next = prev.filter((s) => {
          const lastPoint = s.points[s.points.length - 1];
          const keep =
            !s.fadeMs ||
            !lastPoint ||
            now - lastPoint.t < s.fadeMs;
          if (!keep) changed = true;
          return keep;
        });
        return changed ? next : prev;
      });

      highlighterStrokes.forEach((s) => renderStroke(s, (idx) => 1));
      markerStrokes.forEach((s) => renderStroke(s, (idx) => 1));

      ctx.restore();
      requestAnimationFrame(drawFrame);
    };
    const id = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(id);
  }, [markerStrokes, highlighterStrokes, pan, zoom, drawSettings]);

  const contentStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
    width: "100%",
    height: "100%",
  };

  return (
    <div
      ref={containerRef}
      className={className}
      onWheel={onWheelZoom}
      onMouseDown={onMouseDown}
      style={{
        overflow: "hidden",
        cursor: isDrawingRef.current
          ? "crosshair"
          : isPanning
            ? "grabbing"
            : drawSettings.drawMode
              ? "crosshair"
              : "default",
        position: "relative",
        width: "100%",
        height: "100%",
        touchAction: "none",
      }}
    >
      <div style={contentStyle}>{children}</div>
      <canvas
        ref={canvasRef}
        className="drawing-overlay"
        style={{ pointerEvents: "none", position: "absolute", top: 0, left: 0, zIndex: 10 }}
      />
    </div>
  );
}

function MediaView({
  asset,
  overlays,
  className,
  style,
  drawSettings,
  markerStrokes,
  onMarkerStrokesChange,
  clearSignal,
  initialZoom,
  initialPan,
  onViewportChange,
  paused,
  initialTime,
  onTimeUpdate,
  showControls = true,
  isEditMode = false,
  activeOverlayId = null,
  bubbleDefinitions,
  showOverlayIds = false,
  onOverlaySelect,
  onOverlayChange,
  videoAudio,
  videoTrim,
  onVideoTrimChange,
  imageAdjustments,
  onImageAdjustmentsChange,
}: {
  asset: AssetItem;
  overlays: OverlayItem[];
  className?: string;
  style?: CSSProperties;
  drawSettings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange: (strokes: MarkerStroke[]) => void;
  clearSignal?: number;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
  onViewportChange?: (v: ViewportState) => void;
  paused?: boolean;
  initialTime?: number;
  onTimeUpdate?: (t: number) => void;
  showControls?: boolean;
  isEditMode?: boolean;
  activeOverlayId?: string | null;
  bubbleDefinitions?: BubbleTemplate[];
  showOverlayIds?: boolean;
  onOverlaySelect?: (id: string | null) => void;
  onOverlayChange?: (id: string, updates: Partial<OverlayItem>) => void;
  videoAudio?: Slide["videoAudio"];
  videoTrim?: Slide["videoTrim"];
  onVideoTrimChange?: (trim: Slide["videoTrim"]) => void;
  imageAdjustments?: Slide["imageAdjustments"];
  onImageAdjustmentsChange?: (settings: Slide["imageAdjustments"]) => void;
}) {
  const src = toMediaUrl(asset.relativePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trimTrackRef = useRef<HTMLDivElement | null>(null);
  const resolvedVideoAudio = useMemo(() => resolveVideoAudioSettings(videoAudio), [videoAudio]);
  const resolvedImageAdjustments = useMemo(
    () => resolveImageAdjustments(imageAdjustments),
    [imageAdjustments],
  );
  const [videoDuration, setVideoDuration] = useState(0);
  const [draggingTrimHandle, setDraggingTrimHandle] = useState<"in" | "out" | null>(null);
  const effectiveVideoTrim = useMemo(
    () => getEffectiveVideoTrim(videoTrim, videoDuration),
    [videoDuration, videoTrim],
  );

  // Dragging state for overlays
  const draggingOverlayRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ ox: number; oy: number; cx: number; cy: number; ow: number; oh: number; handle?: string } | null>(null);

  useEffect(() => {
    // If we have an initial time and we are paused (outgoing), snap to that frame.
    // If not paused (incoming), we might also want to restore time if we were tracking history?
    // For now, only outgoing needs to freeze at specific time.
    if (initialTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = initialTime;
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (paused && videoRef.current) {
      videoRef.current.pause();
    } else if (!paused && videoRef.current) {
      // If initialTime provided and we are starting, ensure we are there?
      // No, initialTime effect handles the seek.
      videoRef.current.play().catch(() => { });
    }
  }, [paused]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset.mediaType !== "video" || !videoDuration) return;
    const nextTime = clampVideoTimeToTrim(video.currentTime, videoTrim, videoDuration);
    if (Math.abs(nextTime - video.currentTime) > 0.02) {
      video.currentTime = nextTime;
    }
  }, [asset.mediaType, videoDuration, videoTrim]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset.mediaType !== "video") return;

    video.volume = 1;
    audioManager.attachMediaElement(
      video,
      resolvedVideoAudio.enabled ? resolvedVideoAudio.volume : 0,
      "slide-bgm",
    );

    return () => {
      audioManager.detachMediaElement(video);
    };
  }, [asset.id, asset.mediaType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset.mediaType !== "video") return;

    audioManager.setMediaElementVolume(
      video,
      resolvedVideoAudio.enabled ? resolvedVideoAudio.volume : 0,
    );
  }, [asset.id, asset.mediaType, resolvedVideoAudio.enabled, resolvedVideoAudio.volume]);

  const [zoom, setZoom] = useState(initialZoom ?? 1);
  const [pan, setPan] = useState(initialPan ?? { x: 0, y: 0 });
  const targetZoomRef = useRef(initialZoom ?? 1);
  const targetPanRef = useRef(initialPan ?? { x: 0, y: 0 });

  useEffect(() => {
    onViewportChange?.({ zoom, pan });
  }, [zoom, pan, onViewportChange]);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [highlighterStrokes, setHighlighterStrokes] = useState<
    HighlighterStroke[]
  >([]);
  const activeHighlighterRef = useRef<HighlighterStroke | null>(null);
  const activeMarkerRef = useRef<MarkerStroke | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    setHighlighterStrokes([]);
  }, [clearSignal]);

  const transformParts = [
    `translate(${pan.x}px, ${pan.y}px)`,
    `scale(${zoom})`,
    asset.mediaType === "image" && resolvedImageAdjustments.flipX ? "translateX(100%) scaleX(-1)" : "",
  ].filter(Boolean);

  const mediaStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
    transition: isPanning ? "none" : "transform 50ms linear",
    cursor: isPanning ? "grabbing" : zoom > 1 ? "grab" : "default",
  };
  const imageMediaStyle: CSSProperties = {
    ...mediaStyle,
    transform: transformParts.join(" "),
    filter: `brightness(${resolvedImageAdjustments.brightness}) contrast(${resolvedImageAdjustments.contrast}) saturate(${resolvedImageAdjustments.saturate})`,
  };

  const getTrimTimeFromPointer = (clientX: number): number => {
    const track = trimTrackRef.current;
    if (!track || videoDuration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
    return Math.max(0, Math.min(videoDuration, ratio * videoDuration));
  };

  const updateTrimHandle = (handle: "in" | "out", clientX: number) => {
    if (!onVideoTrimChange || videoDuration <= 0) return;
    const current = getEffectiveVideoTrim(videoTrim, videoDuration);
    const time = getTrimTimeFromPointer(clientX);
    const minGap = Math.min(0.1, Math.max(0.01, videoDuration / 100));
    const nextTrim = handle === "in"
      ? {
          inSec: Math.min(time, Math.max(0, current.outSec - minGap)),
          outSec: current.outSec,
        }
      : {
          inSec: current.inSec,
          outSec: Math.max(time, Math.min(videoDuration, current.inSec + minGap)),
        };
    onVideoTrimChange(normalizeVideoTrimSettings(nextTrim));
  };

  const handleTrimPointerMove = (event: globalThis.PointerEvent) => {
    if (!draggingTrimHandle) return;
    updateTrimHandle(draggingTrimHandle, event.clientX);
  };

  useEffect(() => {
    if (!draggingTrimHandle) return;
    window.addEventListener("pointermove", handleTrimPointerMove);
    window.addEventListener("pointerup", () => setDraggingTrimHandle(null), { once: true });
    return () => {
      window.removeEventListener("pointermove", handleTrimPointerMove);
    };
  }, [draggingTrimHandle, videoDuration, videoTrim]);

  const trimInPercent = videoDuration > 0 ? (effectiveVideoTrim.inSec / videoDuration) * 100 : 0;
  const trimOutPercent = videoDuration > 0 ? (effectiveVideoTrim.outSec / videoDuration) * 100 : 100;
  const showVideoTrimEditor = asset.mediaType === "video" && isEditMode && videoDuration > 0;
  const showImageAdjustmentEditor = asset.mediaType === "image" && isEditMode;

  const updateImageAdjustments = (updates: Slide["imageAdjustments"]) => {
    if (!onImageAdjustmentsChange) return;
    onImageAdjustmentsChange(normalizeImageAdjustments({
      ...resolvedImageAdjustments,
      ...updates,
    }));
  };

  const getContentPoint = (
    clientX: number,
    clientY: number,
  ): DrawPoint | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = (localX - pan.x) / zoom / rect.width;
    const y = (localY - pan.y) / zoom / rect.height;

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      t: performance.now(),
      h: drawSettings.rainbow ? (performance.now() / 18) % 360 : undefined,
    };
  };

  const onWheelZoom = useCallback(
    (event: globalThis.WheelEvent | WheelEvent<HTMLElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      // Calculate target zoom
      const zoomFactor = Math.pow(1.0015, -event.deltaY);
      let newTargetZoom = targetZoomRef.current * zoomFactor;
      newTargetZoom = Math.min(4, Math.max(1, newTargetZoom));

      // Calculate target pan to anchor cursor
      // We project the cursor into content space using the current targets,
      // then calculate where it should be with the new zoom.
      const currentTargetPan = targetPanRef.current;
      const currentTargetZoom = targetZoomRef.current;

      const contentX = (cursorX - currentTargetPan.x) / currentTargetZoom;
      const contentY = (cursorY - currentTargetPan.y) / currentTargetZoom;

      const newTargetPanX = cursorX - contentX * newTargetZoom;
      const newTargetPanY = cursorY - contentY * newTargetZoom;

      targetZoomRef.current = newTargetZoom;
      targetPanRef.current = { x: newTargetPanX, y: newTargetPanY };
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = (e: globalThis.WheelEvent) => onWheelZoom(e);
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  }, [onWheelZoom]);

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) return;
    event.preventDefault();
    // Sync targets to current state to stop any ongoing animation
    targetZoomRef.current = zoom;
    targetPanRef.current = pan;

    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (event: globalThis.MouseEvent) => {
      const deltaX = event.clientX - panStartRef.current.x;
      const deltaY = event.clientY - panStartRef.current.y;
      const nextPan = {
        x: panStartRef.current.panX + deltaX,
        y: panStartRef.current.panY + deltaY,
      };
      setPan(nextPan);
      targetPanRef.current = nextPan;
    };

    const onUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning]);

  // Smooth zoom animation loop
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      // Interpolate zoom
      setZoom((prevZoom) => {
        const targetZoom = targetZoomRef.current;
        if (Math.abs(targetZoom - prevZoom) < 0.001) return targetZoom;
        return prevZoom + (targetZoom - prevZoom) * 0.2;
      });

      // Interpolate pan
      setPan((prevPan) => {
        const targetPan = targetPanRef.current;
        const dist = Math.hypot(
          targetPan.x - prevPan.x,
          targetPan.y - prevPan.y,
        );
        if (dist < 0.1) return targetPan;
        return {
          x: prevPan.x + (targetPan.x - prevPan.x) * 0.2,
          y: prevPan.y + (targetPan.y - prevPan.y) * 0.2,
        };
      });

      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const drawFrame = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = performance.now();
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const renderStroke = (
        stroke: {
          points: DrawPoint[];
          size: number;
          opacity: number;
          color: string;
          rainbow: boolean;
        },
        segmentAlpha: (index: number) => number,
      ) => {
        const points = stroke.points;
        if (points.length < 2) return;

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = stroke.size;

        for (let i = 1; i < points.length; i += 1) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const alpha =
            Math.max(0, Math.min(1, segmentAlpha(i))) * stroke.opacity;
          if (alpha <= 0) continue;
          const hue = stroke.rainbow ? (p1.h ?? now / 18 + i * 8) : undefined;
          ctx.strokeStyle = stroke.rainbow
            ? `hsla(${hue}, 95%, 62%, ${alpha})`
            : stroke.color;
          if (!stroke.rainbow) {
            const color = stroke.color;
            const clean = color.startsWith("#") ? color.slice(1) : color;
            if (clean.length === 6) {
              const r = Number.parseInt(clean.slice(0, 2), 16);
              const g = Number.parseInt(clean.slice(2, 4), 16);
              const b = Number.parseInt(clean.slice(4, 6), 16);
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
          }
          ctx.beginPath();
          ctx.moveTo(p0.x * width, p0.y * height);
          ctx.lineTo(p1.x * width, p1.y * height);
          ctx.stroke();
        }
      };

      markerStrokes.forEach((stroke) => {
        renderStroke(stroke, () => 1);
      });

      const activeHighlighter = activeHighlighterRef.current;
      const allHighlighter = activeHighlighter
        ? [...highlighterStrokes, activeHighlighter]
        : highlighterStrokes;
      allHighlighter.forEach((stroke) => {
        renderStroke(stroke, (index) => {
          const age = now - stroke.points[index].t;
          return 1 - age / stroke.fadeMs;
        });
      });

      const sparkleStroke = allHighlighter[allHighlighter.length - 1];
      if (sparkleStroke?.sparkle && sparkleStroke.points.length > 0) {
        const lastPoint = sparkleStroke.points[sparkleStroke.points.length - 1];
        for (let i = 0; i < 6; i += 1) {
          const angle = (now / 120 + i) * 1.7;
          const dist = 2 + (i % 3) * 2;
          const sx = lastPoint.x * width + Math.cos(angle) * dist;
          const sy = lastPoint.y * height + Math.sin(angle) * dist;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.3 - i * 0.04})`;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.6, 2.2 - i * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      setHighlighterStrokes((prev) => {
        let changed = false;
        const next = prev.filter((stroke) => {
          const lastPoint = stroke.points[stroke.points.length - 1];
          const keep = !lastPoint || now - lastPoint.t < stroke.fadeMs;
          if (!keep) changed = true;
          return keep;
        });
        return changed ? next : prev;
      });
    };

    let raf = 0;
    const loop = () => {
      drawFrame();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [highlighterStrokes, markerStrokes, pan.x, pan.y, zoom]);

  const handleDrawStart = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!drawSettings.drawMode || event.button !== 0) return;
    const point = getContentPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();

    isDrawingRef.current = true;
    if (drawSettings.tool === "highlighter") {
      activeHighlighterRef.current = {
        id: crypto.randomUUID(),
        points: [point],
        size: drawSettings.size,
        opacity: drawSettings.opacity,
        color: drawSettings.color,
        fadeMs: drawSettings.fadeMs,
        rainbow: drawSettings.rainbow,
        sparkle: drawSettings.sparkle,
      };
      return;
    }

    activeMarkerRef.current = {
      id: crypto.randomUUID(),
      points: [point],
      size: drawSettings.size,
      opacity: drawSettings.opacity,
      color: drawSettings.color,
      rainbow: drawSettings.rainbow,
    };
  };

  const handleDrawMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!drawSettings.drawMode || !isDrawingRef.current) return;
    const point = getContentPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();

    if (drawSettings.tool === "highlighter" && activeHighlighterRef.current) {
      activeHighlighterRef.current = {
        ...activeHighlighterRef.current,
        points: [...activeHighlighterRef.current.points, point],
      };
      return;
    }

    if (drawSettings.tool === "marker" && activeMarkerRef.current) {
      activeMarkerRef.current = {
        ...activeMarkerRef.current,
        points: [...activeMarkerRef.current.points, point],
      };
    }
  };

  const handleDrawEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (drawSettings.tool === "highlighter" && activeHighlighterRef.current) {
      const stroke = activeHighlighterRef.current;
      if (stroke.points.length > 1) {
        setHighlighterStrokes((prev) => [...prev, stroke]);
      }
      activeHighlighterRef.current = null;
      return;
    }

    if (drawSettings.tool === "marker" && activeMarkerRef.current) {
      const stroke = activeMarkerRef.current;
      if (stroke.points.length > 1) {
        onMarkerStrokesChange([...markerStrokes, stroke]);
      }
      activeMarkerRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onMouseDown={onMouseDown}
      onMouseMove={(event) => {
        if (isPanning) event.preventDefault();
      }}
      onMouseUp={() => setIsPanning(false)}
      onMouseLeave={() => {
        if (isPanning) setIsPanning(false);
      }}
    >
      {asset.mediaType === "image" ? (
        <img
          src={src}
          className="media-content"
          alt={getAssetDescription(asset)}
          style={imageMediaStyle}
          draggable={false}
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          className="media-content"
          style={mediaStyle}
          controls={showControls}
          autoPlay={!paused}
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement;
            setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0);
            const nextTime = clampVideoTimeToTrim(video.currentTime, videoTrim, video.duration);
            if (Math.abs(nextTime - video.currentTime) > 0.02) {
              video.currentTime = nextTime;
            }
          }}
          onPlay={(e) => {
            const video = e.target as HTMLVideoElement;
            const nextTime = clampVideoTimeToTrim(video.currentTime, videoTrim, video.duration);
            if (Math.abs(nextTime - video.currentTime) > 0.02) {
              video.currentTime = nextTime;
            }
          }}
          onTimeUpdate={(e) => {
            const video = e.target as HTMLVideoElement;
            if (shouldStopAtTrimOut(video.currentTime, videoTrim, video.duration)) {
              video.currentTime = getEffectiveVideoTrim(videoTrim, video.duration).outSec;
              video.pause();
            }
            onTimeUpdate?.(video.currentTime);
          }}
        />
      )}

      {showVideoTrimEditor && (
        <div className="video-trim-editor" onPointerDown={(e) => e.stopPropagation()}>
          <div className="video-trim-times">
            <span>{formatVideoTrimTime(effectiveVideoTrim.inSec)}</span>
            <span>{formatVideoTrimTime(effectiveVideoTrim.outSec)}</span>
          </div>
          <div ref={trimTrackRef} className="video-trim-track">
            <div
              className="video-trim-selection"
              style={{ left: `${trimInPercent}%`, width: `${Math.max(0, trimOutPercent - trimInPercent)}%` }}
            />
            <button
              type="button"
              className="video-trim-handle in"
              style={{ left: `${trimInPercent}%` }}
              aria-label="Video trim in point"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingTrimHandle("in");
                updateTrimHandle("in", e.clientX);
              }}
            />
            <button
              type="button"
              className="video-trim-handle out"
              style={{ left: `${trimOutPercent}%` }}
              aria-label="Video trim out point"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraggingTrimHandle("out");
                updateTrimHandle("out", e.clientX);
              }}
            />
          </div>
        </div>
      )}

      {showImageAdjustmentEditor && (
        <div className="image-adjustment-editor" onPointerDown={(e) => e.stopPropagation()}>
          <div className="image-adjustment-row">
            <span>Image</span>
            <button
              type="button"
              className={resolvedImageAdjustments.flipX ? "image-tool-toggle active" : "image-tool-toggle"}
              onClick={() => updateImageAdjustments({ flipX: !resolvedImageAdjustments.flipX })}
            >
              Flip H
            </button>
            <button
              type="button"
              className="image-tool-reset"
              onClick={() => onImageAdjustmentsChange?.(undefined)}
            >
              Reset
            </button>
          </div>
          <label className="image-adjustment-slider">
            <span>Bright</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={resolvedImageAdjustments.brightness}
              onChange={(e) => updateImageAdjustments({ brightness: Number(e.target.value) })}
            />
            <output>{Math.round(resolvedImageAdjustments.brightness * 100)}%</output>
          </label>
          <label className="image-adjustment-slider">
            <span>Contrast</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={resolvedImageAdjustments.contrast}
              onChange={(e) => updateImageAdjustments({ contrast: Number(e.target.value) })}
            />
            <output>{Math.round(resolvedImageAdjustments.contrast * 100)}%</output>
          </label>
          <label className="image-adjustment-slider">
            <span>Saturate</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={resolvedImageAdjustments.saturate}
              onChange={(e) => updateImageAdjustments({ saturate: Number(e.target.value) })}
            />
            <output>{Math.round(resolvedImageAdjustments.saturate * 100)}%</output>
          </label>
        </div>
      )}

      {/* Overlay Layer */}
      <div
        className="overlay-layer"
        style={{
          ...mediaStyle,
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: isEditMode && !drawSettings.drawMode ? "auto" : "none",
          zIndex: 5,
        }}
        onPointerMove={(e) => {
          if (draggingOverlayRef.current && dragStartRef.current && onOverlayChange) {
            const dx = (e.clientX - dragStartRef.current.cx) / zoom;
            const dy = (e.clientY - dragStartRef.current.cy) / zoom;
            const { ox, oy, ow, oh, handle } = dragStartRef.current;

            if (handle) {
              let newX = ox;
              let newY = oy;
              let newW = ow;
              let newH = oh;

              if (handle.includes("left")) {
                newW = Math.max(50, ow - dx);
                newX = ox + (ow - newW);
              } else if (handle.includes("right")) {
                newW = Math.max(50, ow + dx);
              }

              if (handle.includes("top")) {
                newH = Math.max(30, oh - dy);
                newY = oy + (oh - newH);
              } else if (handle.includes("bottom")) {
                newH = Math.max(30, oh + dy);
              }

              onOverlayChange(draggingOverlayRef.current, {
                x: newX,
                y: newY,
                width: newW,
                height: newH,
              });
            } else {
              // Move
              onOverlayChange(draggingOverlayRef.current, {
                x: ox + dx,
                y: oy + dy,
              });
            }
          }
        }}
        onPointerUp={() => {
          if (draggingOverlayRef.current) {
            draggingOverlayRef.current = null;
            dragStartRef.current = null;
          }
        }}
        onPointerLeave={() => {
          if (draggingOverlayRef.current) {
            draggingOverlayRef.current = null;
            dragStartRef.current = null;
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onOverlaySelect) {
            onOverlaySelect(null);
          }
        }}
      >
        {overlays.map((overlay) => {
          if (overlay.visible === false) return null;
          const isActive = overlay.id === activeOverlayId;
          const mappedCustom: BubbleDef[] = (bubbleDefinitions || []).map(bt => ({
            bubbleDefId: `BD_CUSTOM_${bt.templateName}`,
            name: bt.templateName,
            templateName: bt.templateName,
            src: toMediaUrl(bt.imageSrc),
            type: 'speech',
            textRect: bt.defaultTextRect,
          }));
          const allBubbles = [...BUBBLE_LIBRARY, ...mappedCustom];
          const def = allBubbles.find(d => d.bubbleDefId === overlay.bubbleDefId) || allBubbles[0] || BUBBLE_LIBRARY[0];
          const bType = def.type || 'speech';
          const defaultStyle = def.defaultStyle || {};

          const bTextFont = overlay.fontFamily || defaultStyle.fontFamily || "inherit";
          const bTextSize = overlay.fontSize || defaultStyle.fontSize || 24;
          const bTextColor = overlay.textColor || defaultStyle.color || "#000000";
          const bTextWeight = overlay.fontWeight || defaultStyle.fontWeight || "normal";
          const bLineHeight = overlay.lineHeight || defaultStyle.lineHeight || 1.2;
          const bFontStyle = overlay.fontStyle || "normal";
          const bBgColor = bType === 'text' ? 'rgba(0,0,0,0.7)' : 'transparent';

          const textRect = overlay.textRect ?? def.textRect ?? { x: 0, y: 0, width: 1, height: 1 };

          return (
            <div
              key={overlay.id}
              onPointerDown={(e) => {
                if (!isEditMode) return;
                e.stopPropagation();
                if (onOverlaySelect) onOverlaySelect(overlay.id);
                if (!overlay.locked) {
                  draggingOverlayRef.current = overlay.id;
                  dragStartRef.current = { ox: overlay.x, oy: overlay.y, ow: overlay.width, oh: overlay.height, cx: e.clientX, cy: e.clientY };
                }
              }}
              style={{
                position: "absolute",
                left: `${overlay.x}px`,
                top: `${overlay.y}px`,
                width: `${overlay.width}px`,
                height: `${overlay.height}px`,
                zIndex: Math.min(overlay.zIndex ?? 1, 9),
                boxSizing: "border-box",
                cursor: isActive && !overlay.locked ? "move" : isActive ? "default" : "pointer",
                pointerEvents: isEditMode && !drawSettings.drawMode ? "auto" : "none",
                display: "block",
                backgroundColor: bBgColor as string,
                borderRadius: bType === 'text' ? "8px" : "0",
                outline: isActive ? "2px solid #55f" : "none",
                boxShadow: isActive ? "0 0 0 4px rgba(85, 85, 255, 0.4)" : "none",
              }}
            >
              {/* Bubble Graphic Layer */}
              {bType !== 'text' && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${overlay.customImageSrc ? toMediaUrl(overlay.customImageSrc) : (def.src || "")})`,
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                  transform: `scale(${overlay.flipX ? -1 : 1}, ${overlay.flipY ? -1 : 1})`,
                  pointerEvents: 'none',
                  zIndex: 1,
                }} />
              )}

              <div style={{
                position: 'absolute',
                left: `${textRect.x * 100}%`,
                top: `${textRect.y * 100}%`,
                width: `${textRect.width * 100}%`,
                height: `${textRect.height * 100}%`,
                padding: "4px",
                color: bType === 'text' ? '#fff' : (bTextColor as string),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: overlay.align === "right" ? "right" : overlay.align === "left" ? "left" : "center",
                fontFamily: bTextFont as string,
                fontSize: `${bTextSize}px`,
                fontWeight: bTextWeight as string | number,
                fontStyle: bFontStyle as string,
                lineHeight: bLineHeight as string | number,
                textShadow: overlay.textShadow && bType === 'text' ? "0 2px 4px rgba(0,0,0,0.8)" : "none",
                overflow: "hidden",
                boxSizing: "border-box",
                zIndex: 2,
              }}>
                {isActive && isEditMode ? (
                  <textarea
                    value={overlay.text}
                    onChange={(e) => {
                      if (onOverlayChange) onOverlayChange(overlay.id, { text: e.target.value });
                    }}
                    onPointerDown={(e) => e.stopPropagation()} // Stop dragging when clicking in text box
                    rows={overlay.text.split('\n').length || 1}
                    style={{
                      width: "100%",
                      height: "auto",
                      background: "transparent",
                      border: "none",
                      resize: "none",
                      outline: "none",
                      color: "inherit",
                      fontFamily: "inherit",
                      fontSize: "inherit",
                      fontWeight: "inherit",
                      fontStyle: "inherit",
                      lineHeight: "inherit",
                      margin: 0,
                      padding: 0,
                      textAlign: "inherit",
                      overflowY: "hidden",
                    }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "auto", whiteSpace: "pre-wrap", margin: 0, padding: 0, fontWeight: "inherit", fontStyle: "inherit", textAlign: "inherit", lineHeight: "inherit" }}>
                    {overlay.text}
                  </div>
                )}
              </div>

              {isActive && !overlay.locked && (
                <>
                  <div
                    onPointerDown={(e) => { e.stopPropagation(); dragStartRef.current = { ox: overlay.x, oy: overlay.y, ow: overlay.width, oh: overlay.height, cx: e.clientX, cy: e.clientY, handle: 'top-left' }; draggingOverlayRef.current = overlay.id; }}
                    style={{ position: "absolute", top: -4, left: -4, width: 8, height: 8, background: "#fff", border: "1px solid #55f", cursor: "nwse-resize", borderRadius: "50%", zIndex: 10 }}
                  />
                  <div
                    onPointerDown={(e) => { e.stopPropagation(); dragStartRef.current = { ox: overlay.x, oy: overlay.y, ow: overlay.width, oh: overlay.height, cx: e.clientX, cy: e.clientY, handle: 'top-right' }; draggingOverlayRef.current = overlay.id; }}
                    style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, background: "#fff", border: "1px solid #55f", cursor: "nesw-resize", borderRadius: "50%", zIndex: 10 }}
                  />
                  <div
                    onPointerDown={(e) => { e.stopPropagation(); dragStartRef.current = { ox: overlay.x, oy: overlay.y, ow: overlay.width, oh: overlay.height, cx: e.clientX, cy: e.clientY, handle: 'bottom-left' }; draggingOverlayRef.current = overlay.id; }}
                    style={{ position: "absolute", bottom: -4, left: -4, width: 8, height: 8, background: "#fff", border: "1px solid #55f", cursor: "nesw-resize", borderRadius: "50%", zIndex: 10 }}
                  />
                  <div
                    onPointerDown={(e) => { e.stopPropagation(); dragStartRef.current = { ox: overlay.x, oy: overlay.y, ow: overlay.width, oh: overlay.height, cx: e.clientX, cy: e.clientY, handle: 'bottom-right' }; draggingOverlayRef.current = overlay.id; }}
                    style={{ position: "absolute", bottom: -4, right: -4, width: 8, height: 8, background: "#fff", border: "1px solid #55f", cursor: "nwse-resize", borderRadius: "50%", zIndex: 10 }}
                  />
                </>
              )}
              {showOverlayIds && overlay.bubbleId && (
                <div style={{ position: "absolute", top: "-10px", left: "-10px", background: "#f0f0f0", color: "#333", border: "1px solid #999", fontSize: "10px", padding: "2px 4px", borderRadius: "8px", fontWeight: "bold", pointerEvents: "none", zIndex: 10 }}>
                  {overlay.bubbleId}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <canvas
        ref={canvasRef}
        className={
          drawSettings.drawMode ? "drawing-overlay active" : "drawing-overlay"
        }
        style={{ zIndex: 10 }} // Ensure drawing is above overlays
        onMouseDown={handleDrawStart}
        onMouseMove={handleDrawMove}
        onMouseUp={handleDrawEnd}
        onMouseLeave={handleDrawEnd}
      />
    </div>
  );
}
