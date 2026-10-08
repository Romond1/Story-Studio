import type {
  BadgeConfig,
  SparkAwardVariant,
  SparkConfig,
  SparkShape,
} from "./types";
export interface RewardAnchor {
  id: string;
  startedAt: number;
  expiresAt?: number;
}
export interface SparkVisual extends RewardAnchor {
  expiresAt: number;
  variant: SparkAwardVariant;
  studentName: string;
  delta: number;
  config: SparkConfig;
  image?: string;
}
export interface FinalBadgeVisual extends RewardAnchor {
  config: BadgeConfig;
  scrollTop?: number;
  image?: string;
  students: {
    id: string;
    name: string;
    yellowSparks: number;
    blueSparks: number;
    pinkSparks: number;
    crowns: number;
    stars: number;
  }[];
}
export interface BadgeBaseVisual {
  image?: string;
  background?: {
    image: string;
    posX: number;
    posY: number;
    scale: number;
    blur: number;
    brightness: number;
  };
  sprites: {
    id: string;
    name: string;
    variant: SparkAwardVariant;
    shape: SparkShape;
    image?: string;
    score: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  }[];
  motion: string;
  durationMs: number;
  intensity: number;
  startedAt: number;
}
export interface RelicVisual {
  title: string;
  names: string[];
  rows: { name: string; progress: number }[];
  progress: number;
  stageTitle: string;
  progressLabel: string;
  image?: string;
  rewardImage?: string;
  position: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  entrance: string;
  style: string;
  durationMs: number;
  intensity: number;
  visible: boolean;
  visibility: RewardAnchor;
  event?: RewardAnchor & { kind: string };
  reward?: RewardAnchor;
}
export interface RewardPresentation {
  frame: { width: number; height: number };
  sparks: SparkVisual[];
  final?: FinalBadgeVisual;
  base?: BadgeBaseVisual;
  relic?: RelicVisual;
}
export const rewardAge = (
  event: Pick<RewardAnchor, "startedAt">,
  now: number,
) => Math.max(0, now - event.startedAt);

/** CSS advances after mount; refresh the negative delay only when its animation
 * identity changes, including a return from a progress event to visibility. */
export class RewardAnimationClock {
  private key?: string;
  private elapsed = 0;
  age(key: string, startedAt: number, now: number): number {
    if (key !== this.key) {
      this.key = key;
      this.elapsed = Math.max(0, now - startedAt);
    }
    return this.elapsed;
  }
}
export const rewardRemaining = (
  event: Pick<RewardAnchor, "expiresAt">,
  now: number,
) =>
  event.expiresAt === undefined ? Infinity : Math.max(0, event.expiresAt - now);
export const sparkLifetime = (
  now: number,
  burst: number,
  counter: number,
  variant: SparkAwardVariant,
) => now + Math.max(burst * (variant === "crown" ? 1.35 : 1), counter);
export function rewardRandom(id: string): () => number {
  let state = 2166136261;
  for (const character of id)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Obj = Record<string, any>;
/** A delayed wheel/scroll callback cannot move a newer celebration. */
export function setFinalBadgeScroll(current: FinalBadgeVisual | undefined, id: string, scrollTop: number): FinalBadgeVisual | undefined {
  if (!current || current.id !== id || !Number.isFinite(scrollTop)) return current;
  const next = Math.max(0, Math.min(10000000, scrollTop));
  return next === (current.scrollTop ?? 0) ? current : { ...current, scrollTop: next };
}
const obj = (v: unknown): Obj => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("object");
  return v;
};
const num = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw Error("number");
  return v;
};
const str = (v: unknown): string => {
  if (typeof v !== "string" || v.length > 32768) throw Error("string");
  return v;
};
const choice = <T extends string>(v: unknown, choices: readonly T[]): T => {
  if (!choices.includes(v as T)) throw Error("choice");
  return v as T;
};
const url = (v: unknown): string | undefined => {
  if (v === undefined) return;
  const s = str(v);
  if (!s.startsWith("media://")) throw Error("media");
  return s;
};
const nums = (raw: Obj, keys: string[]): Obj =>
  Object.fromEntries(
    keys.filter((k) => raw[k] !== undefined).map((k) => [k, num(raw[k])]),
  );
