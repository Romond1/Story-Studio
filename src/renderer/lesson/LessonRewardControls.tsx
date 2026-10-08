import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { makeId, type LessonSession } from '../../shared/lesson/model';
import { addLessonRewardStudent, awardLessonReward, hideLessonCelebration, initializeLessonRewards, pruneLessonRewards, resetLessonStudentRewards, selectLessonRewardStudent, showLessonCelebration } from '../../shared/lesson/rewards';
import { REWARD_DEFINITIONS, REWARD_VARIANTS } from '../../shared/sparkRewards';
import { audioManager } from '../audio/AudioManager';

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
      if (!cancelled) onSession(current => current.id === sessionId ? initializeLessonRewards(current, roster.studentRoster) : current);
    }).catch(() => {
      if (cancelled) return;
      setError('The student roster is unavailable. You can use Class or add a student for this session.');
      onSession(current => current.id === sessionId ? initializeLessonRewards(current, []) : current);
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
  const active = rewards?.students.find(student => student.id === rewards.activeStudentId);
  return <section aria-label="Student rewards">
    <h3>Rewards</h3>
    {error && <p role="alert">{error}</p>}
    {!rewards ? <p role="status">Loading students…</p> : <>
      <label>Reward student<select aria-label="Reward student" value={rewards.activeStudentId} onChange={event => {
        const id = event.target.value; commit(current => selectLessonRewardStudent(current, id));
      }}>{rewards.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
      <p aria-live="polite">{active?.name}: {active?.stars ?? 0} total · {active?.yellowSparks ?? 0} yellow · {active?.blueSparks ?? 0} blue · {active?.pinkSparks ?? 0} pink · {active?.crowns ?? 0} crowns</p>
      <div className="lesson-toolbar">{REWARD_VARIANTS.map(variant => <button key={variant} disabled={!active} onClick={() => {
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
