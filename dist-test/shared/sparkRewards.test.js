"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const sparkRewards_1 = require("./sparkRewards");
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
(0, node_test_1.default)("legacy students gain zero crowns without losing existing reward data", () => {
    const normalized = (0, sparkRewards_1.normalizeSparkStudent)(legacyStudent, () => "generated");
    strict_1.default.ok(normalized);
    strict_1.default.equal(normalized.id, "student-1");
    strict_1.default.equal(normalized.yellowSparks, 2);
    strict_1.default.equal(normalized.blueSparks, 3);
    strict_1.default.equal(normalized.pinkSparks, 4);
    strict_1.default.equal(normalized.crowns, 0);
    strict_1.default.equal(normalized.stars, 9);
});
(0, node_test_1.default)("crowns add to the overall reward total", () => {
    strict_1.default.equal((0, sparkRewards_1.getStudentRewardTotal)({ ...legacyStudent, crowns: 2 }), 11);
});
(0, node_test_1.default)("awarding crown changes only the active student and derived total", () => {
    const students = [
        (0, sparkRewards_1.normalizeSparkStudent)(legacyStudent, () => "unused"),
        (0, sparkRewards_1.normalizeSparkStudent)({ ...legacyStudent, id: "student-2", name: "Grace" }, () => "unused"),
    ];
    const next = (0, sparkRewards_1.awardRewardToStudent)(students, "student-2", "crown");
    strict_1.default.equal(next[0], students[0]);
    strict_1.default.equal(next[1].crowns, 1);
    strict_1.default.equal(next[1].stars, 10);
});
(0, node_test_1.default)("reset clears all four rewards", () => {
    const student = (0, sparkRewards_1.normalizeSparkStudent)({ ...legacyStudent, crowns: 5 }, () => "unused");
    const [next] = (0, sparkRewards_1.resetStudentRewards)([student], student.id);
    strict_1.default.deepEqual([next.yellowSparks, next.blueSparks, next.pinkSparks, next.crowns, next.stars], [0, 0, 0, 0, 0]);
});
(0, node_test_1.default)("P maps to crown without changing the existing reward keys", () => {
    strict_1.default.equal((0, sparkRewards_1.getRewardVariantForKey)("["), "gold");
    strict_1.default.equal((0, sparkRewards_1.getRewardVariantForKey)("]"), "blue");
    strict_1.default.equal((0, sparkRewards_1.getRewardVariantForKey)("\\"), "pink");
    strict_1.default.equal((0, sparkRewards_1.getRewardVariantForKey)("p"), "crown");
    strict_1.default.equal((0, sparkRewards_1.getRewardVariantForKey)("P"), "crown");
    strict_1.default.equal((0, sparkRewards_1.getRewardVariantForKey)("q"), null);
});
(0, node_test_1.default)("all configured reward variants and shapes have renderable definitions", () => {
    strict_1.default.deepEqual(sparkRewards_1.REWARD_VARIANTS, ["gold", "blue", "pink", "crown"]);
    for (const shape of ["star", "diamond", "circle", "heart", "crown"]) {
        strict_1.default.match((0, sparkRewards_1.getRewardShapePath)(shape), /^M/);
    }
});
(0, node_test_1.default)("student list normalization filters invalid entries and normalizes legacy students", () => {
    let nextId = 0;
    const normalized = (0, sparkRewards_1.normalizeSparkStudents)([null, legacyStudent, "invalid"], () => `generated-${++nextId}`);
    strict_1.default.equal(normalized.length, 1);
    strict_1.default.equal(normalized[0].id, "student-1");
    strict_1.default.equal(normalized[0].crowns, 0);
    strict_1.default.equal(normalized[0].stars, 9);
});
(0, node_test_1.default)("normalization clamps invalid counts and preserves supported metadata", () => {
    const normalized = (0, sparkRewards_1.normalizeSparkStudent)({
        ...legacyStudent,
        yellowSparks: -3,
        blueSparks: Number.NaN,
        pinkSparks: 4,
        crowns: 2,
        badgeVisible: false,
        badgeSparkVariant: "crown",
    }, () => "unused");
    strict_1.default.equal(normalized.yellowSparks, 0);
    strict_1.default.equal(normalized.blueSparks, 0);
    strict_1.default.equal(normalized.pinkSparks, 4);
    strict_1.default.equal(normalized.crowns, 2);
    strict_1.default.equal(normalized.stars, 6);
    strict_1.default.equal(normalized.badgeVisible, false);
    strict_1.default.equal(normalized.badgeSparkVariant, "crown");
});
(0, node_test_1.default)("custom assets override shapes and missing assets fall back to the configured shape", () => {
    const config = { shapeByVariant: { crown: "heart" } };
    const badge = { badgeSparkAssetIds: { crown: "asset-crown" } };
    strict_1.default.deepEqual((0, sparkRewards_1.resolveRewardAppearance)("crown", config, badge, new Set(["asset-crown"])), {
        shape: "heart",
        assetId: "asset-crown",
    });
    strict_1.default.deepEqual((0, sparkRewards_1.resolveRewardAppearance)("crown", config, badge, new Set()), {
        shape: "heart",
        assetId: undefined,
    });
});
(0, node_test_1.default)("setting and removing one reward PNG preserves the other asset slots", () => {
    const initial = { gold: "gold-image", blue: "blue-image" };
    const withCrown = (0, sparkRewards_1.setRewardAssetId)(initial, "crown", "crown-image");
    strict_1.default.deepEqual(withCrown, {
        gold: "gold-image",
        blue: "blue-image",
        crown: "crown-image",
    });
    strict_1.default.deepEqual(initial, { gold: "gold-image", blue: "blue-image" });
    strict_1.default.deepEqual((0, sparkRewards_1.setRewardAssetId)(withCrown, "crown", undefined), {
        gold: "gold-image",
        blue: "blue-image",
    });
});
(0, node_test_1.default)("adding missing reward sprites preserves every existing sprite record", () => {
    const existing = [
        { id: "gold-1", studentId: "student-1", variant: "gold", x: 10, y: 20, width: 140, height: 170, zIndex: 20 },
        { id: "blue-1", studentId: "student-1", variant: "blue", x: 150, y: 20, width: 140, height: 170, zIndex: 21 },
    ];
    const student = (0, sparkRewards_1.normalizeSparkStudent)(legacyStudent, () => "unused");
    let nextId = 0;
    const next = (0, sparkRewards_1.ensureRewardSprites)(existing, [student], () => `new-${++nextId}`);
    strict_1.default.equal(next[0], existing[0]);
    strict_1.default.equal(next[1], existing[1]);
    strict_1.default.ok(next.find((sprite) => sprite.variant === "pink"));
    const crown = next.find((sprite) => sprite.variant === "crown");
    strict_1.default.ok(crown);
    strict_1.default.equal(crown.width, crown.height);
});
(0, node_test_1.default)("aspect locked resize clamps width and keeps the saved ratio", () => {
    const sprite = { id: "s", studentId: "student-1", variant: "crown", x: 0, y: 0, width: 200, height: 100 };
    strict_1.default.deepEqual((0, sparkRewards_1.resizeRewardSprite)(sprite, 800, { min: 60, max: 420 }), {
        width: 420,
        height: 210,
    });
});
(0, node_test_1.default)("layer controls move only the selected sprite", () => {
    const sprites = [
        { id: "a", studentId: "student-1", x: 0, y: 0, width: 100, height: 100, zIndex: 20 },
        { id: "b", studentId: "student-1", x: 0, y: 0, width: 100, height: 100, zIndex: 21 },
    ];
    const next = (0, sparkRewards_1.moveRewardSpriteLayer)(sprites, "a", "forward");
    strict_1.default.equal(next.find((sprite) => sprite.id === "a")?.zIndex, 22);
    strict_1.default.equal(next.find((sprite) => sprite.id === "b")?.zIndex, 21);
});
(0, node_test_1.default)("each student badge sprite can override the shared crown image independently", () => {
    const firstStudentCrown = {
        id: "crown-1",
        studentId: "student-1",
        variant: "crown",
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
    strict_1.default.equal((0, sparkRewards_1.resolveBadgeSpriteAssetId)(firstStudentCrown, "crown", badgeConfig, available), "ada-crown");
    strict_1.default.equal((0, sparkRewards_1.resolveBadgeSpriteAssetId)(secondStudentCrown, "crown", badgeConfig, available), "grace-crown");
    strict_1.default.equal((0, sparkRewards_1.resolveBadgeSpriteAssetId)({ ...secondStudentCrown, assetId: "missing" }, "crown", badgeConfig, available), "shared-crown");
});
