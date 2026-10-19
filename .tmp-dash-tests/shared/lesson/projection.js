"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectScene = projectScene;
exports.parseScenePlan = parseScenePlan;
exports.sceneImageSources = sceneImageSources;
const cardV2Render_1 = require("../cardV2Render");
const model_1 = require("./model");
const rewardPresentation_1 = require("../rewardPresentation");
const rewards_1 = require("./rewards");
const mediaRegistry_1 = require("../content/mediaRegistry");
const mediaResolution_1 = require("../content/mediaResolution");
function projectScene(project, sceneId, session, resolveAsset) {
    const scene = project.scenes[sceneId];
    if (!scene)
        throw new Error('Scene does not exist.');
    const live = session && (0, model_1.sceneAt)(project, session.cursor)?.id === sceneId ? session : undefined;
    const registry = resolveAsset ? undefined : (0, mediaRegistry_1.createMediaRegistry)({ format: 'scene', data: project });
    const source = resolveAsset ?? (id => { const asset = registry.get(id); return asset && (0, mediaResolution_1.compatibilityMediaUrl)(asset.relativePath); });
    const backgroundId = scene.background.assetId;
    const background = backgroundId && (project.assets.find(asset => asset.id === backgroundId) ?? (project.format === 'story-studio-episode' && project.derivedImages.some(image => image.id === backgroundId) ? { id: backgroundId, mediaType: 'image' } : undefined));
    const backgroundSrc = background && source(background.id);
    const objects = [];
    for (const object of scene.objects) {
        if (!object.visible)
            continue;
        if (object.kind === 'card') {
            const definition = project.cards[object.cardId];
            if (!definition?.faces.length)
                continue;
            const state = live?.cards[object.id];
            const faceId = definition.faces.some(face => face.id === state?.faceId) ? state.faceId : object.initialFaceId;
            const box = { ...(state?.box ?? object.box) };
            const card = (0, cardV2Render_1.buildCardV2FacePlan)(definition, faceId, box, source);
            card.instanceId = object.id;
            card.concealed = state?.concealed ?? object.initiallyConcealed;
            if (card.concealed) {
                card.texts = [];
                delete card.image;
                card.overflow = false;
            }
            objects.push({ id: object.id, kind: 'card', box, card });
        }
        else if (object.kind === 'image') {
            const src = source(object.assetId);
            if (src)
                objects.push({ id: object.id, kind: 'image', box: { ...object.box }, src });
        }
        else
            objects.push({ id: object.id, kind: object.kind, box: { ...object.box }, text: object.text,
                fontSize: object.fontSize, color: object.color, align: object.align, ...(object.bubbleDefId ? { bubbleDefId: object.bubbleDefId } : {}) });
    }
    return { version: 1, sceneId, frame: { ...scene.frame }, background: { color: scene.background.color,
            ...(backgroundSrc && background && (background.mediaType === 'image' || background.mediaType === 'video') ? { src: backgroundSrc, mediaType: background.mediaType } : {}) },
        viewport: JSON.parse(JSON.stringify(live?.viewport ?? scene.viewport)), objects,
        drawings: JSON.parse(JSON.stringify([...scene.drawings, ...(live?.drawings ?? [])])),
        ...(live?.rewards ? { rewards: (0, rewards_1.projectLessonRewards)(live.rewards, scene.frame) } : {}),
        transition: { ...scene.transition } };
}
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const color = (value) => typeof value === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value);
const local = (value) => typeof value === 'string' && value.length <= 32768 && /^media:\/\/[^\s<>]+$/i.test(value);
function rectangle(value) {
    return record(value) && [value.x, value.y, value.width, value.height].every(finite) && value.width > 0 && value.height > 0
        ? { x: value.x, y: value.y, width: value.width, height: value.height } : null;
}
/** Reconstruct the whitelist. No project notes, inactive faces, raw HTML or remote URLs cross IPC. */
function parseScenePlan(value) {
    if (!record(value) || value.version !== 1 || !identifier(value.sceneId) || !record(value.frame)
        || ![value.frame.width, value.frame.height].every(n => finite(n) && n >= 1 && n <= 16384)
        || !record(value.background) || !color(value.background.color) || !record(value.viewport) || !record(value.viewport.pan)
        || ![value.viewport.zoom, value.viewport.pan.x, value.viewport.pan.y].every(finite) || value.viewport.zoom < 1 || value.viewport.zoom > 4
        || !Array.isArray(value.objects) || value.objects.length > 2000 || !Array.isArray(value.drawings) || value.drawings.length > 10000
        || !record(value.transition) || !['none', 'fade'].includes(value.transition.kind)
        || !finite(value.transition.durationMs) || value.transition.durationMs < 0 || value.transition.durationMs > 60000)
        return null;
    const rewards = value.rewards === undefined ? undefined : (0, rewardPresentation_1.parseRewardPresentation)(value.rewards);
    if (rewards === null || (rewards && (rewards.frame.width !== value.frame.width || rewards.frame.height !== value.frame.height)))
        return null;
    const background = { color: value.background.color };
    if (value.background.src !== undefined) {
        if (!local(value.background.src) || !['image', 'video'].includes(value.background.mediaType))
            return null;
        background.src = value.background.src;
        background.mediaType = value.background.mediaType;
    }
    const objects = [];
    const ids = new Set();
    for (const object of value.objects) {
        if (!record(object) || !identifier(object.id) || ids.has(object.id))
            return null;
        ids.add(object.id);
        const box = rectangle(object.box);
        if (!box)
            return null;
        if (object.kind === 'card') {
            const parsed = (0, cardV2Render_1.parseCardV2RenderPlan)({ engine: 'card-v2', version: 1, frame: value.frame, cards: [object.card] });
            if (!parsed || parsed.cards[0].instanceId !== object.id)
                return null;
            const card = parsed.cards[0];
            card.box = { ...box };
            objects.push({ id: object.id, kind: 'card', box, card });
        }
        else if (object.kind === 'image') {
            if (!local(object.src))
                return null;
            objects.push({ id: object.id, kind: 'image', box, src: object.src });
        }
        else if (object.kind === 'text' || object.kind === 'bubble') {
            if (typeof object.text !== 'string' || object.text.length > 65536 || !finite(object.fontSize) || object.fontSize < 8 || object.fontSize > 500
                || !color(object.color) || !['left', 'center', 'right'].includes(object.align))
                return null;
            objects.push({ id: object.id, kind: object.kind, box, text: object.text, fontSize: object.fontSize,
                color: object.color, align: object.align, ...(identifier(object.bubbleDefId) ? { bubbleDefId: object.bubbleDefId } : {}) });
        }
        else
            return null;
    }
    const drawings = [];
    for (const stroke of value.drawings) {
        if (!record(stroke) || !identifier(stroke.id) || !color(stroke.color) || !finite(stroke.size) || stroke.size <= 0 || stroke.size > 500
            || !finite(stroke.opacity) || stroke.opacity < 0 || stroke.opacity > 1 || !Array.isArray(stroke.points) || stroke.points.length > 100000)
            return null;
        const points = [];
        for (const point of stroke.points) {
            if (!record(point) || ![point.x, point.y, point.t].every(finite))
                return null;
            points.push({ x: point.x, y: point.y, t: point.t, ...(finite(point.h) ? { h: point.h } : {}) });
        }
        drawings.push({ id: stroke.id, color: stroke.color, size: stroke.size, opacity: stroke.opacity, rainbow: stroke.rainbow === true, points });
    }
    return { version: 1, sceneId: value.sceneId, frame: { width: value.frame.width, height: value.frame.height }, background,
        viewport: { zoom: value.viewport.zoom, pan: { x: value.viewport.pan.x, y: value.viewport.pan.y } }, objects, drawings,
        transition: { kind: value.transition.kind, durationMs: value.transition.durationMs }, ...(rewards ? { rewards } : {}) };
}
function sceneImageSources(plan) {
    return [...new Set([...(plan.background.mediaType === 'image' && plan.background.src ? [plan.background.src] : []),
            ...plan.objects.flatMap(object => object.kind === 'image' ? [object.src] : object.kind === 'card' && object.card.image ? [object.card.image.src] : []),
            ...(plan.rewards?.sparks.flatMap(spark => spark.image ? [spark.image] : []) ?? []), ...(plan.rewards?.final?.image ? [plan.rewards.final.image] : [])])];
}
