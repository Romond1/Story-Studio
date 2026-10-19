"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const progressionRepository_1 = require("../main/progressionRepository");
const roster = [{ id: 'student', name: 'Student', archived: false, createdAt: 'now', updatedAt: 'now' }];
const definition = { id: 'adventure', version: '1', name: 'Adventure', description: '', rewards: [{ id: 'coin', name: 'Coin', kind: 'currency' }], relics: [] };
const adjustment = (commandId, delta = 1) => ({ type: 'adjust-reward', commandId, studentId: 'student', adventureDefinition: definition, rewardId: 'coin', delta, reason: 'Teacher adjustment' });
(0, node_test_1.default)('atomic progression receipts survive restart and concurrent replay grants once', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-repository-'));
    try {
        const file = node_path_1.default.join(root, 'progression.json'), repository = new progressionRepository_1.ProgressionRepository(file);
        const results = await Promise.all([repository.transact(adjustment('grant'), { roster }), repository.transact(adjustment('grant'), { roster })]);
        strict_1.default.equal(results.filter(r => r.duplicate).length, 1);
        const before = await node_fs_1.promises.readFile(file, 'utf8'), restarted = new progressionRepository_1.ProgressionRepository(file);
        strict_1.default.equal((await restarted.transact(adjustment('grant'), { roster: [] })).duplicate, true);
        strict_1.default.equal(await node_fs_1.promises.readFile(file, 'utf8'), before);
        strict_1.default.equal((await restarted.transact(adjustment('grant', 2), { roster })).accepted, false);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('failed publication changes neither memory nor disk and retry remains possible', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-failure-'));
    try {
        const file = node_path_1.default.join(root, 'progression.json');
        let fail = true;
        const repository = new progressionRepository_1.ProgressionRepository(file, { beforeRename: () => { if (fail)
                throw Error('injected write failure'); } });
        await strict_1.default.rejects(repository.transact(adjustment('grant'), { roster }), /injected/);
        strict_1.default.equal((await repository.snapshot()).revision, 0);
        await strict_1.default.rejects(node_fs_1.promises.stat(file), /ENOENT/);
        fail = false;
        strict_1.default.equal((await repository.transact(adjustment('grant'), { roster })).accepted, true);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('corrupt private stores are rejected without reset or overwrite', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-corrupt-'));
    try {
        const file = node_path_1.default.join(root, 'progression.json');
        await node_fs_1.promises.writeFile(file, '{"version":999}');
        const repository = new progressionRepository_1.ProgressionRepository(file);
        await strict_1.default.rejects(repository.snapshot());
        await strict_1.default.rejects(repository.transact(adjustment('grant'), { roster }));
        strict_1.default.equal(await node_fs_1.promises.readFile(file, 'utf8'), '{"version":999}');
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('scope expiring during staging prevents durable publication', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-expired-'));
    try {
        let current = true;
        const file = node_path_1.default.join(root, 'store.json'), repository = new progressionRepository_1.ProgressionRepository(file, { beforeRename: () => { current = false; } });
        await strict_1.default.rejects(repository.transact(adjustment('grant'), { roster }, () => { if (!current)
            throw Error('scope expired'); }), /scope expired/);
        strict_1.default.equal((await repository.snapshot()).revision, 0);
        await strict_1.default.rejects(node_fs_1.promises.stat(file), /ENOENT/);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('recovery backup retains the previous complete valid snapshot without silently recovering corrupt primary', async () => {
    const root = await node_fs_1.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), 'progression-backup-'));
    try {
        const file = node_path_1.default.join(root, 'store.json'), repository = new progressionRepository_1.ProgressionRepository(file);
        await repository.transact(adjustment('first'), { roster });
        const previous = await node_fs_1.promises.readFile(file, 'utf8');
        await repository.transact(adjustment('second'), { roster });
        strict_1.default.equal(await node_fs_1.promises.readFile(`${file}.backup`, 'utf8'), previous);
        await node_fs_1.promises.writeFile(file, 'corrupt');
        await strict_1.default.rejects(new progressionRepository_1.ProgressionRepository(file).snapshot());
        strict_1.default.equal(await node_fs_1.promises.readFile(`${file}.backup`, 'utf8'), previous);
    }
    finally {
        await node_fs_1.promises.rm(root, { recursive: true, force: true });
    }
});
