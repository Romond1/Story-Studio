/** Render-only cache identity. Never store these URLs back into the project. */
export function visualMediaUrl(url: string, scope: string): string {
  if (!url.startsWith('media://')) return url;
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex < 0 ? '' : url.slice(hashIndex);
  const head = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const queryIndex = head.indexOf('?');
  const base = queryIndex < 0 ? head : head.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex < 0 ? '' : head.slice(queryIndex + 1));
  query.set('sceneScope', scope);
  return `${base}?${query}${fragment}`;
}

export function visualMediaBackground(background: string, scope: string): string {
  return background.replace(/url\(['"]?(media:\/\/[^)'"\s]+)['"]?\)/g,
    (_match, url: string) => `url("${visualMediaUrl(url, scope)}")`);
}
