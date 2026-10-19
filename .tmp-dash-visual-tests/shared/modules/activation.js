"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeActivation = initializeActivation;
exports.commandActivation = commandActivation;
exports.nextActivationScene = nextActivationScene;
exports.completeActivation = completeActivation;
exports.completeActivationAsync = completeActivationAsync;
const runtime_1 = require("./runtime");
const protocol_1 = require("./protocol");
function initializeActivation(sceneIds, context) {
    (0, protocol_1.validateRunContext)(context, 'context');
    if (new Set(context.participantIds).size !== context.participantIds.length)
        throw new Error('Duplicate participants');
    if (!sceneIds.length || new Set(sceneIds).size !== sceneIds.length)
        throw new Error('Choose at least one existing Activation scene');
    const captured = JSON.parse(JSON.stringify(context));
    return { sceneIds: [...sceneIds], index: 0, context: captured, state: 'initialized', ledger: (0, runtime_1.createEventLedger)(captured, 'activation-cards') };
}
function commandActivation(run, command, nextRunId = run.context.runId) {
    const state = (0, runtime_1.transitionLifecycle)(run.state, command, run.context.runId, nextRunId);
    if (command === 'reset') {
        const context = { ...run.context, runId: nextRunId };
        return { ...run, state, index: 0, context, ledger: (0, runtime_1.createEventLedger)(context, 'activation-cards') };
    }
    return { ...run, state };
}
function nextActivationScene(run) { if (run.state !== 'running')
    throw new Error('Activation is not running'); return { ...run, index: Math.min(run.sceneIds.length - 1, run.index + 1) }; }
function completeActivation(run, eventId) {
    if (run.state !== 'running')
        throw new Error('Activation is not running');
    const event = { version: 1, eventId, context: JSON.parse(JSON.stringify(run.context)), sequence: run.ledger.lastSequence + 1, type: 'activity-completed', payload: { participantIds: [...run.context.participantIds], outcome: 'completed' } };
    const accepted = (0, runtime_1.acceptActivityEvent)(run.ledger, event);
    if (!accepted.result.accepted)
        throw new Error(accepted.result.reason);
    return { run: { ...commandActivation(run, 'stop'), ledger: accepted.ledger }, event };
}
async function completeActivationAsync(run, eventId, emit) {
    const completion = completeActivation(run, eventId);
    const result = await emit?.(completion.event);
    if (result && !result.accepted)
        throw Error(result.reason ?? 'Activation completion was rejected');
    return completion;
}
