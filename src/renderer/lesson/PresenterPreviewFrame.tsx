import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {fitLogicalFrame,type LogicalFrame} from '../../shared/staticScene';
/** Render at the real Presenter CSS dimensions, then scale the whole viewport uniformly. */
export function PresenterPreviewFrame({enabled,viewport,fallback,children}:{enabled:boolean;viewport?:LogicalFrame;fallback?:LogicalFrame;children:ReactNode}) {
 const host=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:1,height:1});
 useLayoutEffect(()=>{if(!enabled||!host.current)return;const node=host.current,update=()=>setSize({width:node.clientWidth,height:node.clientHeight});update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();},[enabled]);
 if(!enabled)return <>{children}</>;
 const valid=(v:LogicalFrame|undefined)=>v&&Number.isFinite(v.width)&&Number.isFinite(v.height)&&v.width>0&&v.height>0;
 const frame=valid(viewport)?viewport!:fallback??{width:1280,height:720},fit=fitLogicalFrame(frame,size);
 return <div ref={host} style={{position:'absolute',inset:0,overflow:'hidden',background:'#06080d'}}><div data-presenter-preview="true" data-presenter-width={frame.width} data-presenter-height={frame.height} aria-label="Presenter frame" style={{position:'absolute',left:fit.x,top:fit.y,width:frame.width,height:frame.height,transform:`scale(${fit.scale})`,transformOrigin:'0 0',overflow:'hidden',outline:`${1/Math.max(.01,fit.scale)}px solid #8395b0`}}>{children}</div></div>;
}
