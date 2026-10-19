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
const audioSettings_1 = require("./audioSettings");
const studentSettingsRepository_1 = require("../main/studentSettingsRepository");
const studentService_1 = require("../main/studentService");
const date = '2026-01-01T00:00:00.000Z';
const student = (id) => ({ id, name: 'Same display name', archived: false, createdAt: date, updatedAt: date });
const settings = () => ({ version: 1, studentRoster: [student('first'), student('second')], audio: (0, audioSettings_1.normalizeAudioSettings)(undefined), legacyMappings: [], futureSettings: { preserve: ['unchanged', 42] } });
(0, node_test_1.default)('profile read is nonmutating; duplicate names remain distinct through edits and archive', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'profile-safety-'));
    try {
        const file = node_path_1.default.join(root, 'settings.json'), data = settings(), original = JSON.stringify(data, null, 2);
        await node_fs_1.promises.writeFile(file, original);
        const service = new studentService_1.StudentService(new studentSettingsRepository_1.StudentSettingsRepository(file));
        strict_1.default.deepEqual((await service.getSnapshot()).studentRoster.map(s => s.id), ['first', 'second']);
        strict_1.default.equal(await node_fs_1.promises.readFile(file, 'utf8'), original);
        await service.updateProfile({ id: 'first', nickname: 'Hero One' });
        await service.setArchived({ id: 'first', archived: true });
        const archived = await service.getSnapshot();
        strict_1.default.equal(archived.studentRoster.length, 2);
        strict_1.default.equal(archived.studentRoster.find(s => s.id === 'first')?.archived, true);
        strict_1.default.equal(archived.studentRoster.find(s => s.id === 'second')?.archived, false);
        await service.setArchived({ id: 'first', archived: false });
        strict_1.default.equal((await service.getSnapshot()).studentRoster.find(s => s.id === 'first')?.createdAt, date);
        const stored = JSON.parse(await node_fs_1.promises.readFile(file, 'utf8'));
        strict_1.default.deepEqual(stored.audio, data.audio);
        strict_1.default.deepEqual(stored.futureSettings, data.futureSettings);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('malformed and duplicate-ID settings fail closed without rewriting or replacing the source', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'profile-corrupt-'));
    try {
        const file = node_path_1.default.join(root, 'settings.json');
        for (const original of ['{broken', JSON.stringify({ ...settings(), studentRoster: [student('same'), student('same')] })]) {
            await node_fs_1.promises.writeFile(file, original);
            const service = new studentService_1.StudentService(new studentSettingsRepository_1.StudentSettingsRepository(file));
            await strict_1.default.rejects(service.getSnapshot());
            await strict_1.default.rejects(service.createProfile({ name: 'New' }));
            strict_1.default.equal(await node_fs_1.promises.readFile(file, 'utf8'), original);
        }
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('legacy mapping requires explicit source identity and cannot merge equal names or retarget a saved mapping', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'profile-mapping-'));
    try {
        const file = node_path_1.default.join(root, 'settings.json');
        await node_fs_1.promises.writeFile(file, JSON.stringify(settings()));
        const service = new studentService_1.StudentService(new studentSettingsRepository_1.StudentSettingsRepository(file));
        await service.mapLegacy({ source: 'fixture-project', sourceStudentId: 'legacy-1', targetStudentId: 'first' });
        await service.mapLegacy({ source: 'fixture-project', sourceStudentId: 'legacy-2', targetStudentId: 'second' });
        const before = await node_fs_1.promises.readFile(file, 'utf8');
        await strict_1.default.rejects(service.mapLegacy({ source: 'fixture-project', sourceStudentId: 'legacy-1', targetStudentId: 'second' }));
        strict_1.default.equal(await node_fs_1.promises.readFile(file, 'utf8'), before);
        strict_1.default.equal((await service.getSnapshot()).studentRoster.length, 2);
        const imported = await service.importProfile({ source: 'another-project', sourceStudentId: 'legacy-1', name: 'Same display name' });
        strict_1.default.equal(imported.studentRoster.length, 3);
        strict_1.default.equal(new Set(imported.studentRoster.map(s => s.id)).size, 3);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('oversized updates reject before replacing settings or its recovery backup', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'profile-size-'));
    try {
        const file = node_path_1.default.join(root, 'settings.json'), original = JSON.stringify(settings());
        await node_fs_1.promises.writeFile(file, original);
        const repository = new studentSettingsRepository_1.StudentSettingsRepository(file);
        await strict_1.default.rejects(repository.update(current => ({ ...current, oversized: 'x'.repeat(16 * 1024 * 1024) })), /large|size|limit/i);
        strict_1.default.equal(await node_fs_1.promises.readFile(file, 'utf8'), original);
        await strict_1.default.rejects(node_fs_1.promises.stat(`${file}.backup`), /ENOENT/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
