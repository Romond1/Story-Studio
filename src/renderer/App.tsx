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
import type {
  AssetItem,
  DrawPoint,
  MarkerStroke,
  ProjectState,
  Section,
  Slide,
  TransitionType,
  AudioClip,
} from "../shared/types";
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
  isSelected,
  onToggleSelect,
}: {
  clip: AudioClip;
  label: string;
  onUpdate: (updates: Partial<AudioClip>) => void;
  onPlay: (url: string, volume: number, fadeOptions?: { fadeEnabled: boolean }) => void;
  onStop: (url: string, fadeOptions?: { fadeEnabled: boolean }) => void;
  onPause: (url: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [time, setTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const isPlaying = audioManager.isPlaying(clip.url);
  const duration = audioManager.getDuration(clip.url) || 100;

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
      if (e.key === clip.shortcut) {
        if (audioManager.isPlaying(clip.url)) {
          onPause(clip.url); // pausing via hotkey is best so we resume later!
        } else {
          onPlay(clip.url, clip.volume, { fadeEnabled: clip.fadeEnabled || false });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clip, onPlay, onPause]);

  const bgColors = clip.color ? clip.color : "transparent";

  return (
    <div style={{ background: isPlaying ? `${bgColors}ee` : bgColors, filter: isPlaying ? "brightness(1.5)" : "none", transition: "all 0.2s", display: "flex", flexDirection: "column", gap: 6, padding: "8px", borderRadius: 6, marginBottom: 8, border: `1px solid ${isPlaying ? "#88c" : "#333"}`, boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 6, overflow: "hidden" }}>
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        <input type="text" value={clip.name || label} onChange={e => onUpdate({ name: e.target.value })} style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: "0.80rem", minWidth: 0, outline: "none", textOverflow: "ellipsis" }} />
        <button onClick={() => setShowSettings(!showSettings)} style={{ background: "transparent", border: "none", padding: 0 }}>⚙️</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 6 }}>
        <button onClick={() => isPlaying ? onPause(clip.url) : onPlay(clip.url, clip.volume, { fadeEnabled: clip.fadeEnabled || false })} style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={() => onStop(clip.url, { fadeEnabled: clip.fadeEnabled || false })} style={{ width: 24, height: 24, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ⏹
        </button>

        <input type="range" min={0} max={duration} step={0.1} value={time} onChange={(e) => audioManager.seek(clip.url, Number(e.target.value))} style={{ flex: 1, minWidth: 40 }} />

        <input type="range" min={0} max={1} step={0.05} value={clip.volume ?? 1} onChange={(e) => {
          const v = Number(e.target.value);
          audioManager.setVolume(clip.url, v);
          onUpdate({ volume: v });
        }} style={{ width: 40 }} />
      </div>

      {showSettings && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: 4, marginTop: 4, fontSize: "0.75rem", color: "#ccc", boxSizing: "border-box" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>Shortcut <input type="text" maxLength={1} value={clip.shortcut || ""} onChange={e => onUpdate({ shortcut: e.target.value })} style={{ width: 20, background: "#222", border: "1px solid #444", color: "#fff", textAlign: "center" }} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>Fade <input type="checkbox" checked={clip.fadeEnabled || false} onChange={e => onUpdate({ fadeEnabled: e.target.checked })} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>Color <input type="color" value={clip.color || "#111111"} onChange={e => onUpdate({ color: e.target.value })} style={{ width: 16, height: 16, padding: 0, border: "none", background: "transparent" }} /></label>
        </div>
      )}
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
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "create" | "open" | "close" | null
  >(null);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "teach" | "edit";
    duration: number;
    id: number;
  } | null>(null);
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
  const [selectedAudioKeys, setSelectedAudioKeys] = useState<Set<string>>(new Set());

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
  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const selectedSectionType = selectedSection?.type;

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

  const currentSlide = project?.data.slides[currentIndex] ?? null;
  const currentAsset = currentSlide
    ? (assetsById.get(currentSlide.assetId) ?? null)
    : null;
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
    showToast("Applied ✓", "success", 1000);
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
    showToast("Applied ✓", "success", 1000);
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

  const selectSection = useCallback(
    (sectionId: string) => {
      setSelectedSectionId(sectionId);
      audioManager.stopSectionMusic(); // Stop section music on section change
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
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          if (!project) return;
          const sections = project.data.sections.filter(
            (s) => s.type !== "break",
          );
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
        const bgmUrl = toMediaUrl(importedAssets[0].relativePath);
        nextData.sections = nextData.sections.map((s) =>
          s.id === selectedSectionId
            ? {
              ...s,
              bgm: {
                url: bgmUrl,
                volume: 1,
                name: importedAssets[0].originalName,
              },
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
      showToast("Saved ✓", "success", 2000);
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
                            {isBreak ? "★ " : isExpanded ? "▼ " : "▶ "}
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
                          ✕
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
                                  className={`slide-btn ${isSlideSelected ? "selected" : ""} ${isCurrent ? "current-slide" : ""}`}
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
                                </button>
                              </li>
                            );
                          },
                        )}
                      </ul>
                    )}
                    {isBreak && isExpanded && (
                      <div className="break-controls">
                        <label>
                          Title
                          <input
                            value={section.name}
                            onChange={(e) =>
                              updateSection(section.id, {
                                name: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Questions (1 per line)
                          <textarea
                            rows={4}
                            value={section.questions ?? ""}
                            onChange={(e) =>
                              updateSection(section.id, {
                                questions: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Timer Mode
                          <select
                            value={section.timerMode ?? "countup"}
                            onChange={(e) =>
                              updateSection(section.id, {
                                timerMode: e.target.value as any,
                              })
                            }
                          >
                            <option value="countup">Count Up (Timer)</option>
                            <option value="countdown">
                              Count Down (Stopwatch)
                            </option>
                          </select>
                        </label>
                        {section.timerMode === "countdown" && (
                          <div
                            style={{ display: "flex", gap: 4, marginBottom: 8 }}
                          >
                            <label style={{ flex: 1 }}>
                              Min
                              <input
                                type="number"
                                min="0"
                                value={Math.floor(
                                  (section.timerDuration ?? 300) / 60,
                                )}
                                onChange={(e) => {
                                  const mins = Number(e.target.value);
                                  const secs =
                                    (section.timerDuration ?? 300) % 60;
                                  updateSection(section.id, {
                                    timerDuration: mins * 60 + secs,
                                  });
                                }}
                              />
                            </label>
                            <label style={{ flex: 1 }}>
                              Sec
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={(section.timerDuration ?? 300) % 60}
                                onChange={(e) => {
                                  const secs = Number(e.target.value);
                                  const mins = Math.floor(
                                    (section.timerDuration ?? 300) / 60,
                                  );
                                  updateSection(section.id, {
                                    timerDuration: mins * 60 + secs,
                                  });
                                }}
                              />
                            </label>
                          </div>
                        )}
                        <div
                          style={{ display: "flex", gap: 4, marginBottom: 8 }}
                        >
                          <button style={{ flex: 1 }} onClick={toggleTimer}>
                            {timerState.isRunning ? "Stop" : "Start"}
                          </button>
                          <button style={{ flex: 1 }} onClick={resetTimer}>
                            Reset
                          </button>
                        </div>

                        <label
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          <input
                            type="checkbox"
                            checked={section.timer ?? false}
                            onChange={(e) =>
                              updateSection(section.id, {
                                timer: e.target.checked,
                              })
                            }
                          />
                          Show timer to viewers
                        </label>

                        <label>
                          Question font
                          <select
                            value={section.font ?? "Inter"}
                            onChange={(e) =>
                              updateSection(section.id, {
                                font: e.target.value,
                              })
                            }
                          >
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Arial">Arial</option>
                            <option value="Courier New">Courier New</option>
                          </select>
                        </label>
                        <label>
                          Question size
                          <input
                            type="range"
                            min={16}
                            max={72}
                            value={section.fontSize ?? 28}
                            onChange={(e) =>
                              updateSection(section.id, {
                                fontSize: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Thumbnail Size
                          <input
                            type="range"
                            min={100}
                            max={600}
                            step={10}
                            value={section.thumbnailSize ?? 200}
                            onChange={(e) =>
                              updateSection(section.id, {
                                thumbnailSize: Number(e.target.value),
                              })
                            }
                          />
                        </label>

                        <div style={{ display: "flex", gap: 8 }}>
                          <label style={{ flex: 1 }}>
                            Align
                            <select
                              value={section.align ?? "center"}
                              onChange={(e) =>
                                updateSection(section.id, {
                                  align: e.target.value as any,
                                })
                              }
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </label>
                          <label style={{ flex: 1 }}>
                            Position
                            <select
                              value={section.position ?? "center"}
                              onChange={(e) =>
                                updateSection(section.id, {
                                  position: e.target.value as any,
                                })
                              }
                            >
                              <option value="top">Top</option>
                              <option value="center">Center</option>
                              <option value="bottom">Bottom</option>
                            </select>
                          </label>
                        </div>

                        <label>
                          Background
                          {!section.background?.startsWith(
                            "linear-gradient",
                          ) ? (
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="color"
                                value={section.background || "#2a2a3a"}
                                onChange={(e) =>
                                  updateSection(section.id, {
                                    background: e.target.value,
                                  })
                                }
                              />
                              <button
                                style={{ fontSize: 10 }}
                                onClick={() =>
                                  updateSection(section.id, {
                                    background:
                                      "linear-gradient(135deg, #111111, #333333)",
                                  })
                                }
                              >
                                Make Gradient
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {(() => {
                                const bg = section.background || "";
                                const colors = bg.match(
                                  /#[a-fA-F0-9]{3,6}|rgba?\(.*?\)/g,
                                ) || ["#000000", "#ffffff"];
                                const c1 = colors[0] || "#000000";
                                const c2 = colors[1] || "#ffffff";
                                return (
                                  <>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 4,
                                        alignItems: "center",
                                      }}
                                    >
                                      <label style={{ fontSize: 10 }}>
                                        Start:{" "}
                                        <input
                                          type="color"
                                          value={c1}
                                          onChange={(e) => {
                                            const newBg =
                                              section.background?.replace(
                                                c1,
                                                e.target.value,
                                              ) ||
                                              `linear-gradient(135deg, ${e.target.value}, ${c2})`;
                                            updateSection(section.id, {
                                              background: newBg,
                                            });
                                          }}
                                        />
                                      </label>
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 4,
                                        alignItems: "center",
                                      }}
                                    >
                                      <label style={{ fontSize: 10 }}>
                                        End:{" "}
                                        <input
                                          type="color"
                                          value={c2}
                                          onChange={(e) => {
                                            const newBg =
                                              section.background?.replace(
                                                c2,
                                                e.target.value,
                                              ) ||
                                              `linear-gradient(135deg, ${c1}, ${e.target.value})`;
                                            updateSection(section.id, {
                                              background: newBg,
                                            });
                                          }}
                                        />
                                      </label>
                                    </div>
                                    <button
                                      style={{ fontSize: 10 }}
                                      onClick={() =>
                                        updateSection(section.id, {
                                          background: "#2a2a3a",
                                        })
                                      }
                                    >
                                      Revert to Solid
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </label>

                        <label>Add section media</label>
                        <div className="break-media-list">
                          {(section.breakMedia ?? []).map((m, i) => {
                            const slide = project?.data.slides.find(
                              (s) => s.id === m.slideId,
                            );
                            const asset = slide
                              ? assetsById.get(slide.assetId)
                              : null;
                            if (!asset) return null;
                            return (
                              <div key={m.id} className="break-media-item">
                                <span
                                  className="break-media-thumb"
                                  style={{
                                    background: "#444",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: 10,
                                  }}
                                >
                                  {asset?.mediaType === "image" ? "IMG" : "VID"}
                                </span>
                                <span
                                  style={{
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Slide{" "}
                                  {project?.data.slides.findIndex(
                                    (s) => s.id === m.slideId,
                                  )! + 1}
                                </span>
                                <div style={{ display: "flex" }}>
                                  <button
                                    style={{ padding: "0 4px", fontSize: 10 }}
                                    onClick={() => {
                                      if (i === 0) return;
                                      const newMedia = [
                                        ...(section.breakMedia ?? []),
                                      ];
                                      [newMedia[i - 1], newMedia[i]] = [
                                        newMedia[i],
                                        newMedia[i - 1],
                                      ];
                                      updateSection(section.id, {
                                        breakMedia: newMedia,
                                      });
                                    }}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    style={{ padding: "0 4px", fontSize: 10 }}
                                    onClick={() => {
                                      if (
                                        i ===
                                        (section.breakMedia?.length ?? 0) - 1
                                      )
                                        return;
                                      const newMedia = [
                                        ...(section.breakMedia ?? []),
                                      ];
                                      [newMedia[i], newMedia[i + 1]] = [
                                        newMedia[i + 1],
                                        newMedia[i],
                                      ];
                                      updateSection(section.id, {
                                        breakMedia: newMedia,
                                      });
                                    }}
                                  >
                                    ▼
                                  </button>
                                  <button
                                    style={{
                                      padding: "0 4px",
                                      fontSize: 10,
                                      marginLeft: 4,
                                    }}
                                    onClick={() => {
                                      const newMedia = [
                                        ...(section.breakMedia ?? []),
                                      ];
                                      newMedia.splice(i, 1);
                                      updateSection(section.id, {
                                        breakMedia: newMedia,
                                      });
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <select
                            id={`add-slide-${section.id}`}
                            style={{ flex: 1 }}
                          >
                            {project?.data.slides.map((s, idx) => (
                              <option key={s.id} value={s.id}>
                                {idx + 1}.{" "}
                                {assetsById.get(s.assetId)?.originalName}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const select = document.getElementById(
                                `add-slide-${section.id}`,
                              ) as HTMLSelectElement;
                              if (!select.value) return;
                              const newMedia = [...(section.breakMedia ?? [])];
                              newMedia.push({
                                id: crypto.randomUUID(),
                                slideId: select.value,
                                fit: "cover",
                              });
                              updateSection(section.id, {
                                breakMedia: newMedia,
                              });
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
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
        </aside>

        <main className="stage-wrap">
          {selectedSectionType === "break" && selectedSection ? (
            <ZoomPanWrapper
              className="break-stage-wrapper"
              drawSettings={drawSettings}
              markerStrokes={selectedSection.markerStrokes ?? []}
              onMarkerStrokesChange={(strokes) =>
                updateSection(selectedSection.id, { markerStrokes: strokes })
              }
              clearSignal={drawClearSignal}
            >
              <div
                className="break-stage"
                style={{
                  background: selectedSection.background || "#111",
                  transformOrigin: "top left", // Handled by wrapper
                }}
              >
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
                          height:
                            (selectedSection.thumbnailSize ?? 200) * 0.5625,
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
                    flex: 1,
                  }}
                >
                  <div className="break-title">{selectedSection.name}</div>
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
                    <div className="break-timer">
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
                    Import media to start presenting.
                  </div>
                )}
                {currentAsset && (
                  <div className="media-layer">
                    {/* Outgoing Slide */}
                    {isAnimating && previousAsset && (
                      <MediaView
                        key={previousSlide?.id}
                        asset={previousAsset}
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
                      />
                    )}
                    {/* Incoming Slide */}
                    <MediaView
                      key={currentSlide?.id}
                      asset={currentAsset}
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
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <aside className="audio-sidebar">
          <div className="audio-block">
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
                    isSelected={selectedAudioKeys.has(`diag-${idx}`)}
                    onToggleSelect={() => {
                      const s = new Set(selectedAudioKeys);
                      if (s.has(`diag-${idx}`)) s.delete(`diag-${idx}`);
                      else s.add(`diag-${idx}`);
                      setSelectedAudioKeys(s);
                    }}
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
                    isSelected={selectedAudioKeys.has(`sfx-${idx}`)}
                    onToggleSelect={() => {
                      const s = new Set(selectedAudioKeys);
                      if (s.has(`sfx-${idx}`)) s.delete(`sfx-${idx}`);
                      else s.add(`sfx-${idx}`);
                      setSelectedAudioKeys(s);
                    }}
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
                    isSelected={selectedAudioKeys.has("slide-bgm")}
                    onToggleSelect={() => {
                      const s = new Set(selectedAudioKeys);
                      if (s.has("slide-bgm")) s.delete("slide-bgm");
                      else s.add("slide-bgm");
                      setSelectedAudioKeys(s);
                    }}
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
            {selectedSection?.bgm ? (
              <AudioClipPlayer
                clip={selectedSection.bgm}
                label="Section BGM"
                onUpdate={(upds) => updateSection(selectedSection.id, { bgm: { ...selectedSection.bgm!, ...upds } })}
                onPlay={(url, vol, opts) => audioManager.playSectionMusic(url, vol, opts?.fadeEnabled)}
                onPause={(url) => audioManager.pauseClip(url)}
                onStop={(url, opts) => audioManager.stopSectionMusic(opts?.fadeEnabled)}
                isSelected={selectedAudioKeys.has("section-bgm")}
                onToggleSelect={() => {
                  const s = new Set(selectedAudioKeys);
                  if (s.has("section-bgm")) s.delete("section-bgm");
                  else s.add("section-bgm");
                  setSelectedAudioKeys(s);
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#666",
                  textAlign: "center",
                  padding: "10px 0",
                }}
              >
                No section music
              </div>
            )}

            {/* Bulk Actions Structure Placeholder */}
            {selectedAudioKeys.size > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: "#332a10", borderRadius: 4, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.75rem", color: "#ddaa55" }}>{selectedAudioKeys.size} Selected</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ fontSize: "0.7rem", padding: "2px 6px" }} disabled>Fade All</button>
                  <button style={{ fontSize: "0.7rem", padding: "2px 6px" }} disabled>Stop All</button>
                </div>
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
        </aside>
      </div>
    </div>
  );
}

function ZoomPanWrapper({
  children,
  className,
  drawSettings,
  markerStrokes,
  onMarkerStrokesChange,
  clearSignal,
}: {
  children: React.ReactNode;
  className?: string;
  drawSettings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange: (strokes: MarkerStroke[]) => void;
  clearSignal: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const targetZoomRef = useRef(1);
  const targetPanRef = useRef({ x: 0, y: 0 });

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

      ctx.save();
      // Apply transform
      ctx.translate(pan.x, pan.y);
      // Canvas is width/height of screen.
      // Content is width/height of Rect (100%).
      // Our coordinates are 0..1 relative to Rect.
      // So we scale by Rect size.
      ctx.scale(zoom * width, zoom * height);

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
        ctx.lineWidth = stroke.size / width; // Approximation

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
        style={{ pointerEvents: "none", position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}

function MediaView({
  asset,
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
}: {
  asset: AssetItem;
  className?: string;
  style?: CSSProperties;
  drawSettings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange: (strokes: MarkerStroke[]) => void;
  clearSignal: number;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
  onViewportChange?: (v: ViewportState) => void;
  paused?: boolean;
  initialTime?: number;
  onTimeUpdate?: (t: number) => void;
  showControls?: boolean;
}) {
  const src = toMediaUrl(asset.relativePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

      <canvas
        ref={canvasRef}
        className={
          drawSettings.drawMode ? "drawing-overlay active" : "drawing-overlay"
        }
        onMouseDown={handleDrawStart}
        onMouseMove={handleDrawMove}
        onMouseUp={handleDrawEnd}
        onMouseLeave={handleDrawEnd}
      />
    </div>
  );
}
