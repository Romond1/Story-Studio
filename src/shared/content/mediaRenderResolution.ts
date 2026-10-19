export type MediaPathResolver = (value: string) => string | undefined;
/** Transform only presentation values. Never assign the result to authored fields. */
export function resolveAuthoredMediaUrl(value: string, resolve: MediaPathResolver): string {
  if (/^(https?:|data:)/i.test(value)) return value;
  return resolve(value) ?? '';
}
export function resolveAuthoredBackground(value: string, resolve: MediaPathResolver): string {
  return value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match, _quote, path: string) => {
    const url = resolveAuthoredMediaUrl(path, resolve);
    return url ? `url("${url.replace(/"/g, '%22')}")` : 'none';
  });
}
