import {
  type CSSProperties,
  type MouseEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { AssetItem, DrawPoint, MarkerStroke, ProjectState, Section, TransitionType } from '../shared/types';
import { BUILD_VERSION } from '../shared/version';

type DrawTool = 'highlighter' | 'marker';

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
  const normalizedRelative = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const encodedRelative = normalizedRelative
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `media://${encodedRelative}`;
}

function ensureSections(project: ProjectState): ProjectState {
  if (project.data.sections.length > 0) {
    return project;
  }

  const fallback: Section = { id: crypto.randomUUID(), name: 'Section 1' };
  return {
    ...project,
    data: {
      ...project.data,
      sections: [fallback],
      slides: project.data.slides.map((slide) => ({ ...slide, sectionId: fallback.id }))
    }
  };
}

export function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);
  const [drawPanelCollapsed, setDrawPanelCollapsed] = useState(false);
  const [drawClearSignal, setDrawClearSignal] = useState(0);
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({
    tool: 'highlighter',
    drawMode: false,
    size: 12,
    opacity: 0.45,
    fadeMs: 2000,
    color: '#f7f06d',
    rainbow: false,
    sparkle: false
  });

  const assetsById = useMemo(() => {
    const map = new Map<string, AssetItem>();
    project?.data.assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [project]);

  const sections = project?.data.sections ?? [];

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
  const currentAsset = currentSlide ? assetsById.get(currentSlide.assetId) ?? null : null;
  const previousSlide = previousIndex !== null ? project?.data.slides[previousIndex] : null;
  const previousAsset = previousSlide ? assetsById.get(previousSlide.assetId) ?? null : null;
  const resolvedCurrentSrc =
    project && currentAsset ? toMediaUrl(currentAsset.relativePath) : null;

  const goToSlideByAbsoluteIndex = (index: number) => {
    if (!project) return;
    if (index < 0 || index >= project.data.slides.length || index === currentIndex) return;
    setPreviousIndex(currentIndex);
    setCurrentIndex(index);
    setIsAnimating(true);
    window.setTimeout(() => {
      setIsAnimating(false);
      setPreviousIndex(null);
    }, 450);
  };

  const goToVisibleOffset = (offset: number) => {
    const currentVisiblePos = visibleSlideIndices.indexOf(currentIndex);
    if (currentVisiblePos < 0) return;
    const target = visibleSlideIndices[currentVisiblePos + offset];
    if (target === undefined) return;
    goToSlideByAbsoluteIndex(target);
  };

  const setProjectState = (next: ProjectState | null) => {
    if (!next) {
      setProject(null);
      setSelectedSectionId(null);
      setCurrentIndex(0);
      setPreviousIndex(null);
      setError(null);
      return;
    }

    const normalized = ensureSections(next);
    setProject(normalized);
    setSelectedSectionId(normalized.data.sections[0]?.id ?? null);
    setCurrentIndex(0);
    setPreviousIndex(null);
    setError(null);
  };

  const onCreateProject = async () => {
    try {
      const next = await window.appApi.createProject();
      if (next) setProjectState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onOpenProject = async () => {
    try {
      const next = await window.appApi.openProject();
      if (next) setProjectState(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onImportMedia = async () => {
    if (!project) return;
    try {
      const result = await window.appApi.importMedia();
      if (!result) return;
      const targetSectionId = selectedSectionId ?? project.data.sections[0]?.id;
      const createdSlides = targetSectionId
        ? result.createdSlides.map((slide) => ({ ...slide, sectionId: targetSectionId }))
        : result.createdSlides;

      const nextSlides = [...project.data.slides, ...createdSlides];
      const nextAssets = [...project.data.assets, ...result.importedAssets];
      setProject({
        ...project,
        data: {
          ...project.data,
          slides: nextSlides,
          assets: nextAssets
        }
      });
      if (nextSlides.length > 0 && project.data.slides.length === 0) {
        setCurrentIndex(0);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onSave = async () => {
    if (!project) return;
    try {
      const response = await window.appApi.saveProject(project.data);
      if (!response) return;
      setProject({
        ...project,
        data: {
          ...project.data,
          updatedAt: response.lastSavedAt
        },
        lastSavedAt: response.lastSavedAt
      });
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
          slide.id === currentSlide.id ? { ...slide, transition } : slide
        )
      }
    });
  };

  const selectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    const firstInSection = sectionSlideIndices.get(sectionId)?.[0];
    if (firstInSection !== undefined) {
      setCurrentIndex(firstInSection);
    }
  };

  const renameSection = (sectionId: string, name: string) => {
    if (!project) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        sections: project.data.sections.map((section) =>
          section.id === sectionId ? { ...section, name: name.trim() || section.name } : section
        )
      }
    });
  };

  const onInsertSectionBreak = () => {
    if (!project || !currentSlide) return;

    const breakIndex = currentIndex;
    const nextSection: Section = {
      id: crypto.randomUUID(),
      name: `Section ${project.data.sections.length + 1}`
    };

    const nextSlides = project.data.slides.map((slide, index) =>
      index >= breakIndex ? { ...slide, sectionId: nextSection.id } : slide
    );

    setProject({
      ...project,
      data: {
        ...project.data,
        sections: [...project.data.sections, nextSection],
        slides: nextSlides
      }
    });
    setSelectedSectionId(nextSection.id);
  };

  const currentVisiblePos = visibleSlideIndices.indexOf(currentIndex);

  const reorderSlidesWithinSection = (fromIndex: number, toIndex: number) => {
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
        slides: nextSlides
      }
    });
    setCurrentIndex(insertAt);
    setPreviousIndex(null);
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
  };

  const updateCurrentSlideMarkerStrokes = (strokes: MarkerStroke[]) => {
    if (!project || !currentSlide) return;
    setProject({
      ...project,
      data: {
        ...project.data,
        slides: project.data.slides.map((slide, index) =>
          index === currentIndex ? { ...slide, markerStrokes: strokes } : slide
        )
      }
    });
  };

  const clearCurrentSlideDrawings = () => {
    updateCurrentSlideMarkerStrokes([]);
    setDrawClearSignal((prev) => prev + 1);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button onClick={onCreateProject}>Create Project</button>
        <button onClick={onOpenProject}>Open Project</button>
        <button onClick={onImportMedia} disabled={!project}>Import Media</button>
        <button onClick={onSave} disabled={!project}>Save</button>
        <span className="build-chip" title="Build marker">Build {BUILD_VERSION}</span>
      </header>

      <div className="content">
        <aside className="sidebar">
          <h3>Sections</h3>
          {sections.length ? (
            <ul>
              {sections.map((section) => {
                const count = sectionSlideIndices.get(section.id)?.length ?? 0;
                const isSelected = selectedSectionId === section.id;
                return (
                  <li key={section.id} className="section-item">
                    <button
                      className={isSelected ? 'slide-btn active' : 'slide-btn'}
                      onClick={() => selectSection(section.id)}
                    >
                      {renamingSectionId === section.id ? (
                        <input
                          className="section-input"
                          defaultValue={section.name}
                          autoFocus
                          onBlur={(event) => {
                            renameSection(section.id, event.target.value);
                            setRenamingSectionId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              renameSection(section.id, (event.target as HTMLInputElement).value);
                              setRenamingSectionId(null);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <span>{section.name}</span>
                          <small>{count}</small>
                        </>
                      )}
                    </button>
                    {renamingSectionId !== section.id && (
                      <button className="rename-btn" onClick={() => setRenamingSectionId(section.id)}>Rename</button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No sections yet.</p>
          )}

          <button className="section-break-btn" onClick={onInsertSectionBreak} disabled={!currentSlide}>
            Insert Section Break
          </button>

          <h3>Slides</h3>
          {visibleSlideIndices.length ? (
            <ul>
              {visibleSlideIndices.map((slideIndex) => {
                const slide = project!.data.slides[slideIndex];
                const asset = assetsById.get(slide.assetId);
                const isDragging = draggedSlideIndex === slideIndex;
                const isDragOver = dragOverSlideIndex === slideIndex;
                return (
                  <li
                    key={slide.id}
                    className={isDragOver ? 'slide-row drag-over' : 'slide-row'}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedSlideIndex !== null) {
                        setDragOverSlideIndex(slideIndex);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedSlideIndex === null) return;
                      reorderSlidesWithinSection(draggedSlideIndex, slideIndex);
                    }}
                  >
                    <button
                      draggable
                      className={slideIndex === currentIndex ? 'slide-btn active' : 'slide-btn'}
                      onClick={() => goToSlideByAbsoluteIndex(slideIndex)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(slideIndex));
                        setDraggedSlideIndex(slideIndex);
                        setDragOverSlideIndex(slideIndex);
                      }}
                      onDragEnd={() => {
                        setDraggedSlideIndex(null);
                        setDragOverSlideIndex(null);
                      }}
                    >
                      <span>{slideIndex + 1}.</span> {asset?.originalName ?? 'Unknown asset'}
                      {isDragging && <small> (Dragging)</small>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No slides in this section.</p>
          )}
        </aside>

        <main className="stage-wrap">
          <div className="stage-controls">
            <button onClick={() => goToVisibleOffset(-1)} disabled={!project || currentVisiblePos <= 0}>Prev</button>
            <button
              onClick={() => goToVisibleOffset(1)}
              disabled={!project || currentVisiblePos < 0 || currentVisiblePos >= visibleSlideIndices.length - 1}
            >
              Next
            </button>
            <label>
              Transition
              <select
                value={currentSlide?.transition ?? 'fade'}
                onChange={(event) => updateTransition(event.target.value as TransitionType)}
                disabled={!currentSlide}
              >
                <option value="fade">Fade</option>
                <option value="crossfade">Crossfade</option>
              </select>
            </label>
          </div>

          <div className="stage">
            {!currentAsset && <div className="placeholder">Import media to start presenting.</div>}
            {currentAsset && (
              <div className="media-layer">
                {currentSlide?.transition === 'crossfade' && previousAsset && isAnimating && (
                  <MediaView
                    key={`${previousSlide?.id}-prev`}
                    asset={previousAsset}
                    className="media crossfade-out"
                    drawSettings={drawSettings}
                    markerStrokes={previousSlide?.markerStrokes ?? []}
                    onMarkerStrokesChange={() => undefined}
                    clearSignal={drawClearSignal}
                  />
                )}
                <MediaView
                  key={`${currentSlide?.id}-${isAnimating}`}
                  asset={currentAsset}
                  className={`media ${currentSlide?.transition === 'fade' ? 'fade-in' : 'crossfade-in'}`}
                  drawSettings={drawSettings}
                  markerStrokes={currentSlide?.markerStrokes ?? []}
                  onMarkerStrokesChange={updateCurrentSlideMarkerStrokes}
                  clearSignal={drawClearSignal}
                />
              </div>
            )}

            {currentSlide && (
              <div className={drawPanelCollapsed ? 'draw-panel collapsed' : 'draw-panel'}>
                <button className="draw-panel-toggle" onClick={() => setDrawPanelCollapsed((v) => !v)}>
                  {drawPanelCollapsed ? '✎' : 'Drawing'}
                </button>

                {!drawPanelCollapsed && (
                  <div className="draw-panel-body">
                    <label>
                      Tool
                      <select
                        value={drawSettings.tool}
                        onChange={(event) =>
                          setDrawSettings((prev) => ({ ...prev, tool: event.target.value as DrawTool }))}
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
                        onChange={(event) => setDrawSettings((prev) => ({ ...prev, size: Number(event.target.value) }))}
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
                        onChange={(event) => setDrawSettings((prev) => ({ ...prev, opacity: Number(event.target.value) }))}
                      />
                    </label>

                    {drawSettings.tool === 'highlighter' && (
                      <label>
                        Fade (ms)
                        <input
                          type="range"
                          min={400}
                          max={6000}
                          step={100}
                          value={drawSettings.fadeMs}
                          onChange={(event) => setDrawSettings((prev) => ({ ...prev, fadeMs: Number(event.target.value) }))}
                        />
                      </label>
                    )}

                    <label>
                      Color
                      <input
                        type="color"
                        value={drawSettings.color}
                        onChange={(event) => setDrawSettings((prev) => ({ ...prev, color: event.target.value }))}
                      />
                    </label>

                    <label className="draw-inline-check">
                      <input
                        type="checkbox"
                        checked={drawSettings.rainbow}
                        onChange={(event) => setDrawSettings((prev) => ({ ...prev, rainbow: event.target.checked }))}
                      />
                      Rainbow
                    </label>

                    <label className="draw-inline-check">
                      <input
                        type="checkbox"
                        checked={drawSettings.sparkle}
                        onChange={(event) => setDrawSettings((prev) => ({ ...prev, sparkle: event.target.checked }))}
                      />
                      Sparkle
                    </label>

                    <label className="draw-inline-check">
                      <input
                        type="checkbox"
                        checked={drawSettings.drawMode}
                        onChange={(event) => setDrawSettings((prev) => ({ ...prev, drawMode: event.target.checked }))}
                      />
                      Draw mode
                    </label>

                    <button onClick={clearCurrentSlideDrawings}>Clear Drawings</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {import.meta.env.DEV && resolvedCurrentSrc && (
            <div>Resolved src: {resolvedCurrentSrc}</div>
          )}
        </main>
      </div>

      <footer className="status">
        <div className="build-version">Build {BUILD_VERSION}</div>
        <strong>Project Status</strong>
        <div>Folder: {project?.folderPath ?? '-'}</div>
        <div>Sections: {project?.data.sections.length ?? 0}</div>
        <div>Slides: {project?.data.slides.length ?? 0}</div>
        <div>Assets: {project?.data.assets.length ?? 0}</div>
        <div>Last saved: {project?.lastSavedAt ?? '-'}</div>
        {error && <div className="error">Error: {error}</div>}
      </footer>
    </div>
  );
}

function MediaView({
  asset,
  className,
  drawSettings,
  markerStrokes,
  onMarkerStrokesChange,
  clearSignal
}: {
  asset: AssetItem;
  className?: string;
  drawSettings: DrawSettings;
  markerStrokes: MarkerStroke[];
  onMarkerStrokesChange: (strokes: MarkerStroke[]) => void;
  clearSignal: number;
}) {
  const src = toMediaUrl(asset.relativePath);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [highlighterStrokes, setHighlighterStrokes] = useState<HighlighterStroke[]>([]);
  const activeHighlighterRef = useRef<HighlighterStroke | null>(null);
  const activeMarkerRef = useRef<MarkerStroke | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    setHighlighterStrokes([]);
  }, [clearSignal]);

  const mediaStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: '0 0',
    transition: isPanning ? 'none' : 'transform 50ms linear',
    cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default'
  };

  const getContentPoint = (clientX: number, clientY: number): DrawPoint | null => {
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
      h: drawSettings.rainbow ? (performance.now() / 18) % 360 : undefined
    };
  };

  const onWheelZoom = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    const nextZoom = Math.min(4, Math.max(1, zoom + (event.deltaY < 0 ? 0.2 : -0.2)));
    if (nextZoom === zoom) return;

    const contentX = (cursorX - pan.x) / zoom;
    const contentY = (cursorY - pan.y) / zoom;
    const nextPanX = cursorX - contentX * nextZoom;
    const nextPanY = cursorY - contentY * nextZoom;

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) return;
    event.preventDefault();
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y
    };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (event: globalThis.MouseEvent) => {
      const deltaX = event.clientX - panStartRef.current.x;
      const deltaY = event.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + deltaX,
        y: panStartRef.current.panY + deltaY
      });
    };

    const onUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

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

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = performance.now();
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const renderStroke = (
        stroke: { points: DrawPoint[]; size: number; opacity: number; color: string; rainbow: boolean },
        segmentAlpha: (index: number) => number
      ) => {
        const points = stroke.points;
        if (points.length < 2) return;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke.size;

        for (let i = 1; i < points.length; i += 1) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const alpha = Math.max(0, Math.min(1, segmentAlpha(i))) * stroke.opacity;
          if (alpha <= 0) continue;
          const hue = stroke.rainbow ? (p1.h ?? (now / 18 + i * 8)) : undefined;
          ctx.strokeStyle = stroke.rainbow ? `hsla(${hue}, 95%, 62%, ${alpha})` : stroke.color;
          if (!stroke.rainbow) {
            const color = stroke.color;
            const clean = color.startsWith('#') ? color.slice(1) : color;
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
      const allHighlighter = activeHighlighter ? [...highlighterStrokes, activeHighlighter] : highlighterStrokes;
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

      setHighlighterStrokes((prev) => prev.filter((stroke) => {
        const lastPoint = stroke.points[stroke.points.length - 1];
        return now - lastPoint.t < stroke.fadeMs;
      }));
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
    if (drawSettings.tool === 'highlighter') {
      activeHighlighterRef.current = {
        id: crypto.randomUUID(),
        points: [point],
        size: drawSettings.size,
        opacity: drawSettings.opacity,
        color: drawSettings.color,
        fadeMs: drawSettings.fadeMs,
        rainbow: drawSettings.rainbow,
        sparkle: drawSettings.sparkle
      };
      return;
    }

    activeMarkerRef.current = {
      id: crypto.randomUUID(),
      points: [point],
      size: drawSettings.size,
      opacity: drawSettings.opacity,
      color: drawSettings.color,
      rainbow: drawSettings.rainbow
    };
  };

  const handleDrawMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!drawSettings.drawMode || !isDrawingRef.current) return;
    const point = getContentPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();

    if (drawSettings.tool === 'highlighter' && activeHighlighterRef.current) {
      activeHighlighterRef.current = {
        ...activeHighlighterRef.current,
        points: [...activeHighlighterRef.current.points, point]
      };
      return;
    }

    if (drawSettings.tool === 'marker' && activeMarkerRef.current) {
      activeMarkerRef.current = {
        ...activeMarkerRef.current,
        points: [...activeMarkerRef.current.points, point]
      };
    }
  };

  const handleDrawEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (drawSettings.tool === 'highlighter' && activeHighlighterRef.current) {
      const stroke = activeHighlighterRef.current;
      if (stroke.points.length > 1) {
        setHighlighterStrokes((prev) => [...prev, stroke]);
      }
      activeHighlighterRef.current = null;
      return;
    }

    if (drawSettings.tool === 'marker' && activeMarkerRef.current) {
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
      onWheel={onWheelZoom}
      onMouseDown={onMouseDown}
      onMouseMove={(event) => {
        if (isPanning) event.preventDefault();
      }}
      onMouseUp={() => setIsPanning(false)}
      onMouseLeave={() => {
        if (isPanning) setIsPanning(false);
      }}
      title="Mouse wheel: zoom | Middle mouse drag: pan"
    >
      {asset.mediaType === 'image' ? (
        <img src={src} className="media-content" alt={asset.originalName} style={mediaStyle} draggable={false} />
      ) : (
        <video src={src} className="media-content" style={mediaStyle} controls autoPlay muted />
      )}

      <canvas
        ref={canvasRef}
        className={drawSettings.drawMode ? 'drawing-overlay active' : 'drawing-overlay'}
        onMouseDown={handleDrawStart}
        onMouseMove={handleDrawMove}
        onMouseUp={handleDrawEnd}
        onMouseLeave={handleDrawEnd}
        onWheel={onWheelZoom}
      />
    </div>
  );
}
