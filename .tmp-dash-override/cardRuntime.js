"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardRuntime = exports.emptyCardState = void 0;
exports.timerSeconds = timerSeconds;
const emptyCardState = () => ({ isFlipped: false, isBlurred: false, isCovered: false, isZoomed: false });
exports.emptyCardState = emptyCardState;
function timerSeconds(anchor, now, mode, duration = 300) {
    const elapsed = Math.max(0, Math.floor((anchor.accumulated + (anchor.isRunning ? now - anchor.startTime : 0)) / 1000));
    return mode === 'countdown' ? Math.max(0, duration - elapsed) : elapsed;
}
/** Owned by the Control Core, never mounted in Present or persisted as authored content. */
class CardRuntime {
    active = '';
    commandTarget = '';
    authored = new Map();
    occurrences = new Map();
    activate(target, commandTarget = target) { this.active = target; this.commandTarget = commandTarget; }
    key(ref) { return JSON.stringify([this.active, ref]); }
    ensure(ref, instances, now) {
        const key = this.key(ref);
        let state = this.occurrences.get(key);
        if (!state) {
            state = { instances: instances.map(i => ({ ...i, position: { ...i.position }, size: { ...i.size } })), states: {}, startedAt: now };
            this.occurrences.set(key, state);
        }
        const previous = this.authored.get(key);
        if (previous) {
            state.instances = instances.map(i => previous.get(i.id) === JSON.stringify(i) ? state.instances.find(current => current.id === i.id) ?? i : { ...i, position: { ...i.position }, size: { ...i.size } });
            state.states = Object.fromEntries(Object.entries(state.states).filter(([id]) => instances.some(i => i.id === id)));
        }
        this.authored.set(key, new Map(instances.map(i => [i.id, JSON.stringify(i)])));
        return state;
    }
    get(ref) { return this.occurrences.get(this.key(ref)); }
    move(target, ref, instanceId, updates) {
        const state = this.get(ref);
        if (target !== this.commandTarget || !state || !state.instances.some(i => i.id === instanceId))
            return false;
        if (updates.position && ![updates.position.x, updates.position.y].every(Number.isFinite))
            return false;
        if (updates.size && ![updates.size.width, updates.size.height].every(v => Number.isFinite(v) && v > 0))
            return false;
        state.movement = undefined;
        state.instances = state.instances.map(i => i.id === instanceId ? { ...i, ...(updates.position ? { position: { ...updates.position } } : {}), ...(updates.size ? { size: { ...updates.size } } : {}) } : i);
        return true;
    }
    setState(target, ref, instanceId, next) {
        const state = this.get(ref);
        if (target !== this.commandTarget || !state || !state.instances.some(i => i.id === instanceId))
            return false;
        state.states = { ...state.states, [instanceId]: { ...next } };
        return true;
    }
    shuffle(target, ref, frame, random = Math.random, movement) {
        if (![frame.width, frame.height].every(v => Number.isFinite(v) && v > 0))
            return false;
        const state = this.get(ref);
        if (target !== this.commandTarget || !state)
            return false;
        const placed = [];
        const positions = new Map();
        for (const i of [...state.instances].sort((a, b) => b.size.width * b.size.height - a.size.width * a.size.height)) {
            for (let n = 0; n < 350; n++) {
                const x = random() * Math.max(0, frame.width - i.size.width), y = random() * Math.max(0, frame.height - i.size.height);
                if (placed.some(p => !(x + i.size.width + 8 < p.x || p.x + p.w + 8 < x || y + i.size.height + 8 < p.y || p.y + p.h + 8 < y)))
                    continue;
                placed.push({ x, y, w: i.size.width, h: i.size.height });
                positions.set(i.id, { x: (x + i.size.width / 2) / frame.width * 100, y: (y + i.size.height / 2) / frame.height * 100 });
                break;
            }
        }
        state.instances = state.instances.map(i => ({ ...i, position: positions.get(i.id) ?? i.position }));
        state.movement = movement;
        return true;
    }
}
exports.CardRuntime = CardRuntime;
