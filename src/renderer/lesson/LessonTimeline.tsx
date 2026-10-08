import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type { LessonLocation, LessonProject, SequenceKind } from '../../shared/lesson/model';
import { timelineDensity, timelineZoom } from '../../shared/lessonTimeline';
import { LESSON_ASSET_DRAG, LESSON_ENTRY_DRAG, lessonMediaUrl } from './LessonMediaPool';
import { projectScene } from '../../shared/lesson/projection';
import { SceneSurface } from './SceneSurface';

export interface LessonTimelineProps {
  project: LessonProject; sequence: SequenceKind; selectedEntryId: string | null; live: LessonLocation | null;
  readOnly?: boolean;
  onSelect: (entryId: string) => void;
  onAdd: (assetIds?: string[], beforeEntryId?: string) => void;
  onReorder: (entryId: string, beforeEntryId?: string) => void;
  onDelete: (entryId: string) => void;
  onCopy: (entryId: string, linked: boolean) => void;
  onSection: (entryId: string, section: string) => void;
}

/** Both lesson sequences use this same structural timeline. */
export function LessonTimeline(p: LessonTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [dropId, setDropId] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; scroll: number } | null>(null);
  const anchor = useRef<{ id: string; fraction: number; pointer: number } | null>(null);
  const entries = p.project.sequences[p.sequence];
  const selectedIndex = entries.findIndex(entry => entry.id === p.selectedEntryId);
  const selected = entries[selectedIndex];
  const density = timelineDensity(zoom);
  const changeZoom = (next: number, pointer?: number) => {
    const node = strip.current;
    if (node) {
      const x = pointer ?? node.getBoundingClientRect().left + node.clientWidth / 2;
      const child = Array.from(node.querySelectorAll<HTMLElement>('[data-entry-id]')).find(item => { const rect = item.getBoundingClientRect(); return rect.left <= x && rect.right >= x; });
      if (child) { const rect = child.getBoundingClientRect(); anchor.current = { id: child.dataset.entryId!, fraction: (x - rect.left) / rect.width, pointer: x - node.getBoundingClientRect().left }; }
    }
    setZoom(timelineZoom(next));
  };
  useEffect(() => {
    const node = strip.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault(); event.stopPropagation();
      if (event.altKey) changeZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX);
      else node.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [zoom]);
  useLayoutEffect(() => {
    const current = anchor.current, node = strip.current;
    if (!current || !node) return;
    const child = Array.from(node.querySelectorAll<HTMLElement>('[data-entry-id]')).find(item => item.dataset.entryId === current.id);
    if (child) { const rect = child.getBoundingClientRect(); node.scrollLeft += rect.left - node.getBoundingClientRect().left + rect.width * current.fraction - current.pointer; }
    anchor.current = null;
  }, [zoom]);
  const accepts = (event: DragEvent) => !p.readOnly && (event.dataTransfer.types.includes(LESSON_ASSET_DRAG) || event.dataTransfer.types.includes(LESSON_ENTRY_DRAG));
  const accept = (event: DragEvent, beforeId?: string) => {
    if (!accepts(event)) return;
    event.preventDefault(); event.stopPropagation(); setDropId(beforeId ?? 'end');
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes(LESSON_ENTRY_DRAG) ? 'move' : 'copy';
  };
  const drop = (event: DragEvent, beforeId?: string) => {
    if (!accepts(event)) return;
    event.preventDefault(); event.stopPropagation(); setDropId(null);
    if (event.dataTransfer.types.includes(LESSON_ENTRY_DRAG)) {
      const id = event.dataTransfer.getData(LESSON_ENTRY_DRAG);
      if (entries.some(entry => entry.id === id) && id !== beforeId) p.onReorder(id, beforeId);
    } else {
      try { const ids: unknown = JSON.parse(event.dataTransfer.getData(LESSON_ASSET_DRAG)); if (Array.isArray(ids) && ids.length && ids.every(id => typeof id === 'string' && p.project.assets.some(asset => asset.id === id && asset.mediaType !== 'audio'))) p.onAdd(ids, beforeId); } catch { /* Ignore malformed external drag payloads. */ }
    }
  };
  const target = (event: DragEvent, index: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left + rect.width / 2 ? entries[index].id : entries[index + 1]?.id;
  };
  const slot = (beforeId?: string) => <button className={`lesson-timeline-slot${dropId === (beforeId ?? 'end') ? ' is-drop' : ''}`} aria-label={beforeId ? 'Insert scene here' : 'Add scene at end'} title="Add a blank scene, or drop media here"
    onClick={() => p.onAdd(undefined, beforeId)} onDragOver={event => accept(event, beforeId)} onDrop={event => drop(event, beforeId)}>+</button>;
  return <nav className="lesson-timeline" aria-label={`${p.sequence === 'story' ? 'Story' : 'Activation'} timeline`} data-density={density} style={{ '--lesson-tile-width': `${Math.round(156 * zoom)}px` } as CSSProperties}>
    <header className="lesson-timeline-toolbar"><strong>{p.sequence === 'story' ? 'Story' : 'Activation'} · {entries.length} scenes</strong>{!p.readOnly && <><button onClick={() => p.onAdd()}>+ Scene</button>
      <div className="lesson-actions"><button disabled={selectedIndex <= 0} onClick={() => { if (selected) p.onReorder(selected.id, entries[selectedIndex - 1].id); }} aria-label="Move scene earlier">←</button><button disabled={selectedIndex < 0 || selectedIndex >= entries.length - 1} onClick={() => { if (selected) p.onReorder(selected.id, entries[selectedIndex + 2]?.id); }} aria-label="Move scene later">→</button>
        <button disabled={!selected} onClick={() => { if (selected) p.onCopy(selected.id, false); }}>Duplicate scene</button>
        <details className="lesson-timeline-menu"><summary aria-label="More scene actions">More</summary><div><button disabled={!selected} onClick={() => { if (selected) p.onCopy(selected.id, true); }}>Reuse linked scene</button><button disabled={!selected} onClick={() => { if (!selected) return; const name = window.prompt('Section label (leave blank for no section)', selected.section); if (name !== null) p.onSection(selected.id, name.trim()); }}>Section label…</button><button className="lesson-danger" disabled={!selected} onClick={() => { if (selected) p.onDelete(selected.id); }}>Remove scene</button></div></details>
      </div></>}
      <label className="lesson-timeline-zoom"><span>Timeline zoom</span><input type="range" min=".45" max="2.6" step=".05" value={zoom} onChange={event => changeZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label>
    </header>
    <div className="lesson-timeline-strip" ref={strip} onDragEnd={() => setDropId(null)} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropId(null); }}
      onPointerDown={event => { if (event.button !== 1) return; event.preventDefault(); pan.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.scroll + pan.current.x - event.clientX; }}
      onPointerUp={event => { pan.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onLostPointerCapture={() => { pan.current = null; }} onAuxClick={event => { if (event.button === 1) event.preventDefault(); }}>
      {entries.map((entry, index) => {
        const scene = p.project.scenes[entry.sceneId];
        const asset = p.project.assets.find(item => item.id === scene?.background.assetId);
        const isEdit = entry.id === p.selectedEntryId, isLive = p.live?.sequence === p.sequence && p.live.entryId === entry.id;
        const linked = Object.values(p.project.sequences).flat().filter(item => item.sceneId === entry.sceneId).length > 1;
        return <div key={entry.id} className="lesson-timeline-pair">{!p.readOnly && slot(entry.id)}<div className="lesson-timeline-entry"><span className="lesson-section-label">{entry.section !== entries[index - 1]?.section ? entry.section || 'Lesson' : '\u00a0'}</span><button className={`lesson-timeline-item${isEdit ? ' is-edit' : ''}${isLive ? ' is-live' : ''}${dropId === entry.id ? ' drop-before' : ''}`} data-entry-id={entry.id}
          aria-label={`${index + 1}. ${scene?.title || 'Missing scene'}${linked ? ', shared scene' : ''}`} aria-current={isEdit ? 'step' : undefined} draggable={!p.readOnly} onClick={() => p.onSelect(entry.id)}
          onDragStart={event => { event.dataTransfer.setData(LESSON_ENTRY_DRAG, entry.id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={event => accept(event, target(event, index))} onDrop={event => drop(event, target(event, index))}
          onKeyDown={event => { if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); p.onSelect(entries[index - 1].id); } if (event.key === 'ArrowRight' && index < entries.length - 1) { event.preventDefault(); p.onSelect(entries[index + 1].id); } }}>
          <span className="lesson-timeline-markers">{isEdit && !p.readOnly && <b className="lesson-edit-marker">EDIT</b>}{isLive && <b className="lesson-live-marker">LIVE</b>}</span>
          {density !== 'overview' && <span className="lesson-timeline-thumb" style={{ background: scene?.background.color ?? '#0a0a0a', aspectRatio: scene ? `${scene.frame.width}/${scene.frame.height}` : undefined }}>{density === 'frame' && scene ? <SceneSurface plan={projectScene(p.project, scene.id, undefined, id => { const item = p.project.assets.find(value => value.id === id); return item && lessonMediaUrl(item.relativePath, p.project.id); })!} surface="present" video={asset?.mediaType === 'video' ? <video src={lessonMediaUrl(asset.relativePath, p.project.id)} muted preload="metadata" /> : undefined} /> : asset?.mediaType === 'image' ? <img src={lessonMediaUrl(asset.relativePath, p.project.id)} alt="" draggable={false} /> : asset?.mediaType === 'video' ? <video src={lessonMediaUrl(asset.relativePath, p.project.id)} muted preload="metadata" /> : <span>{scene?.objects.length ? `${scene.objects.length} objects` : 'Blank scene'}</span>}</span>}
          <strong>{scene?.title || 'Missing scene'}</strong><small>{index + 1}{linked ? ' · Shared' : ''}{asset ? ` · ${asset.mediaType}` : ''}</small>
          {(density === 'detail' || density === 'frame') && scene && <span className="lesson-timeline-details">{scene.objects.filter(object => object.kind === 'card').length} cards · {scene.objects.filter(object => object.kind === 'bubble' || object.kind === 'text').length} text · {scene.audio.length} audio{scene.transition.kind === 'fade' ? ' · Fade' : ''}</span>}
        </button></div></div>;
      })}{!p.readOnly && slot()}{!entries.length && <p className="lesson-timeline-empty">{p.readOnly ? 'This sequence has no scenes yet.' : 'Drop media here, or add a blank scene.'}</p>}
    </div><footer className="lesson-hint">Wheel or middle-drag to pan · Alt + wheel to zoom · EDIT and LIVE are independent</footer>
  </nav>;
}
