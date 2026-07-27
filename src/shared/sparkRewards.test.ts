import test from "node:test";
import assert from "node:assert/strict";
import {
  REWARD_VARIANTS,
  awardRewardToStudent,
  getRewardShapePath,
  getRewardVariantForKey,
  getStudentRewardTotal,
  normalizeSparkStudent,
  normalizeSparkStudents,
  resolveRewardAppearance,
  resetStudentRewards,
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
