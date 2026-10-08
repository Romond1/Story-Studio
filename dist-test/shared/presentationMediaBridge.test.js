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
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const model = __importStar(require("./presentationMedia"));
function fixture() {
    const sends = [], gates = [], attached = [], detached = [], pulls = [];
    class Peer {
        constructor() {
            this.connectionState = 'new';
        }
        close() { this.connectionState = 'closed'; }
    }
    class Stream {
        constructor(tracks) {
            this.tracks = tracks;
        }
        getTracks() { return this.tracks; }
    }
    class Audio {
        constructor() {
            this.muted = false;
            this.paused = false;
            pulls.push(this);
        }
        play() { return new Promise(r => { this.resolve = r; }); }
        pause() { this.paused = true; }
    }
    const context = { state: 'running', resume: async () => { } };
    const mixer = { attachExternalMediaStream: (...args) => attached.push(args), setExternalMediaEnabled: (...args) => gates.push(args), setExternalMediaVolume: () => { }, detachExternalMediaStream: (id) => detached.push(id), getContext: () => context };
    const exports = {};
    const source = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)(node_path_1.default.join(process.cwd(), 'src/renderer/presentationMediaBridge.ts'), 'utf8'), { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInNewContext(source, { exports, require: () => model, RTCPeerConnection: Peer, MediaStream: Stream, Audio, Promise });
    return { Receiver: exports.ControlMediaReceiver, sends, gates, attached, detached, pulls, mixer, context };
}
const intent = { identity: 'a', epoch: 1, bridgeEpoch: 1, rendererGeneration: 1, playing: true, positionSec: 0, volume: 0.5, enabled: true };
const flush = () => new Promise(resolve => setImmediate(resolve));
(0, node_test_1.default)('retired receiver cannot enable, reattach or signal after late decoder readiness', async () => {
    const f = fixture();
    let stopped = 0;
    const receiver = new f.Receiver(intent, f.mixer, (p) => f.sends.push(p), strict_1.default.fail);
    const ontrack = receiver.link.peer.ontrack;
    ontrack({ track: { stop: () => stopped++ } });
    strict_1.default.equal(f.attached.length, 1);
    strict_1.default.equal(f.pulls[0].muted, true);
    receiver.dispose();
    f.pulls[0].resolve();
    await flush();
    ontrack({ track: { stop: () => stopped++ } });
    strict_1.default.equal(f.attached.length, 1);
    strict_1.default.equal(f.detached.length, 1);
    strict_1.default.equal(stopped, 1);
    strict_1.default.equal(f.gates.some(g => g[1] === true), false);
    strict_1.default.equal(f.sends.length, 0);
    strict_1.default.equal(f.pulls[0].srcObject, null);
});
(0, node_test_1.default)('live receiver enables exactly its current intent after decoder and context readiness', async () => {
    const f = fixture();
    const receiver = new f.Receiver(intent, f.mixer, (p) => f.sends.push(p), strict_1.default.fail);
    receiver.link.peer.ontrack({ track: { stop() { } } });
    receiver.update({ ...intent, playing: false });
    f.pulls[0].resolve();
    await flush();
    strict_1.default.equal(f.gates.some(g => g[1] === true), false);
    strict_1.default.equal(f.sends[0].type, 'receiver-ready');
    receiver.update(intent);
    strict_1.default.equal(f.gates.at(-1)[1], true);
    receiver.dispose();
    strict_1.default.equal(f.gates.at(-1)[1], false);
});
(0, node_test_1.default)('suspended mixer cannot claim receiver readiness', async () => {
    const f = fixture();
    f.context.state = 'suspended';
    const failures = [];
    const receiver = new f.Receiver(intent, f.mixer, (p) => f.sends.push(p), (message) => failures.push(message));
    receiver.link.peer.ontrack({ track: { stop() { } } });
    f.pulls[0].resolve();
    await flush();
    strict_1.default.equal(f.sends.length, 0);
    strict_1.default.equal(f.gates.some(g => g[1] === true), false);
    strict_1.default.match(failures[0], /suspended/);
    receiver.dispose();
});
(0, node_test_1.default)('video preview arriving first never attaches a video track to the audio mixer', async () => {
    const f = fixture();
    const previews = [];
    const receiver = new f.Receiver(intent, f.mixer, (p) => f.sends.push(p), strict_1.default.fail, (s) => previews.push(s));
    let videoStops = 0, audioStops = 0;
    const video = { kind: 'video', stop() { videoStops++; } };
    const audio = { kind: 'audio', stop() { audioStops++; } };
    receiver.link.peer.ontrack({ track: video });
    strict_1.default.equal(f.attached.length, 0);
    strict_1.default.equal(previews[0].getTracks().length, 1);
    strict_1.default.equal(previews[0].getTracks()[0], video);
    receiver.link.peer.ontrack({ track: audio });
    strict_1.default.equal(f.attached[0][1].getTracks().length, 1);
    strict_1.default.equal(f.attached[0][1].getTracks()[0], audio);
    f.pulls[0].resolve();
    await flush();
    strict_1.default.equal(f.sends.filter(p => p.type === 'receiver-ready').length, 1);
    receiver.dispose();
    strict_1.default.equal(previews.at(-1), null);
    strict_1.default.equal(videoStops, 1);
    strict_1.default.equal(audioStops, 1);
});
(0, node_test_1.default)('audio first still accepts one passive video preview and retires both on teardown', async () => {
    const f = fixture();
    const previews = [];
    const receiver = new f.Receiver(intent, f.mixer, () => { }, strict_1.default.fail, (s) => previews.push(s));
    receiver.link.peer.ontrack({ track: { kind: 'audio', stop() { } } });
    receiver.link.peer.ontrack({ track: { kind: 'video', stop() { } } });
    strict_1.default.equal(f.attached.length, 1);
    strict_1.default.equal(previews.length, 1);
    const late = receiver.link.peer.ontrack;
    receiver.dispose();
    late({ track: { kind: 'video', stop() { } } });
    strict_1.default.equal(previews.length, 2);
    strict_1.default.equal(previews.at(-1), null);
});
