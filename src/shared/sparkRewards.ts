import type {
  BadgeConfig,
  BadgeStudentSprite,
  SparkAwardVariant,
  SparkConfig,
  SparkShape,
  SparkStudent,
} from "./types";

export const REWARD_VARIANTS = ["gold", "blue", "pink", "crown"] as const;

export const REWARD_DEFINITIONS: Record<
  SparkAwardVariant,
  {
    label: string;
    countField: "yellowSparks" | "blueSparks" | "pinkSparks" | "crowns";
    defaultShape: SparkShape;
    colorRgb: string;
  }
> = {
  gold: { label: "Yellow", countField: "yellowSparks", defaultShape: "star", colorRgb: "255, 215, 0" },
  blue: { label: "Blue", countField: "blueSparks", defaultShape: "star", colorRgb: "0, 191, 255" },
  pink: { label: "Pink", countField: "pinkSparks", defaultShape: "star", colorRgb: "255, 105, 180" },
  crown: { label: "Crown", countField: "crowns", defaultShape: "crown", colorRgb: "255, 184, 48" },
};

const SHAPE_PATHS: Record<SparkShape, string> = {
  star: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
  diamond: "M12 2L22 12L12 22L2 12Z",
  circle: "M12 2A10 10 0 1 1 11.999 2Z",
  heart: "M12 21L10.55 19.68C5.4 15.02 2 11.94 2 8.17C2 5.09 4.42 2.67 7.5 2.67C9.24 2.67 10.91 3.48 12 4.76C13.09 3.48 14.76 2.67 16.5 2.67C19.58 2.67 22 5.09 22 8.17C22 11.94 18.6 15.02 13.45 19.69Z",
  crown: "M3 18L2 6L7.5 11L12 3L16.5 11L22 6L21 18ZM4 21V19H20V21Z",
};

function safeCount(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

export function getRewardShapePath(shape: SparkShape): string {
  return SHAPE_PATHS[shape];
}

export function getStudentRewardTotal(
  student: Pick<SparkStudent, "yellowSparks" | "blueSparks" | "pinkSparks">
    & Partial<Pick<SparkStudent, "crowns">>,
): number {
  return safeCount(student.yellowSparks)
    + safeCount(student.blueSparks)
    + safeCount(student.pinkSparks)
    + safeCount(student.crowns);
}

export function normalizeSparkStudent(
  value: unknown,
  createId: () => string,
): SparkStudent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const student: SparkStudent = {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Student",
    yellowSparks: safeCount(raw.yellowSparks),
    blueSparks: safeCount(raw.blueSparks),
    pinkSparks: safeCount(raw.pinkSparks),
    crowns: safeCount(raw.crowns),
    stars: 0,
    badgeVisible: raw.badgeVisible !== false,
    badgeSparkVariant: REWARD_VARIANTS.includes(raw.badgeSparkVariant as SparkAwardVariant)
      ? raw.badgeSparkVariant as SparkAwardVariant
      : "gold",
  };
  student.stars = getStudentRewardTotal(student);
  return student;
}

export function awardRewardToStudent(
  students: SparkStudent[],
  activeStudentId: string,
  variant: SparkAwardVariant,
): SparkStudent[] {
  const field = REWARD_DEFINITIONS[variant].countField;
  return students.map((student) => {
    if (student.id !== activeStudentId) return student;
    const next = { ...student, [field]: safeCount(student[field]) + 1 };
    return { ...next, stars: getStudentRewardTotal(next) };
  });
}

export function resetStudentRewards(students: SparkStudent[], activeStudentId: string): SparkStudent[] {
  return students.map((student) => student.id === activeStudentId
    ? { ...student, yellowSparks: 0, blueSparks: 0, pinkSparks: 0, crowns: 0, stars: 0 }
    : student);
}

export function getRewardVariantForKey(key: string): SparkAwardVariant | null {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  if (normalized === "[") return "gold";
  if (normalized === "]") return "blue";
  if (normalized === "\\") return "pink";
  if (normalized === "p") return "crown";
  return null;
}

export function normalizeSparkStudents(input: unknown, createId: () => string): SparkStudent[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeSparkStudent(item, createId))
    .filter((item): item is SparkStudent => item !== null);
}

export function resolveRewardAppearance(
  variant: SparkAwardVariant,
  sparkConfig: Pick<SparkConfig, "shapeByVariant">,
  badgeConfig: Pick<BadgeConfig, "badgeSparkAssetIds">,
  availableAssetIds: ReadonlySet<string>,
): { shape: SparkShape; assetId?: string } {
  const shape = sparkConfig.shapeByVariant?.[variant] ?? REWARD_DEFINITIONS[variant].defaultShape;
  const configuredAssetId = badgeConfig.badgeSparkAssetIds?.[variant];
  return {
    shape,
    assetId: configuredAssetId && availableAssetIds.has(configuredAssetId)
      ? configuredAssetId
      : undefined,
  };
}

export function setRewardAssetId(
  current: BadgeConfig["badgeSparkAssetIds"] | undefined,
  variant: SparkAwardVariant,
  assetId: string | undefined,
): NonNullable<BadgeConfig["badgeSparkAssetIds"]> {
  const next = { ...(current || {}) };
  if (assetId) next[variant] = assetId;
  else delete next[variant];
  return next;
}

export function ensureRewardSprites(
  sprites: BadgeStudentSprite[],
  students: SparkStudent[],
  createId: () => string,
): BadgeStudentSprite[] {
  const next = [...sprites];
  for (const [studentIndex, student] of students.filter((item) => item.badgeVisible !== false).entries()) {
    let nextX = next
      .filter((sprite) => sprite.studentId === student.id)
      .reduce((right, sprite) => Math.max(right, sprite.x + sprite.width + 18), 70 + studentIndex * 30);
    for (const [variantIndex, variant] of REWARD_VARIANTS.entries()) {
      if (next.some((sprite) => sprite.studentId === student.id && (sprite.variant || "gold") === variant)) continue;
      const size = variant === "crown" ? { width: 140, height: 140 } : { width: 140, height: 170 };
      next.push({
        id: createId(),
        studentId: student.id,
        variant,
        x: Math.min(nextX, 1500),
        y: 100 + (studentIndex % 2) * 180 + (variantIndex % 2) * 18,
        ...size,
        zIndex: 20 + studentIndex * REWARD_VARIANTS.length + variantIndex,
      });
      nextX += size.width + 18;
    }
  }
  return next;
}

export function resizeRewardSprite(
  sprite: BadgeStudentSprite,
  requestedWidth: number,
  bounds: { min: number; max: number } = { min: 60, max: 420 },
): Pick<BadgeStudentSprite, "width" | "height"> {
  const width = Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(requestedWidth) ? requestedWidth : sprite.width));
  const ratio = sprite.width > 0 && sprite.height > 0 ? sprite.width / sprite.height : 1;
  return { width: Math.round(width), height: Math.round(width / ratio) };
}

export function moveRewardSpriteLayer(
  sprites: BadgeStudentSprite[],
  spriteId: string,
  direction: "forward" | "backward",
): BadgeStudentSprite[] {
  const values = sprites.map((sprite) => sprite.zIndex ?? 20);
  if (!sprites.some((sprite) => sprite.id === spriteId) || values.length === 0) return sprites;
  const zIndex = direction === "forward"
    ? Math.min(9999, Math.max(...values) + 1)
    : Math.max(-9999, Math.min(...values) - 1);
  return sprites.map((sprite) => sprite.id === spriteId ? { ...sprite, zIndex } : sprite);
}
