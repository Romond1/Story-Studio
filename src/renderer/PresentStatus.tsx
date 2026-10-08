import { useEffect, useState } from 'react';
import type { PresentStatus as Status } from '../shared/presentStatus';

export function PresentStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    let disposed = false;
    let received = false;
    const unsubscribe = window.appApi.onPresentStatus?.(next => { received = true; setStatus(next); });
    void window.appApi.getPresentStatus?.().then(next => { if (!disposed && !received) setStatus(next); }).catch(() => {});
    return () => { disposed = true; unsubscribe?.(); };
  }, []);
  const label = status?.state === 'ready' ? 'Present Ready' : status?.state === 'connecting' ? 'Present Syncing' : status?.state === 'error' ? 'Present Error' : 'Present Closed';
  return <span role="status" style={{ fontSize: '0.75rem', color: status?.state === 'error' ? '#ffbdad' : '#b5c7dd' }}
    title={[status?.detail, status?.needsReshare ? 'Present was recreated. Select the new Present window in your conferencing app.' : label].filter(Boolean).join('\n')}>
    {label}{status?.needsReshare && status.state !== 'closed' ? ' · Share the new window' : ''}
  </span>;
}
