"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardResultCore = void 0;
const sparkRewards_1 = require("./sparkRewards");
const relics_1 = require("./relics");
/** Session-only acceptance ledger, separate from authored/undoable scores and visuals.
 * Call with the latest document inside Control's synchronous document transaction.
 * Present never receives or executes this authority. */
class RewardResultCore {
    constructor(scope) {
        this.scope = scope;
        this.applied = new Set();
    }
    valid(scope, kind, id) {
        return scope === this.scope && typeof id === 'string' && id.length > 0 && id.length <= 1024
            && !this.applied.has(`${kind}:${id}`);
    }
    applySpark(scope, id, students, studentId, variant) {
        const rejected = { accepted: false, students, variant, delta: 0 };
        if (!this.valid(scope, 'spark', id) || !sparkRewards_1.REWARD_VARIANTS.includes(variant)
            || !students.some(student => student.id === studentId))
            return rejected;
        const next = (0, sparkRewards_1.awardRewardToStudent)(students, studentId, variant);
        this.applied.add(`spark:${id}`);
        return { accepted: true, students: next, student: next.find(student => student.id === studentId), variant, delta: 1 };
    }
    applyRelic(scope, id, system, studentIds, action) {
        const rejected = { accepted: false, system, kind: null };
        if (!this.valid(scope, 'relic', id) || !['increase', 'decrease', 'reset', 'complete'].includes(action))
            return rejected;
        const targets = [...new Set(studentIds)].filter(studentId => system.studentProgress[studentId]?.active === true);
        if (!targets.length)
            return rejected;
        const visible = { ...system, showOnStage: true };
        const next = action === 'increase' || action === 'decrease'
            ? (0, relics_1.applyRelicProgressDelta)(visible, targets, action === 'increase' ? 1 : -1)
            : (0, relics_1.setRelicProgressForStudents)(visible, targets, action === 'complete' ? 30 : 0);
        const crosses = (boundary) => targets.some(studentId => system.studentProgress[studentId].progress < boundary && next.studentProgress[studentId].progress >= boundary);
        const kind = crosses(30) ? 'complete' : [1, 11, 21].some(crosses) ? 'stage' : 'progress';
        this.applied.add(`relic:${id}`);
        return { accepted: true, system: next, kind };
    }
}
exports.RewardResultCore = RewardResultCore;
