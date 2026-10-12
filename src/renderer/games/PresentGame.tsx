import React, { useEffect, useRef, useState } from 'react';
import { getGame, parseGameInput } from '../../shared/gameHost';
import type { PresentApi, PresentEnvelope, PresentTarget } from '../../shared/presentationSnapshot';

/** The only writable game surface. Control never mounts a second game. */
export function PresentGame({ target, envelope, api, report }: {
  target: Extract<PresentTarget, { kind: 'game' }>;
  envelope: PresentEnvelope;
  api: PresentApi;
  report: PresentApi['reportApplied'];
}) {
  const game = getGame(target.gameId);
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const reporter = useRef(report); reporter.current = report;
  const [status, setStatus] = useState<{ state: 'loading' | 'ready' | 'error'; detail?: string }>({ state: 'loading' });
  const src = game ? new URL(game.entry, window.location.href) : null;
  src?.searchParams.set('instanceId', target.instanceId);
  useEffect(() => {
    ready.current = false;
    const fail = (detail: string) => { ready.current = false; setStatus({ state: 'error', detail }); };
    const timer = window.setTimeout(() => fail('The game did not finish loading. Restart it from Control.'), 20000);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(window.location.href).origin || !event.data || typeof event.data !== 'object') return;
      const value = event.data;
      if (value.channel !== 'story-studio-game' || value.instanceId !== target.instanceId) return;
      if (value.type === 'ready') { window.clearTimeout(timer); ready.current = true; setStatus({ state: 'ready' }); }
      else if (value.type === 'error') { window.clearTimeout(timer); fail(typeof value.detail === 'string' ? value.detail.slice(0, 2048) : 'The game could not be displayed. Restart it from Control.'); }
    };
    window.addEventListener('message', receive);
    const unsubscribe = api.subscribeGameInput(value => {
      const packet = parseGameInput(value);
      if (!ready.current || !packet || packet.instanceId !== target.instanceId) return;
      const destination = new URL(window.location.href).origin;
      frame.current?.contentWindow?.postMessage({ channel: 'story-studio-game', type: 'input', ...packet }, destination === 'null' ? '*' : destination);
    });
    return () => { ready.current = false; window.clearTimeout(timer); window.removeEventListener('message', receive); unsubscribe(); };
  }, [target.instanceId, api]);
  useEffect(() => {
    if (!game) reporter.current(envelope.generation, envelope.sequence, true, 'This game is not installed.');
    else if (status.state !== 'loading') reporter.current(envelope.generation, envelope.sequence, status.state === 'error', status.detail);
  }, [game, status, envelope.generation, envelope.sequence]);
  return <section className="present-game" aria-label={game?.title ?? 'Game'}>
    {status.state === 'loading' && <p className="present-game-loading">Loading {game?.title ?? 'game'}…</p>}
    {game && status.state !== 'error' && <iframe ref={frame} title={game.title} data-game-instance={target.instanceId} src={src!.href} style={{ width: '100%', height: '100%' }} sandbox="allow-scripts allow-same-origin allow-downloads" allow="autoplay; fullscreen" onError={() => { ready.current = false; setStatus({ state: 'error', detail: 'The game could not be loaded. Restart it from Control.' }); }} />}
    {status.state === 'error' && <p role="alert">The game could not be displayed. Restart it from Control.</p>}
  </section>;
}
