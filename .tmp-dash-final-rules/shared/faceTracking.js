"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacePoseFilter = exports.FrameGate = exports.MAX_POSE_AGE = void 0;
exports.buildHatGeometry = buildHatGeometry;
exports.MAX_POSE_AGE = 350;
/** No queue: cadence admission happens before bitmap creation, not after inference. */
class FrameGate {
    constructor() {
        this.pending = null;
        this.last = -Infinity;
    }
    begin(now) {
        if (this.pending !== null || now - this.last < 80)
            return false;
        this.pending = this.last = now;
        return true;
    }
    finish(timestamp, now) {
        if (timestamp !== this.pending)
            return false;
        this.pending = null;
        return now - timestamp <= exports.MAX_POSE_AGE;
    }
}
exports.FrameGate = FrameGate;
const anchors = { nose: 1, forehead: 10, chin: 152, left: 234, right: 454 };
class FacePoseFilter {
    constructor() {
        this.pose = null;
    }
    current(now) {
        if (this.pose && now - this.pose.timestamp > exports.MAX_POSE_AGE)
            this.pose = null;
        return this.pose;
    }
    update(observation, now) {
        if (!observation || now - observation.timestamp > exports.MAX_POSE_AGE
            || !Number.isFinite(observation.timestamp) || observation.matrix.length !== 16 || !observation.matrix.every(Number.isFinite)
            || !Object.values(anchors).every(i => {
                const p = observation.landmarks[i];
                return p && [p.x, p.y, p.z].every(Number.isFinite) && Math.abs(p.x) < 3 && Math.abs(p.y) < 3 && Math.abs(p.z) < 3;
            })) {
            this.pose = null;
            return null;
        }
        const previous = this.current(now);
        if (previous && observation.timestamp <= previous.timestamp)
            return previous;
        const alpha = previous ? 1 - Math.exp(-(observation.timestamp - previous.timestamp) / 45) : 1;
        const result = { timestamp: observation.timestamp, matrix: observation.matrix };
        for (const name of Object.keys(anchors)) {
            const p = observation.landmarks[anchors[name]], old = previous?.[name] ?? p;
            result[name] = { x: old.x + (p.x - old.x) * alpha, y: old.y + (p.y - old.y) * alpha, z: old.z + (p.z - old.z) * alpha };
        }
        this.pose = result;
        return result;
    }
}
exports.FacePoseFilter = FacePoseFilter;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const length = (v) => Math.hypot(v.x, v.y, v.z);
const unit = (v) => { const n = Math.max(length(v), .001); return { x: v.x / n, y: v.y / n, z: v.z / n }; };
/** Weak-perspective head frame from the model's 3D landmarks, in source pixels.
 * z uses image width, matching MediaPipe's normalized depth convention.
 * Projection responds to yaw/pitch as well as translation, scale and roll.
 */
function buildHatGeometry(pose, width, height) {
    const px = (p) => ({ x: p.x * width, y: p.y * height, z: p.z * width });
    const forehead = px(pose.forehead), horizontal = sub(px(pose.right), px(pose.left));
    const up = unit(sub(forehead, px(pose.chin))), x = unit(horizontal);
    const normal = unit({ x: x.y * up.z - x.z * up.y, y: x.z * up.x - x.x * up.z, z: x.x * up.y - x.y * up.x });
    const span = Math.max(4, length(horizontal));
    const project = (across, above, depth) => ({
        x: forehead.x + span * (x.x * across + up.x * above + normal.x * depth),
        y: forehead.y + span * (x.y * across + up.y * above + normal.y * depth),
    });
    // Lift the brim above the forehead, preserving eyes/mouth even during head tilt.
    const brim = Array.from({ length: 24 }, (_, i) => {
        const angle = i * Math.PI / 12;
        return project(Math.cos(angle) * .65, .14, Math.sin(angle) * .22);
    });
    return { brim, left: project(-.49, .16, 0), right: project(.49, .16, 0),
        tip: project(.08, 1.12, -.05), bandLeft: project(-.43, .28, 0), bandRight: project(.43, .28, 0),
        star: project(0, .52, -.02), span };
}
