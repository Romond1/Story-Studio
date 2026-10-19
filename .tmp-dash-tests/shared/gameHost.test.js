"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const gameHost_1 = require("./gameHost");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
(0, node_test_1.default)('only implemented games are selectable in their supported sections', () => {
    strict_1.default.deepEqual((0, gameHost_1.getGamesForSection)('game').map(game => game.id), ['language-snake']);
    strict_1.default.deepEqual((0, gameHost_1.getGamesForSection)('mastery').map(game => game.id), ['final-boss-hero']);
    strict_1.default.equal((0, gameHost_1.getGame)('chess'), undefined);
    strict_1.default.equal((0, gameHost_1.getGame)('language-snake')?.entry, 'language-snake.html');
    strict_1.default.equal((0, gameHost_1.getGame)('final-boss-hero')?.entry, 'final-boss-hero.html');
});
(0, node_test_1.default)('game sessions whitelist a registered identity instead of copied gameplay state', () => {
    strict_1.default.deepEqual((0, gameHost_1.parseGameSession)({ gameId: 'language-snake', instanceId: 'run', score: 8, src: 'https://other.test' }), { gameId: 'language-snake', instanceId: 'run' });
    strict_1.default.deepEqual((0, gameHost_1.parseGameSession)({ gameId: 'final-boss-hero', instanceId: 'boss-run', battleState: { hp: 0 }, src: 'https://other.test' }), { gameId: 'final-boss-hero', instanceId: 'boss-run' });
    for (const value of [null, {}, { gameId: 'unknown', instanceId: 'run' }, { gameId: 'language-snake', instanceId: '' }])
        strict_1.default.equal((0, gameHost_1.parseGameSession)(value), null);
});
(0, node_test_1.default)('shift shortcuts retain their modifier through the existing input relay', () => {
    const packet = { instanceId: 'boss-run', key: 'M', code: 'KeyM', phase: 'keydown', repeat: false, shiftKey: true };
    strict_1.default.deepEqual((0, gameHost_1.parseGameInput)(packet), packet);
    strict_1.default.equal((0, gameHost_1.parseGameInput)({ ...packet, shiftKey: 'true' }), null);
    strict_1.default.equal((0, gameHost_1.parseGameInput)({ ...packet, ctrlKey: true }), null);
});
(0, node_test_1.default)('input packets preserve custom letter controls and reject executable, malformed or browser keys', () => {
    const packet = { instanceId: 'run', key: 'j', code: 'KeyJ', phase: 'keydown', repeat: false };
    strict_1.default.deepEqual((0, gameHost_1.parseGameInput)({ ...packet, source: 'other' }), packet);
    strict_1.default.deepEqual((0, gameHost_1.parseGameInput)({ ...packet, key: 'ArrowLeft', code: 'ArrowLeft', phase: 'keyup' }), { ...packet, key: 'ArrowLeft', code: 'ArrowLeft', phase: 'keyup' });
    for (const changes of [{ instanceId: '' }, { key: 'BrowserBack' }, { key: '<script>' }, { code: 'KeyW;alert()' }, { phase: 'click' }, { repeat: 'false' }, { ctrlKey: true }, { altKey: true }, { metaKey: true }])
        strict_1.default.equal((0, gameHost_1.parseGameInput)({ ...packet, ...changes }), null);
});
(0, node_test_1.default)('Present alone mounts a game and gates forwarded input on the matching iframe readiness', () => {
    const file = node_path_1.default.join(process.cwd(), 'src/renderer/games/PresentGame.tsx');
    strict_1.default.ok((0, node_fs_1.existsSync)(file), 'Present game owner is implemented');
    const hooks = [], effects = [], cleanups = [];
    let index = 0, inputListener;
    const listeners = new Map(), applied = [], forwarded = [];
    const frameWindow = { postMessage: (...args) => forwarded.push(args) };
    const fakeReact = { ...require('react'),
        useRef: (value) => { const slot = index++; return hooks[slot] ??= { current: value }; },
        useState: (value) => { const slot = index++; if (!(slot in hooks))
            hooks[slot] = value; return [hooks[slot], (next) => { hooks[slot] = next; }]; },
        useEffect: (effect, deps) => { const slot = index++; if (!hooks[slot] || deps.some((value, i) => value !== hooks[slot][i])) {
            hooks[slot] = deps;
            effects.push(effect);
        } },
    };
    const exports = {};
    const source = typescript_1.default.transpileModule((0, node_fs_1.readFileSync)(file, 'utf8'), { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021, jsx: typescript_1.default.JsxEmit.React, esModuleInterop: true } }).outputText;
    node_vm_1.default.runInNewContext(source, { exports, URL, console, window: { location: { href: 'http://localhost/present.html' }, setTimeout: () => 1, clearTimeout: () => { }, addEventListener: (kind, listener) => listeners.set(kind, listener), removeEventListener: (kind) => listeners.delete(kind) }, require: (name) => {
            if (name === 'react')
                return fakeReact;
            if (name === '../../shared/gameHost')
                return require('./gameHost');
            if (name === '../../shared/modules/protocol')
                return require('./modules/protocol');
            throw new Error(`Unexpected dependency ${name}`);
        } });
    const api = { subscribeGameInput: (listener) => { inputListener = listener; return () => { inputListener = null; }; } };
    const props = { api, target: { kind: 'game', gameId: 'language-snake', instanceId: 'run-1', occurrenceId: 'game:run-1' }, envelope: { generation: 2, sequence: 3 }, report: (...args) => applied.push(args) };
    const render = () => { index = 0; const tree = exports.PresentGame(props); const iframe = tree.props.children.find((child) => child?.type === 'iframe'); if (iframe)
        iframe.ref.current = { contentWindow: frameWindow }; while (effects.length) {
        const cleanup = effects.shift()();
        if (cleanup)
            cleanups.push(cleanup);
    } return iframe; };
    render();
    const iframe = render();
    strict_1.default.equal(iframe.props.title, 'Language Snake');
    strict_1.default.equal(iframe.props['data-game-instance'], 'run-1');
    strict_1.default.equal(new URL(iframe.props.src).searchParams.get('instanceId'), 'run-1');
    strict_1.default.equal(iframe.props.style.width, '100%', 'render at native Present width without a fixed resolution cap');
    strict_1.default.equal(iframe.props.style.height, '100%');
    strict_1.default.equal(iframe.props.style.transform, undefined, 'avoid resampling the entire game through a CSS scale');
    strict_1.default.equal(applied.length, 0);
    const packet = { instanceId: 'run-1', key: 'w', code: 'KeyW', phase: 'keydown', repeat: false };
    inputListener(packet);
    strict_1.default.equal(forwarded.length, 0);
    const message = listeners.get('message');
    const ready = { channel: 'story-studio-game', type: 'ready', instanceId: 'run-1' };
    message({ source: {}, origin: 'http://localhost', data: ready });
    message({ source: frameWindow, origin: 'http://localhost', data: { ...ready, instanceId: 'retired-run' } });
    message({ source: frameWindow, origin: 'http://untrusted.test', data: ready });
    render();
    strict_1.default.equal(applied.length, 0);
    message({ source: frameWindow, origin: 'http://localhost', data: ready });
    render();
    strict_1.default.deepEqual(applied, [[2, 3, false, undefined]]);
    inputListener({ ...packet, instanceId: 'retired-run' });
    strict_1.default.equal(forwarded.length, 0);
    inputListener(packet);
    strict_1.default.equal(forwarded.length, 1);
    strict_1.default.equal(forwarded[0][0].type, 'input');
    strict_1.default.equal(forwarded[0][0].instanceId, 'run-1');
    cleanups.forEach(cleanup => cleanup());
    strict_1.default.equal(inputListener, null);
    strict_1.default.equal(listeners.has('message'), false);
});
