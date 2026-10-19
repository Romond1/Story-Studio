"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_vm_1 = __importDefault(require("node:vm"));
const typescript_1 = __importDefault(require("typescript"));
const relics_1 = require("./relics");
function callbacks(fail = false) {
    const calls = [], snapshots = [], storage = [], toasts = [];
    const canonical = [{ id: 'archived', name: 'New name', archived: true, createdAt: 'date', updatedAt: 'date' }, { id: 'edited', name: 'B', archived: false, createdAt: 'date', updatedAt: 'date' }];
    const context = { exports: {}, useCallback: (fn) => fn, studentRoster: canonical.map(s => ({ ...s, name: 'Stale name', archived: false })), rosterPersistenceReady: { current: true }, normalizeStudentRosterSettings: relics_1.normalizeStudentRosterSettings, showToast: (...args) => toasts.push(args), setStudentRoster: (value) => snapshots.push(value), updateRelicSystem: () => { }, ensureRelicProgressForRoster: (v) => v, STUDENT_ROSTER_FALLBACK_STORAGE_KEY: 'roster', console: { error() { } }, crypto: { randomUUID: () => 'new-id' }, window: { localStorage: { setItem: (_key, value) => storage.push(value) }, appApi: { saveStudentRoster: async () => { calls.push('bulk'); if (fail)
                    throw Error('disk failure'); return { version: 1, studentRoster: canonical }; }, students: { updateProfile: async (input) => { calls.push(`rename:${input.id}`); if (fail)
                        throw Error('disk failure'); return { version: 1, studentRoster: canonical.map(s => s.id === input.id ? { ...s, name: input.name } : s), legacyMappings: [] }; }, setArchived: async (input) => { calls.push(`archive:${input.id}`); if (fail)
                        throw Error('disk failure'); return { version: 1, studentRoster: canonical, legacyMappings: [] }; } } } } };
    const source = typescript_1.default.createSourceFile('App.tsx', (0, node_fs_1.readFileSync)('src/renderer/App.tsx', 'utf8'), typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX), wanted = new Set(['saveRoster', 'acceptRosterSnapshot', 'profileWriteError', 'renameRosterStudent', 'archiveRosterStudent']), parts = [];
    const visit = (node) => { if (typescript_1.default.isVariableDeclaration(node) && typescript_1.default.isIdentifier(node.name) && wanted.has(node.name.text))
        parts.push(`const ${node.getText(source)};`); typescript_1.default.forEachChild(node, visit); };
    visit(source);
    const code = typescript_1.default.transpileModule(parts.join('\n') + '\nexports.rename=renameRosterStudent;exports.archive=archiveRosterStudent;', { compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2021 } }).outputText;
    node_vm_1.default.runInNewContext(code, context);
    return { context, calls, snapshots, storage, toasts };
}
(0, node_test_1.default)('legacy profile actions use scoped mutations and retain newer canonical archive/name state', async () => { const h = callbacks(); strict_1.default.equal(await h.context.exports.rename('edited', 'Renamed'), true); strict_1.default.deepEqual(h.calls, ['rename:edited']); strict_1.default.equal(h.snapshots[0][0].archived, true); strict_1.default.equal(h.snapshots[0][0].name, 'New name'); await h.context.exports.archive('edited'); strict_1.default.deepEqual(h.calls, ['rename:edited', 'archive:edited']); });
(0, node_test_1.default)('failed canonical profile save leaves local roster/cache untouched and reports failure', async () => { const h = callbacks(true); strict_1.default.equal(await h.context.exports.rename('edited', 'Renamed'), false); strict_1.default.equal(h.snapshots.length, 0); strict_1.default.equal(h.storage.length, 0); strict_1.default.equal(h.toasts.some((item) => item[1] === 'success'), false); });
(0, node_test_1.default)('empty canonical roster never automatically imports a local fallback', async () => {
    const writes = [], snapshots = [], context = { exports: {}, rosterPersistenceReady: { current: false }, normalizeStudentRosterSettings: relics_1.normalizeStudentRosterSettings, STUDENT_ROSTER_FALLBACK_STORAGE_KEY: 'roster', setStudentRoster: (value) => snapshots.push(value), showToast() { }, console, window: { localStorage: { getItem: () => JSON.stringify({ version: 1, studentRoster: [{ id: 'cached', name: 'Cached', archived: false, createdAt: 'date', updatedAt: 'date' }] }) }, appApi: { getStudentRoster: async () => ({ version: 1, studentRoster: [] }), saveStudentRoster: async (input) => { writes.push(input); } } } };
    const source = typescript_1.default.createSourceFile('App.tsx', (0, node_fs_1.readFileSync)('src/renderer/App.tsx', 'utf8'), typescript_1.default.ScriptTarget.Latest, true, typescript_1.default.ScriptKind.TSX);
    let effect = '';
    const visit = (node) => { if (typescript_1.default.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('let fallbackRaw'))
        effect = node.arguments[0].getText(source); typescript_1.default.forEachChild(node, visit); };
    visit(source);
    strict_1.default.ok(effect);
    node_vm_1.default.runInNewContext(typescript_1.default.transpileModule(`exports.effect=${effect}`, { compilerOptions: { target: typescript_1.default.ScriptTarget.ES2021 } }).outputText, context);
    context.exports.effect();
    await new Promise(resolve => setImmediate(resolve));
    strict_1.default.equal(writes.length, 0);
    strict_1.default.equal(snapshots[0].length, 0);
    strict_1.default.equal(context.rosterPersistenceReady.current, true);
});
