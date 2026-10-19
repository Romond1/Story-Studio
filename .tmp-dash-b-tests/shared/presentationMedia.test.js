"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mediaModel = __importStar(require("./presentationMedia"));
const presentationMedia_1 = require("./presentationMedia");
const audio = { enabled: true, volume: 0.5 };
(0, node_test_1.default)('Play after trim completion restarts the retired capture at the trim in point', () => {
    const core = new presentationMedia_1.PresentationMediaCore();
    core.configure('a', { generation: 1, available: true }, audio, { inSec: 2, outSec: 5 });
    core.command('play');
    const live = core.intent;
    core.observe({ type: 'status', generation: 1, identity: 'a', bridgeEpoch: live.bridgeEpoch, status: { identity: 'a', epoch: live.epoch, state: 'ended', positionSec: 5, durationSec: 10 } }, 1);
    core.command('play');
    strict_1.default.equal(core.intent.positionSec, 2);
    strict_1.default.equal(core.intent.playing, true);
    strict_1.default.ok(core.intent.bridgeEpoch > live.bridgeEpoch);
});
(0, node_test_1.default)('local preview starts at lesson quality without low-bandwidth warmup or changing RTX/audio', () => {
    const configure = mediaModel.localPreviewVideoSdp;
    strict_1.default.equal(typeof configure, 'function');
    const source = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96 97\r\na=rtpmap:96 VP8/90000\r\na=rtpmap:97 rtx/90000\r\na=fmtp:97 apt=96\r\n';
    const result = configure(source);
    strict_1.default.match(result, /a=fmtp:96 .*x-google-start-bitrate=8000/);
    strict_1.default.match(result, /x-google-min-bitrate=4000/);
    strict_1.default.match(result, /a=fmtp:97 apt=96\r\n/);
    strict_1.default.equal(result.split('m=video')[0], source.split('m=video')[0]);
    strict_1.default.equal(configure(result), result);
});
(0, node_test_1.default)('local lesson audio negotiates stereo fidelity instead of the default mono speech profile', () => {
    const source = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=fmtp:96 profile-id=0\r\n';
    const configure = mediaModel.localLessonAudioSdp;
    strict_1.default.equal(typeof configure, 'function');
    const result = configure(source);
    strict_1.default.match(result, /stereo=1/);
    strict_1.default.match(result, /maxaveragebitrate=192000/);
    strict_1.default.match(result, /a=ptime:10\r\n/);
    strict_1.default.equal(configure(result), result, 'idempotent offer/answer configuration');
    strict_1.default.equal(result.split('m=video')[1], source.split('m=video')[1]);
    strict_1.default.equal(configure('v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'), 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n');
});
(0, node_test_1.default)('media commands use epochs; seek rebuilds bridge, stale ended cannot pause new playback', () => {
    const core = new presentationMedia_1.PresentationMediaCore();
    core.configure('video A', { generation: 1, available: true }, audio, { inSec: 2, outSec: 8 });
    strict_1.default.equal(core.intent.playing, false);
    core.command('play');
    const prior = core.intent;
    core.command('seek', 5);
    strict_1.default.ok(core.intent.bridgeEpoch > prior.bridgeEpoch);
    strict_1.default.equal(core.intent.positionSec, 5);
    const stale = { identity: prior.identity, generation: 1, bridgeEpoch: prior.bridgeEpoch, type: 'status', status: { identity: prior.identity, epoch: prior.epoch, state: 'ended', durationSec: 10, positionSec: 8 } };
    strict_1.default.equal(core.observe(stale, 1), false);
    strict_1.default.equal(core.intent.playing, true);
    core.command('replay');
    strict_1.default.equal(core.intent.positionSec, 2);
});
(0, node_test_1.default)('renderer loss and replacement recover paused without losing actual position', () => {
    const core = new presentationMedia_1.PresentationMediaCore();
    core.configure('a', { generation: 1, available: true }, audio);
    core.command('play');
    strict_1.default.equal(core.observe({ identity: 'a', generation: 1, bridgeEpoch: core.intent.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: core.intent.epoch, state: 'playing', durationSec: 20, positionSec: 6 } }, 1), true);
    core.configure('a', { generation: 2, available: false }, audio);
    strict_1.default.equal(core.intent.playing, false);
    strict_1.default.equal(core.intent.positionSec, 6);
    core.configure('b', { generation: 2, available: true }, audio);
    strict_1.default.equal(core.intent.positionSec, 0);
    strict_1.default.equal(core.intent.playing, false);
});
(0, node_test_1.default)('returning to an occurrence after seeks cannot accept its retired bridge', () => {
    const core = new presentationMedia_1.PresentationMediaCore();
    const runtime = { generation: 1, available: true };
    core.configure('a', runtime, audio);
    core.command('seek', 2);
    core.command('seek', 4);
    const old = core.intent;
    core.configure('b', runtime, audio);
    core.configure('a', runtime, audio);
    strict_1.default.ok(core.intent.bridgeEpoch > old.bridgeEpoch);
    strict_1.default.equal(core.observe({ generation: 1, identity: 'a', bridgeEpoch: old.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: old.epoch, state: 'ended', durationSec: 20, positionSec: 4 } }, 1), false);
});
(0, node_test_1.default)('gain changes and unchanged base preserve bridge; trim changes rebuild it', () => {
    const core = new presentationMedia_1.PresentationMediaCore();
    const runtime = { generation: 1, available: true };
    core.configure('a', runtime, audio);
    core.command('play');
    const bridge = core.intent.bridgeEpoch;
    core.configure('a', runtime, { enabled: false, volume: 0.2 });
    strict_1.default.equal(core.intent.bridgeEpoch, bridge);
    core.configure('a', runtime, audio, { inSec: 2 });
    strict_1.default.ok(core.intent.bridgeEpoch > bridge);
});
(0, node_test_1.default)('media IPC parsers reject malformed payloads and strip extra properties', () => {
    strict_1.default.equal((0, presentationMedia_1.parseMediaPacket)({ generation: -1 }), null);
    strict_1.default.equal((0, presentationMedia_1.parseMediaIntent)({ identity: 'a', epoch: 0, bridgeEpoch: 0, rendererGeneration: 0, playing: true, positionSec: NaN, enabled: true, volume: 1 }), null);
    strict_1.default.deepEqual((0, presentationMedia_1.parseMediaPacket)({ generation: 1, identity: 'a', bridgeEpoch: 0, type: 'receiver-ready', notes: 'private' }), { generation: 1, identity: 'a', bridgeEpoch: 0, type: 'receiver-ready' });
});
(0, node_test_1.default)('trim edits preserve latest playback position and clamp it to the new bounds', () => {
    const core = new presentationMedia_1.PresentationMediaCore();
    const runtime = { generation: 1, available: true };
    core.configure('a', runtime, audio);
    core.command('play');
    const old = core.intent;
    core.observe({ generation: 1, identity: 'a', bridgeEpoch: old.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: old.epoch, state: 'playing', positionSec: 6, durationSec: 12 } }, 1);
    core.configure('a', runtime, audio, { inSec: 2, outSec: 10 });
    strict_1.default.equal(core.intent.positionSec, 6);
    strict_1.default.equal(core.intent.playing, true);
    strict_1.default.ok(core.intent.bridgeEpoch > old.bridgeEpoch);
    core.configure('a', runtime, audio, { inSec: 2, outSec: 5 });
    strict_1.default.equal(core.intent.positionSec, 5);
});
(0, node_test_1.default)('current epoch ended and error statuses pause Core once and retain actual position', () => {
    for (const state of ['ended', 'error']) {
        const core = new presentationMedia_1.PresentationMediaCore();
        core.configure('a', { generation: 1, available: true }, audio);
        core.command('play');
        const before = core.intent;
        const packet = { generation: 1, identity: 'a', bridgeEpoch: before.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: before.epoch, state, positionSec: 5, durationSec: 12 } };
        strict_1.default.equal(core.observe(packet, 1), true);
        strict_1.default.equal(core.intent.playing, false);
        strict_1.default.equal(core.intent.positionSec, 5);
        strict_1.default.ok(core.intent.epoch > before.epoch);
        strict_1.default.equal(core.observe(packet, 1), false);
    }
});
