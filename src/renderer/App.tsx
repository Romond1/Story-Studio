// src/renderer/App.tsx
import { type CSSProperties, type MouseEvent, type WheelEvent, useMemo, useState } from 'react';
import type { AssetItem, ProjectState, Section, TransitionType } from '../shared/types';
import { BUILD_VERSION } from '../shared/version';

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
                return (
                  <li key={slide.id}>
                    <button
                      className={slideIndex === currentIndex ? 'slide-btn active' : 'slide-btn'}
                      onClick={() => goToSlideByAbsoluteIndex(slideIndex)}
                    >
                      <span>{slideIndex + 1}.</span> {asset?.originalName ?? 'Unknown asset'}
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
                  />
                )}
                <MediaView
                  key={`${currentSlide?.id}-${isAnimating}`}
                  asset={currentAsset}
                  className={`media ${currentSlide?.transition === 'fade' ? 'fade-in' : 'crossfade-in'}`}
                />
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
  className
}: {
  asset: AssetItem;
  className?: string;
}) {
  const src = toMediaUrl(asset.relativePath);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState('50% 50%');

  const mediaStyle: CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: origin,
    transition: 'transform 50ms linear'
  };

  const onWheelZoom = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const next = Math.min(4, Math.max(1, zoom + (event.deltaY < 0 ? 0.2 : -0.2)));
    setZoom(next);
    if (next === 1) {
      setOrigin('50% 50%');
    }
  };

  const onPointerMove = (event: MouseEvent<HTMLElement>) => {
    if (zoom <= 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  };

  if (asset.mediaType === 'image') {
    return (
      <img
        src={src}
        className={className}
        alt={asset.originalName}
        style={mediaStyle}
        onWheel={onWheelZoom}
        onMouseMove={onPointerMove}
        title="Scroll to zoom"
      />
    );
  }

  return <video src={src} className={className} controls autoPlay muted />;
}
