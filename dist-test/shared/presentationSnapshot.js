"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresentSnapshotRelay = void 0;
exports.parsePresentSnapshot = parsePresentSnapshot;
exports.assessPresentEnvelope = assessPresentEnvelope;
const rosterPresentation_1 = require("./students/rosterPresentation");
const rewardPresentation_1 = require("./rewardPresentation");
const movementPresentation_1 = require("./movementPresentation");
const presentationMedia_1 = require("./presentationMedia");
const activityScene_1 = require("./activityScene");
const teachingScene_1 = require("./teachingScene");
const imageAdjustments_1 = require("./imageAdjustments");
const cardV2Render_1 = require("./cardV2Render");
const projection_1 = require("./lesson/projection");
const gameHost_1 = require("./gameHost");
const heroDash_1 = require("./heroDash");
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v) => typeof v === 'string' && v.length > 0 && v.length <= 1024;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const revision = (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
/** Reconstruct a whitelisted object: never forward project/teacher fields through IPC. */
function parsePresentSnapshot(value) {
    const base = parsePresentSnapshotBody(value);
    if (!base || !object(value))
        return null;
    const roster = value.roster === undefined ? undefined : (0, rosterPresentation_1.parseRosterPresentation)(value.roster);
    return roster === null ? null : { ...base, ...(roster ? { roster } : {}) };
}
function parsePresentSnapshotBody(value) {
    if (!object(value) || !id(value.sessionId) || !revision(value.revision) || !object(value.target))
        return null;
    const rewards = value.rewards === undefined ? undefined : (0, rewardPresentation_1.parseRewardPresentation)(value.rewards);
    if (rewards === null)
        return null;
    const movement = value.movement === undefined ? undefined : (0, movementPresentation_1.parseMovementPresentation)(value.movement);
    if (movement === null)
        return null;
    const cardsV2 = value.cardsV2 === undefined ? undefined : (0, cardV2Render_1.parseCardV2RenderPlan)(value.cardsV2);
    if (cardsV2 === null)
        return null;
    const target = value.target;
    if (!id(target.occurrenceId))
        return null;
    if (target.kind === 'game') {
        const game = (0, gameHost_1.parseGameSession)(target);
        const dash = target.gameId === 'hero-dash' ? (0, heroDash_1.parseDashView)(target.dash) : undefined;
        return game && dash !== null ? { sessionId: value.sessionId, revision: value.revision, target: { kind: 'game', occurrenceId: target.occurrenceId, ...game, ...(dash ? { dash } : {}) } } : null;
    }
    if (target.kind === 'scene') {
        const plan = (0, projection_1.parseScenePlan)(target.plan);
        const media = target.media === undefined ? undefined : (0, presentationMedia_1.parseMediaIntent)(target.media);
        if (!plan || media === null || (plan.background.mediaType === 'video' && !media) || (media && plan.background.mediaType !== 'video'))
            return null;
        return { sessionId: value.sessionId, revision: value.revision, target: { kind: 'scene', occurrenceId: target.occurrenceId, plan, ...(media ? { media } : {}) } };
    }
    if (target.kind === 'cards-v2') {
        const plan = (0, cardV2Render_1.parseCardV2RenderPlan)(target.plan);
        return plan ? { sessionId: value.sessionId, revision: value.revision, target: { kind: 'cards-v2', occurrenceId: target.occurrenceId, plan }, ...(movement ? { movement } : {}), ...(rewards ? { rewards } : {}) } : null;
    }
    if (target.kind === 'prompt') {
        if (typeof target.title !== 'string' || typeof target.body !== 'string' || target.title.length > 8192 || target.body.length > 65536)
            return null;
        const base = parsePresentSnapshot({ ...value, target: { ...target, kind: 'board' } });
        if (!base || base.target.kind !== 'board')
            return null;
        return { ...base, target: { ...base.target, kind: 'prompt', title: target.title, body: target.body } };
    }
    if (target.kind === 'video') {
        const media = (0, presentationMedia_1.parseMediaIntent)(target.media);
        const base = parsePresentSnapshot({ ...value, target: { ...target, kind: 'image' } });
        if (!media || !base || base.target.kind !== 'image')
            return null;
        return { ...base, target: { ...base.target, kind: 'video', media } };
    }
    if (target.kind === 'empty' || target.kind === 'unsupported' || target.kind === 'badge') {
        return { sessionId: value.sessionId, revision: value.revision, target: { kind: target.kind, occurrenceId: target.occurrenceId }, ...(cardsV2 ? { cardsV2 } : {}), ...(movement ? { movement } : {}), ...(rewards ? { rewards } : {}) };
    }
    if (target.kind === 'break' || target.kind === 'board') {
        const base = parsePresentSnapshot({ ...value, target: { ...target, kind: 'image', src: 'media://scene' } });
        if (!base || base.target.kind !== 'image' || !base.target.scene || !base.target.activity)
            return null;
        return { ...base, target: { kind: target.kind, occurrenceId: target.occurrenceId, scene: base.target.scene, activity: base.target.activity } };
    }
    // Local media only; no remote trackers, script URLs, or renderer-provided HTML.
    if (target.kind !== 'image' || typeof target.src !== 'string' || target.src.length > 32768 || !target.src.startsWith('media://'))
        return null;
    let scene;
    if (target.scene !== undefined) {
        const raw = target.scene;
        if (!object(raw) || !object(raw.frame) || !finite(raw.frame.width) || !finite(raw.frame.height) || raw.frame.width <= 0 || raw.frame.height <= 0 || !Array.isArray(raw.overlays))
            return null;
        const overlays = [];
        for (const item of raw.overlays) {
            if (!object(item) || item.visible === false)
                continue;
            if (!id(item.id) || typeof item.text !== 'string' || !['speechBubble', 'textBox'].includes(String(item.type)) || !['x', 'y', 'width', 'height'].every(k => finite(item[k])))
                return null;
            const clean = { id: item.id, type: item.type, text: item.text, x: item.x, y: item.y, width: item.width, height: item.height };
            for (const k of ['align', 'bubbleDefId', 'fontFamily', 'fontWeight', 'textColor', 'fontStyle'])
                if (typeof item[k] === 'string')
                    clean[k] = item[k];
            for (const k of ['zIndex', 'fontSize', 'lineHeight'])
                if (finite(item[k]))
                    clean[k] = item[k];
            for (const k of ['flipX', 'flipY', 'textShadow'])
                if (typeof item[k] === 'boolean')
                    clean[k] = item[k];
            if (typeof item.customImageSrc === 'string' && item.customImageSrc.startsWith('media://'))
                clean.customImageSrc = item.customImageSrc;
            if (object(item.textRect) && ['x', 'y', 'width', 'height'].every(k => finite(item.textRect[k])))
                clean.textRect = { x: item.textRect.x, y: item.textRect.y, width: item.textRect.width, height: item.textRect.height };
            overlays.push(clean);
        }
        scene = { frame: { width: raw.frame.width, height: raw.frame.height }, adjustments: (0, imageAdjustments_1.resolveImageAdjustments)(object(raw.adjustments) ? raw.adjustments : undefined), overlays };
        if (raw.imageHeightFraction === 0.5)
            scene.imageHeightFraction = 0.5;
        if (raw.viewport !== undefined) {
            const v = raw.viewport;
            if (!object(v) || !finite(v.zoom) || v.zoom < 1 || v.zoom > 4 || !object(v.pan) || !finite(v.pan.x) || !finite(v.pan.y))
                return null;
            scene.viewport = { zoom: v.zoom, pan: { x: v.pan.x, y: v.pan.y } };
        }
        for (const key of ['markerStrokes', 'transient']) {
            if (raw[key] === undefined)
                continue;
            if (!Array.isArray(raw[key]))
                return null;
            const strokes = [];
            for (const stroke of raw[key]) {
                if (!object(stroke) || !id(stroke.id) || !finite(stroke.size) || !finite(stroke.opacity) || typeof stroke.color !== 'string' || !Array.isArray(stroke.points))
                    return null;
                const points = [];
                for (const point of stroke.points) {
                    if (!object(point) || !finite(point.x) || !finite(point.y) || !finite(point.t))
                        return null;
                    points.push({ x: point.x, y: point.y, t: point.t, ...(finite(point.h) ? { h: point.h } : {}) });
                }
                strokes.push({ id: stroke.id, size: stroke.size, opacity: stroke.opacity, color: stroke.color, rainbow: stroke.rainbow === true, points,
                    ...(key === 'transient' && finite(stroke.fadeMs) ? { fadeMs: stroke.fadeMs } : {}),
                    ...(key === 'transient' && stroke.sparkle === true ? { sparkle: true } : {}),
                });
            }
            scene[key] = key === 'transient' ? (0, teachingScene_1.normalizeTransientStrokes)(strokes) : strokes;
        }
    }
    const activity = target.activity === undefined ? undefined : (0, activityScene_1.parseActivityScene)(target.activity);
    if (activity === null)
        return null;
    let transition;
    if (value.transition !== undefined) {
        const t = value.transition;
        if (!object(t) || !id(t.id) || !id(t.fromOccurrenceId) || t.toOccurrenceId !== target.occurrenceId || !finite(t.startedAt) || t.startedAt < 0 || !finite(t.durationMs) || t.durationMs <= 0 || t.durationMs > 60000 || !['fade', 'crossfade', 'fade-black', 'cinematic', 'pixel', 'blur', 'card-slide'].includes(String(t.kind)) || !['left', 'right', 'up', 'down'].includes(String(t.direction)) || !object(t.from))
            return null;
        const parsedFrom = parsePresentSnapshot({ sessionId: value.sessionId, revision: value.revision, target: { kind: 'image', occurrenceId: t.fromOccurrenceId, src: t.from.src, scene: t.from.scene } });
        if (!parsedFrom || parsedFrom.target.kind !== 'image')
            return null;
        const fromScene = parsedFrom.target.scene;
        if (fromScene) {
            delete fromScene.markerStrokes;
            delete fromScene.transient;
        }
        transition = { id: t.id, startedAt: t.startedAt, durationMs: t.durationMs, kind: t.kind, direction: t.direction, fromOccurrenceId: t.fromOccurrenceId, toOccurrenceId: target.occurrenceId,
            from: { occurrenceId: t.fromOccurrenceId, src: parsedFrom.target.src, ...(fromScene ? { scene: fromScene } : {}) } };
    }
    return { sessionId: value.sessionId, revision: value.revision, target: { kind: 'image', occurrenceId: target.occurrenceId, src: target.src, ...(scene ? { scene } : {}), ...(activity ? { activity } : {}) }, ...(cardsV2 ? { cardsV2 } : {}), ...(transition ? { transition } : {}), ...(movement ? { movement } : {}), ...(rewards ? { rewards } : {}) };
}
/** Main owns only transport order, never navigation or document mutation. */
class PresentSnapshotRelay {
    constructor() {
        this.current = { generation: 0, sequence: 0, snapshot: null };
        this.retiredSessions = new Set();
    }
    get envelope() { return this.current; }
    reset() {
        this.retiredSessions.clear();
        this.current = { generation: this.current.generation + 1, sequence: 0, snapshot: null };
        return this.current;
    }
    publish(value) {
        const snapshot = parsePresentSnapshot(value);
        if (!snapshot || this.retiredSessions.has(snapshot.sessionId))
            return null;
        const previous = this.current.snapshot;
        if (previous?.sessionId === snapshot.sessionId && snapshot.revision <= previous.revision)
            return null;
        if (previous && previous.sessionId !== snapshot.sessionId)
            this.retiredSessions.add(previous.sessionId);
        this.current = { generation: this.current.generation, sequence: this.current.sequence + 1, snapshot };
        return this.current;
    }
}
exports.PresentSnapshotRelay = PresentSnapshotRelay;
function assessPresentEnvelope(current, incoming) {
    if (!current)
        return 'apply';
    if ((incoming.rendererGeneration ?? 0) > (current.rendererGeneration ?? 0))
        return 'apply';
    if ((incoming.rendererGeneration ?? 0) < (current.rendererGeneration ?? 0))
        return 'ignore';
    if (incoming.generation < current.generation || (incoming.generation === current.generation && incoming.sequence <= current.sequence))
        return 'ignore';
    if (incoming.generation === current.generation && incoming.sequence > current.sequence + 1)
        return 'recover';
    return 'apply';
}
