"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validCaption = validCaption;
exports.hasSpeech = hasSpeech;
function validCaption(value) {
    if (!value || typeof value !== 'object')
        return false;
    const c = value;
    return ['ja', 'it', 'ro'].includes(c.language) && ['standard', 'kana', 'furigana'].includes(c.mode)
        && Number.isFinite(c.fontSize) && c.fontSize >= 20 && c.fontSize <= 72
        && ['top', 'bottom'].includes(c.position) && Array.isArray(c.tokens) && c.tokens.length <= 1000
        && c.tokens.every(t => t && typeof t.text === 'string' && t.text.length <= 2000 && (t.reading === undefined || typeof t.reading === 'string' && t.reading.length <= 2000))
        && c.tokens.reduce((n, t) => n + t.text.length + (t.reading?.length ?? 0), 0) <= 6000;
}
function hasSpeech(audio) {
    if (audio.length < 4800 || audio.length > 320000)
        return false;
    let voiced = 0;
    for (let start = 0; start < audio.length; start += 320) {
        let energy = 0;
        for (let i = start; i < Math.min(start + 320, audio.length); i++) {
            if (!Number.isFinite(audio[i]))
                return false;
            energy += audio[i] ** 2;
        }
        if (Math.sqrt(energy / 320) > 0.008)
            voiced++;
    }
    return voiced >= 10;
}
