"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const protocol_1 = require("./modules/protocol");
const templates_1 = require("./modules/templates");
const runtime_1 = require("./modules/runtime");
const context = { sessionId: 'session', runId: 'run', instanceId: 'instance', occurrenceId: 'occurrence', episodeId: 'episode', adventureId: 'adventure', participantIds: ['a', 'b'] };
const envelope = { channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 2, requestId: 'request', context };
(0, node_test_1.default)('editor bridge accepts bounded catalogue requests and rejects file path authority', () => {
    const request = { ...envelope, type: 'editor-request', sequence: 1, operation: 'media-list' };
    strict_1.default.ok((0, protocol_1.parseModuleToHostMessage)(request));
    strict_1.default.equal((0, protocol_1.parseModuleToHostMessage)({ ...request, paths: ['C:/private.png'] }), null);
    strict_1.default.equal((0, protocol_1.parseModuleToHostMessage)({ ...request, operation: 'delete-assets' }), null);
    const response = { ...envelope, type: 'editor-response', ok: true, assets: [{ id: 'picture', name: 'Portrait', mediaType: 'image', url: 'media://scoped/grant' }] };
    strict_1.default.ok((0, protocol_1.parseHostToModuleMessage)(response));
    strict_1.default.equal((0, protocol_1.parseHostToModuleMessage)({ ...response, assets: [{ ...response.assets[0], mediaType: 'executable' }] }), null);
});
(0, node_test_1.default)('protocol rejects unknown fields, unsupported versions, transient configs and mismatched events', () => {
    const init = { ...envelope, type: 'initialize', configVersion: 1, config: (0, templates_1.createModuleTemplate)('language-snake'), configRevision: 0, mediaMap: {} };
    strict_1.default.ok((0, protocol_1.parseHostToModuleMessage)(init));
    strict_1.default.equal((0, protocol_1.parseHostToModuleMessage)({ ...init, version: 2 }), null);
    strict_1.default.equal((0, protocol_1.parseHostToModuleMessage)({ ...init, roster: [] }), null);
    const event = { version: 1, eventId: 'e', context, sequence: 1, type: 'score-reported', payload: { scores: [{ participantId: 'a', score: 2 }] } };
    strict_1.default.ok((0, protocol_1.parseModuleToHostMessage)({ ...envelope, type: 'event', sequence: 1, event }));
    strict_1.default.equal((0, protocol_1.parseModuleToHostMessage)({ ...envelope, type: 'event', sequence: 2, event }), null);
    strict_1.default.equal((0, protocol_1.parseActivityEvent)({ ...event, payload: { scores: [{ participantId: 'stranger', score: 3 }] } }), null);
});
(0, node_test_1.default)('lifecycle rejects invalid transitions and reset requires fresh run identity', () => {
    strict_1.default.equal((0, runtime_1.transitionLifecycle)('initialized', 'start', 'run', 'run'), 'running');
    strict_1.default.equal((0, runtime_1.transitionLifecycle)('running', 'pause', 'run', 'run'), 'paused');
    strict_1.default.throws(() => (0, runtime_1.transitionLifecycle)('initialized', 'resume', 'run', 'run'));
    strict_1.default.throws(() => (0, runtime_1.transitionLifecycle)('running', 'reset', 'run', 'run'));
    strict_1.default.equal((0, runtime_1.transitionLifecycle)('paused', 'reset', 'run', 'new'), 'initialized');
    strict_1.default.equal((0, runtime_1.transitionLifecycle)('disposed', 'dispose', 'run', 'run'), 'disposed');
    strict_1.default.throws(() => (0, runtime_1.transitionLifecycle)('disposed', 'start', 'run', 'run'));
});
(0, node_test_1.default)('event ledger captures run and participants, deduplicates identical payload, rejects collision/stale/order', () => {
    const event = { version: 1, eventId: 'event', context, sequence: 1, type: 'score-reported', payload: { scores: [{ participantId: 'a', score: 3 }] } };
    const original = (0, runtime_1.createEventLedger)(context, 'language-snake');
    const accepted = (0, runtime_1.acceptActivityEvent)(original, event);
    strict_1.default.equal(accepted.result.accepted, true);
    strict_1.default.equal(Object.keys(original.accepted).length, 0);
    const replay = (0, runtime_1.acceptActivityEvent)(accepted.ledger, structuredClone(event));
    strict_1.default.equal(replay.result.accepted, true);
    strict_1.default.equal(replay.result.duplicate, true);
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(accepted.ledger, { ...event, sequence: 5 }).result.duplicate, true);
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(accepted.ledger, { ...event, payload: { scores: [{ participantId: 'a', score: 4 }] } }).result.accepted, false);
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(accepted.ledger, { ...event, eventId: 'next' }).result.accepted, false);
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(accepted.ledger, { ...event, eventId: 'next', sequence: 2, context: { ...context, runId: 'stale' } }).result.accepted, false);
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(accepted.ledger, { ...event, eventId: 'next', sequence: 2, payload: { scores: [{ participantId: 'b', score: 6 }] } }).result.accepted, true);
});
(0, node_test_1.default)('module capability rejects scores from Activation and accepts captured completion only', () => {
    const ledger = (0, runtime_1.createEventLedger)(context, 'activation-cards');
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(ledger, { version: 1, eventId: 'score', context, sequence: 1, type: 'score-reported', payload: { scores: [{ participantId: 'a', score: 1 }] } }).result.accepted, false);
    strict_1.default.equal((0, runtime_1.acceptActivityEvent)(ledger, { version: 1, eventId: 'done', context, sequence: 1, type: 'activity-completed', payload: { participantIds: ['a', 'b'], outcome: 'completed' } }).result.accepted, true);
});
