import type { MovementEventConfig } from './types';
import type { LogicalFrame } from './staticScene';
export interface MovementPresentation { id: string; startedAt: number; expiresAt: number; event: MovementEventConfig; frame: LogicalFrame }
const animations = ['color-burst', 'runner', 'hero-flash', 'head-bounce', 'nose-bounce'];
export function createMovementPresentation(id: string, event: MovementEventConfig, startedAt: number, frame: LogicalFrame): MovementPresentation {
 const result = parseMovementPresentation({ id, startedAt, expiresAt: startedAt + Math.min(3600, Math.max(1, Number.isFinite(event.durationSeconds) ? event.durationSeconds : 3)) * 1000, event, frame });
 if (!result) throw new Error('Invalid movement configuration');
 return result;
}
export function movementRemaining(event: MovementPresentation, now: number): number { return Math.max(0, event.expiresAt - now); }
/** Claim before invoking the mixer, including a synchronous reentrant dispatch. */
export class MovementExecutionGuard {
 private scope = ''; private executed = new Set<string>();
 claim(scope: string, id: string): boolean {
  if (scope !== this.scope) { this.scope = scope; this.executed.clear(); }
  if (this.executed.has(id)) return false;
  this.executed.add(id); return true;
 }
}
export function parseMovementPresentation(value: unknown): MovementPresentation | null {
 if (!value || typeof value !== 'object') return null;
 const v = value as Record<string, any>, e = v.event, f = v.frame;
 if (typeof v.id !== 'string' || !v.id || v.id.length > 1024 || !Number.isFinite(v.startedAt) || v.startedAt < 0 || !Number.isFinite(v.expiresAt) || v.expiresAt <= v.startedAt || v.expiresAt - v.startedAt > 3600000 || !e || !f || !Number.isFinite(f.width) || !Number.isFinite(f.height) || f.width <= 0 || f.height <= 0 || f.width > 32768 || f.height > 32768) return null;
 if (typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.instruction !== 'string' || !animations.includes(e.animation)) return null;
 const path = typeof e.gifRelativePath === 'string' ? e.gifRelativePath.replace(/\\/g, '/') : e.gifRelativePath;
 if (path != null && (typeof path !== 'string' || path.length > 32768 || /[:\u0000]/.test(path) || path.startsWith('/') || path.split('/').includes('..'))) return null;
 const event: MovementEventConfig = { id: e.id.slice(0, 1024), name: e.name.slice(0, 4096), instruction: e.instruction.slice(0, 8192), enabled: true, shortcut: '', durationSeconds: (v.expiresAt - v.startedAt) / 1000, animation: e.animation };
 if (path !== undefined) event.gifRelativePath = path;
 for (const [key, min, max] of [['overlayOpacity',0,1],['ringSpeedSeconds',0.25,8],['intensity',0.2,3],['gifScale',0.4,2]] as const) if (e[key] !== undefined) { if (!Number.isFinite(e[key])) return null; event[key] = Math.max(min, Math.min(max, e[key])); }
 for (const key of ['primaryColor','secondaryColor','accentColor'] as const) if (typeof e[key] === 'string') event[key] = e[key].slice(0, 128);
 return { id: v.id, startedAt: v.startedAt, expiresAt: v.expiresAt, frame: { width: f.width, height: f.height }, event };
}

export function expireMovementPresentation(current: MovementPresentation | null, id: string, now: number): MovementPresentation | null {
 return current?.id === id && movementRemaining(current, now) === 0 ? null : current;
}
