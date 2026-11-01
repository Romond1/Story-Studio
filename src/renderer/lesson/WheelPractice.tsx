import {cardSelection,questionCardFlip} from './miniGameCommands';
import {actOnMiniGame} from '../../shared/lesson/session';
import { prepareWheelPractice, readWheelSettings } from '../../shared/lesson/spinningWheel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LessonLocation, LessonProject } from '../../shared/lesson/model';
import { createSession, navigate } from '../../shared/lesson/session';
import { initializeLessonRewards } from '../../shared/lesson/rewards';
import { projectScene } from '../../shared/lesson/projection';
import { isMiniGameConfig } from '../../shared/lesson/miniGameBreak';
import { SceneSurface } from './SceneSurface';
import {DrawingToolbar,type DrawingTool} from './DrawingToolbar';
import {setLiveDrawings,undoLiveDrawing,redoLiveDrawing} from '../../shared/lesson/session';
import { WheelTeachControls } from './WheelTeachControls';
import './wheelPractice.css';
/** Local state only: no live setters, roster writes, save calls or Present publisher. */
export function WheelPractice({project,location,resolve,onClose}:{project:LessonProject;location:LessonLocation;resolve:(id:string)=>string|undefined;onClose:()=>void}) {
 const sandbox=useMemo(()=>prepareWheelPractice(project,location),[project,location.sequence,location.entryId]);
 const [practice,setPractice]=useState(()=>initializeLessonRewards(navigate(sandbox,createSession(),location),[]));
 const [drawing,setDrawing]=useState(false),[tool,setTool]=useState<DrawingTool>('pen'),[color,setColor]=useState('#ffcc33'),[size,setSize]=useState(6),[rainbow,setRainbow]=useState(false),[fade,setFade]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),scene=sandbox.scenes[sandbox.sequences[location.sequence].find(e=>e.id===location.entryId)!.sceneId];
 const plan=projectScene(sandbox,scene.id,practice,resolve),config=scene.breakExperience;
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog className="wheel-practice" ref={dialog} aria-label="Test mini-game" onCancel={event=>{event.preventDefault();onClose();}}>
  <header><div><strong>Test game</strong><p>Practice only. Present, lesson progress and class rewards are unchanged.</p></div><button autoFocus onClick={onClose}>Close test</button></header>
  <div className="wheel-practice-body"><div className="wheel-practice-stage">{plan.wheel ? <SceneSurface plan={plan} surface="teach" onQuestionFlip={()=>{const action=questionCardFlip(sandbox,practice);if(action)setPractice(current=>actOnMiniGame(sandbox,current,action));}} drawing={drawing} drawingTool={tool} drawColor={color} drawSize={size} drawRainbow={rainbow} drawFadeMs={fade} onDraw={stroke=>setPractice(current=>setLiveDrawings(current,[...current.drawings,stroke]))} onErase={ids=>setPractice(current=>setLiveDrawings(current,current.drawings.filter(s=>!ids.includes(s.id))))} erasableStrokeIds={practice.drawings.map(s=>s.id)} onViewportChange={viewport=>setPractice(current=>({...current,viewport,revision:current.revision+1}))} onCardSelect={index=>{const action=cardSelection(sandbox,practice,index);if(action)setPractice(current=>actOnMiniGame(sandbox,current,action));}}/> : <p>This game is unavailable. Your saved content has been kept.</p>}</div><aside className="lesson-teach-controls"><details><summary>Zoom & draw</summary><label className="lesson-field">Zoom<input aria-label="Practice zoom" type="range" min="1" max="4" step=".1" value={practice.viewport.zoom} onChange={e=>setPractice(current=>({...current,viewport:{...current.viewport,zoom:Number(e.target.value)},revision:current.revision+1}))}/></label><button onClick={()=>setPractice(current=>({...current,viewport:{zoom:1,pan:{x:0,y:0}},revision:current.revision+1}))}>Reset practice view</button><DrawingToolbar active={drawing} tool={tool} color={color} size={size} rainbow={rainbow} fadeMs={fade} onRainbow={setRainbow} onFadeMs={setFade} onActive={setDrawing} onTool={setTool} onColor={setColor} onSize={setSize} onUndo={()=>setPractice(undoLiveDrawing)} onRedo={()=>setPractice(redoLiveDrawing)} onClear={()=>setPractice(current=>setLiveDrawings(current,[]))} canUndo={!!practice.drawingUndo?.length} canRedo={!!practice.drawingRedo?.length}/></details>{isMiniGameConfig(config) && readWheelSettings(config) && <WheelTeachControls config={config} project={sandbox} session={practice} onSession={setPractice}/>}</aside></div>
 </dialog>;
}
