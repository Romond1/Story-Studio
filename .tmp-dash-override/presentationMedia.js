"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresentationMediaCore = void 0;
exports.localPreviewVideoSdp = localPreviewVideoSdp;
exports.localLessonAudioSdp = localLessonAudioSdp;
exports.parseMediaIntent = parseMediaIntent;
exports.parseMediaPacket = parseMediaPacket;
exports.packetMatches = packetMatches;
const videoTrim_1 = require("./videoTrim");
/** Electron's local peer need not spend a short clip ramping up from call bandwidth. */
function localPreviewVideoSdp(sdp) {
    return sdp.split(/(?=m=)/).map(section => {
        if (!section.startsWith('m=video '))
            return section;
        const newline = section.includes('\r\n') ? '\r\n' : '\n';
        const payloads = [...section.matchAll(/^a=rtpmap:(\d+) (?:VP8|VP9|H264|AV1)\/90000\r?$/gm)].map(m => m[1]);
        for (const payload of payloads) {
            const fmtp = new RegExp(`^a=fmtp:${payload} ([^\\r\\n]*)\\r?$`, 'm');
            const parameters = new Map((section.match(fmtp)?.[1] ?? '').split(';').filter(Boolean).map(p => {
                const [key, value] = p.trim().split('=');
                return [key, value];
            }));
            for (const [key, value] of Object.entries({ 'x-google-start-bitrate': '8000', 'x-google-min-bitrate': '4000', 'x-google-max-bitrate': '12000' }))
                parameters.set(key, value);
            const line = `a=fmtp:${payload} ${[...parameters].map(([k, v]) => `${k}=${v}`).join(';')}`;
            section = fmtp.test(section) ? section.replace(fmtp, line + (newline === '\r\n' ? '\r' : '')) : section + line + newline;
        }
        return section;
    }).join('');
}
/** Local lesson transport carries music/stereo, not the default mono speech profile. */
function localLessonAudioSdp(sdp) {
    return sdp.split(/(?=m=)/).map(section => {
        if (!section.startsWith('m=audio '))
            return section;
        const payload = section.match(/^a=rtpmap:(\d+) opus\/48000\/2\r?$/m)?.[1];
        if (!payload)
            return section;
        const newline = section.includes('\r\n') ? '\r\n' : '\n';
        const fmtp = new RegExp(`^a=fmtp:${payload} ([^\\r\\n]*)\\r?$`, 'm');
        const parameters = new Map((section.match(fmtp)?.[1] ?? '').split(';').filter(Boolean).map(p => {
            const [key, value] = p.trim().split('=');
            return [key, value];
        }));
        for (const [key, value] of Object.entries({ stereo: '1', 'sprop-stereo': '1', maxaveragebitrate: '192000', usedtx: '0' }))
            parameters.set(key, value);
        const line = `a=fmtp:${payload} ${[...parameters].map(([k, v]) => `${k}=${v}`).join(';')}`;
        section = fmtp.test(section) ? section.replace(fmtp, line + (newline === '\r\n' ? '\r' : '')) : section + line + newline;
        return /^a=ptime:/m.test(section) ? section.replace(/^a=ptime:[^\r\n]*/m, 'a=ptime:10') : section + `a=ptime:10${newline}`;
    }).join('');
}
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const identity = (v) => typeof v === 'string' && v.length > 0 && v.length <= 8192;
function parseMediaIntent(v) {
    if (!object(v) || !identity(v.identity) || !count(v.epoch) || !count(v.bridgeEpoch) || !count(v.rendererGeneration) || typeof v.playing !== 'boolean' || !finite(v.positionSec) || v.positionSec < 0 || !finite(v.volume) || v.volume < 0 || v.volume > 1 || typeof v.enabled !== 'boolean')
        return null;
    return { identity: v.identity, epoch: v.epoch, bridgeEpoch: v.bridgeEpoch, rendererGeneration: v.rendererGeneration, playing: v.playing, positionSec: v.positionSec, volume: v.volume, enabled: v.enabled, ...(v.trim ? { trim: (0, videoTrim_1.normalizeVideoTrimSettings)(v.trim) } : {}) };
}
function parseMediaPacket(v) {
    if (!object(v) || !count(v.generation) || !identity(v.identity) || !count(v.bridgeEpoch))
        return null;
    const base = { generation: v.generation, identity: v.identity, bridgeEpoch: v.bridgeEpoch };
    if ((v.type === 'offer' || v.type === 'answer') && object(v.description) && v.description.type === v.type && typeof v.description.sdp === 'string' && v.description.sdp.length <= 65536)
        return { ...base, type: v.type, description: { type: v.type, sdp: v.description.sdp } };
    if (v.type === 'receiver-ready')
        return { ...base, type: v.type };
    if (v.type === 'ice' && object(v.candidate) && typeof v.candidate.candidate === 'string' && v.candidate.candidate.length <= 4096 && (v.candidate.sdpMid === null || typeof v.candidate.sdpMid === 'string') && (v.candidate.sdpMLineIndex === null || count(v.candidate.sdpMLineIndex)))
        return { ...base, type: v.type, candidate: { candidate: v.candidate.candidate, sdpMid: v.candidate.sdpMid, sdpMLineIndex: v.candidate.sdpMLineIndex, ...(typeof v.candidate.usernameFragment === 'string' ? { usernameFragment: v.candidate.usernameFragment.slice(0, 256) } : {}) } };
    if (v.type === 'status' && object(v.status)) {
        const s = v.status;
        if (s.identity !== v.identity || !count(s.epoch) || !['loading', 'ready', 'playing', 'paused', 'seeking', 'ended', 'error'].includes(String(s.state)) || !finite(s.positionSec) || s.positionSec < 0 || !finite(s.durationSec) || s.durationSec < 0)
            return null;
        return { ...base, type: v.type, status: { identity: s.identity, epoch: s.epoch, state: s.state, positionSec: s.positionSec, durationSec: s.durationSec, ...(typeof s.message === 'string' ? { message: s.message.slice(0, 2048) } : {}) } };
    }
    return null;
}
function packetMatches(packet, intent, generation) {
    return packet.identity === intent.identity && packet.bridgeEpoch === intent.bridgeEpoch && packet.generation === generation && intent.rendererGeneration === generation;
}
/** One Control-Core media intent. Observed playback never becomes a second desired timeline. */
class PresentationMediaCore {
    incarnation = 0;
    intent = null;
    status = null;
    configure(id, runtime, audio, trim) {
        if (!id) {
            this.intent = null;
            this.status = null;
            return;
        }
        const normalized = (0, videoTrim_1.normalizeVideoTrimSettings)(trim);
        if (this.intent?.identity !== id) {
            const incarnation = ++this.incarnation;
            this.intent = { identity: id, epoch: incarnation, bridgeEpoch: incarnation, rendererGeneration: runtime.generation, playing: false, positionSec: normalized?.inSec ?? 0, ...audio, trim: normalized };
            this.status = null;
            return;
        }
        const old = this.intent;
        const recovery = old.rendererGeneration !== runtime.generation || (!runtime.available && old.playing);
        const trimChanged = JSON.stringify(old.trim) !== JSON.stringify(normalized);
        const changed = old.enabled !== audio.enabled || old.volume !== audio.volume || JSON.stringify(old.trim) !== JSON.stringify(normalized);
        if (recovery || changed)
            this.intent = { ...old, ...audio, trim: normalized, rendererGeneration: runtime.generation, epoch: ++this.incarnation, bridgeEpoch: recovery || trimChanged ? this.incarnation : old.bridgeEpoch, ...(recovery ? { playing: false } : {}), ...(recovery || trimChanged ? { positionSec: (0, videoTrim_1.clampVideoTimeToTrim)(this.status?.positionSec ?? old.positionSec, normalized, this.status?.durationSec ?? 0) } : {}) };
    }
    command(action, position) {
        const old = this.intent;
        if (!old)
            return;
        if (position !== undefined && (!Number.isFinite(position) || position < 0))
            return;
        const restart = action === 'replay' || (action === 'play' && this.status?.state === 'ended');
        const discontinuity = action === 'seek' || restart;
        const time = restart ? old.trim?.inSec ?? 0 : position ?? this.status?.positionSec ?? old.positionSec;
        this.intent = { ...old, epoch: ++this.incarnation, bridgeEpoch: discontinuity ? this.incarnation : old.bridgeEpoch, playing: action === 'play' || action === 'replay' ? true : action === 'pause' ? false : old.playing, positionSec: (0, videoTrim_1.clampVideoTimeToTrim)(time, old.trim, this.status?.durationSec ?? 0) };
    }
    observe(packet, generation) {
        if (!this.intent || !packetMatches(packet, this.intent, generation) || !packet.status || packet.status.epoch !== this.intent.epoch)
            return false;
        this.status = packet.status;
        if ((packet.status.state === 'ended' || packet.status.state === 'error') && this.intent.playing)
            this.intent = { ...this.intent, playing: false, positionSec: packet.status.positionSec, epoch: ++this.incarnation };
        return true;
    }
}
exports.PresentationMediaCore = PresentationMediaCore;
