"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visualMediaUrl = visualMediaUrl;
exports.visualMediaBackground = visualMediaBackground;
/** Render-only cache identity. Never store these URLs back into the project. */
function visualMediaUrl(url, scope) {
    if (!url.startsWith('media://'))
        return url;
    const hashIndex = url.indexOf('#');
    const fragment = hashIndex < 0 ? '' : url.slice(hashIndex);
    const head = hashIndex < 0 ? url : url.slice(0, hashIndex);
    const queryIndex = head.indexOf('?');
    const base = queryIndex < 0 ? head : head.slice(0, queryIndex);
    const query = new URLSearchParams(queryIndex < 0 ? '' : head.slice(queryIndex + 1));
    query.set('sceneScope', scope);
    return `${base}?${query}${fragment}`;
}
function visualMediaBackground(background, scope) {
    return background.replace(/url\(['"]?(media:\/\/[^)'"\s]+)['"]?\)/g, (_match, url) => `url("${visualMediaUrl(url, scope)}")`);
}
