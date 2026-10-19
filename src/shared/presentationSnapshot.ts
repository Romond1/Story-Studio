import {parseRosterPresentation,type RosterPresentation} from './students/rosterPresentation';
import { parseRewardPresentation, type RewardPresentation } from './rewardPresentation';
import { parseMovementPresentation, type MovementPresentation } from './movementPresentation';
import type { SceneTransitionEvent } from './sceneTransition';
import { parseMediaIntent, type MediaIntent, type MediaPacket } from './presentationMedia';
import { parseActivityScene, type ActivityScene } from './activityScene';
import { normalizeTransientStrokes, type TransientStroke } from './teachingScene';
import type { StaticScene } from './staticScene';
import type { OverlayItem } from './types';
import { resolveImageAdjustments } from './imageAdjustments';
import { parseCardV2RenderPlan, type CardV2RenderPlan } from './cardV2Render';
import { parseScenePlan, type ScenePlan } from './lesson/projection';
import { parseGameSession, type GameInputPacket } from './gameHost';
import {parseDashView,type DashView} from './heroDash';
/** Student-safe projection only. Control remains the sole lesson authority. */
export type PresentTarget =
  | { kind: 'game'; occurrenceId: string; gameId: string; instanceId: string; moduleHost?: true; dash?:DashView }
  | { kind: 'scene'; occurrenceId: string; plan: ScenePlan; media?: MediaIntent }
  | { kind: 'cards-v2'; occurrenceId: string; plan: CardV2RenderPlan }
  | { kind: 'prompt'; occurrenceId: string; title: string; body: string; scene: StaticScene; activity: ActivityScene }
  | { kind: 'video'; occurrenceId: string; src: string; scene?: StaticScene; activity?: ActivityScene; media: MediaIntent }
  | { kind: 'image'; occurrenceId: string; src: string; scene?: StaticScene; activity?: ActivityScene }
  | { kind: 'break' | 'board'; occurrenceId: string; scene: StaticScene; activity: ActivityScene }
  | { kind: 'empty' | 'unsupported' | 'badge'; occurrenceId: string };
