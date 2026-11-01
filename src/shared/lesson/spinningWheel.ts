import type { JsonValue, MiniGameConfig, MiniGameActivity } from './miniGameBreak';

export interface WheelSegment extends Record<string, JsonValue> { id: string; activityId: string; label: string }
export interface WheelSettings extends Record<string, JsonValue> {
  title: string; playCount: number; questionCount: number;
  sequenceMode: 'alternating' | 'randomized' | 'teacher-selected'; segments: WheelSegment[];
}
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const identity = (v: unknown): v is string => text(v, 200) && !!v;
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
export function readWheelSettings(config: MiniGameConfig): WheelSettings | undefined {
  const s = config.settings;
  if (!['spinning-wheel','magic-hat','mystery-cards'].includes(config.gameType) || config.configVersion !== 2 || !s || !Array.isArray(config.activities)
    || config.activities.some(a => !a || typeof a !== 'object' || !identity(a.id) || !['question', 'event'].includes(a.kind)) || !text(s.title, 200)
    || !integer(s.playCount, 1, 1000) || !integer(s.questionCount, 0, s.playCount)
    || !['alternating', 'randomized', 'teacher-selected'].includes(String(s.sequenceMode)) || !Array.isArray(s.segments) || s.segments.length > 1000
    || Object.keys(s).some(key => !['title', 'playCount', 'questionCount', 'sequenceMode', 'segments', 'sequence', 'autoSession', 'visibleCards', 'revealStyle', 'shuffleBehavior'].includes(key))) return undefined;
  if (s.autoSession !== undefined && typeof s.autoSession !== 'boolean' || s.visibleCards !== undefined && !integer(s.visibleCards,3,5) || s.revealStyle !== undefined && !['varied','bounce','starlight','portal'].includes(String(s.revealStyle)) || s.shuffleBehavior !== undefined && !['each-turn','manual'].includes(String(s.shuffleBehavior))) return undefined;
  const ids = new Set<string>();
  for (const segment of s.segments) {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment) || !identity(segment.id) || ids.has(segment.id)
      || !identity(segment.activityId) || !config.activities.some(a => a.id === segment.activityId) || !text(segment.label, 200)
      || Object.keys(segment).some(key => !['id', 'activityId', 'label'].includes(key))) return undefined;
    ids.add(segment.id);
  }
  if (s.sequence !== undefined && (!Array.isArray(s.sequence) || s.sequence.some(id => typeof id !== 'string' || !config.activities.some(a => a.id === id)))) return undefined;
  if (config.activities.some(a => a.config?.label !== undefined && !text(a.config.label, 200) || a.config?.instructions !== undefined && !text(a.config.instructions, 2000) || a.config?.studentText !== undefined && !text(a.config.studentText, 2000) || a.config?.prompt !== undefined && !text(a.config.prompt,2000) || a.config?.mediaAssetId !== undefined && !identity(a.config.mediaAssetId))) return undefined;
  return s as WheelSettings;
}
/** Explicit authoring upgrade; loading old lessons never rewrites them. */
export function createWheelConfig(source?: MiniGameConfig): MiniGameConfig {
  if (source && readWheelSettings(source)) return JSON.parse(JSON.stringify(source));
  const activities: MiniGameActivity[] = JSON.parse(JSON.stringify(source?.activities ?? []));
  return { mode: 'minigame', gameType: 'spinning-wheel', configVersion: 2, activities,
    settings: { title: 'Spinning Wheel', playCount: 6, questionCount: 3, sequenceMode: 'alternating',
      segments: activities.map(a => ({ id: globalThis.crypto.randomUUID(), activityId: a.id, label: '' })),
      ...(source?.settings.sequence ? { sequence: source.settings.sequence } : {}) } };
}
export function createGameConfig(gameType: string, source?: MiniGameConfig): MiniGameConfig {
 const base=createWheelConfig(source), title=gameType==='magic-hat'?'Magic Hat':gameType==='mystery-cards'?'Mystery Cards':'Spinning Wheel';
 return {...base,gameType,settings:{...base.settings,title:source && source.gameType===gameType ? base.settings.title : title,...(!source?{autoSession:true,sequenceMode:'randomized'}:{}),...(gameType==='magic-hat'?{revealStyle:source?.settings.revealStyle ?? 'varied'}:{}),...(gameType==='mystery-cards'?{visibleCards:source?.settings.visibleCards ?? 3,shuffleBehavior:source?.settings.shuffleBehavior ?? 'each-turn'}:{})}};
}
export function addWheelActivity(config: MiniGameConfig, kind: MiniGameActivity['kind'], contentRef?: string): MiniGameConfig {
  const settings = readWheelSettings(config);
  if (!settings || config.activities.length >= 1000 || settings.segments.length >= 1000) return config;
  const activity = { id: globalThis.crypto.randomUUID(), kind, ...(contentRef ? { contentRef } : {}), config: { label: '', ...(kind === 'event' ? { instructions: '' } : {}) } };
  return { ...config, activities: [...config.activities, activity], settings: { ...settings, segments: [...settings.segments, { id: globalThis.crypto.randomUUID(), activityId: activity.id, label: '' }] } };
}
export function removeWheelActivity(config: MiniGameConfig, activityId: string): MiniGameConfig {
  const settings = readWheelSettings(config); if (!settings) return config;
  return { ...config, activities: config.activities.filter(a => a.id !== activityId), settings: { ...settings,
    segments: settings.segments.filter(s => s.activityId !== activityId),
    ...(Array.isArray(settings.sequence) ? { sequence: settings.sequence.filter(id => id !== activityId) } : {}) } };
}
export function activityLabel(activity: MiniGameActivity, cardLabel?: string): string {
  return typeof activity.config?.label === 'string' && activity.config.label.trim() ? activity.config.label : cardLabel || (activity.kind === 'question' ? 'Question' : 'Event');
}
/** Draft warnings are not schema errors: incomplete work can be saved and repaired. */
export function wheelIssues(config: MiniGameConfig, hasCard: (id: string) => boolean, hasMedia?: (id:string)=>boolean): string[] {
  const s = readWheelSettings(config); if (!s) return ['This wheel cannot be edited here. Your saved content has been kept.'];
  const issues: string[] = [], assigned = new Set(s.segments.map(segment => segment.activityId));
  const available = config.activities.filter(a => assigned.has(a.id));
  const questions = available.filter(a => a.kind === 'question').length, events = available.length - questions;
  if (questions < s.questionCount) issues.push(`Add ${s.questionCount - questions} more question outcome${s.questionCount - questions === 1 ? '' : 's'} to the wheel for this Break.`);
  const neededEvents = s.playCount - s.questionCount;
  if (events < neededEvents) issues.push(`Add ${neededEvents - events} more event outcome${neededEvents - events === 1 ? '' : 's'} to the wheel for this Break.`);
  if(config.activities.some(a=>a.kind==='question' && !questionHasContent(a,hasCard,hasMedia))) issues.push('Add a Card, question text, picture, video or audio to each question.');
  if (config.activities.some(a => !assigned.has(a.id))) issues.push('Some pool activities have no wheel segment. Assign them below to include them.');
  if (s.sequenceMode === 'alternating' && !(s.questionCount === neededEvents || s.questionCount === neededEvents + 1)) issues.push('Alternating starts with a question: use equal counts or one extra question.');
  return issues;
}
/** Copy local identities once; external Card definitions stay shared unless copied by the scene command. */
export function remapMiniGame(config: MiniGameConfig, cards: ReadonlyMap<string, string>): MiniGameConfig {
  const next: MiniGameConfig = JSON.parse(JSON.stringify(config));
  const legacy = config.configVersion === 1 && ['spinning-wheel', 'magic-hat', 'mystery-cards'].includes(config.gameType) && Object.keys(config.settings).every(key => key === 'sequence');
  if (!legacy && !readWheelSettings(config)) return next;
  const ids = new Map(next.activities.map(a => [a.id, globalThis.crypto.randomUUID()]));
  next.activities = next.activities.map(a => ({ ...a, id: ids.get(a.id)!, ...(a.contentRef && cards.has(a.contentRef) ? { contentRef: cards.get(a.contentRef)! } : {}) }));
  if (Array.isArray(next.settings.sequence)) next.settings.sequence = next.settings.sequence.map(id => typeof id === 'string' ? ids.get(id) ?? id : id);
  if (Array.isArray(next.settings.segments)) next.settings.segments = next.settings.segments.map(segment =>
    segment && typeof segment === 'object' && !Array.isArray(segment) ? { ...segment, id: globalThis.crypto.randomUUID(), activityId: typeof segment.activityId === 'string' ? ids.get(segment.activityId) ?? segment.activityId : segment.activityId } : segment);
  return next;
}

