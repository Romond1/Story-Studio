import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { makeId, type LessonSession } from '../../shared/lesson/model';
import { addLessonRewardStudent, awardLessonReward, hideLessonCelebration, initializeLessonRewards, pruneLessonRewards, resetLessonStudentRewards, selectLessonRewardStudent, showLessonCelebration, setLessonRewardAppearance } from '../../shared/lesson/rewards';
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

export function LessonRewardControls({ session, onSession }: {
  session: LessonSession;
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
  const active = rewards?.students.find(student => student.id === rewards.activeStudentId);
  const shortcuts=useRef({commit,rewards});shortcuts.current={commit,rewards};
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{const action=lessonShortcut(event,'teach'),current=shortcuts.current;if(!current.rewards)return;
      if(action==='student'){claimTeacherKey(event);const students=current.rewards.students,index=students.findIndex(student=>student.id===current.rewards!.activeStudentId),next=students[(index+1)%students.length];if(next)current.commit(session=>selectLessonRewardStudent(session,next.id));}
      else if(action?.startsWith('reward-')){claimTeacherKey(event);const variant=REWARD_VARIANTS[Number(action.slice(-1))-1],id=makeId(),now=Date.now();current.commit(session=>awardLessonReward(session,variant,id,now),true);}
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  return <section aria-label="Student rewards">
    <h3>Rewards</h3>
    {error && <p role="alert">{error}</p>}
    {!rewards ? <p role="status">Loading students…</p> : <>
      <details className="lesson-inspector-section"><summary>Reward appearance</summary><div>
        <label className="lesson-field"><span>Reward position</span><select aria-label="Reward position" value={appearance.position} onChange={event => commit(current => setLessonRewardAppearance(current, { ...appearance, position: event.target.value }))}>
          <option value="topRight">Top right</option><option value="topLeft">Top left</option><option value="bottomRight">Bottom right</option><option value="bottomLeft">Bottom left</option><option value="center">Center</option>
        </select></label>
        <label className="lesson-field"><span>Reward pop-up size</span><input aria-label="Reward pop-up size" type="range" min=".5" max="1.75" step=".05" value={appearance.size} onChange={event => commit(current => setLessonRewardAppearance(current, { ...appearance, size: Number(event.target.value) }))} /><output>{Math.round(appearance.size * 100)}%</output></label>
        <label className="lesson-field"><span>Reward effect intensity</span><input aria-label="Reward effect intensity" type="range" min="0" max="2" step=".1" value={appearance.intensity} onChange={event => commit(current => setLessonRewardAppearance(current, { ...appearance, intensity: Number(event.target.value) }))} /><output>{Math.round(appearance.intensity * 100)}%</output></label>
        <p className="lesson-hint">Applies to the next reward. Intensity controls particles, glow and animation, including celebrations.</p>
        <button onClick={() => commit(current => setLessonRewardAppearance(current, DEFAULT_REWARD_APPEARANCE))}>Reset reward appearance</button>
      </div></details>
      <label>Reward student<select aria-label="Reward student" title="F1 · next reward student" value={rewards.activeStudentId} onChange={event => {
        const id = event.target.value; commit(current => selectLessonRewardStudent(current, id));
      }}>{rewards.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
      <p aria-live="polite">{active?.name}: {active?.stars ?? 0} total · {active?.yellowSparks ?? 0} yellow · {active?.blueSparks ?? 0} blue · {active?.pinkSparks ?? 0} pink · {active?.crowns ?? 0} crowns</p>
      <div className="lesson-toolbar">{REWARD_VARIANTS.map((variant,index) => <button key={variant} title={`${index+1} · award ${REWARD_DEFINITIONS[variant].label.toLowerCase()}`} disabled={!active} onClick={() => {
        const id = makeId(), now = Date.now(); commit(current => awardLessonReward(current, variant, id, now), true);
      }}>Award {REWARD_DEFINITIONS[variant].label.toLowerCase()}</button>)}</div>
      <div className="lesson-toolbar">
        <button disabled={!active?.stars} onClick={() => { const id = makeId(); commit(current => resetLessonStudentRewards(current, id)); }}>Reset student rewards</button>
        <button onClick={() => { const id = makeId(), now = Date.now(); commit(current => showLessonCelebration(current, id, now), true); }}>Show celebration</button>
        <button disabled={!rewards.final} onClick={() => { const id = makeId(); commit(current => hideLessonCelebration(current, id)); }}>Hide celebration</button>
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        const id = makeId(), nextName = name;
        commit(current => addLessonRewardStudent(current, nextName, id)); setName('');
      }}>
        <label>Add student for this session<input aria-label="New reward student" maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
        <button type="submit" disabled={!name.trim()}>Add student</button>
      </form>
    </>}
  </section>;
}
