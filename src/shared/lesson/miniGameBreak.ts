import { createGameConfig, createWheelConfig, readWheelSettings, remapMiniGame } from './spinningWheel';
/** Authored configuration only. Card references are definition IDs, never copied question text. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface MiniGameActivity { id: string; kind: 'question' | 'event'; contentRef?: string; config?: Record<string, JsonValue> }
export interface MiniGameConfig { mode: 'minigame'; gameType: string; configVersion: number; settings: Record<string, JsonValue>; activities: MiniGameActivity[] }
export type BreakExperience = ({ mode: 'classic' } | MiniGameConfig) & { savedMiniGames?: MiniGameConfig[] };
export interface MiniGameDefinition {
  id: string; name: string; description: string; configVersion: number;
  defaultSettings: Readonly<Record<string, JsonValue>>;
  validate: (config: MiniGameConfig) => boolean;
  /** Renderer-owned component slots; unimplemented games keep placeholders. */
  surfaces: { editor: 'placeholder' | 'spinning-wheel'; present: 'placeholder' | 'spinning-wheel'; teacher: 'placeholder' | 'spinning-wheel' };
  runtimeAdapter: 'selection-v1' | 'selection-v2';
}
const definitions: MiniGameDefinition[] = [
  { id: 'spinning-wheel', name: 'Spinning Wheel', description: 'Select activities with a wheel.' },
  { id: 'magic-hat', name: 'Magic Hat', description: 'Reveal activities from a hat.' },
  { id: 'mystery-cards', name: 'Mystery Cards', description: 'Reveal activities behind cards.' },
].map(item => ({ ...item, configVersion: 2, defaultSettings: Object.freeze(createGameConfig(item.id).settings),
  validate: config => config.configVersion === 2 ? !!readWheelSettings(config) : config.configVersion === 1 && Object.keys(config.settings).every(key => key === 'sequence') &&
    (config.settings.sequence === undefined || Array.isArray(config.settings.sequence) &&
      new Set(config.settings.sequence).size === config.settings.sequence.length &&
      config.settings.sequence.every(id => typeof id === 'string' && config.activities.some(a => a.id === id))),
  surfaces: { editor: 'spinning-wheel', present: 'spinning-wheel', teacher: 'spinning-wheel' }, runtimeAdapter: 'selection-v2' }));
export const miniGameRegistry: ReadonlyMap<string, MiniGameDefinition> = new Map(definitions.map(item => [item.id, item]));
export function defaultExperience(gameType: string): MiniGameConfig {
  const game = miniGameRegistry.get(gameType);
  return { mode: 'minigame', gameType, configVersion: game?.configVersion ?? 1,
    settings: JSON.parse(JSON.stringify(game?.defaultSettings ?? {})), activities: [] };
}
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
/** Bounded JSON keeps invalid/future configurations portable without executing them. */
export function isSafeBreakExperience(value: unknown): boolean {
  let budget = 20000;
  function json(v: unknown, depth: number): boolean {
    if (--budget < 0 || depth > 12) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v === 'string') return v.length <= 20000;
    if (Array.isArray(v)) return v.length <= 2000 && v.every(item => json(item, depth + 1));
    return record(v) && Object.keys(v).length <= 2000 && Object.entries(v).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && json(item, depth + 1));
  }
  return record(value) && json(value, 0);
}
export function isMiniGameConfig(value: unknown): value is MiniGameConfig {
  if (!isSafeBreakExperience(value) || !record(value) || value.mode !== 'minigame' || !id(value.gameType)
    || !Number.isInteger(value.configVersion) || value.configVersion < 1 || !record(value.settings)
    || !Array.isArray(value.activities) || value.activities.length > 1000) return false;
  const ids = new Set<string>();
  return value.activities.every((a: unknown) => {
    if (!record(a) || !id(a.id) || ids.has(a.id) || !['question', 'event'].includes(a.kind)
      || (a.contentRef !== undefined && !id(a.contentRef)) || (a.config !== undefined && !record(a.config))) return false;
    ids.add(a.id); return true;
  });
}
export type BreakResolution = { status: 'classic' } | { status: 'unavailable' } | { status: 'planned'; config: MiniGameConfig; game: MiniGameDefinition };
export function resolveBreakExperience(value: unknown, hasContent?: (id: string) => boolean): BreakResolution {
  if (value === undefined || (record(value) && value.mode === 'classic')) return { status: 'classic' };
  if (!isMiniGameConfig(value)) return { status: 'unavailable' };
  const game = miniGameRegistry.get(value.gameType);
  if (!game || !game.validate(value)
    || value.configVersion===1 && value.activities.some(a => a.contentRef && hasContent && !hasContent(a.contentRef))) return { status: 'unavailable' };
  return { status: 'planned', config: value, game };
}

