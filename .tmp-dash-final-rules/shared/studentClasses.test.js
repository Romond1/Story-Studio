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
async function fixture(fn) { const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'classes-')); try {
    const file = node_path_1.default.join(dir, 'settings.json'), repo = new studentSettingsRepository_1.StudentSettingsRepository(file);
    await fn(file, repo, new studentService_1.StudentService(repo));
}
finally {
    await (0, promises_1.rm)(dir, { recursive: true, force: true });
} }
(0, node_test_1.default)('classes preserve distinct identity, multiple enrollment and archived membership across restart', async () => fixture(async (file, repo, s) => {
    const a = (await s.createProfile({ name: 'Same' })).studentRoster[0];
    const b = (await s.createProfile({ name: 'Same' })).studentRoster[1];
    const c = (await s.createClass({ name: 'Same' })).classes[0];
    const d = (await s.createClass({ name: 'Same' })).classes[1];
    strict_1.default.notEqual(c.id, d.id);
    await s.updateClass({ id: c.id, studentIds: [a.id, b.id] });
    await s.updateClass({ id: d.id, studentIds: [a.id] });
    await s.selectClass({ id: c.id });
    await s.setArchived({ id: a.id, archived: true });
    const restored = await new studentService_1.StudentService(new studentSettingsRepository_1.StudentSettingsRepository(file)).getSnapshot();
    strict_1.default.deepEqual(restored.classes[0].studentIds, [a.id, b.id]);
    strict_1.default.equal(restored.activeClassId, c.id);
    await s.setClassArchived({ id: c.id, archived: true });
    strict_1.default.equal((await s.getSnapshot()).activeClassId, null);
    await strict_1.default.rejects(() => s.selectClass({ id: c.id }));
    await s.setClassArchived({ id: c.id, archived: false });
    await s.selectClass({ id: c.id });
    strict_1.default.equal((await repo.read()).classes[0].createdAt, c.createdAt);
}));
(0, node_test_1.default)('invalid membership and persisted class references fail closed', async () => fixture(async (file, repo, s) => {
    const p = (await s.createProfile({ name: 'A' })).studentRoster[0];
    const c = (await s.createClass({ name: 'A' })).classes[0];
    const before = await (0, promises_1.readFile)(file, 'utf8');
    await strict_1.default.rejects(() => s.updateClass({ id: c.id, studentIds: [p.id, p.id] }));
    await strict_1.default.rejects(() => s.updateClass({ id: c.id, studentIds: ['unknown'] }));
    strict_1.default.equal(await (0, promises_1.readFile)(file, 'utf8'), before);
    const invalid = JSON.parse(before);
    invalid.classes[0].studentIds = ['unknown'];
    await (0, promises_1.writeFile)(file, JSON.stringify(invalid));
    await strict_1.default.rejects(() => repo.read());
    await strict_1.default.rejects(() => s.createProfile({ name: 'B' }));
    strict_1.default.deepEqual(JSON.parse(await (0, promises_1.readFile)(file, 'utf8')), invalid);
}));
(0, node_test_1.default)('older settings default classes without rewriting and concurrent updates retain all domains', async () => fixture(async (file, repo, s) => {
    await s.createProfile({ name: 'A' });
    const old = JSON.parse(await (0, promises_1.readFile)(file, 'utf8'));
    delete old.classes;
    delete old.activeClassId;
    const raw = JSON.stringify(old);
    await (0, promises_1.writeFile)(file, raw);
    strict_1.default.deepEqual((await s.getSnapshot()).classes, []);
    strict_1.default.equal((await s.getSnapshot()).activeClassId, null);
    strict_1.default.equal(await (0, promises_1.readFile)(file, 'utf8'), raw);
    await Promise.all([s.createClass({ name: 'C' }), s.createProfile({ name: 'B' }), repo.update(v => ({ ...v, audio: { ...v.audio, volumes: { ...v.audio.volumes, master: 0.37 } } }))]);
    const current = await repo.read();
    strict_1.default.equal(current.classes.length, 1);
    strict_1.default.equal(current.studentRoster.length, 2);
    strict_1.default.equal(current.audio.volumes.master, 0.37);
}));
