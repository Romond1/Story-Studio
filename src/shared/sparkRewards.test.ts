import test from "node:test";
import assert from "node:assert/strict";
import {
  REWARD_VARIANTS,
  awardRewardToStudent,
  ensureRewardSprites,
  getRewardShapePath,
  getRewardVariantForKey,
  getStudentRewardTotal,
  normalizeSparkStudent,
  normalizeSparkStudents,
  moveRewardSpriteLayer,
  resolveRewardAppearance,
  resolveBadgeSpriteAssetId,
  resetStudentRewards,
  resizeRewardSprite,
  setRewardAssetId,
} from "./sparkRewards";

const legacyStudent = {
  id: "student-1",
  name: "Ada",
  yellowSparks: 2,
  blueSparks: 3,
  pinkSparks: 4,
  stars: 9,
  badgeVisible: true,
  badgeSparkVariant: "gold",
};

test("legacy students gain zero crowns without losing existing reward data", () => {
  const normalized = normalizeSparkStudent(legacyStudent, () => "generated");
  assert.ok(normalized);
  assert.equal(normalized.id, "student-1");
  assert.equal(normalized.yellowSparks, 2);
  assert.equal(normalized.blueSparks, 3);
  assert.equal(normalized.pinkSparks, 4);
  assert.equal(normalized.crowns, 0);
  assert.equal(normalized.stars, 9);
});

test("crowns add to the overall reward total", () => {
  assert.equal(getStudentRewardTotal({ ...legacyStudent, crowns: 2 }), 11);
});

test("awarding crown changes only the active student and derived total", () => {
  const students = [
    normalizeSparkStudent(legacyStudent, () => "unused")!,
    normalizeSparkStudent({ ...legacyStudent, id: "student-2", name: "Grace" }, () => "unused")!,
  ];
  const next = awardRewardToStudent(students, "student-2", "crown");
  assert.equal(next[0], students[0]);
  assert.equal(next[1].crowns, 1);
  assert.equal(next[1].stars, 10);
});

test("reset clears all four rewards", () => {
  const student = normalizeSparkStudent({ ...legacyStudent, crowns: 5 }, () => "unused")!;
  const [next] = resetStudentRewards([student], student.id);
  assert.deepEqual(
    [next.yellowSparks, next.blueSparks, next.pinkSparks, next.crowns, next.stars],
    [0, 0, 0, 0, 0],
  );
});

test("P maps to crown without changing the existing reward keys", () => {
  assert.equal(getRewardVariantForKey("["), "gold");
  assert.equal(getRewardVariantForKey("]"), "blue");
  assert.equal(getRewardVariantForKey("\\"), "pink");
  assert.equal(getRewardVariantForKey("p"), "crown");
  assert.equal(getRewardVariantForKey("P"), "crown");
  assert.equal(getRewardVariantForKey("q"), null);
});

test("all configured reward variants and shapes have renderable definitions", () => {
  assert.deepEqual(REWARD_VARIANTS, ["gold", "blue", "pink", "crown"]);
  for (const shape of ["star", "diamond", "circle", "heart", "crown"] as const) {
    assert.match(getRewardShapePath(shape), /^M/);
  }
});

test("student list normalization filters invalid entries and normalizes legacy students", () => {
  let nextId = 0;
  const normalized = normalizeSparkStudents(
    [null, legacyStudent, "invalid"],
    () => `generated-${++nextId}`,
  );
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "student-1");
  assert.equal(normalized[0].crowns, 0);
  assert.equal(normalized[0].stars, 9);
});

test("normalization clamps invalid counts and preserves supported metadata", () => {
  const normalized = normalizeSparkStudent({
    ...legacyStudent,
    yellowSparks: -3,
    blueSparks: Number.NaN,
    pinkSparks: 4,
    crowns: 2,
    badgeVisible: false,
    badgeSparkVariant: "crown",
  }, () => "unused")!;
  assert.equal(normalized.yellowSparks, 0);
  assert.equal(normalized.blueSparks, 0);
  assert.equal(normalized.pinkSparks, 4);
  assert.equal(normalized.crowns, 2);
  assert.equal(normalized.stars, 6);
  assert.equal(normalized.badgeVisible, false);
  assert.equal(normalized.badgeSparkVariant, "crown");
});