function authoredConfig(config: MiniGameConfig): MiniGameConfig {
  const { savedMiniGames: _saved, ...authored } = config as MiniGameConfig & { savedMiniGames?: MiniGameConfig[] };
  return JSON.parse(JSON.stringify(authored));
}
export function savedBreakGames(experience?: BreakExperience): MiniGameConfig[] {
  return Array.isArray(experience?.savedMiniGames) ? experience.savedMiniGames.filter(config => record(config) && config.mode === 'minigame' && isSafeBreakExperience(config)) : [];
}
export function setBreakMode(experience: BreakExperience | undefined, mode: 'classic' | 'minigame'): BreakExperience {
  if (experience?.mode === mode) return experience;
  const saved = savedBreakGames(experience);
  if (mode === 'classic') return { mode, ...(experience?.mode === 'minigame' ? { savedMiniGames: [authoredConfig(experience), ...saved.filter(c => c.gameType !== experience.gameType)] } : saved.length ? { savedMiniGames: saved } : {}) };
  const active = saved[0] ?? defaultExperience('spinning-wheel');
  return { ...authoredConfig(active), ...(saved.length > 1 ? { savedMiniGames: saved.slice(1) } : {}) };
}
export function selectBreakGame(experience: BreakExperience | undefined, gameType: string): BreakExperience {
  if (experience?.mode === 'minigame' && experience.gameType === gameType) return experience;
  const saved = savedBreakGames(experience), active = saved.find(c => c.gameType === gameType) ?? (experience?.mode==='minigame' && readWheelSettings(experience) && miniGameRegistry.has(gameType) ? createGameConfig(gameType,experience) : defaultExperience(gameType));
  const others = [...(experience?.mode === 'minigame' ? [authoredConfig(experience)] : []), ...saved.filter(c => c.gameType !== gameType)];
  return { ...authoredConfig(active), ...(others.length ? { savedMiniGames: others } : {}) };
}
export function copyBreakExperience(experience: BreakExperience | undefined, cards: ReadonlyMap<string, string>): BreakExperience | undefined {
  if (!experience) return undefined;
  const copied = JSON.parse(JSON.stringify(experience));
  const active = isMiniGameConfig(copied) ? remapMiniGame(copied, cards) : copied;
  if (Array.isArray(copied.savedMiniGames)) active.savedMiniGames = copied.savedMiniGames.map((config: unknown) => isMiniGameConfig(config) ? remapMiniGame(config, cards) : config);
  return active;
}
export interface MiniGamePlaceholder {
  status: 'planned' | 'unavailable'; gameType?: string; phase?: 'ready' | 'running' | 'ended';
  currentActivityId?: string | null; usedActivityIds?: string[];
}
export function parseMiniGamePlaceholder(value: unknown): MiniGamePlaceholder | null {
  if (!record(value) || !['planned', 'unavailable'].includes(value.status)
    || (value.gameType !== undefined && !id(value.gameType))
    || (value.phase !== undefined && !['ready', 'running', 'ended'].includes(value.phase))
    || (value.currentActivityId !== undefined && value.currentActivityId !== null && !id(value.currentActivityId))
    || (value.usedActivityIds !== undefined && (!Array.isArray(value.usedActivityIds) || value.usedActivityIds.length > 1000 || !value.usedActivityIds.every(id) || new Set(value.usedActivityIds).size !== value.usedActivityIds.length))) return null;
  return { status: value.status, ...(value.gameType !== undefined ? { gameType: value.gameType } : {}), ...(value.phase !== undefined ? { phase: value.phase } : {}),
    ...(value.currentActivityId !== undefined ? { currentActivityId: value.currentActivityId } : {}), ...(value.usedActivityIds !== undefined ? { usedActivityIds: [...value.usedActivityIds] } : {}) };
}
