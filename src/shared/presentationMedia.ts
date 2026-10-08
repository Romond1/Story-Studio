import type { VideoTrimSettings } from './types';
import { normalizeVideoTrimSettings, clampVideoTimeToTrim } from './videoTrim';

/** Electron's local peer need not spend a short clip ramping up from call bandwidth. */
export function localPreviewVideoSdp(sdp: string): string {
  return sdp.split(/(?=m=)/).map(section => {
    if (!section.startsWith('m=video ')) return section;
    const newline = section.includes('\r\n') ? '\r\n' : '\n';
    const payloads = [...section.matchAll(/^a=rtpmap:(\d+) (?:VP8|VP9|H264|AV1)\/90000\r?$/gm)].map(m => m[1]);
    for (const payload of payloads) {
      const fmtp = new RegExp(`^a=fmtp:${payload} ([^\\r\\n]*)\\r?$`, 'm');
      const parameters = new Map((section.match(fmtp)?.[1] ?? '').split(';').filter(Boolean).map(p => {
        const [key, value] = p.trim().split('='); return [key, value];
      }));
      for (const [key, value] of Object.entries({ 'x-google-start-bitrate': '8000', 'x-google-min-bitrate': '4000', 'x-google-max-bitrate': '12000' })) parameters.set(key, value);
      const line = `a=fmtp:${payload} ${[...parameters].map(([k, v]) => `${k}=${v}`).join(';')}`;
      section = fmtp.test(section) ? section.replace(fmtp, line + (newline === '\r\n' ? '\r' : '')) : section + line + newline;
    }
    return section;
  }).join('');
}

/** Local lesson transport carries music/stereo, not the default mono speech profile. */
export function localLessonAudioSdp(sdp: string): string {
  return sdp.split(/(?=m=)/).map(section => {
    if (!section.startsWith('m=audio ')) return section;
    const payload = section.match(/^a=rtpmap:(\d+) opus\/48000\/2\r?$/m)?.[1];
    if (!payload) return section;
    const newline = section.includes('\r\n') ? '\r\n' : '\n';
    const fmtp = new RegExp(`^a=fmtp:${payload} ([^\\r\\n]*)\\r?$`, 'm');
    const parameters = new Map((section.match(fmtp)?.[1] ?? '').split(';').filter(Boolean).map(p => {
      const [key, value] = p.trim().split('='); return [key, value];
    }));
    for (const [key, value] of Object.entries({ stereo: '1', 'sprop-stereo': '1', maxaveragebitrate: '192000', usedtx: '0' })) parameters.set(key, value);
    const line = `a=fmtp:${payload} ${[...parameters].map(([k, v]) => `${k}=${v}`).join(';')}`;
    section = fmtp.test(section) ? section.replace(fmtp, line + (newline === '\r\n' ? '\r' : '')) : section + line + newline;
    return /^a=ptime:/m.test(section) ? section.replace(/^a=ptime:[^\r\n]*/m, 'a=ptime:10') : section + `a=ptime:10${newline}`;
  }).join('');
}

export interface MediaIntent {
  identity: string; epoch: number; bridgeEpoch: number; rendererGeneration: number;
  playing: boolean; positionSec: number; volume: number; enabled: boolean; trim?: VideoTrimSettings;
}
export interface MediaRuntime { generation: number; available: boolean }
export interface MediaPlaybackStatus {
  identity: string; epoch: number; state: 'loading' | 'ready' | 'playing' | 'paused' | 'seeking' | 'ended' | 'error';
  positionSec: number; durationSec: number; message?: string;
}
export interface MediaPacket {
  generation: number; identity: string; bridgeEpoch: number;
  type: 'offer' | 'answer' | 'ice' | 'receiver-ready' | 'status';
  description?: { type: 'offer' | 'answer'; sdp: string };
  candidate?: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null; usernameFragment?: string | null };
  status?: MediaPlaybackStatus;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const identity = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 8192;
