import { useMemo, useState, type DragEvent } from 'react';
import type { LessonProject } from '../../shared/lesson/model';
import { toMediaUrl } from '../mediaUrls';
import { visualMediaUrl } from '../../shared/visualMedia';
import './compactMediaPool.css';
import { createMediaRegistry, type MediaRegistryView } from '../../shared/content/mediaRegistry';

export const LESSON_ASSET_DRAG = 'application/x-story-studio-assets';
export const LESSON_ENTRY_DRAG = 'application/x-story-studio-entry';
export const lessonMediaUrl = (path: string, projectId = '') => visualMediaUrl(toMediaUrl(path), projectId);

/** Count authored fields once, including library definitions with no placements. */
export function lessonAssetUsage(project: LessonProject, assetId: string): number {
  return createMediaRegistry({ format: 'scene', data: project }).usages(assetId).length;
}

export interface LessonMediaPoolProps {
  project: LessonProject;
  registry: MediaRegistryView;
  resolveAsset: (id: string) => string | undefined;
  onImport: (kind: 'files' | 'folder' | 'drop', paths?: string[], destinationBinId?: string) => Promise<void> | void;
  onInsert: (assetIds: string[]) => void;
  onChange: (project: LessonProject) => void;
  binId: string;
  onBinChange: (id: string) => void;
  insertLabel?: string;
  insertDisabled?: boolean;
}

