import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react';
import type { LessonLocation, LessonProject, SequenceKind } from '../../shared/lesson/model';
import { timelineDensity, timelineZoom } from '../../shared/lessonTimeline';
import { LESSON_ASSET_DRAG, LESSON_ENTRY_DRAG } from './LessonMediaPool';
import { projectScene } from '../../shared/lesson/projection';
import { SceneSurface } from './SceneSurface';
import { addSection, renameSection, moveEntryToSection, insertBreak, insertSectionMedia, moveSection, timelineGroups, timelineGroupBoundary, moveTimelineEntries } from '../../shared/lesson/sections';
import { copyScene, duplicateEntry, removeEntry } from '../../shared/lesson/commands';
import './timelineContainers.css';

export interface LessonTimelineProps {
  project: LessonProject; sequence: SequenceKind; selectedEntryId: string | null; live: LessonLocation | null;
  resolveAsset: (id: string) => string | undefined;
  readOnly?: boolean;
  onProjectChange?: (project: LessonProject) => void;
  onCardDrop?: (objectId: string, entryId: string) => void;
  onSelect: (entryId: string) => void;
  onAdd: (assetIds?: string[], beforeEntryId?: string) => void;
  onReorder: (entryId: string, beforeEntryId?: string) => void;
  onDelete: (entryId: string) => void;
  onCopy: (entryId: string, linked: boolean) => void;
  onHistory?: (direction: 'undo' | 'redo') => void;
  onCopyToActivation?: (entryId: string, linked: boolean) => void;
  onSection: (entryId: string, section: string) => void;
}
const SECTION_DRAG = 'application/x-story-studio-section';
export function LessonTimeline(p: LessonTimelineProps) {
  const [draft, setDraft] = useState<{ id?: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(p.selectedEntryId ? [p.selectedEntryId] : []);
  const [menu, setMenu] = useState<{ x: number; y: number; sectionId?: string; entryId?: string } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const clipboard = useRef<{ project: LessonProject; ids: string[]; sequence: SequenceKind; cut: boolean } | null>(null);
  const selectionAnchor = useRef<string | null>(p.selectedEntryId);
  const strip = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; scroll: number } | null>(null);
  const box = useRef<{ x: number; y: number; base: string[] } | null>(null);
  const anchor = useRef<{ id: string; fraction: number; pointer: number } | null>(null);
  const entries = p.project.sequences[p.sequence];
  const sections = p.project.sections?.filter(s => s.sequence === p.sequence) ?? [];
  const groups = timelineGroups(p.project, p.sequence);
  const sectionOrder = [...new Set(groups.map(g => g.sectionId).filter((id): id is string => !!id))];
  const density = timelineDensity(zoom);
  const run = (action: () => void) => { try { action(); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the timeline.'); } };
  useEffect(() => { setSelectedIds(previous => p.selectedEntryId && !previous.includes(p.selectedEntryId) ? [p.selectedEntryId] : previous.filter(id => entries.some(e => e.id === id))); }, [p.selectedEntryId, p.sequence, p.project]);
  useEffect(() => { const cancel = () => { pan.current = null; box.current = null; setMarquee(null); setDropKey(null); setMenu(null); }; window.addEventListener('blur', cancel); return () => window.removeEventListener('blur', cancel); }, []);
  const select = (id: string, event?: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    if (event?.shiftKey && selectionAnchor.current) { const a = entries.findIndex(e => e.id === selectionAnchor.current), b = entries.findIndex(e => e.id === id); setSelectedIds(entries.slice(Math.min(a, b), Math.max(a, b) + 1).map(e => e.id)); }
    else if (event?.ctrlKey || event?.metaKey) setSelectedIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
    else { setSelectedIds([id]); selectionAnchor.current = id; }
    if (!(event?.ctrlKey || event?.metaKey) || !selectedIds.includes(id)) p.onSelect(id);
  };
  const add = (sectionId?: string, beforeId?: string, assetIds: string[] = []) => run(() => {
    if (!p.onProjectChange) { p.onAdd(assetIds.length ? assetIds : undefined, beforeId); return; }
    const added = insertSectionMedia(p.project, p.sequence, assetIds, sectionId, beforeId);
    p.onProjectChange(added.project); select(added.entryIds[0]);
  });
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
    const node = strip.current; if (!node) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); event.stopPropagation(); if (event.altKey) changeZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX); else node.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1); };
    node.addEventListener('wheel', wheel, { passive: false }); return () => node.removeEventListener('wheel', wheel);
  }, [zoom]);
  useLayoutEffect(() => { const current = anchor.current, node = strip.current; if (!current || !node) return; const child = Array.from(node.querySelectorAll<HTMLElement>('[data-entry-id]')).find(item => item.dataset.entryId === current.id); if (child) { const rect = child.getBoundingClientRect(); node.scrollLeft += rect.left - node.getBoundingClientRect().left + rect.width * current.fraction - current.pointer; } anchor.current = null; }, [zoom]);
  const accepts = (event: DragEvent) => !p.readOnly && [LESSON_ASSET_DRAG, LESSON_ENTRY_DRAG, SECTION_DRAG].some(type => event.dataTransfer.types.includes(type));
  const accept = (event: DragEvent, sectionId?: string, beforeId?: string) => { if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); const node = strip.current; if (node) { const bounds = node.getBoundingClientRect(); if (event.clientX < bounds.left + 55) node.scrollLeft -= 28; else if (event.clientX > bounds.right - 55) node.scrollLeft += 28; } setDropKey(beforeId ?? sectionId ?? 'ungrouped'); event.dataTransfer.dropEffect = event.dataTransfer.types.includes(LESSON_ASSET_DRAG) ? 'copy' : 'move'; };
  const drop = (event: DragEvent, sectionId?: string, beforeId?: string, sectionBeforeEntryId?: string) => {
    if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); setDropKey(null);
    run(() => {
      if (event.dataTransfer.types.includes(SECTION_DRAG)) { const id = event.dataTransfer.getData(SECTION_DRAG); if (p.onProjectChange) p.onProjectChange(moveSection(p.project, p.sequence, id, sectionId, sectionBeforeEntryId)); }
      else if (event.dataTransfer.types.includes(LESSON_ENTRY_DRAG)) {
        const id = event.dataTransfer.getData(LESSON_ENTRY_DRAG), ids = selectedIds.includes(id) ? entries.filter(e => selectedIds.includes(e.id)).map(e => e.id) : [id];
        if (beforeId && ids.includes(beforeId)) return;
        let next = p.project; for (const entryId of ids) next = moveEntryToSection(next, p.sequence, entryId, sectionId, beforeId);
        p.onProjectChange?.(next);
      } else {
        let ids: unknown; try { ids = JSON.parse(event.dataTransfer.getData(LESSON_ASSET_DRAG)); } catch { return; }
        if (Array.isArray(ids) && ids.length && ids.every(id => typeof id === 'string')) add(sectionId, beforeId, ids);
      }
    });
  };
  const batch = (kind: 'delete' | 'duplicate' | 'linked', ids = selectedIds) => run(() => {
    if (p.readOnly || !p.onProjectChange) return;
    let next = p.project; const created: string[] = [];
    for (const id of entries.filter(e => ids.includes(e.id)).map(e => e.id)) {
      if (kind === 'delete') next = removeEntry(next, p.sequence, id);
      else { const result = duplicateEntry(next, p.sequence, id, p.sequence, kind === 'linked'); next = result.project; created.push(result.entryId); }
    }
    p.onProjectChange(next); if (created.length) { setSelectedIds(created); p.onSelect(created[0]); } else { const remaining = next.sequences[p.sequence]; const oldIndex = entries.findIndex(e => e.id === p.selectedEntryId); const neighbor = remaining[Math.min(Math.max(oldIndex, 0), remaining.length - 1)]; setSelectedIds(neighbor ? [neighbor.id] : []); if (neighbor) p.onSelect(neighbor.id); } setMenu(null);
  });
  const paste = () => run(() => {
    const copied = clipboard.current; if (!copied || !p.onProjectChange || p.readOnly || copied.project.id !== p.project.id) return;
    let next = p.project; const ids: string[] = [], destination = entries.find(e => e.id === p.selectedEntryId)?.sectionId;
    if (copied.cut) { next = moveTimelineEntries(next, copied.sequence, p.sequence, copied.ids, destination, p.selectedEntryId ?? undefined); ids.push(...copied.ids.filter(id => next.sequences[p.sequence].some(e => e.id === id))); clipboard.current = null; }
    else for (const id of copied.ids) { const source = copied.project.sequences[copied.sequence].find(e => e.id === id); if (!source) continue; const snapshot = { ...next, scenes: { ...next.scenes, [source.sceneId]: copied.project.scenes[source.sceneId] }, cards: { ...next.cards, ...copied.project.cards } }; const result = copyScene(snapshot, source.sceneId, p.sequence, false); const newSceneId = result.project.sequences[p.sequence].find(e => e.id === result.entryId)!.sceneId; next = { ...result.project, scenes: { ...next.scenes, [newSceneId]: result.project.scenes[newSceneId] }, cards: { ...result.project.cards, ...next.cards } }; next = moveEntryToSection(next, p.sequence, result.entryId, destination, p.selectedEntryId ?? undefined); next = { ...next, sequences: { ...next.sequences, [p.sequence]: next.sequences[p.sequence].map(e => e.id === result.entryId ? { ...e, kind: source.kind } : e) } }; if (copied.cut) next = removeEntry(next, copied.sequence, id); ids.push(result.entryId); }
    p.onProjectChange(next); setSelectedIds(ids); if (ids[0]) p.onSelect(ids[0]);
  });
  const openMenu = (event: MouseEvent, entryId?: string, sectionId?: string) => { event.preventDefault(); event.stopPropagation(); if (entryId && !selectedIds.includes(entryId)) select(entryId); setMenu({ x: Math.min(event.clientX, window.innerWidth - 210), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 250)), entryId, sectionId }); };
  return <nav className="lesson-timeline lesson-container-timeline" aria-label={`${p.sequence === 'story' ? 'Adventure' : 'Discovery'} timeline`} data-density={density} style={{ '--lesson-tile-width': `${Math.round(156 * zoom)}px` } as CSSProperties}
    onKeyDown={event => {
      if (event.key === 'Escape') { setMenu(null); setSelectedIds([]); event.stopPropagation(); return; }
      if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable=true], [role=menu]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); const index = entries.findIndex(e => e.id === p.selectedEntryId), next = entries[index + (event.key === 'ArrowLeft' ? -1 : 1)]; if (next) select(next.id, event); return; }
      if (p.readOnly) return;
      const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (mod && (key === 'z' || key === 'y')) { event.preventDefault(); event.stopPropagation(); p.onHistory?.(key === 'y' || event.shiftKey ? 'redo' : 'undo'); }
      else if (mod && ['a','c','x','v','d'].includes(key)) { event.preventDefault(); event.stopPropagation(); if (key === 'a') setSelectedIds(entries.map(e => e.id)); if (key === 'c' || key === 'x') clipboard.current = { project: structuredClone(p.project), sequence: p.sequence, ids: entries.filter(entry => selectedIds.includes(entry.id)).map(entry => entry.id), cut: key === 'x' }; if (key === 'v') paste(); if (key === 'd') batch('duplicate'); }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); batch('delete'); }
      else if (event.key === 'Escape') { setSelectedIds([]); setMenu(null); event.stopPropagation(); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); const index = entries.findIndex(e => e.id === p.selectedEntryId), next = entries[index + (event.key === 'ArrowLeft' ? -1 : 1)]; if (next) select(next.id, event); }
    }}>
    <header className="lesson-timeline-toolbar"><strong>{p.sequence === 'story' ? 'Adventure' : 'Discovery'} <span>· {entries.length} scenes</span></strong>{!p.readOnly && <><button onClick={() => add(entries.find(e => e.id === p.selectedEntryId)?.sectionId)}>+ Scene</button><button onClick={() => setDraft({ name: '' })}>+ Section</button><button aria-label="Timeline actions" onClick={event => openMenu(event, p.selectedEntryId ?? undefined)}>•••</button></>}<span className="lesson-timeline-selection-count">{selectedIds.length > 1 ? `${selectedIds.length} selected` : ''}</span><label className="lesson-timeline-zoom"><span>Zoom</span><input aria-label="Timeline zoom" type="range" min=".45" max="2.6" step=".05" value={zoom} onChange={event => changeZoom(Number(event.target.value))} /><output>{Math.round(zoom * 100)}%</output></label></header>
    {draft && <form className="lesson-section-form" onSubmit={event => { event.preventDefault(); run(() => { if (!draft.name.trim()) throw new Error('Enter a section name.'); p.onProjectChange?.(draft.id ? renameSection(p.project, draft.id, draft.name) : addSection(p.project, p.sequence, draft.name).project); setDraft(null); }); }}><label>Section name <input autoFocus value={draft.name} maxLength={500} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><button>Save section</button><button type="button" onClick={() => setDraft(null)}>Cancel</button></form>}
    {error && <p role="alert" className="lesson-error">{error}</p>}
    <div className="lesson-timeline-strip" ref={strip} tabIndex={0} aria-label="Timeline scenes" onDragEnd={() => setDropKey(null)} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropKey(null); }}
      onPointerDown={event => { setMenu(null); if (event.button === 1) { event.preventDefault(); pan.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); } else if (event.button === 0 && !(event.target as HTMLElement).closest('button, input, .lesson-section-header') && !p.readOnly) { event.preventDefault(); event.currentTarget.focus(); box.current = { x: event.clientX, y: event.clientY, base: event.ctrlKey || event.metaKey || event.shiftKey ? selectedIds : [] }; event.currentTarget.setPointerCapture(event.pointerId); } }}
      onPointerMove={event => { if (pan.current) event.currentTarget.scrollLeft = pan.current.scroll + pan.current.x - event.clientX; const active = box.current; if (active) { const rect = { x: Math.min(active.x, event.clientX), y: Math.min(active.y, event.clientY), width: Math.abs(active.x - event.clientX), height: Math.abs(active.y - event.clientY) }; setMarquee(rect); const hits = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-entry-id]')).filter(node => { const r = node.getBoundingClientRect(); return r.left < rect.x + rect.width && r.right > rect.x && r.top < rect.y + rect.height && r.bottom > rect.y; }).map(node => node.dataset.entryId!); setSelectedIds([...new Set([...active.base, ...hits])]); } }}
      onPointerUp={event => { pan.current = null; box.current = null; setMarquee(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { pan.current = null; box.current = null; setMarquee(null); }} onLostPointerCapture={() => { pan.current = null; box.current = null; setMarquee(null); }} onAuxClick={event => { if (event.button === 1) event.preventDefault(); }}>
      {groups.map(group => { const section = sections.find(s => s.id === group.sectionId), hidden = !!section && collapsed.has(section.id); return <section key={group.key} className={`lesson-section-container${dropKey === (group.sectionId ?? 'ungrouped') ? ' is-drop' : ''}${hidden ? ' is-collapsed' : ''}`} data-section-id={group.sectionId ?? 'ungrouped'} aria-label={section?.name ?? 'Ungrouped'} onDragOver={event => accept(event, group.sectionId)} onDrop={event => drop(event, group.sectionId, timelineGroupBoundary(p.project, p.sequence, group), group.entries[0]?.id)}>
        <header className="lesson-section-header" onContextMenu={event => openMenu(event, undefined, group.sectionId)}>
          {section && <button className="lesson-section-drag-handle" data-section-id={section.id} aria-label={`Move ${section.name}`} title="Drag to move this section and all its scenes" draggable={!p.readOnly} onDragStart={event => { event.dataTransfer.setData(SECTION_DRAG, section.id); event.dataTransfer.effectAllowed = 'move'; }}>⠿</button>}
          <button className="lesson-section-title" aria-expanded={!hidden} onClick={() => section && setCollapsed(previous => { const next = new Set(previous); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}>{section ? hidden ? '▸ ' : '▾ ' : ''}{section?.name ?? 'Ungrouped'} <small>{group.entries.length}</small></button>
          {!p.readOnly && <button aria-label={`Actions for ${section?.name ?? 'Ungrouped'}`} onClick={event => openMenu(event, undefined, group.sectionId)}>•••</button>}
        </header>
        <div className="lesson-section-dropzone" data-section-id={group.sectionId ?? 'ungrouped'} onDragOver={event => accept(event, group.sectionId)} onDrop={event => drop(event, group.sectionId, timelineGroupBoundary(p.project, p.sequence, group), group.entries[0]?.id)}>
          {!hidden && group.entries.map((entry, localIndex) => { const scene = p.project.scenes[entry.sceneId], asset = p.project.assets.find(a => a.id === scene?.background.assetId), index = entries.findIndex(e => e.id === entry.id), isEdit = entry.id === p.selectedEntryId, isLive = p.live?.sequence === p.sequence && p.live.entryId === entry.id, linked = Object.values(p.project.sequences).flat().filter(e => e.sceneId === entry.sceneId).length > 1;
            const before = (event: DragEvent) => event.clientX < event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2 ? entry.id : group.entries[localIndex + 1]?.id ?? timelineGroupBoundary(p.project, p.sequence, group);
            return <button key={entry.id} className={`lesson-timeline-item${entry.kind === 'break' ? ' is-break' : ''}${isEdit ? ' is-edit' : ''}${isLive ? ' is-live' : ''}${selectedIds.includes(entry.id) ? ' is-selected' : ''}${dropKey === entry.id ? ' drop-before' : ''}`} data-entry-id={entry.id} data-selected={selectedIds.includes(entry.id)} aria-label={`${index + 1}. ${scene?.title || 'Missing scene'}${linked ? ', shared scene' : ''}`} aria-current={isEdit ? 'step' : undefined} draggable={!p.readOnly} onClick={event => select(entry.id, event)} onContextMenu={event => openMenu(event, entry.id, group.sectionId)} onDragStart={event => { if (!selectedIds.includes(entry.id)) select(entry.id); event.dataTransfer.setData(LESSON_ENTRY_DRAG, entry.id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={event => accept(event, group.sectionId, before(event))} onDrop={event => drop(event, group.sectionId, before(event))}>
              <span className="lesson-timeline-markers">{isEdit && !p.readOnly && <b className="lesson-edit-marker">EDIT</b>}{isLive && <b className="lesson-live-marker">LIVE</b>}</span>
              {density !== 'overview' && <span className="lesson-timeline-thumb" style={{ background: scene?.background.color ?? '#0a0a0a' }}>{scene ? <SceneSurface plan={projectScene(p.project, scene.id, undefined, p.resolveAsset)!} surface="present" video={asset?.mediaType === 'video' ? <video src={p.resolveAsset(asset.id)} muted preload="metadata" /> : undefined} /> : asset?.mediaType === 'image' ? <img src={p.resolveAsset(asset.id)} alt="" draggable={false} /> : asset?.mediaType === 'video' ? <video src={p.resolveAsset(asset.id)} muted preload="metadata" /> : <span>Missing scene</span>}</span>}
              <strong>{index + 1}. {entry.kind === 'break' ? 'Break · ' : ''}{scene?.title || 'Missing scene'}</strong><small>{linked ? 'Shared · ' : ''}{asset?.mediaType ?? `${scene?.objects.length ?? 0} objects`}</small>
            </button>;
          })}
          {!p.readOnly && <button className="lesson-section-add" aria-label={`Add scene to ${section?.name ?? 'Ungrouped'}`} onClick={() => add(group.sectionId, timelineGroupBoundary(p.project, p.sequence, group))}>{hidden ? 'Drop media here' : group.entries.length ? '+' : 'Drop image or video here'}<small>{!group.entries.length && !hidden ? 'or click to add a scene' : ''}</small></button>}
        </div>
      </section>; })}
      {!p.readOnly && <div className="lesson-section-end" aria-label="Move section to end" onDragOver={event => accept(event)} onDrop={event => drop(event)}>Drop section<br />at end</div>}
    </div>
    <footer className="lesson-hint">Wheel scrolls · Alt + wheel zooms · Middle-drag pans · Shift/Ctrl selects</footer>
    {marquee && <div className="lesson-timeline-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />}
    {menu && <><div className="lesson-timeline-menu-dismiss" onPointerDown={() => setMenu(null)} /><div className="lesson-timeline-context" role="menu" style={{ left: menu.x, top: menu.y }}>
      {!p.readOnly && <><button role="menuitem" onClick={() => { add(menu.sectionId); setMenu(null); }}>Add scene</button><button role="menuitem" onClick={() => run(() => { const result = insertBreak(p.project, p.sequence, menu.entryId, menu.sectionId); p.onProjectChange?.(result.project); select(result.entryId); setMenu(null); })}>Add Break</button>
      {menu.entryId && <><button role="menuitem" onClick={() => batch('duplicate')}>Duplicate selection　Ctrl+D</button><button role="menuitem" onClick={() => batch('linked')}>Reuse linked scenes</button><button role="menuitem" onClick={() => batch('delete')}>Delete selection　Del</button></>}
      {menu.entryId && p.onCopyToActivation && <><button role="menuitem" onClick={() => { p.onCopyToActivation?.(menu.entryId!, false); setMenu(null); }}>Copy to Discovery</button><button role="menuitem" onClick={() => { p.onCopyToActivation?.(menu.entryId!, true); setMenu(null); }}>Reuse linked in Discovery</button></>}{menu.sectionId && <><button role="menuitem" onClick={() => { setDraft({ id: menu.sectionId, name: sections.find(s => s.id === menu.sectionId)?.name ?? '' }); setMenu(null); }}>Rename section</button><button role="menuitem" disabled={groups.findIndex(g => g.sectionId === menu.sectionId) <= 0} onClick={() => run(() => { const index = sectionOrder.indexOf(menu.sectionId!); if (index > 0) p.onProjectChange?.(moveSection(p.project, p.sequence, menu.sectionId!, sectionOrder[index - 1])); setMenu(null); })}>Move section earlier</button><button role="menuitem" onClick={() => run(() => { const index = sectionOrder.indexOf(menu.sectionId!); p.onProjectChange?.(moveSection(p.project, p.sequence, menu.sectionId!, sectionOrder[index + 2])); setMenu(null); })}>Move section later</button></>}
      </>}<button role="menuitem" onClick={() => setMenu(null)}>Close</button></div></>}
  </nav>;
}
