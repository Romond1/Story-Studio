import React, { useEffect, useRef, useState } from 'react';
import type { PresentApi, PresentEnvelope, PresentTarget } from '../shared/presentationSnapshot';
import { localPreviewVideoSdp, localLessonAudioSdp, type MediaPlaybackStatus } from '../shared/presentationMedia';
import { clampVideoTimeToTrim, getEffectiveVideoTrim, shouldStopAtTrimOut } from '../shared/videoTrim';
import { LocalMediaPeer } from './presentationMediaBridge';
import { LogicalSceneFrame, PassiveOverlays, PassiveDrawings, overlayGraphic } from './StaticScene';
import { SceneReadiness } from '../shared/staticScene';
import { PassiveActivities } from './ActivityScene';
import { TransitionLayers } from './TransitionLayers';

/** Source-only graph: this renderer has no audible destination or mixer. */
export function PresentVideoScene({ envelope, target, api }: { envelope: PresentEnvelope; target: Extract<PresentTarget, { kind: 'video' }>; api: PresentApi }) {
  const video = useRef<HTMLVideoElement>(null);
  const live = useRef({ envelope, target }); live.current = { envelope, target };
  const graph = useRef<{ context: AudioContext; source: MediaElementAudioSourceNode; stream: MediaStreamAudioDestinationNode }>();
  const link = useRef<LocalMediaPeer>();
  const receiverReady = useRef(false), metadata = useRef(false);
  const [failed, setFailed] = useState(false);
  const [, redraw] = useState(0);
  const assets = [...new Set([
    ...(target.scene?.overlays ?? []).map(overlayGraphic).filter((src): src is string => !!src),
    ...Object.values(target.activity?.images ?? {}), ...(target.activity?.break?.thumbnails.map(t => t.src) ?? []),
    ...(target.activity?.break?.background?.match(/^url\(['"]?(media:\/\/.*?)['"]?\)$/)?.[1] ? [target.activity.break.background.match(/^url\(['"]?(media:\/\/.*?)['"]?\)$/)![1]] : []),
  ])];
  const assetKey = JSON.stringify(assets);
  const readiness = useRef({ key: assetKey, state: new SceneReadiness(assets) });
  if (readiness.current.key !== assetKey) readiness.current = { key: assetKey, state: new SceneReadiness(assets) };
  const reportReadiness = () => {
    if (!metadata.current || !receiverReady.current || !video.current || video.current.readyState < 2 || video.current.seeking || live.current.target.media.rendererGeneration !== live.current.envelope.rendererGeneration || readiness.current.state.state === 'loading') return;
    api.reportApplied(live.current.envelope.generation, live.current.envelope.sequence, failed || readiness.current.state.state === 'error');
  };
  useEffect(() => {
    const owner = readiness.current;
    const images = assets.map(src => { const image = new Image();
      const settle = (error: boolean) => { if (readiness.current !== owner) return; owner.state.settle(src, error); redraw(n => n + 1); reportReadiness(); };
      image.onload = () => settle(false); image.onerror = () => settle(true); image.src = src; return image;
    });
    return () => { images.forEach(image => { image.onload = null; image.onerror = null; }); };
  }, [assetKey]);
  const status = (state: MediaPlaybackStatus['state'], message?: string) => {
    const media = live.current.target.media; const element = video.current;
    if (!element || media.rendererGeneration !== live.current.envelope.rendererGeneration) return;
    api.sendMedia({ type: 'status', generation: media.rendererGeneration, identity: media.identity, bridgeEpoch: media.bridgeEpoch,
      status: { identity: media.identity, epoch: media.epoch, state, positionSec: Number.isFinite(element.currentTime) ? element.currentTime : 0, durationSec: Number.isFinite(element.duration) ? element.duration : 0, ...(message ? { message } : {}) } });
  };
  const reportError = (reason: unknown) => {
    video.current?.pause(); receiverReady.current = false; status('error', String(reason));
    api.reportApplied(live.current.envelope.generation, live.current.envelope.sequence, true, String(reason));
  };
  const apply = async () => {
    const element = video.current; const media = live.current.target.media; const owner = link.current;
    if (!element) return;
    if (!media.playing || media.rendererGeneration !== live.current.envelope.rendererGeneration || !metadata.current || !receiverReady.current || !owner || owner.disposed) { element.pause(); return; }
    try {
      await graph.current?.context.resume();
      if (link.current !== owner || owner.disposed || live.current.target.media.epoch !== media.epoch || !live.current.target.media.playing) return;
      await element.play();
    } catch (error) { if (link.current === owner && !owner.disposed && live.current.target.media.epoch === media.epoch && !(error instanceof DOMException && error.name === 'AbortError')) reportError(error); }
  };
  useEffect(() => {
    const element = video.current!;
    let context: AudioContext | undefined;
    try {
      context = new AudioContext({ sinkId: { type: 'none' }, latencyHint: 'interactive', sampleRate: 48000 } as AudioContextOptions);
      const source = context.createMediaElementSource(element);
      const stream = context.createMediaStreamDestination(); source.connect(stream);
      graph.current = { context, source, stream };
    } catch (error) { element.pause(); if (context) void context.close(); reportError(error); return; }
    const owner = graph.current;
    return () => {
      element.pause(); link.current?.dispose(); owner.source.disconnect(); owner.stream.disconnect();
      owner.stream.stream.getTracks().forEach(track => track.stop()); void owner.context.close(); graph.current = undefined;
    };
  }, []);
  useEffect(() => {
    const element = video.current!; element.pause(); receiverReady.current = false;
    if (target.media.rendererGeneration !== envelope.rendererGeneration || !graph.current) return;
    const owner = new LocalMediaPeer(target.media, packet => api.sendMedia(packet)); link.current = owner;
    let captured: MediaStream | undefined;
    let cancelWait: (() => void) | undefined;
    const readyTimeout = setTimeout(() => { if (!owner.disposed && !receiverReady.current) reportError('Video audio connection timed out. Press Play to retry.'); }, 12000);
    for (const track of graph.current!.stream.stream.getAudioTracks()) owner.peer.addTrack(track, graph.current!.stream.stream);
    const position = () => { element.currentTime = clampVideoTimeToTrim(live.current.target.media.positionSec, live.current.target.media.trim, element.duration); };
    if (metadata.current) position(); else element.addEventListener('loadedmetadata', position, { once: true });
    const unsubscribe = api.subscribeMedia(packet => {
      if (!owner.matches(packet)) return;
      if (packet.type === 'receiver-ready') { receiverReady.current = true; status('ready'); reportReadiness(); void apply(); }
      else void owner.remote(packet).catch(error => { if (!owner.disposed) reportError(error); });
    });
    owner.peer.onconnectionstatechange = () => {
      if (!owner.disposed && ['failed','disconnected'].includes(owner.peer.connectionState)) reportError('Video audio connection was lost.');
    };
    void (async () => {
      await graph.current!.context.resume(); if (owner.disposed) return;
      if (graph.current!.context.state !== 'running') throw new Error('Video audio could not start.');
      // Capture already-decoded frames. Control never opens/seeks another file decoder.
      if (element.readyState < 2 || element.seeking) await new Promise<void>(resolve => {
        const finish = () => { for (const type of ['loadeddata', 'canplay', 'seeked']) element.removeEventListener(type, ready); cancelWait = undefined; resolve(); };
        const ready = () => { if (element.readyState >= 2 && !element.seeking) finish(); };
        cancelWait = finish;
        for (const type of ['loadeddata', 'canplay', 'seeked']) element.addEventListener(type, ready);
        ready();
      });
      if (owner.disposed) return;
      captured = (element as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
      captured.getAudioTracks().forEach(track => track.stop());
      for (const track of captured.getVideoTracks()) {
        track.contentHint = 'detail';
        const sender = owner.peer.addTrack(track, captured);
        const parameters = sender.getParameters();
        parameters.degradationPreference = 'maintain-resolution';
        parameters.encodings = parameters.encodings.map(encoding => ({ ...encoding, maxBitrate: 12_000_000, scaleResolutionDownBy: 1 }));
        await sender.setParameters(parameters);
        if (owner.disposed) return;
      }
      const offer = await owner.peer.createOffer(); if (owner.disposed) return;
      offer.sdp = localPreviewVideoSdp(localLessonAudioSdp(offer.sdp!));
      await owner.peer.setLocalDescription(offer);
      owner.emit({ type: 'offer', description: { type: 'offer', sdp: offer.sdp! } });
    })().catch(error => { if (!owner.disposed) reportError(error); });
    return () => { clearTimeout(readyTimeout); element.pause(); element.removeEventListener('loadedmetadata', position); unsubscribe(); owner.dispose(); cancelWait?.(); captured?.getTracks().forEach(track => track.stop()); if (link.current === owner) link.current = undefined; receiverReady.current = false; };
  }, [target.media.identity, target.media.bridgeEpoch, target.media.rendererGeneration, envelope.rendererGeneration]);
  useEffect(() => { void apply(); }, [target.media.epoch, envelope.rendererGeneration]);
  useEffect(() => {
    const timer = setInterval(() => {
      const element = video.current!;
      if (shouldStopAtTrimOut(element.currentTime, live.current.target.media.trim, element.duration)) {
        element.pause(); element.currentTime = getEffectiveVideoTrim(live.current.target.media.trim, element.duration).outSec; status('ended');
      } else if (metadata.current) status(element.paused ? 'paused' : 'playing');
    }, 200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    reportReadiness();
  }, [envelope, failed]);
  const scene = target.scene;
  return <LogicalSceneFrame frame={scene?.frame ?? { width: 1280, height: 720 }}>
    <TransitionLayers event={envelope.snapshot?.transition} heightFraction={scene?.imageHeightFraction ?? 1}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${scene?.viewport?.pan.x ?? 0}px, ${scene?.viewport?.pan.y ?? 0}px) scale(${scene?.viewport?.zoom ?? 1})` }}>
        <video ref={video} src={target.src} playsInline preload="auto" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
          onLoadedMetadata={() => { metadata.current = true; status('loading'); reportReadiness(); void apply(); }}
          onLoadedData={reportReadiness} onSeeked={reportReadiness}
          onPlay={() => status('playing')} onPause={() => status('paused')} onEnded={() => status('ended')}
          onError={() => { setFailed(true); reportError('This video could not be played.'); }} />
        {failed && <p>This video could not be played.</p>}
        <PassiveOverlays overlays={scene?.overlays ?? []} onGraphicError={src => { readiness.current.state.settle(src, true); redraw(n => n + 1); reportReadiness(); }} />
      </div>
    </TransitionLayers>
    {target.activity && <PassiveActivities scene={target.activity} />}
    <PassiveDrawings frame={scene?.frame ?? { width: 1280, height: 720 }} viewport={scene?.viewport} markers={scene?.markerStrokes} transient={scene?.transient} />
  </LogicalSceneFrame>;
}
