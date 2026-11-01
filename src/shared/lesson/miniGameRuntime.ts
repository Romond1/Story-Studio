import { initializeWheel, restoreWheel, transitionWheel, type WheelRuntimeState, type WheelAction } from './wheelRuntime';
import { resolveBreakExperience, type MiniGameConfig, type JsonValue } from './miniGameBreak';
interface LegacyMiniGameRuntimeState {
  version: 1; configKey: string; phase: 'ready' | 'running' | 'ended';
  usedActivityIds: string[]; currentActivityId: string | null;
}
export type MiniGameRuntimeState = LegacyMiniGameRuntimeState | WheelRuntimeState;
export type MiniGameAction = WheelAction | { type: 'begin' | 'complete' | 'end' | 'reset' } | { type: 'reveal'; activityId: string };
/** Inert extension points. Consumers must explicitly handle these in a future phase. */
export type MiniGameIntent = { type: 'activity-result'; activityId: string; kind: 'question' | 'event' }
  | { type: 'reward' | 'effect'; operation: string; payload: Record<string, JsonValue> };
export interface MiniGameRuntimeAdapter {
  initialize(config: MiniGameConfig): MiniGameRuntimeState | undefined;
  transition(config: MiniGameConfig, state: MiniGameRuntimeState, action: MiniGameAction): { state: MiniGameRuntimeState; intents: MiniGameIntent[] };
}
// Configuration fingerprint invalidates stale occurrence state after authoring changes.
export function initializeMiniGame(config: MiniGameConfig): MiniGameRuntimeState | undefined {
  if (config.configVersion === 2) return initializeWheel(config);
  if (config.configVersion !== 1 || resolveBreakExperience(config).status !== 'planned') return undefined;
  return { version: 1, configKey: JSON.stringify(config), phase: 'ready', usedActivityIds: [], currentActivityId: null };
}
export function restoreMiniGame(config: MiniGameConfig, value: unknown): MiniGameRuntimeState | undefined {
  if (config.configVersion === 2) return restoreWheel(config, value);
  const initial = initializeMiniGame(config), v = value as LegacyMiniGameRuntimeState | undefined;
  if (!initial || initial.version !== 1 || !v || v.version !== 1 || v.configKey !== initial.configKey || !['ready', 'running', 'ended'].includes(v.phase)
    || !Array.isArray(v.usedActivityIds) || new Set(v.usedActivityIds).size !== v.usedActivityIds.length
    || !v.usedActivityIds.every(id => config.activities.some(a => a.id === id))
    || (v.currentActivityId !== null && (!config.activities.some(a => a.id === v.currentActivityId) || v.usedActivityIds.includes(v.currentActivityId)))
    || (v.phase !== 'running' && v.currentActivityId !== null)) return initial;
  return { ...initial, phase: v.phase, usedActivityIds: [...v.usedActivityIds], currentActivityId: v.currentActivityId };
}
/** Outcome selection happens only in Teach. Present consumes the resulting snapshot. */
export function transitionMiniGame(config: MiniGameConfig, state: MiniGameRuntimeState, action: MiniGameAction): { state: MiniGameRuntimeState; intents: MiniGameIntent[] } {
  if (config.configVersion === 2) {
    if (state.version !== 2 || !('expectedRevision' in action)) return { state, intents: [] };
    const next = transitionWheel(config, state, action);
    const activity = config.activities.find(a => a.id === state.currentActivityId);
    return { state: next, intents: next.revision !== state.revision && action.type === 'complete' && activity ? [{ type: 'activity-result', activityId: activity.id, kind: activity.kind }] : [] };
  }
  const restored = restoreMiniGame(config, state);
  if (!restored || restored.version !== 1) return { state, intents: [] };
  state = restored;
  const result = (next: MiniGameRuntimeState = state, intents: MiniGameIntent[] = []) => ({ state: next, intents });
  if (action.type === 'reset') return result(initializeMiniGame(config)!);
  if (action.type === 'begin') return result(state.phase === 'ready' ? { ...state, phase: 'running' } : state);
  if (action.type === 'end') return result({ ...state, phase: 'ended', currentActivityId: null });
  if (state.phase !== 'running') return result();
  if (action.type === 'reveal') {
    if (state.currentActivityId || state.usedActivityIds.includes(action.activityId) || !config.activities.some(a => a.id === action.activityId)) return result();
    const sequence = config.settings.sequence;
    if (Array.isArray(sequence) && sequence[state.usedActivityIds.length] !== action.activityId) return result();
    return result({ ...state, currentActivityId: action.activityId });
  }
  if (action.type === 'complete' && state.currentActivityId) {
    const activity = config.activities.find(a => a.id === state.currentActivityId)!;
    return result({ ...state, usedActivityIds: [...state.usedActivityIds, activity.id], currentActivityId: null }, [{ type: 'activity-result', activityId: activity.id, kind: activity.kind }]);
  }
  return result();
}
export const selectionRuntimeAdapter: MiniGameRuntimeAdapter = { initialize: initializeMiniGame, transition: transitionMiniGame };
