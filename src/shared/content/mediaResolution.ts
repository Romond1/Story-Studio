import type { MediaType } from '../types';
export type ProjectLease = { id: string };
export type AssetRef = { assetId: string };
export type AssetResolution = { ok: true; assetId: string; mediaType: MediaType; url: string } | { ok: false; code: 'missing' | 'ambiguous' | 'wrong-type' | 'stale-project' | 'unsafe-path' | 'unregistered'; assetId?: string };
export interface AssetResolver { resolve(lease: ProjectLease, ref: AssetRef, expected?: MediaType): Promise<AssetResolution> }
/** Decode each segment once. Reject residual escapes, encoded separators and all traversal. */
export function canonicalMediaPath(value: string): string | undefined {
  let path = value.replace(/\\/g, '/');
  if (path.startsWith('media://')) path = path.slice(8).replace(/^\//, '');
  else if (/^[a-z][a-z\d+.-]*:/i.test(path)) return undefined;
  path = path.split(/[?#]/, 1)[0];
  if (!path || path.startsWith('/')) return undefined;
  try {
    const segments = path.split('/').map(segment => decodeURIComponent(segment));
    if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\/:\x00-\x1f%]/.test(segment) || /[. ]$/.test(segment))) return undefined;
    return segments.join('/');
  } catch { return undefined; }
}
export function compatibilityMediaUrl(value: string): string | undefined {
  const path = canonicalMediaPath(value);
  return path === undefined ? undefined : `media://${path.split('/').map(encodeURIComponent).join('/')}`;
}
