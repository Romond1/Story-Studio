import { useMediaRegistry } from './useMediaRegistry';
import { validateMediaImport } from '../shared/mediaImportValidation';
import { BUILTIN_MOVEMENT_PATHS } from '../shared/content/mediaDependencies';
import { canonicalMediaPath } from '../shared/content/mediaResolution';
import { MediaPool } from './MediaPool';
import { LessonTimeline, type TimelineSlot } from './LessonTimeline';
import { TimelineFrame } from './TimelineFrame';
import { EditVideoTransport } from './EditVideoTransport';
import { registerPoolImport, insertPoolAssets } from '../shared/mediaPool';
import { toMediaUrl, resolvePassiveOverlays, MediaPathResolverContext } from './mediaUrls';
import { resolveAuthoredMediaUrl, resolveAuthoredBackground } from '../shared/content/mediaRenderResolution';
import { EditorPreviewAudioContext, useEditorPreviewAudio } from './audio/EditorPreviewAudio';
import { useEditSelection } from './useEditSelection';
import { showEditInPresent, runNavigationAudio } from '../shared/editSelection';
import { composeActivityScene } from './composeActivityScene';
import { EditDock, EditInspector, EditWorkspaceProvider, useEditHosts } from './EditWorkspace';
import { CardV2Editor } from './cardsV2/CardV2Editor';
import { CardV2Scene } from './cardsV2/CardV2Scene';
import { CardV2Controls } from './cardsV2/CardV2Controls';
import { useCardV2Session } from './cardsV2/useCardV2Session';
import { buildCardV2RenderPlan } from '../shared/cardV2Render';
import { BoosterContext } from './BoosterContext';
import { duplicateBoosterItem, moveBoosterItem, removeBoosterItem } from '../shared/cardAuthoring';
import { CardPlacementInspector } from './cardsV2/CardPlacementInspector';
import { addCardToHost, pasteHostCard, hostPlacementId, resolveCardHost, duplicateHostCard, makeHostCardIndependent, removeHostCard, updateHostGeometry, independentBoosterSlide } from '../shared/cardAuthoring';
import { createMediaSlide } from '../shared/mediaPool';
import type { CardsV2Module, CardDefinition, CardInstance } from '../shared/cardsV2';
import { TeachMovementControls } from './TeachMovementControls';
import { TeachPreview, TeachDivider, TeachNavigatorDivider, useTeachLayout } from './TeachWorkspace';
import { TeachLiveControls, TeachQuickControls } from './TeachLiveControls';
import { TeachNavigator } from './TeachNavigator';
import './teachWorkspace.css';
import { PromptCardScene } from './PromptCardScene';
import { visualMediaUrl, visualMediaBackground } from '../shared/visualMedia';
import { useRewardPresentation } from './useRewardPresentation';
import { RewardSurface } from './RewardScene';
import { createMovementPresentation, expireMovementPresentation, movementRemaining, MovementExecutionGuard } from '../shared/movementPresentation';
import { movementMediaUrl } from './movement/builtinMedia';
import { isPlainTeacherKey, claimTeacherKey, shouldIgnoreTeacherKey } from '../shared/keyboardShortcuts';
import { TransitionLayers } from './TransitionLayers';
import { useCardRuntime } from './useCardRuntime';
import type { ActivityScene, BoardVisual } from '../shared/activityScene';
import { useTeachingScene } from './useTeachingScene';
import { clientToLogical } from '../shared/teachingScene';
import type { LogicalFrame } from '../shared/staticScene';
import { PresentStatus } from './PresentStatus';
import { LogicalSceneFrame, PassiveImage, PassiveOverlays } from './StaticScene';
import {
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type WheelEvent,
  Fragment,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AssetItem,
  BadgeStudentSprite,
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
  MovementConfig,
  MovementEventConfig,
} from "../shared/types";
import { usePresentProjection } from "./usePresentProjection";
import { usePresentationMedia } from "./usePresentationMedia";
import { MediaTransportControls } from "./MediaTransportControls";
import { usePresentationSession } from "./usePresentationSession";
import { resolvePresentationTarget, reducePresentationSession, navigatePresentation, presentationToken, targetMatches, applyPresentationDrawing } from "../shared/presentationSession";
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
import {
  getMovementEventByShortcut,
  isEditableKeyTarget,
  normalizeMovementConfig,
  pickRandomMovementEvent,
} from "../shared/movement";
import { isDrawModeShortcut } from "../shared/drawingLifecycle";
import { ProjectHistory, getHistoryShortcut } from "../shared/projectHistory";
import {
  StageDrawingOverlay,
  type DrawSettings,
  type ViewportState,
} from "./drawing/StageDrawingOverlay";
import {
  ensureRewardSprites,
  getRewardShapePath,
  getRewardVariantForKey,
  normalizeSparkStudents,
  REWARD_DEFINITIONS,
  REWARD_VARIANTS,
  resolveBadgeSpriteAssetId,
  resolveRewardAppearance,
} from "../shared/sparkRewards";
import ContextMenu, { MenuItem } from "./components/ContextMenu";
import { BUILD_VERSION } from "../shared/version";
import { type AppMode, DEFAULT_MODE, ensureEditMode } from "./mode";
import { audioManager } from "./audio/AudioManager";
import { AudioSettingsWorkspace } from "./audio/AudioSettingsWorkspace";
import { CompactAudioPanel } from "./audio/CompactAudioPanel";
import { AudioStatus } from "./audio/AudioStatus";
import { SparkProvider, useSparks, DEFAULT_SPARK_CONFIG, getStudentSparkTotal } from "./sparks/SparkProvider";

import { BadgePanel } from "./sparks/BadgePanel";

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

