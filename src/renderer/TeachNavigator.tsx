import { navigatorWheelDelta, teachNavigatorRows } from '../shared/teachWorkspace';
import { useLayoutEffect, useRef, useState, type MouseEvent, type CSSProperties } from 'react';
import type { PresentationSession, PresentationTarget } from '../shared/presentationSession';
import type { ProjectData, SequenceItem, Slide } from '../shared/types';
import './TeachNavigator.css';

export interface TeachNavigatorProps {
  edit?: boolean;
  selectedIds?: ReadonlySet<string>;
  data: ProjectData | null;
  session: PresentationSession;
  target: PresentationTarget;
  onSlide: (id: string, event?: MouseEvent) => void;
  onSection: (id: string) => void;
  onBoostItem: (id: string) => void;
  resolveImage: (assetId: string) => string | null;
}

/** An operational cursor into the presentation; never owns editor selection. */
export function TeachNavigator({ edit = false, selectedIds, data, session, target, onSlide, onSection, onBoostItem, resolveImage }: TeachNavigatorProps) {
  const strip = useRef<HTMLDivElement>(null);
  const liveItem = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState(1);
  const itemGridStyle = (count: number) => ({ "--teach-nav-columns": Math.max(1, Math.ceil(count / rows)) } as CSSProperties);
  useLayoutEffect(() => {
    const container = strip.current;
    if (!container) return;
    // Reserve section heading, spacing, padding and the horizontal scrollbar.
    const measure = () => setRows(teachNavigatorRows(container.clientHeight - 45));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || container.scrollWidth <= container.clientWidth) return;
      const delta = navigatorWheelDelta(event.deltaX, event.deltaY, event.deltaMode, container.clientWidth);
      if (!delta) return;
      event.preventDefault(); event.stopPropagation();
      container.scrollLeft += delta;
    };
    container.addEventListener('wheel', scroll, { passive: false });
    return () => { observer.disconnect(); container.removeEventListener('wheel', scroll); };
  }, []);
  useLayoutEffect(() => {
    const container = strip.current;
    const live = liveItem.current;
    if (!container || !live) return;
    const reveal = () => {
      const bounds = container.getBoundingClientRect();
      const item = live.getBoundingClientRect();
      // Only move this strip. scrollIntoView can move the entire teaching surface.
      if (item.left < bounds.left) container.scrollLeft += item.left - bounds.left - 8;
      else if (item.right > bounds.right) container.scrollLeft += item.right - bounds.right + 8;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
  }, [target.occurrenceId, data, session.mode, session.boostTab, rows]);

  const storyMode = ['story', 'movement', 'relics'].includes(session.mode);
  const boostMode = session.mode === 'boost' && session.boostTab !== 'badge';
  const slideView = (slide: Slide | undefined, fallback: string) => {
    const asset = data?.assets.find(candidate => candidate.id === slide?.assetId);
    const image = asset?.mediaType === 'image' && slide ? resolveImage(slide.assetId) : null;
    return <>
      <span className="teach-nav-preview" aria-hidden="true">
        {image ? <img src={image} alt="" loading="lazy" draggable={false} /> : <span>{asset?.mediaType === 'video' ? '▶ Video' : slide ? 'Slide' : 'Missing slide'}</span>}
      </span>
      <span className="teach-nav-name">{slide?.name || asset?.originalName || fallback}</span>
    </>;
  };
  const boostView = (item: SequenceItem, index: number) => {
    if (item.type === 'cardActivityRef') return <><span className="teach-nav-preview" aria-hidden="true">Cards</span><span className="teach-nav-name">{data?.cardsV2?.placements[item.placementId]?.label ?? 'Missing card activity'}</span></>;
    if (item.type === 'slideRef') return slideView(data?.slides.find(slide => slide.id === item.slideId), `Slide ${index + 1}`);
    const section = item.type === 'breakRef' ? data?.sections.find(section => section.id === item.breakId && section.type === 'break') : null;
    const board = item.type === 'aCardRef' ? data?.aCardLibrary?.[item.aCardId] : null;
    const type = item.type === 'breakRef' ? 'Break' : item.type === 'aCardRef' ? 'Board' : item.type === 'promptCard' ? 'Prompt' : 'Activity';
    const name = item.type === 'breakRef' ? section?.name || 'Missing break'
      : item.type === 'aCardRef' ? board?.name || 'Missing board'
      : item.type === 'promptCard' ? item.title || item.body || 'Prompt' : 'Activity';
    return <><span className={`teach-nav-preview teach-nav-preview--${type.toLowerCase()}`} aria-hidden="true">{type}</span><span className="teach-nav-name">{name}</span></>;
  };

  return <nav className="teach-navigator" aria-label={edit ? "Edit lesson timeline" : "Live presentation navigation"} style={{"--teach-nav-rows":rows} as CSSProperties} data-rows={rows}>
    <div className="teach-nav-heading"><span>{boostMode ? `${session.boostTab[0].toUpperCase()}${session.boostTab.slice(1)} sequence` : 'Lesson timeline'}</span><span className="teach-nav-hint">{rows > 1 ? 'Read across, then down within each section · ' : 'Earlier ← · Scroll to browse · → Later · '} {edit ? 'Select to edit' : 'Select to present'}</span>
    {data && !boostMode && <label className="teach-nav-jump">Section <select aria-label="Jump to section" value={target.section?.id ?? ''} onChange={event => onSection(event.target.value)}><option value="" disabled>Choose section</option>{data.sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>}</div>
    <div className="teach-nav-strip" ref={strip}>
      {!data ? <p className="teach-nav-empty">Open a project to navigate.</p>
        : boostMode ? <div className="teach-nav-group" role="group" aria-label={`${session.boostTab} sequence`}>
          <div className="teach-nav-items" style={itemGridStyle(target.sequence.length)}>{target.sequence.map((item, index) => {
            // Item identity matters: multiple occurrences can reference the same slide.
            const live = target.item?.id === item.id;
            return <button type="button" key={item.id} ref={live ? liveItem : undefined} className={`teach-nav-item${live ? ' is-live' : ''}`} aria-current={live ? 'step' : undefined} onClick={() => onBoostItem(item.id)}>
              {boostView(item, index)}<span className="teach-nav-status">{live ? (edit ? 'SELECTED' : 'LIVE') : `${index + 1}`}</span>
            </button>;
          })}</div>
          {!target.sequence.length && <p className="teach-nav-empty">No items in this sequence.</p>}
        </div>
        : data.sections.map(section => {
          const slides = data.slides.filter(slide => slide.sectionId === section.id);
          const liveBreak = storyMode && target.kind === 'break' && target.contentId === section.id;
          return <div className="teach-nav-group" key={section.id} role="group" aria-label={section.name}>
            <button className="teach-nav-section-name" onClick={() => onSection(section.id)}>{section.name}</button>
            <div className="teach-nav-items" style={itemGridStyle(section.type === 'break' ? 1 : slides.length)}>{section.type === 'break'
              ? <button type="button" ref={liveBreak ? liveItem : undefined} className={`teach-nav-item teach-nav-item--break${liveBreak ? ' is-live' : ''}`} aria-current={liveBreak ? 'step' : undefined} onClick={() => onSection(section.id)}>
                <span className="teach-nav-preview teach-nav-preview--break" aria-hidden="true">Break</span><span className="teach-nav-name">{section.name}</span><span className="teach-nav-status">{liveBreak ? (edit ? 'SELECTED' : 'LIVE') : 'Break'}</span>
              </button>
              : slides.map((slide, index) => {
                const live = storyMode && target.kind === 'slide' && target.contentId === slide.id;
                const selected = edit && selectedIds?.has(slide.id);
                return <button type="button" key={slide.id} ref={live ? liveItem : undefined} className={`teach-nav-item${live ? ' is-live' : ''}${selected ? ' is-selected' : ''}`} aria-current={live ? 'step' : undefined} onClick={event => onSlide(slide.id, event)}>
                  {slideView(slide, `Slide ${index + 1}`)}<span className="teach-nav-status">{live ? (edit ? 'CURRENT' : 'LIVE') : selected ? 'SELECTED' : `${index + 1}`} · {data.assets.find(asset => asset.id === slide.assetId)?.mediaType === 'video' ? 'Video' : 'Image'}</span>
                </button>;
              })}</div>
            {section.type !== 'break' && !slides.length && <span className="teach-nav-empty">No slides</span>}
          </div>;
        })}
      {data && !boostMode && !data.sections.length && <p className="teach-nav-empty">No story sections.</p>}
    </div>
  </nav>;
}
