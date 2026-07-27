"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const imageAdjustments_1 = require("./imageAdjustments");
function createSlide() {
    return {
        id: "slide-1",
        assetId: "asset-1",
        sectionId: "section-1",
        transition: "fade",
    };
}
(0, node_test_1.default)("legacy image slides without adjustments keep default display", () => {
    const normalized = (0, imageAdjustments_1.normalizeSlideImageAdjustments)(createSlide(), "image");
    strict_1.default.equal(normalized.imageAdjustments, undefined);
    strict_1.default.deepEqual((0, imageAdjustments_1.resolveImageAdjustments)(normalized.imageAdjustments), imageAdjustments_1.DEFAULT_IMAGE_ADJUSTMENTS);
});
(0, node_test_1.default)("saved image adjustments are preserved and clamped", () => {
    const normalized = (0, imageAdjustments_1.normalizeSlideImageAdjustments)({
        ...createSlide(),
        imageAdjustments: {
            flipX: true,
            brightness: 1.35,
            contrast: 0.65,
            saturate: 1.8,
        },
    }, "image");
    strict_1.default.deepEqual(normalized.imageAdjustments, {
        flipX: true,
        brightness: 1.35,
        contrast: 0.65,
        saturate: 1.8,
    });
});
(0, node_test_1.default)("invalid saved image adjustment values fall back safely", () => {
    const normalized = (0, imageAdjustments_1.normalizeImageAdjustments)({
        flipX: "yes",
        brightness: 99,
        contrast: Number.NaN,
        saturate: -4,
    });
    strict_1.default.deepEqual(normalized, {
        brightness: 2,
        saturate: 0,
    });
    strict_1.default.deepEqual((0, imageAdjustments_1.resolveImageAdjustments)(normalized), {
        flipX: false,
        brightness: 2,
        contrast: 1,
        saturate: 0,
    });
});
(0, node_test_1.default)("non-image slides do not retain image adjustment metadata", () => {
    const normalized = (0, imageAdjustments_1.normalizeSlideImageAdjustments)({
        ...createSlide(),
        imageAdjustments: {
            flipX: true,
            brightness: 1.2,
        },
    }, "video");
    strict_1.default.equal(normalized.imageAdjustments, undefined);
});