export function parseMediaIntent(v: unknown): MediaIntent | null {
  if (!object(v) || !identity(v.identity) || !count(v.epoch) || !count(v.bridgeEpoch) || !count(v.rendererGeneration) || typeof v.playing !== 'boolean' || !finite(v.positionSec) || v.positionSec < 0 || !finite(v.volume) || v.volume < 0 || v.volume > 1 || typeof v.enabled !== 'boolean') return null;
  return { identity: v.identity, epoch: v.epoch, bridgeEpoch: v.bridgeEpoch, rendererGeneration: v.rendererGeneration, playing: v.playing, positionSec: v.positionSec, volume: v.volume, enabled: v.enabled, ...(v.trim ? { trim: normalizeVideoTrimSettings(v.trim as VideoTrimSettings) } : {}) };
}
export function parseMediaPacket(v: unknown): MediaPacket | null {
  if (!object(v) || !count(v.generation) || !identity(v.identity) || !count(v.bridgeEpoch)) return null;
  const base = { generation: v.generation, identity: v.identity, bridgeEpoch: v.bridgeEpoch };
  if ((v.type === 'offer' || v.type === 'answer') && object(v.description) && v.description.type === v.type && typeof v.description.sdp === 'string' && v.description.sdp.length <= 65536) return { ...base, type: v.type, description: { type: v.type, sdp: v.description.sdp } };
  if (v.type === 'receiver-ready') return { ...base, type: v.type };
  if (v.type === 'ice' && object(v.candidate) && typeof v.candidate.candidate === 'string' && v.candidate.candidate.length <= 4096 && (v.candidate.sdpMid === null || typeof v.candidate.sdpMid === 'string') && (v.candidate.sdpMLineIndex === null || count(v.candidate.sdpMLineIndex))) return { ...base, type: v.type, candidate: { candidate: v.candidate.candidate, sdpMid: v.candidate.sdpMid as string | null, sdpMLineIndex: v.candidate.sdpMLineIndex as number | null, ...(typeof v.candidate.usernameFragment === 'string' ? { usernameFragment: v.candidate.usernameFragment.slice(0, 256) } : {}) } };
  if (v.type === 'status' && object(v.status)) {
    const s = v.status;
    if (s.identity !== v.identity || !count(s.epoch) || !['loading','ready','playing','paused','seeking','ended','error'].includes(String(s.state)) || !finite(s.positionSec) || s.positionSec < 0 || !finite(s.durationSec) || s.durationSec < 0) return null;
    return { ...base, type: v.type, status: { identity: s.identity as string, epoch: s.epoch, state: s.state as MediaPlaybackStatus['state'], positionSec: s.positionSec, durationSec: s.durationSec, ...(typeof s.message === 'string' ? { message: s.message.slice(0, 2048) } : {}) } };
  }
  return null;
}
export function packetMatches(packet: MediaPacket, intent: MediaIntent, generation: number): boolean {
  return packet.identity === intent.identity && packet.bridgeEpoch === intent.bridgeEpoch && packet.generation === generation && intent.rendererGeneration === generation;
}
/** One Control-Core media intent. Observed playback never becomes a second desired timeline. */
export class PresentationMediaCore {
  private incarnation = 0;
  intent: MediaIntent | null = null;
  status: MediaPlaybackStatus | null = null;
  configure(id: string | null, runtime: MediaRuntime, audio: { enabled: boolean; volume: number }, trim?: VideoTrimSettings): void {
    if (!id) { this.intent = null; this.status = null; return; }
    const normalized = normalizeVideoTrimSettings(trim);
    if (this.intent?.identity !== id) {
      const incarnation = ++this.incarnation;
      this.intent = { identity: id, epoch: incarnation, bridgeEpoch: incarnation, rendererGeneration: runtime.generation, playing: false, positionSec: normalized?.inSec ?? 0, ...audio, trim: normalized }; this.status = null; return;
    }
    const old = this.intent;
    const recovery = old.rendererGeneration !== runtime.generation || (!runtime.available && old.playing);
    const trimChanged = JSON.stringify(old.trim) !== JSON.stringify(normalized);
    const changed = old.enabled !== audio.enabled || old.volume !== audio.volume || JSON.stringify(old.trim) !== JSON.stringify(normalized);
    if (recovery || changed) this.intent = { ...old, ...audio, trim: normalized, rendererGeneration: runtime.generation, epoch: ++this.incarnation, bridgeEpoch: recovery || trimChanged ? this.incarnation : old.bridgeEpoch, ...(recovery ? { playing: false } : {}), ...(recovery || trimChanged ? { positionSec: clampVideoTimeToTrim(this.status?.positionSec ?? old.positionSec, normalized, this.status?.durationSec ?? 0) } : {}) };
  }
  command(action: 'play' | 'pause' | 'seek' | 'replay', position?: number): void {
    const old = this.intent; if (!old) return;
    if (position !== undefined && (!Number.isFinite(position) || position < 0)) return;
    const restart = action === 'replay' || (action === 'play' && this.status?.state === 'ended');
    const discontinuity = action === 'seek' || restart;
    const time = restart ? old.trim?.inSec ?? 0 : position ?? this.status?.positionSec ?? old.positionSec;
    this.intent = { ...old, epoch: ++this.incarnation, bridgeEpoch: discontinuity ? this.incarnation : old.bridgeEpoch, playing: action === 'play' || action === 'replay' ? true : action === 'pause' ? false : old.playing, positionSec: clampVideoTimeToTrim(time, old.trim, this.status?.durationSec ?? 0) };
  }
  observe(packet: MediaPacket, generation: number): boolean {
    if (!this.intent || !packetMatches(packet, this.intent, generation) || !packet.status || packet.status.epoch !== this.intent.epoch) return false;
    this.status = packet.status;
    if ((packet.status.state === 'ended' || packet.status.state === 'error') && this.intent.playing) this.intent = { ...this.intent, playing: false, positionSec: packet.status.positionSec, epoch: ++this.incarnation };
    return true;
  }
}
