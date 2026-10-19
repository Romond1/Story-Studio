"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneReadiness = void 0;
exports.fitLogicalFrame = fitLogicalFrame;
/** Uniform contain transform; authored CSS pixels remain logical units. */
function fitLogicalFrame(frame, host) {
    const scale = Math.min(host.width / frame.width, host.height / frame.height);
    return { scale, x: (host.width - frame.width * scale) / 2, y: (host.height - frame.height * scale) / 2 };
}
class SceneReadiness {
    required;
    loaded = new Set();
    failed = new Set();
    constructor(required) {
        this.required = required;
    }
    settle(src, error = false) {
        if (!this.required.includes(src))
            return;
        (error ? this.failed : this.loaded).add(src);
    }
    get state() {
        if (this.failed.size)
            return 'error';
        return this.required.every(src => this.loaded.has(src)) ? 'ready' : 'loading';
    }
}
exports.SceneReadiness = SceneReadiness;
