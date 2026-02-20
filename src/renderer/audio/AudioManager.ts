export class AudioManager {
  private cache = new Map<string, HTMLAudioElement>();
  private sectionMusicUrl: string | null = null;
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify = () => {
    this.listeners.forEach((l) => l());
  };

  private getAudio(url: string): HTMLAudioElement {
    if (!this.cache.has(url)) {
      const audio = new Audio(url);
      audio.onerror = (e) => console.error(`[audio] Error loading ${url}`, e);
      audio.onplay = this.notify;
      audio.onpause = this.notify;
      audio.onended = this.notify;
      this.cache.set(url, audio);
    }
    return this.cache.get(url)!;
  }

  public playClip(url: string, volume: number = 1, loop: boolean = false) {
    const audio = this.getAudio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    audio.currentTime = 0;
    audio
      .play()
      .catch((e) => console.error(`[audio] Play failed for ${url}`, e));
  }

  public stopClip(url: string) {
    const audio = this.cache.get(url);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  public isPlaying(url: string): boolean {
    const audio = this.cache.get(url);
    if (!audio) return false;
    return !audio.paused && !audio.ended;
  }

  public setVolume(url: string, volume: number) {
    const audio = this.cache.get(url);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public playSectionMusic(url: string, volume: number = 1) {
    if (this.sectionMusicUrl && this.sectionMusicUrl !== url) {
      this.stopClip(this.sectionMusicUrl);
    }
    this.sectionMusicUrl = url;
    const audio = this.getAudio(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = true;
    if (audio.paused) {
      audio
        .play()
        .catch((e) =>
          console.error(`[audio] Play section music failed ${url}`, e),
        );
    }
  }

  public stopSectionMusic() {
    if (this.sectionMusicUrl) {
      this.stopClip(this.sectionMusicUrl);
      this.sectionMusicUrl = null;
    }
  }

  public stopSlideAudio() {
    this.cache.forEach((audio, url) => {
      if (url !== this.sectionMusicUrl && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }

  public stopAll() {
    this.cache.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.sectionMusicUrl = null;
  }
}

export const audioManager = new AudioManager();