const variants = ["gold", "blue", "pink", "crown"] as const;
const shapes = ["star", "diamond", "circle", "heart", "crown"] as const;
function anchor(raw: Obj): RewardAnchor {
  const id = str(raw.id),
    startedAt = num(raw.startedAt);
  if (!id || startedAt < 0) throw Error("anchor");
  const expiresAt =
    raw.expiresAt === undefined ? undefined : num(raw.expiresAt);
  if (expiresAt !== undefined && expiresAt < startedAt) throw Error("expiry");
  return { id, startedAt, ...(expiresAt === undefined ? {} : { expiresAt }) };
}
export function cleanSparkConfig(value: unknown): SparkConfig {
  const v = obj(value),
    keys = [
      "burstDurationMs",
      "particleCount",
      "glowIntensity",
      "colorIntensity",
      "counterVisibleMs",
      "scalePopIntensity",
      "counterSize",
      "sparkSize",
      "positionTop",
      "positionRight",
    ];
  for (const k of keys) num(v[k]);
  if (
    v.particleCount < 0 ||
    v.particleCount > 1000 ||
    v.burstDurationMs < 0 ||
    v.counterVisibleMs < 0
  )
    throw Error("config");
  return {
    ...nums(v, keys),
    ...(v.shapeByVariant
      ? {
          shapeByVariant: Object.fromEntries(
            variants
              .filter((k) => v.shapeByVariant[k] !== undefined)
              .map((k) => [k, choice(v.shapeByVariant[k], shapes)]),
          ),
        }
      : {}),
  } as SparkConfig;
}
export function cleanBadgeConfig(value: unknown): BadgeConfig {
  const v = obj(value);
  return {
    ...nums(v, ["fontSize", "confettiCount", "celebrationDurationMs"]),
    ...(v.alwaysDisplay === true ? { alwaysDisplay: true } : {}),
    ...(v.background
      ? {
          background: nums(obj(v.background), [
            "posX",
            "posY",
            "scale",
            "blur",
            "brightness",
          ]),
        }
      : {}),
    ...(v.animation
      ? {
          animation: {
            ...nums(obj(v.animation), [
              "durationMs",
              "rotationDeg",
              "colorIntensity",
              "glowIntensity",
              "motionIntensity",
            ]),
            ...(v.animation.motionType === undefined
              ? {}
              : {
                  motionType: choice(v.animation.motionType, [
                    "zoomPop",
                    "slideUp",
                    "fadeIn",
                    "spinPop",
                  ] as const),
                }),
          },
        }
      : {}),
  };
}
/** Reconstruct only rendered student data. Never carry project, roster or library objects. */
export function parseRewardPresentation(
  value: unknown,
): RewardPresentation | null {
  try {
    const v = obj(value),
      f = obj(v.frame),
      frame = { width: num(f.width), height: num(f.height) };
    if (
      frame.width <= 0 ||
      frame.height <= 0 ||
      !Array.isArray(v.sparks) ||
      v.sparks.length > 1000
    )
      return null;
    const sparks: SparkVisual[] = v.sparks.map((r: unknown) => {
      const s = obj(r),
        a = anchor(s);
      if (a.expiresAt === undefined) throw Error("expiry");
      return {
        ...a,
        expiresAt: a.expiresAt,
        variant: choice(s.variant, variants),
        studentName: str(s.studentName),
        delta: num(s.delta),
        config: cleanSparkConfig(s.config),
        ...(url(s.image) ? { image: url(s.image) } : {}),
      };
    });
    const result: RewardPresentation = { frame, sparks };
    if (v.final) {
      const b = obj(v.final);
      if (!Array.isArray(b.students)) return null;
      result.final = {
        ...anchor(b),
        config: cleanBadgeConfig(b.config),
        ...(b.scrollTop === undefined ? {} : { scrollTop: Math.max(0, Math.min(10000000, num(b.scrollTop))) }),
        ...(url(b.image) ? { image: url(b.image) } : {}),
        students: b.students.map((r: unknown) => {
          const s = obj(r);
          return {
            id: str(s.id),
            name: str(s.name),
            yellowSparks: num(s.yellowSparks),
            blueSparks: num(s.blueSparks),
            pinkSparks: num(s.pinkSparks),
            crowns: num(s.crowns),
            stars: num(s.stars),
          };
        }),
      };
    }
    if (v.base) {
      const b = obj(v.base);
      if (!Array.isArray(b.sprites)) return null;
      result.base = {
        ...(url(b.image) ? { image: url(b.image) } : {}),
        motion: choice(b.motion, ["spin", "breathe", "zoom"]),
        durationMs: num(b.durationMs),
        intensity: num(b.intensity),
        startedAt: num(b.startedAt),
        sprites: b.sprites.map((r: unknown) => {
          const s = obj(r);
          return {
            id: str(s.id),
            name: str(s.name),
            variant: choice(s.variant, variants),
            shape: choice(s.shape, shapes),
            ...(url(s.image) ? { image: url(s.image) } : {}),
            score: str(s.score),
            ...Object.fromEntries(
              ["x", "y", "width", "height", "zIndex"].map((k) => [
                k,
                num(s[k]),
              ]),
            ),
          } as BadgeBaseVisual["sprites"][number];
        }),
      };
      if (b.background) {
        const bg = obj(b.background);
        const image = url(bg.image);
        if (!image) return null;
        result.base.background = {
          image,
          ...Object.fromEntries(
            ["posX", "posY", "scale", "blur", "brightness"].map((k) => [
              k,
              num(bg[k]),
            ]),
          ),
        } as NonNullable<BadgeBaseVisual["background"]>;
      }
    }
    if (v.relic) {
      const r = obj(v.relic);
      result.relic = {
        title: str(r.title),
        names: r.names.map(str),
        rows: r.rows.map((s: Obj) => ({
          name: str(s.name),
          progress: num(s.progress),
        })),
        progress: num(r.progress),
        stageTitle: str(r.stageTitle),
        progressLabel: str(r.progressLabel),
        ...(url(r.image) ? { image: url(r.image) } : {}),
        ...(url(r.rewardImage) ? { rewardImage: url(r.rewardImage) } : {}),
        position: choice(r.position, [
          "topLeft",
          "topRight",
          "bottomLeft",
          "bottomRight",
          "centerBottom",
        ]),
        x: num(r.x),
        y: num(r.y),
        scale: num(r.scale),
        opacity: num(r.opacity),
        entrance: choice(r.entrance, [
          "none",
          "fade",
          "pop",
          "slideUp",
          "zoom",
        ]),
        style: str(r.style),
        durationMs: num(r.durationMs),
        intensity: num(r.intensity),
        visible: r.visible === true,
        visibility: anchor(obj(r.visibility)),
        ...(r.event
          ? {
              event: {
                ...anchor(obj(r.event)),
                kind: choice(r.event.kind, ["progress", "stage", "complete"]),
              },
            }
          : {}),
        ...(r.reward ? { reward: anchor(obj(r.reward)) } : {}),
      };
    }
    return result;
  } catch {
    return null;
  }
}
