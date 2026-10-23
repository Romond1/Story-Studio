import type { SceneAudio } from '../../shared/lesson/model';

export interface LessonAudioEngine {
  preload(url: string): Promise<void>;
  getDuration(url: string): number;
  playClip(url: string, volume: number, loop: boolean): void;
  pauseClip(url: string): void;
  setClipVolume?(url: string, volume: number): void;
  isPlaying?(url: string): boolean;
  stopClip(url: string): void;
}
type OwnedTrack = { volume: number; loop: boolean; ready: boolean; resume: boolean };
/** Reuses the mixer; fences asynchronous loads when navigation or Stop wins. */
export class SceneAudioOwner {
  private epoch = 0;
  private paused = false;
  private tracks = new Map<string, OwnedTrack>();
  constructor(private engine: LessonAudioEngine) {}
  stop() {
    this.epoch++;
    for (const url of this.tracks.keys()) this.engine.stopClip(url);
    this.tracks.clear(); this.paused = false;
  }
  setVolume(url: string, volume: number) {
    const track = this.tracks.get(url); if (!track || !Number.isFinite(volume)) return;
    track.volume = Math.max(0, Math.min(1, volume));
    if (track.ready && !this.paused && this.engine.isPlaying?.(url)) this.engine.setClipVolume?.(url, track.volume);
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    for (const [url, track] of this.tracks) {
      if (!track.ready) continue;
      track.resume = this.engine.isPlaying?.(url) ?? true;
      if (track.resume) this.engine.pauseClip(url);
    }
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    for (const [url, track] of this.tracks) if (track.ready && track.resume) this.start(url, track);
  }
  private start(url: string, track: OwnedTrack) {
    this.engine.playClip(url, track.volume, track.loop);
    track.resume = false;
  }
  async play(tracks: SceneAudio[], resolve: (id: string) => string | undefined) {
    this.stop(); const epoch = this.epoch;
    await Promise.all(tracks.map(async track => {
      const url = resolve(track.assetId); if (!url || this.tracks.has(url)) return;
      const owned: OwnedTrack = { volume: track.volume, loop: track.loop, ready: false, resume: true };
      this.tracks.set(url, owned); await this.engine.preload(url);
      if (this.epoch !== epoch) return;
      // The shared mixer's preload records failures without rejecting. Calling
      // playClip with no decoded buffer would start its own unfenced retry.
      if (!(this.engine.getDuration(url) > 0)) throw new Error('Scene audio could not be loaded. Check the audio file and try again.');
      owned.ready = true;
      if (!this.paused) this.start(url, owned);
    }));
  }
}
