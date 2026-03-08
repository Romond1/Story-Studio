import type { AssetItem, ProjectData, Section } from './types';

export type MediaLabelMode = 'edit' | 'teach';

type SectionContext =
  | { type: 'section'; contextId: string; contextOrdinal: number }
  | { type: 'break'; contextId: string; contextOrdinal: number }
  | { type: 'general' };

function toSentenceCase(value: string): string {
  if (!value) return 'Media';
  const normalized = value.toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function stripTrailingNoise(value: string): string {
  return value
    .replace(/\(\s*\d+\s*\)\s*$/g, '')
    .replace(/\[\s*\d+\s*\]\s*$/g, '')
    .replace(/\s+\d+\s*$/g, '')
    .replace(/\s+(copy|final|edited?|export|draft)\s*$/gi, '')
    .trim();
}

export function cleanMediaDescription(rawName: string, removeNumbers = false): string {
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

function fallbackAssetName(asset: AssetItem): string {
  return asset.originalName || asset.filename || asset.id || 'Media';
}

export function getAssetDescription(asset: AssetItem | null | undefined): string {
  if (!asset) return 'Unknown';
  return asset.referenceDescription || cleanMediaDescription(fallbackAssetName(asset));
}

export function getCanonicalAssetLabel(asset: AssetItem | null | undefined): string {
  if (!asset) return 'Unknown';
  if (asset.canonicalLabel) return asset.canonicalLabel;
  const description = getAssetDescription(asset);
  if (!asset.referenceCode) return description;
  return `${asset.referenceCode} ${description}`.trim();
}

export function getAssetDisplayLabel(
  asset: AssetItem | null | undefined,
  mode: MediaLabelMode,
): string {
  if (!asset) return 'Unknown';
  return mode === 'teach' ? getAssetDescription(asset) : getCanonicalAssetLabel(asset);
}

function getSectionContext(sections: Section[], sectionId?: string | null): SectionContext {
  if (!sectionId) return { type: 'general' };
  const section = sections.find((item) => item.id === sectionId);
  if (!section) return { type: 'general' };

  if (section.type === 'break') {
    let breakOrdinal = 0;
    for (const item of sections) {
      if (item.type !== 'break') continue;
      breakOrdinal += 1;
      if (item.id === section.id) {
        return { type: 'break', contextId: section.id, contextOrdinal: breakOrdinal };
      }
    }
    return { type: 'break', contextId: section.id, contextOrdinal: 1 };
  }

  let sectionOrdinal = 0;
  for (const item of sections) {
    if (item.type === 'break') continue;
    sectionOrdinal += 1;
    if (item.id === section.id) {
      return { type: 'section', contextId: section.id, contextOrdinal: sectionOrdinal };
    }
  }
  return { type: 'section', contextId: section.id, contextOrdinal: 1 };
}

function parseOrdinalFromCode(referenceCode: string | undefined, contextType: 'section' | 'break'): number {
  if (!referenceCode) return 0;
  const match = contextType === 'break'
    ? /^B\d+\.(\d+)$/i.exec(referenceCode.trim())
    : /^\d+\.(\d+)$/.exec(referenceCode.trim());
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSlideAssetIdsForSection(data: ProjectData, sectionId: string): Set<string> {
  const ids = new Set<string>();
  for (const slide of data.slides) {
    if (slide.sectionId === sectionId) ids.add(slide.assetId);
  }
  return ids;
}

function getSlideAssetIdsForBreak(data: ProjectData, breakSectionId: string): Set<string> {
  const breakSection = data.sections.find((item) => item.id === breakSectionId);
  if (!breakSection) return new Set<string>();
  const breakSlideIds = new Set((breakSection.breakMedia || []).map((item) => item.slideId));
  const ids = new Set<string>();
  for (const slide of data.slides) {
    if (breakSlideIds.has(slide.id)) ids.add(slide.assetId);
  }
  return ids;
}

function getContextBaseCount(
  data: ProjectData,
  context: { type: 'section' | 'break'; contextId: string },
): number {
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

function getContextMaxOrdinal(
  data: ProjectData,
  context: { type: 'section' | 'break'; contextId: string },
): number {
  let maxOrdinal = 0;
  for (const asset of data.assets) {
    if (asset.referenceContext !== context.type || asset.referenceContextId !== context.contextId) continue;
    const candidate = typeof asset.referenceOrdinal === 'number' && Number.isFinite(asset.referenceOrdinal)
      ? asset.referenceOrdinal
      : parseOrdinalFromCode(asset.referenceCode, context.type);
    if (candidate > maxOrdinal) maxOrdinal = candidate;
  }
  return maxOrdinal;
}

export function decorateImportedAssetsForContext(
  data: ProjectData,
  importedAssets: AssetItem[],
  targetSectionId?: string | null,
): AssetItem[] {
  if (!importedAssets.length) return importedAssets;

  const context = getSectionContext(data.sections, targetSectionId);
  if (context.type === 'general') {
    return importedAssets.map((asset) => {
      const description = cleanMediaDescription(
        fallbackAssetName(asset),
        asset.mediaType === 'image' || asset.mediaType === 'video',
      );
      return {
        ...asset,
        referenceContext: 'general',
        referenceDescription: description,
        canonicalLabel: description,
      };
    });
  }

  const contextState = { type: context.type, contextId: context.contextId } as const;
  const baseCount = getContextBaseCount(data, contextState);
  const maxOrdinal = getContextMaxOrdinal(data, contextState);
  const startIndex = Math.max(baseCount, maxOrdinal) + 1;

  return importedAssets.map((asset, offset) => {
    const referenceOrdinal = startIndex + offset;
    const referenceCode = context.type === 'break'
      ? `B${context.contextOrdinal}.${referenceOrdinal}`
      : `${context.contextOrdinal}.${referenceOrdinal}`;
    const description = cleanMediaDescription(
      fallbackAssetName(asset),
      asset.mediaType === 'image' || asset.mediaType === 'video',
    );
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

export function withCanonicalAssetDefaults(data: ProjectData): ProjectData {
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
