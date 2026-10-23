import type { AssetItem, ImportResult, MediaBin } from './types';
import { canonicalMediaPath } from './content/mediaResolution';

/** Refuse ambiguous registration. Copied files remain available for recovery. */
export function validateMediaImport(project: { assets: AssetItem[]; mediaBins?: MediaBin[] }, imported: ImportResult): void {
  const unique = (existing: readonly { id: string }[], additions: readonly { id: string }[], kind: string) => {
    const ids = new Set(existing.map(item => item.id));
    for (const item of additions) {
      if (!item.id || ids.has(item.id)) throw new Error(`Media import ${kind} identity collision: ${item.id}. Copied files have been preserved.`);
      ids.add(item.id);
    }
  };
  unique(project.assets, imported.importedAssets, 'asset');
  const replacements = imported.replacedAssets ?? [];
  unique([], replacements, 'replacement');
  for (const asset of replacements) {
    const existing = project.assets.find(item => item.id === asset.id);
    if (!existing || existing.mediaType !== asset.mediaType || (existing.originalName || existing.filename).toLowerCase() !== (asset.originalName || asset.filename).toLowerCase()) throw new Error('Invalid media replacement. Copied files have been preserved.');
  }
  unique(project.mediaBins ?? [], imported.importedBins ?? [], 'bin');
  const paths = new Set(project.assets.map(asset => asset.relativePath && canonicalMediaPath(asset.relativePath)).filter(Boolean));
  for (const asset of [...imported.importedAssets, ...replacements]) {
    if (asset.relativePath === undefined) continue; // Older in-memory callers may register metadata incrementally.
    const path = canonicalMediaPath(asset.relativePath);
    if (!path) throw new Error('Unsafe media import path. Copied files have been preserved.');
    if (paths.has(path)) throw new Error('Media import path collision. Copied files have been preserved.');
    paths.add(path);
  }
  const parents = new Map([...(project.mediaBins ?? []), ...(imported.importedBins ?? [])].map(bin => [bin.id, bin.parentId]));
  for (const asset of imported.importedAssets) if (asset.binId && !parents.has(asset.binId)) throw new Error('Imported asset refers to a missing bin. Copied files have been preserved.');
  for (const bin of imported.importedBins ?? []) {
    if (bin.parentId && !parents.has(bin.parentId)) throw new Error('Imported bin refers to a missing parent bin. Copied files have been preserved.');
    const seen = new Set<string>();
    let current: string | undefined = bin.id;
    while (current) {
      if (seen.has(current)) throw new Error('Media import bin cycle. Copied files have been preserved.');
      seen.add(current); current = parents.get(current);
    }
  }
}
