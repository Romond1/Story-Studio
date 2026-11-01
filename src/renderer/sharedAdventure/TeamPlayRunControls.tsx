import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { LessonSession } from '../../shared/lesson/model';
import type { TeamRun } from '../../shared/teamPlay/runtime';
import type { DashAction } from '../../shared/heroDash';
import { WheelTeachControls } from '../lesson/WheelTeachControls';

export function TeamPlayRunControls({run,onSession,onDash,onExit,onComplete}:{run:TeamRun;onSession:Dispatch<SetStateAction<LessonSession>>;onDash:(action:DashAction)=>void;onExit:()=>void;onComplete:()=>void}) {
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[run.instanceId]);
  return <section className="shared-panel team-run" aria-label="Running Team Play activity"><h2 ref={heading} tabIndex={-1}>{run.entry.title} · Running</h2>
    <p>The group session stays active. Use Points & scoreboard at any time; game outcomes never award group points automatically.</p>
    <div className="shared-actions"><button onClick={onExit}>Exit activity to mission</button><button onClick={onComplete}>Complete and return to Team Play</button></div>
    {run.kind==='wheel'?<WheelTeachControls manualGroupScoring config={run.project.scenes[run.project.sequences.story[0].sceneId].breakExperience as import('../../shared/lesson/miniGameBreak').MiniGameConfig} project={run.project} session={run.session} onSession={onSession}/>:<div className="team-race-controls">
      <p role="status">Race {run.state.status} · checkpoints {run.state.positions.join(' / ')} · question {run.state.questionIndex+1} of {run.state.config.cards.length}</p>
      <div className="shared-actions"><button disabled={run.state.status!=='ready'} onClick={()=>onDash({type:'start'})}>Start race</button><button disabled={run.state.status!=='playing'} onClick={()=>onDash({type:'pause'})}>Pause race</button><button disabled={run.state.status!=='paused'} onClick={()=>onDash({type:'resume'})}>Resume race</button>{run.state.config.names.map((name,index)=><button key={index} aria-pressed={run.state.active===index} onClick={()=>onDash({type:'select',racer:index as 0|1})}>Select {name}</button>)}<button disabled={run.state.status!=='playing'} onClick={()=>onDash({type:'move',amount:1})}>Move selected racer +1</button><button disabled={!run.state.history.length} onClick={()=>onDash({type:'undo'})}>Undo race action</button></div>
      <div className="shared-actions"><button onClick={()=>onDash({type:'show'})}>Show race question</button><button onClick={()=>onDash({type:'hide'})}>Hide race question</button><button disabled={run.state.questionIndex===0} onClick={()=>onDash({type:'previous'})}>Previous race question</button><button disabled={run.state.questionIndex>=run.state.config.cards.length-1} onClick={()=>onDash({type:'next'})}>Next race question</button><button onClick={()=>{if(window.confirm('Reset only this race? Team Play scores are kept.'))onDash({type:'reset'});}}>Reset race</button></div>
      <p>Two racers are roles for the group to control. They are separate from the individual student scoreboard.</p>
    </div>}
  </section>;
}
