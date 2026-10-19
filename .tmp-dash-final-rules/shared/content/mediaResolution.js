"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalMediaPath = canonicalMediaPath;
exports.compatibilityMediaUrl = compatibilityMediaUrl;
/** Decode each segment once. Reject residual escapes, encoded separators and all traversal. */
function canonicalMediaPath(value) {
    let path = value.replace(/\\/g, '/');
    if (path.startsWith('media://'))
        path = path.slice(8).replace(/^\//, '');
    else if (/^[a-z][a-z\d+.-]*:/i.test(path))
        return undefined;
    path = path.split(/[?#]/, 1)[0];
    if (!path || path.startsWith('/'))
        return undefined;
    try {
        const segments = path.split('/').map(segment => decodeURIComponent(segment));
        if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\/:\x00-\x1f%]/.test(segment) || /[. ]$/.test(segment)))
            return undefined;
        return segments.join('/');
    }
    catch {
        return undefined;
    }
}
function compatibilityMediaUrl(value) {
    const path = canonicalMediaPath(value);
    return path === undefined ? undefined : `media://${path.split('/').map(encodeURIComponent).join('/')}`;
}
