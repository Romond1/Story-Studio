import type { BCardInstance, BCardTeachState } from './types';
import type { LogicalFrame } from './staticScene';
export interface TimerAnchor { isRunning: boolean; startTime: number; accumulated: number }
export const emptyCardState = (): BCardTeachState => ({ isFlipped: false, isBlurred: false, isCovered: false, isZoomed: false });
export interface CardMotion { durationMs: number; easing: string; key: number; startedAt: number }
export interface CardOccurrence { movement?: CardMotion; instances: BCardInstance[]; states: Record<string, BCardTeachState>; startedAt: number }
export function timerSeconds(anchor: TimerAnchor, now: number, mode: string | undefined, duration = 300) {
  const elapsed = Math.max(0, Math.floor((anchor.accumulated + (anchor.isRunning ? now - anchor.startTime : 0)) / 1000));
  return mode === 'countdown' ? Math.max(0, duration - elapsed) : elapsed;
}
/** Owned by the Control Core, never mounted in Present or persisted as authored content. */
export class CardRuntime {
  private active = '';
  private commandTarget = '';
  private authored = new Map<string, Map<string, string>>();
  private occurrences = new Map<string, CardOccurrence>();
  activate(target: string, commandTarget = target) { this.active = target; this.commandTarget = commandTarget; }
  private key(ref: string) { return JSON.stringify([this.active, ref]); }
  ensure(ref: string, instances: BCardInstance[], now: number): CardOccurrence {
    const key = this.key(ref); let state = this.occurrences.get(key);
    if (!state) { state = { instances: instances.map(i => ({ ...i, position: { ...i.position }, size: { ...i.size } })), states: {}, startedAt: now }; this.occurrences.set(key, state); }
    const previous = this.authored.get(key);
    if (previous) {
      state.instances = instances.map(i => previous.get(i.id) === JSON.stringify(i) ? state!.instances.find(current => current.id === i.id) ?? i : { ...i, position: { ...i.position }, size: { ...i.size } });
      state.states = Object.fromEntries(Object.entries(state.states).filter(([id]) => instances.some(i => i.id === id)));
    }
    this.authored.set(key, new Map(instances.map(i => [i.id, JSON.stringify(i)])));
    return state;
  }
  get(ref: string) { return this.occurrences.get(this.key(ref)); }
  move(target: string, ref: string, instanceId: string, updates: Partial<BCardInstance>) {
    const state = this.get(ref); if (target !== this.commandTarget || !state || !state.instances.some(i => i.id === instanceId)) return false;
    if (updates.position && ![updates.position.x, updates.position.y].every(Number.isFinite)) return false;
    if (updates.size && ![updates.size.width, updates.size.height].every(v => Number.isFinite(v) && v > 0)) return false;
    state.movement = undefined;
    state.instances = state.instances.map(i => i.id === instanceId ? { ...i, ...(updates.position ? { position: { ...updates.position } } : {}), ...(updates.size ? { size: { ...updates.size } } : {}) } : i); return true;
  }
  setState(target: string, ref: string, instanceId: string, next: BCardTeachState) {
    const state = this.get(ref); if (target !== this.commandTarget || !state || !state.instances.some(i => i.id === instanceId)) return false;
    state.states = { ...state.states, [instanceId]: { ...next } }; return true;
  }
  shuffle(target: string, ref: string, frame: LogicalFrame, random = Math.random, movement?: CardMotion) {
    if (![frame.width, frame.height].every(v => Number.isFinite(v) && v > 0)) return false;
    const state = this.get(ref); if (target !== this.commandTarget || !state) return false;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const positions = new Map<string, { x: number; y: number }>();
    for (const i of [...state.instances].sort((a,b) => b.size.width*b.size.height-a.size.width*a.size.height)) {
      for (let n = 0; n < 350; n++) {
        const x = random() * Math.max(0, frame.width-i.size.width), y = random() * Math.max(0, frame.height-i.size.height);
        if (placed.some(p => !(x+i.size.width+8 < p.x || p.x+p.w+8 < x || y+i.size.height+8 < p.y || p.y+p.h+8 < y))) continue;
        placed.push({ x, y, w: i.size.width, h: i.size.height });
        positions.set(i.id, { x: (x+i.size.width/2)/frame.width*100, y: (y+i.size.height/2)/frame.height*100 }); break;
      }
    }
    state.instances = state.instances.map(i => ({ ...i, position: positions.get(i.id) ?? i.position })); state.movement = movement; return true;
  }
}
