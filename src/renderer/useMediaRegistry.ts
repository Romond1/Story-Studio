import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createMediaRegistry, type ProjectDocument } from '../shared/content/mediaRegistry';
import { canonicalMediaPath } from '../shared/content/mediaResolution';
import { MediaRegistryCache, type ResolvedMediaView } from '../shared/mediaRegistryCache';

/** One immutable authored view and a revocable URL cache for the current project. */
export function useMediaRegistry(document: ProjectDocument | null, folder: string | null, activationKey = '', priorityIds: readonly string[] = []) {
  const registry = useMemo(() => document && createMediaRegistry(document), [document?.format, document?.data]);
  const assets = registry?.list() ?? [];
  const paths = [...new Set(registry?.dependencies().issues.filter(issue => issue.kind === 'unregistered-local').map(issue => canonicalMediaPath(issue.value)).filter((value): value is string => !!value) ?? [])].sort();
  // Pure authoring edits do not revoke working audio/video grants.
  const manifestKey = JSON.stringify([folder, activationKey, assets.map(asset => [asset.id, asset.relativePath, asset.mediaType]), paths]);
  const [loaded, setLoaded] = useState<{ key: string; view: ResolvedMediaView; complete: boolean } | null>(null);
  const cache = useRef<MediaRegistryCache>();
  if (!cache.current) cache.current = new MediaRegistryCache(window.appApi.mediaRegistry);
  useEffect(() => {
    const owner = cache.current!;
    if (!folder || !registry) { owner.retire(); setLoaded(null); return; }
    let active = true;
    let publishedAt=0;
    void owner.refresh(folder, assets.map(asset => ({ ...asset, relativePath: canonicalMediaPath(asset.relativePath) ?? asset.relativePath })), paths, {priorityIds,onProgress:view=>{if(active&&Date.now()-publishedAt>=100){publishedAt=Date.now();setLoaded({key:manifestKey,view,complete:false});}}})
      .then(view => { if (active && view) setLoaded({ key: manifestKey, view, complete:true }); })
      .catch(() => { if (active) setLoaded({ key: manifestKey, complete:true, view: { leaseId: '', revision: -1, byId: new Map(), byPath: new Map(), diagnostics: [{ code: 'unregistered' }] } }); });
    return () => { active = false; owner.retire(); };
  }, [manifestKey]);
  const view = loaded?.key === manifestKey ? loaded.view : null;
  const resolve = useCallback((id: string) => view?.byId.get(id), [view]);
  const resolvePath = useCallback((path: string) => {
    const canonical = canonicalMediaPath(path);
    return canonical ? view?.byPath.get(canonical) : undefined;
  }, [view]);
  return { registry, view, resolve, resolvePath, pending: !!folder && (!view || !loaded?.complete), diagnostics: view?.diagnostics ?? [] };
}
