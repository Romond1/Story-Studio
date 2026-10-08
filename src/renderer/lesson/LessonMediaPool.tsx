import { useMemo, useState, type DragEvent } from 'react';
import type { LessonProject } from '../../shared/lesson/model';
import { toMediaUrl } from '../mediaUrls';
import { visualMediaUrl } from '../../shared/visualMedia';

export const LESSON_ASSET_DRAG = 'application/x-story-studio-assets';
export const LESSON_ENTRY_DRAG = 'application/x-story-studio-entry';
export const lessonMediaUrl = (path: string, projectId = '') => visualMediaUrl(toMediaUrl(path), projectId);

/** Count placements, not occurrences: linked scenes share their authored content. */
export function lessonAssetUsage(project: LessonProject, assetId: string): number {
  let count = 0;
  for (const scene of Object.values(project.scenes)) {
    if (scene.background.assetId === assetId) count++;
    count += scene.audio.filter(audio => audio.assetId === assetId).length;
    for (const object of scene.objects) {
      if (object.kind === 'image' && object.assetId === assetId) count++;
      if (object.kind === 'card') count += project.cards[object.cardId]?.faces.filter(face => face.imageAssetId === assetId).length ?? 0;
    }
  }
  return count;
}

export interface LessonMediaPoolProps {
  project: LessonProject;
  onImport: (kind: 'files' | 'folder' | 'drop', paths?: string[]) => Promise<void> | void;
  onInsert: (assetIds: string[]) => void;
  onChange: (project: LessonProject) => void;
}

