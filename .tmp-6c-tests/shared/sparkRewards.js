"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REWARD_DEFINITIONS = exports.REWARD_VARIANTS = void 0;
exports.getRewardShapePath = getRewardShapePath;
exports.getStudentRewardTotal = getStudentRewardTotal;
exports.normalizeSparkStudent = normalizeSparkStudent;
exports.awardRewardToStudent = awardRewardToStudent;
exports.resetStudentRewards = resetStudentRewards;
exports.getRewardVariantForKey = getRewardVariantForKey;
exports.normalizeSparkStudents = normalizeSparkStudents;
exports.resolveRewardAppearance = resolveRewardAppearance;
exports.resolveBadgeSpriteAssetId = resolveBadgeSpriteAssetId;
exports.setRewardAssetId = setRewardAssetId;
exports.ensureRewardSprites = ensureRewardSprites;
exports.resizeRewardSprite = resizeRewardSprite;
exports.moveRewardSpriteLayer = moveRewardSpriteLayer;
exports.REWARD_VARIANTS = ["gold", "blue", "pink", "crown"];
exports.REWARD_DEFINITIONS = {
    gold: { label: "Yellow", countField: "yellowSparks", defaultShape: "star", colorRgb: "255, 215, 0" },
    blue: { label: "Blue", countField: "blueSparks", defaultShape: "star", colorRgb: "0, 191, 255" },
    pink: { label: "Pink", countField: "pinkSparks", defaultShape: "star", colorRgb: "255, 105, 180" },
    crown: { label: "Crown", countField: "crowns", defaultShape: "crown", colorRgb: "255, 184, 48" },
};
const SHAPE_PATHS = {
    star: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z",
    diamond: "M12 2L22 12L12 22L2 12Z",
    circle: "M12 2A10 10 0 1 1 11.999 2Z",
    heart: "M12 21L10.55 19.68C5.4 15.02 2 11.94 2 8.17C2 5.09 4.42 2.67 7.5 2.67C9.24 2.67 10.91 3.48 12 4.76C13.09 3.48 14.76 2.67 16.5 2.67C19.58 2.67 22 5.09 22 8.17C22 11.94 18.6 15.02 13.45 19.69Z",
    crown: "M3 18L2 6L7.5 11L12 3L16.5 11L22 6L21 18ZM4 21V19H20V21Z",
};
function safeCount(value) {
    return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}
function getRewardShapePath(shape) {
    return SHAPE_PATHS[shape];
}
function getStudentRewardTotal(student) {
    return safeCount(student.yellowSparks)
        + safeCount(student.blueSparks)
        + safeCount(student.pinkSparks)
        + safeCount(student.crowns);
}
function normalizeSparkStudent(value, createId) {
    if (!value || typeof value !== "object")
        return null;
    const raw = value;
    const student = {
        id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
        name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Student",
        yellowSparks: safeCount(raw.yellowSparks),
        blueSparks: safeCount(raw.blueSparks),
        pinkSparks: safeCount(raw.pinkSparks),
        crowns: safeCount(raw.crowns),
        stars: 0,
        badgeVisible: raw.badgeVisible !== false,
        badgeSparkVariant: exports.REWARD_VARIANTS.includes(raw.badgeSparkVariant)
            ? raw.badgeSparkVariant
            : "gold",
    };
    student.stars = getStudentRewardTotal(student);
    return student;
}
function awardRewardToStudent(students, activeStudentId, variant) {
    const field = exports.REWARD_DEFINITIONS[variant].countField;
    return students.map((student) => {
        if (student.id !== activeStudentId)
            return student;
        const next = { ...student, [field]: safeCount(student[field]) + 1 };
        return { ...next, stars: getStudentRewardTotal(next) };
    });
}
function resetStudentRewards(students, activeStudentId) {
    return students.map((student) => student.id === activeStudentId
        ? { ...student, yellowSparks: 0, blueSparks: 0, pinkSparks: 0, crowns: 0, stars: 0 }
        : student);
}
function getRewardVariantForKey(key) {
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    if (normalized === "[")
        return "gold";
    if (normalized === "]")
        return "blue";
    if (normalized === "\\")
        return "pink";
    if (normalized === "p")
        return "crown";
    return null;
}
function normalizeSparkStudents(input, createId) {
    if (!Array.isArray(input))
        return [];
    return input
        .map((item) => normalizeSparkStudent(item, createId))
        .filter((item) => item !== null);
}
function resolveRewardAppearance(variant, sparkConfig, badgeConfig, availableAssetIds) {
    const shape = sparkConfig.shapeByVariant?.[variant] ?? exports.REWARD_DEFINITIONS[variant].defaultShape;
    const configuredAssetId = badgeConfig.badgeSparkAssetIds?.[variant];
    return {
        shape,
        assetId: configuredAssetId && availableAssetIds.has(configuredAssetId)
            ? configuredAssetId
            : undefined,
    };
}
function resolveBadgeSpriteAssetId(sprite, variant, badgeConfig, availableAssetIds) {
    if (sprite.assetId && availableAssetIds.has(sprite.assetId)) {
        return sprite.assetId;
    }
    const sharedAssetId = badgeConfig.badgeSparkAssetIds?.[variant];
    return sharedAssetId && availableAssetIds.has(sharedAssetId) ? sharedAssetId : undefined;
}
function setRewardAssetId(current, variant, assetId) {
    const next = { ...(current || {}) };
    if (assetId)
        next[variant] = assetId;
    else
        delete next[variant];
    return next;
}
function ensureRewardSprites(sprites, students, createId) {
    const next = [...sprites];
    for (const [studentIndex, student] of students.filter((item) => item.badgeVisible !== false).entries()) {
        let nextX = next
            .filter((sprite) => sprite.studentId === student.id)
            .reduce((right, sprite) => Math.max(right, sprite.x + sprite.width + 18), 70 + studentIndex * 30);
        for (const [variantIndex, variant] of exports.REWARD_VARIANTS.entries()) {
            if (next.some((sprite) => sprite.studentId === student.id && (sprite.variant || "gold") === variant))
                continue;
            const size = variant === "crown" ? { width: 140, height: 140 } : { width: 140, height: 170 };
            next.push({
                id: createId(),
                studentId: student.id,
                variant,
                x: Math.min(nextX, 1500),
                y: 100 + (studentIndex % 2) * 180 + (variantIndex % 2) * 18,
                ...size,
                zIndex: 20 + studentIndex * exports.REWARD_VARIANTS.length + variantIndex,
            });
            nextX += size.width + 18;
        }
    }
    return next;
}
function resizeRewardSprite(sprite, requestedWidth, bounds = { min: 60, max: 420 }) {
    const width = Math.min(bounds.max, Math.max(bounds.min, Number.isFinite(requestedWidth) ? requestedWidth : sprite.width));
    const ratio = sprite.width > 0 && sprite.height > 0 ? sprite.width / sprite.height : 1;
    return { width: Math.round(width), height: Math.round(width / ratio) };
}
function moveRewardSpriteLayer(sprites, spriteId, direction) {
    const values = sprites.map((sprite) => sprite.zIndex ?? 20);
    if (!sprites.some((sprite) => sprite.id === spriteId) || values.length === 0)
        return sprites;
    const zIndex = direction === "forward"
        ? Math.min(9999, Math.max(...values) + 1)
        : Math.max(-9999, Math.min(...values) - 1);
    return sprites.map((sprite) => sprite.id === spriteId ? { ...sprite, zIndex } : sprite);
}
