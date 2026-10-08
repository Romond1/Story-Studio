import test from 'node:test';
import assert from 'node:assert/strict';
import * as mediaModel from './presentationMedia';
import { PresentationMediaCore, parseMediaPacket, parseMediaIntent, type MediaPacket } from './presentationMedia';
const audio = { enabled: true, volume: 0.5 };

test('Play after trim completion restarts the retired capture at the trim in point', () => {
  const core = new PresentationMediaCore(); core.configure('a', {generation: 1, available: true}, audio, {inSec: 2, outSec: 5}); core.command('play');
  const live = core.intent!;
  core.observe({type:'status',generation:1,identity:'a',bridgeEpoch:live.bridgeEpoch,status:{identity:'a',epoch:live.epoch,state:'ended',positionSec:5,durationSec:10}}, 1);
  core.command('play');
  assert.equal(core.intent!.positionSec, 2); assert.equal(core.intent!.playing, true);
  assert.ok(core.intent!.bridgeEpoch > live.bridgeEpoch);
});

test('local preview starts at lesson quality without low-bandwidth warmup or changing RTX/audio', () => {
  const configure = (mediaModel as any).localPreviewVideoSdp;
  assert.equal(typeof configure, 'function');
  const source = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96 97\r\na=rtpmap:96 VP8/90000\r\na=rtpmap:97 rtx/90000\r\na=fmtp:97 apt=96\r\n';
  const result = configure(source);
  assert.match(result, /a=fmtp:96 .*x-google-start-bitrate=8000/);
  assert.match(result, /x-google-min-bitrate=4000/);
  assert.match(result, /a=fmtp:97 apt=96\r\n/);
  assert.equal(result.split('m=video')[0], source.split('m=video')[0]);
  assert.equal(configure(result), result);
});

test('local lesson audio negotiates stereo fidelity instead of the default mono speech profile', () => {
  const source = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=fmtp:96 profile-id=0\r\n';
  const configure = (mediaModel as any).localLessonAudioSdp;
  assert.equal(typeof configure, 'function');
  const result = configure(source);
  assert.match(result, /stereo=1/); assert.match(result, /maxaveragebitrate=192000/);
  assert.match(result, /a=ptime:10\r\n/);
  assert.equal(configure(result), result, 'idempotent offer/answer configuration');
  assert.equal(result.split('m=video')[1], source.split('m=video')[1]);
  assert.equal(configure('v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'), 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n');
});
test('media commands use epochs; seek rebuilds bridge, stale ended cannot pause new playback', () => {
  const core = new PresentationMediaCore(); core.configure('video A', { generation: 1, available: true }, audio, { inSec: 2, outSec: 8 });
  assert.equal(core.intent!.playing, false); core.command('play'); const prior = core.intent!; core.command('seek', 5);
  assert.ok(core.intent!.bridgeEpoch > prior.bridgeEpoch); assert.equal(core.intent!.positionSec, 5);
  const stale: MediaPacket = { identity: prior.identity, generation: 1, bridgeEpoch: prior.bridgeEpoch, type: 'status', status: { identity: prior.identity, epoch: prior.epoch, state: 'ended', durationSec: 10, positionSec: 8 } };
  assert.equal(core.observe(stale, 1), false); assert.equal(core.intent!.playing, true);
  core.command('replay'); assert.equal(core.intent!.positionSec, 2);
});
test('renderer loss and replacement recover paused without losing actual position', () => {
  const core = new PresentationMediaCore(); core.configure('a', { generation: 1, available: true }, audio); core.command('play');
  assert.equal(core.observe({ identity: 'a', generation: 1, bridgeEpoch: core.intent!.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: core.intent!.epoch, state: 'playing', durationSec: 20, positionSec: 6 } }, 1), true);
  core.configure('a', { generation: 2, available: false }, audio); assert.equal(core.intent!.playing, false); assert.equal(core.intent!.positionSec, 6);
  core.configure('b', { generation: 2, available: true }, audio); assert.equal(core.intent!.positionSec, 0); assert.equal(core.intent!.playing, false);
});
test('returning to an occurrence after seeks cannot accept its retired bridge', () => {
  const core = new PresentationMediaCore(); const runtime = { generation: 1, available: true };
  core.configure('a', runtime, audio); core.command('seek', 2); core.command('seek', 4);
  const old = core.intent!;
  core.configure('b', runtime, audio); core.configure('a', runtime, audio);
  assert.ok(core.intent!.bridgeEpoch > old.bridgeEpoch);
  assert.equal(core.observe({ generation: 1, identity: 'a', bridgeEpoch: old.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: old.epoch, state: 'ended', durationSec: 20, positionSec: 4 } }, 1), false);
});
test('gain changes and unchanged base preserve bridge; trim changes rebuild it', () => {
  const core = new PresentationMediaCore(); const runtime = { generation: 1, available: true };
  core.configure('a', runtime, audio); core.command('play'); const bridge = core.intent!.bridgeEpoch;
  core.configure('a', runtime, { enabled: false, volume: 0.2 }); assert.equal(core.intent!.bridgeEpoch, bridge);
  core.configure('a', runtime, audio, { inSec: 2 }); assert.ok(core.intent!.bridgeEpoch > bridge);
});
test('media IPC parsers reject malformed payloads and strip extra properties', () => {
  assert.equal(parseMediaPacket({ generation: -1 }), null);
  assert.equal(parseMediaIntent({ identity: 'a', epoch: 0, bridgeEpoch: 0, rendererGeneration: 0, playing: true, positionSec: NaN, enabled: true, volume: 1 }), null);
  assert.deepEqual(parseMediaPacket({ generation: 1, identity: 'a', bridgeEpoch: 0, type: 'receiver-ready', notes: 'private' }), { generation: 1, identity: 'a', bridgeEpoch: 0, type: 'receiver-ready' });
});
test('trim edits preserve latest playback position and clamp it to the new bounds', () => {
  const core = new PresentationMediaCore(); const runtime = { generation: 1, available: true };
  core.configure('a', runtime, audio); core.command('play'); const old = core.intent!;
  core.observe({ generation: 1, identity: 'a', bridgeEpoch: old.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: old.epoch, state: 'playing', positionSec: 6, durationSec: 12 } }, 1);
  core.configure('a', runtime, audio, { inSec: 2, outSec: 10 });
  assert.equal(core.intent!.positionSec, 6); assert.equal(core.intent!.playing, true);
  assert.ok(core.intent!.bridgeEpoch > old.bridgeEpoch);
  core.configure('a', runtime, audio, { inSec: 2, outSec: 5 });
  assert.equal(core.intent!.positionSec, 5);
});
test('current epoch ended and error statuses pause Core once and retain actual position', () => {
  for (const state of ['ended', 'error'] as const) {
    const core = new PresentationMediaCore(); core.configure('a', { generation: 1, available: true }, audio); core.command('play');
    const before = core.intent!;
    const packet: MediaPacket = { generation: 1, identity: 'a', bridgeEpoch: before.bridgeEpoch, type: 'status', status: { identity: 'a', epoch: before.epoch, state, positionSec: 5, durationSec: 12 } };
    assert.equal(core.observe(packet, 1), true); assert.equal(core.intent!.playing, false); assert.equal(core.intent!.positionSec, 5);
    assert.ok(core.intent!.epoch > before.epoch); assert.equal(core.observe(packet, 1), false);
  }
});
