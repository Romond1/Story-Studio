"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleDefinitions = void 0;
exports.transitionLifecycle = transitionLifecycle;
exports.createEventLedger = createEventLedger;
exports.acceptActivityEvent = acceptActivityEvent;
exports.getModuleDefinition = getModuleDefinition;
const validation_1 = require("./validation");
const media_1 = require("./media");
const protocol_1 = require("./protocol");
function transitionLifecycle(state, command, runId, nextRunId) {
    if (command === 'dispose')
        return 'disposed';
    if (command === 'stop' && (state === 'stopped' || state === 'disposed'))
        return state;
    if (state === 'disposed')
        throw new Error('Module is disposed');
    if (command === 'stop')
        return 'stopped';
    if (command === 'reset') {
        if (!nextRunId || runId === nextRunId)
            throw new Error('Reset requires a new run identity');
        return 'initialized';
    }
    if (command === 'initialize' && state === 'initialized')
        return state;
    if (command === 'start' && state === 'initialized')
        return 'running';
    if (command === 'pause' && state === 'running')
        return 'paused';
    if (command === 'resume' && state === 'paused')
        return 'running';
    throw new Error(`Invalid module lifecycle ${state} → ${command}`);
}
function createEventLedger(context, moduleType) { return { context: JSON.parse(JSON.stringify(context)), moduleType, lastSequence: 0, accepted: {} }; }
function canonical(value) { if (Array.isArray(value))
    return `[${value.map(canonical).join(',')}]`; if (value && typeof value === 'object')
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`; return JSON.stringify(value); }
function acceptActivityEvent(ledger, value) {
    const reject = (reason) => ({ ledger, result: { accepted: false, reason } });
    const event = (0, protocol_1.parseActivityEvent)(value);
    if (!event)
        return reject('Invalid activity event');
    if (!(0, protocol_1.sameRunContext)(ledger.context, event.context))
        return reject('Stale run or participant scope');
    const key = JSON.stringify([event.context.adventureId, event.context.episodeId, event.context.runId, event.eventId]);
    const { sequence: _sequence, ...content } = event;
    const serialized = canonical(content);
    const old = ledger.accepted[key];
    if (old)
        return old.canonical === serialized ? { ledger, result: { ...old.result, duplicate: true } } : reject('Event identity payload collision');
    if (event.sequence <= ledger.lastSequence)
        return reject('Out-of-order event');
    if (ledger.moduleType === 'activation-cards' && event.type !== 'activity-completed')
        return reject('Module capability not declared');
    const result = { accepted: true };
    return { ledger: { ...ledger, lastSequence: event.sequence, accepted: { ...ledger.accepted, [key]: { canonical: serialized, result } } }, result };
}
exports.moduleDefinitions = Object.freeze({
    'hero-dash': { type: 'hero-dash', version: 1, configVersion: 1, supportedInputs: ['teacher-command'], rewardCapabilities: [] },
    'activation-cards': { type: 'activation-cards', version: 1, configVersion: 1, supportedInputs: ['pointer', 'teacher-command'], rewardCapabilities: ['report-completion'] },
    'language-snake': { type: 'language-snake', version: 1, configVersion: 1, supportedInputs: ['keyboard', 'pointer', 'teacher-command'], rewardCapabilities: ['report-score', 'report-completion', 'request-reward'] },
    'final-boss-hero': { type: 'final-boss-hero', version: 1, configVersion: 1, supportedInputs: ['keyboard', 'pointer', 'teacher-command'], rewardCapabilities: ['report-score', 'report-completion', 'request-reward'] }
});
/** Statically bundled typed definitions; adapters provide the runtime implementation. */
function getModuleDefinition(type) {
    return { ...exports.moduleDefinitions[type], parseConfig: (value) => (0, validation_1.parseModuleConfig)(type, value), collectAssets: (config) => (0, media_1.collectModuleAssets)({ id: 'definition', moduleType: type, moduleVersion: 1, configVersion: 1, config }) };
}
