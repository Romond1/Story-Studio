import { useEffect, useRef, useState } from 'react';
import type { LessonProject } from '../../shared/lesson/model';
import type { ResolvedMediaView } from '../../shared/mediaRegistryCache';
import { renderDerivedImage } from './renderDerivedImage';
import { canonicalImageTransform } from '../../shared/content/imageTransforms';
const emptyUrls: ReadonlyMap<string, string> = new Map();

/** Disposable pixels never become authored AssetItems or saved paths. */
export function useDerivedMedia(project: LessonProject | null, physical: ResolvedMediaView | null) {
  const definitions = project?.format === 'story-studio-episode' ? project.derivedImages : [];
  const key = JSON.stringify([physical?.leaseId, physical?.revision, definitions]);
  const [loaded, setLoaded] = useState<{ key: string; urls: ReadonlyMap<string, string>; errors: string[] }>();
  const committed = useRef<{leaseId:string;revision:number;urls:string[]}>();
  useEffect(() => {
    let active = true;
    if (!physical?.leaseId) return;
    const run = async () => {
      const urls = new Map<string, string>(), errors: string[] = [];
      const previous = committed.current;
      const keepUrls = definitions.length && previous?.leaseId === physical.leaseId && previous.revision === physical.revision ? previous.urls : [];
      const { generation } = await window.appApi.derivedMedia.begin({ leaseId: physical.leaseId, revision: physical.revision, keepUrls });
      if (!active) return;
      // Sequential evaluation bounds peak decoded pixel memory.
      for (const definition of definitions) {
        try {
          const request = { leaseId: physical.leaseId, revision: physical.revision, sourceAssetId: definition.sourceAssetId, generation };
          const source = await window.appApi.derivedMedia.getSource(request);
          if (!active) return;
          const png = await renderDerivedImage(source.url, definition);
          if (!active) return;
          const published = await window.appApi.derivedMedia.publish({ ...request, sourceDigest: source.digest, key: canonicalImageTransform(definition.transform, definition.presentation), png });
          if (!active) return;
          urls.set(definition.id, published.url);
        } catch (error) { errors.push(`${definition.label || definition.id}: ${error instanceof Error ? error.message : error}`); }
      }
      if (active) { committed.current = { leaseId: physical.leaseId, revision: physical.revision, urls: [...urls.values()] }; setLoaded({ key, urls, errors }); }
    };
    void run().catch(error => { if (active) setLoaded({ key, urls: emptyUrls, errors: [String(error)] }); });
    return () => { active = false; };
  }, [key]);
  return { urls: loaded?.key === key ? loaded.urls : emptyUrls, errors: loaded?.key === key ? loaded.errors : [], pending: !!physical && definitions.length > 0 && loaded?.key !== key };
}
