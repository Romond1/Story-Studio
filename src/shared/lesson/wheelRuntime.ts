import { parseQuestionPlayback, questionMediaTime, type QuestionPlayback } from './questionPlayback';
import { parseGameEffect, type GameEffectCue, type GameEffectKind } from '../gameEffects';
import { REWARD_VARIANTS } from '../sparkRewards';
import type { SparkAwardVariant } from '../types';
import { createWheelSpin, parseWheelSpin, type WheelSpin } from './wheelAnimation';
import type { GameShuffle } from './gameStage';
import type { MiniGameConfig } from './miniGameBreak';
import { readWheelSettings, questionHasContent, type WheelSegment } from './spinningWheel';

export type WheelPhase = 'ready' | 'selecting' | 'revealed' | 'active' | 'activity-complete' | 'session-complete';
export interface WheelRuntimeState {
  /** Private authoritative deal: never expose this mapping in Present. */
  dealtSegmentIds?: string[]; selectedCardIndex?: number; shuffle?: GameShuffle;
  questionPlayback?: QuestionPlayback;
  turnId?: string; effect?: GameEffectCue; lastEffect?: GameEffectCue;
  outcome?: { decision:'awarded'|'skipped'|'confirmed'; confirmed:boolean };
  spin?: WheelSpin; rotationDegrees?: number; questionFaceId?: string;
  version: 2; configKey: string; revision: number; phase: WheelPhase;
  usedActivityIds: string[]; skippedActivityIds: string[];
  currentActivityId: string | null; selectedSegmentId: string | null;
}
export interface WheelAction {
  type: 'shuffle' | 'start' | 'select' | 'show' | 'complete' | 'next' | 'skip' | 'reset' | 'finish' | 'face' | 'award' | 'skip-reward' | 'confirm-outcome' | 'effect' | 'replay-effect' | 'skip-effect' | 'media-play' | 'media-pause' | 'media-restart';
  expectedRevision: number; configKey: string; sessionId: string; occurrenceId: string; visit: number;
  rewardVariant?: SparkAwardVariant; amount?: number; studentId?: string; effectKind?: GameEffectKind; durationMs?: number; intensity?: number; scale?:number; sound?: boolean;
  cardIndex?: number; segmentId?: string; entropy?: number; spin?: { startedAt: number; durationMs: number }; atMs?: number; faceId?: string;
}
export function initializeWheel(config: MiniGameConfig): WheelRuntimeState | undefined {
  if (!readWheelSettings(config)) return undefined;
  return { version: 2, configKey: JSON.stringify(config), revision: 0, phase: 'ready', usedActivityIds: [], skippedActivityIds: [], currentActivityId: null, selectedSegmentId: null };
}
/** Readiness is evaluated in Control; no private diagnostics enter the public projection. */
export function wheelSessionProblems(config: MiniGameConfig, hasCard?: (id: string) => boolean, hasMedia?: (id:string)=>boolean): string[] {
  const settings = readWheelSettings(config); if (!settings) return ['This wheel configuration is unavailable.'];
  const assigned = new Set(settings.segments.map(s => s.activityId));
  const pool = config.activities.filter(a => assigned.has(a.id));
  const questions = pool.filter(a => a.kind === 'question'), events = pool.filter(a => a.kind === 'event');
  const problems: string[] = [];
  if (questions.length < settings.questionCount || events.length < settings.playCount - settings.questionCount) problems.push('There are not enough question or event outcomes on the wheel for this Break.');
  if (questions.some(a => !questionHasContent(a,hasCard,hasMedia))) problems.push('A question needs content or has a missing Card/media file. Add a Card, text, picture, video or audio in Edit.');
  if (settings.sequenceMode === 'alternating' && ![settings.playCount - settings.questionCount, settings.playCount - settings.questionCount + 1].includes(settings.questionCount)) problems.push('Alternating needs equal counts or one extra question.');
  return problems;
}
export function eligibleWheelSegments(config: MiniGameConfig, state: WheelRuntimeState): WheelSegment[] {
  const s = readWheelSettings(config); if (!s || state.phase !== 'selecting' || state.usedActivityIds.length >= s.playCount) return [];
  const usedQuestions = state.usedActivityIds.filter(id => config.activities.find(a => a.id === id)?.kind === 'question').length;
  const usedEvents = state.usedActivityIds.length - usedQuestions;
  return s.segments.filter(segment => {
    const activity = config.activities.find(a => a.id === segment.activityId);
    if (!activity || state.usedActivityIds.includes(activity.id)) return false;
    if (activity.kind === 'question' ? usedQuestions >= s.questionCount : usedEvents >= s.playCount - s.questionCount) return false;
    return s.sequenceMode !== 'alternating' || activity.kind === (state.usedActivityIds.length % 2 === 0 ? 'question' : 'event');
  });
}
function mysteryVisibleCount(config: MiniGameConfig): number {
  const count = config.settings.visibleCards;
  return typeof count === 'number' && Number.isInteger(count) ? Math.max(3, Math.min(5, count)) : 3;
}
/** Seeded Fisher–Yates: selection never consumes entropy or changes the deal. */
function mysteryDeal(config: MiniGameConfig, state: WheelRuntimeState, entropy?: number): string[] {
  const activities = new Set<string>();
  const pool = eligibleWheelSegments(config, {...state, phase:'selecting'}).filter(segment => {
    if (activities.has(segment.activityId)) return false;
    activities.add(segment.activityId); return true;
  });
  if (entropy === undefined) return pool.slice(0,mysteryVisibleCount(config)).map(segment=>segment.id);
  let seed = Math.floor((Number.isFinite(entropy) ? Math.max(0, Math.min(.999999999, entropy)) : 0) * 4294967296) >>> 0;
  for (let i=pool.length-1; i>0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(seed / 4294967296 * (i+1));
    [pool[i],pool[j]] = [pool[j],pool[i]];
  }
  return pool.slice(0,mysteryVisibleCount(config)).map(segment=>segment.id);
}
export function restoreWheel(config: MiniGameConfig, value: unknown): WheelRuntimeState | undefined {
  const initial = initializeWheel(config), s = readWheelSettings(config), v = value as WheelRuntimeState | undefined;
  if (!initial || !s) return undefined;
  const ids = (value: unknown): value is string[] => Array.isArray(value) && value.length <= s.playCount && new Set(value).size === value.length && value.every(id => typeof id === 'string' && config.activities.some(a => a.id === id) && s.segments.some(segment => segment.activityId === id));
  if (!v || v.version !== 2 || v.configKey !== initial.configKey || !Number.isSafeInteger(v.revision) || v.revision < 0
    || !['ready', 'selecting', 'revealed', 'active', 'activity-complete', 'session-complete'].includes(v.phase)
    || !ids(v.usedActivityIds) || !ids(v.skippedActivityIds) || v.skippedActivityIds.some(id => !v.usedActivityIds.includes(id))) return initial;
  const questions = v.usedActivityIds.filter(id => config.activities.find(a => a.id === id)?.kind === 'question').length;
  if (questions > s.questionCount || v.usedActivityIds.length - questions > s.playCount - s.questionCount
    || s.sequenceMode === 'alternating' && v.usedActivityIds.some((id, i) => config.activities.find(a => a.id === id)?.kind !== (i % 2 ? 'event' : 'question'))
    || v.phase === 'ready' && v.usedActivityIds.length !== 0
    || ['selecting', 'ready'].includes(v.phase) && (v.currentActivityId !== null || v.selectedSegmentId !== null)
    || v.phase === 'selecting' && v.usedActivityIds.length >= s.playCount) return initial;
  if (v.currentActivityId !== null) {
    const segment = s.segments.find(segment => segment.id === v.selectedSegmentId);
    if (!segment || segment.activityId !== v.currentActivityId) return initial;
    const consumed = v.usedActivityIds.includes(v.currentActivityId);
    if (['revealed', 'active'].includes(v.phase) && consumed || ['activity-complete', 'session-complete'].includes(v.phase) && (!consumed || v.usedActivityIds[v.usedActivityIds.length - 1] !== v.currentActivityId)) return initial;
    if (['revealed', 'active'].includes(v.phase) && !eligibleWheelSegments(config, { ...v, phase: 'selecting', currentActivityId: null, selectedSegmentId: null, questionFaceId:undefined }).some(segment => segment.id === v.selectedSegmentId)) return initial;
  } else if (v.selectedSegmentId !== null || ['revealed', 'active', 'activity-complete'].includes(v.phase)) return initial;
  if (v.phase === 'activity-complete' && v.usedActivityIds.length >= s.playCount) return initial;
  const spin = v.spin === undefined ? undefined : parseWheelSpin(v.spin);
  if (spin === null || v.rotationDegrees !== undefined && (!Number.isFinite(v.rotationDegrees) || v.rotationDegrees < 0 || v.rotationDegrees > 1e9)) return initial;
  if (spin) {
    const index = s.segments.findIndex(segment => segment.id === spin.segmentId);
    if (index < 0 || spin.toDegrees !== createWheelSpin(spin.id,spin.segmentId,index,s.segments.length,spin.fromDegrees,spin.startedAt,spin.durationMs).toDegrees
      || v.rotationDegrees !== spin.toDegrees || ['revealed','active'].includes(v.phase) && spin.segmentId !== v.selectedSegmentId) return initial;
  }
  if (v.questionFaceId !== undefined && (typeof v.questionFaceId !== 'string' || !v.questionFaceId || v.questionFaceId.length > 200 || v.phase !== 'active' || config.activities.find(a=>a.id===v.currentActivityId)?.kind !== 'question')) return initial;
  const playback=v.questionPlayback===undefined?undefined:parseQuestionPlayback(v.questionPlayback);
  if(playback===null || playback && v.phase!=='active')return initial;
  const effect=v.effect === undefined ? undefined : parseGameEffect(v.effect), lastEffect=v.lastEffect === undefined ? undefined : parseGameEffect(v.lastEffect);
  if(effect===null || lastEffect===null || v.turnId!==undefined && (typeof v.turnId!=='string' || !v.turnId || v.turnId.length>1000)
   || v.outcome!==undefined && (!v.outcome || !['awarded','skipped','confirmed'].includes(v.outcome.decision) || typeof v.outcome.confirmed!=='boolean')) return initial;
  let deal: Partial<WheelRuntimeState> = {};
  if (config.gameType === 'mystery-cards') {
    if (v.dealtSegmentIds !== undefined) {
      const before = {...v, phase:'selecting' as const, usedActivityIds:v.usedActivityIds.filter(id => id !== v.currentActivityId)};
      const eligible = eligibleWheelSegments(config, before), activities = new Set<string>();
      if (!Array.isArray(v.dealtSegmentIds) || !v.dealtSegmentIds.length || v.dealtSegmentIds.length > mysteryVisibleCount(config)
        || v.dealtSegmentIds.some(id => { const segment=eligible.find(item=>item.id===id); if (!segment || activities.has(segment.activityId)) return true; activities.add(segment.activityId); return false; })) return initial;
      deal.dealtSegmentIds = [...v.dealtSegmentIds];
    } else if (v.phase !== 'ready' && v.phase !== 'session-complete') return initial;
    if (v.selectedCardIndex !== undefined) {
      if (!Number.isInteger(v.selectedCardIndex) || v.selectedCardIndex < 0 || !deal.dealtSegmentIds || deal.dealtSegmentIds[v.selectedCardIndex] !== v.selectedSegmentId) return initial;
      deal.selectedCardIndex = v.selectedCardIndex;
    } else if (v.currentActivityId !== null) return initial;
    if (v.shuffle !== undefined) {
      const sh=v.shuffle;
      if (!sh || typeof sh.id!=='string' || !sh.id || sh.id.length>1000 || !Number.isSafeInteger(sh.startedAt) || sh.startedAt<0 || !Number.isFinite(sh.durationMs) || sh.durationMs<1 || sh.durationMs>30000) return initial;
      deal.shuffle = {...sh};
    }
  }
  return { ...initial, ...deal, ...(playback?{questionPlayback:playback}:{}), ...(v.turnId?{turnId:v.turnId}:{}), ...(effect?{effect}:{}), ...(lastEffect?{lastEffect}:{}), ...(v.outcome?{outcome:{decision:v.outcome.decision,confirmed:v.outcome.confirmed}}:{}), ...(spin ? {spin} : {}), ...(v.rotationDegrees !== undefined ? {rotationDegrees:v.rotationDegrees} : {}), ...(v.questionFaceId ? {questionFaceId:v.questionFaceId} : {}), revision: v.revision, phase: v.phase, usedActivityIds: [...v.usedActivityIds], skippedActivityIds: [...v.skippedActivityIds], currentActivityId: v.currentActivityId, selectedSegmentId: v.selectedSegmentId };
}
/** Pure transition: entropy is supplied once by Teach, never generated here or in Present. */
export function transitionWheel(config: MiniGameConfig, state: WheelRuntimeState, action: WheelAction): WheelRuntimeState {
  const restored = restoreWheel(config, state), s = readWheelSettings(config);
  if (!restored || !s || action.expectedRevision !== restored.revision || action.configKey !== restored.configKey) return state;
  state = restored;
  const update = (patch: Partial<WheelRuntimeState>): WheelRuntimeState => {
    const next = { ...state, ...patch, revision: state.revision + 1 };
    for (const key of ['spin','rotationDegrees','questionFaceId','effect','lastEffect','outcome','turnId','questionPlayback','selectedCardIndex','shuffle','dealtSegmentIds'] as const) if (next[key] === undefined) delete next[key];
    return next;
  };
  if (action.type === 'reset') return { ...initializeWheel(config)!, revision: state.revision + 1 };
  if (action.type === 'start') return state.phase === 'ready' && !wheelSessionProblems(config).length ? update({ phase: 'selecting', ...(config.gameType==='mystery-cards'?{dealtSegmentIds:mysteryDeal(config,state,s.shuffleBehavior==='manual'?undefined:action.entropy ?? 0)}:{}) }) : state;
  if (action.type === 'finish') return !['ready', 'session-complete'].includes(state.phase) ? update({ phase: 'session-complete', dealtSegmentIds:undefined, shuffle:undefined, selectedCardIndex:undefined, currentActivityId: null, selectedSegmentId: null, questionFaceId:undefined,questionPlayback:undefined, effect:undefined }) : state;
  if (action.type === 'shuffle' && config.gameType === 'mystery-cards' && state.phase === 'selecting') {
    const timing=action.spin;
    if (timing && (!Number.isSafeInteger(timing.startedAt) || timing.startedAt<0 || !Number.isFinite(timing.durationMs) || timing.durationMs<1 || timing.durationMs>30000)) return state;
    return update({dealtSegmentIds:mysteryDeal(config,state,action.entropy ?? 0), selectedCardIndex:undefined,
      shuffle:timing?{id:JSON.stringify([action.sessionId,action.occurrenceId,action.visit,state.revision+1,'shuffle']),...timing}:undefined});
  }
  if (action.type === 'select' && state.phase === 'selecting') {
    const eligible = eligibleWheelSegments(config, state);
    let selected: WheelSegment | undefined;
    if (config.gameType === 'mystery-cards') selected = Number.isInteger(action.cardIndex) && action.cardIndex! >= 0 ? eligible.find(segment=>segment.id===state.dealtSegmentIds?.[action.cardIndex!]) : undefined;
    else if (s.sequenceMode === 'teacher-selected') selected = eligible.find(s => s.id === action.segmentId);
    else if (typeof action.entropy === 'number' && Number.isFinite(action.entropy) && action.entropy >= 0 && action.entropy < 1) selected = eligible[Math.floor(action.entropy * eligible.length)];
    if (!selected) return state;
    const spin = action.spin ? createWheelSpin(JSON.stringify([action.sessionId,action.occurrenceId,action.visit,state.revision+1]), selected.id, s.segments.findIndex(segment=>segment.id===selected.id), s.segments.length, state.rotationDegrees ?? 0, action.spin.startedAt, action.spin.durationMs) : undefined;
    if (spin && !parseWheelSpin(spin)) return state;
    return update({ ...(config.gameType==='mystery-cards'?{selectedCardIndex:action.cardIndex}:{}), phase: 'revealed', currentActivityId: selected.activityId, selectedSegmentId: selected.id, questionFaceId:undefined,questionPlayback:undefined, effect:undefined,lastEffect:undefined,outcome:undefined,turnId:JSON.stringify([action.sessionId,action.occurrenceId,action.visit,state.revision+1]), spin, ...(spin ? {rotationDegrees:spin.toDegrees} : {}) });
  }
  if (state.spin && ['show','complete','face'].includes(action.type) && (typeof action.atMs !== 'number' || !Number.isFinite(action.atMs) || action.atMs < state.spin.startedAt + state.spin.durationMs)) return state;
  if (action.type === 'face' && state.phase === 'active' && config.activities.find(a=>a.id===state.currentActivityId)?.kind === 'question' && action.faceId) return update({questionFaceId:action.faceId});
  const makeEffect=(kind:GameEffectKind,caption:string,durationMs=action.durationMs ?? 2800,intensity=1,sound=false) => parseGameEffect({version:1,id:`${state.turnId ?? state.spin?.id ?? state.currentActivityId}:${state.revision+1}:effect`,kind,startedAt:action.atMs,durationMs,intensity:action.intensity ?? intensity,sound:action.sound ?? sound,...(action.scale!==undefined?{scale:action.scale}:{}),caption});
  if (action.type === 'show' && state.phase === 'revealed') {
    const activity=config.activities.find(a=>a.id===state.currentActivityId);
    const style=activity?.config?.surpriseStyle;
    const effect=activity?.kind==='event' ? makeEffect(style==='chest'?'chest':style==='sprite'?'sprite':'portal','A little magic…',3200) : undefined;
    return update({phase:'active',...(effect?{effect,lastEffect:effect}:{})});
  }
  if(['media-play','media-pause','media-restart'].includes(action.type) && state.phase==='active' && typeof action.atMs==='number' && Number.isSafeInteger(action.atMs) && action.atMs>=0) {
    const positionSec=action.type==='media-restart'?0:state.questionPlayback?questionMediaTime(state.questionPlayback,action.atMs):0;
    return update({questionPlayback:{playing:action.type!=='media-pause',positionSec,startedAt:action.atMs}});
  }
  const canReact=!!state.currentActivityId && ['active','activity-complete','session-complete'].includes(state.phase);
  if(canReact && ['award','skip-reward','confirm-outcome'].includes(action.type)) {
    if(action.type==='confirm-outcome') return state.outcome?.confirmed ? state : update({outcome:{decision:state.outcome?.decision ?? 'confirmed',confirmed:true}});
    if(action.type==='skip-reward' && state.outcome) return state;
    if(action.type==='skip-reward') return update({outcome:{decision:'skipped',confirmed:true}});
    if(!action.rewardVariant || !REWARD_VARIANTS.includes(action.rewardVariant) || !Number.isInteger(action.amount) || action.amount!<1 || action.amount!>10) return state;
    const effect=makeEffect(action.rewardVariant==='crown'?'crown':'stars','Brilliant work!');
    return effect ? update({outcome:{decision:'awarded',confirmed:false},effect,lastEffect:effect}) : state;
  }
  if(canReact && action.type==='effect' && action.effectKind) {
    const effect=makeEffect(action.effectKind,action.effectKind==='coins'?'A shower of treasure!':action.effectKind==='stars'?'Brilliant work!':action.effectKind==='sprite'?'Every try grows your magic!':'A little magic…');
    return effect ? update({effect,lastEffect:effect}) : state;
  }
  if(canReact && action.type==='replay-effect' && state.lastEffect) {
    const effect=makeEffect(state.lastEffect.kind,state.lastEffect.caption,state.lastEffect.durationMs,state.lastEffect.intensity,state.lastEffect.sound);
    return effect ? update({effect:{...effect,...(state.lastEffect.scale!==undefined?{scale:state.lastEffect.scale}:{})},lastEffect:{...effect,...(state.lastEffect.scale!==undefined?{scale:state.lastEffect.scale}:{})}}) : state;
  }
  if(action.type==='skip-effect') return state.effect ? update({effect:undefined}) : state;
  if ((action.type === 'complete' && state.phase === 'active' || action.type === 'skip' && ['revealed', 'active'].includes(state.phase)) && state.currentActivityId) {
    const used = [...state.usedActivityIds, state.currentActivityId];
    return update({ phase: used.length >= s.playCount ? 'session-complete' : 'activity-complete', usedActivityIds: used, questionFaceId:undefined,questionPlayback:undefined, ...(action.type==='skip'?{effect:undefined}:{}),
      skippedActivityIds: action.type === 'skip' ? [...state.skippedActivityIds, state.currentActivityId] : state.skippedActivityIds });
  }
  if (action.type === 'next' && state.phase === 'activity-complete') return update({ phase: 'selecting', ...(config.gameType==='mystery-cards'?{dealtSegmentIds:mysteryDeal(config,state,s.shuffleBehavior==='manual'?undefined:action.entropy ?? 0),selectedCardIndex:undefined,shuffle:undefined}:{}), currentActivityId: null, selectedSegmentId: null, questionFaceId:undefined,questionPlayback:undefined,effect:undefined,lastEffect:undefined,outcome:undefined,turnId:undefined });
  return state;
}
