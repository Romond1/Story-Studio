import { PromptCardScene } from './PromptCardScene';
import { RewardSurface } from './RewardScene';
import type { RewardPresentation } from '../shared/rewardPresentation';
import { MovementSurface } from './movement/MovementOverlay';
import { TransitionLayers } from './TransitionLayers';
import { PresentVideoScene } from './PresentVideoScene';
import { StudentSceneBoundary } from './StudentSceneBoundary';
import type { ActivityScene } from '../shared/activityScene';
import { PassiveActivities } from './ActivityScene';
import { SceneReadiness } from '../shared/staticScene';
import { LogicalSceneFrame, PassiveImage, PassiveOverlays, PassiveDrawings, overlayGraphic } from './StaticScene';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { assessPresentEnvelope } from '../shared/presentationSnapshot';
import type { PresentApi, PresentEnvelope, PresentTarget } from '../shared/presentationSnapshot';
import './present.css';
import { CardV2Scene } from './cardsV2/CardV2Scene';
import { collectCardV2RenderImages, type CardV2RenderPlan } from '../shared/cardV2Render';

const api = (window as unknown as { presentApi: PresentApi }).presentApi;
function Present() {
  const surface = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const report = () => api.reportViewport?.({ width: element.clientWidth, height: element.clientHeight });
    report(); const observer = new ResizeObserver(report); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [envelope, setEnvelope] = useState<PresentEnvelope | null>(null);
  const current = useRef<PresentEnvelope | null>(null);
  useEffect(() => {
    let disposed = false;
    const receive = (next: PresentEnvelope, recovered = false) => {
      if (disposed) return;
      const decision = assessPresentEnvelope(current.current, next);
      if (decision === 'ignore') return;
      if (decision === 'recover' && !recovered) { void recover(); return; }
      current.current = next; setEnvelope(next);
    };
    const recover = async () => {
      try { receive(await api.requestSnapshot(), true); }
      catch { if (!disposed) { current.current = null; setEnvelope(null); } }
    };
    const unsubscribe = api.subscribeSnapshot(receive);
    void recover();
    return () => { disposed = true; unsubscribe(); };
  }, []);
  const target = envelope?.snapshot?.target;
  const [baseStatus, setBaseStatus] = useState<{generation:number;sequence:number;error:boolean;detail?:string}|null>(null);
  const reportBase: PresentApi['reportApplied'] = (generation, sequence, error=false, detail) => setBaseStatus(previous => previous?.generation===generation&&previous.sequence===sequence&&previous.error ? previous : { generation, sequence, error, detail });
  const rewardSources = rewardAssets(envelope?.snapshot?.rewards);
  const cardOverlay = target?.kind !== 'cards-v2' ? envelope?.snapshot?.cardsV2 : undefined;
  const cardSources = collectCardV2RenderImages(cardOverlay);
  const overlaySources = [...new Set([...rewardSources, ...cardSources])];
  const overlayScope = JSON.stringify([envelope?.generation, envelope?.snapshot?.sessionId, target?.occurrenceId, overlaySources]);
  const [overlayResults, setOverlayResults] = useState<{ scope: string; results: Record<string, boolean> }>({ scope: overlayScope, results: {} });
  const results = overlayResults.scope === overlayScope ? overlayResults.results : {};
  usePreloadAssets(overlaySources, (src, error) => setOverlayResults(previous => ({
    scope: overlayScope,
    results: { ...(previous.scope === overlayScope ? previous.results : {}), [src]: !!error },
  })), overlayScope);
  const rewardReady = rewardSources.every(src => src in results), rewardError = rewardSources.some(src => results[src]);
  const cardsReady = cardSources.every(src => src in results), cardsError = cardSources.some(src => results[src]);
  useEffect(() => {
    if (envelope && (target?.kind === 'empty' || target?.kind === 'unsupported' || target?.kind === 'badge')) reportBase(envelope.generation, envelope.sequence);
  }, [envelope, target]);
  useEffect(() => {
    if (!envelope || baseStatus?.generation !== envelope.generation || baseStatus.sequence !== envelope.sequence) return;
    if (baseStatus.error || rewardError || cardsError) {
      const detail = baseStatus.detail ?? (baseStatus.error ? 'Scene could not be displayed' : cardsError ? 'Card image could not be displayed' : 'Reward image could not be displayed');
      api.reportApplied(envelope.generation, envelope.sequence, true, detail);
    } else if (rewardReady && cardsReady) api.reportApplied(envelope.generation, envelope.sequence);
  }, [envelope, baseStatus, rewardReady, rewardError, cardsReady, cardsError]);
  return <main ref={surface} className="present-surface" style={{ position: 'relative' }}>
    <StudentSceneBoundary recoveryKey={JSON.stringify([envelope?.generation, envelope?.snapshot?.sessionId, envelope?.snapshot?.rewards?.final?.id, rewardSources, cardOverlay, target?.occurrenceId, target && "src" in target ? target.src : null, target && "activity" in target ? [activityAssets(target.activity), target.activity?.boards.map(b => ({ ...b.card, bCardInstances: b.card.bCardInstances.map(i => ({ id: i.id, bCardId: i.bCardId })) })), target.activity?.cards, target.activity?.break] : null])} onError={message => envelope && reportBase(envelope.generation, envelope.sequence, true, message)}>
    {target?.kind === 'cards-v2' ? <PresentCardV2Scene key={target.occurrenceId} plan={target.plan} envelope={envelope!} report={reportBase} /> : target?.kind === 'image' ? <PresentImageScene key={JSON.stringify([envelope!.generation, target.occurrenceId, target.src, target.scene?.overlays.map(overlayGraphic), activityAssets(target.activity)])} envelope={envelope!} target={target} report={reportBase} />
      : target?.kind === 'video' ? <PresentVideoScene key={JSON.stringify([envelope!.generation, target.media.identity, target.src])} target={target} envelope={envelope!} api={{...api,reportApplied:reportBase}} />
      : target?.kind === 'prompt' || target?.kind === 'break' || target?.kind === 'board' ? <PresentActivityScene key={JSON.stringify([target.occurrenceId, activityAssets(target.activity)])} target={target} envelope={envelope!} report={reportBase} />
      : target?.kind === 'badge' ? null : <p>{target?.kind === 'unsupported' ? 'This activity is available in the teaching window.' : 'Waiting for the lesson.'}</p>}
    {cardOverlay && <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', background: 'transparent' }}><CardV2Scene plan={cardOverlay} /></div>}
    {envelope?.snapshot?.rewards && <RewardSurface presentation={envelope.snapshot.rewards} />}
    </StudentSceneBoundary>
    <MovementSurface presentation={envelope?.snapshot?.movement ?? null} />
  </main>;
}
function PresentCardV2Scene({ plan, envelope, report }: { plan: CardV2RenderPlan; envelope: PresentEnvelope; report: PresentApi['reportApplied'] }) {
  const sources = collectCardV2RenderImages(plan);
  const sourceKey = JSON.stringify(sources);
  const latest = useRef({ key: sourceKey, readiness: new SceneReadiness(sources) });
  if (latest.current.key !== sourceKey) latest.current = { key: sourceKey, readiness: new SceneReadiness(sources) };
  const [, update] = useState(0);
  const readiness = latest.current.readiness;
  usePreloadAssets(sources, (src, error) => { readiness.settle(src, error); update(n => n + 1); });
  const status = readiness.state;
  useEffect(() => { if (status !== 'loading') report(envelope.generation, envelope.sequence, status === 'error', status === 'error' ? 'Card image could not be displayed' : undefined); }, [envelope.generation, envelope.sequence, status]);
  return <CardV2Scene plan={plan} />;
}
function PresentImageScene({ envelope, target, report }: { report: PresentApi['reportApplied']; envelope: PresentEnvelope; target: Extract<PresentTarget, { kind: 'image' }> }) {
  // Readiness belongs to this mounted scene. Returning after an empty target must load again.
  const [, setAssetRevision] = useState(0);
  const [baseFailed, setBaseFailed] = useState(false);
  const graphics = (target.scene?.overlays ?? []).map(overlayGraphic).filter((src): src is string => !!src);
  const readiness = useRef<SceneReadiness>();
  if (!readiness.current) readiness.current = new SceneReadiness([target.src, ...graphics, ...activityAssets(target.activity)]);
  const settle = (src: string, error = false) => { readiness.current!.settle(src, error); setAssetRevision(n => n + 1); };
  usePreloadAssets(activityAssets(target.activity), settle);
  const status = readiness.current.state;
  useEffect(() => {
    if (status === 'error') report(envelope.generation, envelope.sequence, true);
    else if (status === 'ready') report(envelope.generation, envelope.sequence);
  }, [envelope, status]);
  if (baseFailed) return <p>This image could not be displayed.</p>;
  return <LogicalSceneFrame frame={target.scene?.frame ?? { width: 1280, height: 720 }}>
    <TransitionLayers event={envelope.snapshot?.transition} heightFraction={target.scene?.imageHeightFraction ?? 1}>
    <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${target.scene?.viewport?.pan.x ?? 0}px, ${target.scene?.viewport?.pan.y ?? 0}px) scale(${target.scene?.viewport?.zoom ?? 1})` }}>
    <PassiveImage src={target.src} adjustments={target.scene?.adjustments} onLoad={() => settle(target.src)} onError={() => { setBaseFailed(true); settle(target.src, true); }} />
    <PassiveOverlays overlays={target.scene?.overlays ?? []} onGraphicLoad={src => settle(src)} onGraphicError={src => settle(src, true)} />
    </div>
    </TransitionLayers>
    {target.activity && <PassiveActivities scene={target.activity} />}
    <PassiveDrawings frame={target.scene?.frame ?? { width: 1280, height: 720 }} viewport={target.scene?.viewport} markers={target.scene?.markerStrokes} transient={target.scene?.transient} />
  </LogicalSceneFrame>;
}
function PresentActivityScene({ target, envelope, report }: { report: PresentApi['reportApplied']; target: Extract<PresentTarget, { kind: 'break' | 'board' | 'prompt' }>; envelope: PresentEnvelope }) {
  const [, update] = useState(0);
  const readiness = useRef(new SceneReadiness(activityAssets(target.activity)));
  usePreloadAssets(activityAssets(target.activity), (src, error) => { readiness.current.settle(src, error); update(n => n + 1); });
  const status = readiness.current.state;
  useEffect(() => { if (status !== 'loading') report(envelope.generation, envelope.sequence, status === 'error'); }, [envelope, status]);
  const { scene } = target;
  return <LogicalSceneFrame frame={scene.frame}>
    <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${scene.viewport?.pan.x ?? 0}px, ${scene.viewport?.pan.y ?? 0}px) scale(${scene.viewport?.zoom ?? 1})` }}>{target.kind === 'prompt' && <PromptCardScene title={target.title} body={target.body} />}<PassiveActivities scene={target.activity} /></div>
    <PassiveDrawings frame={scene.frame} viewport={scene.viewport} markers={scene.markerStrokes} transient={scene.transient} />
  </LogicalSceneFrame>;
}
function activityAssets(activity?: ActivityScene): string[] {
  if (!activity) return [];
  const background = activity.break?.background?.match(/^url\(['"]?(media:\/\/.*?)['"]?\)$/)?.[1];
  return [...new Set([...Object.values(activity.images), ...(activity.break?.thumbnails.map(t => t.src) ?? []), ...(background ? [background] : [])])];
}
function usePreloadAssets(sources: string[], settle: (src: string, error?: boolean) => void, scope?: string) {
  const callback = useRef(settle); callback.current = settle;
  useEffect(() => {
    const activeCallback = callback.current;
    const images = sources.map(src => { const img = new Image(); img.onload = () => activeCallback(src); img.onerror = () => activeCallback(src, true); img.src = src; return img; });
    return () => { images.forEach(img => { img.onload = null; img.onerror = null; }); };
  }, [JSON.stringify(sources), scope]);
}
createRoot(document.getElementById('root')!).render(<Present />);

function rewardAssets(rewards?:RewardPresentation):string[]{
 if(!rewards)return[];
 return [...new Set([...rewards.sparks.map(s=>s.image),rewards.final?.image,rewards.base?.image,rewards.base?.background?.image,...(rewards.base?.sprites.map(s=>s.image)??[]),rewards.relic?.image,rewards.relic?.rewardImage].filter((s):s is string=>!!s))];
}

