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
const studentSettingsRepository_1 = require("../main/studentSettingsRepository");
const studentService_1 = require("../main/studentService");
(0, node_test_1.default)('serialized audio and profile updates retain both and backup previous valid snapshot', async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'student-queue-'));
    try {
        const file = node_path_1.default.join(dir, 'settings.json'), repo = new studentSettingsRepository_1.StudentSettingsRepository(file), service = new studentService_1.StudentService(repo);
        await Promise.all([service.createProfile({ name: 'A', nickname: 'Alpha', avatar: 'star' }), repo.update(s => ({ ...s, audio: { ...s.audio, volumes: { ...s.audio.volumes, master: 0.42 } }, customSetting: 'preserved' }))]);
        const before = await repo.read();
        strict_1.default.equal(before.studentRoster.length, 1);
        strict_1.default.equal(before.customSetting, 'preserved');
        strict_1.default.equal(before.audio.volumes.master, 0.42);
        await service.createProfile({ name: 'B' });
        strict_1.default.deepEqual(JSON.parse(await (0, promises_1.readFile)(file + '.backup', 'utf8')), before);
        const [a, b] = (await service.getSnapshot()).studentRoster;
        await service.saveLegacy({ version: 1, studentRoster: [{ id: a.id, name: 'Renamed', createdAt: a.createdAt, updatedAt: a.updatedAt, archived: false }] });
        const after = await service.getSnapshot();
        strict_1.default.equal(after.studentRoster.length, 2);
        strict_1.default.equal(after.studentRoster[0].nickname, 'Alpha');
        strict_1.default.equal(after.studentRoster[0].avatar, 'star');
        strict_1.default.equal(after.studentRoster[1].id, b.id);
        await strict_1.default.rejects(() => service.updateProfile({ id: a.id, avatar: 'https://example.com/avatar.png' }));
        strict_1.default.equal((await service.getSnapshot()).studentRoster[0].avatar, 'star');
    }
    finally {
        await (0, promises_1.rm)(dir, { recursive: true, force: true });
    }
});
