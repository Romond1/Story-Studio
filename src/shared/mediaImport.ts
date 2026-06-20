import type { BreakMedia, ImportResult, ProjectData } from "./types";
import { decorateImportedAssetsForContext } from "./mediaReferences";

export function applyMediaImportToProjectData(
  data: ProjectData,
  result: ImportResult,
  targetSectionId?: string | null,
): ProjectData {
  const resolvedSectionId = targetSectionId ?? data.sections[0]?.id ?? null;
  const targetSection = resolvedSectionId
    ? data.sections.find((section) => section.id === resolvedSectionId)
    : undefined;

  const createdSlides = resolvedSectionId
    ? result.createdSlides.map((slide) => ({ ...slide, sectionId: resolvedSectionId }))
    : result.createdSlides;

  const importedAssets = decorateImportedAssetsForContext(
    data,
    result.importedAssets,
    resolvedSectionId,
  );

  const nextData: ProjectData = {
    ...data,
    slides: [...data.slides, ...createdSlides],
    assets: [...data.assets, ...importedAssets],
  };

  if (targetSection?.type !== "break" || createdSlides.length === 0) {
    return nextData;
  }

  const addedBreakMedia: BreakMedia[] = createdSlides.map((slide) => ({
    id: `break-${slide.id}`,
    slideId: slide.id,
    fit: "contain",
  }));

  return {
    ...nextData,
    sections: nextData.sections.map((section) =>
      section.id === targetSection.id
        ? { ...section, breakMedia: [...(section.breakMedia || []), ...addedBreakMedia] }
        : section,
    ),
  };
}
