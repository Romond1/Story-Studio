"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSectionInProjectData = updateSectionInProjectData;
exports.appendAssetsAndUpdateSection = appendAssetsAndUpdateSection;
exports.duplicateBreakSectionInProjectData = duplicateBreakSectionInProjectData;
exports.moveSectionInProjectData = moveSectionInProjectData;
exports.deleteSectionInProjectData = deleteSectionInProjectData;
function cloneAudioClip(clip) {
    return {
        ...clip,
        tags: clip.tags ? [...clip.tags] : undefined,
    };
}
function cloneBreakMediaItem(item, createId) {
    return {
        ...item,
        id: createId(),
    };
}
function cloneMarkerStroke(stroke, createId) {
    return {
        ...stroke,
        id: createId(),
        points: stroke.points.map((point) => ({ ...point })),
    };
}
function cloneStoryReference(item, createId) {
    return {
        ...item,
        id: createId(),
        bCardInstances: item.bCardInstances?.map((instance) => cloneBCardInstance(instance, createId)),
    };
}
function cloneBCardInstance(item, createId) {
    return {
        ...item,
        id: createId(),
        position: { ...item.position },
        size: { ...item.size },
        flags: item.flags ? { ...item.flags } : undefined,
    };
}
function cloneSectionForDuplication(section, createId) {
    return {
        ...section,
        id: createId(),
        name: `${section.name} Copy`,
        tags: section.tags ? [...section.tags] : undefined,
        bgm: section.bgm?.map(cloneAudioClip),
        breakMedia: section.breakMedia?.map((item) => cloneBreakMediaItem(item, createId)),
        markerStrokes: section.markerStrokes?.map((stroke) => cloneMarkerStroke(stroke, createId)),
        breakViewport: section.breakViewport ? { ...section.breakViewport } : undefined,
        bgTransform: section.bgTransform ? { ...section.bgTransform } : undefined,
        storyReferences: section.storyReferences?.map((item) => cloneStoryReference(item, createId)),
        bCardInstances: section.bCardInstances?.map((item) => cloneBCardInstance(item, createId)),
    };
}
function updateSectionInProjectData(data, sectionId, updates) {
    return {
        ...data,
        sections: data.sections.map((section) => section.id === sectionId ? { ...section, ...updates } : section),
    };
}
function appendAssetsAndUpdateSection(data, sectionId, assets, updates) {
    const nextData = assets.length
        ? {
            ...data,
            assets: [...data.assets, ...assets],
        }
        : data;
    return updateSectionInProjectData(nextData, sectionId, updates);
}
function duplicateBreakSectionInProjectData(data, sectionId, createId) {
    const sourceIndex = data.sections.findIndex((section) => section.id === sectionId);
    if (sourceIndex === -1)
        return null;
    const source = data.sections[sourceIndex];
    if (source.type !== "break")
        return null;
    const duplicated = cloneSectionForDuplication(source, createId);
    const nextSections = [...data.sections];
    nextSections.splice(sourceIndex + 1, 0, duplicated);
    return {
        data: {
            ...data,
            sections: nextSections,
        },
        duplicatedId: duplicated.id,
    };
}
function moveSectionInProjectData(data, sectionId, direction) {
    const index = data.sections.findIndex((section) => section.id === sectionId);
    if (index === -1)
        return null;
    if (direction === "up" && index === 0)
        return null;
    if (direction === "down" && index === data.sections.length - 1)
        return null;
    const nextSections = [...data.sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [nextSections[index], nextSections[swapIndex]] = [nextSections[swapIndex], nextSections[index]];
    return {
        ...data,
        sections: nextSections,
    };
}
function cleanSequence(seq, deletedSlideIds, deletedSectionId) {
    return (seq || []).filter((item) => {
        if (item.type === "slideRef")
            return !deletedSlideIds.has(item.slideId);
        if (item.type === "breakRef")
            return item.breakId !== deletedSectionId;
        return true;
    });
}
function deleteSectionInProjectData(data, sectionId) {
    const sectionIndex = data.sections.findIndex((section) => section.id === sectionId);
    if (sectionIndex === -1)
        return null;
    const deletedSlideIds = new Set(data.slides.filter((slide) => slide.sectionId === sectionId).map((slide) => slide.id));
    const slides = data.slides.filter((slide) => slide.sectionId !== sectionId);
    const sections = data.sections
        .filter((section) => section.id !== sectionId)
        .map((section) => section.breakMedia
        ? {
            ...section,
            breakMedia: section.breakMedia.filter((media) => !deletedSlideIds.has(media.slideId)),
        }
        : section);
    const boostPack = data.boostPack
        ? {
            activationSequence: cleanSequence(data.boostPack.activationSequence, deletedSlideIds, sectionId),
            languageSequence: cleanSequence(data.boostPack.languageSequence, deletedSlideIds, sectionId),
            gamesSequence: cleanSequence(data.boostPack.gamesSequence, deletedSlideIds, sectionId),
        }
        : data.boostPack;
    return {
        data: {
            ...data,
            slides,
            sections,
            boostPack,
        },
        deletedSlideIds,
        deletedSectionIndex: sectionIndex,
    };
}
