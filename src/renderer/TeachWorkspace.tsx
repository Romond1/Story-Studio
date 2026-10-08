import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { LogicalFrame } from '../shared/staticScene';
import { clampTeachSplit, clampTeachNavigatorHeight, fitPreviewViewport, parsePresentViewport, previewPoint } from '../shared/teachWorkspace';

export function useTeachLayout(mode: string = 'teach') {
 const workspaceRef = useRef<HTMLDivElement>(null);
 const [workspaceHeight, setWorkspaceHeight] = useState(768);
 const [navigatorPreferences, setNavigatorPreferences] = useState(() => {
  const read = (workspace: string) => {
   try { const value = localStorage.getItem(`story-studio.${workspace}-navigator-height`); return value === null ? 176 : Number(value); }
   catch { return 176; }
  };
  return { edit: read('edit'), teach: read('teach') };
 });
 useLayoutEffect(() => {
  const element = workspaceRef.current;
  if (!element) return;
  const observer = new ResizeObserver(entries => setWorkspaceHeight(entries[0].contentRect.height));
  observer.observe(element);
  return () => observer.disconnect();
 }, []);
 const workspace = mode === 'edit' ? 'edit' : 'teach';
 const navigatorMinimum = workspace==='edit'?300:176;
 const navigatorHeight = clampTeachNavigatorHeight(navigatorPreferences[workspace], workspaceHeight,navigatorMinimum);
 const navigatorMaximum = clampTeachNavigatorHeight(400, workspaceHeight,navigatorMinimum);
 const resizeNavigator = (height: number) => {
  const next = clampTeachNavigatorHeight(height, workspaceHeight,navigatorMinimum);
  setNavigatorPreferences(old => ({ ...old, [workspace]: next }));
  try { localStorage.setItem(`story-studio.${workspace}-navigator-height`, String(next)); } catch {}
 };
 const [presentActive,setPresentActive]=useState(false);
 const [viewport,setViewport]=useState<LogicalFrame>({width:1280,height:720});
 const [teachSplit,setTeachSplit]=useState(()=>{try {const value=localStorage.getItem('story-studio.teach-split');return value===null?42:clampTeachSplit(Number(value));}catch{return 42;}});
 useEffect(()=>{
  let disposed=false,received=false;
  const accept=(status:import('../shared/presentStatus').PresentStatus)=>{setPresentActive(status.state==='ready');const next=parsePresentViewport(status.viewport);if(next)setViewport(old=>old.width===next.width&&old.height===next.height?old:next);};
  const unsubscribe=window.appApi.onPresentStatus?.(status=>{received=true;accept(status);});
  void window.appApi.getPresentStatus?.().then(status=>{if(!disposed&&!received)accept(status);}).catch(()=>{});
  return ()=>{disposed=true;unsubscribe?.();};
 },[]);
 const [editSplit,setEditSplit]=useState(()=>{try {const value=localStorage.getItem('story-studio.edit-split');return value===null?60:clampTeachSplit(Number(value));}catch{return 60;}});
 const split=mode==='edit'?editSplit:teachSplit;
 const resize=(value:number)=>{const next=clampTeachSplit(value);(mode==='edit'?setEditSplit:setTeachSplit)(next);try{localStorage.setItem(`story-studio.${mode}-split`,String(next));}catch{}};
 return {workspaceRef,viewport,presentActive,split,resize,navigatorHeight,navigatorMaximum,resizeNavigator,style:{'--teach-navigator-height':`${navigatorHeight}px`,'--teach-preview':`${split}fr`,'--teach-controls':`${100-split}fr`} as CSSProperties};
}

export function TeachNavigatorDivider({ height, maximum, minimum=176, onChange }: {
 height: number; maximum: number; minimum?:number; onChange: (height: number) => void;
}) {
 const drag = useRef<{ y: number; height: number } | null>(null);
 return <div className="teach-navigator-divider" role="separator" aria-label="Lesson timeline height"
  aria-orientation="horizontal" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(height)}
  tabIndex={0} title="Drag up or down to resize the lesson timeline"
  onKeyDown={event => {
   if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
   event.preventDefault(); event.stopPropagation();
   onChange(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : height + (event.key === 'ArrowUp' ? 32 : -32));
  }}
  onPointerDown={event => {
   if (event.button !== 0) return;
   event.preventDefault(); drag.current = { y: event.clientY, height };
   event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerMove={event => {
   if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) onChange(drag.current.height + drag.current.y - event.clientY);
  }}
  onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
  onLostPointerCapture={() => { drag.current = null; }} />;
}

export function TeachDivider({value,onChange}:{value:number;onChange:(value:number)=>void}) {
 return <div className="teach-divider" role="separator" aria-label="Preview and controls" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={65} aria-valuenow={value} tabIndex={0}
  onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();onChange(e.key==='Home'?30:e.key==='End'?65:value+(e.key==='ArrowLeft'?-2:2));}}}
  onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);}}
  onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const rect=e.currentTarget.parentElement!.getBoundingClientRect();onChange(100*(e.clientX-rect.left)/rect.width);}}
  onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} />;
}

/** Only the inner viewport contains interactive descendants; neutral padding is inert. */
export function TeachPreview({enabled,viewport,children}:{enabled:boolean;viewport:LogicalFrame;children:ReactNode}) {
 const host=useRef<HTMLDivElement>(null);
 const [available,setAvailable]=useState({width:0,height:0});
 useLayoutEffect(()=>{const el=host.current!;const update=()=>setAvailable({width:el.clientWidth,height:el.clientHeight});update();const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;setAvailable({width,height});});observer.observe(el);return()=>observer.disconnect();},[enabled]);
 const fit=fitPreviewViewport(viewport,available);
 return <div ref={host} className={enabled?'teach-preview-region':'teach-preview-off'}>
  <div className={enabled?'teach-preview-viewport':'teach-preview-off'} data-preview-viewport={enabled||undefined} style={enabled?{position:'absolute',left:fit.x,top:fit.y,width:fit.width,height:fit.height}:undefined}
   onPointerDownCapture={e=>{if(!enabled || !e.currentTarget.contains(e.target as Node))return;const r=e.currentTarget.getBoundingClientRect();if(!previewPoint({x:e.clientX,y:e.clientY},{x:r.left,y:r.top,width:r.width,height:r.height}))e.stopPropagation();}}>{children}</div>
 </div>;
}

