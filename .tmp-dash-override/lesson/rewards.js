"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeLessonRewards = initializeLessonRewards;
exports.selectLessonRewardStudent = selectLessonRewardStudent;
exports.addLessonRewardStudent = addLessonRewardStudent;
exports.awardLessonReward = awardLessonReward;
exports.resetLessonStudentRewards = resetLessonStudentRewards;
exports.showLessonCelebration = showLessonCelebration;
exports.hideLessonCelebration = hideLessonCelebration;
exports.pruneLessonRewards = pruneLessonRewards;
exports.projectLessonRewards = projectLessonRewards;
const sparkRewards_1 = require("../sparkRewards");
const rewardDefaults_1 = require("../rewardDefaults");
const rewardPresentation_1 = require("../rewardPresentation");
const update = (session, rewards) => ({ ...session, rewards, revision: session.revision + 1 });
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 1024;
const accepts = (state, eventId) => !!state && validId(eventId) && !state.appliedEventIds.includes(eventId);
const student = (id, name) => (0, sparkRewards_1.normalizeSparkStudent)({ id, name: name.trim().slice(0, 200) }, () => id);
const totals = (students) => students.filter(value => value.badgeVisible !== false).map(({ id, name, yellowSparks, blueSparks, pinkSparks, crowns, stars }) => ({ id, name, yellowSparks, blueSparks, pinkSparks, crowns, stars }));
const refreshFinal = (state, students) => state.final ? { ...state.final, students: totals(students) } : undefined;
function initializeLessonRewards(session, roster) {
    if (session.rewards)
        return session;
    const seen = new Set();
    const students = roster.filter(value => !value.archived && validId(value.id) && value.name.trim() && !seen.has(value.id) && !!seen.add(value.id)).map(value => student(value.id, value.name));
    if (!students.length)
        students.push(student('lesson-class', 'Class'));
    return update(session, { students, activeStudentId: students[0].id, sparks: [], appliedEventIds: [] });
}
function selectLessonRewardStudent(session, id) {
    const state = session.rewards;
    return !state || state.activeStudentId === id || !state.students.some(value => value.id === id) ? session : update(session, { ...state, activeStudentId: id });
}
function addLessonRewardStudent(session, name, id) {
    if (!validId(id) || typeof name !== 'string' || !name.trim())
        return session;
    const initialized = initializeLessonRewards(session, []), state = initialized.rewards;
    if (state.students.some(value => value.id === id))
        return session;
    const students = [...state.students, student(id, name)];
    return update(session, { ...state, students, activeStudentId: id, final: refreshFinal(state, students) });
}
function awardLessonReward(session, variant, eventId, now) {
    const state = session.rewards;
    if (!accepts(state, eventId) || !sparkRewards_1.REWARD_VARIANTS.includes(variant) || !Number.isFinite(now) || now < 0)
        return session;
    const active = state.students.find(value => value.id === state.activeStudentId);
    if (!active)
        return session;
    const students = (0, sparkRewards_1.awardRewardToStudent)(state.students, state.activeStudentId, variant);
    const config = (0, rewardPresentation_1.cleanSparkConfig)(rewardDefaults_1.DEFAULT_SPARK_CONFIG);
    const visual = { id: eventId, startedAt: now, expiresAt: (0, rewardPresentation_1.sparkLifetime)(now, config.burstDurationMs, config.counterVisibleMs, variant), variant, studentName: active.name, delta: 1, config };
    return update(session, { ...state, students, sparks: [...state.sparks.filter(value => value.expiresAt > now).slice(-999), visual], final: refreshFinal(state, students), appliedEventIds: [...state.appliedEventIds, eventId] });
}
function resetLessonStudentRewards(session, eventId) {
    const state = session.rewards;
    if (!accepts(state, eventId))
        return session;
    const students = (0, sparkRewards_1.resetStudentRewards)(state.students, state.activeStudentId);
    return update(session, { ...state, students, sparks: [], final: refreshFinal(state, students), appliedEventIds: [...state.appliedEventIds, eventId] });
}
function showLessonCelebration(session, eventId, now) {
    const state = session.rewards;
    if (!accepts(state, eventId) || !Number.isFinite(now) || now < 0)
        return session;
    const config = (0, rewardPresentation_1.cleanBadgeConfig)(rewardDefaults_1.DEFAULT_BADGE_CONFIG);
    const final = { id: eventId, startedAt: now, expiresAt: now + (config.celebrationDurationMs ?? 5000), config, students: totals(state.students) };
    return update(session, { ...state, final, appliedEventIds: [...state.appliedEventIds, eventId] });
}
function hideLessonCelebration(session, eventId) {
    const state = session.rewards;
    if (!accepts(state, eventId))
        return session;
    return update(session, { ...state, final: undefined, appliedEventIds: [...state.appliedEventIds, eventId] });
}
function pruneLessonRewards(session, now) {
    const state = session.rewards;
    if (!state)
        return session;
    const sparks = state.sparks.filter(value => value.expiresAt > now);
    const final = state.final?.expiresAt !== undefined && state.final.expiresAt <= now ? undefined : state.final;
    return sparks.length === state.sparks.length && final === state.final ? session : update(session, { ...state, sparks, final });
}
/** Only resolved visible events cross to Present, never the runtime roster or ledger. */
function projectLessonRewards(state, frame) {
    const result = (0, rewardPresentation_1.parseRewardPresentation)({ frame, sparks: state.sparks, ...(state.final ? { final: state.final } : {}) });
    if (!result)
        throw new Error('Lesson reward visuals could not be projected.');
    return result;
}