import { MovementPanel } from "./movement/MovementPanel";
import { MovementOverlay, MovementSurface } from "./movement/MovementOverlay";

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
  const resolvePath = useContext(MediaPathResolverContext);
  clip = { ...clip, url: resolveAuthoredMediaUrl(clip.url, resolvePath) };
  const editorPreview = useContext(EditorPreviewAudioContext);
  const preview = useEditorPreviewAudio(clip.url,editorPreview);
  const playback = editorPreview ? preview : audioManager;
  if(editorPreview){onPlay=preview.play;onPause=preview.pause;onStop=preview.stop;}
  const [time, setTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const isPlaying = playback.isPlaying(clip.url);
  const duration = playback.getDuration(clip.url) || 100;
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
    const interval = setInterval(() => setTime(playback.getCurrentTime(clip.url)), 100);
    return () => clearInterval(interval);
  }, [clip.url, editorPreview]);

  // hotkey handling
  useEffect(() => {
    if (editorPreview || !clip.shortcut) return;

    const handler = (e: KeyboardEvent) => {
      if (!isPlainTeacherKey(e)) return;

      if (e.code === clip.shortcut) {
        claimTeacherKey(e);
        if (playback.isPlaying(clip.url)) {
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
            onChange={(e) => playback.seek(clip.url, Number(e.target.value))}
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
              playback.setVolume(clip.url, v);
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

type TopMode = "story" | "boost" | "badge" | "boards" | "relics" | "movement";

type LiveSessionSnapshot = {
  version: 1;
  savedAt: string;
  projectFolderPath: string;
  projectCreatedAt: string;
  appMode: AppMode;
  topMode: TopMode;
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
    const handleClickOutside = (e: globalThis.MouseEvent) => {
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 8 }}>
              <button style={{ fontSize: '0.7rem', background: '#442' }} onClick={() => triggerSpark('gold')}>Gold</button>
              <button style={{ fontSize: '0.7rem', background: '#244' }} onClick={() => triggerSpark('blue')}>Blue</button>
              <button style={{ fontSize: '0.7rem', background: '#424' }} onClick={() => triggerSpark('pink')}>Pink</button>
              <button style={{ fontSize: '0.7rem', background: '#643' }} onClick={() => triggerSpark('crown')}>Crown</button>
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
      if (!isPlainTeacherKey(e)) return;

      const rewardVariant = getRewardVariantForKey(e.key);
      if (rewardVariant) {
        claimTeacherKey(e);
        triggerSpark(rewardVariant);
        return;
      }

      if (e.key === 'Backspace') {
        if (students.length === 0) return;
        claimTeacherKey(e);
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
  selectedSpriteId,
  onSelectSprite,
}: {
  assetsById: Map<string, AssetItem>;
  getMediaUrl: (path: string) => string;
  isEditMode: boolean;
  selectedSpriteId: string | null;
  onSelectSprite: (spriteId: string) => void;
}) => {
  const { badgeConfig, setBadgeConfig, sparkConfig, students, isFinalScoreRevealed } = useSparks();
  const checkedStudents = students.filter((student) => student.badgeVisible !== false);
  const sprites = badgeConfig.badgeSprites || [];
  const motion = badgeConfig.badgeSpriteMotion || "spin";
  const durationMs = badgeConfig.badgeSpriteAnimDurationMs ?? 3200;
  const intensity = (badgeConfig.badgeSpriteAnimIntensity ?? 100) / 100;
  const shouldShowScore = isFinalScoreRevealed && badgeConfig.showFinalScore;
  const getVariantSparkCount = (student: SparkStudent, variant: (typeof REWARD_VARIANTS)[number]) => {
    if (variant === "gold") return student.yellowSparks || 0;
    if (variant === "blue") return student.blueSparks || 0;
    if (variant === "pink") return student.pinkSparks || 0;
    return student.crowns || 0;
  };

  useEffect(() => {
    const nextSprites = ensureRewardSprites(sprites, checkedStudents, () => crypto.randomUUID());
    if (nextSprites.length !== sprites.length) {
      setBadgeConfig({ badgeSprites: nextSprites });
    }
  }, [checkedStudents, setBadgeConfig, sprites]);

  const updateSprite = (spriteId: string, updates: Partial<BadgeStudentSprite>) => {
    const nextSprites = sprites.map((sprite) =>
      sprite.id === spriteId ? { ...sprite, ...updates } : sprite,
    );
    setBadgeConfig({ badgeSprites: nextSprites });
  };

  return (
    <div className={`badge-student-sprite-layer ${isEditMode ? "is-edit" : ""}`}>
      {checkedStudents.flatMap((student) => {
        return REWARD_VARIANTS.map((variant) => {
          const sprite = sprites.find(
            (item) => item.studentId === student.id && (item.variant || "gold") === variant,
          );
          if (!sprite) return null;

          const availableAssetIds = new Set(assetsById.keys());
          const appearance = resolveRewardAppearance(
            variant,
            sparkConfig,
            badgeConfig,
            availableAssetIds,
          );
          const spriteAssetId = resolveBadgeSpriteAssetId(
            sprite,
            variant,
            badgeConfig,
            availableAssetIds,
          );
          const asset = spriteAssetId ? assetsById.get(spriteAssetId) : undefined;

          const scoreText = shouldShowScore ? String(getVariantSparkCount(student, variant)) : "?";
          const motionClass = `badge-sprite-motion-${motion}`;
          const isSelected = selectedSpriteId === sprite.id;

          return (
            <Rnd
              key={sprite.id}
              className={`badge-sprite-editor-box ${isEditMode ? "is-editable" : ""} ${isSelected ? "is-selected" : ""}`}
              data-editor-label={`${student.name || "Student"} · ${REWARD_DEFINITIONS[variant].label}`}
              bounds="parent"
              disableDragging={!isEditMode}
              lockAspectRatio
              enableResizing={isEditMode && isSelected ? {
                topLeft: true,
                topRight: true,
                bottomLeft: true,
                bottomRight: true,
              } : false}
              minWidth={60}
              minHeight={60}
              maxWidth={420}
              maxHeight={420}
              size={{ width: sprite.width, height: sprite.height }}
              position={{ x: sprite.x, y: sprite.y }}
              onMouseDown={(event) => {
                if (!isEditMode) return;
                event.stopPropagation();
                onSelectSprite(sprite.id);
              }}
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
                {asset ? (
                  <img
                    src={getMediaUrl(asset.relativePath)}
                    className="badge-student-sprite"
                    alt={`${student.name || "student"} ${variant} badge`}
                  />
                ) : (
                  <svg className="badge-student-sprite badge-student-sprite--builtin" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={getRewardShapePath(appearance.shape)} />
                  </svg>
                )}
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
  const [project, renderProject] = useState<ProjectState | null>(null);
  const mediaRegistry = useMediaRegistry(project ? { format: 'legacy', data: project.data } : null, project?.folderPath ?? null, project?.activationToken);
  const projectRef = useRef<ProjectState | null>(null);
  const historyRef = useRef(new ProjectHistory<ProjectData>());
  const gestureRef = useRef<object>();
  const textEditRef = useRef<object>();
  // Update synchronously so IPC completions see even edits React has not rendered
  // yet. Project data is immutable: its reference identifies the saved revision.
  const setProject = useCallback((update: React.SetStateAction<ProjectState | null>, authored = true) => {
    const next = typeof update === "function" ? update(projectRef.current) : update;
    if (!next) historyRef.current.reset(null);
    else if (authored) historyRef.current.record(next.data, gestureRef.current ?? textEditRef.current);
    else historyRef.current.rebase(next.data);
    projectRef.current = next;
    dirtyRef.current = historyRef.current.isDirty;
    renderDirty(dirtyRef.current);
    renderProject(next);
  }, []);
  const operationRef = useRef(false);
  const [selectedBadgeSpriteId, setSelectedBadgeSpriteId] = useState<string | null>(null);
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
  const [editPreviewVideo, setEditPreviewVideo] = useState<HTMLVideoElement|null>(null);
  useEffect(() => {
    if (appMode !== "edit") {
      setSelectedBadgeSpriteId(null);
    }
  }, [appMode]);

  const ENABLE_BOOST_MODE = true;
  const presentation = usePresentationSession(projectRef);
  const editor = useEditSelection(projectRef, presentation.session);
  const selection = appMode === 'edit' ? editor : presentation;
  const { session: presentationSession, setTopMode, setSelectedSectionId, setBoostTab,
    setSelectedBoostItemId, setSelectedACardId, setCurrentIndex } = selection;
  const { setActiveMovementEvent } = presentation;
  const liveSession = presentation.session;
  useEffect(() => {
    const data=project?.data;if(!data)return;
    const cursor=editor.cursor.current;
    if(cursor.storySlideId&&!data.slides.some(s=>s.id===cursor.storySlideId)) editor.setCurrentIndex(Math.max(0,data.slides.findIndex(s=>s.sectionId===cursor.sectionId)));
    if(cursor.sectionId&&!data.sections.some(s=>s.id===cursor.sectionId)) editor.setSelectedSectionId(data.slides.find(s=>s.id===editor.cursor.current.storySlideId)?.sectionId??data.sections[0]?.id??null);
  },[project?.data]);
  const topMode = presentationSession.mode;
  const selectedACardId = presentationSession.boardId;
  const selectedSectionId = presentationSession.sectionId;
  const boostTab = presentationSession.boostTab;
  const selectedBoostItemId = presentationSession.boostItemId;
  const currentIndex = Math.max(0, project?.data.slides.findIndex(slide => slide.id === presentationSession.storySlideId) ?? 0);
  const [selectedLibraryBCardId, setSelectedLibraryBCardId] = useState<string | null>(null);
  const [cardsV2Open, setCardsV2Open] = useState(false);
  const [selectedV2Card, setSelectedV2Card] = useState('');
  const [previewV2Face, setPreviewV2Face] = useState('');
  const [reuseCardIndependent,setReuseCardIndependent]=useState(false);
  const [,refreshCardClipboard]=useState(0);
  const cardClipboard = useRef<{project:string;card:CardDefinition;instance:CardInstance}|null>(null);
  const hasLegacyCards = !!(Object.keys(project?.data.aCardLibrary ?? {}).length || Object.keys(project?.data.bCardLibrary ?? {}).length);
  useEffect(() => { setCardsV2Open(false); }, [project?.folderPath, appMode]);
  const [boostSearchQuery, setBoostSearchQuery] = useState("");
  const [selectedStoryRefId, setSelectedStoryRefId] = useState<string | null>(null);
  const [selectedPlacedBCardId, setSelectedPlacedBCardId] = useState<string | null>(null);
  const [overlayBCardClickAction, setOverlayBCardClickAction] = useState<BCardOverlayClickAction>("flip");
  const [badgeVisibleState, setBadgeVisibleState] = useState(false);
  const [finalScoreRevealedState, setFinalScoreRevealedState] = useState(false);
  const [storyRefsCollapsed, setStoryRefsCollapsed] = useState(true);
  const [storyBCardTeachCollapsed, setStoryBCardTeachCollapsed] = useState(true);
  const [boostBCardTeachCollapsed, setBoostBCardTeachCollapsed] = useState(true);
  const activeMovementEvent = liveSession.overlays.movement;

  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(
    null,
  );
  const [renamingSlideId, setRenamingSlideId] = useState<string | null>(null);
  const [updateAudio, setUpdateAudio] = useState(0);
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
  const closeAudioSettings = useCallback(() => setAudioSettingsOpen(false), []);
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
  const [poolBusy,setPoolBusy] = useState(false);
  const [isDirty, renderDirty] = useState(false);
  const dirtyRef = useRef(false);
  const setIsDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    renderDirty(dirty);
  }, []);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSaveChoiceModal, setShowSaveChoiceModal] = useState(false);
  const [isSaveInProgress, setIsSaveInProgress] = useState(false);
  const [showSlideSelector, setShowSlideSelector] = useState(false);
  const [bubblePanelOpen, setBubblePanelOpen] = useState(false);
  const [copyBubbleOverlayId, setCopyBubbleOverlayId] = useState<string | null>(null);
  const [copyBubbleTargetIds, setCopyBubbleTargetIds] = useState<string[]>([]);
  const [showBreakBgLibrary, setShowBreakBgLibrary] = useState(false);
  const [breakThumbDrag, setBreakThumbDrag] = useState<{
    screenScale: number;
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
    "create" | "open" | "close" | "home" | null
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
  const rosterPersistenceReady = useRef(false);
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
      if (operationRef.current) {
        showToast("Please wait for the project operation to finish, then close again", "edit", 2200);
        return;
      }
      if (dirtyRef.current) {
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
          parsed.topMode === "relics" ||
          parsed.topMode === "movement"
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
        sparkStudents: normalizeSparkStudents(parsed.sparkStudents, () => crypto.randomUUID()),
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
    rosterPersistenceReady.current = false;
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
        rosterPersistenceReady.current = true;
        setStudentRoster(normalized.studentRoster);
        if (normalized.studentRoster.length === 0 && fallbackSettings.studentRoster.length > 0)
          showToast('A local roster backup exists. Use Students to explicitly import or map its identities.', 'edit', 4000);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setStudentRoster(fallbackSettings.studentRoster);
          showToast("Showing a read-only local roster backup. Restore access to Students before editing profiles.", "edit", 4000);
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
    mediaRegistry.registry?.list().forEach((asset) => { if (mediaRegistry.registry?.get(asset.id)) map.set(asset.id, asset); });
    return map;
  }, [project]);

  const relicSystem = useMemo(
    () => normalizeRelicSystem(project?.data.relicSystem),
    [project?.data.relicSystem],
  );

  const [cardRuntimeGeneration, setCardRuntimeGeneration] = useState(0);
  const rewardScope = JSON.stringify([liveSession.sessionId, liveSession.projectId, cardRuntimeGeneration]);
  const rewards = useRewardPresentation({ resolveAsset: mediaRegistry.resolve, scope: rewardScope, project, setProject, roster: studentRoster, setDirty: setIsDirty, setBadgeVisible: setBadgeVisibleState, setScoresRevealed: setFinalScoreRevealedState });

  const visualScope = JSON.stringify([liveSession.sessionId, liveSession.projectId, cardRuntimeGeneration]);
  const toVisualMediaUrl = (path: string) => visualMediaUrl(mediaRegistry.resolvePath(path) ?? '', visualScope);
  const movementScope = `${liveSession.sessionId}:${cardRuntimeGeneration}`;
  const movementConfig = useMemo(
    () => normalizeMovementConfig(project?.data.movement),
    [project?.data.movement],
  );
  const movementPath = activeMovementEvent?.event.gifRelativePath;
  const scopedMovement = activeMovementEvent && movementPath && !BUILTIN_MOVEMENT_PATHS.includes(canonicalMediaPath(movementPath) ?? '')
    ? { ...activeMovementEvent, gifSrc: mediaRegistry.resolvePath(movementPath) ?? '' } : activeMovementEvent;
  const movementJingleUrl = useMemo(
    () => movementConfig.jingleRelativePath ? movementMediaUrl(movementConfig.jingleRelativePath, movementScope, mediaRegistry.resolvePath) : null,
    [movementConfig.jingleRelativePath, movementScope, mediaRegistry.resolvePath],
  );

  const updateMovementConfig = useCallback((nextMovement: MovementConfig) => {
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          movement: normalizeMovementConfig(nextMovement),
        },
      };
    });
    setIsDirty(true);
  }, []);

  const importMovementGif = useCallback(async (eventId: string) => {
    if (!project) return;
    const result = await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
    if (!result || (!result.importedAssets.length && !result.replacedAssets?.length)) return;

    const normalizedImportedAssets = [...decorateImportedAssetsForContext(project.data, result.importedAssets), ...(result.replacedAssets ?? [])];
    const gifAsset = normalizedImportedAssets.find((asset) => /\.gif$/i.test(asset.originalName || asset.relativePath));
    if (!gifAsset) {
      showToast("Choose an animated GIF for Movement", "edit", 1600);
      return;
    }

    setProject((prev) => {
      if (!prev) return prev;
      const currentMovement = normalizeMovementConfig(registerPoolImport(prev.data, result).movement);
      return {
        ...prev,
        data: {
          ...prev.data,
          ...registerPoolImport(prev.data, result),
          movement: {
            ...currentMovement,
            events: currentMovement.events.map((event) =>
              event.id === eventId ? { ...event, gifRelativePath: gifAsset.relativePath } : event,
            ),
          },
        },
      };
    });
    setIsDirty(true);
  }, [project, showToast]);

  const importMovementJingle = useCallback(async () => {
    if (!project) return;
    const result = await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
    if (!result || (!result.importedAssets.length && !result.replacedAssets?.length)) return;

    const normalizedImportedAssets = [...decorateImportedAssetsForContext(project.data, result.importedAssets), ...(result.replacedAssets ?? [])];
    const audioAsset = normalizedImportedAssets.find((asset) =>
      asset.mediaType === "audio" || /\.(avi|mp4|mov|webm|mkv)$/i.test(asset.originalName || asset.relativePath),
    );
    if (!audioAsset) {
      showToast("Choose .avi, .mp3, .wav, or another audio/video file for the Movement jingle", "edit", 1800);
      return;
    }

    setProject((prev) => {
      if (!prev) return prev;
      const currentMovement = normalizeMovementConfig(registerPoolImport(prev.data, result).movement);
      return {
        ...prev,
        data: {
          ...prev.data,
          ...registerPoolImport(prev.data, result),
          movement: {
            ...currentMovement,
            jingleRelativePath: audioAsset.relativePath,
          },
        },
      };
    });
    setIsDirty(true);
  }, [project, showToast]);

  useEffect(() => {
    if (!movementJingleUrl || !movementConfig.jingleEnabled) return;
    void audioManager.preload(movementJingleUrl);
  }, [movementJingleUrl, movementConfig.jingleEnabled]);

  useEffect(() => {
    if (!project || !rosterPersistenceReady.current) return;
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
    }, false);
  }, [project, studentRoster]);

  const updateRelicSystem = useCallback((updater: (current: RelicSystem) => RelicSystem) => {
    setProject((prev) => {
      if (!prev) return prev;
      const nextRelicSystem = normalizeRelicSystem(updater(normalizeRelicSystem(prev.data.relicSystem)));
      rewards.observeVisibility(nextRelicSystem.showOnStage);
      return {
        ...prev,
        data: {
          ...prev.data,
          relicSystem: nextRelicSystem,
        },
      };
    });
    setIsDirty(true);
  }, [showToast, rewards.observeVisibility]);

  const patchRelicSystem = useCallback((updates: Partial<RelicSystem>) => {
    updateRelicSystem((current) => ({ ...current, ...updates }));
  }, [updateRelicSystem]);

  const movementFrameRef = useRef<LogicalFrame>({ width: 1280, height: 720 });
  const movementScopeRef = useRef(movementScope);
  movementScopeRef.current = movementScope;
  const movementExecution = useRef(new MovementExecutionGuard());
  const playMovementJingle = useCallback(() => {
    if (!movementConfig.jingleEnabled) return;
    if (movementJingleUrl) {
      audioManager.stopClip(movementJingleUrl);
      audioManager.playClip(movementJingleUrl, movementConfig.jingleVolume ?? 0.35, false, { fadeEnabled: false }, "sfx");
      return;
    }
    audioManager.playGeneratedChime(movementConfig.jingleVolume ?? 0.35);
  }, [movementConfig.jingleEnabled, movementConfig.jingleVolume, movementConfig.jingleRelativePath, movementJingleUrl]);

  const triggerMovementEvent = useCallback((event: MovementEventConfig | null, commandId = crypto.randomUUID()) => {
    if (!event || !event.enabled) return;
    if (movementScope !== movementScopeRef.current) return;
    const scope = movementScope;
    if (!movementExecution.current.claim(scope, commandId)) return;
    const next = createMovementPresentation(commandId, event, Date.now(), movementFrameRef.current);
    setActiveMovementEvent(next);
    playMovementJingle();
  }, [playMovementJingle, movementScope]);

  const triggerRandomMovementEvent = useCallback(() => {
    triggerMovementEvent(pickRandomMovementEvent(movementConfig));
  }, [movementConfig, triggerMovementEvent]);

  useEffect(() => {
    if (!activeMovementEvent) return;
    const timeout = window.setTimeout(() => {
      setActiveMovementEvent((current) => expireMovementPresentation(current, activeMovementEvent.id, Date.now()));
    }, movementRemaining(activeMovementEvent, Date.now()));
    return () => window.clearTimeout(timeout);
  }, [activeMovementEvent]);

  useEffect(() => {
    if (appMode !== "teach") return;
    const handleMovementHotkey = (event: KeyboardEvent) => {
      if (!isPlainTeacherKey(event)) return;
      const movementEvent = getMovementEventByShortcut(movementConfig, event.code);
      if (!movementEvent) return;
      claimTeacherKey(event);
      triggerMovementEvent(movementEvent);
    };
    window.addEventListener("keydown", handleMovementHotkey, { capture: true });
    return () => window.removeEventListener("keydown", handleMovementHotkey, { capture: true });
  }, [appMode, movementConfig, triggerMovementEvent]);

  const acceptRosterSnapshot = useCallback((saved: StudentRosterSettings): StudentRosterEntry[] => {
    setStudentRoster(saved.studentRoster);
    try { window.localStorage.setItem(STUDENT_ROSTER_FALLBACK_STORAGE_KEY, JSON.stringify(saved)); }
    catch (error) { console.error('Could not update optional roster cache', error); }
    return saved.studentRoster;
  }, []);
  const profileWriteError = useCallback((error: unknown) => {
    console.error(error);
    showToast(`Student profile was not saved: ${error instanceof Error ? error.message : String(error)}`, 'edit', 4000);
  }, [showToast]);

  const addRosterStudent = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    try {
      if (!rosterPersistenceReady.current || !window.appApi.students) throw new Error('Open Students after restoring access to profile storage.');
      const saved = await window.appApi.students.createProfile({ name: name.trim() });
      const savedRoster = acceptRosterSnapshot(saved);
      // Creation appends the new main-issued identity to its committed snapshot.
      const student = savedRoster[savedRoster.length - 1];
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
      showToast(`Added ${student.name}`, 'success', 1200);
      return true;
    } catch (error) { profileWriteError(error); return false; }
  }, [acceptRosterSnapshot, profileWriteError, showToast, updateRelicSystem]);

  const renameRosterStudent = useCallback(async (studentId: string, name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    try {
      if (!rosterPersistenceReady.current || !window.appApi.students) throw new Error('Open Students after restoring access to profile storage.');
      acceptRosterSnapshot(await window.appApi.students.updateProfile({ id: studentId, name: name.trim() }));
      showToast('Student renamed', 'success', 1200);
      return true;
    } catch (error) { profileWriteError(error); return false; }
  }, [acceptRosterSnapshot, profileWriteError, showToast]);

  const archiveRosterStudent = useCallback(async (studentId: string) => {
    try {
      if (!rosterPersistenceReady.current || !window.appApi.students) throw new Error('Open Students after restoring access to profile storage.');
      acceptRosterSnapshot(await window.appApi.students.setArchived({ id: studentId, archived: true }));
      showToast('Student removed from active roster', 'success', 1400);
    } catch (error) { profileWriteError(error); }
  }, [acceptRosterSnapshot, profileWriteError, showToast]);

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

  const runRelicProgressAction = rewards.relicAction;

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
    const result = await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
    if (!result || (!result.importedAssets.length && !result.replacedAssets?.length)) return;
    const normalizedImportedAssets = [...decorateImportedAssetsForContext(project.data, result.importedAssets), ...(result.replacedAssets ?? [])];
    const imageAsset = normalizedImportedAssets.find((asset) => asset.mediaType === "image");
    if (!imageAsset) {
      showToast("Choose an image file for relic art", "edit", 1600);
      return;
    }
    setProject((prev) => {
      if (!prev) return prev;
      const current = normalizeRelicSystem(registerPoolImport(prev.data, result).relicSystem);
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
          ...registerPoolImport(prev.data, result),
          relicSystem: nextRelicSystem,
        },
      };
    });
    setIsDirty(true);
  }, [project, showToast]);

  useEffect(() => {
    const handleRelicHotkeys = (event: KeyboardEvent) => {
      if (shouldIgnoreTeacherKey(event)) return;
      // Drawing owns its reserved chord even if a custom Relic shortcut matches.
      if (isDrawModeShortcut({ ctrlKey: event.ctrlKey, metaKey: event.metaKey,
        altKey: event.altKey, shiftKey: event.shiftKey, repeat: event.repeat, key: event.key,
        target: event.target instanceof HTMLElement ? event.target : null })) return;
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
        claimTeacherKey(event);
        runRelicProgressAction("increase");
      } else if (matchesRelicHotkey(event, relicSystem.hotkeys.decreaseProgress)) {
        claimTeacherKey(event);
        runRelicProgressAction("decrease");
      } else if (matchesRelicHotkey(event, relicSystem.hotkeys.toggleWidget)) {
        claimTeacherKey(event);
        toggleRelicWidgetVisibility();
      } else if (!event.ctrlKey || !event.altKey || event.metaKey || event.shiftKey) {
        return;
      } else if (event.key === "r" || event.key === "R") {
        claimTeacherKey(event);
        runRelicProgressAction("reset");
      } else if (event.key === "c" || event.key === "C") {
        claimTeacherKey(event);
        runRelicProgressAction("complete");
      } else if (event.key === "k" || event.key === "K") {
        claimTeacherKey(event);
        rewards.showRelicReward(true);
      }
    };
    window.addEventListener("keydown", handleRelicHotkeys, true);
    return () => window.removeEventListener("keydown", handleRelicHotkeys, true);
  }, [matchesRelicHotkey, relicSystem.hotkeys, runRelicProgressAction, toggleRelicWidgetVisibility]);

  const sections = project?.data.sections ?? [];
  const presentationTarget = resolvePresentationTarget(project?.data ?? null, presentationSession);
  const activeTargetToken = presentationToken(presentationSession, presentationTarget);
  const liveTarget = resolvePresentationTarget(project?.data ?? null, liveSession);
  const liveAsset = project?.data.assets.find(a=>a.id===liveTarget.slide?.assetId) ?? null;
  const liveBindCards = useCardRuntime(`${liveSession.sessionId}:${liveSession.projectId}:${cardRuntimeGeneration}`, liveTarget.occurrenceId, liveSession.targetRevision);
  const editBindCards = useCardRuntime(`${presentationSession.sessionId}:${presentationSession.projectId}:${cardRuntimeGeneration}`, presentationTarget.occurrenceId, presentationSession.targetRevision);
  const bindCards = appMode === 'edit' ? editBindCards : liveBindCards;
  const activeItem = presentationTarget.item;
  const v2Host = resolveCardHost(presentationTarget);
  const v2PlacementId = project && v2Host ? hostPlacementId(project.data,v2Host) : undefined;
  const v2Module = project?.data.cardsV2;
  const v2Activity = v2Module && v2PlacementId ? v2Module.activities[v2Module.placements[v2PlacementId]?.activityId] : undefined;
  const liveV2ModuleRef=useRef(v2Module);
  if(appMode==='teach')liveV2ModuleRef.current=v2Module;
  const liveV2Module=liveV2ModuleRef.current;
  const liveV2Host = resolveCardHost(liveTarget);
  const liveV2PlacementId = project && liveV2Host ? hostPlacementId(project.data,liveV2Host) : undefined;
  const v2Runtime = useCardV2Session(liveV2Module, JSON.stringify([liveSession.sessionId, liveSession.projectId, cardRuntimeGeneration]), {
    sessionId: liveSession.sessionId, projectId: liveSession.projectId ?? '', occurrenceId: liveTarget.occurrenceId, targetRevision: liveSession.targetRevision, revision: 0,
  }, liveV2PlacementId);
  const liveV2Activity = liveV2Module && liveV2PlacementId ? liveV2Module.activities[liveV2Module.placements[liveV2PlacementId]?.activityId] : undefined;
  const liveV2Plan = liveV2Module && liveV2Activity ? buildCardV2RenderPlan(liveV2Module,liveV2Activity,v2Runtime.state??undefined,id=>{const asset=assetsById.get(id);return asset?toVisualMediaUrl(asset.relativePath):undefined;}) : undefined;
  const v2Plan = v2Module && v2Activity ? buildCardV2RenderPlan(v2Module, appMode === 'edit' ? {...v2Activity,instances:v2Activity.instances.map(i=>({...i,initiallyConcealed:false,...(i.id===selectedV2Card&&v2Module.cards[i.cardId].faces.some(f=>f.id===previewV2Face)?{initialFaceId:previewV2Face}:{})}))} : v2Activity, appMode === 'teach' ? v2Runtime.state ?? undefined : undefined, id => {
    const asset = project?.data.assets.find(item => item.id === id && item.mediaType === 'image');
    return asset ? toVisualMediaUrl(asset.relativePath) : undefined;
  }) : undefined;
  useEffect(()=>{if(selectedV2Card&&!v2Activity?.instances.some(i=>i.id===selectedV2Card)){setSelectedV2Card('');setPreviewV2Face('');}},[presentationTarget.occurrenceId,v2Activity,selectedV2Card]);
  const activeBoostSequence = presentationTarget.sequence;
  const activeBoostIndex = presentationTarget.sequenceIndex;
  const selectedSection = presentationTarget.section;
  const selectedSectionType = topMode === 'boost' && activeItem && activeItem.type !== 'slideRef' && activeItem.type !== 'breakRef'
    ? activeItem.type : selectedSection?.type;

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

  const currentSlide = presentationTarget.slide;
  const currentAsset = currentSlide ? (assetsById.get(currentSlide.assetId) ?? null) : null;

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
  const overlayBinding = bindCards('overlays', activeOverlayBCardInstances);
  const overlayBCardTeachStates = overlayBinding.state.states;
  const boardBinding = (id: string, ref = 'board') => bindCards(ref, project?.data.aCardLibrary?.[id]?.bCardInstances ?? []);
  const selectedOverlayBCardInstanceId =
    selectedPlacedBCardId && activeOverlayBCardInstances.some((item) => item.id === selectedPlacedBCardId)
      ? selectedPlacedBCardId
      : (activeOverlayBCardInstances[0]?.id || null);
  const selectedOverlayBCardState = selectedOverlayBCardInstanceId
    ? (overlayBCardTeachStates[selectedOverlayBCardInstanceId] || DEFAULT_BCARD_TEACH_STATE)
    : null;

  const setOverlayBCardState = (instanceId: string, next: BCardTeachState) => {
    overlayBinding.setState(instanceId, next);
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

  const resolvedCurrentSrc =
    project && currentAsset ? mediaRegistry.resolve(currentAsset.id) ?? null : null;

  const [modernEdit, setModernEdit] = useState(() => { try { return localStorage.getItem('story-studio.edit-layout') !== 'legacy'; } catch { return true; } });
  const editWorkspace = appMode === 'edit' && modernEdit;
  const [editFocus, setEditFocus] = useState(false);
  const editHosts = useEditHosts();
  const teachLayout = useTeachLayout(appMode);
  const [teachSecondaryOpen, setTeachSecondaryOpen] = useState(false);
  const [presentFrame, setPresentFrame] = useState<LogicalFrame | null>(null);
  const presentMode = appMode === 'teach' || presentFrame !== null;
  const [viewportResetSignal, setViewportResetSignal] = useState(0);
  const liveTeachingScene = useTeachingScene(JSON.stringify(presentationToken(liveSession,liveTarget)));
  const editTeachingScene = useTeachingScene(JSON.stringify(activeTargetToken));
  const teachingScene = appMode === 'edit' ? editTeachingScene : liveTeachingScene;
  // One occurrence-scoped runtime viewport feeds both renderers and drawing interaction.
  viewportRef.current = teachingScene.state.viewport;
  const staticStageRef = useRef<HTMLDivElement | null>(null);
  const [staticFrame, setStaticFrame] = useState({ width: 1280, height: 720 });
  useEffect(() => {
    const stage = staticStageRef.current;
    if (!stage) return;
    const update = () => {
      const logical = stage.querySelector<HTMLElement>('[data-logical-scene]') ?? stage;
      if (logical.clientWidth > 0 && logical.clientHeight > 0) setStaticFrame({ width: logical.clientWidth, height: logical.clientHeight });
    };
    update(); const observer = new ResizeObserver(update); observer.observe(stage);
    return () => observer.disconnect();
  }, [presentationTarget.occurrenceId, editWorkspace]);
  useEffect(() => {
    if (appMode === 'teach') setPresentFrame(frame => frame ?? staticFrame);
  }, [appMode]);
  const breakSection = presentationTarget.section?.type === 'break' ? presentationTarget.section : null;
  const liveBreak = liveTarget.section?.type === 'break' ? liveTarget.section : null;
  const activity = composeActivityScene(project?.data??null,presentationSession,presentationTarget,bindCards,timerState,visualScope,appMode==='teach');
  const liveActivity = composeActivityScene(project?.data??null,liveSession,liveTarget,liveBindCards,timerState,visualScope,true);
  for (const renderActivity of [activity, liveActivity]) {
    renderActivity.images = Object.fromEntries(Object.entries(renderActivity.images).flatMap(([id, url]) => { const src = mediaRegistry.resolvePath(url); return src ? [[id, src]] : []; }));
    if (renderActivity.break) {
      renderActivity.break.background = resolveAuthoredBackground(renderActivity.break.background ?? '#111', mediaRegistry.resolvePath);
      renderActivity.break.thumbnails = renderActivity.break.thumbnails.flatMap(item => { const src = mediaRegistry.resolvePath(item.src); return src ? [{ ...item, src }] : []; });
    }
  }
  const renderAudioClip = (clip: AudioClip): AudioClip => ({ ...clip, url: resolveAuthoredMediaUrl(clip.url, mediaRegistry.resolvePath) });
  const teachAudioSection = presentationTarget.section ? { ...presentationTarget.section, bgm: presentationTarget.section.bgm?.map(renderAudioClip) } : undefined;
  const teachAudioSlide = presentationTarget.slide ? { ...presentationTarget.slide, dialogue: presentationTarget.slide.dialogue?.map(renderAudioClip), sfx: presentationTarget.slide.sfx?.map(renderAudioClip), bgm: presentationTarget.slide.bgm ? renderAudioClip(presentationTarget.slide.bgm) : undefined } : undefined;
  // Present owns the live decoder in either Control mode. Editor media is local.
  const usesPresentVideo = appMode === 'teach';
  const mediaPlayback = usePresentationMedia(liveAsset?.mediaType === 'video'
    ? JSON.stringify([liveSession.sessionId,cardRuntimeGeneration,liveTarget.occurrenceId,liveTarget.slide?.id,liveAsset.id]) : null,
    resolveVideoAudioSettings(liveTarget.slide?.videoAudio),liveTarget.slide?.videoTrim,true);
  if (mediaPlayback.status) lastMediaTimeRef.current = mediaPlayback.status.positionSec;
  const rewardPresentation = rewards.projectScene(liveBreak ? {width:1920,height:1080} : presentFrame ?? staticFrame,liveTarget.contentId==='badge',finalScoreRevealedState);
  useEffect(()=>{if(liveTarget.contentId==='badge')rewards.reconcileBadge();},[rewardScope,liveTarget.kind,project?.data.sparkStudents,project?.data.badgeConfig?.badgeSprites]);
  const { openPresent: openProjectedPresent, transition: sceneTransition } = usePresentProjection({...liveSession,overlays:{...liveSession.overlays,movement:scopedMovement}},liveTarget,liveAsset,liveAsset?mediaRegistry.resolve(liveAsset.id)??null:null,{
    imageHeightFraction:liveActivity.boards.some(b=>b.card.stageMode==='half')?0.5:undefined,
    frame:liveBreak?{width:1920,height:1080}:presentFrame??{width:1280,height:720},viewport:liveTeachingScene.state.viewport,
    markerStrokes:liveBreak?.markerStrokes??liveTarget.slide?.markerStrokes??[],transient:liveTeachingScene.state.transient,adjustments:liveTarget.slide?.imageAdjustments,
    overlays:liveBreak?[]:resolvePassiveOverlays(liveTarget.slide?.overlays??[],project?.data.bubbleDefinitions,visualScope,path => mediaRegistry.resolvePath(path) ?? ''),
  },liveActivity,cardRuntimeGeneration,mediaPlayback.intent,rewardPresentation,liveV2Plan);

  movementFrameRef.current = breakSection ? { width: 1920, height: 1080 } : presentFrame ?? staticFrame;

  const showInPresent = () => {
    const next = showEditInPresent(editor.cursor.current,presentation.ref.current);
    if(next !== presentation.ref.current) runNavigationAudio('teach',next.sectionId!==presentation.ref.current.sectionId,audioManager);
    presentation.commit(next);
  };
  const openPresent = async () => {
    if (!presentFrame) setPresentFrame(staticFrame);
    setAppMode('teach');
    await openProjectedPresent();
  };

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
      if (index === currentIndex && presentationTarget.kind === "slide" && selectedSectionId === project.data.slides[index]?.sectionId) return;
      const targetSlide = project?.data.slides[index];
      if (!targetSlide) return;


      // Ensure the view switches if the target slide is in a different section
      // This fixes the bug where the stage gets "stuck" on a break section
      if (targetSlide.sectionId !== selectedSectionId) {
        setSelectedSectionId(targetSlide.sectionId);
      }

      setCurrentIndex(index);
      runNavigationAudio(appMode,targetSlide.sectionId !== selectedSectionId,audioManager);
    },
    [project, currentIndex, selectedSectionId, presentationTarget.kind, appMode],
  );

  const navigateLiveTarget = (direction: -1 | 1) => {
    const current = projectRef.current;
    if (!current) return;
    const session = selection.ref.current;
    const target = resolvePresentationTarget(current.data, session);
    if (!targetMatches(session, target, activeTargetToken)) return;
    const next = navigatePresentation(current.data, session, direction);
    if (next === session) return;
    if (session.mode === 'boost') {
      selection.commit(next);
      runNavigationAudio(appMode,false,audioManager);
    } else {
      const index = current.data.slides.findIndex(slide => slide.id === next.storySlideId);
      if (index >= 0) goToSlideByAbsoluteIndex(index);
    }
  };
  const goToNextSlide = () => navigateLiveTarget(1);
  const goToPrevSlide = () => navigateLiveTarget(-1);

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
      if (s.id === currentSlide.id) {
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
      if (topMode === "boost") { navigateLiveTarget(offset < 0 ? -1 : 1); return; }
      if (presentationTarget.kind === "break") { navigateLiveTarget(offset < 0 ? -1 : 1); return; }
      const currentVisiblePos = visibleSlideIndices.indexOf(currentIndex);
      if (currentVisiblePos < 0) return;
      const target = visibleSlideIndices[currentVisiblePos + offset];
      if (target === undefined) return;
      goToSlideByAbsoluteIndex(target);
    },
    [visibleSlideIndices, currentIndex, goToSlideByAbsoluteIndex, presentationSession.revision],
  );

  const updateSequenceItem = (itemId: string, updates: Partial<SequenceItem>) => {
    if (!project || !project.data.boostPack) return;
    const prop = (boostTab + 'Sequence') as 'activationSequence' | 'languageSequence' | 'gamesSequence';
    const seq = project.data.boostPack[prop] || [];
    const newSeq = seq.map(item => item.id === itemId ? { ...item, ...updates } as SequenceItem : item);
    setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack, [prop]: newSeq } } });
    setIsDirty(true);
  };

  const commitCardData = (data: ProjectData) => { setProject(previous=>previous?{...previous,data}:previous); setIsDirty(true); };
  const selectV2Card = (id:string) => { setSelectedV2Card(id); if(id!==selectedV2Card)setPreviewV2Face(''); setEditFocus(false); };
  const cardAction = (action:()=>void) => { try { action(); } catch(error) { showToast(error instanceof Error ? error.message : 'Card change could not be applied.','edit',3000); } };
  const quickAddCard = (sourceCardId?:string, independent=false, newCanvas=false, paste=false) => cardAction(()=>{
    if(!project || appMode!=='edit')return;
    let data=project.data, host=newCanvas?null:v2Host;
    if(!host && topMode==='boost' && boostTab!=='badge') {
      const item: SequenceItem={id:crypto.randomUUID(),type:'cardActivityRef',engine:'card-v2',placementId:''};
      // Creation of a new empty Booster card canvas and its placement is one history revision.
      const prop=`${boostTab}Sequence` as const;
      const pack=data.boostPack??{activationSequence:[],languageSequence:[],gamesSequence:[]};
      const sequence=[...pack[prop]]; sequence.splice(Math.max(0,activeBoostIndex+1),0,item);
      data={...data,boostPack:{...pack,[prop]:sequence}};
      host={kind:'booster',id:item.id,tab:boostTab};
      const added=paste&&cardClipboard.current?pasteHostCard(data,host,cardClipboard.current,()=>crypto.randomUUID()):addCardToHost(data,host,()=>crypto.randomUUID(),sourceCardId,independent);
      commitCardData(added.data);setSelectedBoostItemId(item.id);selectV2Card(added.instanceId);return;
    }
    if(!host)return;
    const added=paste&&cardClipboard.current?pasteHostCard(data,host,cardClipboard.current,()=>crypto.randomUUID()):addCardToHost(data,host,()=>crypto.randomUUID(),sourceCardId,independent);commitCardData(added.data);selectV2Card(added.instanceId);
  });
  const addSetToCanvas = (setId:string) => cardAction(()=>{
    if(!project||!v2Host)return;const set=project.data.cardsV2?.sets[setId];if(!set)return;
    let data=project.data,last='';for(const entry of set.entries){const added=addCardToHost(data,v2Host,()=>crypto.randomUUID(),entry.cardId,reuseCardIndependent);data=added.data;last=added.instanceId;}
    if(last){commitCardData(data);selectV2Card(last);}
  });
  const duplicateSelectedV2 = (independent=true) => cardAction(()=>{
    if(!project || !v2Host || !selectedV2Card)return;
    const added=duplicateHostCard(project.data,v2Host,selectedV2Card,()=>crypto.randomUUID(),independent);commitCardData(added.data);selectV2Card(added.instanceId);
  });
  const removeSelectedV2 = () => cardAction(()=>{if(project&&v2Host&&selectedV2Card){commitCardData(removeHostCard(project.data,v2Host,selectedV2Card));selectV2Card('');}});
  const copySelectedV2 = () => {const instance=v2Activity?.instances.find(i=>i.id===selectedV2Card);if(project&&instance)cardClipboard.current={project:project.folderPath,card:JSON.parse(JSON.stringify(v2Module!.cards[instance.cardId])),instance:JSON.parse(JSON.stringify(instance))};refreshCardClipboard(n=>n+1);};
  useEffect(()=>{
    if(appMode!=='edit')return;
    const handler=(event:KeyboardEvent)=>{
      if(shouldIgnoreTeacherKey(event) || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]') || cardsV2Open)return;
      if(event.ctrlKey||event.metaKey){
        if(event.key.toLowerCase()==='d'&&selectedV2Card){event.preventDefault();event.stopImmediatePropagation();duplicateSelectedV2();}
        if(event.key.toLowerCase()==='c'&&selectedV2Card){event.preventDefault();event.stopImmediatePropagation();copySelectedV2();}
        if(event.key.toLowerCase()==='v'&&cardClipboard.current?.project===project?.folderPath){event.preventDefault();event.stopImmediatePropagation();quickAddCard(undefined,true,false,true);}
      }else if(event.key==='Escape'&&selectedV2Card){event.preventDefault();selectV2Card('');}
      else if((event.key==='Delete'||event.key==='Backspace')&&selectedV2Card){event.preventDefault();event.stopImmediatePropagation();removeSelectedV2();}
    };
    window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);
  },[appMode,project,v2PlacementId,selectedV2Card,cardsV2Open]);

  const insertBoosterItem = (item:SequenceItem,data=project?.data) => {
    if(!data || boostTab==='badge')return;
    const pack=data.boostPack??{activationSequence:[],languageSequence:[],gamesSequence:[]};
    const prop=`${boostTab}Sequence` as const, sequence=[...pack[prop]];
    sequence.splice(Math.max(0,activeBoostIndex+1),0,item);
    commitCardData({...data,boostPack:{...pack,[prop]:sequence}});setSelectedBoostItemId(item.id);
  };
  const reuseBoosterSlide = (slideId:string,independent:boolean) => cardAction(()=>{
    if(!project || boostTab==='badge')return;
    const item:SequenceItem={id:crypto.randomUUID(),type:'slideRef',slideId};
    if(independent){const pack=project.data.boostPack??{activationSequence:[],languageSequence:[],gamesSequence:[]};const prop=`${boostTab}Sequence` as const;const data={...project.data,boostPack:{...pack,[prop]:[...pack[prop],item]}};const copied=independentBoosterSlide(data,boostTab,item.id,()=>crypto.randomUUID());const sequence=copied.data.boostPack![prop].filter(i=>i.id!==item.id);sequence.splice(Math.max(0,activeBoostIndex+1),0,{...item,slideId:copied.slideId,independentCopyOf:slideId});commitCardData({...copied.data,boostPack:{...copied.data.boostPack!,[prop]:sequence}});setSelectedBoostItemId(item.id);}
    else insertBoosterItem(item);
  });
  const addBoosterMedia = (assetId:string) => cardAction(()=>{
    if(!project)return;
    const asset=project.data.assets.find(a=>a.id===assetId);if(!asset||asset.mediaType==='audio')return;
    const section=project.data.sections.find(s=>s.type!=='break');if(!section){showToast('Create a Story section to store imported slides.','edit',3000);return;}
    const slide=createMediaSlide(asset,section.id,()=>crypto.randomUUID());
    insertBoosterItem({id:crypto.randomUUID(),type:'slideRef',slideId:slide.id},{...project.data,slides:[...project.data.slides,slide]});
  });
  const changeBoosterSequence = (operation:'duplicate'|'remove'|'earlier'|'later') => cardAction(()=>{
    if(!project||!activeItem||boostTab==='badge')return;
    if(operation==='duplicate'){const copy=duplicateBoosterItem(project.data,boostTab,activeItem.id,()=>crypto.randomUUID());commitCardData(copy.data);setSelectedBoostItemId(copy.itemId);}
    else if(operation==='remove'){commitCardData(removeBoosterItem(project.data,boostTab,activeItem.id));setSelectedBoostItemId(activeBoostSequence[activeBoostIndex+1]?.id??activeBoostSequence[activeBoostIndex-1]?.id??null);}
    else commitCardData(moveBoosterItem(project.data,boostTab,activeItem.id,operation==='earlier'?-1:1));
  });
  const updateCardsV2 = (cardsV2: CardsV2Module) => {
    setProject(previous => previous ? { ...previous, data: { ...previous.data, cardsV2 } } : previous);
    setIsDirty(true);
  };
  const addV2ToBooster = (placementId: string) => {
    const id = crypto.randomUUID();
    setProject(previous => {
      if (!previous?.data.cardsV2?.placements[placementId]) return previous;
      const boostPack = previous.data.boostPack ?? { activationSequence: [], languageSequence: [], gamesSequence: [] };
      const sequenceKey = boostTab === 'badge' ? 'activationSequence' : `${boostTab}Sequence` as const;
      return { ...previous, data: { ...previous.data, boostPack: { ...boostPack, [sequenceKey]: [...boostPack[sequenceKey], { id, type: 'cardActivityRef', engine: 'card-v2', placementId }] } } };
    });
    setTopMode('boost'); if(boostTab === 'badge')setBoostTab('activation'); setSelectedBoostItemId(id);
    setIsDirty(true); setCardsV2Open(false);
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
      if (!hasLegacyCards) return;
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
    if (!hasLegacyCards) { setCardsV2Open(true); return; }
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
    if (appMode === "teach") { overlayBinding.move(instanceId, updates); return; }
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

  const handlePlacedACardInstanceClick = (aCardId: string, refId: string, instanceId: string) => {
    setSelectedPlacedBCardId(instanceId);
    if (overlayBCardClickAction === 'none') return;
    const mapping = { flip: 'isFlipped', blur: 'isBlurred', cover: 'isCovered', zoom: 'isZoomed' } as const;
    boardBinding(aCardId, refId).toggle(instanceId, mapping[overlayBCardClickAction]);
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
    if (!hasLegacyCards || activeItem?.type === 'cardActivityRef') { setCardsV2Open(true); return; }
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
        if (appMode === 'teach') audioManager.stopSectionMusic();
        return sectionId;
      });

      const firstInSection = sectionSlideIndices.get(sectionId)?.[0];
      if (firstInSection !== undefined) {
        setCurrentIndex(firstInSection);
      } else if(appMode === "edit") { editor.commit({...editor.ref.current,sectionId,storySlideId:null}); }
    },
    [sectionSlideIndices, appMode],
  );

  const applyHistory = (direction: "undo" | "redo") => {
    const current = projectRef.current;
    if (!current) return;
    const data = historyRef.current[direction]();
    if (!data) return;
    setProject({ ...current, data });
    setIsDirty(historyRef.current.isDirty);
    const slideId = current.data.slides[currentIndex]?.id;
    const restoredIndex = data.slides.findIndex(slide => slide.id === slideId);
    const index = restoredIndex >= 0 ? restoredIndex : Math.max(0, Math.min(currentIndex, data.slides.length - 1));
    setCurrentIndex(index);

    setActiveOverlayId(null);
    setSelectedStoryRefId(null);
    setSelectedBadgeSpriteId(null);
    setSelectedSlideIds(new Set(data.slides[index] ? [data.slides[index].id] : []));
    if (!data.sections.some(section => section.id === selectedSectionId)) {
      const sectionId = data.slides[index]?.sectionId ?? data.sections[0]?.id ?? null;
      setSelectedSectionId(sectionId);
      setExpandedSectionId(sectionId);
    }
    setSelectedACardId(previous => previous && data.aCardLibrary?.[previous] ? previous : null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreTeacherKey(event)) return;
      const direction = getHistoryShortcut({
        ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey,
        shiftKey: event.shiftKey, repeat: event.repeat, key: event.key,
        target: event.target instanceof HTMLElement ? event.target : null,
      });
      if (!direction) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyHistory(direction);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [currentIndex, selectedSectionId]);

  useEffect(() => {
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    const startGesture = () => { clearTimeout(releaseTimer); gestureRef.current = {}; };
    // Include mouseup/React drag-stop callbacks in the same pointer gesture.
    const endGesture = () => { releaseTimer = setTimeout(() => { gestureRef.current = undefined; }, 0); };
    const startText = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)) textEditRef.current = {};
    };
    const endText = () => { textEditRef.current = undefined; };
    const reset = () => { clearTimeout(releaseTimer); gestureRef.current = undefined; endText(); };
    document.addEventListener("pointerdown", startGesture, true);
    document.addEventListener("pointerup", endGesture, true);
    document.addEventListener("pointercancel", endGesture, true);
    document.addEventListener("focusin", startText);
    document.addEventListener("focusout", endText);
    window.addEventListener("blur", reset);
    return () => {
      reset();
      document.removeEventListener("pointerdown", startGesture, true);
      document.removeEventListener("pointerup", endGesture, true);
      document.removeEventListener("pointercancel", endGesture, true);
      document.removeEventListener("focusin", startText);
      document.removeEventListener("focusout", endText);
      window.removeEventListener("blur", reset);
    };
  }, []);

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
      if (shouldIgnoreTeacherKey(e) || e.altKey) return;
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "m" || e.key === "M")
      ) {
        claimTeacherKey(e);
        toggleMode();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [toggleMode]);

  useEffect(() => {
    const handleDrawShortcut = (event: KeyboardEvent) => {
      if (shouldIgnoreTeacherKey(event)) return;
      if (!isDrawModeShortcut({
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        repeat: event.repeat,
        key: event.key,
        target: event.target instanceof HTMLElement ? event.target : null,
      })) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setDrawSettings((previous) => ({
        ...previous,
        drawMode: !previous.drawMode,
      }));
    };

    window.addEventListener("keydown", handleDrawShortcut);
    return () => window.removeEventListener("keydown", handleDrawShortcut);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlainTeacherKey(e)) return;

      if (appMode === "edit" && (e.key === "Delete" || e.key === "Backspace")) {
        if (activeOverlayId && project) {
          const cSlide = resolvePresentationTarget(project.data, selection.ref.current).slide;
          if (cSlide) {
            claimTeacherKey(e);
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

        claimTeacherKey(e);

        const delta = e.code === "NumpadAdd" ? 0.05 : -0.05;
        const first = bgms[0];
        const current = first.volume ?? 1;
        const next = Math.max(0, Math.min(1, Number((current + delta).toFixed(2))));
        if (next === current) return;

        updateSection(selectedSection.id, {
          bgm: bgms.map((b, i) => (i === 0 ? { ...b, volume: next } : b)),
        });

        if (appMode === "teach") audioManager.setVolume(resolveAuthoredMediaUrl(first.url, mediaRegistry.resolvePath), next);
        return;
      }

      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        claimTeacherKey(e);
        goToVisibleOffset(1);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        claimTeacherKey(e);
        goToVisibleOffset(-1);
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        claimTeacherKey(e);
        if (selectedSectionId) setExpandedSectionId(selectedSectionId);
      } else if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        claimTeacherKey(e);
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
            claimTeacherKey(e);
            selectSection(section.id);
          }
        } else if (e.key.startsWith("F")) {
          const fNum = parseInt(e.key.substring(1));
          if (!isNaN(fNum) && fNum >= 1 && fNum <= 9) {
            claimTeacherKey(e);
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
      presentation.commit(reducePresentationSession(presentation.ref.current, { type: 'project', projectId: null, slideId: null, sectionId: null }));
      setProject(null);
      editor.reset();
      setSelectedSectionId(null);
      setCurrentIndex(0);

      setError(null);
      setExpandedSectionId(null);
      setSelectedSlideIds(new Set());
      setSelectedStoryRefId(null);
      setOverlayBCardClickAction("none");
      setBadgeVisibleState(false);
      setFinalScoreRevealedState(false);
      setDrawPanelCollapsed(true);
      setCardRuntimeGeneration(n => n + 1);
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
    // Preparation can throw. Commit the main-process folder only after it passes.
    if (!next.activationToken) throw new Error("Project candidate is missing. Please open it again.");
    window.appApi.activateProject(next.activationToken);
    historyRef.current.reset(normalizedWithRefs.data, !matchesRestore);
    setProject(normalizedWithRefs);
    editor.reset();
    presentation.commit(reducePresentationSession(presentation.ref.current, {
      type: 'project', projectId: crypto.randomUUID(), slideId: normalizedWithRefs.data.slides[0]?.id ?? null,
      sectionId: normalizedWithRefs.data.sections[0]?.id ?? null,
    }));
    const fallbackSectionId = normalizedWithRefs.data.sections[0]?.id ?? null;
    const restoredSectionId =
      matchesRestore && restoreSnapshot?.selectedSectionId &&
      normalizedWithRefs.data.sections.some((s) => s.id === restoreSnapshot.selectedSectionId)
        ? restoreSnapshot.selectedSectionId
        : fallbackSectionId;
    presentation.setSelectedSectionId(restoredSectionId);
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
    presentation.setCurrentIndex(restoredIndex);

    setError(null);
    setError(null);
    setSelectedStoryRefId(
      matchesRestore ? (restoreSnapshot?.selectedStoryRefId || null) : null,
    );
    setOverlayBCardClickAction(
      matchesRestore ? (restoreSnapshot?.overlayBCardClickAction || "flip") : "flip",
    );
    setBadgeVisibleState(matchesRestore ? Boolean(restoreSnapshot?.badgeVisible) : false);
    setFinalScoreRevealedState(matchesRestore ? Boolean(restoreSnapshot?.finalScoreRevealed) : false);
    setDrawPanelCollapsed(true);
      setCardRuntimeGeneration(n => n + 1);
    setDrawSettings({ ...DEFAULT_DRAW_SETTINGS });
    presentation.setTopMode(matchesRestore ? (restoreSnapshot?.topMode || "story") : "story");
    presentation.setBoostTab(matchesRestore ? (restoreSnapshot?.boostTab || "activation") : "activation");
    presentation.setSelectedBoostItemId(matchesRestore ? (restoreSnapshot?.selectedBoostItemId || null) : null);
    presentation.setSelectedACardId(matchesRestore ? (restoreSnapshot?.selectedACardId || null) : null);
    setAppMode(matchesRestore ? (restoreSnapshot?.appMode || "teach") : "teach");
    setIsDirty(matchesRestore);
  };

  const executePendingAction = async (action: "create" | "open" | "close" | "home") => {
    if (operationRef.current) return;
    if (action === "home") {
      window.location.search = "";
      return;
    }
    if (action === "close") {
      window.appApi.forceClose();
      return;
    }

    operationRef.current = true;
    const previous = projectRef.current;
    try {
      let next;
      if (action === "create") {
        next = await window.appApi.createProject();
      } else {
        next = await window.appApi.openProject();
      }
      if (next) {
        if (projectRef.current?.data !== previous?.data) {
          throw new Error("The current project changed while opening. Save your changes and try again.");
        }
        setProjectState(next, pendingRestoreSession);
        setPendingRestoreSession(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      operationRef.current = false;
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
    if (operationRef.current) return;
    if (dirtyRef.current) {
      setPendingAction("create");
      setShowConfirmModal(true);
    } else {
      executePendingAction("create");
    }
  };

  const onReturnToStudio = () => {
    if (operationRef.current) return;
    if (dirtyRef.current) {
      setPendingAction("home");
      setShowConfirmModal(true);
    } else {
      void executePendingAction("home");
    }
  };

  const onOpenProject = () => {
    if (operationRef.current) return;
    if (dirtyRef.current) {
      setPendingAction("open");
      setShowConfirmModal(true);
    } else {
      executePendingAction("open");
    }
  };

  useEffect(() => {
    if (!breakThumbDrag) return;
    const onMove = (event: globalThis.MouseEvent) => {
      const dx = (event.clientX - breakThumbDrag.startClientX) / breakThumbDrag.screenScale;
      const dy = (event.clientY - breakThumbDrag.startClientY) / breakThumbDrag.screenScale;
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
    if (!savedLiveSession || operationRef.current) return;
    operationRef.current = true;
    const previous = projectRef.current;
    setPendingRestoreSession(savedLiveSession);
    setShowRestoreSessionPrompt(false);
    try {
      const next = await window.appApi.openProjectByPath(savedLiveSession.projectFolderPath);
      if (!next) return;
      if (projectRef.current?.data !== previous?.data) {
        throw new Error("The current project changed while opening. Save your changes and try again.");
      }
      setProjectState(next, savedLiveSession);
      setPendingRestoreSession(null);
      showToast("Session restored", "success", 1500);
    } catch (err) {
      setError((err as Error).message);
      showToast("Open the project manually to restore session", "edit", 2000);
    } finally {
      operationRef.current = false;
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
      topMode: liveSession.mode,
      boostTab: liveSession.boostTab,
      currentIndex: Math.max(0,project.data.slides.findIndex(s=>s.id===liveSession.storySlideId)),
      selectedSectionId: liveSession.sectionId,
      selectedBoostItemId: liveSession.boostItemId,
      selectedStoryRefId,
      selectedACardId: liveSession.boardId,
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
    const current = projectRef.current;
    if (result.failures?.length) alert(result.failures.map(f => `${f.name}: ${f.reason}`).join("\n"));
    if (!current || (!result.importedAssets.length && !result.replacedAssets?.length && !result.importedBins?.length)) return;

    const nextData = applyMediaImportToProjectData(current.data, result, targetSectionId);
    setProject({
      ...current,
      data: nextData,
    });
    setIsDirty(true);

    if (nextData.slides.length > 0 && current.data.slides.length === 0) {
      setCurrentIndex(0);
    }
  };

  const placePoolAssets = (ids:string[],slot:TimelineSlot) => {
    const current=projectRef.current;if(!current||appMode!=='edit')return;
    try {setProject({...current,data:insertPoolAssets(current.data,ids,slot.sectionId,slot.beforeId,()=>crypto.randomUUID())});}
    catch(error){showToast((error as Error).message,'edit',3500);}
  };
  const importToPool = async (kind:'files'|'folder'|'drop',paths?:string[],binId?:string,slot?:TimelineSlot) => {
    const current=projectRef.current;if(!current||appMode!=='edit'||operationRef.current)return;
    operationRef.current=true;setPoolBusy(true);dragImportDepthRef.current=0;setIsDragImportActive(false);
    try {
      const result=kind==='folder'?await window.appApi.importMediaFolder(current ? { folderPath: current.folderPath, assets: current.data.assets } : undefined):kind==='drop'?await window.appApi.importDroppedMedia(paths??[], {folderPath:current.folderPath,assets:current.data.assets}):await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
      if(!result)return;
      const latest=projectRef.current;if(!latest||latest.folderPath!==current.folderPath)throw Error('Project changed during import.');
      let data=registerPoolImport(latest.data,result,binId);
      const messages=(result.failures??[]).map(f=>`${f.name}: ${f.reason}`);
      if(slot){const ids=result.importedAssets.filter(a=>a.mediaType!=='audio').map(a=>a.id);
        try {if(ids.length)data=insertPoolAssets(data,ids,slot.sectionId,slot.beforeId,()=>crypto.randomUUID());}
        catch(error){messages.push(`Assets kept in Media Pool; placement failed: ${(error as Error).message}`);}
        if(result.importedAssets.some(a=>a.mediaType==='audio'))messages.push('Audio was added to Media Pool. Select it there to attach it to a lesson object.');
      }
      if(result.importedAssets.length||result.replacedAssets?.length||result.importedBins?.length)setProject({...latest,data});
      showToast(`Imported ${result.importedAssets.length} assets`,'success',2200);
      if(messages.length)alert(messages.join('\n'));
    }catch(error){alert(`Import failed: ${(error as Error).message}`);}
    finally {operationRef.current=false;setPoolBusy(false);}
  };

  const onImportMedia = async () => {
    if (!ensureEditMode(appMode, "import media")) return;
    if (!project || operationRef.current) return;
    operationRef.current = true;
    try {
      const result = await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
      if (!result) return;
      applyImportedMedia(result, selectedSectionId ?? project.data.sections[0]?.id);
    } catch (err) {
      console.error(err);
      alert("Failed to import media: " + (err as Error).message);
      setError((err as Error).message);
    } finally {
      operationRef.current = false;
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
    if (!project || appMode !== "edit" || operationRef.current) return;

    const filePaths = getDroppedFilePaths(event);
    if (filePaths.length === 0) {
      showToast("No readable media files found in that drop", "edit", 2200);
      return;
    }

    operationRef.current = true;
    try {
      const result = await window.appApi.importDroppedMedia(filePaths, projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
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
    } finally {
      operationRef.current = false;
    }
  };

  const onImportAudio = async (type: "dialogue" | "sfx" | "bgm" | "section-bgm") => {
    if (!ensureEditMode(appMode, "import audio")) return;
    if (!project || operationRef.current) return;
    operationRef.current = true;
    const expectedFolder = project.folderPath;
    try {
      const result = await window.appApi.importAudioResult();
      if (result?.failures?.length) setError(result.failures.map(item => `${item.name}: ${item.reason}`).join("; "));
      const importedAssets = result?.importedAssets;
      const latest = projectRef.current;
      if (!latest || latest.folderPath !== expectedFolder) throw new Error("Project changed during import. Copied files have been preserved.");
      if (!importedAssets || importedAssets.length === 0) return;
      validateMediaImport(latest.data, result!);
      const normalizedImportedAssets = decorateImportedAssetsForContext(latest.data, importedAssets);
      const nextAssets = [...latest.data.assets, ...normalizedImportedAssets];
      let nextData = { ...latest.data, assets: nextAssets };

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

      setProject({ ...latest, data: nextData });
      setIsDirty(true);
    } catch (err) {
      console.error(err);
      alert("Failed to import audio (Did you restart the Dev Server?): " + (err as Error).message);
      setError((err as Error).message);
    } finally { operationRef.current = false; }
  };

  const onImportBubbleTemplate = async () => {
    if (!ensureEditMode(appMode, "import bubble template")) return;
    if (!project || operationRef.current) return;
    operationRef.current = true;
    const expectedFolder = project.folderPath;
    try {
      const result = await (window as any).api.importBubbleTemplate() as { success: boolean; relativePath: string; asset?: AssetItem };
      if (!result || !result.success || !result.relativePath) return;

      const filename = result.asset?.originalName ?? result.relativePath.split('/').pop() ?? '';
      const templateName = filename.replace(/\.png$/i, '');

      const newTemplate: BubbleTemplate = {
        templateName,
        imageSrc: result.relativePath,
        defaultTextRect: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      };

      const latest = projectRef.current;
      if (!latest || latest.folderPath !== expectedFolder) throw new Error('Project changed during import. Copied files have been preserved.');
      if (result.asset) validateMediaImport(latest.data, { importedAssets: [result.asset], createdSlides: [] });
      const nextData = {
        ...latest.data,
        bubbleDefinitions: [...(latest.data.bubbleDefinitions || []), newTemplate],
        assets: result.asset ? [...latest.data.assets, result.asset] : latest.data.assets,
      };

      setProject({ ...latest, data: nextData });
      setIsDirty(true);

      // Persist as requested
      operationRef.current = false;
      if (await performSave("save")) {
        showToast("Bubble template imported and project saved", "success");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to import bubble template: " + (err as Error).message);
    } finally {
      operationRef.current = false;
    }
  };

  const performSave = async (mode: "save" | "saveAs") => {
    // Teach already permits persistent markers, references and reward progress.
    // Saving those changes must work in both modes; edit permissions stay separate.
    const snapshot = projectRef.current;
    if (!snapshot || operationRef.current) return false;
    operationRef.current = true;
    historyRef.current.breakGroup();
    try {
      setIsSaveInProgress(true);
      const response = await window.appApi.saveProject(snapshot.data, mode, snapshot.folderPath);
      if (!response) return false;
      const current = projectRef.current;
      if (!current || current.folderPath !== snapshot.folderPath) return false;
      const savedCurrentRevision = current.data === snapshot.data;
      historyRef.current.markSaved(snapshot.data);
      setProject({
        ...current,
        folderPath: response.folderPath,
        // updatedAt is written on disk; lastSavedAt carries save metadata here.
        // Do not create a content revision (or undo step) for a timestamp.
        data: current.data,
        lastSavedAt: response.lastSavedAt,
      });
      setIsDirty(historyRef.current.isDirty);
      showToast(savedCurrentRevision
        ? (mode === "saveAs" ? "Saved as new project" : "Saved")
        : "Earlier changes saved; newer changes still need saving", savedCurrentRevision ? "success" : "edit", 2200);
      // Close/Open/Refresh may proceed only when the current revision was saved.
      return savedCurrentRevision;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      operationRef.current = false;
      setIsSaveInProgress(false);
    }
  };

  const onSave = () => {
    if (!project || operationRef.current) return;
    setShowSaveChoiceModal(true);
  };

  const onRefreshApp = async () => {
    if (!ensureEditMode(appMode, "refresh app")) return;
    if (!project || operationRef.current) return;
    setContextMenu(null);
    setPendingSectionDeleteId(null);
    persistLiveSessionSnapshot();
    window.localStorage.setItem(LIVE_SESSION_AUTO_RESTORE_KEY, "1");
    if (dirtyRef.current) {
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

  const attachPoolAudio = (id:string,kind:'dialogue'|'sfx'|'bgm'|'section-bgm') => {
    const asset=assetsById.get(id);if(appMode!=='edit'||asset?.mediaType!=='audio')return;
    const clip:AudioClip={url:toMediaUrl(asset.relativePath),volume:1,name:getAssetDescription(asset)};
    if(kind==='section-bgm'&&selectedSection)updateSection(selectedSection.id,{bgm:[...(selectedSection.bgm??[]),clip]});
    else if(kind!=='section-bgm'&&currentSlide)updateSlide(currentSlide.id,kind==='bgm'?{bgm:clip}:{[kind]:[...(currentSlide[kind]??[]),clip]});
    else showToast('Select a slide, section or break for this audio.','edit',2500);
  };

  const commitSlideName = (slideId: string, rawName: string) => {
    const slide = project?.data.slides.find((s) => s.id === slideId);
    const asset = slide ? assetsById.get(slide.assetId) : undefined;
    const trimmed = stripReferencePrefix(rawName, asset?.referenceCode).trim();
    updateSlide(slideId, { name: trimmed || undefined });
    setRenamingSlideId(null);
  };

  const insertSectionAt = (sections:Section[],section:Section,beforeId?:string) => {
    const index=beforeId?sections.findIndex(s=>s.id===beforeId):-1;
    return index<0?[...sections,section]:[...sections.slice(0,index),section,...sections.slice(index)];
  };
  const onAddSection = (name?:string,beforeId?:string) => {
    if (!ensureEditMode(appMode, "add section")) return;
    const count = (project?.data.sections || []).filter(
      (s) => s.type !== "break",
    ).length;
    const nextSection: Section = {
      id: crypto.randomUUID(),
      name: name || `Section ${count + 1}`,
      type: "section",
    };
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          sections: insertSectionAt(prev.data.sections,nextSection,beforeId),
        },
      };
    });
    setSelectedSectionId(nextSection.id);
    editor.commit({...editor.ref.current,mode:"story",sectionId:nextSection.id,storySlideId:null});
    setExpandedSectionId(nextSection.id);
    setIsDirty(true);
  };

  const onAddBreak = (beforeId?:string) => {
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
          sections: insertSectionAt(prev.data.sections,nextBreak,beforeId),
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

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: nextSlides,
        sections: nextSections,
        boostPack: newBoostPack,
      }
    });
    // Stable IDs survive removal of earlier slides. Resolve fallback against the
    // new document only when the selected content itself was deleted.
    if (selection.ref.current.storySlideId === slideId) {
      setCurrentIndex(Math.max(0, indexToDelete - 1));
    }
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
    const current = projectRef.current;
    if (!current) return;
    const data = applyPresentationDrawing(current.data, selection.ref.current, activeTargetToken, strokes);
    if (data !== current.data) setProject({ ...current, data });
  };

  const clearCurrentSlideDrawings = () => {
    updateCurrentSlideMarkerStrokes([]);
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

    if (clipToRemove && appMode === "teach") {
      audioManager.stopClip(resolveAuthoredMediaUrl(clipToRemove.url, mediaRegistry.resolvePath), { fadeEnabled: clipToRemove.fadeEnabled || false });
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

    if (appMode === "teach") {
      audioManager.stopClip(resolveAuthoredMediaUrl(clip.url, mediaRegistry.resolvePath), { fadeEnabled: clip.fadeEnabled || false });
      audioManager.stopSectionMusic(undefined, clip.fadeEnabled || false);
    }

    updateSection(selectedSection.id, {
      bgm: sectionTracks.filter((_, i) => i !== index),
    });
  };

  const drawingPanel = !drawPanelCollapsed && (
                        <div
                          className="draw-panel"
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
                      );

  const activeSparkStudentName =
    project?.data.sparkStudents?.find((student) => student.id === project?.data.activeStudentId)?.name ||
    project?.data.sparkStudents?.[0]?.name ||
    "No Student";

  return (
    <MediaPathResolverContext.Provider value={mediaRegistry.resolvePath}><EditorPreviewAudioContext.Provider value={appMode === "edit"}><SparkProvider
      onTriggerSpark={rewards.triggerSpark}
      onResetSparks={rewards.resetSparks}
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
      onBadgeVisibilityChange={rewards.badgeVisibility}
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
        {cardsV2Open && appMode === 'edit' && project && <div role="dialog" aria-modal="true" aria-label="Cards and Sets library" style={{ position: 'fixed', inset: 12, zIndex: 100000, background: '#161e28', border: '1px solid #62778b', borderRadius: 12, overflow: 'auto', boxShadow: '0 12px 50px #0009' }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setCardsV2Open(false); }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', gap: 12 }}><span>Cards · project library</span><button onClick={onImportMedia}>Import image into project</button></div>
          <CardV2Editor initialPlacementId={v2PlacementId} module={v2Module} onChange={updateCardsV2} assets={[...(mediaRegistry.registry?.list() ?? [])]} resolveImageUrl={id => { const asset = assetsById.get(id); return asset ? toVisualMediaUrl(asset.relativePath) : undefined; }} onAddToBooster={addV2ToBooster} onClose={() => setCardsV2Open(false)} />
        </div>}
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
            className={`topbar ${appMode === 'teach' ? 'edit-topbar-hidden' : ''}`}
            style={{
              background: appMode === "edit" ? "#331515" : undefined,
              borderBottomColor: appMode === "edit" ? "#552222" : undefined,
            }}
          >
            <button onClick={() => setModernEdit(value => { const next = !value; try { localStorage.setItem('story-studio.edit-layout', next ? 'modern' : 'legacy'); } catch {} return next; })}>{modernEdit ? 'Legacy layout' : 'Modern workspace'}</button>
            <button className="studio-return" onClick={onReturnToStudio}>Story Studio home</button>
            <button onClick={onCreateProject}>Create Project</button>
            <button onClick={onOpenProject}>Open Project</button>
            <button onClick={onImportMedia} disabled={!project}>
              Import Media
            </button>
            {appMode === "edit" && !modernEdit && <button onClick={showInPresent}>Show in Present</button>}
            <button onClick={onSave} disabled={!project || isSaveInProgress}>
              Save
            </button>
            {topMode === 'boost' && boostTab !== 'badge' && <>
              <button onClick={() => goToVisibleOffset(-1)} disabled={activeBoostIndex <= 0}>Prev</button>
              <button onClick={() => goToVisibleOffset(1)} disabled={activeBoostIndex < 0 || activeBoostIndex >= activeBoostSequence.length - 1}>Next</button>
            </>}
            {selectedSection?.type === 'break' && <div className="break-drawing-tools" style={{ position: 'relative', zIndex: 30001 }}><button onClick={() => setDrawPanelCollapsed(v => !v)}>Draw</button>{drawingPanel}</div>}
            {presentationTarget.capabilities.canZoom && <button onClick={() => { teachingScene.updateViewport({ zoom: 1, pan: { x: 0, y: 0 } }); setViewportResetSignal(n => n + 1); }}>Reset view</button>}
            <button aria-label="Undo" title="Undo (Ctrl+Z)" onClick={() => applyHistory("undo")} disabled={!historyRef.current.canUndo}>↶</button>
            <button aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={() => applyHistory("redo")} disabled={!historyRef.current.canRedo}>↷</button>
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
            {ENABLE_BOOST_MODE && !editWorkspace && (
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
                  style={{ background: topMode === 'movement' ? '#444' : 'transparent', color: topMode === 'movement' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  onClick={() => setTopMode('movement')}
                >Movement</button>
                <button
                  style={{ background: topMode === 'boards' ? '#444' : 'transparent', color: topMode === 'boards' ? '#fff' : '#aaa', border: 'none', padding: '4px 8px', borderRadius: 2 }}
                  hidden={!hasLegacyCards && appMode !== 'edit'}
                  onClick={() => hasLegacyCards ? setTopMode('boards') : setCardsV2Open(true)}
                >{hasLegacyCards ? 'Legacy boards' : 'Cards'}</button>
              </div>
            )}

            {appMode === 'edit' && <button disabled={!project} onClick={() => setCardsV2Open(true)}>Cards / Sets</button>}
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
          {appMode === 'teach' && <header className="teach-header">
            <button className="studio-return" onClick={onReturnToStudio}>Story Studio home</button>
            <strong>Teach workspace</strong><TeachQuickControls /><button title="Previous live target" disabled={!presentationTarget.capabilities.canNavigate} onClick={goToPrevSlide}>Previous</button><button title="Next live target" disabled={!presentationTarget.capabilities.canNavigate} onClick={goToNextSlide}>Next</button><span>{project?.folderPath.split(/[\\/]/).pop() || 'No lesson open'}</span>
            <PresentStatus />
            <button disabled={!project} onClick={() => void openPresent().catch(error => setError(String(error)))}>Open / Reopen Present</button>
            <button onClick={onOpenProject}>Open lesson</button>
            <button onClick={toggleMode}>Switch to Edit</button>
          </header>}
          <AudioSettingsWorkspace
            open={audioSettingsOpen}
            onClose={closeAudioSettings}
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
          {mediaRegistry.diagnostics.length > 0 && <div role="status" aria-label="Media availability" style={{ padding: '8px 12px', background: '#482d21', color: '#ffe2be', borderBottom: '1px solid #a97143' }}>
            Media unavailable: {mediaRegistry.diagnostics.slice(0, 8).map(item => `${item.assetId ? mediaRegistry.registry?.get(item.assetId)?.originalName || item.assetId : item.path || 'Project'} (${item.code})`).join('; ')}.
            {mediaRegistry.diagnostics.length > 8 && ` ${mediaRegistry.diagnostics.length - 8} more issues.`} Check the project files and reopen the project to retry.
          </div>}
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
                                src={toVisualMediaUrl(asset.relativePath)}
                                muted
                                preload="metadata"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                            ) : asset.mediaType === "image" ? (
                              <img
                                src={toVisualMediaUrl(asset.relativePath)}
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
                                <video src={toVisualMediaUrl(asset.relativePath)} muted preload="metadata" />
                              ) : asset.mediaType === "image" ? (
                                <img src={toVisualMediaUrl(asset.relativePath)} alt="" />
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
                          src={toVisualMediaUrl(asset.relativePath)}
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

          <EditWorkspaceProvider enabled={editWorkspace} hosts={editHosts.hosts}>
          <div ref={teachLayout.workspaceRef} className={`content ${topMode === 'badge' ? 'is-badge-mode' : ''} ${appMode === 'teach' ? 'teach-workspace' : ''} ${teachSecondaryOpen ? 'teach-secondary-open' : ''} ${editWorkspace ? 'edit-workspace' : ''} ${editWorkspace && editFocus ? 'edit-focus' : ''}`} style={appMode === 'teach' || editWorkspace ? teachLayout.style : undefined}>
            {topMode === 'badge' && (
              <BadgeTabBackground project={project} toMediaUrl={toVisualMediaUrl} />
            )}
            <EditDock area="tools"><aside className={`sidebar ${['badge', 'relics', 'movement'].includes(topMode) ? 'teach-secondary-eligible' : ''}`}>
              {topMode === 'badge' ? (
                <BadgePanel visualScope={visualScope}
                  isEditMode={appMode === "edit"}
                  project={project}
                  selectedSpriteId={selectedBadgeSpriteId}
                  onSelectSprite={setSelectedBadgeSpriteId}
                  show="content"
                  onUpdateProject={(upd) => {
                    if (upd.data) {
                      setProject(prev => prev ? { ...prev, data: upd.data! } : prev);
                      setIsDirty(true);
                    }
                  }}
                />
              ) : topMode === 'relics' && appMode === 'teach' ? (
                <section className="teach-control-card">
                  <h3>Relic progress</h3>
                  {studentRoster.filter(student => !student.archived).map(student => <label key={student.id} style={{display:'flex',gap:8,marginBottom:10}}><input type="checkbox" checked={relicSystem.studentProgress[student.id]?.active ?? false} onChange={event => updateRelicStudentProgress(student.id,{active:event.target.checked})} />{student.name} · {relicSystem.studentProgress[student.id]?.progress ?? 0} / 30</label>)}
                  <div className="teach-actions">{(['increase','decrease','reset','complete'] as const).map((action,index)=><button key={action} onClick={()=>runRelicProgressAction(action)}>{['+1 progress','−1 progress','Reset progress','Complete relic'][index]}</button>)}</div>
                  <div className="teach-actions"><button onClick={()=>patchRelicSystem({showOnStage:!relicSystem.showOnStage})}>{relicSystem.showOnStage?'Hide relic':'Show relic'}</button><button onClick={()=>rewards.showRelicReward(true)}>Show reward card</button></div>
                </section>
              ) : topMode === 'relics' ? (
                <RelicsPanel
                  relicSystem={relicSystem}
                  roster={studentRoster}
                  assets={project?.data.assets || []}
                  toMediaUrl={toVisualMediaUrl}
                  onRelicChange={patchRelicSystem}
                  onStudentProgressChange={updateRelicStudentProgress}
                  onAddStudent={addRosterStudent}
                  onRenameStudent={renameRosterStudent}
                  onArchiveStudent={archiveRosterStudent}
                  onImportImage={importRelicImage}
                  onProgressAction={runRelicProgressAction}
                  onShowRewardCard={() => rewards.showRelicReward(true)}
                />
              ) : topMode === 'movement' ? (
                <MovementPanel
                  config={movementConfig}
                  isEditMode={appMode === "edit"}
                  onChange={updateMovementConfig}
                  onTrigger={triggerMovementEvent}
                  onRandomTrigger={triggerRandomMovementEvent}
                  onImportGif={importMovementGif}
                  onImportJingle={importMovementJingle}
                  getMediaUrl={path => movementMediaUrl(path, movementScope, mediaRegistry.resolvePath)}
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
                                                    src={toVisualMediaUrl(asset.relativePath)}
                                                    muted
                                                    preload="metadata"
                                                    className="slide-thumb-media"
                                                  />
                                                ) : asset.mediaType === "image" ? (
                                                  <img
                                                    src={toVisualMediaUrl(asset.relativePath)}
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
                      onClick={() => onAddSection()}
                      disabled={!project}
                    >
                      + Section
                    </button>
                    <button
                      className="section-break-btn"
                      style={{ flex: 1, marginTop: 0 }}
                      onClick={() => onAddBreak()}
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
                  appMode={hasLegacyCards ? appMode : "teach"}
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
                    <BadgePanel visualScope={visualScope}
                      isEditMode={appMode === "edit"}
                      project={project}
                      selectedSpriteId={selectedBadgeSpriteId}
                      onSelectSprite={setSelectedBadgeSpriteId}
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
            </aside></EditDock>

            <TeachPreview enabled={appMode === 'teach' || editWorkspace} viewport={teachLayout.viewport}>
            <main className="stage-wrap" style={{ position: "relative" }} onPointerDown={event=>{if(appMode==='edit'&&selectedV2Card&&!(event.target as Element).closest('.card-v2-interactive'))selectV2Card('');}}>
              {!presentMode && <RewardSurface presentation={appMode === 'edit' ? { ...rewardPresentation, base: undefined } : rewardPresentation} onFinalBadgeScroll={rewards.scrollFinalBadge} onRelicOffsetChange={rewards.moveRelic} onHideRelicReward={() => rewards.showRelicReward(false)} />}
              {!presentMode && <MovementOverlay presentation={scopedMovement} />}
              {presentMode && (presentationTarget.contentId === 'badge' || activeItem?.type === 'promptCard' || activeItem?.type === 'miniGame' || (activeItem?.type === 'breakRef' && !selectedSection)) && <><RewardSurface presentation={appMode === 'edit' ? { ...rewardPresentation, base: undefined } : rewardPresentation} onFinalBadgeScroll={rewards.scrollFinalBadge} onRelicOffsetChange={rewards.moveRelic} onHideRelicReward={() => rewards.showRelicReward(false)} /><MovementSurface presentation={scopedMovement} /></>}
              {v2Plan && activeItem?.type!=='cardActivityRef' && <div className="card-host-layer" style={{position:'absolute',inset:0,zIndex:40,pointerEvents:'none'}}><CardV2Scene plan={v2Plan} className="card-host-overlay" selectedInstanceId={appMode==='edit'?selectedV2Card:Object.values(v2Runtime.state?.instances??{}).find(i=>i.selected)?.instanceId} showWarnings={appMode==='edit'} onSelect={appMode==='edit'?selectV2Card:id=>{if(!v2Runtime.state)v2Runtime.dispatch({type:'StartActivity',placementId:v2PlacementId!});else v2Runtime.dispatch({type:'SelectCard',instanceId:id});}} onGeometryChange={appMode==='edit'?(id,geometry)=>cardAction(()=>{if(project&&v2Host)commitCardData(updateHostGeometry(project.data,v2Host,id,geometry));}):undefined}/></div>}
              {topMode === 'boards' ? (
                <div style={{ position: 'absolute', inset: 0 }}>
                <LogicalSceneFrame frame={editWorkspace ? presentFrame ?? {width:1280,height:720} : appMode === 'teach' ? presentFrame : null}>
                  {selectedACardId ? (
                    <ACardSystem
                      aCardId={selectedACardId}
                      runtime={boardBinding(selectedACardId)}
                      teachPanelHost={teachToolsHostRef.current}
                      mode={appMode}
                      assets={project?.data.assets || []}
                      resolveImageUrl={(id) => {
                        const asset = assetsById.get(id);
                        return asset ? toVisualMediaUrl(asset.relativePath) : null;
                      }}
                    />
                  ) : appMode === "edit" && selectedLibraryBCardId ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                      <BCardEditor
                        bCardId={selectedLibraryBCardId}
                        assets={project?.data.assets || []}
                        resolveImageUrl={(id) => {
                          const asset = assetsById.get(id);
                          return asset ? toVisualMediaUrl(asset.relativePath) : null;
                        }}
                      />
                    </div>
                  ) : (
                    appMode === "edit" ? <BoardEmptyState onCreated={setSelectedACardId} /> : <div className="placeholder">Choose a board in the teacher controls.</div>
                  )}
                </LogicalSceneFrame>
                  {presentMode && <><RewardSurface presentation={appMode === 'edit' ? { ...rewardPresentation, base: undefined } : rewardPresentation} onFinalBadgeScroll={rewards.scrollFinalBadge} onRelicOffsetChange={rewards.moveRelic} onHideRelicReward={() => rewards.showRelicReward(false)} /><MovementSurface presentation={scopedMovement} /></>}
                </div>
              ) : topMode === 'boost' && boostTab !== 'language' && activeItem?.type === 'aCardRef' && (activeItem as any).aCardId ? (
                <div style={{ position: 'absolute', inset: 0 }}>
                <LogicalSceneFrame frame={editWorkspace ? presentFrame ?? {width:1280,height:720} : appMode === 'teach' ? presentFrame : null}>
                  <ACardSystem
                    aCardId={(activeItem as any).aCardId}
                    runtime={boardBinding((activeItem as any).aCardId)}
                    mode={appMode}
                    assets={project?.data.assets || []}
                    teachPanelHost={teachToolsHostRef.current}
                    resolveImageUrl={(id) => {
                      const asset = assetsById.get(id);
                      return asset ? toVisualMediaUrl(asset.relativePath) : null;
                    }}
                  />
                  <BCardInstanceLayer instances={appMode === "teach" ? overlayBinding.state.instances : activeOverlayBCardInstances} mode={appMode} selectedInstanceId={selectedOverlayBCardInstanceId} onSelectInstance={setSelectedPlacedBCardId} onInstanceChange={updatePlacedBCardInstance} teachStates={overlayBCardTeachStates} clickAction={overlayBCardClickAction} onTeachStateChange={setOverlayBCardState} resolveImageUrl={id => { const asset = assetsById.get(id); return asset ? toVisualMediaUrl(asset.relativePath) : null; }} />
                </LogicalSceneFrame>
                  {presentMode && <><RewardSurface presentation={appMode === 'edit' ? { ...rewardPresentation, base: undefined } : rewardPresentation} onFinalBadgeScroll={rewards.scrollFinalBadge} onRelicOffsetChange={rewards.moveRelic} onHideRelicReward={() => rewards.showRelicReward(false)} /><MovementSurface presentation={scopedMovement} /></>}
                </div>
              ) : presentationTarget.contentId === 'badge' ? (
                <div className="badge-stage" style={appMode === 'teach' ? { visibility: 'hidden' } : undefined}>
                  <div className="badge-bg-layer">
                    {project?.data.badgeImageAssetId ? (
                      <img
                        src={toVisualMediaUrl(assetsById.get(project.data.badgeImageAssetId)?.relativePath || '')}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : null}
                  </div>
                  <div className={`badge-shield-layer ${appMode === "edit" ? "is-edit" : ""}`}>
                    <BadgeStudentSprites
                      assetsById={assetsById}
                      getMediaUrl={toVisualMediaUrl}
                      isEditMode={appMode === "edit"}
                      selectedSpriteId={selectedBadgeSpriteId}
                      onSelectSprite={setSelectedBadgeSpriteId}
                    />
                  </div>
                </div>
              ) : selectedSectionType === "break" && selectedSection ? (
                <>
                  {appMode === "edit" && !showBreakEditor && (
                    <button
                      style={{ position: "absolute", top: 10, right: 10, zIndex: 21000, padding: "8px 12px", background: "#333", border: "1px solid #555", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: "0.85rem" }}
                      onClick={() => setShowBreakEditor(true)}
                    >
                      Edit Break
                    </button>
                  )}
                  {appMode === "edit" && showBreakEditor && (
                    <EditDock area="content">                    <div key={selectedSection.id} className="break-editor-panel" style={{ position: "absolute", top: 10, right: 10, width: "330px", maxHeight: "calc(100% - 20px)", height: "auto", zIndex: 21000 }}>
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
                                          const result = await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
                                          if (result && (result.importedAssets.length > 0 || result.replacedAssets?.length)) {
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
                                                  registerPoolImport(prev.data, { ...result, importedAssets: [], createdSlides: [], importedBins: [] }),
                                                  selectedSection.id,
                                                  normalizedImportedAssets,
                                                  { background: `url('${toMediaUrl((normalizedImportedAssets[0] ?? result.replacedAssets![0]).relativePath)}')` },
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
                                const result = await window.appApi.importMedia(projectRef.current ? { folderPath: projectRef.current.folderPath, assets: projectRef.current.data.assets } : undefined);
                                if (result && (result.createdSlides.length > 0 || result.replacedAssets?.length)) {
                                  const newMedia = result.createdSlides.map((s, i) => ({ id: `img-${Date.now()}-${i}`, slideId: s.id, fit: "contain" as const }));
                                  const normalizedImportedAssets = decorateImportedAssetsForContext(
                                    project.data,
                                    result.importedAssets,
                                    selectedSection.id,
                                  );
                                  const importedData = registerPoolImport(project.data, result);
                                  const nextAssets = importedData.assets;
                                  const nextSlides = [...importedData.slides, ...result.createdSlides.map(s => ({ ...s, sectionId: selectedSection.id }))];
                                  const nextBreakMedia = [...(selectedSection.breakMedia || []), ...newMedia];
                                  setProject({
                                    ...project,
                                    data: {
                                      ...importedData,
                                      assets: nextAssets,
                                      slides: nextSlides,
                                      sections: importedData.sections.map(s => s.id === selectedSection.id ? { ...s, breakMedia: nextBreakMedia } : s)
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
                            onClick={() => void onImportAudio("section-bgm")}
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
                    </div></EditDock>
                  )}
                  <LogicalSceneFrame frame={presentMode || editWorkspace ? { width: 1920, height: 1080 } : null}>
                  <ZoomPanWrapper
                    key={JSON.stringify(activeTargetToken)}
                    onTransientChange={teachingScene.updateTransient}
                    onLiveViewportChange={teachingScene.updateViewport}
                    resetSignal={viewportResetSignal}
                    requestedViewport={teachingScene.state.viewport}
                    className="break-stage-wrapper"
                    targetId={`${presentationSession.projectId}:${presentationSession.targetRevision}:${presentationTarget.occurrenceId}`}
                    drawSettings={drawSettings}
                    markerStrokes={selectedSection.markerStrokes ?? []}
                    contentWidth={1920}
                    contentHeight={1080}
                    onMarkerStrokesChange={updateCurrentSlideMarkerStrokes}
                    clearSignal={drawClearSignal}
                    initialViewport={selectedSection.breakViewport}
                    onViewportChange={(vp) => {
                      const live = resolvePresentationTarget(projectRef.current?.data ?? null, selection.ref.current);
                      if (!targetMatches(selection.ref.current, live, activeTargetToken)) return;
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
                        background: selectedSection.bgTransform && selectedSection.bgTransform.blur ? "transparent" : (visualMediaBackground(resolveAuthoredBackground(selectedSection.background || "#111", mediaRegistry.resolvePath), visualScope)),
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
                        <div style={{ position: "absolute", zIndex: -1, inset: -100, pointerEvents: "none", background: visualMediaBackground(resolveAuthoredBackground(selectedSection.background || "#111", mediaRegistry.resolvePath), visualScope), backgroundRepeat: "no-repeat", backgroundSize: `${(selectedSection.bgTransform.scale ?? 1) * 100}%`, backgroundPosition: `calc(50% + ${selectedSection.bgTransform.x ?? 0}px) calc(50% + ${selectedSection.bgTransform.y ?? 0}px)`, filter: `blur(${selectedSection.bgTransform.blur}px)` }} />
                      ) : null}
                      {/* Thumbnails at Top */}
                      <div className="break-thumbnails-grid">
                        {(selectedSection.breakMedia ?? []).map((m) => {
                          const slide = project?.data.slides.find(
                            (s) => s.id === m.slideId,
                          );
                          const asset = slide ? assetsById.get(slide.assetId) : null;
                          if (!asset) return null;
                          const src = toVisualMediaUrl(asset.relativePath);
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
                                  screenScale: Math.max(0.001, event.currentTarget.getBoundingClientRect().width / event.currentTarget.offsetWidth),
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
                                  screenScale: Math.max(0.001, event.currentTarget.getBoundingClientRect().width / event.currentTarget.offsetWidth),
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
<div key={ref.id} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{
                            appMode === "teach" ? <ACardSystem key={ref.id} aCardId={ref.aCardId} mode="teach" runtime={boardBinding(ref.aCardId, ref.id)} teachPanelHost={teachToolsHostRef.current} resolveImageUrl={id => { const asset = assetsById.get(id); return asset ? toVisualMediaUrl(asset.relativePath) : null; }} /> : <ACardStageRenderer
                              key={ref.id}
                              aCardId={ref.aCardId}
                              startedAt={boardBinding(ref.aCardId, ref.id).state.startedAt}
                              teachStates={boardBinding(ref.aCardId, ref.id).state.states}
                              mode={appMode}
                              selectedInstanceId={selectedPlacedBCardId}
                              onInstanceClick={(instanceId) => handlePlacedACardInstanceClick(ref.aCardId, ref.id, instanceId)}
                              onInstanceChange={appMode === "edit" ? (instanceId, updates) => updateACardBCardInstance(ref.aCardId, instanceId, updates) : boardBinding(ref.aCardId, ref.id).move}
                              resolveImageUrl={(id) => {
                                const asset = assetsById.get(id);
                                return asset ? toVisualMediaUrl(asset.relativePath) : null;
                              }}
                            />
}</div>
                          ))}
                        </div>
                      )}

                      {activeOverlayBCardInstances.length > 0 && (
                        <BCardInstanceLayer
                          instances={appMode === "teach" ? overlayBinding.state.instances : activeOverlayBCardInstances}
                          mode={appMode}
                          selectedInstanceId={selectedOverlayBCardInstanceId}
                          onSelectInstance={setSelectedPlacedBCardId}
                          onInstanceChange={updatePlacedBCardInstance}
                          teachStates={overlayBCardTeachStates}
                          clickAction={overlayBCardClickAction}
                          onTeachStateChange={setOverlayBCardState}
                          resolveImageUrl={(id) => {
                            const asset = assetsById.get(id);
                            return asset ? toVisualMediaUrl(asset.relativePath) : null;
                          }}
                        />
                      )}
                    </div>
                  </ZoomPanWrapper>
                  </LogicalSceneFrame>
                  {presentMode && <><RewardSurface presentation={appMode === 'edit' ? { ...rewardPresentation, base: undefined } : rewardPresentation} onFinalBadgeScroll={rewards.scrollFinalBadge} onRelicOffsetChange={rewards.moveRelic} onHideRelicReward={() => rewards.showRelicReward(false)} /><MovementSurface presentation={scopedMovement} /></>}
                </>
              ) : activeItem?.type === 'cardActivityRef' ? (
                <div style={{position: 'absolute', inset: 0}}>{v2Plan ? <CardV2Scene plan={v2Plan} selectedInstanceId={appMode==='edit'?selectedV2Card:Object.values(v2Runtime.state?.instances ?? {}).find(item => item.selected)?.instanceId} showWarnings={appMode === 'edit'} onSelect={appMode==='edit'?selectV2Card: v2Runtime.state ? id => v2Runtime.dispatch({type: 'SelectCard', instanceId: id}) : undefined} onGeometryChange={appMode==='edit'?(id,geometry)=>cardAction(()=>{if(project&&v2Host)commitCardData(updateHostGeometry(project.data,v2Host,id,geometry));}):undefined} /> : <p>Card activity is missing.</p>}</div>
              ) : activeItem?.type === 'promptCard' ? (
                <div style={{ position: 'absolute', inset: 0 }}>
                  <LogicalSceneFrame frame={editWorkspace ? presentFrame ?? {width:1280,height:720} : appMode === 'teach' ? presentFrame : null}>
                    <PromptCardScene title={activeItem.title ?? ''} body={activeItem.body ?? ''} />
                    <BCardInstanceLayer instances={appMode === "teach" ? overlayBinding.state.instances : activeOverlayBCardInstances} mode={appMode} selectedInstanceId={selectedOverlayBCardInstanceId} onSelectInstance={setSelectedPlacedBCardId} onInstanceChange={updatePlacedBCardInstance} teachStates={overlayBCardTeachStates} clickAction={overlayBCardClickAction} onTeachStateChange={setOverlayBCardState} resolveImageUrl={id => { const asset = assetsById.get(id); return asset ? toVisualMediaUrl(asset.relativePath) : null; }} />
                  </LogicalSceneFrame>
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
                  <EditDock area="presentation">
                  <div
                    className="stage-controls"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center",
                      padding: "10px",
                      background: "#222",
                      borderRadius: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    {topMode !== 'boost' && <>
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
                        (currentVisiblePos < 0 || currentVisiblePos >= visibleSlideIndices.length - 1)
                      }
                    >
                      Next
                    </button>
                    </>}

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
                      {drawingPanel}

                  </div>

                  </EditDock>
                  <div ref={staticStageRef} className="stage" onContextMenu={handleStageContextMenu}>
                    <LogicalSceneFrame frame={editWorkspace ? presentFrame ?? {width:1280,height:720} : appMode === 'teach' ? presentFrame : null}>
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
                      >
                        <TransitionLayers event={appMode === "teach" ? sceneTransition : null} heightFraction={stageHasHalfACardOverlay ? 0.5 : 1}>
                        {/* Incoming Slide */}
                        <MediaView
                          key={JSON.stringify(activeTargetToken)}
                          visualScope={visualScope}
                          asset={currentAsset}
                          overlays={currentSlide?.overlays ?? []}
                          videoAudio={currentSlide?.videoAudio}
                          className="media"
                          drawSettings={drawSettings}
                          initialZoom={viewportRef.current.zoom}
                          initialPan={viewportRef.current.pan}
                          viewportResetSignal={viewportResetSignal}
                          requestedViewport={teachingScene.state.viewport}
                          onViewportChange={(v) => {
                            const live = resolvePresentationTarget(projectRef.current?.data ?? null, selection.ref.current);
                            if (!targetMatches(selection.ref.current, live, activeTargetToken)) return;
                            viewportRef.current = v;
                            teachingScene.updateViewport(v);
                          }}
                          paused={usesPresentVideo || appMode === "edit"}
                          passiveVideo={usesPresentVideo}
                          previewStream={mediaPlayback.previewStream}
                          previewDuration={mediaPlayback.status?.durationSec}
                          onTimeUpdate={(t) => {
                            lastMediaTimeRef.current = t;
                          }}
                          showControls={true}
                          isEditMode={appMode === "edit"}
                          onEditVideoElement={setEditPreviewVideo}
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
                        </TransitionLayers>
                      </div>
                    )}

                    {((topMode === "story" && storyACardRefs.length > 0) || (topMode === "boost" && boostTab === "language" && boostLanguageACardRefs.length > 0)) && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 34, pointerEvents: "none" }}>
                        {(topMode === "story" ? storyACardRefs : boostLanguageACardRefs).map((ref) => (
<div key={ref.id} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{
                          appMode === "teach" ? <ACardSystem key={ref.id} aCardId={ref.aCardId} mode="teach" runtime={boardBinding(ref.aCardId, ref.id)} teachPanelHost={teachToolsHostRef.current} resolveImageUrl={id => { const asset = assetsById.get(id); return asset ? toVisualMediaUrl(asset.relativePath) : null; }} /> : <ACardStageRenderer
                            key={ref.id}
                            aCardId={ref.aCardId}
                              startedAt={boardBinding(ref.aCardId, ref.id).state.startedAt}
                            teachStates={boardBinding(ref.aCardId, ref.id).state.states}
                            mode={appMode}
                            selectedInstanceId={selectedPlacedBCardId}
                            onInstanceClick={(instanceId) => handlePlacedACardInstanceClick(ref.aCardId, ref.id, instanceId)}
                            onInstanceChange={appMode === "edit" ? (instanceId, updates) => updateACardBCardInstance(ref.aCardId, instanceId, updates) : boardBinding(ref.aCardId, ref.id).move}
                            resolveImageUrl={(id) => {
                              const asset = assetsById.get(id);
                              return asset ? toVisualMediaUrl(asset.relativePath) : null;
                            }}
                          />
}</div>
                        ))}
                      </div>
                    )}

                    {activeOverlayBCardInstances.length > 0 && (
                      <BCardInstanceLayer
                        instances={appMode === "teach" ? overlayBinding.state.instances : activeOverlayBCardInstances}
                        mode={appMode}
                        selectedInstanceId={selectedOverlayBCardInstanceId}
                        onSelectInstance={setSelectedPlacedBCardId}
                        onInstanceChange={updatePlacedBCardInstance}
                        teachStates={overlayBCardTeachStates}
                        clickAction={overlayBCardClickAction}
                        onTeachStateChange={setOverlayBCardState}
                        resolveImageUrl={(id) => {
                          const asset = assetsById.get(id);
                          return asset ? toVisualMediaUrl(asset.relativePath) : null;
                        }}
                      />
                    )}

                    {currentSlide && (
                      <StageDrawingOverlay
                        targetId={`${presentationSession.projectId}:${presentationSession.targetRevision}:${presentationTarget.occurrenceId}`}
                        settings={drawSettings}
                        markerStrokes={currentSlide.markerStrokes ?? []}
                        onMarkerStrokesChange={updateCurrentSlideMarkerStrokes}
                        clearSignal={drawClearSignal}
                        viewportRef={viewportRef}
                        onTransientChange={(strokes) => {
                          const live = resolvePresentationTarget(projectRef.current?.data ?? null, selection.ref.current);
                          if (targetMatches(selection.ref.current, live, activeTargetToken)) teachingScene.updateTransient(strokes);
                        }}
                      />
                    )}
                    </LogicalSceneFrame>
                  {presentMode && <><RewardSurface presentation={appMode === 'edit' ? { ...rewardPresentation, base: undefined } : rewardPresentation} onFinalBadgeScroll={rewards.scrollFinalBadge} onRelicOffsetChange={rewards.moveRelic} onHideRelicReward={() => rewards.showRelicReward(false)} /><MovementSurface presentation={scopedMovement} /></>}
                  </div>
                </>
              )}
            </main>
            </TeachPreview>
            {appMode === 'teach' && <>
              <TeachDivider value={teachLayout.split} onChange={teachLayout.resize} />
              <section className="teach-control-region" aria-label="Teacher controls">
                <section className="teach-control-card">
                  <div className="teach-context"><strong>Live: {presentationTarget.kind === 'break' ? selectedSection?.name : currentSlide ? getSlideDisplayName(currentSlide) : presentationTarget.board?.name || presentationTarget.kind}</strong><span>{topMode === 'boost' ? `${boostTab} booster · ${activeBoostIndex + 1} / ${activeBoostSequence.length}` : selectedSection?.name}</span></div>
                  <div className="teach-actions">
                    <button onClick={goToPrevSlide} disabled={!presentationTarget.capabilities.canNavigate}>Previous</button>
                    <button onClick={goToNextSlide} disabled={!presentationTarget.capabilities.canNavigate}>Next</button>
                    {topMode === 'boost' && <button onClick={() => setTopMode('story')}>Return to lesson</button>}
                  </div>
                  <div className="teach-actions" aria-label="Teaching context">
                    <button aria-pressed={topMode === 'story'} onClick={() => {setTopMode('story');setTeachSecondaryOpen(false);}}>Lesson</button>
                    <button aria-pressed={topMode === 'boost'} onClick={() => {setTopMode('boost');setTeachSecondaryOpen(false);}}>Boosters</button>
                    {hasLegacyCards && <button aria-pressed={topMode === 'boards'} onClick={() => {setTopMode('boards');setTeachSecondaryOpen(false);}}>Legacy boards</button>}
                    {(['badge','relics'] as const).map(mode => <button key={mode} aria-expanded={topMode === mode && teachSecondaryOpen} onClick={() => {setTopMode(mode);setTeachSecondaryOpen(topMode === mode ? !teachSecondaryOpen : true);}}>{mode === 'badge' ? 'Badges / students' : mode === 'relics' ? 'Relics' : 'Movement'}</button>)}
                  </div>
                  {teachSecondaryOpen && <button className="teach-secondary-close" onClick={() => setTeachSecondaryOpen(false)}>Close secondary tools</button>}
                  {topMode === 'boost' && <div className="teach-actions">{(['activation','language','games'] as const).map(tab => <button key={tab} aria-pressed={boostTab === tab} onClick={() => setBoostTab(tab)}>{tab}</button>)}</div>}
                  {topMode === 'boards' && <label>Board <select aria-label="Active board" value={selectedACardId ?? ''} onChange={event => setSelectedACardId(event.target.value)}><option value="">Choose board</option>{Object.values(project?.data.aCardLibrary ?? {}).map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>}
                </section>
                {(presentationTarget.capabilities.canDraw || presentationTarget.capabilities.canZoom) && <section className="teach-control-card teach-spatial-tools">
                  <h3>Preview tools</h3><div className="teach-actions">
                  {presentationTarget.capabilities.canDraw && <><button aria-pressed={drawSettings.drawMode} onClick={() => setDrawSettings(prev => ({...prev,drawMode:!prev.drawMode}))}>{drawSettings.drawMode ? 'Drawing on' : 'Draw'}</button><button disabled={!(presentationTarget.kind === "break" ? selectedSection?.markerStrokes?.length : currentSlide?.markerStrokes?.length)} onClick={() => updateCurrentSlideMarkerStrokes((presentationTarget.kind === "break" ? selectedSection?.markerStrokes ?? [] : currentSlide?.markerStrokes ?? []).slice(0,-1))}>Undo marker</button><button onClick={clearCurrentSlideDrawings}>Clear drawing</button><button aria-expanded={!drawPanelCollapsed} onClick={() => setDrawPanelCollapsed(v => !v)}>Pen options</button></>}
                  {presentationTarget.capabilities.canZoom && <>{([-0.25,0.25] as const).map(delta => <button key={delta} aria-label={delta < 0 ? 'Zoom out' : 'Zoom in'} onClick={() => {const v=teachingScene.state.viewport;teachingScene.updateViewport({...v,zoom:Math.max(1,Math.min(4,v.zoom+delta))});setViewportResetSignal(n=>n+1);}}>{delta < 0 ? '− Zoom' : '+ Zoom'}</button>)}<button onClick={() => {teachingScene.updateViewport({zoom:1,pan:{x:0,y:0}});setViewportResetSignal(n=>n+1);}}>Reset view</button></>}
                  </div>{presentationTarget.capabilities.canDraw && drawingPanel}
                  {presentationTarget.capabilities.canZoom && <p>Scroll over the preview to zoom. Middle-drag to pan. {Math.round(teachingScene.state.viewport.zoom*100)}%</p>}
                </section>}
                {mediaPlayback.intent && <section className="teach-control-card"><h3>Video</h3><MediaTransportControls key={mediaPlayback.intent.identity} {...mediaPlayback} intent={mediaPlayback.intent} /></section>}
                {presentationTarget.kind === 'break' && <section className="teach-control-card"><h3>Break timer</h3><button onClick={toggleTimer}>{timerState.isRunning ? 'Stop timer' : 'Start timer'}</button></section>}
                <div ref={teachToolsHostRef} className="teach-board-tools" />
                {v2Module && v2PlacementId && <CardV2Controls module={v2Module} placementId={v2PlacementId} state={v2Runtime.state} dispatch={v2Runtime.dispatch} onReturn={() => setTopMode('story')} />}
                {selectedOverlayBCardState && <section className="teach-control-card"><h3>Selected card</h3><div className="teach-actions">{(['isFlipped','isBlurred','isCovered','isZoomed'] as const).map((key,index)=><button key={key} aria-pressed={selectedOverlayBCardState[key]} onClick={()=>toggleSelectedOverlayBCardState(key)}>{['Flip','Blur','Cover','Zoom'][index]}</button>)}<button onClick={resetSelectedOverlayBCardState}>Reset card</button></div></section>}
                <TeachLiveControls movementControls={<TeachMovementControls config={movementConfig} active={activeMovementEvent} onTrigger={triggerMovementEvent} onRandom={triggerRandomMovementEvent} onStop={() => setActiveMovementEvent(null)} />} section={teachAudioSection} slide={teachAudioSlide} onOpenAudio={() => setAudioSettingsOpen(true)} />
              </section>

              <TeachNavigatorDivider height={teachLayout.navigatorHeight} maximum={teachLayout.navigatorMaximum} onChange={teachLayout.resizeNavigator} />
              <TeachNavigator data={project?.data ?? null} session={presentationSession} target={presentationTarget}
                onSlide={id => {setTopMode('story');const index=project?.data.slides.findIndex(slide=>slide.id===id) ?? -1;if(index>=0)goToSlideByAbsoluteIndex(index);}}
                onSection={id => {setTopMode('story');setSelectedSectionId(id);audioManager.stopSlideAudio();audioManager.stopSectionMusic();}}
                onBoostItem={setSelectedBoostItemId}
                resolveImage={id => {const asset=assetsById.get(id);return asset?.mediaType==='image'?toVisualMediaUrl(asset.relativePath):null;}} />
            </>}

            {editWorkspace && <>
              <TeachDivider value={teachLayout.split} onChange={teachLayout.resize} />
              <EditInspector actions={<div className="edit-heading-actions"><button disabled={!v2Host&&!(topMode==='boost'&&boostTab!=='badge')} onClick={()=>quickAddCard()}>+ Card</button>{topMode==='boost'&&<button onClick={()=>setTopMode('story')}>← Back to Story</button>}</div>} selectionKey={selectedV2Card} contextual={v2Module&&v2PlacementId&&selectedV2Card&&v2Activity?.instances.some(i=>i.id===selectedV2Card)?<CardPlacementInspector key={`${v2PlacementId}:${selectedV2Card}`} module={v2Module} placementId={v2PlacementId} instanceId={selectedV2Card} assets={project?.data.assets??[]} onChange={updateCardsV2} onDuplicate={duplicateSelectedV2} onRemove={removeSelectedV2} onIndependent={()=>cardAction(()=>{if(project&&v2Host)commitCardData(makeHostCardIndependent(project.data,v2Host,selectedV2Card,()=>crypto.randomUUID()));})} onCopy={copySelectedV2} onOpenLibrary={()=>setCardsV2Open(true)} resolveImageUrl={id=>{const asset=assetsById.get(id);return asset?toVisualMediaUrl(asset.relativePath):undefined;}} onPreviewFace={setPreviewV2Face} onActivityCreated={addV2ToBooster}/>:undefined} pool={<>{project&&topMode==='boost'&&<BoosterContext data={project.data} tab={boostTab} item={activeItem} index={activeBoostIndex} count={activeBoostSequence.length} onReturn={()=>setTopMode('story')} onTab={tab=>{setBoostTab(tab);setSelectedBoostItemId(project.data.boostPack?.[`${tab}Sequence`][0]?.id??null);}} onSelect={direction=>{const item=activeBoostSequence[activeBoostIndex+direction];if(item)setSelectedBoostItemId(item.id);}} onMedia={addBoosterMedia} onReuse={reuseBoosterSlide} onIndependent={()=>cardAction(()=>{if(boostTab!=='badge'&&activeItem)commitCardData(independentBoosterSlide(project.data,boostTab,activeItem.id,()=>crypto.randomUUID()).data);})} onPrompt={()=>insertBoosterItem({id:crypto.randomUUID(),type:'promptCard',title:'Question',body:''})} onCards={()=>quickAddCard(undefined,false,true)} onBreak={id=>insertBoosterItem({id:crypto.randomUUID(),type:'breakRef',breakId:id})}/>}<div className="edit-quick-add"><button disabled={!currentSlide} onClick={()=>{selectV2Card('');setBubblePanelOpen(true);}}>Text / Bubble</button><button onClick={()=>setCardsV2Open(true)}>Card Library / Activity</button>{v2Module&&v2Host&&<details className="quick-card-reuse"><summary>Add from Cards / Sets</summary><label><input type="checkbox" checked={reuseCardIndependent} onChange={e=>setReuseCardIndependent(e.target.checked)}/> Make independent copies</label><p>{reuseCardIndependent?'New content for this canvas.':'Linked content: face edits update all uses.'}</p><label>Card<select aria-label="Add existing Card" value="" onChange={e=>{if(e.target.value)quickAddCard(e.target.value,reuseCardIndependent);}}><option value="">Choose Card…</option>{Object.values(v2Module.cards).map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label><label>Set<select aria-label="Add from Set" value="" onChange={e=>{if(e.target.value)addSetToCanvas(e.target.value);}}><option value="">Choose Set…</option>{Object.values(v2Module.sets).map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label></details>}{cardClipboard.current?.project===project?.folderPath&&<button onClick={()=>quickAddCard(undefined,true,false,true)}>Paste Card</button>}</div>{project && <MediaPool focusContentKey={selectedV2Card} key={project.folderPath} data={project.data} busy={poolBusy} onChange={data=>setProject(previous=>previous?{...previous,data}:previous)} onImport={importToPool} onInsert={selectedSection && topMode === 'story' ? ids => placePoolAssets(ids, { sectionId: selectedSection.id, beforeId: null }) : undefined} onAttachAudio={attachPoolAudio} resolveUrl={toVisualMediaUrl}/>}</>} categories={['content','presentation','audio','tools']} refs={editHosts.refs} title={topMode === 'story' ? (selectedSectionType === 'break' ? `Break · ${selectedSection?.name}` : currentSlide ? getSlideDisplayName(currentSlide) : 'Inspector') : topMode==='boost'?`Boosters › ${boostTab[0].toUpperCase()+boostTab.slice(1)} · ${activeBoostIndex+1} / ${activeBoostSequence.length}`:`${topMode} workspace`} focus={editFocus} onFocus={() => setEditFocus(value => !value)} tools={<div className="edit-lesson-tools">{(['story','boost','boards','movement','badge','relics'] as const).map(mode => <button key={mode} aria-pressed={topMode === mode} onClick={() => mode === 'boards' && !hasLegacyCards ? setCardsV2Open(true) : setTopMode(mode)}>{mode === 'story' ? 'Sections / structure' : mode === 'boost' ? 'Boosters' : mode === 'badge' ? 'Badges' : mode}</button>)}</div>} />
              <TeachNavigatorDivider minimum={300} height={teachLayout.navigatorHeight} maximum={teachLayout.navigatorMaximum} onChange={teachLayout.resizeNavigator} />
              {project && <LessonTimeline key={project.folderPath} data={project.data} liveActive={teachLayout.presentActive} selectedIds={selectedSlideIds} edit={presentationTarget} live={liveTarget} session={presentationSession}
                transport={<EditVideoTransport video={currentAsset?.mediaType==='video'?editPreviewVideo:null} trim={currentSlide?.videoTrim} label={currentSlide?.name||currentAsset?.originalName}/>}
                onSlide={(id,event)=>{setTopMode('story');const index=project.data.slides.findIndex(s=>s.id===id);if(index>=0){if(event)onSlideWrapperClick(index,event);else goToSlideByAbsoluteIndex(index);}}}
                onSection={id=>{setTopMode('story');selectSection(id);}} onBoost={setSelectedBoostItemId} onBoostAction={changeBoosterSequence}
                onPlace={placePoolAssets} onFiles={(paths,slot)=>void importToPool(paths?'drop':'files',paths,undefined,slot)}
                onReorder={(id,slot)=>{const from=project.data.slides.findIndex(s=>s.id===id);const slide=project.data.slides[from];if(!slide)return;if(slide.sectionId!==slot.sectionId){showToast('Cross-section moves are not supported yet.','edit',2500);return;}const indices=sectionSlideIndices.get(slot.sectionId)??[];const to=slot.beforeId?project.data.slides.findIndex(s=>s.id===slot.beforeId):(indices[indices.length-1]??from)+1;reorderSlidesWithinSection(from,to);}}
                onSectionAdd={before=>onAddSection(undefined,before)} onBreakAdd={before=>onAddBreak(before)} onLessonAdd={()=>{const lesson=project.data.sections.find(s=>s.name==='Lesson'&&s.type!=='break');if(lesson)selectSection(lesson.id);else onAddSection('Lesson',project.data.sections[0]?.id);}}
                onDelete={onDeleteSlide} onDeleteSection={deleteSection} onDuplicateBreak={duplicateBreak} onMoveSection={moveSection}
                onRename={(id,name,section)=>section?updateSection(id,{name}):commitSlideName(id,name)} onShow={showInPresent}
                resolveUrl={toVisualMediaUrl} previewActivity={item=>{
                  if(item.type==='slideRef'){const slide=project.data.slides.find(s=>s.id===item.slideId);return slide?<TimelineFrame data={project.data} slide={slide} frame={presentFrame??staticFrame} scope={visualScope} resolveUrl={toVisualMediaUrl}/>:null;}
                  if(item.type==='promptCard')return <LogicalSceneFrame frame={{width:1280,height:720}}><PromptCardScene title={item.title??''} body={item.body??''}/></LogicalSceneFrame>;
                  if(item.type==='cardActivityRef'&&v2Module){const activity=v2Module.activities[v2Module.placements[item.placementId]?.activityId];return activity?<CardV2Scene plan={buildCardV2RenderPlan(v2Module,activity,undefined,id=>{const asset=assetsById.get(id);return asset?toVisualMediaUrl(asset.relativePath):undefined;})}/>:null;}
                  return null;
                }} preview={slide=><TimelineFrame data={project.data} slide={slide} frame={presentFrame??staticFrame} scope={visualScope} resolveUrl={toVisualMediaUrl}/>}/>}
            </>}
            <EditDock area="inspector"><aside className="audio-sidebar">

              {topMode === 'story' || (!editWorkspace && topMode === 'relics') ? (
                <>
                  <div className="edit-group edit-group-content">                  <div className="audio-block" style={{ border: '1px solid #3a475f', background: 'linear-gradient(180deg, #1a202b, #171b24)', order: 90 }}>
                    <h4
                      onClick={() => setStoryRefsCollapsed((v) => !v)}
                      style={{ margin: "0", color: "#a9c7ff", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    >
                      Legacy Story Attachments
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
                              + Legacy board
                            </button>
                            <button
                              style={{ flex: 1, padding: "6px", fontSize: "0.75rem", background: "#24343d", border: "1px solid #456576", color: "#c3ebff", borderRadius: 4 }}
                              onClick={() => addStoryReference("bCard")}
                              disabled={!storyBCardHost}
                            >
                              + Legacy overlay
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
                                      return asset ? toVisualMediaUrl(asset.relativePath) : null;
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

                  <div className="edit-group edit-group-content">                  {(() => {
                    const activeOverlay = currentSlide?.overlays?.find(o => o.id === activeOverlayId);
                    return activeOverlay && appMode === "edit" ? (
                      <div className="audio-block bubble-inspector" aria-label="Selected bubble settings">
                        <h4 style={{ color: '#88f', margin: '4px 0 8px 0' }}>Selected Bubble: {activeOverlay.bubbleId || 'N/A'}</h4>
                        <div className="bubble-field"><label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
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
                        </label></div>
                        <div className="bubble-compact-actions"><label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: '0.8rem', color: '#ccc', gap: 8, marginBottom: 8 }}>
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
                        </label><button
                          onClick={() => {
                            if (!currentSlide || !project) return;
                            const nextOverlays: OverlayItem[] = (currentSlide.overlays || []).filter(o => o.id !== activeOverlay.id);
                            setProject({ ...project, data: { ...project.data, slides: project.data.slides.map(s => s.id === currentSlide.id ? { ...s, overlays: nextOverlays } : s) } });
                            setActiveOverlayId(null);
                            setIsDirty(true);
                          }}
                          style={{ background: '#633', color: '#fff', border: 'none', padding: '6px', borderRadius: 4,  cursor: 'pointer', marginBottom: 8 }}
                        >
                          Delete Bubble
                        </button></div>
                        <section className="bubble-settings-section" aria-label="Bubble typography">
                          <h5>Text style</h5>
                          <div className="bubble-field-grid"><label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
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
                        </label><label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
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
                        </label><label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
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
                        </label><label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
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
                        </label></div>
                          <div className="bubble-compact-actions"><label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: '0.8rem', color: '#ccc', gap: 8, marginBottom: 8 }}>
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
                        </label><div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
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
                        </div><label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', color: '#ccc', gap: 4, marginBottom: 8 }}>
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
                        </label></div>
                        </section>
                        <details className="bubble-advanced">
                          <summary>Tags &amp; text area</summary>
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
                        </label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
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
                        </details>
                        <details className="bubble-advanced">
                          <summary>Custom templates</summary>
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
                        </details>
                      </div>
                    ) : null;
                  })()}
</div>
                  <div className="edit-group edit-group-content">{selectedSectionType !== 'break' && currentSlide && renderTagEditor(currentSlide)}</div>
                  <div className="edit-group edit-group-audio">
                  {selectedSectionType !== 'break' && <div className="audio-block">
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
                  </div>}

                  </div>
                  <div className="edit-group edit-group-audio"><div className="audio-block">
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

                  </div>
                  {!editWorkspace && <CompactAudioPanel onOpenSettings={() => setAudioSettingsOpen(true)} />}
                </>
              ) : editWorkspace && ['movement', 'relics', 'boards'].includes(topMode) ? null : topMode === 'badge' ? (
                <div className="audio-block" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <BadgePanel visualScope={visualScope}
                    isEditMode={appMode === "edit"}
                    project={project}
                    selectedSpriteId={selectedBadgeSpriteId}
                    onSelectSprite={setSelectedBadgeSpriteId}
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
                <div className="audio-block edit-group edit-group-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: 0 }}>Booster content</h4>

                  <div hidden={editWorkspace} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: "10px 0", borderBottom: '1px solid #333', paddingBottom: 10 }}>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('slideRef')}>Use Existing Slide</button>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('breakRef')}>Use Existing Break</button>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('promptCard')}>+ Prompt</button>
                    <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('miniGame')}>+ Game</button>
                    <button style={{ padding: '6px', background: '#253525', border: '1px solid #4a6a4a', color: '#adfaad', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} disabled={!hasLegacyCards} onClick={() => addSequenceItem('aCardRef')}>+ Legacy board</button>
                    <button style={{ padding: '6px', background: '#253535', border: '1px solid #4a6a6a', color: '#adeaff', borderRadius: 4, cursor: activeItem ? 'pointer' : 'not-allowed', opacity: activeItem ? 1 : 0.45, fontSize: '0.75rem', flex: 1 }} onClick={addBoostBCardInstance} disabled={!activeItem || !hasLegacyCards || activeItem.type === 'cardActivityRef'}>+ Legacy overlay</button>
                  </div>

                  {!editWorkspace&&<button onClick={() => setCardsV2Open(true)}>Add Card Activity / Edit Cards</button>}
                  {activeItem ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {activeItem.type === 'slideRef' && (
                        <>
                          <h4 style={{ margin: 0, color: "#ccc", fontSize: "0.85rem" }}>Reused Story slide</h4>
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
                                    onClick={() => updateSequenceItem(activeItem.id, { slideId: s.id, independentCopyOf:undefined })}
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
                          <h4 style={{ margin: 0, color: "#ccc", fontSize: "0.85rem" }}>Reused Story break</h4>
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

                            </div>
                          )}
                        </>
                      )}
                      <div style={{ borderTop: '1px solid #2f3340', paddingTop: 12, display: activeItem.type === 'cardActivityRef' || !hasLegacyCards ? 'none' : 'flex', flexDirection: 'column', gap: 8 }}>
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
            </aside></EditDock>
          </div>
          </EditWorkspaceProvider>
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
                        disabled: !project || (topMode === "boost" ? activeBoostIndex < 0 || activeBoostIndex >= activeBoostSequence.length - 1 : currentIndex >= project.data.slides.length - 1 && selectedSection?.type !== 'break')
                      },
                      {
                        label: "Prev Slide",
                        onClick: goToPrevSlide,
                        disabled: !project || (topMode === "boost" ? activeBoostIndex <= 0 : currentIndex <= 0 && selectedSection?.type !== 'break')
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
    </SparkProvider></EditorPreviewAudioContext.Provider></MediaPathResolverContext.Provider>
  );
}

function ZoomPanWrapper({
  children,
  className,
  targetId,
  drawSettings,
  markerStrokes,
  contentWidth,
  contentHeight,
  onMarkerStrokesChange,
  clearSignal,
  initialViewport,
  onViewportChange,
  onLiveViewportChange,
  resetSignal,
  requestedViewport,
  onTransientChange,
}: {
  children: React.ReactNode;
  resetSignal?: number;
  requestedViewport?: ViewportState;
  onLiveViewportChange?: (viewport: ViewportState) => void;
  onTransientChange?: (strokes: import("../shared/teachingScene").TransientStroke[]) => void;
  className?: string;
  targetId: string;
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
  const [zoom, setZoom] = useState(initialViewport?.zoom ?? 1);
  const [pan, setPan] = useState({ x: initialViewport?.panX ?? 0, y: initialViewport?.panY ?? 0 });
  const targetZoomRef = useRef(initialViewport?.zoom ?? 1);
  const targetPanRef = useRef({ x: initialViewport?.panX ?? 0, y: initialViewport?.panY ?? 0 });
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const drawingViewportRef = useRef<ViewportState>({ zoom, pan });
  drawingViewportRef.current = { zoom, pan };
  useEffect(() => { onLiveViewportChange?.({ zoom, pan }); }, [zoom, pan]);

  useEffect(() => {
    if (initialViewport) {
      targetZoomRef.current = initialViewport.zoom;
      targetPanRef.current = { x: initialViewport.panX, y: initialViewport.panY };
      setZoom(initialViewport.zoom);
      setPan({ x: initialViewport.panX, y: initialViewport.panY });
    }
  }, [initialViewport]);

  const previousResetSignal = useRef(resetSignal);
  useEffect(() => {
    if (previousResetSignal.current === resetSignal) return;
    previousResetSignal.current = resetSignal;
    const next = requestedViewport ?? {zoom:1,pan:{x:0,y:0}};
    targetZoomRef.current = next.zoom; targetPanRef.current = next.pan; setZoom(next.zoom); setPan(next.pan);
    onViewportChange?.({ zoom: next.zoom, panX: next.pan.x, panY: next.pan.y });
  }, [resetSignal]);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const onWheelZoom = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorX = (event.clientX - rect.left) * container.clientWidth / rect.width;
    const cursorY = (event.clientY - rect.top) * container.clientHeight / rect.height;

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

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
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
  };

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (!isPanning) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const scale = rect ? rect.width / Math.max(1, containerRef.current!.clientWidth) : 1;
      const deltaX = (event.clientX - panStartRef.current.x) / scale;
      const deltaY = (event.clientY - panStartRef.current.y) / scale;
      const nextPan = {
        x: panStartRef.current.panX + deltaX,
        y: panStartRef.current.panY + deltaY,
      };
      setPan(nextPan);
      targetPanRef.current = nextPan;
    };

    const onUp = () => {
      setIsPanning(false);
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
  }, [isPanning, onViewportChange]);

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
        cursor: isPanning ? "grabbing" : drawSettings.drawMode ? "crosshair" : "default",
        position: "relative",
        width: "100%",
        height: "100%",
        touchAction: "none",
      }}
    >
      <div style={contentStyle}>{children}</div>
      <StageDrawingOverlay
        targetId={`break:${targetId}`}
        onTransientChange={onTransientChange}
        settings={drawSettings}
        markerStrokes={markerStrokes}
        onMarkerStrokesChange={onMarkerStrokesChange}
        clearSignal={clearSignal}
        viewportRef={drawingViewportRef}
        contentWidth={contentWidth}
        contentHeight={contentHeight}
      />
    </div>
  );
}


