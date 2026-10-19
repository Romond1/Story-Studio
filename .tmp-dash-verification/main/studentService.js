"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentService = void 0;
const node_crypto_1 = require("node:crypto");
const model_1 = require("../shared/students/model");
const studentSettingsRepository_1 = require("./studentSettingsRepository");
function snapshot(s) { return { version: 1, studentRoster: s.studentRoster, legacyMappings: s.legacyMappings, classes: s.classes, activeClassId: s.activeClassId }; }
function profile(input) { if (!input || !(0, studentSettingsRepository_1.validText)(input.name) || input.nickname !== undefined && (typeof input.nickname !== 'string' || input.nickname.length > 200) || input.avatar !== undefined && !model_1.STUDENT_AVATARS.includes(input.avatar))
    throw Error('Invalid profile'); return { name: input.name.trim(), ...(input.nickname !== undefined ? { nickname: input.nickname } : {}), ...(input.avatar !== undefined ? { avatar: input.avatar } : {}) }; }
class StudentService {
    constructor(repo) {
        this.repo = repo;
    }
    async createClass(input) { if (!input || !(0, studentSettingsRepository_1.validText)(input.name))
        throw Error('Invalid class name'); return snapshot(await this.repo.update(s => { const now = new Date().toISOString(); s.classes.push({ id: (0, node_crypto_1.randomUUID)(), name: input.name.trim(), studentIds: [], archived: false, createdAt: now, updatedAt: now }); return s; })); }
    async updateClass(input) { return snapshot(await this.repo.update(s => { const c = s.classes.find(c => c.id === input?.id); if (!c)
        throw Error('Unknown class'); if (input.name !== undefined) {
        if (!(0, studentSettingsRepository_1.validText)(input.name))
            throw Error('Invalid class name');
        c.name = input.name.trim();
    } if (input.studentIds !== undefined) {
        if (!Array.isArray(input.studentIds) || input.studentIds.length > 10000 || new Set(input.studentIds).size !== input.studentIds.length || input.studentIds.some(id => !s.studentRoster.some(p => p.id === id)))
            throw Error('Invalid class membership');
        c.studentIds = [...input.studentIds];
    } c.updatedAt = new Date().toISOString(); return s; })); }
    async setClassArchived(input) { return snapshot(await this.repo.update(s => { const c = s.classes.find(c => c.id === input?.id); if (!c || typeof input.archived !== 'boolean')
        throw Error('Invalid class archive'); c.archived = input.archived; c.updatedAt = new Date().toISOString(); if (c.archived && s.activeClassId === c.id)
        s.activeClassId = null; return s; })); }
    async selectClass(input) { return snapshot(await this.repo.update(s => { if (!input || input.id !== null && !s.classes.some(c => c.id === input.id && !c.archived))
        throw Error('Invalid active class'); s.activeClassId = input.id; return s; })); }
    async getSnapshot() { return snapshot(await this.repo.read()); }
    async createProfile(input) { const fields = profile(input); return snapshot(await this.repo.update(s => { const now = new Date().toISOString(); s.studentRoster.push({ ...fields, id: (0, node_crypto_1.randomUUID)(), archived: false, createdAt: now, updatedAt: now }); return s; })); }
    async updateProfile(input) { return snapshot(await this.repo.update(s => { const p = s.studentRoster.find(p => p.id === input?.id); if (!p)
        throw Error('Unknown student'); const fields = profile({ name: input.name ?? p.name, nickname: input.nickname === null ? undefined : input.nickname ?? p.nickname, avatar: input.avatar === null ? undefined : input.avatar ?? p.avatar }); delete p.nickname; delete p.avatar; Object.assign(p, fields, { updatedAt: new Date().toISOString() }); return s; })); }
    async setArchived(input) { return snapshot(await this.repo.update(s => { const p = s.studentRoster.find(p => p.id === input?.id); if (!p || typeof input.archived !== 'boolean')
        throw Error('Invalid student archive'); p.archived = input.archived; p.updatedAt = new Date().toISOString(); return s; })); }
    async mapLegacy(input) { return snapshot(await this.repo.update(s => { this.map(s, input); return s; })); }
    map(s, input) { if (!input || !(0, studentSettingsRepository_1.validText)(input.source) || !(0, studentSettingsRepository_1.validText)(input.sourceStudentId) || !s.studentRoster.some(p => p.id === input.targetStudentId))
        throw Error('Invalid legacy identity mapping'); const old = s.legacyMappings.find(m => m.source === input.source && m.sourceStudentId === input.sourceStudentId); if (old) {
        if (old.targetStudentId !== input.targetStudentId)
            throw Error('Legacy identity already mapped');
        return;
    } s.legacyMappings.push({ source: input.source, sourceStudentId: input.sourceStudentId, targetStudentId: input.targetStudentId, createdAt: new Date().toISOString() }); }
    async importProfile(input) { const fields = profile(input); return snapshot(await this.repo.update(s => { if (!(0, studentSettingsRepository_1.validText)(input.source) || !(0, studentSettingsRepository_1.validText)(input.sourceStudentId))
        throw Error('Invalid legacy source'); if (s.legacyMappings.some(m => m.source === input.source && m.sourceStudentId === input.sourceStudentId))
        return s; const now = new Date().toISOString(), id = (0, node_crypto_1.randomUUID)(); s.studentRoster.push({ ...fields, id, archived: false, createdAt: now, updatedAt: now }); this.map(s, { source: input.source, sourceStudentId: input.sourceStudentId, targetStudentId: id }); return s; })); }
    async saveLegacy(input) { return snapshot(await this.repo.update(s => { if (!input || input.version !== 1 || !Array.isArray(input.studentRoster))
        throw Error('Invalid roster'); const seen = new Set(); for (const incoming of input.studentRoster) {
        if (!incoming || seen.has(incoming.id))
            throw Error('Duplicate student');
        seen.add(incoming.id);
        const p = s.studentRoster.find(p => p.id === incoming.id);
        if (p) {
            Object.assign(p, incoming, { createdAt: p.createdAt, nickname: incoming.nickname ?? p.nickname, avatar: incoming.avatar ?? p.avatar });
        }
        else
            s.studentRoster.push({ ...incoming });
    } return s; })); }
}
exports.StudentService = StudentService;
