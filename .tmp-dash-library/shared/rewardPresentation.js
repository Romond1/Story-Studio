"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sparkLifetime = exports.rewardRemaining = exports.RewardAnimationClock = exports.rewardAge = void 0;
exports.rewardRandom = rewardRandom;
exports.setFinalBadgeScroll = setFinalBadgeScroll;
exports.cleanSparkConfig = cleanSparkConfig;
exports.cleanBadgeConfig = cleanBadgeConfig;
exports.parseRewardPresentation = parseRewardPresentation;
const rewardAge = (event, now) => Math.max(0, now - event.startedAt);
exports.rewardAge = rewardAge;
/** CSS advances after mount; refresh the negative delay only when its animation
 * identity changes, including a return from a progress event to visibility. */
class RewardAnimationClock {
    key;
    elapsed = 0;
    age(key, startedAt, now) {
        if (key !== this.key) {
            this.key = key;
            this.elapsed = Math.max(0, now - startedAt);
        }
        return this.elapsed;
    }
}
exports.RewardAnimationClock = RewardAnimationClock;
const rewardRemaining = (event, now) => event.expiresAt === undefined ? Infinity : Math.max(0, event.expiresAt - now);
exports.rewardRemaining = rewardRemaining;
const sparkLifetime = (now, burst, counter, variant) => now + Math.max(burst * (variant === "crown" ? 1.35 : 1), counter);
exports.sparkLifetime = sparkLifetime;
function rewardRandom(id) {
    let state = 2166136261;
    for (const character of id)
        state = Math.imul(state ^ character.charCodeAt(0), 16777619);
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** A delayed wheel/scroll callback cannot move a newer celebration. */
function setFinalBadgeScroll(current, id, scrollTop) {
    if (!current || current.id !== id || !Number.isFinite(scrollTop))
        return current;
    const next = Math.max(0, Math.min(10000000, scrollTop));
    return next === (current.scrollTop ?? 0) ? current : { ...current, scrollTop: next };
}
const obj = (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
        throw Error("object");
    return v;
};
const num = (v) => {
    if (typeof v !== "number" || !Number.isFinite(v))
        throw Error("number");
    return v;
};
const str = (v) => {
    if (typeof v !== "string" || v.length > 32768)
        throw Error("string");
    return v;
};
const choice = (v, choices) => {
    if (!choices.includes(v))
        throw Error("choice");
    return v;
};
const url = (v) => {
    if (v === undefined)
        return;
    const s = str(v);
    if (!s.startsWith("media://"))
        throw Error("media");
    return s;
};
const nums = (raw, keys) => Object.fromEntries(keys.filter((k) => raw[k] !== undefined).map((k) => [k, num(raw[k])]));
const variants = ["gold", "blue", "pink", "crown"];
const shapes = ["star", "diamond", "circle", "heart", "crown"];
function anchor(raw) {
    const id = str(raw.id), startedAt = num(raw.startedAt);
    if (!id || startedAt < 0)
        throw Error("anchor");
    const expiresAt = raw.expiresAt === undefined ? undefined : num(raw.expiresAt);
    if (expiresAt !== undefined && expiresAt < startedAt)
        throw Error("expiry");
    return { id, startedAt, ...(expiresAt === undefined ? {} : { expiresAt }) };
}
function cleanSparkConfig(value) {
    const v = obj(value), keys = [
        "burstDurationMs",
        "particleCount",
        "glowIntensity",
        "colorIntensity",
        "counterVisibleMs",
        "scalePopIntensity",
        "counterSize",
        "sparkSize",
        "positionTop",
        "positionRight",
    ];
    for (const k of keys)
        num(v[k]);
    if (v.particleCount < 0 ||
        v.particleCount > 1000 ||
        v.burstDurationMs < 0 ||
        v.counterVisibleMs < 0)
        throw Error("config");
    return {
        ...nums(v, keys),
        ...(v.shapeByVariant
            ? {
                shapeByVariant: Object.fromEntries(variants
                    .filter((k) => v.shapeByVariant[k] !== undefined)
                    .map((k) => [k, choice(v.shapeByVariant[k], shapes)])),
            }
            : {}),
    };
}
function cleanBadgeConfig(value) {
    const v = obj(value);
    return {
        ...nums(v, ["fontSize", "confettiCount", "celebrationDurationMs"]),
        ...(v.alwaysDisplay === true ? { alwaysDisplay: true } : {}),
        ...(v.background
            ? {
                background: nums(obj(v.background), [
                    "posX",
                    "posY",
                    "scale",
                    "blur",
                    "brightness",
                ]),
            }
            : {}),
        ...(v.animation
            ? {
                animation: {
                    ...nums(obj(v.animation), [
                        "durationMs",
                        "rotationDeg",
                        "colorIntensity",
                        "glowIntensity",
                        "motionIntensity",
                    ]),
                    ...(v.animation.motionType === undefined
                        ? {}
                        : {
                            motionType: choice(v.animation.motionType, [
                                "zoomPop",
                                "slideUp",
                                "fadeIn",
                                "spinPop",
                            ]),
                        }),
                },
            }
            : {}),
    };
}
/** Reconstruct only rendered student data. Never carry project, roster or library objects. */
function parseRewardPresentation(value) {
    try {
        const v = obj(value), f = obj(v.frame), frame = { width: num(f.width), height: num(f.height) };
        if (frame.width <= 0 ||
            frame.height <= 0 ||
            !Array.isArray(v.sparks) ||
            v.sparks.length > 1000)
            return null;
        const sparks = v.sparks.map((r) => {
            const s = obj(r), a = anchor(s);
            if (a.expiresAt === undefined)
                throw Error("expiry");
            return {
                ...a,
                expiresAt: a.expiresAt,
                variant: choice(s.variant, variants),
                studentName: str(s.studentName),
                delta: num(s.delta),
                config: cleanSparkConfig(s.config),
                ...(url(s.image) ? { image: url(s.image) } : {}),
            };
        });
        const result = { frame, sparks };
        if (v.final) {
            const b = obj(v.final);
            if (!Array.isArray(b.students))
                return null;
            result.final = {
                ...anchor(b),
                config: cleanBadgeConfig(b.config),
                ...(b.scrollTop === undefined ? {} : { scrollTop: Math.max(0, Math.min(10000000, num(b.scrollTop))) }),
                ...(url(b.image) ? { image: url(b.image) } : {}),
                students: b.students.map((r) => {
                    const s = obj(r);
                    return {
                        id: str(s.id),
                        name: str(s.name),
                        yellowSparks: num(s.yellowSparks),
                        blueSparks: num(s.blueSparks),
                        pinkSparks: num(s.pinkSparks),
                        crowns: num(s.crowns),
                        stars: num(s.stars),
                    };
                }),
            };
        }
        if (v.base) {
            const b = obj(v.base);
            if (!Array.isArray(b.sprites))
                return null;
            result.base = {
                ...(url(b.image) ? { image: url(b.image) } : {}),
                motion: choice(b.motion, ["spin", "breathe", "zoom"]),
                durationMs: num(b.durationMs),
                intensity: num(b.intensity),
                startedAt: num(b.startedAt),
                sprites: b.sprites.map((r) => {
                    const s = obj(r);
                    return {
                        id: str(s.id),
                        name: str(s.name),
                        variant: choice(s.variant, variants),
                        shape: choice(s.shape, shapes),
                        ...(url(s.image) ? { image: url(s.image) } : {}),
                        score: str(s.score),
                        ...Object.fromEntries(["x", "y", "width", "height", "zIndex"].map((k) => [
                            k,
                            num(s[k]),
                        ])),
                    };
                }),
            };
            if (b.background) {
                const bg = obj(b.background);
                const image = url(bg.image);
                if (!image)
                    return null;
                result.base.background = {
                    image,
                    ...Object.fromEntries(["posX", "posY", "scale", "blur", "brightness"].map((k) => [
                        k,
                        num(bg[k]),
                    ])),
                };
            }
        }
        if (v.relic) {
            const r = obj(v.relic);
            result.relic = {
                title: str(r.title),
                names: r.names.map(str),
                rows: r.rows.map((s) => ({
                    name: str(s.name),
                    progress: num(s.progress),
                })),
                progress: num(r.progress),
                stageTitle: str(r.stageTitle),
                progressLabel: str(r.progressLabel),
                ...(url(r.image) ? { image: url(r.image) } : {}),
                ...(url(r.rewardImage) ? { rewardImage: url(r.rewardImage) } : {}),
                position: choice(r.position, [
                    "topLeft",
                    "topRight",
                    "bottomLeft",
                    "bottomRight",
                    "centerBottom",
                ]),
                x: num(r.x),
                y: num(r.y),
                scale: num(r.scale),
                opacity: num(r.opacity),
                entrance: choice(r.entrance, [
                    "none",
                    "fade",
                    "pop",
                    "slideUp",
                    "zoom",
                ]),
                style: str(r.style),
                durationMs: num(r.durationMs),
                intensity: num(r.intensity),
                visible: r.visible === true,
                visibility: anchor(obj(r.visibility)),
                ...(r.event
                    ? {
                        event: {
                            ...anchor(obj(r.event)),
                            kind: choice(r.event.kind, ["progress", "stage", "complete"]),
                        },
                    }
                    : {}),
                ...(r.reward ? { reward: anchor(obj(r.reward)) } : {}),
            };
        }
        return result;
    }
    catch {
        return null;
    }
}
