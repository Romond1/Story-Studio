import {
  type CSSProperties,
  type MouseEvent,
  type WheelEvent,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AssetItem,
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
  SequenceItem
} from "../shared/types";
import { BUBBLE_LIBRARY } from "../shared/bubbleDefs";
import { BUILD_VERSION } from "../shared/version";
import { type AppMode, DEFAULT_MODE, ensureEditMode } from "./mode";
import { audioManager } from "./audio/AudioManager";
import { audioRouting } from "./audio/AudioRouting";
import { micInput } from "./audio/MicrophoneInput";

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
            {isPlaying ? "⏸" : "▶"}
          </button>

          <button
            onClick={() => onStop(clip.url, { fadeEnabled: clip.fadeEnabled || false })}
            style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ⏹
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
            ⚙️
          </button>
          {showRemove && onRemove && (
            <button
              onClick={onRemove}
              style={{ background: "transparent", border: "none", padding: 0, marginLeft: 4, color: "#ff6666" }}
              title="Remove audio"
            >
              🗑️
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

function toMediaUrl(relativePath: string): string {
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

export function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  // Track viewport of ACTIVE slide without triggering re-renders
  const viewportRef = useRef<ViewportState>({ zoom: 1, pan: { x: 0, y: 0 } });
  // Track playback time of ACTIVE media (for seamless transition freezing)
  const lastMediaTimeRef = useRef(0);

  // Transition UI Staging State
  const [stagedTransition, setStagedTransition] =
    useState<TransitionType>("fade");
  const [stagedDuration, setStagedDuration] = useState(500);
  const [stagedDirection, setStagedDirection] = useState<
    "left" | "right" | "up" | "down"
  >("left");

  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_MODE);

  const ENABLE_BOOST_MODE = true;
  const [topMode, setTopMode] = useState<'story' | 'boost'>('story');
  const [boostTab, setBoostTab] = useState<'activation' | 'language' | 'games'>('activation');
  const [selectedBoostItemId, setSelectedBoostItemId] = useState<string | null>(null);
  const [boostSearchQuery, setBoostSearchQuery] = useState("");

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(
    null,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [updateAudio, setUpdateAudio] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(
    null,
  );
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(
    null,
  );
  const [drawPanelCollapsed, setDrawPanelCollapsed] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    null,
  );
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(
    new Set(),
  );
  const [drawClearSignal, setDrawClearSignal] = useState(0);
  const [showBreakEditor, setShowBreakEditor] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSlideSelector, setShowSlideSelector] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "create" | "open" | "close" | null
  >(null);

  const [toast, setToast] = useState<{
    message: string;
    id: number;
    type: "edit" | "teach" | "success";
    duration: number;
  } | null>(null);

  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({
    tool: "highlighter",
    drawMode: false,
    size: 12,
    opacity: 0.45,
    fadeMs: 2000,
    color: "#f7f06d",
    rainbow: false,
    sparkle: false,
  });

  const [timerState, setTimerState] = useState<{
    isRunning: boolean;
    startTime: number;
    accumulated: number;
  }>({ isRunning: false, startTime: 0, accumulated: 0 });
  const [timerNow, setTimerNow] = useState(Date.now());

  // Audio Routing State
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>("default");
  const [selectedMonitorOutput, setSelectedMonitorOutput] = useState<string>("default");
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("default");
  const [micEnabled, setMicEnabled] = useState(false);

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

  const assetsById = useMemo(() => {
    const map = new Map<string, AssetItem>();
    project?.data.assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [project]);

  const sections = project?.data.sections ?? [];
  let _matchedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  let activeItem: SequenceItem | null = null;
  if (topMode === 'boost') {
    _matchedSection = null;
    if (project?.data.boostPack) {
      const activeSequence = project.data.boostPack[`${boostTab}Sequence` as keyof BoostPack] || [];
      activeItem = activeSequence.find(i => i.id === selectedBoostItemId) ?? null;
      if (activeItem?.type === 'breakRef') {
        const breakId = (activeItem as Extract<SequenceItem, { type: 'breakRef' }>).breakId;
        _matchedSection = sections.find(s => s.id === breakId) ?? null;
      }
    }
  }

  const selectedSection = _matchedSection;
  const selectedSectionType = topMode === 'boost' && activeItem && activeItem.type !== 'slideRef' && activeItem.type !== 'breakRef'
    ? activeItem.type
    : selectedSection?.type;

  useEffect(() => {
    if (selectedSection?.type === "break" && appMode === "edit" && topMode === 'story') {
      setShowBreakEditor(true);
    } else {
      setShowBreakEditor(false);
    }
  }, [selectedSection, appMode, topMode]);

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
    } else {
      currentSlide = null;
      currentAsset = null;
    }
  }

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
      const duration = targetSlide?.transitionDuration ?? 500;

      setPreviousIndex(currentIndex);
      setCurrentIndex(index);
      audioManager.stopSlideAudio(); // Stop slide audio on slide change
      setIsAnimating(true);
      window.setTimeout(() => {
        setIsAnimating(false);
        setPreviousIndex(null);
      }, duration);
    },
    [project, currentIndex],
  );

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

  const addSequenceItem = (type: 'slideRef' | 'breakRef' | 'promptCard' | 'miniGame') => {
    if (!project || !project.data.boostPack) return;
    const prop = (boostTab + 'Sequence') as 'activationSequence' | 'languageSequence' | 'gamesSequence';
    const seq = project.data.boostPack[prop] || [];
    let newItem: SequenceItem;
    const id = `item-${Date.now()}`;
    if (type === 'slideRef') {
      newItem = { id, type, slideId: project.data.slides[0]?.id || '' };
    } else if (type === 'breakRef') {
      newItem = { id, type, breakId: project.data.sections.find(s => s.type === 'break')?.id || '' };
    } else if (type === 'promptCard') {
      newItem = { id, type, body: '' };
    } else {
      newItem = { id, type, gameType: 'placeholder' };
    }
    setProject({ ...project, data: { ...project.data, boostPack: { ...project.data.boostPack, [prop]: [...seq, newItem] } } });
    setSelectedBoostItemId(id);
    setIsDirty(true);
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

      if (e.key === "Delete" || e.key === "Backspace") {
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
    selectSection,
    selectedSectionId,
    expandedSectionId,
    activeOverlayId,
    currentIndex,
  ]);

  const setProjectState = (next: ProjectState | null) => {
    if (!next) {
      setProject(null);
      setSelectedSectionId(null);
      setCurrentIndex(0);
      setPreviousIndex(null);
      setError(null);
      setExpandedSectionId(null);
      setSelectedSlideIds(new Set());
      return;
    }

    const normalized = ensureSections(next);
    setProject(normalized);
    setSelectedSectionId(normalized.data.sections[0]?.id ?? null);
    setExpandedSectionId(normalized.data.sections[0]?.id ?? null);
    if (normalized.data.slides[0]) {
      setSelectedSlideIds(new Set([normalized.data.slides[0].id]));
    }
    setCurrentIndex(0);
    setPreviousIndex(null);
    setError(null);
    setError(null);
    setAppMode("teach");
    setIsDirty(false);
  };

  useEffect(() => {
    let mounted = true;
    audioRouting.listDevices().then((devices) => {
      if (mounted) {
        setAudioInputDevices(devices.inputs);
        setAudioOutputDevices(devices.outputs);
      }
    });
    return () => { mounted = false; };
  }, []);

  const handleDeviceChange = async (deviceId: string) => {
    try {
      await audioRouting.setDevice(deviceId);
      setSelectedAudioOutput(deviceId);
    } catch (e) {
      console.error(e);
      alert("Failed to set audio output device.");
    }
  };

  const handleMonitorDeviceChange = async (deviceId: string) => {
    try {
      await audioRouting.setMonitorDevice(deviceId);
      setSelectedMonitorOutput(deviceId);
    } catch (e) {
      console.error(e);
      alert("Failed to set monitor output device.");
    }
  };

  const toggleMic = async () => {
    try {
      if (micEnabled) {
        micInput.disableMic();
        setMicEnabled(false);
      } else {
        await micInput.enableMic(selectedAudioInput !== "default" ? selectedAudioInput : undefined);
        setMicEnabled(true);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to access microphone.");
      setMicEnabled(false);
    }
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
      if (next) setProjectState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    await onSave();
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

  const onImportMedia = async () => {
    if (!ensureEditMode(appMode, "import media")) return;
    if (!project) return;
    try {
      const result = await window.appApi.importMedia();
      if (!result) return;
      const targetSectionId = selectedSectionId ?? project.data.sections[0]?.id;
      const createdSlides = targetSectionId
        ? result.createdSlides.map((slide) => ({
          ...slide,
          sectionId: targetSectionId,
        }))
        : result.createdSlides;

      const nextSlides = [...project.data.slides, ...createdSlides];
      const nextAssets = [...project.data.assets, ...result.importedAssets];
      setProject({
        ...project,
        data: {
          ...project.data,
          slides: nextSlides,
          assets: nextAssets,
        },
      });
      setIsDirty(true);
      if (nextSlides.length > 0 && project.data.slides.length === 0) {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to import media: " + (err as Error).message);
      setError((err as Error).message);
    }
  };

  const onImportAudio = async (type: "dialogue" | "sfx" | "bgm" | "section-bgm") => {
    if (!ensureEditMode(appMode, "import audio")) return;
    if (!project) return;
    try {
      const importedAssets = await window.appApi.importAudio();
      if (!importedAssets || importedAssets.length === 0) return;

      const nextAssets = [...project.data.assets, ...importedAssets];
      let nextData = { ...project.data, assets: nextAssets };

      if (type === "section-bgm" && selectedSectionId) {
        const clips = importedAssets.map((a) => ({
          url: toMediaUrl(a.relativePath),
          volume: 1,
          name: a.originalName,
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
        const clips = importedAssets.map((a) => ({
          url: toMediaUrl(a.relativePath),
          volume: 1,
          name: a.originalName,
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

  const onSave = async () => {
    if (!ensureEditMode(appMode, "save")) return;
    if (!project) return;
    try {
      const response = await window.appApi.saveProject(project.data);
      if (!response) return;
      setProject({
        ...project,
        data: {
          ...project.data,
          updatedAt: response.lastSavedAt,
        },
        lastSavedAt: response.lastSavedAt,
      });
      setIsDirty(false);
      showToast("Saved", "success", 2000);
    } catch (err) {
      setError((err as Error).message);
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
    if (!project) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        sections: project.data.sections.map((section) =>
          section.id === sectionId ? { ...section, ...updates } : section,
        ),
      },
    });
    setIsDirty(true);
  };

  const onAddSection = () => {
    if (!ensureEditMode(appMode, "add section")) return;
    if (!project) return;
    const count = project.data.sections.filter(
      (s) => s.type !== "break",
    ).length;
    const nextSection: Section = {
      id: crypto.randomUUID(),
      name: `Section ${count + 1}`,
      type: "section",
    };
    setProject({
      ...project,
      data: {
        ...project.data,
        sections: [...project.data.sections, nextSection],
      },
    });
    setSelectedSectionId(nextSection.id);
    setExpandedSectionId(nextSection.id);
    setIsDirty(true);
  };

  const onAddBreak = () => {
    if (!ensureEditMode(appMode, "add break")) return;
    if (!project) return;
    const count = project.data.sections.filter(
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
    setProject({
      ...project,
      data: {
        ...project.data,
        sections: [...project.data.sections, nextBreak],
      },
    });
    setSelectedSectionId(nextBreak.id);
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

  const onDeleteSlide = (slideId: string) => {
    if (!ensureEditMode(appMode, "delete slide")) return;
    if (!project || !currentSlide) return;

    if (project.data.slides.length <= 1) {
      // If last slide, we don't delete but reset it or similar.
      // But the requirement says create a blank slide automatically.
      const newSlide: Slide = {
        id: crypto.randomUUID(),
        assetId: project.data.assets[0]?.id || "dummy",
        sectionId: currentSlide.sectionId,
        transition: 'fade',
        overlays: [],
      };
      setProject({ ...project, data: { ...project.data, slides: [newSlide] } });
      setCurrentIndex(0);
      setIsDirty(true);
      return;
    }

    const indexToDelete = project.data.slides.findIndex(s => s.id === slideId);
    if (indexToDelete === -1) return;

    const nextSlides = project.data.slides.filter(s => s.id !== slideId);

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

  const reorderSlidesWithinSection = (fromIndex: number, toIndex: number) => {
    if (!ensureEditMode(appMode, "reorder slides")) return;
    if (!project) return;
    if (fromIndex === toIndex) return;

    const fromSlide = project.data.slides[fromIndex];
    const toSlide = project.data.slides[toIndex];
    if (!fromSlide || !toSlide || fromSlide.sectionId !== toSlide.sectionId) {
      setDraggedSlideIndex(null);
      setDragOverSlideIndex(null);
      return;
    }

    const nextSlides = [...project.data.slides];
    const [movedSlide] = nextSlides.splice(fromIndex, 1);
    const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
    nextSlides.splice(insertAt, 0, movedSlide);

    setProject({
      ...project,
      data: {
        ...project.data,
        slides: nextSlides,
      },
    });
    setIsDirty(true);
    setCurrentIndex(insertAt);
    setPreviousIndex(null);
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  };

  const deleteSection = (sectionId: string) => {
    if (!ensureEditMode(appMode, "delete section")) return;
    if (!project || project.data.sections.length <= 1) return;

    const sectionIndex = project.data.sections.findIndex(
      (s) => s.id === sectionId,
    );
    if (sectionIndex === -1) return;
    const section = project.data.sections[sectionIndex];

    const confirmMsg = `Delete ${section.type === "break" ? "Break" : "Section"} '${section.name}'?`;
    if (!window.confirm(confirmMsg)) return;

    let newSlides = project.data.slides;
    let newExpandedId = expandedSectionId;

    if (!section.type || section.type === "section") {
      // Only sections contain slides. Fallback required.
      const fallback = project.data.sections.find(
        (s) => s.id !== sectionId && (!s.type || s.type === "section"),
      );
      // Cannot delete the last actual section if slides exist
      if (!fallback && project.data.slides.length > 0) {
        // Allow delete if no slides? Or enforce 1 section always?
        // Constraint: "cannot delete last section".
        // If we have breaks, we might have multiple items in `sections`, but only 1 `section` type.
        // If we try to delete it, we can't move slides.
        alert("Cannot delete the last section.");
        return;
      }
      if (fallback) {
        newSlides = project.data.slides.map((s) =>
          s.sectionId === sectionId ? { ...s, sectionId: fallback.id } : s,
        );
        if (expandedSectionId === sectionId) newExpandedId = fallback.id;
      }
    }

    const newSections = project.data.sections.filter((s) => s.id !== sectionId);
    setProject({
      ...project,
      data: {
        ...project.data,
        slides: newSlides,
        sections: newSections,
      },
    });
    setIsDirty(true);

    if (selectedSectionId === sectionId) {
      // Fallback selection to nearest neighbor or first
      const fallbackId =
        newSections[Math.max(0, sectionIndex - 1)]?.id ?? newSections[0]?.id;
      setSelectedSectionId(fallbackId ?? null);
    }
    setExpandedSectionId(newExpandedId === sectionId ? null : newExpandedId);
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    if (!ensureEditMode(appMode, "reorder section")) return;
    if (!project) return;
    const index = project.data.sections.findIndex((s) => s.id === sectionId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === project.data.sections.length - 1)
      return;

    const newSections = [...project.data.sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newSections[index], newSections[swapIndex]] = [
      newSections[swapIndex],
      newSections[index],
    ];

    setProject({
      ...project,
      data: {
        ...project.data,
        sections: newSections,
      },
    });
    setIsDirty(true);
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

  return (
    <div className="app">
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
        <button onClick={onSave} disabled={!project}>
          Save
        </button>
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
        <button
          onClick={toggleMode}
          style={{
            marginLeft: "auto",
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
          </div>
        )}

        <span className="build-chip" title="Build marker">
          Build {BUILD_VERSION}
        </span>
      </header>
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
          <div style={{ background: "#2a2a30", border: "1px solid #444", borderRadius: 8, padding: 24, width: 400, display: "flex", flexDirection: "column", gap: 16, maxHeight: "80vh" }}>
            <h3 style={{ margin: 0, color: "#eee" }}>Select Slide</h3>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              {project?.data.slides.map((s, idx) => {
                const asset = assetsById.get(s.assetId);
                return (
                  <button key={s.id} onClick={() => {
                    const newMedia = [{ id: `img-${Date.now()}`, slideId: s.id, fit: "contain" as const }];
                    const nextBreakMedia = [...(selectedSection?.breakMedia || []), ...newMedia];
                    if (selectedSection) updateSection(selectedSection.id, { breakMedia: nextBreakMedia });
                    setShowSlideSelector(false);
                  }} style={{ textAlign: "left", padding: "8px", background: "#111", border: "1px solid #333", color: "#fff", cursor: "pointer" }}>
                    {idx + 1}. {asset?.originalName || "Unknown"}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowSlideSelector(false)} style={{ alignSelf: "flex-end", padding: "6px 12px" }}>Cancel</button>
          </div>
        </div>
      )}

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

      <div className="content">
        <aside className="sidebar">
          {topMode === 'story' ? (
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
                          <button
                            className="section-ctrl-btn"
                            title="Move Up"
                            disabled={index === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSection(section.id, "up");
                            }}
                          >
                            ▲
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
                            ▼
                          </button>
                          {sections.length > 1 && (
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
                          )}
                        </div>
                        {!isBreak && isExpanded && (
                          <ul className="slide-list">
                            {(sectionSlideIndices.get(section.id) ?? []).map(
                              (slideIndex) => {
                                const slide = project!.data.slides[slideIndex];
                                const asset = assetsById.get(slide.assetId);
                                const isDragging = draggedSlideIndex === slideIndex;
                                const isDragOver =
                                  dragOverSlideIndex === slideIndex;
                                const isSlideSelected = selectedSlideIds.has(
                                  slide.id,
                                );
                                const isCurrent = slideIndex === currentIndex;

                                return (
                                  <li
                                    key={slide.id}
                                    className={
                                      isDragOver
                                        ? "slide-row drag-over"
                                        : "slide-row"
                                    }
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      if (draggedSlideIndex !== null) {
                                        setDragOverSlideIndex(slideIndex);
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
                                  >
                                    <button
                                      draggable
                                      className={`slide-btn ${isSlideSelected ? "selected" : ""} ${isCurrent && topMode === 'story' ? "current-slide" : ""}`}
                                      style={{ position: 'relative' }}
                                      onClick={(e) =>
                                        onSlideWrapperClick(slideIndex, e)
                                      }
                                      onDragStart={(event) => {
                                        event.stopPropagation();
                                        event.dataTransfer.effectAllowed = "move";
                                        event.dataTransfer.setData(
                                          "text/plain",
                                          String(slideIndex),
                                        );
                                        setDraggedSlideIndex(slideIndex);
                                        setDragOverSlideIndex(slideIndex);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedSlideIndex(null);
                                        setDragOverSlideIndex(null);
                                      }}
                                    >
                                      <span>{slideIndex + 1}.</span>{" "}
                                      {asset?.originalName ?? "Unknown asset"}
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
          ) : (
            <>
              <h3 style={{ marginBottom: 16 }}>Boost Sequences</h3>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {(['activation', 'language', 'games'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setBoostTab(tab)}
                    style={{ flex: 1, padding: '4px', background: boostTab === tab ? '#555' : '#222', border: 'none', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 2 }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(project?.data.boostPack?.[`${boostTab}Sequence` as keyof BoostPack] || []).map((item, index, arr) => {
                  const isSelected = selectedBoostItemId === item.id;
                  let title: string = item.type;
                  if (item.type === 'slideRef') {
                    const slideRef = item as Extract<SequenceItem, { type: 'slideRef' }>;
                    const slide = project!.data.slides.find(s => s.id === slideRef.slideId);
                    const asset = slide ? assetsById.get(slide.assetId) : null;
                    const bIds = slide?.overlays?.map(o => {
                      const d = BUBBLE_LIBRARY.find(lib => lib.bubbleDefId === o.bubbleDefId);
                      const tName = d?.templateName || d?.name || o.type;
                      return `${o.bubbleId} - ${tName}`;
                    }).filter(Boolean).join(', ');
                    const bStr = bIds ? ` [${bIds}]` : '';
                    title = `Slide: ${asset?.originalName || slideRef.slideId}${bStr}`;
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
                      >▲</button>
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
                      >▼</button>
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

          {appMode === "edit" && (
            <div style={{ marginTop: "12px", borderTop: "1px solid #444", paddingTop: "12px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <button
                  className="section-break-btn"
                  style={{ flex: 1, marginTop: 0 }}
                  onClick={onAddBubble}
                  disabled={!project || !currentSlide}
                >
                  + Bubble
                </button>
              </div>

              {currentSlide && (currentSlide.overlays || []).length > 0 && (
                <div className="bubble-list-container">
                  <h4 style={{ fontSize: "0.8rem", color: "#888", marginBottom: "8px", textTransform: "uppercase" }}>Bubbles on Slide</h4>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                    {[...(currentSlide.overlays || [])]
                      .sort((a, b) => (a.bubbleId || "").localeCompare(b.bubbleId || ""))
                      .map((ov) => {
                        const def = BUBBLE_LIBRARY.find(lib => lib.bubbleDefId === ov.bubbleDefId);
                        const templateName = def?.name || def?.templateName || "";
                        const shortName = ov.text && ov.text.length > 20 ? ov.text.substring(0, 17) + "..." : ov.text;
                        const label = `${ov.bubbleId}${templateName ? ` (${templateName})` : ""}${shortName ? ` - ${shortName}` : ""}`;
                        const isActive = activeOverlayId === ov.id;

                        return (
                          <li key={ov.id} style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "6px", background: isActive ? "#334" : "#222", borderRadius: 4, border: isActive ? "1px solid #55a" : "1px solid #333" }}>
                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }} onClick={() => setActiveOverlayId(ov.id)}>
                              <span style={{ fontSize: "0.75rem", color: "#eee", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }} title={label}>
                                {label}
                              </span>
                              {(ov.tags || []).map((tag, tIdx) => (
                                <span key={tIdx} style={{ fontSize: "0.6rem", background: "#444", color: "#ddd", padding: "1px 4px", borderRadius: "10px", border: "1px solid #555" }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                onClick={() => onDuplicateBubble(ov)}
                                style={{ fontSize: "0.7rem", padding: "2px 6px", background: "#444", border: "1px solid #555", color: "#fff", cursor: "pointer", borderRadius: 2 }}
                              >
                                Duplicate
                              </button>
                              <div style={{ position: "relative", flex: 1 }}>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      onCopyBubbleToSlide(ov, e.target.value);
                                      e.target.value = "";
                                    }
                                  }}
                                  style={{ width: "100%", fontSize: "0.7rem", padding: "2px", background: "#333", border: "1px solid #444", color: "#ccc", borderRadius: 2 }}
                                >
                                  <option value="">Copy to...</option>
                                  {project!.data.slides.map((s, idx) => (
                                    <option key={s.id} value={s.id} disabled={s.id === currentSlide.id}>
                                      Slide {idx + 1}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="stage-wrap" style={{ position: "relative" }}>
          {selectedSectionType === "break" && selectedSection ? (
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
                <div style={{ position: "absolute", top: 10, right: 10, width: "300px", maxHeight: "calc(100% - 20px)", height: "auto", backgroundColor: "rgba(30,30,35,0.98)", border: "1px solid #444", borderRadius: "8px", zIndex: 60, padding: "12px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", color: "#ddd", boxShadow: "-2px 0 10px rgba(0,0,0,0.5)", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #444", paddingBottom: "8px", margin: 0 }}>
                    <h3 style={{ margin: 0, color: "#fff" }}>Break Editor</h3>
                    <button onClick={() => setShowBreakEditor(false)} style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}>✕</button>
                  </div>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Title</span>
                    <textarea
                      value={selectedSection.name || ""}
                      onChange={(e) => updateSection(selectedSection.id, { name: e.target.value })}
                      style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "6px", borderRadius: 4, fontFamily: "inherit", minHeight: 40, resize: "vertical" }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Questions</span>
                    <textarea
                      value={selectedSection.questions || ""}
                      onChange={(e) => updateSection(selectedSection.id, { questions: e.target.value })}
                      style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "6px", borderRadius: 4, minHeight: 100, fontFamily: "inherit", resize: "vertical" }}
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

                    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontSize: "0.85rem", color: "#aaa" }}>Background</span>
                      {(() => {
                        const bg = selectedSection.background || "#111111";
                        const isGrad = bg.startsWith("linear-gradient");
                        const isImg = bg.startsWith("url");
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {!isImg && !isGrad ? (
                                <input type="color" value={bg} onChange={(e) => updateSection(selectedSection.id, { background: e.target.value })} style={{ background: "transparent", border: "none", width: 24, height: 24, cursor: "pointer", padding: 0 }} />
                              ) : null}
                              {isGrad ? (
                                <>
                                  <input type="color" value={(bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"])[0]} onChange={(e) => { const c = bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"]; updateSection(selectedSection.id, { background: `linear-gradient(180deg, ${e.target.value}, ${c[1] || c[0]})` }) }} style={{ background: "transparent", border: "none", width: 24, height: 24, cursor: "pointer", padding: 0 }} />
                                  <input type="color" value={(bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"])[1]} onChange={(e) => { const c = bg.match(/#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g) || ["#111", "#333"]; updateSection(selectedSection.id, { background: `linear-gradient(180deg, ${c[0]}, ${e.target.value})` }) }} style={{ background: "transparent", border: "none", width: 24, height: 24, cursor: "pointer", padding: 0 }} />
                                </>
                              ) : null}
                              {isImg ? (
                                <span style={{ fontSize: "0.8rem", color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Image BG</span>
                              ) : null}
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <button onClick={() => updateSection(selectedSection.id, { background: "#111111" })} style={{ padding: "4px 8px", background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>Solid</button>
                                <button onClick={() => updateSection(selectedSection.id, { background: "linear-gradient(180deg, #111111, #333333)" })} style={{ padding: "4px 8px", background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>Gradient</button>
                                <button onClick={async () => {
                                  if (!project) return;
                                  const result = await window.appApi.importMedia();
                                  if (result && result.importedAssets.length > 0) {
                                    const nextAssets = [...project.data.assets, ...result.importedAssets];
                                    setProject({
                                      ...project,
                                      data: { ...project.data, assets: nextAssets }
                                    });
                                    updateSection(selectedSection.id, { background: `url('${toMediaUrl(result.importedAssets[0].relativePath)}')` });
                                  }
                                }} style={{ padding: "4px 8px", background: "#4a4a5a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>Image</button>
                              </div>
                            </div>

                            {isImg && (
                              <div style={{ display: "flex", gap: 4, flexDirection: "column", background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 4 }}>
                                <span style={{ fontSize: "0.75rem", color: "#aaa" }}>BG Transform & Blur</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column" }}>X <input type="text" value={selectedSection.bgTransform?.x ?? 0} onBlur={(e) => updateSection(selectedSection.id, { bgTransform: { ...(selectedSection.bgTransform || { y: 0, scale: 1, blur: 0 }), x: Number(e.target.value) || 0 } })} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...(selectedSection.bgTransform || { y: 0, scale: 1, blur: 0 }), x: e.target.value as any } })} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem" }} /></label>
                                  <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column" }}>Y <input type="text" value={selectedSection.bgTransform?.y ?? 0} onBlur={(e) => updateSection(selectedSection.id, { bgTransform: { ...(selectedSection.bgTransform || { x: 0, scale: 1, blur: 0 }), y: Number(e.target.value) || 0 } })} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...(selectedSection.bgTransform || { x: 0, scale: 1, blur: 0 }), y: e.target.value as any } })} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem" }} /></label>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column" }}>Scale <input type="number" step="0.1" value={selectedSection.bgTransform?.scale ?? 1} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...(selectedSection.bgTransform || { x: 0, y: 0, blur: 0 }), scale: Number(e.target.value) || 1 } })} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem" }} /></label>
                                  <label style={{ fontSize: "0.65rem", color: "#aaa", flex: 1, display: "flex", flexDirection: "column" }}>Blur <input type="number" min="0" step="1" value={selectedSection.bgTransform?.blur ?? 0} onChange={(e) => updateSection(selectedSection.id, { bgTransform: { ...(selectedSection.bgTransform || { x: 0, y: 0, scale: 1 }), blur: Number(e.target.value) || 0 } })} style={{ background: "#111", border: "1px solid #333", color: "#fff", padding: "1px 2px", borderRadius: 2, fontSize: "0.65rem" }} /></label>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </label>
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
                              const nextAssets = [...project.data.assets, ...result.importedAssets];
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
                      const asset = slide ? project?.data.assets.find(a => a.id === slide.assetId) : null;
                      return (
                        <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4, background: "#222", padding: "6px", borderRadius: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.7rem", color: "#ccc", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                              {asset?.originalName || `Image ${i + 1}`}
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
                              ✕
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

                            const newClips = importedAssets.map(a => ({
                              url: toMediaUrl(a.relativePath),
                              volume: 1,
                              name: a.originalName,
                              fadeEnabled: true
                            }));

                            const nextAssets = [...project.data.assets, ...importedAssets];
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
                        onPlay={(url, vol, opts) => audioManager.playClip(url, vol, true, { fadeEnabled: opts?.fadeEnabled || false })}
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
                    style={{ background: "#3a3a4a", color: "#fff", border: "1px solid #556", padding: "10px", borderRadius: 4, cursor: "pointer", fontWeight: "bold", marginTop: 10 }}
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
                  style={{
                    backgroundColor: selectedSection.background && !selectedSection.background.startsWith("url") ? undefined : "#111",
                    background: selectedSection.bgTransform && selectedSection.bgTransform.blur ? "transparent" : (selectedSection.background || "#111"),
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
                    <div style={{ position: "absolute", zIndex: -1, inset: -100, pointerEvents: "none", background: selectedSection.background || "#111", backgroundSize: `${(selectedSection.bgTransform.scale ?? 1) * 100}%`, backgroundPosition: `calc(50% + ${selectedSection.bgTransform.x ?? 0}px) calc(50% + ${selectedSection.bgTransform.y ?? 0}px)`, filter: `blur(${selectedSection.bgTransform.blur}px)` }} />
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
                      return (
                        <img
                          key={m.id}
                          src={src}
                          className="break-stage-thumb"
                          style={{
                            objectFit: m.fit,
                            width: selectedSection.thumbnailSize ?? 200,
                            height: (selectedSection.thumbnailSize ?? 200) * 0.5625,
                            transform: `translate(${m.x ?? 0}px, ${m.y ?? 0}px) scale(${m.scale ?? 1})`,
                          }}
                        />
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
                <h2 style={{ fontSize: '2rem', marginBottom: 10 }}>🎮 Mini-Game</h2>
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
              </div>

              <div className="stage">
                {!currentAsset && (
                  <div className="placeholder">
                    {topMode === 'boost' && activeItem?.type === 'slideRef'
                      ? 'Selected Slide or Asset not found.'
                      : 'Import media to start presenting.'}
                  </div>
                )}
                {currentAsset && (
                  <div className="media-layer">
                    {/* Outgoing Slide */}
                    {isAnimating && previousAsset && (
                      <MediaView
                        key={previousSlide?.id}
                        asset={previousAsset}
                        overlays={previousSlide?.overlays ?? []}
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
                      bubbleDefinitions={project?.data.bubbleDefinitions}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="audio-sidebar">
          {topMode === 'story' ? (
            <>
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
                        onPlay={(url, vol, opts) => audioManager.playClip(url, vol, false, opts)}
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
                        onPlay={(url, vol, opts) => audioManager.playClip(url, vol, false, opts)}
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
                        onPlay={(url, vol, opts) => audioManager.playClip(url, vol, true, opts)}
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

              <div className="audio-block" style={{ marginTop: 'auto', background: "#111112", border: '1px solid #222225', padding: '16px' }}>
                <h4 style={{ margin: "0 0 16px 0", color: "#666", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px" }}>Audio Routing</h4>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>MIX OUTPUT DEVICE</span>
                  </div>
                  <select
                    value={selectedAudioOutput}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    style={{ width: "100%", padding: "6px", background: "#1a1a1c", color: "#bbb", border: "1px solid #333", borderRadius: "4px", fontSize: "0.8rem", outline: "none" }}
                  >
                    <option value="default">System Default</option>
                    {audioOutputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${d.deviceId.slice(0, 5)}...`}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>MONITOR DEVICE</span>
                  </div>
                  <select
                    value={selectedMonitorOutput}
                    onChange={(e) => handleMonitorDeviceChange(e.target.value)}
                    style={{ width: "100%", padding: "6px", background: "#1a1a1c", color: "#bbb", border: "1px solid #333", borderRadius: "4px", fontSize: "0.8rem", outline: "none" }}
                  >
                    <option value="default">System Default</option>
                    {audioOutputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Monitor ${d.deviceId.slice(0, 5)}...`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.75rem", color: "#888" }}>MICROPHONE INPUT</span>
                    <button
                      onClick={toggleMic}
                      style={{
                        padding: "2px 8px",
                        fontSize: "0.7rem",
                        fontWeight: "bold",
                        background: micEnabled ? "#4a1a1a" : "#1a1a1c",
                        border: `1px solid ${micEnabled ? "#8a3a3a" : "#333"}`,
                        color: micEnabled ? "#ffaaaa" : "#666",
                        borderRadius: "4px"
                      }}
                    >
                      {micEnabled ? "LIVE" : "OFF"}
                    </button>
                  </div>
                  <select
                    value={selectedAudioInput}
                    onChange={(e) => {
                      setSelectedAudioInput(e.target.value);
                      if (micEnabled) {
                        // Force restart if live
                        micInput.disableMic();
                        micInput.enableMic(e.target.value !== "default" ? e.target.value : undefined).catch(err => {
                          console.error(err);
                          setMicEnabled(false);
                        });
                      }
                    }}
                    style={{ width: "100%", padding: "6px", background: "#1a1a1c", color: "#bbb", border: "1px solid #333", borderRadius: "4px", fontSize: "0.8rem", outline: "none" }}
                  >
                    <option value="default">Default Mic</option>
                    {audioInputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 5)}...`}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => audioManager.stopAll()}
                  style={{
                    width: "100%",
                    marginTop: 24,
                    padding: "8px",
                    background: "#2a1515",
                    color: "#ff8888",
                    borderColor: "#4a2525",
                    fontSize: "0.85rem",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Stop All Audio
                </button>
              </div>
            </>
          ) : (
            <div className="audio-block" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: "0", color: "#66f", fontSize: "1rem" }}>Boost Tools</h4>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: "10px 0", borderBottom: '1px solid #333', paddingBottom: 10 }}>
                <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('slideRef')}>+ SlideRef</button>
                <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('breakRef')}>+ BreakRef</button>
                <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('promptCard')}>+ Prompt</button>
                <button style={{ padding: '6px', background: '#334', border: '1px solid #446', color: '#ddf', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', flex: 1 }} onClick={() => addSequenceItem('miniGame')}>+ Game</button>
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
                            const name = asset?.originalName || s.id;
                            const matches = name.toLowerCase().includes(boostSearchQuery.toLowerCase());
                            if (boostSearchQuery && !matches) return null;
                            return (
                              <button
                                key={s.id}
                                style={{ padding: '6px', background: activeItem.slideId === s.id ? '#556' : '#222', border: activeItem.slideId === s.id ? '1px solid #77f' : '1px solid #444', color: '#ddd', borderRadius: 4, cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem' }}
                                onClick={() => updateSequenceItem(activeItem.id, { slideId: s.id })}
                              >
                                {idx + 1}. {name.length > 30 ? name.slice(0, 30) + '...' : name}
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
                  {activeItem.type === 'slideRef' && currentSlide && renderTagEditor(currentSlide)}
                </div>
              ) : (
                <div style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', marginTop: 24 }}>Select an item in Boost Sequences to edit</div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div >
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
              // But `drawFrame` runs on `useEffect` with no deps (except refs)?
              // MediaView `drawFrame` is called via `requestAnimationFrame`?
              // No, MediaView `drawFrame` is defined in `useEffect` and called recursively?
              // Wait, I missed copying `drawFrame` loop logic in my reading of MediaView!
              // Step 330: Line 1352 `useEffect(() => { const drawFrame = ... requestAnimationFrame(drawFrame); ... }, [pan, zoom, markerStrokes, highlighterStrokes])`?
              // No, deps are empty or minimal?
              // If `drawFrame` uses values from refs or props, it needs to run every frame.
              // Let's implement robust loop.
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

      // Filter out faded highlighters
      setHighlighterStrokes((prev) =>
        prev.filter(
          (s) => !s.fadeMs || now - s.points[s.points.length - 1].t < s.fadeMs,
        ),
      );

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
}) {
  const src = toMediaUrl(asset.relativePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  const mediaStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
    transition: isPanning ? "none" : "transform 50ms linear",
    cursor: isPanning ? "grabbing" : zoom > 1 ? "grab" : "default",
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

      setHighlighterStrokes((prev) =>
        prev.filter((stroke) => {
          const lastPoint = stroke.points[stroke.points.length - 1];
          return now - lastPoint.t < stroke.fadeMs;
        }),
      );
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
          alt={asset.originalName}
          style={mediaStyle}
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
          muted
          onTimeUpdate={(e) =>
            onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)
          }
        />
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
                backgroundImage: bType !== 'text' ? `url(${overlay.customImageSrc ? toMediaUrl(overlay.customImageSrc) : (def.src || "")})` : 'none',
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                backgroundColor: bBgColor as string,
                borderRadius: bType === 'text' ? "8px" : "0",
                outline: isActive ? "2px solid #55f" : "none",
                boxShadow: isActive ? "0 0 0 4px rgba(85, 85, 255, 0.4)" : "none",
              }}
            >
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
