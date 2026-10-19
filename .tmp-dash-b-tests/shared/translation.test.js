"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const translation_1 = require("./translation");
(0, node_test_1.default)('silence and short noise never launch recognition', () => {
    strict_1.default.equal((0, translation_1.hasSpeech)(new Float32Array(16000)), false);
    const noise = Array(16000).fill(0);
    noise[100] = 1;
    strict_1.default.equal((0, translation_1.hasSpeech)(noise), false);
    strict_1.default.equal((0, translation_1.hasSpeech)(Array(320001).fill(.1)), false);
    strict_1.default.equal((0, translation_1.hasSpeech)(Array(16000).fill(NaN)), false);
    strict_1.default.equal((0, translation_1.hasSpeech)(Array.from({ length: 16000 }, (_, i) => .2 * Math.sin(i / 10))), true);
});
(0, node_test_1.default)('caption boundary rejects unsupported languages, invalid sizes and oversized content', () => {
    const caption = { language: 'ja', mode: 'furigana', tokens: [{ text: '勇者', reading: 'ゆうしゃ' }], fontSize: 36, position: 'top' };
    strict_1.default.equal((0, translation_1.validCaption)(caption), true);
    for (const patch of [{ language: 'en' }, { mode: 'html' }, { fontSize: NaN }, { fontSize: 100 }, { position: 'any' }, { tokens: [{ text: 3 }] }, { tokens: [{ text: 'x'.repeat(6001) }] }])
        strict_1.default.equal((0, translation_1.validCaption)({ ...caption, ...patch }), false);
});
