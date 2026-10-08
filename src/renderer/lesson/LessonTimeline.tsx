import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import type { LessonLocation, LessonProject, SequenceKind } from '../../shared/lesson/model';
import { timelineDensity, timelineZoom } from '../../shared/lessonTimeline';
import { LESSON_ASSET_DRAG, LESSON_ENTRY_DRAG, lessonMediaUrl } from './LessonMediaPool';
import { projectScene } from '../../shared/lesson/projection';
import { SceneSurface } from './SceneSurface';
import { addSection, renameSection, moveEntryToSection, insertBreak } from '../../shared/lesson/sections';
import { createScene, insertScene } from '../../shared/lesson/commands';

export interface LessonTimelineProps {
  project: LessonProject; sequence: SequenceKind; selectedEntryId: string | null; live: LessonLocation | null;
  readOnly?: boolean;
  onProjectChange?: (project: LessonProject) => void;
  onCardDrop?: (objectId: string, entryId: string) => void;
  onSelect: (entryId: string) => void;
  onAdd: (assetIds?: string[], beforeEntryId?: string) => void;
  onReorder: (entryId: string, beforeEntryId?: string) => void;
  onDelete: (entryId: string) => void;
  onCopy: (entryId: string, linked: boolean) => void;
  onSection: (entryId: string, section: string) => void;
}

