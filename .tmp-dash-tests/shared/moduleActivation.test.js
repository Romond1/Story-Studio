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
const activation_1 = require("./modules/activation");
const context = { sessionId: 'session', runId: 'run', instanceId: 'activity', occurrenceId: 'occurrence', episodeId: 'episode', adventureId: 'adventure', participantIds: ['captured'] };
(0, node_test_1.default)('Activation references existing scenes and captures participants without an authored card store', () => {
    const scenes = ['scene-1', 'scene-2'];
    let run = (0, activation_1.initializeActivation)(scenes, context);
    scenes.push('changed');
    context.participantIds.push('later');
    strict_1.default.deepEqual(run.sceneIds, ['scene-1', 'scene-2']);
    strict_1.default.deepEqual(run.context.participantIds, ['captured']);
    run = (0, activation_1.commandActivation)(run, 'start');
    run = (0, activation_1.nextActivationScene)(run);
    strict_1.default.equal(run.sceneIds[run.index], 'scene-2');
    run = (0, activation_1.commandActivation)(run, 'pause');
    strict_1.default.throws(() => (0, activation_1.nextActivationScene)(run));
    run = (0, activation_1.commandActivation)(run, 'resume');
    const completed = (0, activation_1.completeActivation)(run, 'event');
    strict_1.default.equal(completed.run.state, 'stopped');
    strict_1.default.deepEqual(completed.event.payload, { participantIds: ['captured'], outcome: 'completed' });
    strict_1.default.throws(() => (0, activation_1.completeActivation)(completed.run, 'again'));
});
(0, node_test_1.default)('Activation reset creates a new run with the same captured participants and first scene', () => {
    let run = (0, activation_1.commandActivation)((0, activation_1.initializeActivation)(['one', 'two'], { ...context, participantIds: ['captured'] }), 'start');
    run = (0, activation_1.nextActivationScene)(run);
    strict_1.default.throws(() => (0, activation_1.commandActivation)(run, 'reset', run.context.runId));
    run = (0, activation_1.commandActivation)(run, 'reset', 'new-run');
    strict_1.default.equal(run.context.runId, 'new-run');
    strict_1.default.equal(run.state, 'initialized');
    strict_1.default.equal(run.index, 0);
    strict_1.default.deepEqual(run.context.participantIds, ['captured']);
});
(0, node_test_1.default)('Activation completion waits for durable acknowledgment and preserves retry event identity', async () => {
    const { completeActivationAsync } = await Promise.resolve().then(() => __importStar(require('./modules/activation')));
    const run = (0, activation_1.commandActivation)((0, activation_1.initializeActivation)(['one'], { ...context, participantIds: ['captured'] }), 'start');
    const ids = [];
    await strict_1.default.rejects(completeActivationAsync(run, 'stable-event', async (event) => { ids.push(event.eventId); throw Error('Lost acknowledgment'); }));
    strict_1.default.equal(run.state, 'running');
    const completed = await completeActivationAsync(run, 'stable-event', async (event) => { ids.push(event.eventId); return { accepted: true }; });
    strict_1.default.deepEqual(ids, ['stable-event', 'stable-event']);
    strict_1.default.equal(completed.run.state, 'stopped');
    await strict_1.default.rejects(completeActivationAsync(run, 'rejected', async () => ({ accepted: false, reason: 'No active run' })), /No active run/);
});