export function LessonMediaPool({ project, onImport, onInsert, onChange }: LessonMediaPoolProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [usage, setUsage] = useState('all');
  const [binId, setBinId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const bins = project.mediaBins;
  const activeBin = bins.some(bin => bin.id === binId) ? binId : '';
  const counts = useMemo(() => new Map(project.assets.map(asset => [asset.id, lessonAssetUsage(project, asset.id)])), [project]);
  const selectedAssets = project.assets.filter(asset => selected.has(asset.id));
  const visualIds = selectedAssets.filter(asset => asset.mediaType !== 'audio').map(asset => asset.id);
  const inBin = (id?: string) => {
    if (!activeBin) return true;
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      if (id === activeBin) return true;
      visited.add(id);
      id = bins.find(bin => bin.id === id)?.parentId;
    }
    return false;
  };
  const assets = project.assets.filter(asset => inBin(asset.binId)
    && (type === 'all' || type === asset.mediaType)
    && (usage === 'all' || (usage === 'used') === !!counts.get(asset.id))
    && `${asset.originalName} ${asset.filename} ${asset.canonicalLabel ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const importMedia = async (kind: 'files' | 'folder' | 'drop', paths?: string[]) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onImport(kind, paths); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not import media. Please try again.'); }
    finally { setBusy(false); }
  };
  const dropFiles = (event: DragEvent) => {
    event.preventDefault(); event.stopPropagation(); setDragOver(false);
    if (!event.dataTransfer.types.includes('Files')) return;
    const paths = Array.from(event.dataTransfer.files).map(file => window.appApi.getPathForFile(file)).filter(Boolean);
    if (paths.length) void importMedia('drop', paths);
  };
  const binPath = (id: string) => {
    const parts: string[] = [], seen = new Set<string>();
    let current = bins.find(bin => bin.id === id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id); parts.unshift(current.name); current = bins.find(bin => bin.id === current?.parentId);
    }
    return parts.join(' / ');
  };
  return <section className={`lesson-pool${dragOver ? ' is-drop' : ''}`} aria-label="Media Pool"
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); setDragOver(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false); }} onDrop={dropFiles}>
    <header className="lesson-panel-heading"><button className="lesson-disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? '▾' : '▸'} Media Pool</button><span className="lesson-muted">{project.assets.length} assets</span></header>
    {open && <div className="lesson-panel-content">
      <div className="lesson-actions"><button disabled={busy} onClick={() => void importMedia('files')}>{busy ? 'Importing…' : 'Import files'}</button><button disabled={busy} onClick={() => void importMedia('folder')}>Import folder</button></div>
      {error && <p className="lesson-error" role="alert">{error}</p>}
      <label className="lesson-field"><span>Search media</span><input type="search" placeholder="Name or filename…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="lesson-field-grid"><label className="lesson-field"><span>Type</span><select value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option></select></label><label className="lesson-field"><span>Usage</span><select value={usage} onChange={event => setUsage(event.target.value)}><option value="all">All assets</option><option value="used">Used in scenes</option><option value="unused">Unused in scenes</option></select></label></div>
      <div className="lesson-bin-row"><label className="lesson-field"><span>Bin</span><select value={activeBin} onChange={event => setBinId(event.target.value)}><option value="">All media</option>{bins.map(bin => <option key={bin.id} value={bin.id}>{binPath(bin.id)}</option>)}</select></label><button onClick={() => {
        const name = window.prompt('New bin name');
        if (!name?.trim()) return;
        const bin = { id: crypto.randomUUID(), name: name.trim().slice(0, 200), ...(activeBin ? { parentId: activeBin } : {}) };
        onChange({ ...project, mediaBins: [...bins, bin] }); setBinId(bin.id);
      }}>New bin</button></div>
      <div className="lesson-pool-assets" role="listbox" aria-label="Project media" aria-multiselectable="true">
        {assets.map(asset => <button key={asset.id} type="button" role="option" aria-selected={selected.has(asset.id)} className={`lesson-pool-asset${selected.has(asset.id) ? ' is-selected' : ''}`}
          draggable={asset.mediaType !== 'audio'} title={`${asset.originalName || asset.filename} · ${counts.get(asset.id)} scene uses`}
          onClick={event => setSelected(previous => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) return new Set([asset.id]); const next = new Set(previous); next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id); return next; })}
          onDoubleClick={() => { if (asset.mediaType !== 'audio') onInsert([asset.id]); }}
          onDragStart={event => { const ids = selected.has(asset.id) ? visualIds : [asset.id]; event.dataTransfer.setData(LESSON_ASSET_DRAG, JSON.stringify(ids)); event.dataTransfer.effectAllowed = 'copy'; }}>
          <span className="lesson-pool-thumb">{asset.mediaType === 'image' ? <img src={lessonMediaUrl(asset.relativePath, project.id)} alt="" loading="lazy" draggable={false} /> : asset.mediaType === 'video' ? <video src={lessonMediaUrl(asset.relativePath, project.id)} muted preload="metadata" /> : <span aria-hidden="true">♫</span>}</span>
          <span className="lesson-asset-name">{asset.originalName || asset.filename}</span><small>{asset.mediaType} · {counts.get(asset.id) ? `${counts.get(asset.id)} uses` : 'Unused'}</small>
        </button>)}
      </div>
      {!assets.length && <p className="lesson-empty">{project.assets.length ? 'No media matches these filters.' : 'Import images and videos, or drop files here to start your lesson.'}</p>}
      <div className="lesson-actions"><button disabled={!visualIds.length} onClick={() => onInsert(visualIds)}>Add {visualIds.length > 1 ? `${visualIds.length} scenes` : 'to sequence'}</button>{selectedAssets.length > 0 && <button onClick={() => setSelected(new Set())}>Clear selection</button>}</div>
      {selectedAssets.length > 0 && <label className="lesson-field"><span>Move selected media to bin</span><select value="" onChange={event => { const destination = event.target.value; onChange({ ...project, assets: project.assets.map(asset => selected.has(asset.id) ? { ...asset, binId: destination === 'root' ? undefined : destination } : asset) }); }}><option value="" disabled>Choose bin…</option><option value="root">Pool root</option>{bins.map(bin => <option key={bin.id} value={bin.id}>{binPath(bin.id)}</option>)}</select></label>}
      <p className="lesson-hint">One pool for Story and Activation. Drag media to the timeline or double-click to add. Attach audio in the scene Inspector.</p>
    </div>}
  </section>;
}
