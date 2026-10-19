"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezeSnapshot = freezeSnapshot;
exports.createMediaRegistry = createMediaRegistry;
const mediaDependencies_1 = require("./mediaDependencies");
const mediaResolution_1 = require("./mediaResolution");
function freezeSnapshot(value) {
    if (value && typeof value === 'object') {
        for (const item of Object.values(value))
            freezeSnapshot(item);
        Object.freeze(value);
    }
    return value;
}
function createMediaRegistry(document) {
    const assets = freezeSnapshot(document.data.assets.map(asset => ({ ...asset }))), bins = freezeSnapshot((document.data.mediaBins ?? []).map(bin => ({ ...bin })));
    const ids = new Map(), paths = new Map(), diagnostics = [];
    assets.forEach((asset, i) => {
        ids.set(asset.id, [...(ids.get(asset.id) ?? []), asset]);
        const path = (0, mediaResolution_1.canonicalMediaPath)(asset.relativePath);
        if (path)
            paths.set(path, [...(paths.get(path) ?? []), asset]);
        else
            diagnostics.push({ kind: 'unsafe-path', field: `/assets/${i}/relativePath`, value: asset.relativePath });
    });
    for (const [id, records] of ids)
        if (records.length > 1)
            diagnostics.push({ kind: 'duplicate-id', field: '/assets', value: id });
    for (const [path, records] of paths)
        if (records.length > 1)
            diagnostics.push({ kind: 'ambiguous-path', field: '/assets', value: path });
    const binIds = new Map();
    bins.forEach(bin => binIds.set(bin.id, [...(binIds.get(bin.id) ?? []), bin]));
    for (const [id, records] of binIds)
        if (records.length > 1)
            diagnostics.push({ kind: 'duplicate-bin', field: '/mediaBins', value: id });
    bins.forEach((bin, i) => {
        const seen = new Set();
        let current = bin;
        while (current) {
            if (seen.has(current.id)) {
                diagnostics.push({ kind: 'bin-cycle', field: `/mediaBins/${i}/parentId`, value: current.id });
                break;
            }
            seen.add(current.id);
            if (!current.parentId)
                break;
            const parent = binIds.get(current.parentId);
            if (!parent) {
                diagnostics.push({ kind: 'missing-bin', field: `/mediaBins/${i}/parentId`, value: current.parentId });
                break;
            }
            current = parent.length === 1 ? parent[0] : undefined;
        }
    });
    assets.forEach((asset, i) => { if (asset.binId && !binIds.has(asset.binId))
        diagnostics.push({ kind: 'missing-bin', field: `/assets/${i}/binId`, value: asset.binId }); });
    const get = (id) => ids.get(id)?.length === 1 ? ids.get(id)[0] : undefined;
    const imageIds = new Map();
    assets.filter(asset => asset.mediaType === 'image').forEach(asset => imageIds.set(asset.id, [...(imageIds.get(asset.id) ?? []), { id: asset.id, label: asset.originalName || asset.filename, mediaType: 'image' }]));
    if (document.format === 'scene' && document.data.format === 'story-studio-episode')
        for (const derived of document.data.derivedImages) {
            if (ids.has(derived.id) || imageIds.has(derived.id))
                diagnostics.push({ kind: 'duplicate-id', field: '/derivedImages', value: derived.id });
            const existing = imageIds.get(derived.id) ?? [];
            imageIds.set(derived.id, [...existing, { id: derived.id, label: derived.label || derived.id, mediaType: 'image', sourceAssetId: derived.sourceAssetId }, ...(ids.has(derived.id) && !existing.length ? [{ id: derived.id, label: derived.id, mediaType: 'image' }] : [])]);
        }
    const images = freezeSnapshot([...imageIds.values()].filter(records => records.length === 1).map(records => records[0]));
    const image = (id) => imageIds.get(id)?.length === 1 ? images.find(item => item.id === id) : undefined;
    const resolvePath = (value, expected) => {
        const path = (0, mediaResolution_1.canonicalMediaPath)(value);
        if (!path)
            return { ok: false, code: 'unsafe-path' };
        const records = paths.get(path);
        if (!records)
            return { ok: false, code: 'unregistered' };
        if (records.length !== 1 || !get(records[0].id))
            return { ok: false, code: 'ambiguous' };
        const asset = records[0];
        if (expected && asset.mediaType !== expected)
            return { ok: false, code: 'wrong-type', assetId: asset.id };
        return { ok: true, assetId: asset.id, mediaType: asset.mediaType, url: (0, mediaResolution_1.compatibilityMediaUrl)(value) };
    };
    const report = freezeSnapshot((0, mediaDependencies_1.collectMediaDependencies)(document, { get: id => imageIds.has(id) ? image(id) : get(id), has: id => ids.has(id) || imageIds.has(id), resolvePath }));
    return Object.freeze({ get, list: (type) => type ? Object.freeze(assets.filter(asset => asset.mediaType === type)) : assets, bins: () => bins, dependencies: () => report, usages: (id) => Object.freeze(report.uses.filter(use => use.assetId === id)), diagnostics: () => freezeSnapshot(diagnostics), resolvePath, images: () => images, image });
}
