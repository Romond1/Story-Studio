"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanMediaDescription = cleanMediaDescription;
exports.getAssetDescription = getAssetDescription;
exports.getCanonicalAssetLabel = getCanonicalAssetLabel;
exports.getAssetDisplayLabel = getAssetDisplayLabel;
exports.decorateImportedAssetsForContext = decorateImportedAssetsForContext;
exports.withCanonicalAssetDefaults = withCanonicalAssetDefaults;
function toSentenceCase(value) {
    if (!value)
        return 'Media';
    const normalized = value.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
function stripTrailingNoise(value) {
    return value
        .replace(/\(\s*\d+\s*\)\s*$/g, '')
        .replace(/\[\s*\d+\s*\]\s*$/g, '')
        .replace(/\s+\d+\s*$/g, '')
        .replace(/\s+(copy|final|edited?|export|draft)\s*$/gi, '')
        .trim();
}
function cleanMediaDescription(rawName, removeNumbers = false) {
    const withoutExt = rawName.replace(/\.[^.]+$/, '');
    const withOptionalNumberCleanup = removeNumbers
        ? withoutExt.replace(/\d+/g, ' ')
        : withoutExt;
    const replaced = withOptionalNumberCleanup
        .replace(/[_-]+/g, ' ')
        .replace(/[.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const cleaned = stripTrailingNoise(replaced).replace(/\s+/g, ' ').trim();
    return toSentenceCase(cleaned || 'Media');
}
function fallbackAssetName(asset) {
    return asset.originalName || asset.filename || asset.id || 'Media';
}
function getAssetDescription(asset) {
    if (!asset)
        return 'Unknown';
    return asset.referenceDescription || cleanMediaDescription(fallbackAssetName(asset));
}
function getCanonicalAssetLabel(asset) {
    if (!asset)
        return 'Unknown';
    if (asset.canonicalLabel)
        return asset.canonicalLabel;
    const description = getAssetDescription(asset);
    if (!asset.referenceCode)
        return description;
    return `${asset.referenceCode} ${description}`.trim();
}
function getAssetDisplayLabel(asset, mode) {
    if (!asset)
        return 'Unknown';
    return mode === 'teach' ? getAssetDescription(asset) : getCanonicalAssetLabel(asset);
}
function getSectionContext(sections, sectionId) {
    if (!sectionId)
        return { type: 'general' };
    const section = sections.find((item) => item.id === sectionId);
    if (!section)
        return { type: 'general' };
    if (section.type === 'break') {
        let breakOrdinal = 0;
        for (const item of sections) {
            if (item.type !== 'break')
                continue;
            breakOrdinal += 1;
            if (item.id === section.id) {
                return { type: 'break', contextId: section.id, contextOrdinal: breakOrdinal };
            }
        }
        return { type: 'break', contextId: section.id, contextOrdinal: 1 };
    }
    let sectionOrdinal = 0;
    for (const item of sections) {
        if (item.type === 'break')
            continue;
        sectionOrdinal += 1;
        if (item.id === section.id) {
            return { type: 'section', contextId: section.id, contextOrdinal: sectionOrdinal };
        }
    }
    return { type: 'section', contextId: section.id, contextOrdinal: 1 };
}
function parseOrdinalFromCode(referenceCode, contextType) {
    if (!referenceCode)
        return 0;
    const match = contextType === 'break'
        ? /^B\d+\.(\d+)$/i.exec(referenceCode.trim())
        : /^\d+\.(\d+)$/.exec(referenceCode.trim());
    if (!match)
        return 0;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : 0;
}
function getSlideAssetIdsForSection(data, sectionId) {
    const ids = new Set();
    for (const slide of data.slides) {
        if (slide.sectionId === sectionId)
            ids.add(slide.assetId);
    }
    return ids;
}
function getSlideAssetIdsForBreak(data, breakSectionId) {
    const breakSection = data.sections.find((item) => item.id === breakSectionId);
    if (!breakSection)
        return new Set();
    const breakSlideIds = new Set((breakSection.breakMedia || []).map((item) => item.slideId));
    const ids = new Set();
    for (const slide of data.slides) {
        if (breakSlideIds.has(slide.id))
            ids.add(slide.assetId);
    }
    return ids;
}
function getContextBaseCount(data, context) {
    const ids = context.type === 'section'
        ? getSlideAssetIdsForSection(data, context.contextId)
        : getSlideAssetIdsForBreak(data, context.contextId);
    for (const asset of data.assets) {
        if (asset.referenceContext === context.type && asset.referenceContextId === context.contextId) {
            ids.add(asset.id);
        }
    }
    return ids.size;
}
function getContextMaxOrdinal(data, context) {
    let maxOrdinal = 0;
    for (const asset of data.assets) {
        if (asset.referenceContext !== context.type || asset.referenceContextId !== context.contextId)
            continue;
        const candidate = typeof asset.referenceOrdinal === 'number' && Number.isFinite(asset.referenceOrdinal)
            ? asset.referenceOrdinal
            : parseOrdinalFromCode(asset.referenceCode, context.type);
        if (candidate > maxOrdinal)
            maxOrdinal = candidate;
    }
    return maxOrdinal;
}
function decorateImportedAssetsForContext(data, importedAssets, targetSectionId) {
    if (!importedAssets.length)
        return importedAssets;
    const context = getSectionContext(data.sections, targetSectionId);
    if (context.type === 'general') {
        return importedAssets.map((asset) => {
            const description = cleanMediaDescription(fallbackAssetName(asset), asset.mediaType === 'image' || asset.mediaType === 'video');
            return {
                ...asset,
                referenceContext: 'general',
                referenceDescription: description,
                canonicalLabel: description,
            };
        });
    }
    const contextState = { type: context.type, contextId: context.contextId };
    const baseCount = getContextBaseCount(data, contextState);
    const maxOrdinal = getContextMaxOrdinal(data, contextState);
    const startIndex = Math.max(baseCount, maxOrdinal) + 1;
    return importedAssets.map((asset, offset) => {
        const referenceOrdinal = startIndex + offset;
        const referenceCode = context.type === 'break'
            ? `B${context.contextOrdinal}.${referenceOrdinal}`
            : `${context.contextOrdinal}.${referenceOrdinal}`;
        const description = cleanMediaDescription(fallbackAssetName(asset), asset.mediaType === 'image' || asset.mediaType === 'video');
        const canonicalLabel = `${referenceCode} ${description}`.trim();
        return {
            ...asset,
            referenceCode,
            referenceDescription: description,
            canonicalLabel,
            referenceContext: context.type,
            referenceContextId: context.contextId,
            referenceOrdinal,
        };
    });
}
function withCanonicalAssetDefaults(data) {
    const assets = data.assets.map((asset) => {
        const description = getAssetDescription(asset);
        const referenceCode = asset.referenceCode?.trim() || undefined;
        const canonicalLabel = referenceCode ? `${referenceCode} ${description}`.trim() : description;
        return {
            ...asset,
            referenceDescription: description,
            canonicalLabel: asset.canonicalLabel || canonicalLabel,
        };
    });
    return { ...data, assets };
}
