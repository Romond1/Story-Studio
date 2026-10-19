"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRunContext = void 0;
exports.sameRunContext = sameRunContext;
exports.parseActivityEvent = parseActivityEvent;
exports.parseHostToModuleMessage = parseHostToModuleMessage;
exports.parseModuleToHostMessage = parseModuleToHostMessage;
const checks_1 = require("./checks");
const validation_1 = require("./validation");
const literal = (expected) => (v, p) => { if (v !== expected)
    (0, checks_1.fail)(p); };
exports.validateRunContext = (0, checks_1.shape)({ sessionId: checks_1.identity, runId: checks_1.identity, instanceId: checks_1.identity, occurrenceId: checks_1.identity, episodeId: checks_1.identity, adventureId: checks_1.identity, participantIds: (0, checks_1.arr)(checks_1.identity, 0, 1000) });
function sameRunContext(a, b) { return ['sessionId', 'runId', 'instanceId', 'occurrenceId', 'episodeId', 'adventureId'].every(key => a[key] === b[key]) && a.participantIds.length === b.participantIds.length && a.participantIds.every((id, i) => id === b.participantIds[i]); }
function parseActivityEvent(value) {
    try {
        if (!(0, checks_1.obj)(value))
            return null;
        const payloads = {
            'activity-completed': (0, checks_1.shape)({ participantIds: (0, checks_1.arr)(checks_1.identity, 1, 1000), outcome: (0, checks_1.one)(['completed', 'won', 'lost', 'draw']) }),
            'score-reported': (0, checks_1.shape)({ scores: (0, checks_1.arr)((0, checks_1.shape)({ participantId: checks_1.identity, score: (0, checks_1.num)(-1000000000, 1000000000) }), 1, 1000) }),
            'reward-requested': (0, checks_1.shape)({ requests: (0, checks_1.arr)((0, checks_1.shape)({ participantId: checks_1.identity, rewardId: checks_1.identity, quantity: (0, checks_1.num)(1, 100000, true) }), 1, 1000) })
        };
        if (!Object.hasOwnProperty.call(payloads, value.type))
            return null;
        (0, checks_1.shape)({ version: literal(1), eventId: checks_1.identity, context: exports.validateRunContext, sequence: (0, checks_1.num)(1, Number.MAX_SAFE_INTEGER, true), type: (0, checks_1.one)(Object.keys(payloads)), payload: payloads[value.type] })(value, 'event');
        (0, checks_1.unique)(value.context.participantIds, 'context participants');
        const participants = value.type === 'activity-completed' ? value.payload.participantIds : value.type === 'score-reported' ? value.payload.scores.map((x) => x.participantId) : value.payload.requests.map((x) => x.participantId);
        if (participants.some(id => !value.context.participantIds.includes(id)))
            return null;
        if (value.type !== 'reward-requested')
            (0, checks_1.unique)(participants, 'event participants');
        else
            (0, checks_1.unique)(value.payload.requests.map((x) => `${x.participantId}\0${x.rewardId}`), 'reward requests');
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return null;
    }
}
const envelope = { channel: literal('story-studio-module'), version: literal(1), moduleType: (0, checks_1.one)(['activation-cards', 'language-snake', 'final-boss-hero']), moduleVersion: literal(1), hostGeneration: (0, checks_1.num)(0, Number.MAX_SAFE_INTEGER, true), requestId: checks_1.identity, context: exports.validateRunContext };
const lifecycle = ['initialize', 'start', 'pause', 'resume', 'reset', 'stop', 'dispose'];
function parseHostToModuleMessage(value) {
    try {
        if (!(0, checks_1.obj)(value))
            return null;
        let extra = {}, optional = {};
        if (value.type === 'initialize')
            extra = { configVersion: literal(1), config: () => { }, configRevision: (0, checks_1.num)(0, Number.MAX_SAFE_INTEGER, true), mediaMap: (0, checks_1.record)(checks_1.str) };
        else if (value.type === 'inventory-response')
            extra = { inventory: (0, checks_1.arr)((0, checks_1.shape)({ participantId: checks_1.identity, rewards: (0, checks_1.arr)((0, checks_1.shape)({ rewardId: checks_1.identity, quantity: (0, checks_1.num)(0, 1000000000, true) })) }), 0, 1000) };
        else if (value.type === 'config-ack') {
            extra = { accepted: checks_1.bool, configRevision: (0, checks_1.num)(0, Number.MAX_SAFE_INTEGER, true) };
            optional = { reason: checks_1.str };
        }
        else if (value.type === 'event-ack') {
            extra = { eventId: checks_1.identity, accepted: checks_1.bool };
            optional = { reason: checks_1.str };
        }
        else if (value.type !== 'config-request' && !lifecycle.slice(1).includes(value.type))
            return null;
        (0, checks_1.shape)({ ...envelope, type: literal(value.type), ...extra }, optional)(value, 'message');
        (0, checks_1.unique)(value.context.participantIds, 'participants');
        if (value.type === 'inventory-response') {
            (0, checks_1.unique)(value.inventory.map((row) => row.participantId), 'inventory participants');
            for (const row of value.inventory) {
                if (!value.context.participantIds.includes(row.participantId))
                    return null;
                (0, checks_1.unique)(row.rewards.map((reward) => reward.rewardId), 'inventory rewards');
            }
        }
        if (value.type === 'initialize')
            (0, validation_1.parseModuleConfig)(value.moduleType, value.config);
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return null;
    }
}
function parseModuleToHostMessage(value) {
    try {
        if (!(0, checks_1.obj)(value))
            return null;
        let extra;
        switch (value.type) {
            case 'inventory-request':
            case 'ready':
                extra = {};
                break;
            case 'ack':
                extra = { command: (0, checks_1.one)(lifecycle) };
                break;
            case 'error':
                extra = { message: checks_1.str };
                break;
            case 'config-proposal':
                extra = { expectedRevision: (0, checks_1.num)(0, Number.MAX_SAFE_INTEGER, true), configVersion: literal(1), config: () => { } };
                break;
            case 'event':
                extra = { event: () => { } };
                break;
            default: return null;
        }
        (0, checks_1.shape)({ ...envelope, type: literal(value.type), sequence: (0, checks_1.num)(1, Number.MAX_SAFE_INTEGER, true), ...extra })(value, 'message');
        (0, checks_1.unique)(value.context.participantIds, 'participants');
        if (value.type === 'config-proposal')
            (0, validation_1.parseModuleConfig)(value.moduleType, value.config);
        if (value.type === 'event') {
            const event = parseActivityEvent(value.event);
            if (!event || !sameRunContext(event.context, value.context) || event.sequence !== value.sequence)
                return null;
        }
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return null;
    }
}
