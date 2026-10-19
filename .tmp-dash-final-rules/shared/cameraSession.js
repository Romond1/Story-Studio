"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CameraSession = void 0;
/** Serial acquisition, including unabortable permission requests. No media/audio globals. */
class CameraSession {
    constructor(acquire, release) {
        this.acquire = acquire;
        this.release = release;
        this.generation = 0;
        this.current = null;
        this.pending = Promise.resolve();
    }
    stop() {
        this.generation++;
        if (this.current) {
            this.release(this.current);
            this.current = null;
        }
    }
    start(deviceId) {
        this.stop();
        const generation = this.generation;
        const next = this.pending.catch(() => { }).then(async () => {
            if (generation !== this.generation)
                return null;
            const stream = await this.acquire(deviceId);
            if (generation !== this.generation) {
                this.release(stream);
                return null;
            }
            this.current = stream;
            return stream;
        });
        this.pending = next;
        return next;
    }
}
exports.CameraSession = CameraSession;
