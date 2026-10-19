import {DashQuestionOverlay} from './DashQuestionOverlay';
import {DashRewards} from './DashRewards';
import {useEffect,useRef,useState} from 'react';
import type {DashView} from '../../../shared/heroDash';
import {createDashScene} from './scene';
import './heroDash.css';

export function HeroDashPresent({view,onReady,onError,onZoom}:{view:DashView;onReady:()=>void;onError:(message:string)=>void;onZoom?:(zoom:number)=>void}) {
 const host=useRef<HTMLDivElement>(null),scene=useRef<ReturnType<typeof createDashScene>>(),current=useRef(view);current.current=view;
 const ready=useRef(onReady),failure=useRef(onError);ready.current=onReady;failure.current=onError;
 const zoomCallback=useRef(onZoom),wheelZoom=useRef(view.zoom);zoomCallback.current=onZoom;wheelZoom.current=view.zoom;
 useEffect(()=>{const element=host.current!;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||current.current.questionVisible)return;event.preventDefault();wheelZoom.current=Math.max(.65,Math.min(1.8,wheelZoom.current*Math.exp(-event.deltaY*.0015)));zoomCallback.current?.(wheelZoom.current);};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[]);
 const [arrived,setArrived]=useState(false);
 const [graphics,setGraphics]=useState<'loading'|'ready'|'error'>('loading');
 const [questionResult,setQuestionResult]=useState<{src?:string;status:'loading'|'ready'|'error'}>({status:'ready'});
 const questionStatus=view.question&&questionResult.src!==view.question.image?'loading':questionResult.status;
 const graphicsError='3D graphics unavailable. Restart Present or enable hardware acceleration.';
 const imageError='Question image unavailable. Hide it and choose another review image.';
 const error=graphics==='error'?graphicsError:view.question&&questionStatus==='error'?imageError:'';
 useEffect(()=>{
  const element=host.current!;const fail=()=>setGraphics('error');
  const finish=()=>setArrived(true);setArrived(false);element.addEventListener('dash-finish-arrived',finish);
  element.addEventListener('dash-render-error',fail);
  try{scene.current=createDashScene(element,current.current);setGraphics('ready');}catch{fail();}
  return ()=>{element.removeEventListener('dash-finish-arrived',finish);element.removeEventListener('dash-render-error',fail);scene.current?.dispose();scene.current=undefined;};
 },[view.checkpoints,view.course,view.level]);
 useEffect(()=>{scene.current?.update(view);if(view.status!=='finished')setArrived(false);},[view]);
 useEffect(()=>{if(error)failure.current(error);else if(graphics==='ready'&&(!view.question||questionStatus==='ready'))ready.current();},[view,graphics,questionStatus,error]);
 return <section className="dash-present" aria-label="Hero Dash race" data-dash-status={view.status} data-dash-camera={String(view.camera)} data-dash-orbit-target={String(view.orbitTarget??view.active)} data-dash-zoom={view.zoom} data-dash-level={view.level+1} data-dash-course={view.course} data-dash-position={view.positions[0]} data-dash-checkpoints={view.checkpoints}>
  <div className="dash-canvas" ref={host}/>
  <div className="dash-scoreboard">{view.names.map((name,i)=><div key={i} className={`dash-score dash-racer-${i}`} data-active={view.active===i}><b>{name}</b><span><small>{view.scores[i]} points</small></span></div>)}</div>
  <DashRewards view={view} host={host}/>
  <DashQuestionOverlay question={view.question} onStatus={(status,src)=>setQuestionResult({status,src})}/>
  {error&&<p className="dash-render-error" role="alert">{error}</p>}
 </section>;
}