/** Card definitions and media assets retain their existing owners; a question can combine them. */
export function questionHasContent(activity:MiniGameActivity,hasCard?:(id:string)=>boolean,hasMedia?:(id:string)=>boolean):boolean {
 const media=activity.config?.mediaAssetId;
 if(activity.contentRef && hasCard && !hasCard(activity.contentRef) || typeof media==='string' && hasMedia && !hasMedia(media))return false;
 return typeof activity.config?.label==='string' && !!activity.config.label.trim() || !!activity.contentRef || typeof activity.config?.prompt==='string' && !!activity.config.prompt.trim() || typeof media==='string' && !!media;
}

/** Practice upgrades legacy drafts in a shallow sandbox, never in the authored document. */
export function prepareWheelPractice(project:import('./model').LessonProject,location:import('./model').LessonLocation):import('./model').LessonProject {
 const entry=project.sequences[location.sequence].find(e=>e.id===location.entryId),scene=entry&&project.scenes[entry.sceneId],config=scene?.breakExperience;
 if(!scene || config?.mode!=='minigame' || !['spinning-wheel','magic-hat','mystery-cards'].includes(config.gameType) || config.configVersion!==1)return project;
 return {...project,scenes:{...project.scenes,[scene.id]:{...scene,breakExperience:createGameConfig(config.gameType,config)}}};
}
