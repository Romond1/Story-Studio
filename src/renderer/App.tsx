import { useMemo, useState } from 'react';
import type { AssetItem, ProjectState, TransitionType } from '../shared/types';

function toFileUrl(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized)) return `file:///${normalized}`;
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return normalized;
}

export function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetsById = useMemo(() => {
    const map = new Map<string, AssetItem>();
    project?.data.assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [project]);

  const currentSlide = project?.data.slides[currentIndex] ?? null;
  const currentAsset = currentSlide ? assetsById.get(currentSlide.assetId) ?? null : null;
  const previousSlide = previousIndex !== null ? project?.data.slides[previousIndex] : null;
  const previousAsset = previousSlide ? assetsById.get(previousSlide.assetId) ?? null : null;

  const goToSlide = (index: number) => {
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

  const setProjectState = (next: ProjectState | null) => {
    setProject(next);
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
      const nextSlides = [...project.data.slides, ...result.createdSlides];
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

  return (
    <div className="app">
      <header className="topbar">
        <button onClick={onCreateProject}>Create Project</button>
        <button onClick={onOpenProject}>Open Project</button>
        <button onClick={onImportMedia} disabled={!project}>Import Media</button>
        <button onClick={onSave} disabled={!project}>Save</button>
      </header>

      <div className="content">
        <aside className="sidebar">
          <h3>Slides</h3>
          {project?.data.slides.length ? (
            <ul>
              {project.data.slides.map((slide, index) => {
                const asset = assetsById.get(slide.assetId);
                return (
                  <li key={slide.id}>
                    <button
                      className={index === currentIndex ? 'slide-btn active' : 'slide-btn'}
                      onClick={() => goToSlide(index)}
                    >
                      <span>{index + 1}.</span> {asset?.originalName ?? 'Unknown asset'}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No slides yet.</p>
          )}
        </aside>

        <main className="stage-wrap">
          <div className="stage-controls">
            <button onClick={() => goToSlide(currentIndex - 1)} disabled={!project || currentIndex <= 0}>Prev</button>
            <button
              onClick={() => goToSlide(currentIndex + 1)}
              disabled={!project || !project.data.slides.length || currentIndex >= project.data.slides.length - 1}
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
                    projectFolder={project!.folderPath}
                    className="media crossfade-out"
                  />
                )}
                <MediaView
                  key={`${currentSlide?.id}-${isAnimating}`}
                  asset={currentAsset}
                  projectFolder={project!.folderPath}
                  className={`media ${currentSlide?.transition === 'fade' ? 'fade-in' : 'crossfade-in'}`}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="status">
        <strong>Project Status</strong>
        <div>Folder: {project?.folderPath ?? '-'}</div>
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
  projectFolder,
  className
}: {
  asset: AssetItem;
  projectFolder: string;
  className?: string;
}) {
  const sourcePath = `${projectFolder}/${asset.relativePath}`;
  const src = encodeURI(toFileUrl(sourcePath));
  if (asset.mediaType === 'image') {
    return <img src={src} className={className} alt={asset.originalName} />;
  }
  return <video src={src} className={className} controls autoPlay muted />;
}
