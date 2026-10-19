"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const session_1 = require("./lesson/session");
const commands_1 = require("./lesson/commands");
const rewardPresentation_1 = require("./rewardPresentation");
const rewardCommands = __importStar(require("./lesson/rewards"));
function api() {
    return rewardCommands;
}
const roster = [
    { id: 'ada', name: 'Ada', archived: false, createdAt: '2026-10-08', updatedAt: '2026-10-08' },
    { id: 'grace', name: 'Grace', archived: false, createdAt: '2026-10-08', updatedAt: '2026-10-08' },
    { id: 'archived', name: 'Earlier student', archived: true, createdAt: '2026-10-08', updatedAt: '2026-10-08' },
];
(0, node_test_1.default)('lesson rewards use active global roster students and default to Class without replacing existing runtime', () => {
    const r = api(), start = (0, session_1.createSession)();
    const session = r.initializeLessonRewards(start, roster);
    strict_1.default.deepEqual(session.rewards.students.map((student) => student.id), ['ada', 'grace']);
    strict_1.default.equal(session.rewards.activeStudentId, 'ada');
    strict_1.default.equal(r.initializeLessonRewards(session, []), session);
    const fallback = r.initializeLessonRewards(start, []);
    strict_1.default.equal(fallback.rewards.students[0].name, 'Class');
    strict_1.default.equal(start.rewards, undefined);
});
(0, node_test_1.default)('all four rewards score once per event, and scene changes retain rewards without touching authored content', () => {
    const r = api();
    let session = r.initializeLessonRewards((0, session_1.createSession)(), roster);
    session = r.selectLessonRewardStudent(session, 'grace');
    for (const [index, variant] of ['gold', 'blue', 'pink', 'crown'].entries()) {
        session = r.awardLessonReward(session, variant, `award-${index}`, 1000 + index);
        strict_1.default.equal(r.awardLessonReward(session, variant, `award-${index}`, 2000), session);
    }
    strict_1.default.deepEqual(session.rewards.students.map((s) => s.stars), [0, 4]);
    strict_1.default.deepEqual(['yellowSparks', 'blueSparks', 'pinkSparks', 'crowns'].map(k => session.rewards.students[1][k]), [1, 1, 1, 1]);
    strict_1.default.equal(session.rewards.sparks.length, 4);
    const lesson = (0, commands_1.insertScene)((0, commands_1.createLesson)(), 'activation');
    const moved = (0, session_1.navigate)(lesson.project, session, { sequence: 'activation', entryId: lesson.entryId });
    strict_1.default.equal(moved.rewards, session.rewards);
    strict_1.default.equal('rewards' in lesson.project, false);
});
(0, node_test_1.default)('reset clears only the selected student, retains acceptance ledger, and keeps celebration totals current', () => {
    const r = api();
    let session = r.initializeLessonRewards((0, session_1.createSession)(), roster);
    session = r.awardLessonReward(session, 'gold', 'one', 1000);
    session = r.selectLessonRewardStudent(session, 'grace');
    session = r.awardLessonReward(session, 'blue', 'two', 1001);
    session = r.showLessonCelebration(session, 'show', 2000);
    const finalId = session.rewards.final.id;
    session = r.resetLessonStudentRewards(session, 'reset');
    strict_1.default.deepEqual(session.rewards.students.map((s) => s.stars), [1, 0]);
    strict_1.default.deepEqual(session.rewards.final.students.map((s) => s.stars), [1, 0]);
    strict_1.default.equal(session.rewards.final.id, finalId);
    strict_1.default.equal(r.resetLessonStudentRewards(session, 'reset'), session);
    strict_1.default.equal(r.awardLessonReward(session, 'blue', 'two', 3000), session);
});
(0, node_test_1.default)('published reward visuals have stable event IDs and exclude runtime roster/acceptance data', () => {
    const r = api();
    let session = r.initializeLessonRewards((0, session_1.createSession)(), roster);
    session = r.awardLessonReward(session, 'pink', 'pink-event', 1000);
    session = r.showLessonCelebration(session, 'final-event', 1100);
    const presentation = r.projectLessonRewards(session.rewards, { width: 960, height: 720 });
    strict_1.default.ok((0, rewardPresentation_1.parseRewardPresentation)(presentation));
    strict_1.default.deepEqual(presentation.frame, { width: 960, height: 720 });
    strict_1.default.equal(presentation.sparks[0].id, 'pink-event');
    strict_1.default.equal(presentation.final.id, 'final-event');
    strict_1.default.equal('appliedEventIds' in presentation, false);
    strict_1.default.equal('activeStudentId' in presentation, false);
    strict_1.default.equal('archived' in presentation.final.students[0], false);
    strict_1.default.equal(r.showLessonCelebration(session, 'final-event', 2000), session);
    const hidden = r.hideLessonCelebration(session, 'hide');
    strict_1.default.equal(hidden.rewards.final, undefined);
    strict_1.default.equal(r.hideLessonCelebration(hidden, 'hide'), hidden);
});
(0, node_test_1.default)('adding students and expiring visuals preserve scores and deduplication across runtime-only updates', () => {
    const r = api();
    let session = r.initializeLessonRewards((0, session_1.createSession)(), []);
    session = r.addLessonRewardStudent(session, 'Lin', 'lin');
    strict_1.default.equal(session.rewards.activeStudentId, 'lin');
    session = r.awardLessonReward(session, 'crown', 'crown', 1000);
    const pruned = r.pruneLessonRewards(session, 100000);
    strict_1.default.equal(pruned.rewards.sparks.length, 0);
    strict_1.default.equal(pruned.rewards.students.find((s) => s.id === 'lin').stars, 1);
    strict_1.default.equal(r.awardLessonReward(pruned, 'crown', 'crown', 100001), pruned);
    strict_1.default.equal(r.addLessonRewardStudent(pruned, 'Duplicate', 'lin'), pruned);
});
