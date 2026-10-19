"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEpisodeProject = parseEpisodeProject;
const model_1 = require("../lesson/model");
const sections_1 = require("../lesson/sections");
const validation_1 = require("../lesson/validation");
const imageTransforms_1 = require("../content/imageTransforms");
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 500) => typeof v === 'string' && v.length <= max;
const id = (v) => text(v, 200) && !!v && !['__proto__', 'prototype', 'constructor', ...Object.getOwnPropertyNames(Object.prototype)].includes(v);
const check = (v, field) => { if (!v)
    throw new Error(`Invalid episode ${field}`); };
const list = (v) => Array.isArray(v) && v.length <= 2000;
const fields = (v, keys, name) => check(Object.keys(v).every(key => keys.includes(key)), `${name} field`);
function parseEpisodeProject(value) {
    check(object(value) && value.format === 'story-studio-episode' && value.version === 1, 'format/version');
    const p = value;
    fields(p, ['format', 'version', 'id', 'title', 'createdAt', 'updatedAt', 'assets', 'mediaBins', 'scenes', 'sequences', 'sections', 'cards', 'library', 'cardSets', 'adventure', 'requiredCapabilities', 'derivedImages', 'catalog'], 'document');
    check(object(p.adventure) && id(p.adventure.id) && text(p.adventure.version, 200) && !!p.adventure.version, 'adventure');
    fields(p.adventure, ['id', 'version'], 'adventure');
    check(list(p.requiredCapabilities) && p.requiredCapabilities.every((v) => ['derived-images-v1', 'manual-catalog-v1'].includes(v)) && new Set(p.requiredCapabilities).size === p.requiredCapabilities.length, 'required capabilities');
    check(list(p.assets) && list(p.derivedImages), 'media');
    const physical = new Map();
    for (const asset of p.assets) {
        check(object(asset) && id(asset.id) && !physical.has(asset.id), 'physical identity');
        physical.set(asset.id, asset);
    }
    const derived = new Set();
    for (const image of p.derivedImages) {
        check(object(image), 'derived image');
        fields(image, ['id', 'kind', 'label', 'sourceAssetId', 'transform', 'presentation'], 'derived image');
        check(id(image.id) && !physical.has(image.id) && !derived.has(image.id) && image.kind === 'derived-image' && (image.label === undefined || text(image.label)), 'derived identity');
        check(physical.get(image.sourceAssetId)?.mediaType === 'image', 'derived physical image source');
        (0, imageTransforms_1.validateImageTransform)(image.transform);
        (0, imageTransforms_1.validateImagePresentation)(image.presentation);
        derived.add(image.id);
    }
    check(!derived.size || p.requiredCapabilities.includes('derived-images-v1'), 'derived capability');
    const hasAsset = (value, kind) => typeof value === 'string' && (derived.has(value) ? !kind || kind === 'image' : physical.has(value) && (!kind || physical.get(value).mediaType === kind));
    (0, validation_1.validateSceneDocumentBody)(p, hasAsset);
    check(object(p.catalog) && list(p.catalog.entities) && (p.catalog.collections === undefined || list(p.catalog.collections)), 'catalog');
    fields(p.catalog, ['entities', 'collections'], 'catalog');
    const entities = new Set();
    for (const entity of p.catalog.entities) {
        check(object(entity), 'entity');
        fields(entity, ['id', 'adventureId', 'kind', 'name', 'tags', 'assetIds', 'tagAnnotations'], 'entity');
        check(id(entity.id) && !entities.has(entity.id) && entity.adventureId === p.adventure.id, 'entity adventure/identity');
        entities.add(entity.id);
        check(['character', 'location', 'item', 'other'].includes(entity.kind) && text(entity.name) && entity.name.trim() && list(entity.tags) && entity.tags.every((tag) => text(tag, 100)) && new Set(entity.tags).size === entity.tags.length, 'entity metadata');
        check(list(entity.assetIds) && entity.assetIds.every((asset) => hasAsset(asset)) && new Set(entity.assetIds).size === entity.assetIds.length, 'entity media links');
        if (entity.tagAnnotations !== undefined) {
            check(list(entity.tagAnnotations), 'tag annotations');
            for (const annotation of entity.tagAnnotations) {
                check(object(annotation), 'tag annotation');
                fields(annotation, ['tag', 'source', 'author'], 'tag annotation');
                check(entity.tags.includes(annotation.tag) && ['manual', 'imported'].includes(annotation.source) && (annotation.author === undefined || text(annotation.author, 200)), 'tag provenance');
            }
        }
    }
    const collections = new Set();
    for (const collection of p.catalog.collections ?? []) {
        check(object(collection), 'collection');
        fields(collection, ['id', 'adventureId', 'name', 'entityIds'], 'collection');
        check(id(collection.id) && !collections.has(collection.id) && collection.adventureId === p.adventure.id && text(collection.name) && collection.name.trim(), 'collection identity');
        collections.add(collection.id);
        check(list(collection.entityIds) && collection.entityIds.every((entity) => typeof entity === 'string' && entities.has(entity)) && new Set(collection.entityIds).size === collection.entityIds.length, 'collection entity references');
    }
    check((!entities.size && !collections.size) || p.requiredCapabilities.includes('manual-catalog-v1'), 'catalog capability');
    return (0, sections_1.migrateSections)((0, model_1.clone)(value));
}
