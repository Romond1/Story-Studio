import { useEffect, useRef, useState } from 'react';
import { PresentationMediaCore, type MediaIntent, type MediaRuntime } from '../shared/presentationMedia';
import type { VideoTrimSettings } from '../shared/types';
import { audioManager } from './audio/AudioManager';
import { ControlMediaReceiver } from './presentationMediaBridge';

export function usePresentationMedia(identity: string | null, audio: { enabled: boolean; volume: number }, trim: VideoTrimSettings | undefined, active: boolean, handoffPosition = 0) {
  const core = useRef(new PresentationMediaCore());
  const receiver = useRef<ControlMediaReceiver | null>(null);
  const runtime = useRef<MediaRuntime>({ generation: 0, available: false });
  const [, refresh] = useState(0);
  const [error, setError] = useState<string>();
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  useEffect(() => { setError(undefined); }, [identity]);
  const config = useRef({ identity, audio, trim }); config.current = { identity, audio, trim };
  const previous = useRef({ identity, active });
  const entering = !previous.current.active && active;
  const healthyNavigation = previous.current.active && active && previous.current.identity !== identity && !!identity && runtime.current.available;
  previous.current = { identity, active };
  core.current.configure(identity, runtime.current, audio, trim);
  if (entering && core.current.intent) core.current.command('seek', handoffPosition);
  if (healthyNavigation && core.current.intent) core.current.command('play');
  const intent = core.current.intent;
  const syncReceiver = (next: MediaIntent | null) => {
    const existing = receiver.current;
    if (!next || !runtime.current.available || (existing && (existing.link.intent.identity !== next.identity || existing.link.intent.bridgeEpoch !== next.bridgeEpoch || existing.link.intent.rendererGeneration !== next.rendererGeneration))) {
      existing?.dispose(); receiver.current = null;
    }
    if (!next || !runtime.current.available) return;
    if (!receiver.current) {
      const owner = new ControlMediaReceiver(next, audioManager, packet => window.appApi.sendPresentMediaPacket(packet), message => {
        if (receiver.current !== owner) return;
        owner.dispose(); receiver.current = null;
        core.current.command('pause'); setError(message); refresh(n => n + 1);
      }, stream => { if (receiver.current === owner) setPreviewStream(stream); });
      receiver.current = owner;
    }
    receiver.current.update(next);
  };
  useEffect(() => { syncReceiver(core.current.intent); }, [JSON.stringify(intent)]);
  useEffect(() => {
    let disposed = false;
    let notified = false;
    const applyRuntime = (next: MediaRuntime) => {
      if (disposed || next.generation < runtime.current.generation) return;
      runtime.current = next;
      const c = config.current; core.current.configure(c.identity, next, c.audio, c.trim);
      syncReceiver(core.current.intent); refresh(n => n + 1);
    };
    const unsubscribeRuntime = window.appApi.onPresentMediaRuntime(next => { notified = true; applyRuntime(next); });
    void window.appApi.getPresentMediaRuntime().then(next => { if (!notified) applyRuntime(next); }).catch(reason => { if (!disposed) setError(String(reason)); });
    const unsubscribePacket = window.appApi.onPresentMediaPacket(packet => {
      // Configure before processing an offer: publication and effects can race across renderers.
      syncReceiver(core.current.intent);
      if (packet.type === 'status') {
        if (core.current.observe(packet, runtime.current.generation)) { if (packet.status?.state === 'error') setError(packet.status.message ?? 'Video playback failed.'); syncReceiver(core.current.intent); refresh(n => n + 1); }
      } else void receiver.current?.receive(packet);
    });
    return () => { disposed = true; unsubscribeRuntime(); unsubscribePacket(); receiver.current?.dispose(); receiver.current = null; };
  }, []);
  const capturedIdentity = intent?.identity;
  const capturedBridge = intent?.bridgeEpoch;
  const capturedEpoch = intent?.epoch;
  const command = async (action: 'play' | 'pause' | 'seek' | 'replay', position?: number) => {
    if (!capturedIdentity || core.current.intent?.identity !== capturedIdentity || core.current.intent?.bridgeEpoch !== capturedBridge || !runtime.current.available) return;
    if (core.current.intent.epoch !== capturedEpoch) return;
    if (action === 'play' || action === 'replay') {
      const owner = core.current.intent;
      try { await audioManager.getContext().resume(); }
      catch (reason) { if (core.current.intent === owner) setError(String(reason)); return; }
      if (core.current.intent !== owner || !runtime.current.available) return;
      if (error) { core.current.command('seek', core.current.status?.positionSec); setError(undefined); }
    }
    core.current.command(action, position); syncReceiver(core.current.intent); refresh(n => n + 1);
  };
  const revoke = async () => {
    core.current.command('pause'); receiver.current?.dispose(); receiver.current = null;
    await window.appApi.revokePresentMedia(); refresh(n => n + 1);
  };
  return { intent, status: core.current.status, available: runtime.current.available, error, command, revoke, previewStream };
}
