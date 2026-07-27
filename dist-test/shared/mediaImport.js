"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMediaImportToProjectData = applyMediaImportToProjectData;
const mediaReferences_1 = require("./mediaReferences");
function applyMediaImportToProjectData(data, result, targetSectionId) {
    const resolvedSectionId = targetSectionId ?? data.sections[0]?.id ?? null;
    const targetSection = resolvedSectionId
        ? data.sections.find((section) => section.id === resolvedSectionId)
        : undefined;
    const createdSlides = resolvedSectionId
        ? result.createdSlides.map((slide) => ({ ...slide, sectionId: resolvedSectionId }))
        : result.createdSlides;
    const importedAssets = (0, mediaReferences_1.decorateImportedAssetsForContext)(data, result.importedAssets, resolvedSectionId);
    const nextData = {
        ...data,
        slides: [...data.slides, ...createdSlides],
        assets: [...data.assets, ...importedAssets],
    };
    if (targetSection?.type !== "break" || createdSlides.length === 0) {
        return nextData;
    }
    const addedBreakMedia = createdSlides.map((slide) => ({
        id: `break-${slide.id}`,
        slideId: slide.id,
        fit: "contain",
    }));
    return {
        ...nextData,
        sections: nextData.sections.map((section) => section.id === targetSection.id
            ? { ...section, breakMedia: [...(section.breakMedia || []), ...addedBreakMedia] }
            : section),
    };
}
