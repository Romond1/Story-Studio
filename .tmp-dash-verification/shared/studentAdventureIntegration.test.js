"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const studentService_1 = require("../main/studentService");
const studentSettingsRepository_1 = require("../main/studentSettingsRepository");
const progressionRepository_1 = require("../main/progressionRepository");
const progressionService_1 = require("../main/progressionService");
const heroBoard_1 = require("./students/heroBoard");
const definition = (id) => ({ id, version: '1', name: 'Shared title', description: 'Synthetic adventure', rewards: [{ id: 'token', name: 'Token', kind: 'badge' }], relics: [{ id: 'relic', name: 'Relic', stages: [{ id: 'first', name: 'First', requiredProgress: 2 }] }] });
async function fixture(run) { const f = await prepare(); try {
    await run(f);
}
finally {
    await (0, promises_1.rm)(f.dir, { recursive: true, force: true });
} }
async function prepare() { const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'student-adventure-')); const settings = node_path_1.default.join(dir, 'settings.json'), store = node_path_1.default.join(dir, 'progression.json'); let students = new studentService_1.StudentService(new studentSettingsRepository_1.StudentSettingsRepository(settings)); const a = (await students.createProfile({ name: 'Equal name', nickname: 'One' })).studentRoster[0]; const b = (await students.createProfile({ name: 'Equal name', nickname: 'Two' })).studentRoster[1]; const c = (await students.createClass({ name: 'Group' })).classes[0]; const d = (await students.createClass({ name: 'Group' })).classes[1]; await students.updateClass({ id: c.id, studentIds: [a.id, b.id] }); await students.updateClass({ id: d.id, studentIds: [a.id] }); let scope = { folderPath: 'folder', adventureId: 'adventure-a', episodeId: 'a1', leaseId: 'lease' }; const host = { getScope: () => scope, getRoster: async () => (await students.getSnapshot()).studentRoster }; let service = new progressionService_1.ProgressionService(new progressionRepository_1.ProgressionRepository(store), host); return { dir, a, b, c, d, get students() { return students; }, get service() { return service; }, scope(adventureId, episodeId) { scope = { ...scope, adventureId, episodeId }; }, restart() { students = new studentService_1.StudentService(new studentSettingsRepository_1.StudentSettingsRepository(settings)); service = new progressionService_1.ProgressionService(new progressionRepository_1.ProgressionRepository(store), host); } }; }
(0, node_test_1.default)('profiles and classes span three episodes while identical reward IDs remain adventure-scoped', () => fixture(async (f) => {
    for (const [world, episode, quantity] of [['adventure-a', 'a1', 2], ['adventure-a', 'a2', 3], ['adventure-b', 'b1', 7]]) {
        f.scope(world, episode);
        const def = definition(world);
        strict_1.default.equal((await f.service.adjustReward({ expectedFolder: 'folder', commandId: 'reward-' + episode, studentId: f.a.id, adventureDefinition: def, rewardId: 'token', delta: quantity, reason: 'Synthetic correction' })).accepted, true);
        strict_1.default.equal((await f.service.advanceRelic({ expectedFolder: 'folder', commandId: 'relic-' + episode, studentId: f.a.id, adventureDefinition: def, relicId: 'relic', progress: quantity, reason: 'Synthetic progress' })).accepted, true);
        strict_1.default.equal((await f.service.completeEpisode({ expectedFolder: 'folder', commandId: 'episode-' + episode, studentIds: [f.a.id, f.b.id], adventureId: world, episodeId: episode, reason: 'Teacher confirmed' })).accepted, true);
    }
    const state = await f.service.getSnapshot(), snapshot = await f.students.getSnapshot();
    strict_1.default.deepEqual(snapshot.classes.map(c => c.studentIds), [[f.a.id, f.b.id], [f.a.id]]);
    const board = (0, heroBoard_1.selectHeroBoard)(snapshot, state, { studentId: f.a.id });
    strict_1.default.deepEqual(board.progress.map(p => [p.adventureId, p.inventory[0].quantity, p.relics[0].progress]), [['adventure-a', 5, 3], ['adventure-b', 7, 7]]);
    strict_1.default.deepEqual((0, heroBoard_1.selectHeroBoard)(snapshot, state, { adventureId: 'adventure-a', episodeId: 'a1' }).history.map(h => h.episodeId), ['a1']);
    strict_1.default.equal(new Set(snapshot.studentRoster.map(p => p.id)).size, 2);
}));
(0, node_test_1.default)('profile changes and restart preserve stable enrollment and authoritative history', () => fixture(async (f) => {
    const command = { expectedFolder: 'folder', commandId: 'award', studentId: f.a.id, adventureDefinition: definition('adventure-a'), rewardId: 'token', delta: 2, reason: 'Explicit correction' };
    await f.service.adjustReward(command);
    const before = await f.service.getSnapshot();
    await f.students.updateProfile({ id: f.a.id, name: 'Renamed', nickname: 'New nickname', avatar: 'moon' });
    await f.students.setArchived({ id: f.a.id, archived: true });
    f.restart();
    strict_1.default.deepEqual(await f.service.getSnapshot(), before);
    const snapshot = await f.students.getSnapshot();
    strict_1.default.equal(snapshot.studentRoster[0].id, f.a.id);
    strict_1.default.equal(snapshot.studentRoster[0].createdAt, f.a.createdAt);
    strict_1.default.deepEqual(snapshot.classes[1].studentIds, [f.a.id]);
    strict_1.default.equal((0, heroBoard_1.selectHeroBoard)(snapshot, before, { classId: f.d.id }).history.length, 1);
    await f.students.setArchived({ id: f.a.id, archived: false });
    strict_1.default.equal((await f.service.adjustReward(command)).duplicate, true);
    strict_1.default.deepEqual(await f.service.getSnapshot(), before);
}));
(0, node_test_1.default)('observed module completion and command receipts replay after restart without additional effects', () => fixture(async (f) => {
    const context = { sessionId: 'session', runId: 'run', instanceId: 'instance', occurrenceId: 'occurrence', episodeId: 'a1', adventureId: 'adventure-a', participantIds: [f.a.id, f.b.id] };
    await f.service.registerRun({ expectedFolder: 'folder', activityId: 'activity', moduleType: 'language-snake', context, adventureDefinition: definition('adventure-a') });
    const envelope = { channel: 'story-studio-module', version: 1, moduleType: 'language-snake', moduleVersion: 1, hostGeneration: 1, requestId: 'request', context };
    const event = { version: 1, eventId: 'completion', context, sequence: 2, type: 'activity-completed', payload: { participantIds: [f.a.id, f.b.id], outcome: 'won' } };
    strict_1.default.equal(f.service.authorizeInitialize({ ...envelope, type: 'initialize' }), true);
    f.service.hostCommand({ ...envelope, type: 'initialize' });
    f.service.acceptedModule({ ...envelope, type: 'ack', command: 'start', sequence: 1 });
    f.service.acceptedModule({ ...envelope, type: 'event', sequence: 2, event });
    strict_1.default.equal((await f.service.recordEvent(event)).accepted, true);
    const before = await f.service.getSnapshot();
    f.restart();
    strict_1.default.equal((await f.service.recordEvent(event)).duplicate, true);
    strict_1.default.equal((await f.service.recordEvent({ ...event, payload: { ...event.payload, outcome: 'lost' } })).accepted, false);
    strict_1.default.deepEqual(await f.service.getSnapshot(), before);
    strict_1.default.equal((0, heroBoard_1.selectHeroBoard)(await f.students.getSnapshot(), before).participation.length, 2);
}));
