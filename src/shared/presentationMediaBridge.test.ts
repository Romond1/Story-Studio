import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from './presentationMedia';

function fixture() {
  const sends: any[] = [], gates: any[] = [], attached: any[] = [], detached: string[] = [], pulls: any[] = [];
  class Peer { ontrack: any; onicecandidate: any; onconnectionstatechange: any; connectionState = 'new'; close() { this.connectionState = 'closed'; } }
  class Stream { constructor(public tracks: any[]) {} getTracks() { return this.tracks; } }
  class Audio { muted = false; srcObject: any; resolve!: () => void; paused = false; constructor() { pulls.push(this); } play() { return new Promise<void>(r => { this.resolve = r; }); } pause() { this.paused = true; } }
  const context = { state: 'running', resume: async () => {} };
  const mixer = { attachExternalMediaStream: (...args: any[]) => attached.push(args), setExternalMediaEnabled: (...args: any[]) => gates.push(args), setExternalMediaVolume: () => {}, detachExternalMediaStream: (id: string) => detached.push(id), getContext: () => context };
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(path.join(process.cwd(), 'src/renderer/presentationMediaBridge.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(source, { exports, require: () => model, RTCPeerConnection: Peer, MediaStream: Stream, Audio, Promise });
  return { Receiver: exports.ControlMediaReceiver, sends, gates, attached, detached, pulls, mixer, context };
}
const intent: model.MediaIntent = { identity: 'a', epoch: 1, bridgeEpoch: 1, rendererGeneration: 1, playing: true, positionSec: 0, volume: 0.5, enabled: true };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
test('retired receiver cannot enable, reattach or signal after late decoder readiness', async () => {
  const f = fixture(); let stopped = 0;
  const receiver = new f.Receiver(intent, f.mixer, (p: unknown) => f.sends.push(p), assert.fail);
  const ontrack = receiver.link.peer.ontrack;
  ontrack({ track: { stop: () => stopped++ } });
  assert.equal(f.attached.length, 1); assert.equal(f.pulls[0].muted, true);
  receiver.dispose(); f.pulls[0].resolve(); await flush();
  ontrack({ track: { stop: () => stopped++ } });
  assert.equal(f.attached.length, 1); assert.equal(f.detached.length, 1); assert.equal(stopped, 1);
  assert.equal(f.gates.some(g => g[1] === true), false); assert.equal(f.sends.length, 0);
  assert.equal(f.pulls[0].srcObject, null);
});
test('live receiver enables exactly its current intent after decoder and context readiness', async () => {
  const f = fixture();
  const receiver = new f.Receiver(intent, f.mixer, (p: unknown) => f.sends.push(p), assert.fail);
  receiver.link.peer.ontrack({ track: { stop() {} } });
  receiver.update({ ...intent, playing: false }); f.pulls[0].resolve(); await flush();
  assert.equal(f.gates.some(g => g[1] === true), false);
  assert.equal(f.sends[0].type, 'receiver-ready');
  receiver.update(intent); assert.equal(f.gates.at(-1)[1], true);
  receiver.dispose(); assert.equal(f.gates.at(-1)[1], false);
});
test('suspended mixer cannot claim receiver readiness', async () => {
  const f = fixture(); f.context.state = 'suspended'; const failures: string[] = [];
  const receiver = new f.Receiver(intent, f.mixer, (p: unknown) => f.sends.push(p), (message: string) => failures.push(message));
  receiver.link.peer.ontrack({ track: { stop() {} } }); f.pulls[0].resolve(); await flush();
  assert.equal(f.sends.length, 0); assert.equal(f.gates.some(g => g[1] === true), false); assert.match(failures[0], /suspended/);
  receiver.dispose();
});

test('video preview arriving first never attaches a video track to the audio mixer', async () => {
  const f = fixture(); const previews: any[] = [];
  const receiver = new f.Receiver(intent, f.mixer, (p: unknown) => f.sends.push(p), assert.fail, (s: unknown) => previews.push(s));
  let videoStops = 0, audioStops = 0;
  const video = { kind: 'video', stop() { videoStops++; } };
  const audio = { kind: 'audio', stop() { audioStops++; } };
  receiver.link.peer.ontrack({ track: video });
  assert.equal(f.attached.length, 0);
  assert.equal(previews[0].getTracks().length, 1); assert.equal(previews[0].getTracks()[0], video);
  receiver.link.peer.ontrack({ track: audio });
  assert.equal(f.attached[0][1].getTracks().length, 1); assert.equal(f.attached[0][1].getTracks()[0], audio);
  f.pulls[0].resolve(); await flush();
  assert.equal(f.sends.filter(p => p.type === 'receiver-ready').length, 1);
  receiver.dispose();
  assert.equal(previews.at(-1), null);
  assert.equal(videoStops, 1); assert.equal(audioStops, 1);
});

test('audio first still accepts one passive video preview and retires both on teardown', async () => {
  const f = fixture(); const previews: any[] = [];
  const receiver = new f.Receiver(intent, f.mixer, () => {}, assert.fail, (s: unknown) => previews.push(s));
  receiver.link.peer.ontrack({ track: { kind: 'audio', stop() {} } });
  receiver.link.peer.ontrack({ track: { kind: 'video', stop() {} } });
  assert.equal(f.attached.length, 1); assert.equal(previews.length, 1);
  const late = receiver.link.peer.ontrack; receiver.dispose();
  late({ track: { kind: 'video', stop() {} } });
  assert.equal(previews.length, 2); assert.equal(previews.at(-1), null);
});