export function LessonMediaPool({ project, registry, resolveAsset, onImport, onInsert, onChange, binId, onBinChange: setBinId, insertLabel, insertDisabled }: LessonMediaPoolProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [usage, setUsage] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [binsOpen, setBinsOpen] = useState(false);
  const [binName, setBinName] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const bins = registry.bins();
  const activeBin = bins.some(bin => bin.id === binId) ? binId : '';
  const counts = useMemo(() => new Map(registry.list().map(asset => [asset.id, registry.usages(asset.id).length])), [registry]);
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
  const assets = registry.list().filter(asset => inBin(asset.binId)
    && (type === 'all' || type === asset.mediaType)
    && (usage === 'all' || (usage === 'used') === !!counts.get(asset.id))
    && `${asset.originalName} ${asset.filename} ${asset.canonicalLabel ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const importMedia = async (kind: 'files' | 'folder' | 'drop', paths?: string[]) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onImport(kind, paths, activeBin || undefined); }
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
    <header className="lesson-panel-heading"><button className="lesson-disclosure" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? '▾' : '▸'} Media Pool</button><button className="lesson-pool-import" disabled={busy} onClick={() => void importMedia('files')} title="Import images, videos or audio">{busy ? 'Importing…' : 'Import files'}</button></header>
    {open && <div className="lesson-panel-content">
      {error && <p className="lesson-error" role="alert">{error}</p>}
      {(!registry.dependencies().complete || registry.diagnostics().length > 0) && <p className="lesson-error" role="status">Some media references are missing, ambiguous, or unsupported. Usage is incomplete; all imported media is retained.</p>}
      <div className="lesson-pool-search"><input aria-label="Search media" type="search" placeholder="Search media…" value={query} onChange={event => setQuery(event.target.value)} /><button aria-label="Media filters" aria-expanded={filtersOpen} title="Filter media by type or usage" onClick={() => setFiltersOpen(!filtersOpen)}>Filters{type !== 'all' || usage !== 'all' ? ' •' : ''}</button><button aria-label="Media bins" aria-expanded={binsOpen} onClick={() => setBinsOpen(!binsOpen)}>Bin</button></div>
      <div className="lesson-pool-destination" title={activeBin ? binPath(activeBin) : 'General media'}><span>Import to</span><strong>{activeBin ? binPath(activeBin) : 'General media'}</strong></div>
      {filtersOpen && <div className="lesson-pool-filters">
      <div className="lesson-actions"><button disabled={busy} onClick={() => void importMedia('folder')}>Import folder</button><button onClick={() => { setType('all'); setUsage('all'); setQuery(''); }}>Reset filters</button></div>
      <div className="lesson-field-grid"><label className="lesson-field"><span>Type</span><select aria-label="Type" value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option></select></label><label className="lesson-field"><span>Usage</span><select aria-label="Usage" value={usage} onChange={event => setUsage(event.target.value)}><option value="all">All assets</option><option value="used">Referenced in content</option><option value="unused">No known references</option></select></label></div>
      </div>}
      {binsOpen && <div className="lesson-pool-filters">
      <div className="lesson-bin-row"><label className="lesson-field"><span>Bin</span><select aria-label="Bin" value={activeBin} onChange={event => setBinId(event.target.value)}><option value="">General / all media</option>{bins.map(bin => <option key={bin.id} value={bin.id}>{binPath(bin.id)}</option>)}</select></label><button onClick={() => setBinName('')}>New bin</button></div>
      {binName !== null && <form className="lesson-pool-bin-form" onSubmit={event => { event.preventDefault(); if (!binName.trim()) return; const bin = { id: crypto.randomUUID(), name: binName.trim().slice(0, 200), ...(activeBin ? { parentId: activeBin } : {}) }; onChange({ ...project, mediaBins: [...bins, bin] }); setBinId(bin.id); setBinName(null); }}><input autoFocus aria-label="New bin name" value={binName} maxLength={200} onChange={event => setBinName(event.target.value)} /><button disabled={!binName.trim()}>Create bin</button><button type="button" onClick={() => setBinName(null)}>Cancel</button></form>}
      {selectedAssets.length > 0 && <label className="lesson-field"><span>Move selected media to bin</span><select value="" onChange={event => { const destination = event.target.value; onChange({ ...project, assets: project.assets.map(asset => selected.has(asset.id) ? { ...asset, binId: destination === 'root' ? undefined : destination } : asset) }); }}><option value="" disabled>Choose bin…</option><option value="root">Pool root</option>{bins.map(bin => <option key={bin.id} value={bin.id}>{binPath(bin.id)}</option>)}</select></label>}
      </div>}
      <div className="lesson-pool-assets" role="listbox" aria-label="Project media" aria-multiselectable="true" tabIndex={0} onKeyDown={event => {
        if ((event.target as HTMLElement).closest('input, select, textarea')) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') { event.preventDefault(); event.stopPropagation(); setSelected(new Set(assets.map(asset => asset.id))); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSelected(new Set()); }
      }}>
        {assets.map(asset => <button key={asset.id} type="button" role="option" aria-selected={selected.has(asset.id)} className={`lesson-pool-asset${selected.has(asset.id) ? ' is-selected' : ''}`}
          data-asset-id={asset.id} draggable={asset.mediaType !== 'audio'} title={`${asset.originalName || asset.filename} · ${counts.get(asset.id)} authored references`}
          onClick={event => { setSelected(previous => { if (event.shiftKey && anchorId) { const a = assets.findIndex(item => item.id === anchorId), b = assets.indexOf(asset); if (a >= 0) return new Set([...(event.ctrlKey || event.metaKey ? previous : []), ...assets.slice(Math.min(a, b), Math.max(a, b) + 1).map(item => item.id)]); } if (!event.ctrlKey && !event.metaKey && !event.shiftKey) return new Set([asset.id]); const next = new Set(previous); next.has(asset.id) ? next.delete(asset.id) : next.add(asset.id); return next; }); if (!event.shiftKey) setAnchorId(asset.id); }}
          onDoubleClick={() => { if (!insertDisabled && asset.mediaType !== 'audio') onInsert([asset.id]); }}
          onDragStart={event => { const ids = selected.has(asset.id) ? visualIds : [asset.id]; event.dataTransfer.setData(LESSON_ASSET_DRAG, JSON.stringify(ids)); event.dataTransfer.effectAllowed = 'copy'; }}>
          <span className="lesson-pool-thumb">{asset.mediaType === 'image' ? <img src={resolveAsset(asset.id)} alt="" loading="lazy" draggable={false} /> : asset.mediaType === 'video' ? <video src={resolveAsset(asset.id)} muted preload="metadata" /> : <span aria-hidden="true">♫</span>}</span>
          <span className="lesson-asset-name">{asset.originalName || asset.filename}</span><small>{asset.mediaType} · {counts.get(asset.id) ? `${counts.get(asset.id)} uses` : 'No known references'}</small>
        </button>)}
      </div>
      {!assets.length && <p className="lesson-empty">{project.assets.length ? 'No media matches these filters.' : 'Import images and videos, or drop files here to start your lesson.'}</p>}
      <footer className="lesson-pool-footer">{selectedAssets.length > 0 ? <><span>{selectedAssets.length} selected</span><button disabled={insertDisabled || !visualIds.length} onClick={() => onInsert(visualIds)}>{insertLabel ?? `Add ${visualIds.length > 1 ? `${visualIds.length} scenes` : 'to sequence'}`}</button><button aria-label="Clear media selection" onClick={() => setSelected(new Set())}>×</button></> : <span>{assets.length} media · {insertLabel ? 'Select media to use in game' : 'Drag into a Section'}</span>}</footer>
    </div>}
  </section>;
}
