import type { SparkAwardVariant, SparkStudent, StudentRosterEntry } from '../types';
import { awardRewardToStudent, normalizeSparkStudent, resetStudentRewards, REWARD_VARIANTS } from '../sparkRewards';
import { DEFAULT_BADGE_CONFIG, DEFAULT_SPARK_CONFIG } from '../rewardDefaults';
import { cleanBadgeConfig, cleanSparkConfig, parseRewardPresentation, sparkLifetime, type FinalBadgeVisual, type RewardPresentation, type SparkVisual } from '../rewardPresentation';
import type { LessonSession } from './model';
import { parseRewardAppearance, type RewardAppearance } from '../rewardAppearance';

export interface LessonRewardState {
  appearance?: RewardAppearance;
  students: SparkStudent[];
  activeStudentId: string;
  sparks: SparkVisual[];
  final?: FinalBadgeVisual;
  /** Acceptance survives animation expiry/reset; duplicate events never rescore. */
  appliedEventIds: string[];
}

const update = (session: LessonSession, rewards: LessonRewardState): LessonSession => ({ ...session, rewards, revision: session.revision + 1 });
const validId = (id: string) => typeof id === 'string' && id.length > 0 && id.length <= 1024;
const accepts = (state: LessonRewardState | undefined, eventId: string): state is LessonRewardState => !!state && validId(eventId) && !state.appliedEventIds.includes(eventId);
const student = (id: string, name: string): SparkStudent => normalizeSparkStudent({ id, name: name.trim().slice(0, 200) }, () => id)!;
const totals = (students: SparkStudent[]): FinalBadgeVisual['students'] => students.filter(value => value.badgeVisible !== false).map(({ id, name, yellowSparks, blueSparks, pinkSparks, crowns, stars }) => ({ id, name, yellowSparks, blueSparks, pinkSparks, crowns, stars }));
const refreshFinal = (state: LessonRewardState, students: SparkStudent[]) => state.final ? { ...state.final, students: totals(students) } : undefined;

export function initializeLessonRewards(session: LessonSession, roster: StudentRosterEntry[]): LessonSession {
  if (session.rewards) return session;
  const seen = new Set<string>();
  const students = roster.filter(value => !value.archived && validId(value.id) && value.name.trim() && !seen.has(value.id) && !!seen.add(value.id)).map(value => student(value.id, value.name));
  if (!students.length) students.push(student('lesson-class', 'Class'));
  return update(session, { students, activeStudentId: students[0].id, sparks: [], appliedEventIds: [] });
}

export function selectLessonRewardStudent(session: LessonSession, id: string): LessonSession {
  const state = session.rewards;
  return !state || state.activeStudentId === id || !state.students.some(value => value.id === id) ? session : update(session, { ...state, activeStudentId: id });
}

export function setLessonRewardAppearance(session: LessonSession, value: unknown): LessonSession {
  const appearance = parseRewardAppearance(value), state = session.rewards;
  if (!state || !appearance || JSON.stringify(state.appearance) === JSON.stringify(appearance)) return session;
  return update(session, { ...state, appearance });
}

export function addLessonRewardStudent(session: LessonSession, name: string, id: string): LessonSession {
  if (!validId(id) || typeof name !== 'string' || !name.trim()) return session;
  const initialized = initializeLessonRewards(session, []), state = initialized.rewards!;
  if (state.students.some(value => value.id === id)) return session;
  const students = [...state.students, student(id, name)];
  return update(session, { ...state, students, activeStudentId: id, final: refreshFinal(state, students) });
}

export function awardLessonReward(session: LessonSession, variant: SparkAwardVariant, eventId: string, now: number): LessonSession {
  const state = session.rewards;
  if (!accepts(state, eventId) || !REWARD_VARIANTS.includes(variant) || !Number.isFinite(now) || now < 0) return session;
  const active = state.students.find(value => value.id === state.activeStudentId); if (!active) return session;
  const students = awardRewardToStudent(state.students, state.activeStudentId, variant);
  const config = cleanSparkConfig(DEFAULT_SPARK_CONFIG);
  const appearance = state.appearance;
  if (appearance) {
    config.particleCount = Math.round(config.particleCount * appearance.intensity);
    config.glowIntensity *= appearance.intensity;
    config.scalePopIntensity = 1 + (config.scalePopIntensity - 1) * appearance.intensity;
  }
  const visual: SparkVisual = { id: eventId, startedAt: now, expiresAt: sparkLifetime(now, config.burstDurationMs, config.counterVisibleMs, variant), variant, studentName: active.name, delta: 1, config, ...(appearance ? { appearance: { ...appearance } } : {}) };
  return update(session, { ...state, students, sparks: [...state.sparks.filter(value => value.expiresAt > now).slice(-999), visual], final: refreshFinal(state, students), appliedEventIds: [...state.appliedEventIds, eventId] });
}

export function resetLessonStudentRewards(session: LessonSession, eventId: string): LessonSession {
  const state = session.rewards;
  if (!accepts(state, eventId)) return session;
  const students = resetStudentRewards(state.students, state.activeStudentId);
  return update(session, { ...state, students, sparks: [], final: refreshFinal(state, students), appliedEventIds: [...state.appliedEventIds, eventId] });
}

export function showLessonCelebration(session: LessonSession, eventId: string, now: number): LessonSession {
  const state = session.rewards;
  if (!accepts(state, eventId) || !Number.isFinite(now) || now < 0) return session;
  const config = cleanBadgeConfig(DEFAULT_BADGE_CONFIG);
  if (state.appearance) {
    config.confettiCount = Math.round((config.confettiCount ?? 30) * state.appearance.intensity);
    config.animation = { ...config.animation, glowIntensity: (config.animation?.glowIntensity ?? 100) * state.appearance.intensity, motionIntensity: (config.animation?.motionIntensity ?? 100) * state.appearance.intensity };
  }
  const final: FinalBadgeVisual = { id: eventId, startedAt: now, expiresAt: now + (config.celebrationDurationMs ?? 5000), config, students: totals(state.students) };
  return update(session, { ...state, final, appliedEventIds: [...state.appliedEventIds, eventId] });
}

export function hideLessonCelebration(session: LessonSession, eventId: string): LessonSession {
  const state = session.rewards;
  if (!accepts(state, eventId)) return session;
  return update(session, { ...state, final: undefined, appliedEventIds: [...state.appliedEventIds, eventId] });
}

export function pruneLessonRewards(session: LessonSession, now: number): LessonSession {
  const state = session.rewards; if (!state) return session;
  const sparks = state.sparks.filter(value => value.expiresAt > now);
  const final = state.final?.expiresAt !== undefined && state.final.expiresAt <= now ? undefined : state.final;
  return sparks.length === state.sparks.length && final === state.final ? session : update(session, { ...state, sparks, final });
}

/** Only resolved visible events cross to Present, never the runtime roster or ledger. */
export function projectLessonRewards(state: LessonRewardState, frame: { width: number; height: number }): RewardPresentation {
  const result = parseRewardPresentation({ frame, sparks: state.sparks, ...(state.final ? { final: state.final } : {}) });
  if (!result) throw new Error('Lesson reward visuals could not be projected.');
  return result;
}
