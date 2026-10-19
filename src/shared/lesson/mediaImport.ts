import type { AssetItem, ImportResult, MediaBin } from '../types';
import { validateMediaImport } from '../mediaImportValidation';

/** Capture the destination before opening a picker; preserve imported folder trees. */
export function mergeLessonMediaImport<T extends { assets: AssetItem[]; mediaBins: MediaBin[] }>(project: T, imported: ImportResult, destination?: string): T {
  validateMediaImport(project, imported);
  const target = project.mediaBins.some(bin => bin.id === destination) ? destination : undefined;
  const bins = imported.importedBins ?? [];
  const importedIds = new Set(bins.map(bin => bin.id));
  return {
    ...project,
    assets: [...project.assets, ...imported.importedAssets.map(asset => ({ ...asset, binId: asset.binId && importedIds.has(asset.binId) ? asset.binId : target }))],
    mediaBins: [...project.mediaBins, ...bins.map(bin => ({ ...bin, parentId: bin.parentId && importedIds.has(bin.parentId) ? bin.parentId : target }))],
  };
}
