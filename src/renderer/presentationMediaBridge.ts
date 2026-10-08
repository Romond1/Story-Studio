import { localPreviewVideoSdp, localLessonAudioSdp, packetMatches, type MediaIntent, type MediaPacket } from '../shared/presentationMedia';

export interface MediaMixer {
  attachExternalMediaStream(id: string, stream: MediaStream, volume: number): void;
  setExternalMediaVolume(id: string, volume: number): void;
  setExternalMediaEnabled(id: string, enabled: boolean): void;
  detachExternalMediaStream(id: string): void;
  getContext(): AudioContext;
}
/** IPC transports only SDP/ICE. No discovery server, microphone, or remote peer. */
export class LocalMediaPeer {
  readonly peer = new RTCPeerConnection({ iceServers: [] });
  private candidates: RTCIceCandidateInit[] = [];
  disposed = false;
  constructor(readonly intent: MediaIntent, private send: (packet: MediaPacket) => void) {
    this.peer.onicecandidate = event => {
      if (event.candidate) this.emit({ type: 'ice', candidate: event.candidate.toJSON() as MediaPacket['candidate'] });
    };
  }
  emit(payload: Pick<MediaPacket, 'type'> & Partial<MediaPacket>) {
    if (!this.disposed) this.send({ ...payload, identity: this.intent.identity, bridgeEpoch: this.intent.bridgeEpoch, generation: this.intent.rendererGeneration });
  }
  matches(packet: MediaPacket) { return !this.disposed && packetMatches(packet, this.intent, this.intent.rendererGeneration); }
  async remote(packet: MediaPacket) {
    if (!this.matches(packet)) return;
    if (packet.description) {
      await this.peer.setRemoteDescription(packet.description);
      if (this.disposed) return;
      for (const candidate of this.candidates.splice(0)) await this.peer.addIceCandidate(candidate);
    } else if (packet.candidate) {
      if (this.peer.remoteDescription) await this.peer.addIceCandidate(packet.candidate);
      else this.candidates.push(packet.candidate);
    }
  }
  dispose() { this.disposed = true; this.peer.onicecandidate = null; this.peer.ontrack = null; this.peer.onconnectionstatechange = null; this.peer.close(); this.candidates = []; }
}

/** Owns one disabled-by-default audio registration and a separate silent video preview. */
export class ControlMediaReceiver {
  readonly link: LocalMediaPeer;
  private pull: HTMLAudioElement | null = null;
  private stream: MediaStream | null = null;
  private preview: MediaStream | null = null;
  private ready = false;
  private intent: MediaIntent;
  private readonly id: string;
  constructor(intent: MediaIntent, private mixer: MediaMixer, send: (packet: MediaPacket) => void, private fail: (message: string) => void, private showPreview: (stream: MediaStream | null) => void = () => {}) {
    this.intent = intent;
    this.id = `present:${JSON.stringify([intent.identity, intent.rendererGeneration, intent.bridgeEpoch])}`;
    this.link = new LocalMediaPeer(intent, send);
    this.link.peer.ontrack = event => {
      if (this.link.disposed) return;
      // The peer is on this machine: avoid conferencing-sized playout buffers.
      const playback = event.receiver as RTCRtpReceiver & { jitterBufferTarget?: number | null };
      if (playback && 'jitterBufferTarget' in playback) playback.jitterBufferTarget = 0;
      if (event.track.kind === 'video') {
        if (!this.preview) { this.preview = new MediaStream([event.track]); this.showPreview(this.preview); }
        return;
      }
      if (this.stream) return;
      try {
      this.stream = new MediaStream([event.track]);
      this.mixer.attachExternalMediaStream(this.id, this.stream, this.intent.volume);
      const pull = new Audio(); pull.muted = true; pull.srcObject = this.stream; this.pull = pull;
      // Chromium does not decode incoming RTP into Web Audio until a media element pulls it.
      const context = this.mixer.getContext();
      void Promise.all([pull.play(), context.resume()]).then(() => {
        if (this.link.disposed || this.pull !== pull) return;
        if (context.state !== 'running') throw new Error('The teaching audio mixer is suspended. Press Play to retry.');
        this.ready = true; this.update(this.intent); this.link.emit({ type: 'receiver-ready' });
      }).catch(error => { if (!this.link.disposed) this.fail(String(error)); });
      } catch (error) { this.fail(String(error)); }
    };
    this.link.peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(this.link.peer.connectionState) && !this.link.disposed) {
        this.mixer.setExternalMediaEnabled(this.id, false); this.fail('Video audio connection was lost. Press Play to retry.');
      }
    };
  }
  update(intent: MediaIntent) {
    this.intent = intent;
    this.mixer.setExternalMediaVolume(this.id, intent.volume);
    this.mixer.setExternalMediaEnabled(this.id, this.ready && intent.playing && intent.enabled);
  }
  async receive(packet: MediaPacket) {
    if (!this.link.matches(packet)) return;
    try {
      await this.link.remote(packet);
      if (packet.type === 'offer' && !this.link.disposed) {
        const answer = await this.link.peer.createAnswer();
        if (this.link.disposed) return;
        answer.sdp = localPreviewVideoSdp(localLessonAudioSdp(answer.sdp!));
        await this.link.peer.setLocalDescription(answer);
        this.link.emit({ type: 'answer', description: { type: 'answer', sdp: answer.sdp! } });
      }
    } catch (error) { if (!this.link.disposed) this.fail(String(error)); }
  }
  dispose() {
    if (this.link.disposed) return;
    this.link.dispose(); this.ready = false;
    this.mixer.setExternalMediaEnabled(this.id, false); this.mixer.detachExternalMediaStream(this.id);
    if (this.pull) { this.pull.pause(); this.pull.srcObject = null; this.pull = null; }
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.preview?.getTracks().forEach(track => track.stop()); this.preview = null; this.showPreview(null);
  }
}