export interface PresentSnapshot { roster?:RosterPresentation; sessionId: string; revision: number; target: PresentTarget; cardsV2?: CardV2RenderPlan; transition?: SceneTransitionEvent; movement?: MovementPresentation; rewards?: RewardPresentation }
export interface PresentEnvelope { generation: number; sequence: number; snapshot: PresentSnapshot | null; rendererGeneration?: number }
export interface PresentApi {
  sendDashZoom?:(instanceId:string,zoom:number)=>void;
  subscribeModuleHost?: (listener: (message: import('./modules/protocol').HostToModuleMessage) => void) => () => void;
  requestModule?: (instanceId: string) => Promise<import('./modules/protocol').HostToModuleMessage | null>;
  sendModuleEvent?: (message: import('./modules/protocol').ModuleToHostMessage) => void;
  subscribeGameInput(listener: (packet: GameInputPacket) => void): () => void;
  reportViewport?: (viewport: { width: number; height: number }) => void;
  subscribeMedia(listener: (packet: MediaPacket) => void): () => void;
  sendMedia(packet: MediaPacket): void;
  subscribeSnapshot(listener: (snapshot: PresentEnvelope) => void): () => void;
  requestSnapshot(): Promise<PresentEnvelope>;
  reportApplied(generation: number, sequence: number, error?: boolean, detail?: string): void;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1024;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const revision = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** Reconstruct a whitelisted object: never forward project/teacher fields through IPC. */
export function parsePresentSnapshot(value: unknown): PresentSnapshot | null {
 const base=parsePresentSnapshotBody(value);if(!base||!object(value))return null;
 const roster=value.roster===undefined?undefined:parseRosterPresentation(value.roster);
 return roster===null?null:{...base,...(roster?{roster}:{})};
}
function parsePresentSnapshotBody(value: unknown): PresentSnapshot | null {
  if (!object(value) || !id(value.sessionId) || !revision(value.revision) || !object(value.target)) return null;
  const rewards = value.rewards === undefined ? undefined : parseRewardPresentation(value.rewards);
  if (rewards === null) return null;
  const movement = value.movement === undefined ? undefined : parseMovementPresentation(value.movement);
  if (movement === null) return null;
  const cardsV2 = value.cardsV2 === undefined ? undefined : parseCardV2RenderPlan(value.cardsV2);
  if (cardsV2 === null) return null;
  const target = value.target;
  if (!id(target.occurrenceId)) return null;
  if (target.kind === 'game') {
    const game = parseGameSession(target);
    const dash=target.gameId==='hero-dash'?parseDashView(target.dash):undefined;
    return game && dash!==null ? { sessionId: value.sessionId, revision: value.revision, target: { kind: 'game', occurrenceId: target.occurrenceId, ...game,...(dash?{dash}:{}) } } : null;
  }
  if (target.kind === 'scene') {
    const plan = parseScenePlan(target.plan);
    const media = target.media === undefined ? undefined : parseMediaIntent(target.media);
    if (!plan || media === null || (plan.background.mediaType === 'video' && !media) || (media && plan.background.mediaType !== 'video')) return null;
    return { sessionId: value.sessionId, revision: value.revision, target: { kind: 'scene', occurrenceId: target.occurrenceId, plan, ...(media ? { media } : {}) } };
  }
  if (target.kind === 'cards-v2') {
    const plan = parseCardV2RenderPlan(target.plan);
    return plan ? { sessionId: value.sessionId, revision: value.revision, target: { kind: 'cards-v2', occurrenceId: target.occurrenceId, plan }, ...(movement ? { movement } : {}), ...(rewards ? { rewards } : {}) } : null;
  }
  if (target.kind === 'prompt') {
    if (typeof target.title !== 'string' || typeof target.body !== 'string' || target.title.length > 8192 || target.body.length > 65536) return null;
    const base = parsePresentSnapshot({ ...value, target: { ...target, kind: 'board' } });
    if (!base || base.target.kind !== 'board') return null;
    return { ...base, target: { ...base.target, kind: 'prompt', title: target.title, body: target.body } };
  }
  if (target.kind === 'video') {
    const media = parseMediaIntent(target.media);
    const base = parsePresentSnapshot({ ...value, target: { ...target, kind: 'image' } });
    if (!media || !base || base.target.kind !== 'image') return null;
    return { ...base, target: { ...base.target, kind: 'video', media } };
  }
  if (target.kind === 'empty' || target.kind === 'unsupported' || target.kind === 'badge') {
    return { sessionId: value.sessionId, revision: value.revision, target: { kind: target.kind, occurrenceId: target.occurrenceId }, ...(cardsV2 ? { cardsV2 } : {}), ...(movement ? { movement } : {}), ...(rewards ? { rewards } : {}) };
  }
  if (target.kind === 'break' || target.kind === 'board') {
    const base = parsePresentSnapshot({ ...value, target: { ...target, kind: 'image', src: 'media://scene' } });
    if (!base || base.target.kind !== 'image' || !base.target.scene || !base.target.activity) return null;
    return { ...base, target: { kind: target.kind, occurrenceId: target.occurrenceId, scene: base.target.scene, activity: base.target.activity } };
  }
  // Local media only; no remote trackers, script URLs, or renderer-provided HTML.
  if (target.kind !== 'image' || typeof target.src !== 'string' || target.src.length > 32768 || !target.src.startsWith('media://')) return null;
  let scene: StaticScene | undefined;
  if (target.scene !== undefined) {
    const raw = target.scene;
    if (!object(raw) || !object(raw.frame) || !finite(raw.frame.width) || !finite(raw.frame.height) || raw.frame.width <= 0 || raw.frame.height <= 0 || !Array.isArray(raw.overlays)) return null;
    const overlays: OverlayItem[] = [];
    for (const item of raw.overlays) {
      if (!object(item) || item.visible === false) continue;
      if (!id(item.id) || typeof item.text !== 'string' || !['speechBubble', 'textBox'].includes(String(item.type)) || !['x','y','width','height'].every(k => finite(item[k]))) return null;
      const clean: Record<string, unknown> = { id: item.id, type: item.type, text: item.text, x: item.x, y: item.y, width: item.width, height: item.height };
      for (const k of ['align','bubbleDefId','fontFamily','fontWeight','textColor','fontStyle']) if (typeof item[k] === 'string') clean[k] = item[k];
      for (const k of ['zIndex','fontSize','lineHeight']) if (finite(item[k])) clean[k] = item[k];
      for (const k of ['flipX','flipY','textShadow']) if (typeof item[k] === 'boolean') clean[k] = item[k];
      if (typeof item.customImageSrc === 'string' && item.customImageSrc.startsWith('media://')) clean.customImageSrc = item.customImageSrc;
      if (object(item.textRect) && ['x','y','width','height'].every(k => finite((item.textRect as Record<string, unknown>)[k]))) clean.textRect = { x: item.textRect.x, y: item.textRect.y, width: item.textRect.width, height: item.textRect.height };
      overlays.push(clean as unknown as OverlayItem);
    }
    scene = { frame: { width: raw.frame.width, height: raw.frame.height }, adjustments: resolveImageAdjustments(object(raw.adjustments) ? raw.adjustments : undefined), overlays };
    if (raw.imageHeightFraction === 0.5) scene.imageHeightFraction = 0.5;
    if (raw.viewport !== undefined) {
      const v = raw.viewport;
      if (!object(v) || !finite(v.zoom) || v.zoom < 1 || v.zoom > 4 || !object(v.pan) || !finite(v.pan.x) || !finite(v.pan.y)) return null;
      scene.viewport = { zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y } };
    }
    for (const key of ['markerStrokes', 'transient'] as const) {
      if (raw[key] === undefined) continue;
      if (!Array.isArray(raw[key])) return null;
      const strokes: TransientStroke[] = [];
      for (const stroke of raw[key]) {
        if (!object(stroke) || !id(stroke.id) || !finite(stroke.size) || !finite(stroke.opacity) || typeof stroke.color !== 'string' || !Array.isArray(stroke.points)) return null;
        const points = [];
        for (const point of stroke.points) {
          if (!object(point) || !finite(point.x) || !finite(point.y) || !finite(point.t)) return null;
          points.push({ x: point.x, y: point.y, t: point.t, ...(finite(point.h) ? { h: point.h } : {}) });
        }
        strokes.push({ id: stroke.id, size: stroke.size, opacity: stroke.opacity, color: stroke.color, rainbow: stroke.rainbow === true, points,
          ...(key === 'transient' && finite(stroke.fadeMs) ? { fadeMs: stroke.fadeMs } : {}),
          ...(key === 'transient' && stroke.sparkle === true ? { sparkle: true } : {}),
        });
      }
      scene[key] = key === 'transient' ? normalizeTransientStrokes(strokes) : strokes;
    }
  }
  const activity = target.activity === undefined ? undefined : parseActivityScene(target.activity);
  if (activity === null) return null;
  let transition: SceneTransitionEvent | undefined;
  if (value.transition !== undefined) {
    const t = value.transition;
    if (!object(t) || !id(t.id) || !id(t.fromOccurrenceId) || t.toOccurrenceId !== target.occurrenceId || !finite(t.startedAt) || t.startedAt < 0 || !finite(t.durationMs) || t.durationMs <= 0 || t.durationMs > 60000 || !['fade','crossfade','fade-black','cinematic','pixel','blur','card-slide'].includes(String(t.kind)) || !['left','right','up','down'].includes(String(t.direction)) || !object(t.from)) return null;
    const parsedFrom = parsePresentSnapshot({ sessionId: value.sessionId, revision: value.revision, target: { kind: 'image', occurrenceId: t.fromOccurrenceId, src: t.from.src, scene: t.from.scene } });
    if (!parsedFrom || parsedFrom.target.kind !== 'image') return null;
    const fromScene = parsedFrom.target.scene;
    if (fromScene) { delete fromScene.markerStrokes; delete fromScene.transient; }
    transition = { id: t.id, startedAt: t.startedAt, durationMs: t.durationMs, kind: t.kind as SceneTransitionEvent['kind'], direction: t.direction as SceneTransitionEvent['direction'], fromOccurrenceId: t.fromOccurrenceId, toOccurrenceId: target.occurrenceId,
      from: { occurrenceId: t.fromOccurrenceId, src: parsedFrom.target.src, ...(fromScene ? { scene: fromScene } : {}) } };
  }
  return { sessionId: value.sessionId, revision: value.revision, target: { kind: 'image', occurrenceId: target.occurrenceId, src: target.src, ...(scene ? { scene } : {}), ...(activity ? { activity } : {}) }, ...(cardsV2 ? { cardsV2 } : {}), ...(transition ? { transition } : {}), ...(movement ? { movement } : {}), ...(rewards ? { rewards } : {}) };
}

