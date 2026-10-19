import { useState } from 'react';
import { getHostedBossSession, type CoreInventoryRow } from '../hosted/hostedSession';

/** Read-only Core projection. Participant labels reveal no private profile identity. */
export function CoreInventory() {
  const session = getHostedBossSession();
  const [rows, setRows] = useState<CoreInventoryRow[] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!session) return null;
  return <details style={{ marginBlock: 12 }}><summary>Adventure inventory</summary>
    <p>Approved rewards for this activity’s participants.</p>
    <button disabled={busy} onClick={() => { setBusy(true); setError(''); void session.inventory().then(setRows).catch(reason => setError(String(reason))).finally(() => setBusy(false)); }}>Refresh Core inventory</button>
    {rows?.map((row, index) => <p key={index}>Participant {index + 1}: {row.rewards.reduce((sum, reward) => sum + reward.quantity, 0)} approved rewards</p>)}
    {rows?.length === 0 && <p>No permanent participants in this activity.</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
