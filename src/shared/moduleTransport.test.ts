import test from 'node:test';
import assert from 'node:assert/strict';
import { ModuleTransport } from '../main/moduleTransport';
import { createModuleTemplate } from './modules/validation';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as protocol from './modules/protocol';
import * as runtimeFunctions from './modules/runtime';
import * as moduleMedia from './modules/media';
import * as episodeCommands from './episode/commands';

async function hostedHookHarness() {
  let listener: (message: unknown) => void = () => {}, serial = 0;
  const sent: any[] = [];
  const effects: (() => unknown)[] = [], refs: any[] = [], states: unknown[] = [];
  let refIndex = 0, stateIndex = 0;
  const react = {
    useRef(value: unknown) { const index = refIndex++; return refs[index] ?? (refs[index] = { current: value }); },
    useState(value: unknown) { const index = stateIndex++; if (!(index in states)) states[index] = value; return [states[index], (next: unknown) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
    useEffect(effect: () => unknown) { if (!effects.length) effects.push(effect); },
  };
  const modules: Record<string, unknown> = { react, '../../shared/modules/protocol': protocol, '../../shared/modules/runtime': runtimeFunctions, '../../shared/modules/media': moduleMedia, '../../shared/episode/commands': episodeCommands };
  const context: any = { exports: {}, require: (id: string) => modules[id], setTimeout, clearTimeout, crypto: { randomUUID: () => `id-${++serial}` }, window: { appApi: { progression: {}, onModuleEvent: (callback: typeof listener) => { listener = callback; return () => {}; }, getPresentMediaRuntime: async () => ({ generation: 2 }), sendModuleHost: async (message: unknown) => { sent.push(message); return true; } } } };
  const code = ts.transpileModule(readFileSync('src/renderer/episode/useEpisodeModuleHost.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(code, context);
  const render = () => { refIndex = 0; stateIndex = 0; return context.exports.useEpisodeModuleHost(() => null, () => {}); };
  const hook = render(); effects[0]();
  const runContext = { sessionId: 's', runId: 'r', instanceId: 'i', occurrenceId: 'o', episodeId: 'e', adventureId: 'a', participantIds: ['p'] };
  await hook.initialize({ id: 'activity', moduleType: 'language-snake', moduleVersion: 1, configVersion: 1, config: createModuleTemplate('language-snake') }, runContext, () => undefined);
  return { hook, render, runContext, sent, api: context.window.appApi, receive: (value: unknown) => listener(value) };
}

test('fatal hosted errors reject pending Save and retire the run so a teacher can recover', async () => {
  const {hook, render, runContext, receive} = await hostedHookHarness();
  assert.equal(render().isActive, true);
  const saving = hook.flush();
  const rejected = assert.rejects(saving, /adapter failed/);
  receive({ channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 2, requestId: 'error', context: runContext, sequence: 1, type: 'error', message: 'adapter failed' });
  await rejected;
  assert.equal(render().isActive, false); assert.equal(render().state, 'error');
  await render().flush();
});

test('hosted completion acknowledgment waits for durable Core acceptance and reports write failure', async () => {
  const h = await hostedHookHarness(); let complete!: (value: unknown) => void;
  h.api.progression.recordEvent = () => new Promise(resolve => { complete = resolve; });
  const message = { channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 2, requestId: 'completion', context: h.runContext, sequence: 1, type: 'event', event: { version: 1, eventId: 'completion', context: h.runContext, sequence: 1, type: 'activity-completed', payload: { participantIds: ['p'], outcome: 'completed' } } };
  h.receive(message); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.sent.some(message => message.type === 'event-ack'), false); assert.equal(h.render().events.length, 0);
  complete({ accepted: true, revision: 2 }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.sent[h.sent.length - 1].accepted, true); assert.equal(h.render().events.length, 1);
  h.api.progression.recordEvent = async () => { throw Error('disk write failed'); };
  h.receive({ ...message, requestId: 'next', sequence: 2, event: { ...message.event, eventId: 'next', sequence: 2 } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.sent[h.sent.length - 1].accepted, false); assert.equal(h.render().events.length, 1); assert.match(h.render().error, /disk write failed/);
});

test('module transport rejects stale generations, mismatched runs and repeated renderer sequence', () => {
  const context = { sessionId:'s',runId:'r',instanceId:'i',occurrenceId:'o',episodeId:'e',adventureId:'a',participantIds:['p'] };
  let runtime = {generation:2,available:true,instanceId:'i',moduleType:'language-snake'};
  const toPresent: unknown[] = [], toControl: unknown[] = [];
  const bridge = new ModuleTransport(()=>runtime, message=>toPresent.push(message),message=>toControl.push(message));
  const init = {channel:'story-studio-module',version:1,moduleType:'language-snake',moduleVersion:1,hostGeneration:2,requestId:'init',context,type:'initialize',configVersion:1,config:createModuleTemplate('language-snake'),configRevision:0,mediaMap:{}};
  assert.equal(bridge.send({...init,hostGeneration:1}),false);
  assert.equal(bridge.send(init),true);
  assert.ok(bridge.get('i')); assert.equal(bridge.get('other'),null);
  const ready = {...init,type:'ready',sequence:1};
  delete (ready as any).config; delete (ready as any).configVersion; delete (ready as any).configRevision; delete (ready as any).mediaMap;
  assert.equal(bridge.receive({...ready,context:{...context,runId:'old'}}),false);
  assert.equal(bridge.receive(ready),true); assert.equal(bridge.receive(ready),false);
  assert.equal(toControl.length,1);
  const event = { ...ready, type: 'event', sequence: 2, event: { version:1,eventId:'result',context,sequence:2,type:'activity-completed',payload:{participantIds:['p'],outcome:'completed'} } };
  assert.equal(bridge.receive(event),false,'Results require an acknowledged start');
  const base = {channel:init.channel,version:1,moduleType:init.moduleType,moduleVersion:1,hostGeneration:2,context};
  assert.equal(bridge.send({...base,requestId:'start',type:'start'}),true);
  assert.equal(bridge.receive({...base,requestId:'unsolicited',type:'ack',command:'start',sequence:2}),false);
  assert.equal(bridge.receive({...base,requestId:'start',type:'ack',command:'start',sequence:2}),true);
  assert.equal(bridge.receive({...event,sequence:3,event:{...event.event,sequence:3}}),true);
  assert.equal(bridge.send({...base,requestId:'pause',type:'pause'}),true);
  assert.equal(bridge.receive({...event,sequence:4,event:{...event.event,sequence:4}}),false,'Pause fences results before its acknowledgment');
  runtime = {...runtime,generation:3};
  assert.equal(bridge.receive({...ready,sequence:2}),false); assert.equal(bridge.get('i'),null);
  bridge.clear(); assert.equal(bridge.receive({...ready,hostGeneration:3,sequence:3}),false);
});
