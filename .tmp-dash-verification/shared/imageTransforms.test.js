"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const imageTransforms_1 = require("./content/imageTransforms");
const source = { width: 2, height: 2, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 128, 255, 255, 255, 0]) };
(0, node_test_1.default)('pixel transform neutral identity and flip-before-clockwise rotation preserve alpha', () => {
    const neutral = (0, imageTransforms_1.transformImagePixels)(source, { version: 1 }, { fit: 'contain' });
    strict_1.default.deepEqual(neutral, source);
    const result = (0, imageTransforms_1.transformImagePixels)(source, { version: 1, flipX: true, rotation: 90 }, { fit: 'contain' });
    strict_1.default.deepEqual(Array.from(result.data), [255, 255, 255, 0, 0, 255, 0, 255, 0, 0, 255, 128, 255, 0, 0, 255]);
    strict_1.default.equal(source.data[0], 255);
});
(0, node_test_1.default)('crop geometry, non-square rotation, cover focal and contain transparent padding', () => {
    const pixels = { width: 4, height: 1, data: new Uint8ClampedArray([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255]) };
    const crop = (0, imageTransforms_1.transformImagePixels)(pixels, { version: 1, crop: { x: .25, y: 0, width: .5, height: 1 }, rotation: 90 }, { fit: 'contain' });
    strict_1.default.equal(crop.width, 1);
    strict_1.default.equal(crop.height, 2);
    strict_1.default.deepEqual(Array.from(crop.data), [20, 0, 0, 255, 30, 0, 0, 255]);
    const contain = (0, imageTransforms_1.transformImagePixels)(pixels, { version: 1 }, { fit: 'contain', aspectRatio: 1 });
    strict_1.default.equal(contain.height, 4);
    strict_1.default.equal(contain.data[3], 0);
    const cover = (0, imageTransforms_1.transformImagePixels)(pixels, { version: 1 }, { fit: 'cover', aspectRatio: 1, focalX: 1 });
    strict_1.default.equal(cover.data[0], 40);
    strict_1.default.equal((0, imageTransforms_1.imageTransformLayout)(4, 1, { version: 1, rotation: 90 }, { fit: 'contain' }).output.height, 4);
});
(0, node_test_1.default)('finite normalized transforms reject unsupported values; color math is deterministic', () => {
    for (const transform of [{ version: 2 }, { version: 1, crop: { x: .8, y: 0, width: .5, height: 1 } }, { version: 1, brightness: Infinity }, { version: 1, rotation: 45 }])
        strict_1.default.throws(() => (0, imageTransforms_1.validateImageTransform)(transform));
    const color = (0, imageTransforms_1.transformImagePixels)(source, { version: 1, brightness: 0 }, { fit: 'contain' });
    strict_1.default.deepEqual(Array.from(color.data.slice(0, 4)), [0, 0, 0, 255]);
    strict_1.default.throws(() => (0, imageTransforms_1.imageTransformLayout)(5000, 5000, { version: 1 }, { fit: 'contain' }), /limit/);
    const gray = (0, imageTransforms_1.transformImagePixels)(source, { version: 1, saturation: 0 }, { fit: 'contain' });
    strict_1.default.deepEqual(Array.from(gray.data.slice(0, 4)), [54, 54, 54, 255]);
    const midpoint = (0, imageTransforms_1.transformImagePixels)(source, { version: 1, contrast: 0 }, { fit: 'contain' });
    strict_1.default.deepEqual(Array.from(midpoint.data.slice(0, 4)), [128, 128, 128, 255]);
    const reverse = (0, imageTransforms_1.transformImagePixels)(source, { version: 1, rotation: 180 }, { fit: 'contain' });
    strict_1.default.deepEqual(Array.from(reverse.data.slice(0, 4)), [255, 255, 255, 0]);
    const left = (0, imageTransforms_1.transformImagePixels)(source, { version: 1, rotation: 270 }, { fit: 'contain' });
    strict_1.default.deepEqual(Array.from(left.data.slice(0, 4)), [0, 255, 0, 255]);
});
