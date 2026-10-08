import { visualMediaUrl, visualMediaBackground } from '../shared/visualMedia';
import type { RewardPresentation } from '../shared/rewardPresentation';
import { SceneTransitionCore, transitionTiming } from '../shared/sceneTransition';
import { parseActivityScene, type ActivityScene } from '../shared/activityScene';
import type { StaticScene } from '../shared/staticScene';
import { useEffect, useRef, useState } from 'react';
import type { PresentSnapshot, PresentTarget } from '../shared/presentationSnapshot';
import type { PresentationSession, PresentationTarget } from '../shared/presentationSession';
import type { AssetItem } from '../shared/types';
import type { CardV2RenderPlan } from '../shared/cardV2Render';

/** Control is the only authority. Main relays full projections, never commands.
 * Static proof only: complex targets clear Present instead of leaving stale media. */
export function usePresentProjection(session: PresentationSession, target: PresentationTarget, asset: AssetItem | null, src: string | null, scene?: StaticScene, activity?: ActivityScene, projectGeneration = 0, media?: import('../shared/presentationMedia').MediaIntent | null, rewards?: RewardPresentation, cardsV2?: CardV2RenderPlan) {
  const occurrenceId = JSON.stringify([session.projectId, projectGeneration, target.occurrenceId]);
  const visualScope = JSON.stringify([session.sessionId, session.projectId, projectGeneration]);
  const namespace = (url: string) => visualMediaUrl(url, visualScope);
  const safeCardsV2 = cardsV2 ? { ...cardsV2, cards: cardsV2.cards.map(card => ({ ...card, ...(card.image ? { image: { ...card.image, src: namespace(card.image.src) } } : {}) })) } : undefined;
  if (scene) scene = { ...scene, overlays: scene.overlays.map(o => ({ ...o, ...(o.customImageSrc ? { customImageSrc: namespace(o.customImageSrc) } : {}) })) };
  const safeActivity = activity ? parseActivityScene(activity) : undefined;
  if (safeActivity) {
    safeActivity.images = Object.fromEntries(Object.entries(safeActivity.images).map(([id, url]) => [id, namespace(url)]));
    if (safeActivity.break) {
      safeActivity.break.thumbnails = safeActivity.break.thumbnails.map(t => ({ ...t, src: namespace(t.src) }));
      safeActivity.break.background = safeActivity.break.background ? visualMediaBackground(safeActivity.break.background, visualScope) : undefined;
    }
  }
  const projection: PresentTarget = target.kind === 'cards-v2' && safeCardsV2 ? { kind: 'cards-v2', occurrenceId, plan: safeCardsV2 } : target.contentId === 'badge' ? { kind: 'badge', occurrenceId } : target.kind === 'empty'
    ? { kind: 'empty', occurrenceId }
    : target.kind === 'prompt' && target.item?.type === 'promptCard' && scene && safeActivity
      ? { kind: 'prompt', occurrenceId, title: target.item.title ?? '', body: target.item.body ?? '', scene, activity: safeActivity }
    : (target.kind === 'slide' || target.kind === 'board') && asset?.mediaType === 'video' && src && media
      ? { kind: 'video', occurrenceId, src: namespace(src), scene, activity: safeActivity ?? undefined, media }
    : target.kind === 'board' && target.slide && asset?.mediaType === 'image' && src
      ? { kind: 'image', occurrenceId, src: namespace(src), scene, activity: safeActivity ?? undefined }
    : (target.kind === 'break' || target.kind === 'board') && scene && activity
      ? { kind: target.kind, occurrenceId, scene, activity: safeActivity! }
    : target.kind === 'slide' && asset?.mediaType === 'image' && src
      // Protocol resolution ignores the query; project identity prevents an image
      // cached under the same relative path in a different lesson being reused.
      ? { kind: 'image', occurrenceId, src: namespace(src), scene, ...(activity ? { activity: safeActivity! } : {}) }
      : { kind: 'unsupported', occurrenceId };
  const scope = JSON.stringify([session.sessionId, session.projectId, projectGeneration]);
  const core = useRef({ scope, transitions: new SceneTransitionCore() });
  const [, refresh] = useState(0);
  if (core.current.scope !== scope) core.current = { scope, transitions: new SceneTransitionCore() };
  const duration = target.slide?.transitionDuration ?? 500;
  const transition = core.current.transitions.observe(JSON.stringify([session.targetRevision, occurrenceId]), projection, {
    kind: target.slide?.transition ?? 'none',
    durationMs: Number.isFinite(duration) ? Math.max(0, Math.min(60000, duration)) : 500,
    direction: target.slide?.transitionDirection ?? 'left',
  }, Date.now(), `${scope}:${session.targetRevision}`);
  useEffect(() => {
    if (!transition) return;
    const owner = core.current.transitions;
    const timer = window.setTimeout(() => { if (owner.complete(transition.id)) refresh(n => n + 1); }, transitionTiming(transition, Date.now()).remainingMs);
    return () => clearTimeout(timer);
  }, [transition?.id]);
  const cardOverlay = projection.kind !== 'cards-v2' ? safeCardsV2 : undefined;
  const key = JSON.stringify([session.revision, projection, cardOverlay, transition, session.overlays.movement, rewards]);
  const latest = useRef<PresentSnapshot | null>(null);
  const revision = useRef(0);
  useEffect(() => {
    const snapshot: PresentSnapshot = {
      sessionId: session.sessionId, revision: ++revision.current, target: projection, ...(cardOverlay ? { cardsV2: cardOverlay } : {}), ...(rewards ? { rewards } : {}), ...(transition ? { transition } : {}), ...(session.overlays.movement ? { movement: session.overlays.movement } : {}),
    };
    latest.current = snapshot;
    void window.appApi.publishPresentSnapshot?.(snapshot).catch(error => console.error('Present snapshot failed', error));
  }, [key, session.sessionId]);
  const openPresent = async () => {
    // Publish before opening, including when the window was previously closed.
    if (latest.current) await window.appApi.publishPresentSnapshot(latest.current);
    await window.appApi.openPresent();
  };
  return { openPresent, transition };
}
