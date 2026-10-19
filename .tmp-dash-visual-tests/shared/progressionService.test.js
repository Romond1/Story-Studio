"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const progressionRepository_1 = require("../main/progressionRepository");
const progressionService_1 = require("../main/progressionService");
const context = { sessionId: 'session', runId: 'run', instanceId: 'instance', occurrenceId: 'occurrence', episodeId: 'episode', adventureId: 'adventure', participantIds: ['student'] };
const roster = [{ id: 'student', name: 'Student', archived: false, createdAt: 'now', updatedAt: 'now' }];
(0, node_test_1.default)('only observed running transport events persist; saved receipt replay survives restart', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-authority-'));
    try {
        const repository = new progressionRepository_1.ProgressionRepository(node_path_1.default.join(root, 'store.json'));
        const host = { getScope: () => ({ folderPath: 'project', episodeId: 'episode', adventureId: 'adventure', leaseId: 'lease' }), getRoster: async () => roster };
        const service = new progressionService_1.ProgressionService(repository, host);
        const registered = await service.registerRun({ expectedFolder: 'project', activityId: 'activity', moduleType: 'language-snake', context });
        strict_1.default.equal(registered.accepted, true);
        const event = { version: 1, eventId: 'complete', context, sequence: 2, type: 'activity-completed', payload: { participantIds: ['student'], outcome: 'won' } };
        await strict_1.default.rejects(service.recordEvent(event), /observed|authorized/i);
        const envelope = { channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 1, requestId: 'request', context };
        strict_1.default.equal(service.authorizeInitialize({ ...envelope, type: 'initialize' }), true);
        service.hostCommand({ ...envelope, type: 'initialize' });
        service.acceptedModule({ ...envelope, type: 'ack', command: 'start', sequence: 1 });
        service.acceptedModule({ ...envelope, type: 'event', sequence: 2, event });
        service.acceptedModule({ ...envelope, type: 'event', sequence: 3, event: { ...event, sequence: 3, payload: { ...event.payload, outcome: 'lost' } } });
        service.retire(context.instanceId);
        strict_1.default.equal((await service.recordEvent(event)).accepted, true);
        const postStop = { ...event, eventId: 'post-stop', sequence: 4 };
        service.acceptedModule({ ...envelope, type: 'event', sequence: 4, event: postStop });
        await strict_1.default.rejects(service.recordEvent(postStop), /observed/);
        const restarted = new progressionService_1.ProgressionService(new progressionRepository_1.ProgressionRepository(node_path_1.default.join(root, 'store.json')), host);
        strict_1.default.equal((await restarted.recordEvent(event)).duplicate, true);
        strict_1.default.equal((await restarted.recordEvent({ ...event, payload: { ...event.payload, outcome: 'lost' } })).accepted, false);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('stale registration scopes and unregistered initialization are rejected', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-scope-'));
    try {
        const service = new progressionService_1.ProgressionService(new progressionRepository_1.ProgressionRepository(node_path_1.default.join(root, 'store.json')), { getScope: () => ({ folderPath: 'project', episodeId: 'episode', adventureId: 'adventure', leaseId: 'lease' }), getRoster: async () => roster });
        await strict_1.default.rejects(service.registerRun({ expectedFolder: 'old', activityId: 'activity', moduleType: 'language-snake', context }), /changed|scope/i);
        strict_1.default.equal(service.authorizeInitialize({ context, moduleType: 'language-snake' }), false);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Activation completion captures participants and another registered run reads approved inventory only', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-activation-'));
    try {
        const service = new progressionService_1.ProgressionService(new progressionRepository_1.ProgressionRepository(node_path_1.default.join(root, 'store.json')), { getScope: () => ({ folderPath: 'project', episodeId: 'episode', adventureId: 'adventure', leaseId: 'lease' }), getRoster: async () => roster });
        const adventureDefinition = { id: 'adventure', version: '1', name: 'Adventure', description: '', rewards: [{ id: 'coin', name: 'Coin', kind: 'currency' }], relics: [] };
        await service.registerRun({ expectedFolder: 'project', activityId: 'activation', moduleType: 'activation-cards', context, adventureDefinition });
        await strict_1.default.rejects(service.completeActivation({ commandId: 'completion', runId: context.runId, outcome: 'completed' }), /not running/);
        await service.lifecycle({ runId: context.runId, state: 'running' });
        strict_1.default.equal((await service.completeActivation({ commandId: 'completion', runId: context.runId, outcome: 'completed' })).accepted, true);
        const history = (await service.getSnapshot()).history.find(row => row.kind === 'activity-completed');
        const request = await service.requestReward({ commandId: 'request', eventKey: history.id, rewardId: 'coin', quantity: 2 });
        strict_1.default.equal((await service.decideReward({ commandId: 'approve', requestId: request.requestIds[0], decision: 'approve' })).accepted, true);
        const next = { ...context, runId: 'mastery', instanceId: 'mastery-instance' };
        await service.registerRun({ expectedFolder: 'project', activityId: 'boss', moduleType: 'final-boss-hero', context: next, adventureDefinition });
        strict_1.default.deepEqual(await service.getRunInventory(next), [{ participantId: 'student', rewards: [{ rewardId: 'coin', quantity: 2 }] }]);
        await strict_1.default.rejects(service.getRunInventory({ ...next, participantIds: ['other'] }), /context/);
        strict_1.default.equal((await service.completeActivation({ commandId: 'completion', runId: context.runId, outcome: 'completed' })).duplicate, true);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
