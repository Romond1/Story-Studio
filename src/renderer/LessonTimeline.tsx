import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import type { ProjectData, Section, Slide, SequenceItem } from '../shared/types';
import type { PresentationSession, PresentationTarget } from '../shared/presentationSession';
import { timelineDensity,timelineZoom } from '../shared/lessonTimeline';
import { getAssetDisplayLabel } from '../shared/mediaReferences';
import { POOL_DRAG,SLIDE_DRAG,droppedPaths } from './MediaPool';
import './lessonTimeline.css';

export interface TimelineSlot { sectionId:string; beforeId:string|null }
export interface LessonTimelineProps {
  transport?:ReactNode;onBoostAction?:(action:'duplicate'|'remove'|'earlier'|'later')=>void;
  data:ProjectData; liveActive:boolean; selectedIds?:ReadonlySet<string>; edit:PresentationTarget; live:PresentationTarget; session:PresentationSession;
  onSlide:(id:string,event?:MouseEvent)=>void;onSection:(id:string)=>void;onBoost:(id:string)=>void;
  onPlace:(ids:string[],slot:TimelineSlot)=>void;onFiles:(paths:string[]|undefined,slot:TimelineSlot)=>void;
  onReorder:(id:string,slot:TimelineSlot)=>void;onSectionAdd:(beforeId?:string)=>void;onBreakAdd:(beforeId?:string)=>void;onLessonAdd:()=>void;
  onDelete:(id:string)=>void;onDeleteSection:(id:string)=>void;onDuplicateBreak:(id:string)=>void;onMoveSection:(id:string,direction:'up'|'down')=>void;
  onRename:(id:string,name:string,section:boolean)=>void;onShow:()=>void;
  resolveUrl:(path:string)=>string;preview:(slide:Slide)=>ReactNode; previewActivity:(item:SequenceItem)=>ReactNode;
}
export function LessonTimeline(p:LessonTimelineProps){
  const [zoom,setZoom]=useState(1),[collapsed,setCollapsed]=useState<Set<string>>(new Set()),[drop,setDrop]=useState<string|null>(null);
  const strip=useRef<HTMLDivElement>(null),zoomRef=useRef(zoom),pan=useRef<{x:number;scroll:number}|null>(null);
  const anchor=useRef<{id:string;fraction:number;pointer:number}|null>(null);
  zoomRef.current=zoom;
  const density=timelineDensity(zoom),boost=p.session.mode==='boost'&&p.session.boostTab!=='badge';
  const changeZoom=(next:number,pointer?:number)=>{
    const el=strip.current;if(!el)return;const x=pointer??el.getBoundingClientRect().left+el.clientWidth/2;
    const nodes=Array.from(el.querySelectorAll<HTMLElement>('[data-timeline-anchor]'));
    const node=nodes.find(n=>{const r=n.getBoundingClientRect();return r.left<=x&&r.right>=x;});
    if(node){const r=node.getBoundingClientRect();anchor.current={id:node.dataset.timelineAnchor!,fraction:(x-r.left)/r.width,pointer:x-el.getBoundingClientRect().left};}
    setZoom(timelineZoom(next));
  };
  useLayoutEffect(()=>{const a=anchor.current,el=strip.current;if(!a||!el)return;const node=Array.from(el.querySelectorAll<HTMLElement>('[data-timeline-anchor]')).find(n=>n.dataset.timelineAnchor===a.id);if(node){const r=node.getBoundingClientRect();el.scrollLeft+=r.left-el.getBoundingClientRect().left+r.width*a.fraction-a.pointer;}anchor.current=null;},[zoom]);
  useEffect(()=>{const el=strip.current;if(!el)return;
    const wheel=(e:WheelEvent)=>{if(e.ctrlKey)return;e.preventDefault();e.stopPropagation();if(e.altKey)changeZoom(zoomRef.current*(e.deltaY<0?1.12:1/1.12),e.clientX);else el.scrollLeft+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1)*(e.shiftKey?2:1);};
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[]);
  const acceptsDrop=(e:DragEvent)=>[POOL_DRAG,SLIDE_DRAG,'Files'].some(type=>e.dataTransfer.types.includes(type));
  const acceptDrop=(e:DragEvent,destination:TimelineSlot)=>{
    if(!acceptsDrop(e))return;
    e.preventDefault();e.stopPropagation();setDrop(`${destination.sectionId}:${destination.beforeId??'end'}`);
    e.dataTransfer.dropEffect=e.dataTransfer.types.includes(SLIDE_DRAG)?'move':'copy';
  };
  const performDrop=(e:DragEvent,destination:TimelineSlot)=>{
    if(!acceptsDrop(e))return;
    e.preventDefault();e.stopPropagation();setDrop(null);
    if(e.dataTransfer.types.includes(POOL_DRAG)){
      let ids:unknown;
      try{ids=JSON.parse(e.dataTransfer.getData(POOL_DRAG));}catch{return;}
      if(Array.isArray(ids)&&ids.every(id=>typeof id==='string'))p.onPlace(ids,destination);
    }else if(e.dataTransfer.types.includes(SLIDE_DRAG))p.onReorder(e.dataTransfer.getData(SLIDE_DRAG),destination);
    else p.onFiles(droppedPaths(e),destination);
  };
  // The whole section is a target. Item halves choose the adjacent insertion gap;
  // headers, empty space and collapsed sections append to that section.
  const sectionDestination=(e:DragEvent,section:Section):TimelineSlot=>{
    const node=(e.target as Element).closest<HTMLElement>('[data-slide-id]');
    const slides=p.data.slides.filter(s=>s.sectionId===section.id);
    const index=slides.findIndex(s=>s.id===node?.dataset.slideId);
    if(node&&index>=0){const rect=node.getBoundingClientRect();return {sectionId:section.id,beforeId:e.clientX<rect.left+rect.width/2?slides[index].id:slides[index+1]?.id??null};}
    return {sectionId:section.id,beforeId:null};
  };
  const slot=(section:Section,beforeId:string|null)=>{
    const key=`${section.id}:${beforeId??'end'}`;
    const destination={sectionId:section.id,beforeId};
    const accept=(e:DragEvent)=>acceptDrop(e,destination);
    return <button key={key} className={`timeline-slot${drop===key?' is-drop':''}`} aria-label={`Insert ${beforeId?'before '+(p.data.slides.find(s=>s.id===beforeId)?.name??'slide'):'at end of '+section.name}`} title="Import slide here, or drop media"
      onClick={()=>p.onFiles(undefined,{sectionId:section.id,beforeId})} onDragEnter={accept} onDragOver={accept} onDragLeave={()=>setDrop(null)}
      onDrop={e=>performDrop(e,destination)}><span>+</span></button>;
  };
  const markers=(selected:boolean,live:boolean)=><span className="timeline-markers">{selected&&<b className="edit-marker">EDIT</b>}{live&&p.liveActive&&<b className="live-marker">LIVE</b>}</span>;
  const item=(slide:Slide,index:number)=>{
    const asset=p.data.assets.find(a=>a.id===slide.assetId),label=slide.name||getAssetDisplayLabel(asset,'edit');
    const selected=p.edit.kind==='slide'&&p.edit.contentId===slide.id,live=p.live.kind==='slide'&&p.live.contentId===slide.id;
    return <button className={`timeline-object${selected?' is-edit':''}${live&&p.liveActive?' is-live':''}${p.selectedIds?.has(slide.id)?' is-selected':''}`} data-timeline-anchor={slide.id} data-slide-id={slide.id} key={slide.id} draggable onDragStart={e=>{e.dataTransfer.setData(SLIDE_DRAG,slide.id);e.dataTransfer.effectAllowed='move';}}
      aria-current={selected?'step':undefined} aria-label={label} onClick={e=>p.onSlide(slide.id,e)} onDoubleClick={()=>{const name=prompt('Slide name',label);if(name!==null)p.onRename(slide.id,name,false);}}>
      {markers(selected,live)}
      {density!=='overview'&&<span className="timeline-preview">{density==='frame'?p.preview(slide):asset?.mediaType==='image'?<img src={p.resolveUrl(asset.relativePath)} alt="" draggable={false} loading="lazy"/>:asset?.mediaType==='video'?<video src={p.resolveUrl(asset.relativePath)} muted preload="metadata"/>:<span>Missing media</span>}</span>}
      <strong>{label}</strong><small>{index+1} · {asset?.mediaType??'Missing'}</small>
      {(density==='detail'||density==='frame')&&<span className="timeline-badges">{slide.overlays?.length?`Text ${slide.overlays.length} · `:''}{slide.bCardInstances?.length?`Cards ${slide.bCardInstances.length} · `:''}{slide.storyReferences?.length?`Boards ${slide.storyReferences.length} · `:''}{slide.dialogue?.length?`Dialogue ${slide.dialogue.length} · `:''}{slide.sfx?.length?`SFX ${slide.sfx.length} · `:''}{slide.bgm?'Music · ':''}{slide.transition!=='none'?`${slide.transition} · `:''}{slide.tags?.join(' · ')}</span>}
    </button>;
  };
  const boundary=(beforeId?:string)=><details className="timeline-boundary"><summary aria-label="Insert section or break">+</summary><div><button onClick={()=>p.onSectionAdd(beforeId)}>Add Section</button><button onClick={()=>p.onBreakAdd(beforeId)}>Add Break</button></div></details>;
  return <nav className="lesson-timeline" aria-label="Edit lesson timeline" data-density={density} style={{'--timeline-width':`${Math.round(144*zoom)}px`} as CSSProperties}>
    <header className="timeline-toolbar"><strong>{boost?`${p.session.boostTab} activities`:'Lesson timeline'}</strong><button onClick={p.onShow}>Show in Present</button>
      {!boost&&<><button onClick={()=>p.onSectionAdd()}>+ Section</button><button onClick={()=>p.onBreakAdd()}>+ Break</button><button title="A default lesson container for content outside named sections" onClick={p.onLessonAdd}>+ Lesson area</button></>}
      {!boost&&p.edit.kind==='slide'&&p.edit.contentId&&<button onClick={()=>p.onDelete(p.edit.contentId!)}>Remove from lesson</button>}
      {boost&&<><button disabled={!p.edit.item} onClick={()=>p.onBoostAction?.('duplicate')}>Duplicate item (reuse content)</button><button disabled={p.edit.sequenceIndex<=0} onClick={()=>p.onBoostAction?.('earlier')}>Move earlier</button><button disabled={!p.edit.item||p.edit.sequenceIndex>=p.edit.sequence.length-1} onClick={()=>p.onBoostAction?.('later')}>Move later</button><button disabled={!p.edit.item} onClick={()=>p.onBoostAction?.('remove')}>Remove item</button></>}
      {p.transport}
      <label className="timeline-zoom"><button aria-label="Zoom timeline out" onClick={()=>changeZoom(zoom/1.2)}>−</button><input aria-label="Timeline zoom" type="range" min=".45" max="2.6" step=".05" value={zoom} onChange={e=>changeZoom(Number(e.target.value))}/><button aria-label="Zoom timeline in" onClick={()=>changeZoom(zoom*1.2)}>+</button><output>{density}</output></label>
    </header>
    <div className="timeline-strip" ref={strip} onDragEnter={e=>e.stopPropagation()} onDragEnd={()=>setDrop(null)}
      onPointerDown={e=>{if(e.button!==1)return;e.preventDefault();pan.current={x:e.clientX,scroll:e.currentTarget.scrollLeft};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(pan.current)e.currentTarget.scrollLeft=pan.current.scroll+pan.current.x-e.clientX;}}
      onPointerUp={e=>{pan.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onLostPointerCapture={()=>{pan.current=null;}}
      onAuxClick={e=>{if(e.button===1)e.preventDefault();}}>
      {boost?<div className="timeline-group"><header>Booster sequence · {p.edit.sequence.length} activities</header><div className="timeline-items">{p.edit.sequence.map((it,i)=><button key={it.id} className="timeline-object" data-timeline-anchor={it.id} onClick={()=>p.onBoost(it.id)}>{markers(p.edit.item?.id===it.id,p.live.item?.id===it.id)}{density==='frame'&&<span className="timeline-preview">{p.previewActivity(it)}</span>}<strong>{it.type==='promptCard'?it.title||it.body:it.type==='cardActivityRef'?p.data.cardsV2?.placements[it.placementId]?.label:it.type==='slideRef'?p.data.slides.find(s=>s.id===it.slideId)?.name||'Slide':it.type==='breakRef'?p.data.sections.find(s=>s.id===it.breakId)?.name||'Break':it.type==='aCardRef'?'Board':'Activity'}</strong><small>{i+1} · {it.type==='cardActivityRef'?'Card activity':it.type==='promptCard'?'Prompt':it.type==='slideRef'?'Slide':it.type==='breakRef'?'Break':it.type==='aCardRef'?'Board':'Activity'}</small></button>)}</div></div>
      :p.data.sections.map(section=>{
        const slides=p.data.slides.filter(s=>s.sectionId===section.id),closed=collapsed.has(section.id),isBreak=section.type==='break';
        const selected=p.edit.section?.id===section.id,live=p.live.section?.id===section.id;
        return <div className="timeline-section-pair" key={section.id}>{boundary(section.id)}<section className={`timeline-group${isBreak?' timeline-break':''}`} aria-label={section.name}
          onDragEnter={e=>acceptDrop(e,sectionDestination(e,section))} onDragOver={e=>acceptDrop(e,sectionDestination(e,section))}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDrop(null);}}
          onDrop={e=>performDrop(e,sectionDestination(e,section))}>
          <header><button onClick={()=>setCollapsed(old=>{const next=new Set(old);next.has(section.id)?next.delete(section.id):next.add(section.id);return next;})} aria-label={`${closed?'Expand':'Collapse'} ${section.name}`} aria-expanded={!closed}>{closed?'▸':'▾'}</button>
          <button className="timeline-section-name" onClick={()=>p.onSection(section.id)} onDoubleClick={()=>{const name=prompt('Section name',section.name);if(name?.trim())p.onRename(section.id,name.trim(),true);}}>{section.name}</button><small>{slides.length} items</small>
          <details className="timeline-menu"><summary aria-label={`Actions for ${section.name}`}>⋯</summary><div><button onClick={()=>p.onMoveSection(section.id,'up')}>Move earlier</button><button onClick={()=>p.onMoveSection(section.id,'down')}>Move later</button>{isBreak&&<button onClick={()=>p.onDuplicateBreak(section.id)}>Duplicate break</button>}<button onClick={()=>p.onDeleteSection(section.id)}>Delete section</button></div></details></header>
          <div className="timeline-items">{closed?<button className="timeline-object timeline-collapsed" data-timeline-anchor={section.id} onClick={()=>p.onSection(section.id)}>{markers(selected,live)}<strong>{section.name}</strong><small>{slides.length} items · collapsed</small></button>:isBreak?<button className="timeline-object" data-timeline-anchor={section.id} onClick={()=>p.onSection(section.id)}>{markers(selected,live)}<strong>Break · {section.name}</strong>{density!=='overview'&&<span>{section.questions||'Pause & reflect'}</span>}</button>:slides.map((s,i)=><div className="timeline-item-pair" key={s.id}>{slot(section,s.id)}{item(s,i)}</div>)}{slot(section,null)}</div>
        </section></div>;
      })}{!boost&&boundary()}
    </div><footer>Earlier ← · Wheel to pan · Alt + wheel to zoom at pointer · Middle-drag to pan · EDIT and LIVE are independent</footer>
  </nav>;
}