/** Both lesson sequences use this same structural timeline. */
export function LessonTimeline(p: LessonTimelineProps) {
  const [sectionDraft, setSectionDraft] = useState<{ id?: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => void) => { try { action(); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the timeline.'); } };
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [dropId, setDropId] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; scroll: number } | null>(null);
  const anchor = useRef<{ id: string; fraction: number; pointer: number } | null>(null);
  const entries = p.project.sequences[p.sequence];
  const sections = p.project.sections?.filter(s => s.sequence === p.sequence) ?? [];
  const addWithin = (sectionId: string, isBreak: boolean) => run(() => {
    if (!p.onProjectChange) return;
    const added = isBreak ? insertBreak(p.project, p.sequence, undefined, sectionId) : insertScene(p.project, p.sequence, createScene());
    p.onProjectChange(isBreak ? added.project : moveEntryToSection(added.project, p.sequence, added.entryId, sectionId)); p.onSelect(added.entryId);
  });
  useEffect(() => { const cancel = () => { pan.current = null; setDropId(null); }; window.addEventListener('blur', cancel); return () => window.removeEventListener('blur', cancel); }, []);
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
      if (entries.some(entry => entry.id === id) && id !== beforeId) run(() => {
        if (p.onProjectChange) { const target = beforeId ? entries.find(entry => entry.id === beforeId) : entries[entries.length - 1]; p.onProjectChange(moveEntryToSection(p.project, p.sequence, id, target?.sectionId, beforeId)); }
        else p.onReorder(id, beforeId);
      });
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
    <header className="lesson-timeline-toolbar"><strong>{p.sequence === 'story' ? 'Story' : 'Activation'} · {entries.length} scenes</strong>{!p.readOnly && <><button onClick={() => p.onAdd()}>+ Scene</button>{p.onProjectChange && <><button onClick={() => run(() => { const added = insertBreak(p.project, p.sequence, selected?.id, selected?.sectionId); p.onProjectChange!(added.project); p.onSelect(added.entryId); })}>+ Break</button><button onClick={() => setSectionDraft({ name: '' })}>+ Section</button><label>Section <select aria-label="Move scene to section" disabled={!selected} value={selected?.sectionId ?? ''} onChange={event => run(() => { if (selected) p.onProjectChange!(moveEntryToSection(p.project, p.sequence, selected.id, event.target.value || undefined)); })}><option value="">Ungrouped</option>{sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label></>}
      <div className="lesson-actions"><button disabled={selectedIndex <= 0 || entries[selectedIndex - 1]?.sectionId !== selected?.sectionId} onClick={() => { if (selected) p.onReorder(selected.id, entries[selectedIndex - 1].id); }} aria-label="Move scene earlier">←</button><button disabled={selectedIndex < 0 || selectedIndex >= entries.length - 1 || entries[selectedIndex + 1]?.sectionId !== selected?.sectionId} onClick={() => { if (selected) p.onReorder(selected.id, entries[selectedIndex + 2]?.id); }} aria-label="Move scene later">→</button>
        <button disabled={!selected} onClick={() => { if (selected) p.onCopy(selected.id, false); }}>Duplicate scene</button>
        <button disabled={!selected} onClick={() => { if (selected) p.onCopy(selected.id, true); }}>Reuse linked scene</button><button className="lesson-danger" disabled={!selected} onClick={() => { if (selected) p.onDelete(selected.id); }}>Remove scene</button>
      </div></>}
      <label className="lesson-timeline-zoom"><span>Timeline zoom</span><input aria-label="Timeline zoom" type="range" min=".45" max="2.6" step=".05" value={zoom} onChange={event => changeZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label>
    </header>
    {sectionDraft && !p.readOnly && p.onProjectChange && <form className="lesson-section-form" onSubmit={event => { event.preventDefault(); run(() => { const name = sectionDraft.name.trim(); if (!name) throw new Error('Enter a section name.'); p.onProjectChange!(sectionDraft.id ? renameSection(p.project, sectionDraft.id, name) : addSection(p.project, p.sequence, name).project); setSectionDraft(null); }); }}><label>Section name <input autoFocus maxLength={500} value={sectionDraft.name} onChange={event => setSectionDraft({ ...sectionDraft, name: event.target.value })} /></label><button type="submit">Save section</button><button type="button" onClick={() => { setSectionDraft(null); setError(null); }}>Cancel</button></form>}
    {error && <p role="alert" className="lesson-error">{error}</p>}
      <div className="lesson-section-navigation">{sections.map(section => <div key={section.id} className="lesson-section-group" data-section-id={section.id}><button aria-expanded={!collapsed.has(section.id)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}>{collapsed.has(section.id) ? '+' : '−'} {section.name} ({entries.filter(e => e.sectionId === section.id).length})</button><button disabled={!entries.some(e => e.sectionId === section.id)} onClick={() => { const first = entries.find(e => e.sectionId === section.id); if (first) { setCollapsed(previous => { const next = new Set(previous); next.delete(section.id); return next; }); p.onSelect(first.id); } }}>Go to section</button>{!p.readOnly && p.onProjectChange && <><button onClick={() => setSectionDraft({ id: section.id, name: section.name })}>Rename</button><button onClick={() => addWithin(section.id, false)}>+ Scene</button><button onClick={() => addWithin(section.id, true)}>+ Break</button></>}</div>)}</div>
    <div className="lesson-timeline-strip" ref={strip} onDragEnd={() => setDropId(null)} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropId(null); }}
      onPointerDown={event => { if (event.button !== 1) return; event.preventDefault(); pan.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.scroll + pan.current.x - event.clientX; }}
      onPointerUp={event => { pan.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { pan.current = null; setDropId(null); }} onLostPointerCapture={() => { pan.current = null; }} onAuxClick={event => { if (event.button === 1) event.preventDefault(); }}>
      {entries.map((entry, index) => {
        if (entry.sectionId && collapsed.has(entry.sectionId)) return null;
        const scene = p.project.scenes[entry.sceneId];
        const asset = p.project.assets.find(item => item.id === scene?.background.assetId);
        const isEdit = entry.id === p.selectedEntryId, isLive = p.live?.sequence === p.sequence && p.live.entryId === entry.id;
        const linked = Object.values(p.project.sequences).flat().filter(item => item.sceneId === entry.sceneId).length > 1;
        return <div key={entry.id} className="lesson-timeline-pair">{!p.readOnly && slot(entry.id)}<div className="lesson-timeline-entry"><span className="lesson-section-label">{entry.sectionId ? sections.find(s => s.id === entry.sectionId)?.name : entry.section || 'Ungrouped'}</span><button className={`lesson-timeline-item${entry.kind === 'break' ? ' is-break' : ''}${isEdit ? ' is-edit' : ''}${isLive ? ' is-live' : ''}${dropId === entry.id ? ' drop-before' : ''}`} data-entry-id={entry.id}
          aria-label={`${index + 1}. ${scene?.title || 'Missing scene'}${linked ? ', shared scene' : ''}`} aria-current={isEdit ? 'step' : undefined} draggable={!p.readOnly} onClick={() => p.onSelect(entry.id)}
          onDragStart={event => { event.dataTransfer.setData(LESSON_ENTRY_DRAG, entry.id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={event => accept(event, target(event, index))} onDrop={event => drop(event, target(event, index))}
          onKeyDown={event => { if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); p.onSelect(entries[index - 1].id); } if (event.key === 'ArrowRight' && index < entries.length - 1) { event.preventDefault(); p.onSelect(entries[index + 1].id); } }}>
          <span className="lesson-timeline-markers">{isEdit && !p.readOnly && <b className="lesson-edit-marker">EDIT</b>}{isLive && <b className="lesson-live-marker">LIVE</b>}</span>
          {density !== 'overview' && <span className="lesson-timeline-thumb" style={{ background: scene?.background.color ?? '#0a0a0a', aspectRatio: scene ? `${scene.frame.width}/${scene.frame.height}` : undefined }}>{density === 'frame' && scene ? <SceneSurface plan={projectScene(p.project, scene.id, undefined, id => { const item = p.project.assets.find(value => value.id === id); return item && lessonMediaUrl(item.relativePath, p.project.id); })!} surface="present" video={asset?.mediaType === 'video' ? <video src={lessonMediaUrl(asset.relativePath, p.project.id)} muted preload="metadata" /> : undefined} /> : asset?.mediaType === 'image' ? <img src={lessonMediaUrl(asset.relativePath, p.project.id)} alt="" draggable={false} /> : asset?.mediaType === 'video' ? <video src={lessonMediaUrl(asset.relativePath, p.project.id)} muted preload="metadata" /> : <span>{scene?.objects.length ? `${scene.objects.length} objects` : 'Blank scene'}</span>}</span>}
          <strong>{entry.kind === 'break' ? 'Break · ' : ''}{scene?.title || 'Missing scene'}</strong><small>{index + 1}{linked ? ' · Shared' : ''}{asset ? ` · ${asset.mediaType}` : ''}</small>
          {(density === 'detail' || density === 'frame') && scene && <span className="lesson-timeline-details">{scene.objects.filter(object => object.kind === 'card').length} cards · {scene.objects.filter(object => object.kind === 'bubble' || object.kind === 'text').length} text · {scene.audio.length} audio{scene.transition.kind === 'fade' ? ' · Fade' : ''}</span>}
        </button></div></div>;
      })}{!p.readOnly && slot()}{!entries.length && <p className="lesson-timeline-empty">{p.readOnly ? 'This sequence has no scenes yet.' : 'Drop media here, or add a blank scene.'}</p>}
    </div><footer className="lesson-hint">Wheel or middle-drag to pan · Alt + wheel to zoom · EDIT and LIVE are independent</footer>
  </nav>;
}
