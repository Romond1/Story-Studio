import type {
  AssetItem,
  AudioClip,
  BCardInstance,
  BreakMedia,
  BreakRefItem,
  MarkerStroke,
  ProjectData,
  Section,
  SequenceItem,
  SlideRefItem,
  StoryReferenceItem,
} from "./types";

type IdFactory = () => string;

function cloneAudioClip(clip: AudioClip): AudioClip {
  return {
    ...clip,
    tags: clip.tags ? [...clip.tags] : undefined,
  };
}

function cloneBreakMediaItem(item: BreakMedia, createId: IdFactory): BreakMedia {
  return {
    ...item,
    id: createId(),
  };
}

function cloneMarkerStroke(stroke: MarkerStroke, createId: IdFactory): MarkerStroke {
  return {
    ...stroke,
    id: createId(),
    points: stroke.points.map((point) => ({ ...point })),
  };
}

function cloneStoryReference(item: StoryReferenceItem, createId: IdFactory): StoryReferenceItem {
  return {
    ...item,
    id: createId(),
    bCardInstances: item.bCardInstances?.map((instance) => cloneBCardInstance(instance, createId)),
  };
}

function cloneBCardInstance(item: BCardInstance, createId: IdFactory): BCardInstance {
  return {
    ...item,
    id: createId(),
    position: { ...item.position },
    size: { ...item.size },
    flags: item.flags ? { ...item.flags } : undefined,
  };
}

function cloneSectionForDuplication(section: Section, createId: IdFactory): Section {
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

export function updateSectionInProjectData(
  data: ProjectData,
  sectionId: string,
  updates: Partial<Section>,
): ProjectData {
  return {
    ...data,
    sections: data.sections.map((section) =>
      section.id === sectionId ? { ...section, ...updates } : section,
    ),
  };
}

export function appendAssetsAndUpdateSection(
  data: ProjectData,
  sectionId: string,
  assets: AssetItem[],
  updates: Partial<Section>,
): ProjectData {
  const nextData = assets.length
    ? {
        ...data,
        assets: [...data.assets, ...assets],
      }
    : data;

  return updateSectionInProjectData(nextData, sectionId, updates);
}

export function duplicateBreakSectionInProjectData(
  data: ProjectData,
  sectionId: string,
  createId: IdFactory,
): { data: ProjectData; duplicatedId: string } | null {
  const sourceIndex = data.sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex === -1) return null;

  const source = data.sections[sourceIndex];
  if (source.type !== "break") return null;

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

export function moveSectionInProjectData(
  data: ProjectData,
  sectionId: string,
  direction: "up" | "down",
): ProjectData | null {
  const index = data.sections.findIndex((section) => section.id === sectionId);
  if (index === -1) return null;
  if (direction === "up" && index === 0) return null;
  if (direction === "down" && index === data.sections.length - 1) return null;

  const nextSections = [...data.sections];
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  [nextSections[index], nextSections[swapIndex]] = [nextSections[swapIndex], nextSections[index]];

  return {
    ...data,
    sections: nextSections,
  };
}

function cleanSequence(seq: SequenceItem[], deletedSlideIds: Set<string>, deletedSectionId: string): SequenceItem[] {
  return (seq || []).filter((item) => {
    if (item.type === "slideRef") return !deletedSlideIds.has((item as SlideRefItem).slideId);
    if (item.type === "breakRef") return (item as BreakRefItem).breakId !== deletedSectionId;
    return true;
  });
}

export function deleteSectionInProjectData(
  data: ProjectData,
  sectionId: string,
): { data: ProjectData; deletedSlideIds: Set<string>; deletedSectionIndex: number } | null {
  const sectionIndex = data.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex === -1) return null;

  const deletedSlideIds = new Set(
    data.slides.filter((slide) => slide.sectionId === sectionId).map((slide) => slide.id),
  );

  const slides = data.slides.filter((slide) => slide.sectionId !== sectionId);
  const sections = data.sections
    .filter((section) => section.id !== sectionId)
    .map((section) =>
      section.breakMedia
        ? {
            ...section,
            breakMedia: section.breakMedia.filter((media) => !deletedSlideIds.has(media.slideId)),
          }
        : section,
    );

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
