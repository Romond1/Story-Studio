"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressionRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const reducer_1 = require("../shared/progression/reducer");
const validation_1 = require("../shared/progression/validation");
const MAX_STORE_BYTES = 32 * 1024 * 1024;
const copy = (value) => JSON.parse(JSON.stringify(value));
/** One private file owns both effects and receipts; memory advances only after atomic replacement. */
class ProgressionRepository {
    constructor(file, hooks = {}) {
        this.file = file;
        this.hooks = hooks;
        this.state = null;
        this.queue = Promise.resolve();
    }
    serialize(operation) { const result = this.queue.then(operation, operation); this.queue = result.then(() => undefined, () => undefined); return result; }
    async load() {
        if (this.state)
            return this.state;
        let handle;
        try {
            handle = await node_fs_1.promises.open(this.file, 'r');
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                this.state = (0, reducer_1.createProgressionState)();
                return this.state;
            }
            throw error;
        }
        const chunks = [];
        let bytes = 0;
        try {
            if ((await handle.stat()).size > MAX_STORE_BYTES)
                throw Error('Private progression store size limit exceeded.');
            while (true) {
                const buffer = Buffer.alloc(Math.min(65536, MAX_STORE_BYTES + 1 - bytes)), result = await handle.read(buffer, 0, buffer.length, null);
                if (!result.bytesRead)
                    break;
                bytes += result.bytesRead;
                if (bytes > MAX_STORE_BYTES)
                    throw Error('Private progression store size limit exceeded.');
                chunks.push(buffer.subarray(0, result.bytesRead));
            }
        }
        finally {
            await handle.close();
        }
        this.state = (0, validation_1.parseProgressionState)(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        return this.state;
    }
    snapshot() { return this.serialize(async () => copy(await this.load())); }
    async backup(previous) {
        const temporary = node_path_1.default.join(node_path_1.default.dirname(this.file), `.progression-backup-${(0, node_crypto_1.randomUUID)()}.tmp`);
        try {
            const handle = await node_fs_1.promises.open(temporary, 'wx');
            try {
                await handle.writeFile(JSON.stringify(previous));
                await handle.sync();
            }
            finally {
                await handle.close();
            }
            await node_fs_1.promises.rename(temporary, `${this.file}.backup`);
        }
        finally {
            await node_fs_1.promises.unlink(temporary).catch(error => { if (error.code !== 'ENOENT')
                throw error; });
        }
    }
    transact(command, authority, authorizeNew) {
        return this.serialize(async () => {
            const previous = await this.load(), replay = (0, reducer_1.findProgressionReplay)(previous, command);
            if (replay)
                return copy(replay);
            await authorizeNew?.(copy(previous));
            const currentAuthority = typeof authority === 'function' ? await authority() : authority;
            const applied = (0, reducer_1.applyProgressionCommand)(previous, command, currentAuthority);
            if (!applied.result.accepted)
                return copy(applied.result);
            const next = (0, validation_1.parseProgressionState)(applied.state), bytes = Buffer.from(JSON.stringify(next));
            if (bytes.length > MAX_STORE_BYTES)
                throw Error('Private progression store is full; no receipts were discarded.');
            await node_fs_1.promises.mkdir(node_path_1.default.dirname(this.file), { recursive: true });
            const temporary = node_path_1.default.join(node_path_1.default.dirname(this.file), `.progression-${(0, node_crypto_1.randomUUID)()}.tmp`);
            try {
                const handle = await node_fs_1.promises.open(temporary, 'wx');
                try {
                    await handle.writeFile(bytes);
                    await handle.sync();
                }
                finally {
                    await handle.close();
                }
                await this.hooks.beforeRename?.();
                await authorizeNew?.(copy(previous));
                await this.backup(previous);
                await authorizeNew?.(copy(previous));
                await node_fs_1.promises.rename(temporary, this.file);
                this.state = next;
            }
            finally {
                await node_fs_1.promises.unlink(temporary).catch(error => { if (error.code !== 'ENOENT')
                    throw error; });
            }
            return copy(applied.result);
        });
    }
}
exports.ProgressionRepository = ProgressionRepository;
