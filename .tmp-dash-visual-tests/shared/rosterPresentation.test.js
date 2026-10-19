"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const rosterPresentation_1 = require("./students/rosterPresentation");
const reducer_1 = require("./progression/reducer");
const presentationSnapshot_1 = require("./presentationSnapshot");
(0, node_test_1.default)('roster projection never forwards identity or full names and scopes balances', () => { const state = (0, reducer_1.createProgressionState)(); state.students = [{ studentId: 'private-id', adventureId: 'world', inventory: { gem: 3 }, relics: { r: 2 }, completedEpisodes: [] }]; const result = (0, rosterPresentation_1.projectRosterPresentation)({ roster: [{ id: 'private-id', name: 'Private Full Name', archived: false, createdAt: '', updatedAt: '' }], participantIds: ['private-id', 'guest:private'], progression: state, adventureId: 'world', sessionId: 'session', position: 'bottom', showScores: true, showRewards: true, showRelics: true }); strict_1.default.deepEqual(result.entries, [{ nickname: 'Student 1', rewards: 3, relicProgress: 2 }, { nickname: 'Guest 1' }]); strict_1.default.doesNotMatch(JSON.stringify(result), /private|Full Name/); });
(0, node_test_1.default)('strict projection parser strips extra private fields and rejects unsafe content', () => { const raw = { position: 'top', entries: [{ nickname: 'Star', avatar: 'star', studentId: 'private', history: ['secret'] }], remaining: 0 }; strict_1.default.deepEqual((0, rosterPresentation_1.parseRosterPresentation)(raw), { position: 'top', entries: [{ nickname: 'Star', avatar: 'star' }], remaining: 0 }); for (const avatar of ['https://tracker', 'data:image/png', '<img>'])
    strict_1.default.equal((0, rosterPresentation_1.parseRosterPresentation)({ ...raw, entries: [{ nickname: 'X', avatar }] }), null); strict_1.default.equal((0, rosterPresentation_1.parseRosterPresentation)({ ...raw, entries: Array(9).fill({ nickname: 'X' }) }), null); strict_1.default.equal((0, rosterPresentation_1.parseRosterPresentation)({ ...raw, remaining: -1 }), null); });
(0, node_test_1.default)('optional roster survives snapshot target branches without private fields', () => { for (const target of [{ kind: 'empty', occurrenceId: 'o' }, { kind: 'badge', occurrenceId: 'o' }, { kind: 'unsupported', occurrenceId: 'o' }, { kind: 'game', occurrenceId: 'o', gameId: 'language-snake', instanceId: 'i' }, { kind: 'image', occurrenceId: 'o', src: 'media://image' }]) {
    const parsed = (0, presentationSnapshot_1.parsePresentSnapshot)({ sessionId: 's', revision: 1, target, roster: { position: 'top', entries: [{ nickname: 'Star', id: 'secret' }], remaining: 0 } });
    strict_1.default.deepEqual(parsed?.roster, { position: 'top', entries: [{ nickname: 'Star' }], remaining: 0 });
} });
(0, node_test_1.default)('scores require matching captured session and adventure; active roster caps at eight', () => {
    const state = (0, reducer_1.createProgressionState)();
    const context = { sessionId: 'current', runId: 'run', instanceId: 'i', occurrenceId: 'o', episodeId: 'e', adventureId: 'world', participantIds: ['p'] };
    state.runs = [{ context, moduleType: 'language-snake', lastSequence: 1 }];
    state.history = [{ id: 'score', recordedAt: '', kind: 'score-reported', adventureId: 'world', runId: 'run', studentIds: ['p'], scores: [{ studentId: 'p', score: 7 }] }, { id: 'wrong', recordedAt: '', kind: 'score-reported', adventureId: 'other', runId: 'run', studentIds: ['p'], scores: [{ studentId: 'p', score: 999 }] }];
    const input = { roster: [{ id: 'p', name: 'Private', nickname: 'Hero', archived: false, createdAt: '', updatedAt: '' }, { id: 'archived', name: 'Private', archived: true, createdAt: '', updatedAt: '' }], participantIds: ['p', 'archived', ...Array.from({ length: 10 }, (_, i) => 'guest:' + i)], progression: state, adventureId: 'world', sessionId: 'current', position: 'top', showScores: true, showRewards: true, showRelics: true };
    const result = (0, rosterPresentation_1.projectRosterPresentation)(input);
    strict_1.default.equal(result.entries[0].score, 7);
    strict_1.default.equal(result.entries.length, 8);
    strict_1.default.equal(result.remaining, 3);
    strict_1.default.equal((0, rosterPresentation_1.projectRosterPresentation)({ ...input, sessionId: 'old' }).entries[0].score, undefined);
    strict_1.default.equal((0, rosterPresentation_1.projectRosterPresentation)({ ...input, showScores: false }).entries[0].score, undefined);
});
