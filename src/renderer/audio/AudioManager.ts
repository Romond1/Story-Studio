import { audioRouting } from "./AudioRouting";

export class AudioManager {
  private buffers = new Map<string, AudioBuffer>();
  private activeNodes = new Map<string, { source: AudioBufferSourceNode, gainNode: GainNode }>();
  private pauseTimes = new Map<string, number>();
  private startTimes = new Map<string, number>();

  private sectionMusicUrl: string | null = null;
  private playClipCalls = 0;
  private listeners = new Set<() => void>();

  // WebAudio Integration
  private ctx: AudioContext;
  private masterGain: GainNode; // masterMusicBus splitter
  private monitorGain: GainNode;
  private cableGain: GainNode;
  private destination: MediaStreamAudioDestinationNode;
  private monitorDestination: MediaStreamAudioDestinationNode;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.monitorGain = this.ctx.createGain();
    this.cableGain = this.ctx.createGain();

    this.destination = this.ctx.createMediaStreamDestination();
    this.monitorDestination = this.ctx.createMediaStreamDestination();

    // Master splits into the two output routes
    this.masterGain.connect(this.cableGain);
    this.masterGain.connect(this.monitorGain);

    // Each sub-bus goes to its respective sink
    this.cableGain.connect(this.destination);
    this.monitorGain.connect(this.monitorDestination);

    // Link to our Virtual Cable Router
    audioRouting.setSourceStream(this.destination.stream);
    audioRouting.setMonitorStream(this.monitorDestination.stream);
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify = () => {
    this.listeners.forEach((l) => l());
  };

  public async preload(url: string): Promise<void> {
    if (this.buffers.has(url)) return;
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const decoded = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(url, decoded);
      this.notify();
    } catch (e) {
      console.error(`[audio] Failed to preload buffer for ${url}`, e);
    }
  }

  public getCurrentTime(url: string): number {
    if (this.isPlaying(url)) {
      const start = this.startTimes.get(url) || 0;
      return this.ctx.currentTime - start;
    }
    return this.pauseTimes.get(url) || 0;
  }

  public getDuration(url: string): number {
    return this.buffers.get(url)?.duration || 0;
  }

  public seek(url: string, time: number) {
    const wasPlaying = this.isPlaying(url);
    if (wasPlaying) {
      // Pause updates the pauseTime
      this.pauseClip(url);
    }
    this.pauseTimes.set(url, time);
    if (wasPlaying) {
      // we must get the current volume and loop state when we resume, though we didn't store it statically.
      // We will assume UI will just call play() itself, but let's implement seamless seek.
      // Easiest is to let playClip resume at pauseTime.
      // We don't have volume stored explicitly aside from GainNode which was destroyed.
      // So doing playClip from UI is safer.
      this.notify();
    }
    this.notify();
  }

  public isPlaying(url: string): boolean {
    return this.activeNodes.has(url);
  }

  private cleanupNode(url: string) {
    const node = this.activeNodes.get(url);
    if (!node) return;

    node.source.onended = null;
    try {
      node.source.stop();
    } catch {
      // ignore if already stopped
    }
    node.source.disconnect();
    node.gainNode.disconnect();
    this.activeNodes.delete(url);
  }

  public playClip(url: string, volume: number = 1, loop: boolean = false, fadeOptions?: { fadeEnabled: boolean }) {
    this.playClipCalls += 1;
    const wasPlaying = this.isPlaying(url);
    console.log("[audio] playClip", { callCount: this.playClipCalls, url, wasPlaying, ctxState: this.ctx.state });

    const buffer = this.buffers.get(url);
    if (!buffer) {
      // If not preloaded, preload then play
      this.preload(url).then(() => {
        if (this.buffers.has(url)) this.playClip(url, volume, loop, fadeOptions);
      });
      return;
    }

    if (this.ctx.state === "suspended") this.ctx.resume();

    // Ensure single active playback path per URL
    if (this.isPlaying(url)) {
      this.cleanupNode(url);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = fadeOptions?.fadeEnabled ? 0 : Math.max(0, Math.min(1, volume));

    // Connect to the master splitter, NOT multiple outputs directly
    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    const offset = this.pauseTimes.get(url) || 0;
    source.start(0, offset);
    console.log("[audio] source.start", { url });

    if (fadeOptions?.fadeEnabled) {
      gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime + 3);
    }

    this.startTimes.set(url, this.ctx.currentTime - offset);
    this.activeNodes.set(url, { source, gainNode });

    source.onended = () => {
      // onended fires if stopped manually or ended naturally.
      // we only clean up if it's the exact same node that ended naturally
      if (this.activeNodes.get(url)?.source === source) {
        source.disconnect();
        gainNode.disconnect();
        this.activeNodes.delete(url);
        this.pauseTimes.set(url, 0);
        this.notify();
      }
    };

    this.notify();
  }

  public pauseClip(url: string) {
    const node = this.activeNodes.get(url);
    if (!node) return;

    const start = this.startTimes.get(url) || 0;
    const elapsed = this.ctx.currentTime - start;
    this.pauseTimes.set(url, elapsed);

    this.cleanupNode(url);
    this.notify();
  }

  public stopClip(url: string, fadeOptions?: { fadeEnabled: boolean }) {
    const node = this.activeNodes.get(url);
    if (node) {
      if (fadeOptions?.fadeEnabled) {
        const currentVol = node.gainNode.gain.value;
        node.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        node.gainNode.gain.setValueAtTime(currentVol, this.ctx.currentTime);
        node.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);
        node.source.onended = () => {
          if (this.activeNodes.get(url)?.source === node.source) {
            node.source.disconnect();
            node.gainNode.disconnect();
            this.activeNodes.delete(url);
            this.notify();
          }
        };
        node.source.stop(this.ctx.currentTime + 3);
      } else {
        this.cleanupNode(url);
      }
    }
    this.pauseTimes.set(url, 0); // reset to beginning!
    this.notify();
  }

  public setVolume(url: string, volume: number) {
    const node = this.activeNodes.get(url);
    if (node) {
      node.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      node.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime);
    }
  }

  public playSectionMusic(url: string, volume: number = 1, fadeEnabled: boolean = false) {
    if (this.sectionMusicUrl && this.sectionMusicUrl !== url) {
      this.stopClip(this.sectionMusicUrl, { fadeEnabled });
    }
    this.sectionMusicUrl = url;
    this.playClip(url, volume, true, { fadeEnabled });
  }

  public stopSectionMusic(fadeEnabled: boolean = false) {
    if (this.sectionMusicUrl) {
      this.stopClip(this.sectionMusicUrl, { fadeEnabled });
      this.sectionMusicUrl = null;
    }
  }

  public stopSlideAudio() {
    this.activeNodes.forEach((node, url) => {
      if (url !== this.sectionMusicUrl) {
        this.stopClip(url);
      }
    });
  }

  public stopAll() {
    this.activeNodes.forEach((node, url) => {
      this.stopClip(url);
    });
    this.sectionMusicUrl = null;
  }

  public getMasterGain() {
    return this.masterGain;
  }

  public getMonitorGain() {
    return this.monitorGain;
  }

  public getCableGain() {
    return this.cableGain;
  }

  public getContext() {
    return this.ctx;
  }
}

export const audioManager = new AudioManager();