test("custom assets override shapes and missing assets fall back to the configured shape", () => {
  const config = { shapeByVariant: { crown: "heart" as const } };
  const badge = { badgeSparkAssetIds: { crown: "asset-crown" } };
  assert.deepEqual(resolveRewardAppearance("crown", config, badge, new Set(["asset-crown"])), {
    shape: "heart",
    assetId: "asset-crown",
  });
  assert.deepEqual(resolveRewardAppearance("crown", config, badge, new Set()), {
    shape: "heart",
    assetId: undefined,
  });
});

test("setting and removing one reward PNG preserves the other asset slots", () => {
  const initial = { gold: "gold-image", blue: "blue-image" };
  const withCrown = setRewardAssetId(initial, "crown", "crown-image");
  assert.deepEqual(withCrown, {
    gold: "gold-image",
    blue: "blue-image",
    crown: "crown-image",
  });
  assert.deepEqual(initial, { gold: "gold-image", blue: "blue-image" });
  assert.deepEqual(setRewardAssetId(withCrown, "crown", undefined), {
    gold: "gold-image",
    blue: "blue-image",
  });
});

test("adding missing reward sprites preserves every existing sprite record", () => {
  const existing = [
    { id: "gold-1", studentId: "student-1", variant: "gold" as const, x: 10, y: 20, width: 140, height: 170, zIndex: 20 },
    { id: "blue-1", studentId: "student-1", variant: "blue" as const, x: 150, y: 20, width: 140, height: 170, zIndex: 21 },
  ];
  const student = normalizeSparkStudent(legacyStudent, () => "unused")!;
  let nextId = 0;
  const next = ensureRewardSprites(existing, [student], () => `new-${++nextId}`);
  assert.equal(next[0], existing[0]);
  assert.equal(next[1], existing[1]);
  assert.ok(next.find((sprite) => sprite.variant === "pink"));
  const crown = next.find((sprite) => sprite.variant === "crown");
  assert.ok(crown);
  assert.equal(crown.width, crown.height);
});

test("aspect locked resize clamps width and keeps the saved ratio", () => {
  const sprite = { id: "s", studentId: "student-1", variant: "crown" as const, x: 0, y: 0, width: 200, height: 100 };
  assert.deepEqual(resizeRewardSprite(sprite, 800, { min: 60, max: 420 }), {
    width: 420,
    height: 210,
  });
});

test("layer controls move only the selected sprite", () => {
  const sprites = [
    { id: "a", studentId: "student-1", x: 0, y: 0, width: 100, height: 100, zIndex: 20 },
    { id: "b", studentId: "student-1", x: 0, y: 0, width: 100, height: 100, zIndex: 21 },
  ];
  const next = moveRewardSpriteLayer(sprites, "a", "forward");
  assert.equal(next.find((sprite) => sprite.id === "a")?.zIndex, 22);
  assert.equal(next.find((sprite) => sprite.id === "b")?.zIndex, 21);
});

test("each student badge sprite can override the shared crown image independently", () => {
  const firstStudentCrown = {
    id: "crown-1",
    studentId: "student-1",
    variant: "crown" as const,
    assetId: "ada-crown",
    x: 0,
    y: 0,
    width: 140,
    height: 140,
  };
  const secondStudentCrown = {
    ...firstStudentCrown,
    id: "crown-2",
    studentId: "student-2",
    assetId: "grace-crown",
  };
  const badgeConfig = { badgeSparkAssetIds: { crown: "shared-crown" } };
  const available = new Set(["ada-crown", "grace-crown", "shared-crown"]);

  assert.equal(resolveBadgeSpriteAssetId(firstStudentCrown, "crown", badgeConfig, available), "ada-crown");
  assert.equal(resolveBadgeSpriteAssetId(secondStudentCrown, "crown", badgeConfig, available), "grace-crown");
  assert.equal(
    resolveBadgeSpriteAssetId({ ...secondStudentCrown, assetId: "missing" }, "crown", badgeConfig, available),
    "shared-crown",
  );
});
