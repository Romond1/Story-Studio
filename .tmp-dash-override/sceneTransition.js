"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneTransitionCore = void 0;
exports.transitionTiming = transitionTiming;
function transitionTiming(event, now) {
    const elapsedMs = Math.max(0, now - event.startedAt);
    const duration = event.durationMs * (event.kind === 'fade-black' ? 1.2 : 1);
    return { elapsedMs, remainingMs: Math.max(0, duration - elapsedMs), settled: elapsedMs >= duration };
}
/** One Control-Core observer owns timing. Renderers consume immutable visual facts only. */
class SceneTransitionCore {
    targetKey = null;
    previous = null;
    event = null;
    observe(targetKey, target, settings, now, id) {
        if (targetKey !== this.targetKey) {
            const previous = this.previous;
            const changed = !previous || previous.kind !== target.kind || previous.occurrenceId !== target.occurrenceId;
            if (changed)
                this.event = null;
            if (changed && previous?.kind === 'image' && (target.kind === 'image' || target.kind === 'video') && settings.kind !== 'none' && settings.durationMs > 0) {
                const scene = previous.scene ? { ...previous.scene, markerStrokes: undefined, transient: undefined } : undefined;
                const from = JSON.parse(JSON.stringify({ occurrenceId: previous.occurrenceId, src: previous.src, ...(scene ? { scene } : {}) }));
                this.event = { ...settings, id, startedAt: now, fromOccurrenceId: from.occurrenceId, toOccurrenceId: target.occurrenceId, from };
            }
            this.targetKey = targetKey;
        }
        this.previous = target;
        return this.event;
    }
    complete(id) {
        if (this.event?.id !== id)
            return false;
        this.event = null;
        return true;
    }
}
exports.SceneTransitionCore = SceneTransitionCore;
