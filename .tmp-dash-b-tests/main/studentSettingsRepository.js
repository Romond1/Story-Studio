"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentSettingsRepository = void 0;
exports.validText = validText;
exports.validateSettings = validateSettings;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const audioSettings_1 = require("../shared/audioSettings");
const model_1 = require("../shared/students/model");
function validText(v, max = 200) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v); }
function validateSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('Invalid settings');
    const s = value;
    if (s.version !== 1 || !Array.isArray(s.studentRoster) || s.studentRoster.length > 10000)
        throw Error('Invalid settings roster');
    const ids = new Set();
    for (const p of s.studentRoster) {
        if (!p || !validText(p.id) || ids.has(p.id) || !validText(p.name) || typeof p.archived !== 'boolean' || !validText(p.createdAt) || !validText(p.updatedAt) || !Number.isFinite(Date.parse(p.createdAt)) || !Number.isFinite(Date.parse(p.updatedAt)))
            throw Error('Invalid or duplicate student identity');
        if (p.nickname !== undefined && (typeof p.nickname !== 'string' || p.nickname.length > 200))
            throw Error('Invalid nickname');
        if (p.avatar !== undefined && !model_1.STUDENT_AVATARS.includes(p.avatar))
            throw Error('Invalid avatar');
        ids.add(p.id);
    }
    const mappings = s.legacyMappings ?? [];
    if (!Array.isArray(mappings) || mappings.length > 20000)
        throw Error('Invalid legacy mappings');
    const keys = new Set();
    for (const m of mappings) {
        const k = JSON.stringify([m?.source, m?.sourceStudentId]);
        if (!m || !validText(m.source) || !validText(m.sourceStudentId) || !ids.has(m.targetStudentId) || !validText(m.createdAt) || !Number.isFinite(Date.parse(m.createdAt)) || keys.has(k))
            throw Error('Invalid legacy mapping');
        keys.add(k);
    }
    const classes = s.classes === undefined ? [] : s.classes;
    if (!Array.isArray(classes) || classes.length > 10000)
        throw Error('Invalid classes');
    const classIds = new Set();
    for (const c of classes) {
        if (!c || !validText(c.id) || classIds.has(c.id) || !validText(c.name) || typeof c.archived !== 'boolean' || !validText(c.createdAt) || !validText(c.updatedAt) || !Number.isFinite(Date.parse(c.createdAt)) || !Number.isFinite(Date.parse(c.updatedAt)) || !Array.isArray(c.studentIds) || c.studentIds.length > 10000 || new Set(c.studentIds).size !== c.studentIds.length || c.studentIds.some(id => !ids.has(id)))
            throw Error('Invalid class identity or membership');
        classIds.add(c.id);
    }
    const activeClassId = s.activeClassId === undefined ? null : s.activeClassId;
    if (activeClassId !== null && (typeof activeClassId !== 'string' || !classes.some(c => c.id === activeClassId && !c.archived)))
        throw Error('Invalid active class');
    return { ...s, classes, activeClassId, audio: (0, audioSettings_1.normalizeAudioSettings)(s.audio), legacyMappings: mappings };
}
class StudentSettingsRepository {
    constructor(file) {
        this.file = file;
        this.tail = Promise.resolve();
    }
    async load() {
        try {
            const h = await node_fs_1.promises.open(this.file, 'r');
            try {
                const chunks = [];
                let total = 0;
                for (;;) {
                    const chunk = Buffer.alloc(Math.min(65536, 16 * 1024 * 1024 + 1 - total));
                    const { bytesRead } = await h.read(chunk, 0, chunk.length, null);
                    if (!bytesRead)
                        break;
                    chunks.push(chunk.subarray(0, bytesRead));
                    total += bytesRead;
                    if (total > 16 * 1024 * 1024)
                        throw Error('Settings too large');
                }
                return validateSettings(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            }
            finally {
                await h.close();
            }
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return { version: 1, studentRoster: [], audio: (0, audioSettings_1.normalizeAudioSettings)(undefined), legacyMappings: [], classes: [], activeClassId: null };
            throw e;
        }
    }
    async read() { await this.tail; return this.load(); }
    update(mutate) {
        const next = this.tail.then(async () => {
            const current = await this.load();
            const result = validateSettings(await mutate(structuredClone(current)));
            const serialized = JSON.stringify(result, null, 2);
            if (Buffer.byteLength(serialized, 'utf8') > 16 * 1024 * 1024)
                throw Error('Settings too large');
            await node_fs_1.promises.mkdir(node_path_1.default.dirname(this.file), { recursive: true });
            const write = async (target, data) => { const tmp = target + '.' + (0, node_crypto_1.randomUUID)() + '.tmp'; try {
                const h = await node_fs_1.promises.open(tmp, 'wx');
                try {
                    await h.writeFile(data, 'utf8');
                    await h.sync();
                }
                finally {
                    await h.close();
                }
                await node_fs_1.promises.rename(tmp, target);
            }
            finally {
                await node_fs_1.promises.rm(tmp, { force: true });
            } };
            try {
                await node_fs_1.promises.access(this.file);
                await write(this.file + '.backup', JSON.stringify(current, null, 2));
            }
            catch (e) {
                if (e.code !== 'ENOENT')
                    throw e;
            }
            await write(this.file, serialized);
            return structuredClone(result);
        });
        this.tail = next.catch(() => undefined);
        return next;
    }
}
exports.StudentSettingsRepository = StudentSettingsRepository;
