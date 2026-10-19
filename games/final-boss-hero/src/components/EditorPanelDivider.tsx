import { useRef, useState, type CSSProperties } from 'react';

let savedWidths={pool:330,navigation:190};
export function useEditorPanelWidths(){
  const [widths,setWidths]=useState(savedWidths);
  const resize=(side:'pool'|'navigation',value:number,containerWidth:number)=>setWidths(old=>{
    const other=containerWidth>1200?(side==='pool'?old.navigation:old.pool):0;
    const max=Math.max(side==='pool'?220:150,containerWidth-other-380);
    const next={...old,[side]:Math.round(Math.min(Math.max(value,side==='pool'?220:150),Math.min(max,side==='pool'?640:320)))};
    savedWidths=next;return next;
  });
  return {widths,resize,style:{'--editor-pool-width':`${widths.pool}px`,'--editor-navigation-width':`${widths.navigation}px`} as CSSProperties};
}

export function EditorPanelDivider({side,width,onResize}:{side:'pool'|'navigation';width:number;onResize:(side:'pool'|'navigation',value:number,containerWidth:number)=>void}){
  const drag=useRef<{x:number;width:number}|null>(null);
  return <div className={`editor-panel-divider editor-panel-divider--${side}`} role="separator" tabIndex={0}
    aria-label={side==='pool'?'Resize media pool':'Resize navigation'} aria-orientation="vertical" aria-valuenow={width} aria-valuemin={side==='pool'?220:150} aria-valuemax={side==='pool'?640:320}
    title="Drag to resize · Arrow keys adjust · Double-click to reset"
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();drag.current={x:event.clientX,width};event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{if(!drag.current)return;onResize(side,drag.current.width+(event.clientX-drag.current.x)*(side==='pool'?1:-1),event.currentTarget.parentElement!.clientWidth);}}
    onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
    onLostPointerCapture={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}
    onDoubleClick={event=>onResize(side,side==='pool'?330:190,event.currentTarget.parentElement!.clientWidth)}
    onKeyDown={event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();onResize(side,width+(event.key==='ArrowRight'?20:-20)*(side==='pool'?1:-1),event.currentTarget.parentElement!.clientWidth);}}
  />;
}
