import { useEffect, useRef, useState } from 'react';
import type { EpisodeProject } from '../../shared/episode/model';
import type { StudentRosterEntry } from '../../shared/types';
import type { ProgressionResult, ProgressionState } from '../../shared/progression/model';

export function ProgressionPanel({ project, folder, roster, participants, refreshKey, onChange }: {
  project: EpisodeProject; folder: string; roster: StudentRosterEntry[]; participants: string[]; refreshKey: number; onChange: () => void;
}) {
  const [snapshot, setSnapshot] = useState<ProgressionState | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState(''), [rewardId, setRewardId] = useState(''), [quantity, setQuantity] = useState(1), [reason, setReason] = useState('');
  const [eventKey, setEventKey] = useState(''), [relicId, setRelicId] = useState(''), [progress, setProgress] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const pendingIds = useRef(new Map<string, string>()), lock = useRef(false);
  const definition = project.adventureDefinition;
  const refresh = async () => setSnapshot(await window.appApi.progression.getSnapshot());
  useEffect(() => { let current = true; void window.appApi.progression.getSnapshot().then(value => { if (current) setSnapshot(value); }).catch(failure => { if (current) setError(String(failure)); }); return () => { current = false; }; }, [project.adventure.id, refreshKey]);
  const perform = async (key: string, operation: (commandId: string) => Promise<ProgressionResult>) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    const id = pendingIds.current.get(key) ?? crypto.randomUUID(); pendingIds.current.set(key, id);
    try { const result = await operation(id); if (!result.accepted) throw new Error(result.reason ?? 'Core rejected the operation.'); pendingIds.current.delete(key); await refresh(); onChange(); }
    catch (failure) { setError(String(failure)); }
    finally { lock.current = false; setBusy(false); }
  };
  const name = (id: string) => roster.find(student => student.id === id)?.name ?? 'Archived participant';
  const history = snapshot?.history.filter(item => item.adventureId === project.adventure.id) ?? [];
  const completions = history.filter(item => item.kind === 'activity-completed');
  const selectedEvent = completions.find(item => item.id === eventKey);
  const eventDefinition = snapshot?.runs.find(run => run.context.runId === selectedEvent?.runId)?.adventureDefinition;
  const requests = snapshot?.requests.filter(item => item.adventureId === project.adventure.id && item.status === 'pending') ?? [];
  const progressRows = snapshot?.students.filter(item => item.adventureId === project.adventure.id && (!studentId || item.studentId === studentId)) ?? [];
  return <details className="lesson-panel-content" aria-label="Permanent progress"><summary>Rewards and progress ({requests.length} pending)</summary>
    <p>Game scores are session results. Permanent rewards require teacher approval. Guests do not receive permanent rewards.</p>
    <button disabled={busy} onClick={() => void refresh().catch(failure => setError(String(failure)))}>Refresh progress</button>
    {requests.map(request => {
      const captured = snapshot?.runs.find(run => run.context.runId === request.runId)?.adventureDefinition;
      const selected = choices[request.id] ?? request.rewardId ?? '';
      return <div className="lesson-field" key={request.id}>
        <strong>{name(request.studentId)} · {request.quantity} requested</strong>
        {request.blockedReason && <span>{request.blockedReason}</span>}
        <label>Requested reward<select aria-label={`Requested reward for ${name(request.studentId)}`} value={selected} onChange={event => setChoices(old => ({ ...old, [request.id]: event.target.value }))}><option value="">Choose captured reward</option>{captured?.rewards.map(reward => <option key={reward.id} value={reward.id}>{reward.name}</option>)}</select></label>
        <div className="lesson-toolbar"><button disabled={busy || !selected} onClick={() => void perform(JSON.stringify(['approve', request.id, selected]), commandId => window.appApi.progression.decideReward({ commandId, requestId: request.id, decision: 'approve', rewardId: selected }))}>Approve reward for {name(request.studentId)}</button>
        <button disabled={busy} onClick={() => void perform(`reject:${request.id}`, commandId => window.appApi.progression.decideReward({ commandId, requestId: request.id, decision: 'reject' }))}>Reject reward for {name(request.studentId)}</button></div>
      </div>;
    })}
    <details><summary>Request a reward for a completed activity</summary>
      <label className="lesson-field">Completed activity<select value={eventKey} onChange={event => { setEventKey(event.target.value); setRewardId(''); }}><option value="">Choose captured result</option>{completions.map((event, index) => <option key={event.id} value={event.id}>Activity {index + 1} · {event.studentIds.map(name).join(', ') || 'Guests only'}</option>)}</select></label>
      <label className="lesson-field">Completion reward<select value={rewardId} onChange={event => setRewardId(event.target.value)}><option value="">Choose reward</option>{eventDefinition?.rewards.map(reward => <option key={reward.id} value={reward.id}>{reward.name}</option>)}</select></label>
      <label className="lesson-field">Reward quantity<input type="number" min="1" max="1000" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label>
      <button disabled={busy || !selectedEvent || !rewardId || !eventDefinition || quantity < 1} onClick={() => void perform(JSON.stringify(['request', eventKey, rewardId, quantity]), commandId => window.appApi.progression.requestReward({ commandId, eventKey, rewardId, quantity }))}>Request completion reward</button>
      {selectedEvent && !eventDefinition && <p>This run had no reward definitions. Add definitions in Edit before starting a new activity.</p>}
    </details>
    <label className="lesson-field">Progress student<select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">All students</option>{roster.map(student => <option key={student.id} value={student.id}>{student.name}{student.archived ? ' (archived)' : ''}</option>)}</select></label>
    <div aria-label="Adventure inventory">{progressRows.length ? progressRows.map(row => <div key={row.studentId}><strong>{name(row.studentId)}</strong>
      {Object.entries(row.inventory).map(([id, amount]) => <p key={id}>{definition?.rewards.find(reward => reward.id === id)?.name ?? 'Historical reward'}: {amount}</p>)}
      {Object.entries(row.relics).map(([id, amount]) => <p key={id}>{definition?.relics.find(relic => relic.id === id)?.name ?? 'Historical relic'} progress: {amount}</p>)}
      <p>{row.completedEpisodes.length} completed episodes</p>
    </div>) : <p>No permanent progress recorded for this adventure.</p>}</div>
    <details><summary>Teacher adjustments</summary>
      {!definition ? <p>Add adventure reward and relic definitions in Edit first.</p> : <>
        <label className="lesson-field">Adjustment reward<select value={rewardId} onChange={event => setRewardId(event.target.value)}><option value="">Choose reward</option>{definition.rewards.map(reward => <option key={reward.id} value={reward.id}>{reward.name}</option>)}</select></label>
        <label className="lesson-field">Adjustment amount<input type="number" min="-1000" max="1000" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label>
        <label className="lesson-field">Adjustment reason<input value={reason} onChange={event => setReason(event.target.value)} /></label>
        <button disabled={busy || !studentId || !rewardId || !reason.trim() || !quantity} onClick={() => void perform(JSON.stringify(['adjust', studentId, definition, rewardId, quantity, reason]), commandId => window.appApi.progression.adjustReward({ commandId, expectedFolder: folder, studentId, adventureDefinition: definition, rewardId, delta: quantity, reason }))}>Apply reward adjustment</button>
        <label className="lesson-field">Relic<select value={relicId} onChange={event => setRelicId(event.target.value)}><option value="">Choose relic</option>{definition.relics.map(relic => <option key={relic.id} value={relic.id}>{relic.name}</option>)}</select></label>
        <label className="lesson-field">Relic progress<input type="number" min="0" value={progress} onChange={event => setProgress(Number(event.target.value))} /></label>
        <button disabled={busy || !studentId || !relicId || !reason.trim()} onClick={() => void perform(JSON.stringify(['relic', studentId, definition, relicId, progress, reason]), commandId => window.appApi.progression.advanceRelic({ commandId, expectedFolder: folder, studentId, adventureDefinition: definition, relicId, progress, reason }))}>Set relic progress</button>
      </>}
      <button disabled={busy || !participants.some(id => !id.startsWith('guest:'))} onClick={() => { const studentIds = participants.filter(id => !id.startsWith('guest:')); void perform(JSON.stringify(['episode', project.id, studentIds]), commandId => window.appApi.progression.completeEpisode({ commandId, expectedFolder: folder, studentIds, adventureId: project.adventure.id, episodeId: project.id, reason: 'Teacher marked episode complete' })); }}>Mark episode complete for selected participants</button>
    </details>
    <details><summary>Recent activity history</summary><ul>{history.slice(-20).reverse().map(item => <li key={item.id}>{item.kind.replaceAll('-', ' ')} · {item.studentIds.map(name).join(', ')}{item.scores && ` · session scores: ${item.scores.map(score => `${name(score.studentId)} ${score.score}`).join(', ')}`}</li>)}</ul></details>
    {error && <p className="lesson-error" role="alert">{error}</p>}
  </details>;
}
