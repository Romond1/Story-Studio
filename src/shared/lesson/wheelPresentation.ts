import {prepareMiniGame} from './miniGameSetup';
import type {GameReveal,GameShuffle,MysterySlot} from './gameStage';
import { parseQuestionPlayback, type QuestionPlayback } from './questionPlayback';
import { mediaDisplayTitle } from '../mediaDisplayName';
import { parseGameEffect, type GameEffectCue } from '../gameEffects';
import { parseWheelSpin, type WheelSpin } from './wheelAnimation';
import { buildCardV2FacePlan, parseCardV2RenderPlan, type CardV2CardPlan } from '../cardV2Render';
import type { LessonProject } from './model';
import type { MiniGameConfig } from './miniGameBreak';
import { readWheelSettings, activityLabel } from './spinningWheel';
import { initializeWheel, restoreWheel, wheelSessionProblems, type WheelPhase } from './wheelRuntime';

export interface PublicWheelSegment { id: string; activityId: string; label: string; kind: 'question' | 'event' }
export interface WheelPresentation {
  gameType?: string; reveal?:GameReveal; slots?:MysterySlot[]; shuffle?:GameShuffle;
  effect?: GameEffectCue; rewardIndicator?: { name:string; total:number };
  spin?: WheelSpin; rotationDegrees?: number;
  version: 1; title: string; phase: WheelPhase; revision: number; playCount: number; consumed: number; skipped: number;
  segments: PublicWheelSegment[]; selectedSegmentId: string | null; blocked: boolean;
  activity?: { id: string; kind: 'question' | 'event'; label: string; studentText?: string; card?: CardV2CardPlan; prompt?:string; media?:{kind:'image'|'video'|'audio';src:string;label:string;playback?:QuestionPlayback} };
}
export const WHEEL_CARD_FRAME = { width: 560, height: 420 };
export function projectWheel(config: MiniGameConfig, runtime: unknown, project: LessonProject, source: (id: string) => string | undefined): WheelPresentation {
  config=prepareMiniGame(config,project).config;
  const s = readWheelSettings(config)!;
  const state = restoreWheel(config, runtime) ?? initializeWheel(config)!;
  const blocked = wheelSessionProblems(config, id => !!project.cards[id]?.faces.length,id=>project.assets.some(a=>a.id===id && ['image','video','audio'].includes(a.mediaType))).length > 0;
  const plan: WheelPresentation = { ...(state.spin && ['revealed','active'].includes(state.phase) ? {spin:state.spin} : {}), ...(state.rotationDegrees !== undefined ? {rotationDegrees:state.rotationDegrees} : {}), version: 1, title: s.title || 'Spinning Wheel', phase: state.phase, revision: state.revision,
    playCount: s.playCount, consumed: state.usedActivityIds.length, skipped: state.skippedActivityIds.length, blocked,
    segments: s.segments.map(segment => { const activity = config.activities.find(a => a.id === segment.activityId)!; return { id: segment.id, activityId: activity.id, kind: activity.kind, label: segment.label || activityLabel(activity) }; }), selectedSegmentId: state.selectedSegmentId };
  plan.gameType=config.gameType;
  if(state.spin && state.currentActivityId)plan.reveal={id:state.spin.id,startedAt:state.spin.startedAt,durationMs:state.spin.durationMs,variant:s.revealStyle==='bounce'?0:s.revealStyle==='starlight'?1:s.revealStyle==='portal'?2:Array.from(state.spin.id).reduce((sum,c)=>(sum+c.charCodeAt(0))%3,0),...(state.selectedCardIndex!==undefined?{selectedIndex:state.selectedCardIndex}:{})};
  if(config.gameType==='mystery-cards') {
   plan.slots=(state.dealtSegmentIds ?? Array.from({length:typeof s.visibleCards==='number'?s.visibleCards:3},(_,i)=>`undealt-${i}`)).map((segmentId,index)=>({id:`slot-${index}`,index,selected:index===state.selectedCardIndex,used:state.usedActivityIds.includes(s.segments.find(s=>s.id===segmentId)?.activityId ?? '')}));
   if(state.shuffle)plan.shuffle=state.shuffle;
   plan.segments=plan.segments.map(segment=>({...segment,label:segment.kind==='question'?'Question':'Event'}));
  }
  if(config.gameType==='magic-hat')plan.segments=plan.segments.map(segment=>({...segment,label:segment.kind==='question'?'Question':'Event'}));
  if(state.effect && !blocked) plan.effect=state.effect;
  const activity = config.activities.find(a => a.id === state.currentActivityId);
  if (activity && ['revealed', 'active', 'activity-complete'].includes(state.phase) && !blocked) {
    plan.activity = { id: activity.id, kind: activity.kind, label: config.gameType!=='spinning-wheel' && state.phase!=='active' ? activity.kind==='question'?'Question':'Event' : activityLabel(activity) };
    if (state.phase === 'active') {
      if (activity.kind === 'event') {
        if (typeof activity.config?.studentText === 'string') plan.activity.studentText = activity.config.studentText;
      } else {
        if(typeof activity.config?.prompt==='string' && activity.config.prompt.trim())plan.activity.prompt=activity.config.prompt;
        const asset=project.assets.find(a=>a.id===activity.config?.mediaAssetId),src=asset && source(asset.id);
        if(asset && src && ['image','video','audio'].includes(asset.mediaType))plan.activity.media={kind:asset.mediaType as 'image'|'video'|'audio',src,label:mediaDisplayTitle(asset).slice(0,200)};
        if(plan.activity.media && state.questionPlayback && ['video','audio'].includes(plan.activity.media.kind))plan.activity.media.playback=state.questionPlayback;
        const definition = activity.contentRef ? project.cards[activity.contentRef] : undefined;
        if (definition?.faces[0]) plan.activity.card = buildCardV2FacePlan(definition, (definition.faces.find(face=>face.id===state.questionFaceId) ?? definition.faces[0]).id, { x: 0, y: 0, ...WHEEL_CARD_FRAME }, source);
      }
    }
  }
  return plan;
}
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const id = (v: unknown): v is string => text(v) && !!v;
const integer = (v: unknown, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
/** Public whitelist: no config, teacher notes, pool Card faces or runtime fingerprint. */
export function parseWheelPresentation(value: unknown): WheelPresentation | null {
  if (!record(value) || value.version !== 1 || !text(value.title) || !['ready', 'selecting', 'revealed', 'active', 'activity-complete', 'session-complete'].includes(value.phase)
    || !integer(value.revision, Number.MAX_SAFE_INTEGER) || !integer(value.playCount, 1000) || value.playCount < 1
    || !integer(value.consumed, value.playCount) || !integer(value.skipped, value.consumed) || typeof value.blocked !== 'boolean'
    || !Array.isArray(value.segments) || value.segments.length > 1000) return null;
  const segments: PublicWheelSegment[] = [], ids = new Set<string>();
  for (const segment of value.segments) {
    if (!record(segment) || !id(segment.id) || ids.has(segment.id) || !id(segment.activityId) || !text(segment.label) || !['question', 'event'].includes(segment.kind)) return null;
    ids.add(segment.id); segments.push({ id: segment.id, activityId: segment.activityId, label: segment.label, kind: segment.kind });
  }
  if (value.selectedSegmentId !== null && (!id(value.selectedSegmentId) || !ids.has(value.selectedSegmentId))) return null;
  const plan: WheelPresentation = { version: 1, title: value.title, phase: value.phase, revision: value.revision, playCount: value.playCount, consumed: value.consumed, skipped: value.skipped, blocked: value.blocked, selectedSegmentId: value.selectedSegmentId, segments };
  if(value.gameType!==undefined){if(!['spinning-wheel','magic-hat','mystery-cards'].includes(value.gameType))return null;plan.gameType=value.gameType;}
  if(value.reveal!==undefined){const r=value.reveal;if(!record(r)||!text(r.id,1000)||!r.id||!integer(r.startedAt,Number.MAX_SAFE_INTEGER)||!integer(r.durationMs,15000)||r.durationMs<100||!integer(r.variant,2)||r.selectedIndex!==undefined&&!integer(r.selectedIndex,4))return null;plan.reveal={id:r.id,startedAt:r.startedAt,durationMs:r.durationMs,variant:r.variant,...(r.selectedIndex!==undefined?{selectedIndex:r.selectedIndex}:{})};}
  if(value.shuffle!==undefined){const r=value.shuffle;if(!record(r)||!text(r.id,1000)||!r.id||!integer(r.startedAt,Number.MAX_SAFE_INTEGER)||!integer(r.durationMs,30000)||r.durationMs<1)return null;plan.shuffle={id:r.id,startedAt:r.startedAt,durationMs:r.durationMs};}
  if(value.slots!==undefined){if(!Array.isArray(value.slots)||value.slots.length>5)return null;plan.slots=[];for(const r of value.slots){if(!record(r)||!id(r.id)||!integer(r.index,4)||r.index!==plan.slots.length||typeof r.selected!=='boolean'||typeof r.used!=='boolean')return null;if(plan.slots.some(s=>s.id===r.id))return null;plan.slots.push({id:r.id,index:r.index,selected:r.selected,used:r.used});}if(plan.slots.filter(s=>s.selected).length>1 || plan.reveal?.selectedIndex!==undefined && (!plan.slots[plan.reveal.selectedIndex]?.selected))return null;}
  if (value.rotationDegrees !== undefined) {
    if (!Number.isFinite(value.rotationDegrees) || value.rotationDegrees < 0 || value.rotationDegrees > 1e9) return null;
    plan.rotationDegrees = value.rotationDegrees;
  }
  if (value.spin !== undefined) {
    const spin = parseWheelSpin(value.spin);
    if (!spin || spin.segmentId !== value.selectedSegmentId || !['revealed','active'].includes(value.phase) || value.rotationDegrees !== spin.toDegrees) return null;
    plan.spin = spin;
    if(plan.reveal && (plan.reveal.id!==spin.id || plan.reveal.startedAt!==spin.startedAt || plan.reveal.durationMs!==spin.durationMs))return null;
  }
  if(value.effect!==undefined) { const cue=parseGameEffect(value.effect); if(!cue || value.blocked) return null;plan.effect=cue; }
  if(value.rewardIndicator!==undefined) { const r=value.rewardIndicator; if(!record(r) || !text(r.name) || !integer(r.total,Number.MAX_SAFE_INTEGER))return null;plan.rewardIndicator={name:r.name,total:r.total}; }
  if (value.activity !== undefined) {
    const a = value.activity, segment = segments.find(s => s.id === value.selectedSegmentId);
    if (!record(a) || !segment || !id(a.id) || a.id !== segment.activityId || a.kind !== segment.kind || !text(a.label)
      || !['revealed', 'active', 'activity-complete'].includes(value.phase) || value.blocked) return null;
    plan.activity = { id: a.id, kind: a.kind, label: a.label };
    if (a.studentText !== undefined) {
      if (value.phase !== 'active' || a.kind !== 'event' || !text(a.studentText, 2000)) return null;
      plan.activity.studentText = a.studentText;
    }
    if(a.prompt!==undefined) {if(value.phase!=='active' || a.kind!=='question' || !text(a.prompt,2000))return null;plan.activity.prompt=a.prompt;}
    if(a.media!==undefined) {const m=a.media;if(value.phase!=='active' || a.kind!=='question' || !record(m) || !['image','video','audio'].includes(m.kind) || !text(m.label) || typeof m.src!=='string' || m.src.length>10000 || !/^media:\/\/[^\s<>]+$/i.test(m.src))return null;plan.activity.media={kind:m.kind,src:m.src,label:m.label};if(m.playback!==undefined){const playback=parseQuestionPlayback(m.playback);if(!playback || m.kind==='image')return null;plan.activity.media.playback=playback;}}
    if (a.card !== undefined) {
      if (value.phase !== 'active' || a.kind !== 'question') return null;
      const parsed = parseCardV2RenderPlan({ engine: 'card-v2', version: 1, frame: WHEEL_CARD_FRAME, cards: [a.card] });
      if (!parsed || parsed.cards.length !== 1) return null;
      plan.activity.card = parsed.cards[0];
    }
  }
  return plan;
}
