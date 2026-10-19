"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaSlide = createMediaSlide;
exports.registerPoolImport = registerPoolImport;
exports.insertPoolAssets = insertPoolAssets;
exports.mediaUsage = mediaUsage;
const mediaReferences_1 = require("./mediaReferences");
const mediaImportValidation_1 = require("./mediaImportValidation");
const mediaRegistry_1 = require("./content/mediaRegistry");
function createMediaSlide(asset, sectionId, id) {
    return { id: id(), assetId: asset.id, sectionId, transition: 'fade', ...(asset.mediaType === 'video' ? { videoAudio: { enabled: true, volume: 1 } } : {}) };
}
function registerPoolImport(data, result, binId) {
    (0, mediaImportValidation_1.validateMediaImport)(data, result);
    if (binId && !data.mediaBins?.some(bin => bin.id === binId))
        throw new Error('The destination bin no longer exists. Copied files have been preserved.');
    const assets = (0, mediaReferences_1.decorateImportedAssetsForContext)(data, result.importedAssets, null).map(a => ({ ...a, ...(!a.binId && binId ? { binId } : {}) }));
    const bins = (result.importedBins ?? []).map(bin => ({ ...bin, ...(!bin.parentId && binId ? { parentId: binId } : {}) }));
    return { ...data, assets: [...data.assets, ...assets], ...(bins.length ? { mediaBins: [...(data.mediaBins ?? []), ...bins] } : {}) };
}
/** A slot is before a stable slide ID, or the end of a section. */
function insertPoolAssets(data, assetIds, sectionId, beforeId, id) {
    const section = data.sections.find(s => s.id === sectionId);
    if (!section)
        throw Error('The destination section no longer exists.');
    const assets = assetIds.map(assetId => data.assets.find(a => a.id === assetId));
    if (assets.some(a => !a || a.mediaType === 'audio'))
        throw Error('Use the Audio inspector to attach audio. Only images and videos create lesson slides.');
    const added = assets.map(a => createMediaSlide(a, sectionId, id));
    let at = data.slides.length;
    if (beforeId) {
        at = data.slides.findIndex(s => s.id === beforeId && s.sectionId === sectionId);
        if (at < 0)
            throw Error('The insertion target no longer exists.');
    }
    else {
        const last = data.slides.map(s => s.sectionId).lastIndexOf(sectionId);
        if (last >= 0)
            at = last + 1;
    }
    return { ...data, slides: [...data.slides.slice(0, at), ...added, ...data.slides.slice(at)], sections: section.type === 'break' ? data.sections.map(s => s.id === sectionId ? { ...s, breakMedia: [...(s.breakMedia ?? []), ...added.map(slide => ({ id: id(), slideId: slide.id, fit: 'contain' }))] } : s) : data.sections };
}
/** Count authored references, including non-slide image/audio usages. */
function mediaUsage(data, assetId) {
    return (0, mediaRegistry_1.createMediaRegistry)({ format: 'legacy', data }).usages(assetId).length;
}
