"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAuthoredMediaUrl = resolveAuthoredMediaUrl;
exports.resolveAuthoredBackground = resolveAuthoredBackground;
/** Transform only presentation values. Never assign the result to authored fields. */
function resolveAuthoredMediaUrl(value, resolve) {
    if (/^(https?:|data:)/i.test(value))
        return value;
    return resolve(value) ?? '';
}
function resolveAuthoredBackground(value, resolve) {
    return value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match, _quote, path) => {
        const url = resolveAuthoredMediaUrl(path, resolve);
        return url ? `url("${url.replace(/"/g, '%22')}")` : 'none';
    });
}