/** Main owns only transport order, never navigation or document mutation. */
export class PresentSnapshotRelay {
  private current: PresentEnvelope = { generation: 0, sequence: 0, snapshot: null };
  private retiredSessions = new Set<string>();
  get envelope(): PresentEnvelope { return this.current; }
  reset(): PresentEnvelope {
    this.retiredSessions.clear();
    this.current = { generation: this.current.generation + 1, sequence: 0, snapshot: null };
    return this.current;
  }
  publish(value: unknown): PresentEnvelope | null {
    const snapshot = parsePresentSnapshot(value);
    if (!snapshot || this.retiredSessions.has(snapshot.sessionId)) return null;
    const previous = this.current.snapshot;
    if (previous?.sessionId === snapshot.sessionId && snapshot.revision <= previous.revision) return null;
    if (previous && previous.sessionId !== snapshot.sessionId) this.retiredSessions.add(previous.sessionId);
    this.current = { generation: this.current.generation, sequence: this.current.sequence + 1, snapshot };
    return this.current;
  }
}

export function assessPresentEnvelope(current: PresentEnvelope | null, incoming: PresentEnvelope): 'apply' | 'ignore' | 'recover' {
  if (!current) return 'apply';
  if ((incoming.rendererGeneration ?? 0) > (current.rendererGeneration ?? 0)) return 'apply';
  if ((incoming.rendererGeneration ?? 0) < (current.rendererGeneration ?? 0)) return 'ignore';
  if (incoming.generation < current.generation || (incoming.generation === current.generation && incoming.sequence <= current.sequence)) return 'ignore';
  if (incoming.generation === current.generation && incoming.sequence > current.sequence + 1) return 'recover';
  return 'apply';
}
