import test from 'node:test';
import assert from 'node:assert/strict';
import { getGame, getGamesForSection, parseGameInput, parseGameSession } from './gameHost';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

test('only implemented games are selectable in their supported sections', () => {
  assert.deepEqual(getGamesForSection('game').map(game => game.id), ['language-snake']);
  assert.deepEqual(getGamesForSection('mastery').map(game => game.id), ['final-boss-hero']);
  assert.equal(getGame('chess'), undefined);
  assert.equal(getGame('language-snake')?.entry, 'language-snake.html');
  assert.equal(getGame('final-boss-hero')?.entry, 'final-boss-hero.html');
});

test('game sessions whitelist a registered identity instead of copied gameplay state', () => {
  assert.deepEqual(parseGameSession({ gameId: 'language-snake', instanceId: 'run', score: 8, src: 'https://other.test' }), { gameId: 'language-snake', instanceId: 'run' });
  assert.deepEqual(parseGameSession({ gameId: 'final-boss-hero', instanceId: 'boss-run', battleState: { hp: 0 }, src: 'https://other.test' }), { gameId: 'final-boss-hero', instanceId: 'boss-run' });
  for (const value of [null, {}, { gameId: 'unknown', instanceId: 'run' }, { gameId: 'language-snake', instanceId: '' }]) assert.equal(parseGameSession(value), null);
});

test('shift shortcuts retain their modifier through the existing input relay', () => {
  const packet = { instanceId: 'boss-run', key: 'M', code: 'KeyM', phase: 'keydown' as const, repeat: false, shiftKey: true };
  assert.deepEqual(parseGameInput(packet), packet);
  assert.equal(parseGameInput({ ...packet, shiftKey: 'true' }), null);
  assert.equal(parseGameInput({ ...packet, ctrlKey: true }), null);
});

test('input packets preserve custom letter controls and reject executable, malformed or browser keys', () => {
  const packet = { instanceId: 'run', key: 'j', code: 'KeyJ', phase: 'keydown', repeat: false };
  assert.deepEqual(parseGameInput({ ...packet, source: 'other' }), packet);
  assert.deepEqual(parseGameInput({ ...packet, key: 'ArrowLeft', code: 'ArrowLeft', phase: 'keyup' }), { ...packet, key: 'ArrowLeft', code: 'ArrowLeft', phase: 'keyup' });
  for (const changes of [{ instanceId: '' }, { key: 'BrowserBack' }, { key: '<script>' }, { code: 'KeyW;alert()' }, { phase: 'click' }, { repeat: 'false' }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) assert.equal(parseGameInput({ ...packet, ...changes }), null);
});

test('Present alone mounts a game and gates forwarded input on the matching iframe readiness', () => {
  const file = path.join(process.cwd(), 'src/renderer/games/PresentGame.tsx');
  assert.ok(existsSync(file), 'Present game owner is implemented');
  const hooks: any[] = [], effects: (() => (() => void) | void)[] = [], cleanups: (() => void)[] = [];
  let index = 0, inputListener: any;
  const listeners = new Map<string, any>(), applied: any[] = [], forwarded: any[] = [];
  const frameWindow = { postMessage: (...args: any[]) => forwarded.push(args) };
  const fakeReact = { ...require('react'),
    useRef: (value: any) => { const slot = index++; return hooks[slot] ??= { current: value }; },
    useState: (value: any) => { const slot = index++; if (!(slot in hooks)) hooks[slot] = value; return [hooks[slot], (next: any) => { hooks[slot] = next; }]; },
    useEffect: (effect: any, deps: any[]) => { const slot = index++; if (!hooks[slot] || deps.some((value, i) => value !== hooks[slot][i])) { hooks[slot] = deps; effects.push(effect); } },
  };
  const exports: any = {};
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, URL, console, window: { location: { href: 'http://localhost/present.html' }, setTimeout: () => 1, clearTimeout: () => {}, addEventListener: (kind: string, listener: any) => listeners.set(kind, listener), removeEventListener: (kind: string) => listeners.delete(kind) }, require: (name: string) => {
    if (name === 'react') return fakeReact;
    if (name === '../../shared/gameHost') return require('./gameHost');
    throw new Error(`Unexpected dependency ${name}`);
  } });
  const api = { subscribeGameInput: (listener: any) => { inputListener = listener; return () => { inputListener = null; }; } };
  const props = { api, target: { kind: 'game', gameId: 'language-snake', instanceId: 'run-1', occurrenceId: 'game:run-1' }, envelope: { generation: 2, sequence: 3 }, report: (...args: any[]) => applied.push(args) };
  const render = () => { index = 0; const tree = exports.PresentGame(props); const iframe = tree.props.children.find((child: any) => child?.type === 'iframe'); if (iframe) iframe.ref.current = { contentWindow: frameWindow }; while (effects.length) { const cleanup = effects.shift()!(); if (cleanup) cleanups.push(cleanup); } return iframe; };
  render(); const iframe = render();
  assert.equal(iframe.props.title, 'Language Snake');
  assert.equal(iframe.props['data-game-instance'], 'run-1');
  assert.equal(new URL(iframe.props.src).searchParams.get('instanceId'), 'run-1');
  assert.equal(iframe.props.style.width, '100%', 'render at native Present width without a fixed resolution cap');
  assert.equal(iframe.props.style.height, '100%');
  assert.equal(iframe.props.style.transform, undefined, 'avoid resampling the entire game through a CSS scale');
  assert.equal(applied.length, 0);
  const packet = { instanceId: 'run-1', key: 'w', code: 'KeyW', phase: 'keydown', repeat: false };
  inputListener(packet); assert.equal(forwarded.length, 0);
  const message = listeners.get('message');
  const ready = { channel: 'story-studio-game', type: 'ready', instanceId: 'run-1' };
  message({ source: {}, origin: 'http://localhost', data: ready });
  message({ source: frameWindow, origin: 'http://localhost', data: { ...ready, instanceId: 'retired-run' } });
  message({ source: frameWindow, origin: 'http://untrusted.test', data: ready });
  render(); assert.equal(applied.length, 0);
  message({ source: frameWindow, origin: 'http://localhost', data: ready }); render();
  assert.deepEqual(applied, [[2, 3, false, undefined]]);
  inputListener({ ...packet, instanceId: 'retired-run' }); assert.equal(forwarded.length, 0);
  inputListener(packet); assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0][0].type, 'input');
  assert.equal(forwarded[0][0].instanceId, 'run-1');
  cleanups.forEach(cleanup => cleanup());
  assert.equal(inputListener, null);
  assert.equal(listeners.has('message'), false);
});
