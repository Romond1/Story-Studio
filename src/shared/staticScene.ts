import type { MarkerStroke } from './types';
import type { SceneViewport, TransientStroke } from './teachingScene';
import type { ImageAdjustmentSettings, OverlayItem } from './types';
export interface LogicalFrame { width: number; height: number }
export interface StaticScene { imageHeightFraction?: number; frame: LogicalFrame; adjustments?: ImageAdjustmentSettings; overlays: OverlayItem[]; viewport?: SceneViewport; markerStrokes?: MarkerStroke[]; transient?: TransientStroke[] }
/** Uniform contain transform; authored CSS pixels remain logical units. */
export function fitLogicalFrame(frame: LogicalFrame, host: LogicalFrame) {
  const scale = Math.min(host.width / frame.width, host.height / frame.height);
  return { scale, x: (host.width - frame.width * scale) / 2, y: (host.height - frame.height * scale) / 2 };
}

export class SceneReadiness {
  private loaded = new Set<string>();
  private failed = new Set<string>();
  constructor(private required: string[]) {}
  settle(src: string, error = false): void {
    if (!this.required.includes(src)) return;
    (error ? this.failed : this.loaded).add(src);
  }
  get state(): 'loading' | 'ready' | 'error' {
    if (this.failed.size) return 'error';
    return this.required.every(src => this.loaded.has(src)) ? 'ready' : 'loading';
  }
}
