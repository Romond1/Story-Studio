import {RewardAppearanceControls} from './RewardAppearanceControls';
import {notifyTeacher} from './teacherNotifications';
import {lessonShortcut,claimTeacherKey} from '../../shared/keyboardShortcuts';
import {GAME_EFFECT_KINDS} from '../../shared/gameEffects';
import {REWARD_DEFINITIONS} from '../../shared/sparkRewards';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { LessonSession } from '../../shared/lesson/model';
import type { WheelAction, WheelRuntimeState } from '../../shared/lesson/wheelRuntime';
import type { SparkAwardVariant } from '../../shared/types';
import type { GameEffectKind } from '../../shared/gameEffects';
import { lessonRewardSelection, selectLessonRewardStudent } from '../../shared/lesson/rewards';

export function WheelFeedbackControls({participantIds,state,session,onSession,command,send}:{participantIds?:string[];state:WheelRuntimeState;session:LessonSession;onSession:Dispatch<SetStateAction<LessonSession>>;command:(type:WheelAction['type'])=>WheelAction;send:(action:WheelAction)=>void}) {
 const [variant,setVariant]=useState<SparkAwardVariant>('gold'),[amount,setAmount]=useState(1),[effect,setEffect]=useState<GameEffectKind>('coins');
 const [scale,setScale]=useState(1.25),[intensity,setIntensity]=useState(1.5),[duration,setDuration]=useState(4200);
 const names:Record<GameEffectKind,string>={coins:'Coin shower',stars:'Star explosion',portal:'Magic portal',chest:'Treasure chest',sprite:'Friendly magic',crown:'Crown reveal'};
 const ready=!!state.currentActivityId && ['active','activity-complete','session-complete'].includes(state.phase);
 const rewards=session.rewards,{students,active}=lessonRewardSelection(session,participantIds);
 useEffect(()=>{if(rewards && active && rewards.activeStudentId!==active.id)onSession(current=>current.id===session.id?selectLessonRewardStudent(current,students[0].id):current);},[rewards?.activeStudentId,students.map(s=>s.id).join('|'),session.id,onSession]);
 const click=(type:WheelAction['type'],extra:Partial<WheelAction>={})=>{
  if(!ready){notifyTeacher('Reveal an activity before using rewards or magic.','game-action');return;}
  const appearance=session.rewards?.appearance;
  send({...command(type),...(['effect','award'].includes(type)?{durationMs:duration,scale:type==='award'?(appearance?.size??1):scale,intensity:type==='award'?(appearance?.intensity??1):intensity}:{}),...extra});
  notifyTeacher(type==='award'?`${amount} ${REWARD_DEFINITIONS[(extra.rewardVariant??variant) as SparkAwardVariant].label} awarded to ${active?.name}`:type==='effect'?`Playing ${names[extra.effectKind??effect]}`:type==='replay-effect'?'Replaying magic · score unchanged':type==='skip-effect'?'Animation stopped':type==='skip-reward'?'Reward skipped':'Outcome confirmed','game-action');
 };
 const chooseEffect=(next:GameEffectKind)=>{setEffect(next);notifyTeacher(`Animation: ${names[next]} · press 5 to play`,'magic-type');};
 const actions=useRef({students,active,ready,click,chooseEffect,effect,amount});actions.current={students,active,ready,click,chooseEffect,effect,amount};
 useEffect(()=>{const key=(event:KeyboardEvent)=>{const action=lessonShortcut(event,'teach'),current=actions.current;
  if(action==='magic-next'){claimTeacherKey(event);current.chooseEffect(GAME_EFFECT_KINDS[(GAME_EFFECT_KINDS.indexOf(current.effect)+1)%GAME_EFFECT_KINDS.length]);}
  else if(action==='magic-play'){claimTeacherKey(event);current.click('effect',{effectKind:current.effect});}
  else if(action==='student'){claimTeacherKey(event);const index=current.students.findIndex(s=>s.id===current.active?.id),next=current.students[(index+1)%current.students.length];if(next){onSession(value=>value.id===session.id?selectLessonRewardStudent(value,next.id):value);notifyTeacher(`Active student: ${next.name}`,'student');}else notifyTeacher('Select participants to choose a reward student.','student');}
 };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[session.id,onSession]);
 return <section className="wheel-feedback-controls" aria-label="Game rewards and magic">
  <h4 style={{margin:0}}>Rewards & magic</h4><p className="lesson-hint">F1 · student · 1–4 · normal rewards · F2 · animation · 5 · play</p><RewardAppearanceControls session={session} onSession={onSession}/>
  {rewards && <>
   <label className="lesson-field">Reward recipient<select aria-label="Reward recipient" value={active?.id??''} onChange={e=>{const id=e.target.value;onSession(current=>current.id===session.id?selectLessonRewardStudent(current,id):current);notifyTeacher(`Active student: ${students.find(s=>s.id===id)?.name}`,'student');}}>{!students.length && <option value="">Select participants above</option>}{students.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
   <>
    <div className="lesson-field-grid"><label className="lesson-field">Reward<select aria-label="Game reward" value={variant} onChange={e=>{setVariant(e.target.value as SparkAwardVariant);notifyTeacher(`Reward: ${REWARD_DEFINITIONS[e.target.value as SparkAwardVariant].label}`,'reward-type');}}><option value="gold">Yellow star</option><option value="blue">Blue star</option><option value="pink">Pink star</option><option value="crown">Crown</option></select></label><label className="lesson-field">Amount<input aria-label="Reward amount" type="number" min={1} max={10} value={amount} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n)&&n>=1&&n<=10)setAmount(n);}}/></label></div>
    <div className="lesson-toolbar"><button disabled={!active || !ready} onClick={()=>click('award',{rewardVariant:variant,amount,studentId:active?.id})}>Award reward</button><button onClick={e=>{if(e.detail<=1)click('skip-reward');}}>Skip reward</button><button onClick={e=>{if(e.detail<=1)click('confirm-outcome');}}>Confirm outcome</button></div>
   </>
   {state.outcome && <p role="status">{state.outcome.decision==='awarded'?'Reward awarded. You can award again or choose another student.':state.outcome.decision==='skipped'?'Reward skipped. You can still award a student.':'Outcome confirmed. You can still award a student.'}</p>}
   <p className="lesson-hint">{active?.name}: {active?.stars ?? 0} total. Animations never change scores.</p>
  </>}
  <div className="wheel-feedback-controls" aria-label="Magic appearance">
   <label className="lesson-field">Animation<select aria-label="Game animation" value={effect} title="F2 · next animation" onChange={e=>chooseEffect(e.target.value as GameEffectKind)}><option value="coins">Coin shower · just for fun</option><option value="stars">Star explosion</option><option value="portal">Magic portal</option><option value="chest">Treasure chest</option><option value="sprite">Friendly magic</option><option value="crown">Crown reveal</option></select></label>
   <label className="lesson-field">Magic size<input aria-label="Magic size" type="range" min=".5" max="3" step=".05" value={scale} onChange={e=>{setScale(Number(e.target.value));notifyTeacher(`Magic size: ${Math.round(Number(e.target.value)*100)}%`,'magic-settings');}}/><output>{Math.round(scale*100)}%</output></label>
   <label className="lesson-field">Magic sparkle<input aria-label="Magic sparkle" type="range" min="0" max="3" step=".1" value={intensity} onChange={e=>{setIntensity(Number(e.target.value));notifyTeacher(`Magic sparkle: ${Math.round(Number(e.target.value)*100)}%`,'magic-settings');}}/><output>{Math.round(intensity*100)}%</output></label>
   <label className="lesson-field">Magic duration<input aria-label="Magic duration" type="range" min="1" max="8" step=".1" value={duration/1000} onChange={e=>{setDuration(Number(e.target.value)*1000);notifyTeacher(`Magic duration: ${e.target.value} seconds`,'magic-settings');}}/><output>{(duration/1000).toFixed(1)} s</output></label>
   <div className="lesson-toolbar"><button title="5 · play animation" onClick={e=>{if(e.detail<=1)click('effect',{effectKind:effect});}}>Play animation</button>{state.lastEffect && <button onClick={e=>{if(e.detail<=1)click('replay-effect');}}>Replay animation</button>}{state.effect && <button onClick={()=>click('skip-effect')}>Skip animation</button>}</div>
   {state.phase==='active' && <div className="lesson-toolbar"><button onClick={e=>{if(e.detail<=1)click('effect',{effectKind:'stars'});}}>Celebrate answer</button><button onClick={e=>{if(e.detail<=1)click('effect',{effectKind:'sprite'});}}>Encourage another try</button></div>}
  </div>
 </section>;
}
