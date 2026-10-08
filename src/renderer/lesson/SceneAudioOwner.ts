import type { SceneAudio } from '../../shared/lesson/model';

export interface LessonAudioEngine {
  preload(url: string): Promise<void>;
  getDuration(url: string): number;
  playClip(url: string, volume: number, loop: boolean): void;
  stopClip(url: string): void;
}
/** Reuses the mixer; fences asynchronous loads when navigation or Stop wins. */
export class SceneAudioOwner {
  private epoch = 0;
  private urls = new Set<string>();
  constructor(private engine: LessonAudioEngine) {}
  stop() { this.epoch++; for (const url of this.urls) this.engine.stopClip(url); this.urls.clear(); }
  async play(tracks: SceneAudio[], resolve: (id: string) => string | undefined) {
    this.stop(); const epoch = this.epoch;
    await Promise.all(tracks.map(async track => {
      const url = resolve(track.assetId); if (!url || this.urls.has(url)) return;
      this.urls.add(url); await this.engine.preload(url);
      if (this.epoch !== epoch) return;
      // The shared mixer's preload records failures without rejecting. Calling
      // playClip with no decoded buffer would start its own unfenced retry.
      if (!(this.engine.getDuration(url) > 0)) throw new Error('Scene audio could not be loaded. Check the audio file and try again.');
      this.engine.playClip(url, track.volume, track.loop);
    }));
  }
}
