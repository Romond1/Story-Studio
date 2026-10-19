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
const moduleTransport_1 = require("../main/moduleTransport");
const validation_1 = require("./modules/validation");
const node_fs_1 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const protocol = __importStar(require("./modules/protocol"));
const runtimeFunctions = __importStar(require("./modules/runtime"));
const moduleMedia = __importStar(require("./modules/media"));
const episodeCommands = __importStar(require("./episode/commands"));
async function hostedHookHarness() {
    let listener = () => { }, serial = 0;
    const sent = [];
    const effects = [], refs = [], states = [];
    let refIndex = 0, stateIndex = 0;
    const react = {
        useRef(value) { const index = refIndex++; return refs[index] ?? (refs[index] = { current: value }); },
        useState(value) { const index = stateIndex++; if (!(index in states))
            states[index] = value; return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
        useEffect(effect) { if (!effects.length)
            effects.push(effect); },
    };
    const modules = { react, '../../shared/modules/protocol': protocol, '../../shared/modules/runtime': runtimeFunctions, '../../shared/modules/media': moduleMedia, '../../shared/episode/commands': episodeCommands };
    const context = { exports: {}, require: (id) => modules[id], setTimeout, clearTimeout, crypto: { randomUUID: () => `id-${++serial}` }, window: { appApi: { progression: {}, onModuleEvent: (callback) => { listener = callback; return () => { }; }, getPresentMediaRuntime: async () => ({ generation: 2 }), sendModuleHost: async (message) => { sent.push(message); return true; } } } };
    const code = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)('src/renderer/episode/useEpisodeModuleHost.ts', 'utf8'), { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInNewContext(code, context);
    const render = () => { refIndex = 0; stateIndex = 0; return context.exports.useEpisodeModuleHost(() => null, () => { }); };
    const hook = render();
    effects[0]();
    const runContext = { sessionId: 's', runId: 'r', instanceId: 'i', occurrenceId: 'o', episodeId: 'e', adventureId: 'a', participantIds: ['p'] };
    await hook.initialize({ id: 'activity', moduleType: 'language-snake', moduleVersion: 1, configVersion: 1, config: (0, validation_1.createModuleTemplate)('language-snake') }, runContext, () => undefined);
    return { hook, render, runContext, sent, api: context.window.appApi, receive: (value) => listener(value) };
}
(0, node_test_1.default)('fatal hosted errors reject pending Save and retire the run so a teacher can recover', async () => {
    const { hook, render, runContext, receive } = await hostedHookHarness();
    strict_1.default.equal(render().isActive, true);
    const saving = hook.flush();
    const rejected = strict_1.default.rejects(saving, /adapter failed/);
    receive({ channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 2, requestId: 'error', context: runContext, sequence: 1, type: 'error', message: 'adapter failed' });
    await rejected;
    strict_1.default.equal(render().isActive, false);
    strict_1.default.equal(render().state, 'error');
    await render().flush();
});
(0, node_test_1.default)('hosted completion acknowledgment waits for durable Core acceptance and reports write failure', async () => {
    const h = await hostedHookHarness();
    let complete;
    h.api.progression.recordEvent = () => new Promise(resolve => { complete = resolve; });
    const message = { channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 2, requestId: 'completion', context: h.runContext, sequence: 1, type: 'event', event: { version: 1, eventId: 'completion', context: h.runContext, sequence: 1, type: 'activity-completed', payload: { participantIds: ['p'], outcome: 'completed' } } };
    h.receive(message);
    await new Promise(resolve => setImmediate(resolve));
    strict_1.default.equal(h.sent.some(message => message.type === 'event-ack'), false);
    strict_1.default.equal(h.render().events.length, 0);
    complete({ accepted: true, revision: 2 });
    await new Promise(resolve => setImmediate(resolve));
    strict_1.default.equal(h.sent[h.sent.length - 1].accepted, true);
    strict_1.default.equal(h.render().events.length, 1);
    h.api.progression.recordEvent = async () => { throw Error('disk write failed'); };
    h.receive({ ...message, requestId: 'next', sequence: 2, event: { ...message.event, eventId: 'next', sequence: 2 } });
    await new Promise(resolve => setImmediate(resolve));
    strict_1.default.equal(h.sent[h.sent.length - 1].accepted, false);
    strict_1.default.equal(h.render().events.length, 1);
    strict_1.default.match(h.render().error, /disk write failed/);
});
(0, node_test_1.default)('module transport rejects stale generations, mismatched runs and repeated renderer sequence', () => {
    const context = { sessionId: 's', runId: 'r', instanceId: 'i', occurrenceId: 'o', episodeId: 'e', adventureId: 'a', participantIds: ['p'] };
    let runtime = { generation: 2, available: true, instanceId: 'i', moduleType: 'language-snake' };
    const toPresent = [], toControl = [];
    const bridge = new moduleTransport_1.ModuleTransport(() => runtime, message => toPresent.push(message), message => toControl.push(message));
    const init = { channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 2, requestId: 'init', context, type: 'initialize', configVersion: 1, config: (0, validation_1.createModuleTemplate)('language-snake'), configRevision: 0, mediaMap: {} };
    strict_1.default.equal(bridge.send({ ...init, hostGeneration: 1 }), false);
    strict_1.default.equal(bridge.send(init), true);
    strict_1.default.ok(bridge.get('i'));
    strict_1.default.equal(bridge.get('other'), null);
    const ready = { ...init, type: 'ready', sequence: 1 };
    delete ready.config;
    delete ready.configVersion;
    delete ready.configRevision;
    delete ready.mediaMap;
    strict_1.default.equal(bridge.receive({ ...ready, context: { ...context, runId: 'old' } }), false);
    strict_1.default.equal(bridge.receive(ready), true);
    strict_1.default.equal(bridge.receive(ready), false);
    strict_1.default.equal(toControl.length, 1);
    const event = { ...ready, type: 'event', sequence: 2, event: { version: 1, eventId: 'result', context, sequence: 2, type: 'activity-completed', payload: { participantIds: ['p'], outcome: 'completed' } } };
    strict_1.default.equal(bridge.receive(event), false, 'Results require an acknowledged start');
    const base = { channel: init.channel, version: 1, moduleType: init.moduleType, moduleVersion: 1, hostGeneration: 2, context };
    strict_1.default.equal(bridge.send({ ...base, requestId: 'start', type: 'start' }), true);
    strict_1.default.equal(bridge.receive({ ...base, requestId: 'unsolicited', type: 'ack', command: 'start', sequence: 2 }), false);
    strict_1.default.equal(bridge.receive({ ...base, requestId: 'start', type: 'ack', command: 'start', sequence: 2 }), true);
    strict_1.default.equal(bridge.receive({ ...event, sequence: 3, event: { ...event.event, sequence: 3 } }), true);
    strict_1.default.equal(bridge.send({ ...base, requestId: 'pause', type: 'pause' }), true);
    strict_1.default.equal(bridge.receive({ ...event, sequence: 4, event: { ...event.event, sequence: 4 } }), false, 'Pause fences results before its acknowledgment');
    runtime = { ...runtime, generation: 3 };
    strict_1.default.equal(bridge.receive({ ...ready, sequence: 2 }), false);
    strict_1.default.equal(bridge.get('i'), null);
    bridge.clear();
    strict_1.default.equal(bridge.receive({ ...ready, hostGeneration: 3, sequence: 3 }), false);
});
