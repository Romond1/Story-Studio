import {RewardAppearanceControls} from './RewardAppearanceControls';
import {notifyTeacher} from './teacherNotifications';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { makeId, type LessonSession } from '../../shared/lesson/model';
import { lessonRewardSelection, addLessonRewardStudent, awardLessonReward, hideLessonCelebration, initializeLessonRewards, pruneLessonRewards, resetLessonStudentRewards, selectLessonRewardStudent, showLessonCelebration, setLessonRewardAppearance } from '../../shared/lesson/rewards';
import { DEFAULT_REWARD_APPEARANCE, parseRewardAppearance } from '../../shared/rewardAppearance';
import { REWARD_DEFINITIONS, REWARD_VARIANTS } from '../../shared/sparkRewards';
import { audioManager } from '../audio/AudioManager';
import { claimTeacherKey, lessonShortcut } from '../../shared/keyboardShortcuts';

const appearanceStorageKey = 'story-studio.lesson-reward-appearance.v1';
function rememberedAppearance(session: LessonSession): LessonSession {
  try {
    const appearance = parseRewardAppearance(JSON.parse(localStorage.getItem(appearanceStorageKey) ?? 'null'));
    return appearance ? setLessonRewardAppearance(session, appearance) : session;
  } catch { return session; }
}

export function LessonRewardControls({ participantIds, session, onSession,shortcutsEnabled=true,studentShortcutEnabled=true }: {
  participantIds?:string[];shortcutsEnabled?:boolean;studentShortcutEnabled?:boolean;session: LessonSession;
  onSession: Dispatch<SetStateAction<LessonSession>>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const latest = useRef(session); latest.current = session;

  useEffect(() => {
    if (session.rewards) return;
    const sessionId = session.id;
    let cancelled = false;
    setName(''); setError('');
    void window.appApi.getStudentRoster().then(roster => {
      if (!cancelled) onSession(current => current.id === sessionId ? rememberedAppearance(initializeLessonRewards(current, roster.studentRoster)) : current);
    }).catch(() => {
      if (cancelled) return;
      setError('The student roster is unavailable. You can use Class or add a student for this session.');
      onSession(current => current.id === sessionId ? rememberedAppearance(initializeLessonRewards(current, [])) : current);
    });
    return () => { cancelled = true; };
  }, [session.id, !!session.rewards, onSession]);

  useEffect(() => {
    const rewards = session.rewards; if (!rewards) return;
    const expiries = rewards.sparks.map(value => value.expiresAt);
    if (rewards.final?.expiresAt !== undefined) expiries.push(rewards.final.expiresAt);
    if (!expiries.length) return;
    const sessionId = session.id;
    const timeout = window.setTimeout(() => {
      const now = Date.now();
      onSession(current => current.id === sessionId ? pruneLessonRewards(current, now) : current);
    }, Math.max(0, Math.min(...expiries) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [session.id, session.rewards, onSession]);

  const commit = (command: (current: LessonSession) => LessonSession, audible = false) => {
    const previous = latest.current;
    const next = command(previous);
    if (next === previous) return;
    latest.current = next;
    // React may replay this updater. Commands reuse the event ID from the click.
    onSession(current => current.id === previous.id ? command(current) : current);
    // Audio belongs to the user event, never the state updater or Present renderer.
    if (audible) {
      try { audioManager.playGeneratedChime(); }
      catch { setError('The reward was awarded, but its chime could not play. Check Audio settings.'); }
    }
  };

  const rewards = session.rewards;
  const appearance = rewards?.appearance ?? DEFAULT_REWARD_APPEARANCE;
  useEffect(() => {
    if (!rewards?.appearance) return;
    try { localStorage.setItem(appearanceStorageKey, JSON.stringify(rewards.appearance)); } catch { /* Session controls remain usable without local storage. */ }
  }, [rewards?.appearance]);
  const { students, active } = lessonRewardSelection(session, participantIds);
  const shortcuts=useRef({commit,rewards,students,active,shortcutsEnabled,studentShortcutEnabled});shortcuts.current={commit,rewards,students,active,shortcutsEnabled,studentShortcutEnabled};
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{const action=lessonShortcut(event,'teach'),current=shortcuts.current;if(!current.rewards || !current.shortcutsEnabled)return;
      if(action==='student' && current.studentShortcutEnabled){claimTeacherKey(event);const students=current.students,index=students.findIndex(student=>student.id===current.active?.id),next=students[(index+1)%students.length];if(next){current.commit(session=>selectLessonRewardStudent(session,next.id));notifyTeacher(`Active student: ${next.name}`,'student');}}
      else if(action?.startsWith('reward-') && current.active){claimTeacherKey(event);const variant=REWARD_VARIANTS[Number(action.slice(-1))-1],id=makeId(),now=Date.now();current.commit(session=>awardLessonReward(selectLessonRewardStudent(session,current.active!.id),variant,id,now),true);notifyTeacher(`${REWARD_DEFINITIONS[variant].label} awarded to ${current.active.name}`,'award');}
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  return <section aria-label="Student rewards">
    <h3>Rewards</h3>
    {error && <p role="alert">{error}</p>}
    {!rewards ? <p role="status">Loading students…</p> : <>
      <RewardAppearanceControls session={session} onSession={onSession}/>
      <label>Reward student<select aria-label="Reward student" title="F1 · next reward student" value={active?.id ?? ''} onChange={event => {
        const id = event.target.value; commit(current => selectLessonRewardStudent(current, id));notifyTeacher(`Active student: ${rewards.students.find(s=>s.id===id)?.name}`,'student');
      }}>{!students.length && <option value="">Select participants above</option>}{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
      <p aria-live="polite">{active?.name}: {active?.stars ?? 0} total · {active?.yellowSparks ?? 0} yellow · {active?.blueSparks ?? 0} blue · {active?.pinkSparks ?? 0} pink · {active?.crowns ?? 0} crowns</p>
      <div className="lesson-toolbar">{REWARD_VARIANTS.map((variant,index) => <button key={variant} title={`${index+1} · award ${REWARD_DEFINITIONS[variant].label.toLowerCase()}`} disabled={!active} onClick={() => {
        const id = makeId(), now = Date.now(); commit(current => awardLessonReward(selectLessonRewardStudent(current, active!.id), variant, id, now), true);notifyTeacher(`${REWARD_DEFINITIONS[variant].label} awarded to ${active?.name}`,'award');
      }}>Award {REWARD_DEFINITIONS[variant].label.toLowerCase()}</button>)}</div>
      <div className="lesson-toolbar">
        <button disabled={!active?.stars} onClick={() => { const id = makeId(); commit(current => resetLessonStudentRewards(selectLessonRewardStudent(current, active!.id), id)); }}>Reset student rewards</button>
        <button onClick={() => { const id = makeId(), now = Date.now(); commit(current => showLessonCelebration(current, id, now), true); }}>Show celebration</button>
        <button disabled={!rewards.final} onClick={() => { const id = makeId(); commit(current => hideLessonCelebration(current, id)); }}>Hide celebration</button>
      </div>
      {participantIds === undefined && <form onSubmit={event => {
        event.preventDefault();
        const id = makeId(), nextName = name;
        commit(current => addLessonRewardStudent(current, nextName, id)); setName('');
      }}>
        <label>Add student for this session<input aria-label="New reward student" maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
        <button type="submit" disabled={!name.trim()}>Add student</button>
      </form>}
    </>}
  </section>;
}
