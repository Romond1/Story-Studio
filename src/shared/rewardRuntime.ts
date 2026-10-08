import type { RelicSystem, SparkAwardVariant, SparkStudent } from './types';
import { awardRewardToStudent, REWARD_VARIANTS } from './sparkRewards';
import { applyRelicProgressDelta, setRelicProgressForStudents } from './relics';

export type RelicAction = 'increase' | 'decrease' | 'reset' | 'complete';
export type RelicResultKind = 'progress' | 'stage' | 'complete';
export interface SparkResult {
  accepted: boolean;
  students: SparkStudent[];
  student?: SparkStudent;
  variant: SparkAwardVariant;
  delta: number;
}
export interface RelicResult { accepted: boolean; system: RelicSystem; kind: RelicResultKind | null }

/** Session-only acceptance ledger, separate from authored/undoable scores and visuals.
 * Call with the latest document inside Control's synchronous document transaction.
 * Present never receives or executes this authority. */
export class RewardResultCore {
  private readonly applied = new Set<string>();
  constructor(readonly scope: string) {}

  private valid(scope: string, kind: string, id: string): boolean {
    return scope === this.scope && typeof id === 'string' && id.length > 0 && id.length <= 1024
      && !this.applied.has(`${kind}:${id}`);
  }

  applySpark(scope: string, id: string, students: SparkStudent[], studentId: string, variant: SparkAwardVariant): SparkResult {
    const rejected: SparkResult = { accepted: false, students, variant, delta: 0 };
    if (!this.valid(scope, 'spark', id) || !REWARD_VARIANTS.includes(variant)
      || !students.some(student => student.id === studentId)) return rejected;
    const next = awardRewardToStudent(students, studentId, variant);
    this.applied.add(`spark:${id}`);
    return { accepted: true, students: next, student: next.find(student => student.id === studentId), variant, delta: 1 };
  }

  applyRelic(scope: string, id: string, system: RelicSystem, studentIds: string[], action: RelicAction): RelicResult {
    const rejected: RelicResult = { accepted: false, system, kind: null };
    if (!this.valid(scope, 'relic', id) || !['increase', 'decrease', 'reset', 'complete'].includes(action)) return rejected;
    const targets = [...new Set(studentIds)].filter(studentId => system.studentProgress[studentId]?.active === true);
    if (!targets.length) return rejected;
    const visible = { ...system, showOnStage: true };
    const next = action === 'increase' || action === 'decrease'
      ? applyRelicProgressDelta(visible, targets, action === 'increase' ? 1 : -1)
      : setRelicProgressForStudents(visible, targets, action === 'complete' ? 30 : 0);
    const crosses = (boundary: number) => targets.some(studentId =>
      system.studentProgress[studentId].progress < boundary && next.studentProgress[studentId].progress >= boundary);
    const kind: RelicResultKind = crosses(30) ? 'complete' : [1, 11, 21].some(crosses) ? 'stage' : 'progress';
    this.applied.add(`relic:${id}`);
    return { accepted: true, system: next, kind };
  }
}