function MediaView({
  visualScope,
  asset,
  overlays,
  className,
  style,
  drawSettings,
  initialZoom,
  initialPan,
  viewportResetSignal,
  requestedViewport,
  onViewportChange,
  paused,
  passiveVideo = false,
  previewStream,
  previewDuration,
  initialTime,
  onTimeUpdate,
  showControls = true,
  isEditMode = false,
  onEditVideoElement,
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
  visualScope: string;
  asset: AssetItem;
  overlays: OverlayItem[];
  className?: string;
  style?: CSSProperties;
  drawSettings: DrawSettings;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
  viewportResetSignal?: number;
  requestedViewport?: ViewportState;
  onViewportChange?: (v: ViewportState) => void;
  paused?: boolean;
  passiveVideo?: boolean;
  previewStream?: MediaStream | null;
  previewDuration?: number;
  initialTime?: number;
  onTimeUpdate?: (t: number) => void;
  showControls?: boolean;
  isEditMode?: boolean;
  onEditVideoElement?: (video:HTMLVideoElement|null)=>void;
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
  const resolvePath = useContext(MediaPathResolverContext);
  const src = visualMediaUrl(resolveAuthoredMediaUrl(asset.relativePath, resolvePath), visualScope);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(()=>{
    if(!isEditMode||passiveVideo||asset.mediaType!=='video')return;
    onEditVideoElement?.(videoRef.current);
    return()=>onEditVideoElement?.(null);
  },[isEditMode,passiveVideo,asset.id,onEditVideoElement]);
  const trimTrackRef = useRef<HTMLDivElement | null>(null);
  const resolvedVideoAudio = useMemo(() => resolveVideoAudioSettings(videoAudio), [videoAudio]);
  const resolvedImageAdjustments = useMemo(
    () => resolveImageAdjustments(imageAdjustments),
    [imageAdjustments],
  );
  const [fileVideoDuration, setVideoDuration] = useState(0);
  const videoDuration = passiveVideo ? previewDuration ?? 0 : fileVideoDuration;
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
    if (!passiveVideo && initialTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = initialTime;
    }
  }, [passiveVideo]); // Restore position on initial mount or return to normal teaching.

  useEffect(() => {
    if (passiveVideo) return;
    if (paused && videoRef.current) {
      videoRef.current.pause();
    } else if (!paused && videoRef.current) {
      // If initialTime provided and we are starting, ensure we are there?
      // No, initialTime effect handles the seek.
      videoRef.current.play().catch(() => { });
    }
  }, [paused, passiveVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!passiveVideo || !video) return;
    video.muted = true; video.srcObject = previewStream ?? null;
    if (previewStream) void video.play().catch(() => {});
    return () => { video.pause(); video.srcObject = null; };
  }, [passiveVideo, previewStream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || passiveVideo || asset.mediaType !== "video" || !videoDuration) return;
    const nextTime = clampVideoTimeToTrim(video.currentTime, videoTrim, videoDuration);
    if (Math.abs(nextTime - video.currentTime) > 0.02) {
      video.currentTime = nextTime;
    }
  }, [asset.mediaType, passiveVideo, videoDuration, videoTrim]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset.mediaType !== "video") return;
    if (passiveVideo) { video.muted = true; return; }
    if (isEditMode) {
      video.muted = !resolvedVideoAudio.enabled;
      video.volume = resolvedVideoAudio.volume;
      return () => { video.pause(); };
    }
    video.muted = false;
    video.volume = 1;
    audioManager.attachMediaElement(
      video,
      resolvedVideoAudio.enabled ? resolvedVideoAudio.volume : 0,
      "slide-bgm",
    );

    return () => {
      video.pause();
      audioManager.detachMediaElement(video);
    };
  }, [asset.id, asset.mediaType, passiveVideo, isEditMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || asset.mediaType !== "video") return;

    if (isEditMode) { video.muted = !resolvedVideoAudio.enabled; video.volume = resolvedVideoAudio.volume; return; }
    audioManager.setMediaElementVolume(
      video,
      resolvedVideoAudio.enabled ? resolvedVideoAudio.volume : 0,
    );
  }, [asset.id, asset.mediaType, resolvedVideoAudio.enabled, resolvedVideoAudio.volume, isEditMode]);

  const [zoom, setZoom] = useState(initialZoom ?? 1);
  const [pan, setPan] = useState(initialPan ?? { x: 0, y: 0 });
  const targetZoomRef = useRef(initialZoom ?? 1);
  const targetPanRef = useRef(initialPan ?? { x: 0, y: 0 });

  useEffect(() => {
    onViewportChange?.({ zoom, pan });
  }, [zoom, pan, onViewportChange]);

  useEffect(() => {
    if (!viewportResetSignal) return;
    const next = requestedViewport ?? {zoom:1,pan:{x:0,y:0}};
    targetZoomRef.current = next.zoom; targetPanRef.current = next.pan;
    setZoom(next.zoom); setPan(next.pan);
  }, [viewportResetSignal]);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

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

  const onWheelZoom = useCallback(
    (event: globalThis.WheelEvent | WheelEvent<HTMLElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const logical = clientToLogical({ x: event.clientX, y: event.clientY }, rect, { width: container.clientWidth, height: container.clientHeight });
      const cursorX = logical.x;
      const cursorY = logical.y;

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
    // In Teach, the drawing canvas is a sibling of the media layer. Listen at
    // their shared logical frame so Draw mode still reaches the same zoom owner.
    const wheelHost = isEditMode ? container : container.closest('[data-logical-scene]') ?? container;
    const handler = (event: globalThis.WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (container.contains(target) || target.matches('.stage-drawing-overlay')) onWheelZoom(event);
    };
    wheelHost.addEventListener("wheel", handler as EventListener, { passive: false });
    return () => wheelHost.removeEventListener("wheel", handler as EventListener);
  }, [onWheelZoom, isEditMode]);

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
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const scaleX = container && rect ? container.clientWidth / Math.max(1, rect.width) : 1;
      const scaleY = container && rect ? container.clientHeight / Math.max(1, rect.height) : 1;
      const deltaX = (event.clientX - panStartRef.current.x) * scaleX;
      const deltaY = (event.clientY - panStartRef.current.y) * scaleY;
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
        <PassiveImage src={src} adjustments={imageAdjustments} style={imageMediaStyle} />
      ) : (
        <video
          key={passiveVideo ? 'present-stream' : 'lesson-file'}
          ref={videoRef}
          src={passiveVideo ? undefined : src}
          className="media-content"
          style={mediaStyle}
          controls={showControls && !passiveVideo}
          muted={passiveVideo}
          autoPlay={!paused && !passiveVideo}
          onLoadedMetadata={(e) => {
            if (passiveVideo) return;
            const video = e.target as HTMLVideoElement;
            setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0);
            const nextTime = clampVideoTimeToTrim(initialTime ?? video.currentTime, videoTrim, video.duration);
            if (Math.abs(nextTime - video.currentTime) > 0.02) {
              video.currentTime = nextTime;
            }
          }}
          onPlay={(e) => {
            const video = e.target as HTMLVideoElement;
            if (passiveVideo) return;
            const nextTime = clampVideoTimeToTrim(video.currentTime, videoTrim, video.duration);
            if (Math.abs(nextTime - video.currentTime) > 0.02) {
              video.currentTime = nextTime;
            }
          }}
          onTimeUpdate={(e) => {
            if (passiveVideo) return;
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
        <EditDock area="content">        <div className="video-trim-editor" onPointerDown={(e) => e.stopPropagation()}>
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
        </div></EditDock>
      )}

      {showImageAdjustmentEditor && (
        <EditDock area="content">        <div className="image-adjustment-editor" onPointerDown={(e) => e.stopPropagation()}>
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
        </div></EditDock>
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
            const container = containerRef.current;
            const rect = container?.getBoundingClientRect();
            const scaleX = container && rect ? container.clientWidth / Math.max(1, rect.width) : 1;
            const scaleY = container && rect ? container.clientHeight / Math.max(1, rect.height) : 1;
            const dx = (e.clientX - dragStartRef.current.cx) * scaleX / zoom;
            const dy = (e.clientY - dragStartRef.current.cy) * scaleY / zoom;
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
        {!isEditMode ? <PassiveOverlays overlays={resolvePassiveOverlays(overlays, bubbleDefinitions, visualScope, path => resolveAuthoredMediaUrl(path, resolvePath))} /> : overlays.map((overlay) => {
          if (overlay.visible === false) return null;
          const isActive = overlay.id === activeOverlayId;
          const mappedCustom: BubbleDef[] = (bubbleDefinitions || []).map(bt => ({
            bubbleDefId: `BD_CUSTOM_${bt.templateName}`,
            name: bt.templateName,
            templateName: bt.templateName,
            src: visualMediaUrl(resolveAuthoredMediaUrl(bt.imageSrc, resolvePath), visualScope),
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
                  backgroundImage: `url(${overlay.customImageSrc ? visualMediaUrl(resolveAuthoredMediaUrl(overlay.customImageSrc, resolvePath), visualScope) : (def.src || "")})`,
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

    </div>
  );
}
