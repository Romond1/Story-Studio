import type { AssetItem } from './types';

export const MAX_MEDIA_TITLE_LENGTH = 200;

export function isMediaDisplayTitle(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_MEDIA_TITLE_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

/** Recognizable technical tokens and suffixes only; retain chapter, lesson and year numbers. */
export function mediaDisplayTitle(asset: Readonly<AssetItem>): string {
  if (isMediaDisplayTitle(asset.displayTitle)) return asset.displayTitle;
  const base = (asset.originalName || asset.filename).split(/[\\/]/).pop()!
    .replace(/\.(?:mp4|m4v|mov|webm|avi|mkv|wmv|mpeg|mpg|png|jpe?g|gif|webp|bmp|svg|avif|tiff?|heic|mp3|wav|ogg|m4a|aac|flac)$/i, '');
  // Resolution/codec tokens are unambiguous even in the middle of a filename.
  let clean = base.replace(/(^|[\s_.()[\]-])(?:\d{3,5}\s*[x×]\s*\d{3,5}|(?:480|720|1080|1440|2160|4320)p|[248]k|\d{2,3}(?:\.\d+)?fps|h\.?26[45]|x26[45]|hevc|av1|prores)(?=$|[\s_.()[\]-])/gi, '$1')
    .replace(/\(\s*\)|\[\s*\]/g, '').replace(/[\s_.-]+$/, '');
  // Peel stacked export suffixes before the timestamp so order does not matter.
  const suffix = /[\s_.-]+(?:\(?\d{3,5}\s*[x×]\s*\d{3,5}\)?|\(?(?:480|720|1080|1440|2160|4320)p\)?|[248]k|\d{2,3}(?:\.\d+)?fps|h\.?26[45]|x26[45]|hevc|av1|prores|export(?:ed)?|final|draft|render(?:ed)?)(?:[\s_.-]*\d+)?$/i;
  const timestamp = /[\s_.-]+(?:19|20)\d{2}[-_]?(?:0[1-9]|1[0-2])[-_]?(?:0[1-9]|[12]\d|3[01])(?:[T _-]?\d{2}[-_:]?\d{2}[-_:]?\d{2}(?:[.,]\d{1,6})?Z?)?$/i;
  let previous: string;
  do { previous = clean; clean = clean.replace(suffix, '').replace(timestamp, ''); } while (clean !== previous);
  const readable = (clean || base).replace(/[_-]+|\.+/g, ' ').replace(/\s+/g, ' ').trim();
  return readable.split(' ').map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase()).join(' ');
}

export function mediaTypeBadge(asset: Readonly<AssetItem>): string {
  return asset.mediaType === 'video' ? 'VID' : asset.mediaType === 'image' ? 'PIC' : 'AUD';
}

export function mediaDisplayName(asset: Readonly<AssetItem>): string {
  const title = mediaDisplayTitle(asset);
  return asset.mediaType === 'audio' ? title : `${mediaTypeBadge(asset)} - ${title}`;
}

/** Immutable edit so both project histories can treat a rename as one normal revision. */
export function renameMediaAsset<T extends { assets: AssetItem[] }>(project: T, id: string, title: string): T {
  const asset = project.assets.find(item => item.id === id);
  if (!asset) throw new Error('This media is no longer in the project.');
  const normalized = title.trim().replace(/^(?:VID|PIC|AUD)\s+-\s+/i, '').replace(/\s+/g, ' ').trim();
  if (!isMediaDisplayTitle(normalized)) throw new Error(`Enter a title between 1 and ${MAX_MEDIA_TITLE_LENGTH} characters.`);
  if (mediaDisplayTitle(asset) === normalized) return project;
  return { ...project, assets: project.assets.map(item => item.id === id ? { ...item, displayTitle: normalized } : item) };
}
