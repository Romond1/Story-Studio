import React, { useState } from 'react';
import type { MediaIntent, MediaPlaybackStatus } from '../shared/presentationMedia';
export function MediaTransportControls({ intent, status, available, error, command }: { intent: MediaIntent; status: MediaPlaybackStatus | null; available: boolean; error?: string; command: (action: 'play' | 'pause' | 'seek' | 'replay', position?: number) => void }) {
  const [seek, setSeek] = useState<number | null>(null);
  const duration = status?.durationSec ?? 0;
  const commit = () => { if (seek !== null) { command('seek', seek); setSeek(null); } };
  return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
    <button disabled={!available} onClick={() => command(intent.playing ? 'pause' : 'play')}>{intent.playing ? 'Pause video' : 'Play video'}</button>
    <button disabled={!available} onClick={() => command('replay')}>Replay</button>
    <input aria-label="Video position" type="range" min={intent.trim?.inSec ?? 0} max={Math.max(intent.trim?.inSec ?? 0, intent.trim?.outSec ?? duration)} step="0.1" disabled={!available || !duration}
      value={seek ?? status?.positionSec ?? intent.positionSec} onChange={event => setSeek(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
    <span>{Math.floor(status?.positionSec ?? intent.positionSec)} / {Math.floor(duration)}s</span>
    {(error || !available) && <span role="status">{error ?? 'Present is unavailable. Reopen it, then press Play.'}</span>}
  </span>;
}
