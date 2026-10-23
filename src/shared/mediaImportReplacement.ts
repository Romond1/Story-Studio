import type { AssetItem, ProjectData } from './types';
import { createMediaRegistry } from './content/mediaRegistry';
import { canonicalMediaPath, compatibilityMediaUrl } from './content/mediaResolution';

/** Rewrite only schema-owned media path fields, leaving prose and ID references intact. */
export function replaceLegacyMedia(data: ProjectData, replacements: AssetItem[] = []): ProjectData {
  if (!replacements.length) return data;
  const registry = createMediaRegistry({format:'legacy',data});
  const next = structuredClone(data);
  for (const replacement of replacements) {
    const old = data.assets.find(asset => asset.id === replacement.id);
    if (!old) continue;
    for (const use of registry.usages(old.id)) {
      const keys = use.field.slice(1).split('/').map(key=>key.replace(/~1/g,'/').replace(/~0/g,'~'));
      let owner: any = next; for (const key of keys.slice(0,-1)) owner=owner?.[key];
      const key=keys[keys.length-1], value=owner?.[key]; if(typeof value!=='string')continue;
      const css=/^url\(\s*(['"]?)(.*?)\1\s*\)$/.exec(value), path=css?css[2]:value;
      if(canonicalMediaPath(path)!==canonicalMediaPath(old.relativePath))continue;
      const url=path.startsWith('media://')?compatibilityMediaUrl(replacement.relativePath)!:replacement.relativePath;
      owner[key]=css?`url('${url}')`:url;
    }
  }
  next.assets=next.assets.map(asset=>replacements.find(item=>item.id===asset.id)??asset);
  return next;
}
